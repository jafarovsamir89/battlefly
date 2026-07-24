export const isGamepadConnected = (): boolean =>
  typeof navigator !== 'undefined' && navigator.getGamepads().some((gamepad) => gamepad?.connected);

