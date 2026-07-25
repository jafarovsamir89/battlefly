# ADR 0005: Sector-Based Squadron Movement

## Context

Milestone 1 introduces squadron production and strategic movement without turning the simulation into per-ship physics.

## Decision

Model each squadron as a deterministic strategic entity that travels along a sector route with integer edge progress and explicit energy spending.

Route selection uses deterministic BFS over sector adjacency, and movement state is fully serializable for snapshots and authoritative server replay.

## Consequences

- movement remains readable on all target platforms
- snapshots can resume in-flight squadrons without desync
- future multiplayer servers can validate the same movement rules
- UI can preview routes without needing simulation-side rendering

## Rejected alternatives

- freeform pathfinding with analog positions
- per-ship movement simulation
- client-authoritative travel state
