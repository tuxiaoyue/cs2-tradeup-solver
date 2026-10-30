# Security Policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for vulnerabilities that could expose credentials, private infrastructure, user data, or remote execution paths.

Until a dedicated security contact is published, use the repository owner's GitHub contact channel and clearly mark the report as a security issue.

Please include:

- affected component
- reproduction steps
- expected impact
- whether credentials, arbitrary code execution, data access, or denial of service may be involved

Do not include real marketplace credentials, API keys, session tokens, or private database contents in a vulnerability report unless a private reporting channel has explicitly been established.

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
- internal host paths, process details, stack traces, or network topology in public errors

External request data is untrusted input and must be validated against the narrow typed API contract before entering the private worker path.

## Accepted v1 input

The first hosted version accepts only server-known Collection identifiers in one of two modes:

- one Collection; or
- two distinct Collections.

The public request path does **not** accept:

- file uploads
- user-supplied URLs
- marketplace API keys or credentials
- arbitrary scripts
- arbitrary SQL or SQL-like filter expressions
- pickle or executable serialization formats
- filesystem paths
- module names or dynamic imports
- shell commands
- user-selected Family or Structure identifiers

Collection display names are presentation data. Server-controlled Collection IDs are the request authority.

## Browser security

The browser client must never contain or request marketplace credentials. `VITE_API_BASE_URL` is only the public API origin; it is not a secret.

Never commit `.env` files, private keys, marketplace credentials, production snapshots, or database files to this repository.

## Service security model

Expensive optimization requests can become a denial-of-service vector even when request parsing is safe. The hosted service therefore requires controls outside this public client, including:

- HTTPS at the public edge
- strict schema and request-size validation
- rate limiting before expensive work
- bounded queue depth
- configurable active solve concurrency (initially `1`)
- hard worker / job time limits
- a Daily / maintenance gate that prevents public work from competing with higher-priority private workloads
- an isolated worker that is not directly internet-facing
- no purchase or publication authority in the public gateway
- read-only / minimum-authority access to market data wherever practical

The preferred deployment model uses a managed edge or outbound tunnel rather than direct router port forwarding to a private Windows host.

## Public errors and logs

Public responses should use coarse, documented error categories. Internal exception text, credentials, local paths, SQL details, process command lines, and private network information must remain server-side.

Operational logs may record opaque job IDs, Collection IDs, timestamps, versions, status, timing, and coarse failure categories. Secrets must not be logged.
