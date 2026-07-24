# Battlefly — Vector Fleet: Network War

Battlefly is a cross-platform real-time strategy game about commanding fleets, building an energy network, controlling strategic sectors, and destroying the enemy command core.

The project is being designed from day one for:

- Web browsers
- Windows, macOS, and Linux
- Android phones and tablets
- webOS TV

The same deterministic simulation and game rules are shared across platforms. Each platform receives an input and interface profile suited to mouse and keyboard, touch, gamepad, or TV remote.

## Core fantasy

The player does not micromanage hundreds of individual ships. The player commands a limited number of squadrons that may visually contain hundreds of ships.

During a match, the player:

1. Captures resource and energy nodes.
2. Connects nodes into an energy network.
3. Builds mines, reactors, shipyards, sensors, and defenses.
4. Produces and reinforces squadrons.
5. Uses formations and vector maneuvers.
6. Protects their network and raids the enemy network.
7. Disables the enemy command-core shield.
8. Destroys the command core.

## Unique mechanic

The player-drawn energy network is simultaneously:

- the economy;
- the supply system;
- the transport infrastructure;
- the sensor network;
- the visible territorial structure;
- the player's main vulnerability.

Cutting one important relay may disable a remote shipyard, weaken shields, slow reinforcements, and isolate a fleet.

## First vertical slice

The first playable milestone is intentionally limited:

- one symmetric map;
- player versus AI;
- two resources: matter and energy;
- 8–12 strategic sectors;
- four ship roles;
- three formations;
- up to eight controllable squadrons per side;
- approximately 80–150 visual ships per side depending on device profile;
- energy-network construction and disruption;
- fog of war;
- command-core victory condition;
- a complete 12–18 minute match;
- mouse, touch, and gamepad/remote input foundations.

The design source of truth is in [`docs/GAME_VISION.md`](docs/GAME_VISION.md).

The initial coding-agent brief is in [`docs/IMPLEMENTATION_PROMPT.md`](docs/IMPLEMENTATION_PROMPT.md).

## Project principle

> Scale the feeling of war, not the number of objects the player must manually control.

The game may display hundreds of ships, but the player should make strategic decisions through squadrons, sectors, network topology, priorities, and formations.
