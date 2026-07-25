# ADR 0004: Authoritative Server Direction

## Context

Future multiplayer needs a single trusted simulation path and reproducible command handling.

## Decision

Shape state, commands, and snapshots to work in a future authoritative server model from day one.

## Consequences

- client prediction and replay can be added later
- network envelopes stay simple and typed
- Milestone 0 can remain local while still being server-ready

## Rejected alternatives

- client-authoritative game rules
- ad hoc serialization after the fact

