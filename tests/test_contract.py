import json
from pathlib import Path

import pytest


ROOT = Path(__file__).parents[1]


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
        return isinstance(value["basket"], list) and len(value["basket"]) == 10 and len({x["listing_id"] for x in value["basket"]}) == 10
    return value["status"] in {"INFEASIBLE", "TIMEOUT", "ERROR"} and value["basket"] is None


def test_public_paths_and_external_examples_are_exact():
    text = (ROOT / "openapi.yaml").read_text(encoding="utf-8")
    assert [line.strip() for line in text.splitlines() if line.startswith("  /v1/")] == [
        "/v1/collections:", "/v1/service-status:", "/v1/solve:", "/v1/jobs/{job_id}:",
    ]
    assert "/internal/" not in text
    for name in ("collections", "service-status", "job-running", "job-completed", "error", "job-failed"):
        assert (ROOT / "examples" / f"{name}.json").is_file()


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
