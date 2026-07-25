# ADR 0003: Cross-Platform Input

## Context

Web, mobile, desktop, and TV remote support should share the same gameplay intent model.

## Decision

Translate mouse, touch, and gamepad interactions into platform-neutral intents before they reach the simulation.

## Consequences

- UI can change per platform without changing rules
- gamepad and remote navigation remain possible
- client code needs an interaction layer separate from simulation commands

## Rejected alternatives

- direct DOM event handling inside the simulation
- platform-specific rule branches

