// Mirrors the debug hook declared in src/main.ts for use inside page.evaluate().
export {};
declare global {
  interface Window {
    __sovereigns?: {
      readonly playerLane: () => number;
      readonly playerGuarding: () => boolean;
      readonly tick: () => number;
    };
  }
}
