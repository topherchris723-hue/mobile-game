// Mirrors the debug hook declared in src/main.ts for use inside page.evaluate().
export {};
type Side = 'player' | 'enemy';
declare global {
  interface Window {
    __sovereigns?: {
      readonly screen: () => 'home' | 'story' | 'sovereigns' | 'battle';
      readonly phase: () => 'animating' | 'playerInput' | 'enemyThinking' | 'ended' | null;
      readonly turnSide: () => Side | null;
      readonly turnNumber: () => number;
      readonly winner: () => Side | null;
      readonly activeIndex: (side: Side) => number;
      readonly hp: (side: Side) => number;
      readonly energy: (side: Side) => number;
      readonly tick: () => number;
    };
  }
}
