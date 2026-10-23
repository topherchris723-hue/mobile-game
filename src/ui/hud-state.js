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

/** hit_discarded.reason → small feedback text (GDD §5.10 round 3: never a damage number or "DODGE"). */
export const HIT_DISCARD_TEXT_KEYS = { rush_invulnerable: 'battle_hit_immune' };

/** tri_burst_whiff.reason → callout text. */
export const TRI_BURST_WHIFF_TEXT_KEYS = { invulnerable: 'battle_tri_burst_whiff_invulnerable', safety_net: 'battle_tri_burst_whiff' };

/** Key for a reason from one of the maps above; unknown reasons fall back to `fallback` (never a raw [key]). */
export function reasonTextKey(map, reason, fallback) {
  return Object.prototype.hasOwnProperty.call(map, reason) ? map[reason] : fallback;
}
