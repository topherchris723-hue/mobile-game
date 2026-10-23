// Pure HUD state helpers (no Phaser) so the button states are unit-tested.

/** TRI-BURST button states: each one looks different (fill, ring, label, icon), never colour alone. */
export const BURST_VISUALS = ['charging', 'ready', 'locked', 'used'];

/**
 * team = player Team snapshot. 'used' after the Tri-Burst; 'ready' when a tap would fire it (burstReady);
 * 'locked' when the gauge is full but a tap is refused right now (GDD §5.0 Tri-Burst lock, a cinematic, or the
 * fighter's state); otherwise 'charging'.
 */
export function burstVisual(team) {
  if (team.burstUsed) return 'used';
  if (team.burstReady) return 'ready';
  if (team.burst >= team.burstMax) return 'locked';
  return 'charging';
}

/** strings.json key of the TRI-BURST label for each visual state. */
export const BURST_LABEL_KEYS = { charging: 'battle_tri_burst_button', ready: 'battle_tri_burst_button', locked: 'battle_tri_burst_locked', used: 'battle_tri_burst_used' };
