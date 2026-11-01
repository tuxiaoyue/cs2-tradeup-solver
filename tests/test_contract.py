import json
from pathlib import Path

import pytest
import yaml
from jsonschema import Draft202012Validator, RefResolver


ROOT = Path(__file__).parents[1]


def _schema(name):
    document = yaml.safe_load((ROOT / "openapi.yaml").read_text(encoding="utf-8"))
    return document, document["components"]["schemas"][name]


def _validate_example(filename, schema_name):
    document, schema = _schema(schema_name)
    validator = Draft202012Validator({"$ref": f"#/components/schemas/{schema_name}"}, resolver=RefResolver.from_schema(document))
    validator.validate(json.loads((ROOT / "examples" / filename).read_text(encoding="utf-8-sig")))


def _request_valid(value):
    if set(value) != {"mode", "collection_a", "collection_b"}:
        return False
    if not isinstance(value["collection_a"], str) or not value["collection_a"]:
        return False
    if value["mode"] == "single":
        return value["collection_b"] is None
    return value["mode"] == "dual" and isinstance(value["collection_b"], str) and value["collection_b"] != value["collection_a"]


def _structure_valid(value):
    counts = value["required_collection_counts"]
    if not 1 <= len(counts) <= 2 or len({x["collection_id"] for x in counts}) != len(counts) or sum(x["count"] for x in counts) != 10:
        return False
    if value["status"] == "OPTIMAL":
        if not isinstance(value["basket"], list) or len(value["basket"]) != 10 or len({x["listing_id"] for x in value["basket"]}) != 10:
            return False
        expected = {x["collection_id"]: x["count"] for x in counts}
        actual = {}
        for item in value["basket"]:
            actual[item["collection_id"]] = actual.get(item["collection_id"], 0) + 1
        return actual == expected
    return value["status"] in {"INFEASIBLE", "TIMEOUT", "ERROR"} and value["basket"] is None


def test_public_paths_and_external_examples_are_exact():
    text = (ROOT / "openapi.yaml").read_text(encoding="utf-8")
    assert [line.strip() for line in text.splitlines() if line.startswith("  /v1/")] == [
        "/v1/collections:", "/v1/service-status:", "/v1/solve:", "/v1/jobs/{job_id}:",
    ]
    assert "/internal/" not in text
    for name in ("collections", "service-status", "job-running", "job-completed", "error", "job-failed"):
        assert (ROOT / "examples" / f"{name}.json").is_file()


@pytest.mark.parametrize("filename,schema", [
    ("collections.json", "CollectionCatalogResponse"),
    ("service-status.json", "ServiceStatusResponse"),
    ("job-running.json", "JobResponse"),
    ("job-completed.json", "JobResponse"),
    ("job-failed.json", "JobResponse"),
    ("error.json", "ErrorEnvelope"),
])
def test_examples_validate_against_openapi_schemas(filename, schema):
    _validate_example(filename, schema)


def test_request_invariants():
    assert _request_valid({"mode": "single", "collection_a": "demo-alpha", "collection_b": None})
    assert _request_valid({"mode": "dual", "collection_a": "demo-alpha", "collection_b": "demo-beta"})
    assert not _request_valid({"mode": "single", "collection_a": "demo-alpha", "collection_b": "demo-beta"})
    assert not _request_valid({"mode": "dual", "collection_a": "demo-alpha", "collection_b": None})
    assert not _request_valid({"mode": "dual", "collection_a": "demo-alpha", "collection_b": "demo-alpha"})
    assert not _request_valid({"mode": "single", "collection_a": "demo-alpha", "collection_b": None, "extra": 1})


def test_result_and_economics_invariants():
    data = json.loads((ROOT / "examples/job-completed.json").read_text(encoding="utf-8-sig"))
    structures = data["result"]["structures"]
    assert all(_structure_valid(s) for s in structures)
    assert any(s["economics"]["expected_profit_cny"] > 0 for s in structures)
    assert any((s["economics"]["roi"] is not None and s["economics"]["roi"] < 0) for s in structures)
    assert any(all(v is None for v in s["economics"].values()) for s in structures)
    for structure in structures:
        values = list(structure["economics"].values())
        assert all(isinstance(v, (int, float)) for v in values) or all(v is None for v in values)


@pytest.mark.parametrize("invalid", [
    {"mode": "dual", "collection_a": "a", "collection_b": "a"},
    {"mode": "single", "collection_a": "a", "collection_b": "b"},
    {"mode": "dual", "collection_a": "a", "collection_b": None},
    {"mode": "single", "collection_a": "a", "collection_b": None, "extra": True},
])
def test_invalid_request_semantics_rejected(invalid):
    assert not _request_valid(invalid)


def test_invalid_structure_semantics_rejected():
    data = json.loads((ROOT / "examples/job-completed.json").read_text(encoding="utf-8-sig"))
    structure = data["result"]["structures"][0]
    bad_sum = json.loads(json.dumps(structure)); bad_sum["required_collection_counts"][0]["count"] = 9
    bad_basket = json.loads(json.dumps(structure)); bad_basket["basket"][0]["collection_id"] = "outside"
    bad_nonoptimal = json.loads(json.dumps(data["result"]["structures"][1])); bad_nonoptimal["basket"] = []
    assert not _structure_valid(bad_sum)
    assert not _structure_valid(bad_basket)
    assert not _structure_valid(bad_nonoptimal)


def test_invalid_economics_and_completed_lifecycle_rejected():
    data = json.loads((ROOT / "examples/job-completed.json").read_text(encoding="utf-8-sig"))
    economics = data["result"]["structures"][0]["economics"]
    economics["roi"] = None
    assert not (all(v is None for v in economics.values()) or all(isinstance(v, (int, float)) for v in economics.values()))
    completed = json.loads(json.dumps(data)); completed["result"] = None
    assert not (completed["status"] == "COMPLETED" and completed["result"])


@pytest.mark.parametrize("name,status", [("job-running", "RUNNING"), ("job-completed", "COMPLETED"), ("job-failed", "FAILED")])
def test_job_lifecycle_examples(name, status):
    data = json.loads((ROOT / "examples" / f"{name}.json").read_text(encoding="utf-8-sig"))
    assert data["status"] == status
    if status == "RUNNING":
        assert data["started_at"] and data["completed_at"] is None and data["result"] is None and data["error"] is None and data["queue_position"] is None
    elif status == "COMPLETED":
        assert data["started_at"] and data["completed_at"] and data["result"] and data["error"] is None and data["queue_position"] is None
    else:
        assert data["completed_at"] and data["result"] is None and data["error"]["code"] in {"SOLVE_FAILED", "SOLVE_TIMEOUT"} and data["queue_position"] is None
