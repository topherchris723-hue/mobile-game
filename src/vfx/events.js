// Logic event -> VFX event key mapping (GDD §17.2). Pure: no Phaser, no logic calls.
// The VFX layer only READS events and state snapshots (GDD §17.1 rule 1).

/**
 * Every event key the VFX layer can play (GDD §17.2, L-shared-009). `data/vfx.json` → `events` must map each one
 * (an empty list = "nothing new"); AC-17.1 checks this. Literal list: scripts/validate-data.js parses it from source.
 */
export const VFX_EVENT_KEYS = [
  'hit.fist', 'hit.bolt', 'hit.signature', 'hit.climax', 'hit.crit',
  'combo.2', 'combo.3', 'combo.4', 'combo.5',
  'knockdown', 'slip', 'perfect_slip', 'riposte', 'tag', 'fighter_enter', 'tag_strike', 'ko',
  'ignition', 'ignition_active', 'tri_burst_start', 'tri_burst', 'tri_burst_hit', 'climax_cinematic',
  'hit_discarded', 'whiff.rush_invulnerable', 'dodge', 'fight_start',
  'summon_orb.3', 'summon_orb.4', 'summon_orb.5',
  'summon_reveal.3', 'summon_reveal.4', 'summon_reveal.5',
];

/** Event keys whose effects are cinematic-bound: they end at the logic's `freeze_end` of this kind (§17.1 rule 1). */
export const CINEMATIC_KEYS = { ignition: 'ignition', tri_burst: 'tri_burst', climax_cinematic: 'climax', ko: 'ko' };

/** Effect ids ending in this suffix are the replaceable default (card art.vfx / ignition.art.vfx override, §17.2). */
export const DEFAULT_SUFFIX = '_default';

/** Summon stages accepted by onSummon(). */
export const SUMMON_STAGES = ['orb', 'reveal'];

export const opposite = (side) => (side === 'player' ? 'enemy' : 'player');

/**
 * VFX keys for one logic event, with the sides that anchor it.
 * Returns [] for events with no visual. `actor` = whose aura colours the effect ("aura"), `target` = where a hit lands.
 */
export function keysForEvent(e) {
  if (!e || typeof e.type !== 'string') return [];
  const out = [];
  const add = (key, actor, target) => out.push({ key, actor, target });
  switch (e.type) {
    case 'hit': {
      const tgt = opposite(e.side);
      add('hit.' + e.cardType, e.side, tgt);
      if (e.hitIndex === 0 && e.crit) add('hit.crit', e.side, tgt);
      if (e.hitIndex === 0 && e.chainIndex >= 2 && e.chainIndex <= 5) add('combo.' + e.chainIndex, e.side, tgt);
      break;
    }
    case 'knockdown': // e.side = the fighter knocked down
    case 'ko': // e.side = the fighter KO'd
      add(e.type, opposite(e.side), e.side);
      break;
    case 'whiff':
      if (e.reason === 'rush_invulnerable') add('whiff.rush_invulnerable', e.side, opposite(e.side));
      break;
    case 'slip':
    case 'perfect_slip':
    case 'riposte':
    case 'tag':
    case 'fighter_enter':
    case 'tag_strike':
    case 'ignition':
    case 'tri_burst_start':
    case 'tri_burst':
    case 'tri_burst_hit':
    case 'climax_cinematic':
    case 'hit_discarded':
      add(e.type, e.side, opposite(e.side));
      break;
    case 'dodge':
      add('dodge', e.side, opposite(e.side));
      break;
    case 'fight_start':
      add('fight_start', 'player', 'enemy');
      break;
    default:
      break;
  }
  return out;
}
