# CS2 Trade-Up Solver

A near-real-time CS2 trade-up solver focused on **exact, executable baskets**.

## What this project is

The first public version is intentionally narrow:

1. Select exactly **two CS2 Collections**.
2. Enumerate every legal trade-up Structure that can be formed from that pair.
3. Solve each Structure with the existing exact optimizer.
4. Return **one best exact basket per Structure** using the current hosted market snapshot.

The goal is not to publish a theoretical recipe and leave the user to search for matching floats. The goal is to return the exact input basket found by the solver for each legal Structure.

## What v1 is not

The first version does **not** provide:

- Top-K baskets per Structure
- Budget constraints
- ROI or EV filtering
- Buy / sell recommendations
- Risk scoring
- Automatic purchasing
- Cross-Structure capital allocation
- Three-or-more-Collection requests
- Multi-market optimization

Results are calculations from a market snapshot, not a guarantee of profit or future availability.

## Performance target

A representative internal benchmark using two Collections and real retained listing data produced:

- 607 legal Structures
- 598 optimal solutions
- 9 infeasible Structures
- 0 timeouts
- 0 errors
- 58.143 seconds total wall-clock time

The initial service target is:

- **≤ 120 s:** ideal
- **120–180 s:** acceptable
- **> 180 s:** investigate before treating the request path as interactive

This benchmark is evidence for feasibility, not a latency guarantee for every Collection pair.

## Repository boundary

This repository is the **public interface layer**.

It will contain public documentation, the API contract, client code, and examples. The production solver, market credentials, private trading logic, Daily pipeline, purchasing code, and production databases are **not** part of this repository.

## Status

Early development. The hosted API is not public yet.

The next milestone is to define the smallest stable public contract for:

`(collection_a, collection_b) -> one exact best basket for every legal Structure`

## Security

Please read [SECURITY.md](SECURITY.md) before reporting a vulnerability.
