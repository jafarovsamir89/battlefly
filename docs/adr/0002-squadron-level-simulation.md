# ADR 0002: Squadron-Level Simulation

## Context

The vision requires scale without tracking every ship as an independent high-cost simulation object.

## Decision

Model strategic gameplay around grouped entities and shared network state, not individual ship physics.

## Consequences

- combat can remain readable and performant
- later squadron rendering can scale without changing core rules
- Milestone 0 can focus on map, economy, and network foundations

## Rejected alternatives

- fully individual ship simulation
- arcade physics as primary game model

