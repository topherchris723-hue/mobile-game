// Mirrors the debug hook declared in src/main.ts for use inside page.evaluate().
export {};
type Side = 'player' | 'enemy';
declare global {
  interface Window {
    __sovereigns?: {
      readonly phase: () => 'animating' | 'playerInput' | 'enemyThinking' | 'ended';
      readonly turnSide: () => Side;
      readonly winner: () => Side | null;
      readonly activeIndex: (side: Side) => number;
      readonly hp: (side: Side) => number;
      readonly energy: (side: Side) => number;
      readonly tick: () => number;
    };
  }
}
