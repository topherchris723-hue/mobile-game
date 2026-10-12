// Mirrors the debug hook declared in src/main.ts for use inside page.evaluate().
export {};
declare global {
  interface Window {
    __sovereigns?: {
      readonly selectedUnit: () => number | null;
      readonly unitScreenPoint: (unitId: number) => { x: number; y: number } | null;
      readonly unitIds: () => readonly number[];
      readonly tick: () => number;
    };
  }
}
