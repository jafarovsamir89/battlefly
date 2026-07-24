# Platform Architecture

## Web

- Vite build in `apps/web-client`
- Phaser 3 renderer
- local input adapters for mouse, touch, gamepad, and TV remote

## Server

- Node.js authoritative loop in `apps/game-server`
- fixed timestep simulation
- command validation and checksum logging

## Future shells

- Android: Capacitor shell
- Desktop: Tauri shell
- webOS: webOS web app shell

