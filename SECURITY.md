# Security Policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for vulnerabilities that could expose credentials, private infrastructure, user data, or remote execution paths.

Until a dedicated security contact is published, use the repository owner's GitHub contact channel and clearly mark the report as a security issue.

Please include:

- affected component
- reproduction steps
- expected impact
- whether credentials, arbitrary code execution, data access, or denial of service may be involved

## Security boundary

The public project is intentionally separated from the private production solver and trading system.

The public service must not expose:

- C5 or other marketplace credentials
- production database write access
- purchasing authority
- publication authority
- arbitrary file execution
- arbitrary user-supplied code
- private solver implementation details

External request data must be treated as untrusted input and validated against a narrow typed schema before entering the solver path.

## Initial service policy

The first hosted version is expected to accept only a small structured request describing two Collections. File upload, arbitrary scripts, arbitrary SQL, pickle payloads, or executable configuration formats are out of scope.

Resource limits, request queuing, and solver time limits are part of the service security model because expensive solve requests can otherwise become a denial-of-service vector.
