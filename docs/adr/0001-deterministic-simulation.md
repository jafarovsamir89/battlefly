# ADR 0001: Deterministic Simulation

## Context

Battlefly needs one shared rules engine across browser, server, and future shells.

## Decision

Use a pure, serializable simulation package with fixed timesteps, typed commands, and deterministic checksums.

## Consequences

- replay and authoritative server work become straightforward
- tests can run without Phaser or DOM
- the simulation must avoid ambient randomness and hidden state

## Rejected alternatives

- Phaser-driven simulation
- physics as source of truth
- per-platform rule implementations

