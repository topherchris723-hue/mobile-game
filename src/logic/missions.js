// Stage mission checks (GDD §9.3). Pure: takes a stage record and a battle result.

/** Is one mission met by this battle result? Only a Win can meet missions. */
export function missionMet(mission, result) {
  if (!result || result.outcome !== 'win') return false;
  const s = result.stats;
  switch (mission.type) {
    case 'win': return true;
    case 'no_ko': return s.playerKos === 0;
    case 'time_under_s': return result.timeElapsedS < mission.value;
    case 'use_tri_burst': return s.usedTriBurst === true;
    case 'use_ignition': return s.usedIgnition === true;
    case 'perfect_slips_at_least': return s.perfectSlips >= mission.value;
    case 'max_chain_at_least': return s.maxChain >= mission.value;
    default: return false;
  }
}

/** Ids of the stage's missions met by this result (already-completed ones are included; the caller filters). */
export function missionsMet(stage, result) {
  const out = [];
  for (const m of stage.missions || []) if (missionMet(m, result)) out.push(m.id);
  return out;
}
