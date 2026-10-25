// audio.json cross-checks that JSON Schema cannot express (GDD §15.3 rules 13 and 15, audio side; AC-18.1).
// Pure: the caller passes the CREDITS.md text and a file-exists function. The gameplay-programmer's
// `npm run validate-data` may import this. Owner: audio-designer.

/** Rows of the first markdown table in CREDITS.md as { file, license } (backticks stripped). */
export function parseCreditsRows(md) {
  const rows = [];
  let header = null;
  for (const line of String(md || '').split('\n')) {
    const s = line.trim();
    if (!s.startsWith('|')) {
      if (header && rows.length) break;
      continue;
    }
    const cells = s.replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim().replace(/^`|`$/g, ''));
    if (!header) {
      header = cells.map((c) => c.toLowerCase());
      continue;
    }
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
    const fi = header.indexOf('file');
    const li = header.indexOf('license');
    rows.push({ file: cells[fi], license: cells[li] });
  }
  return rows;
}

/**
 * @param {object} audio parsed audio.json
 * @param {object} ctx { credits: CREDITS.md text, fileExists(path) → bool, hooks: exported SFX_HOOKS (optional),
 *   cards, stages, story (optional, for rule 15 warnings) }
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkAudioData(audio, ctx) {
  const c = ctx || {};
  const errors = [];
  const warnings = [];
  const sounds = (audio && audio.sounds) || {};
  const rows = parseCreditsRows(c.credits);
  const fileExists = c.fileExists || (() => false);

  // rule 13: licensing
  let anyProcedural = false;
  for (const [key, s] of Object.entries(sounds)) {
    if (s.source === 'procedural') anyProcedural = true;
    if (s.source === 'file') {
      if (s.license !== 'CC0' && s.license !== 'self-made') errors.push(`rule 13: sounds.${key}: license "${s.license}" not allowed (CC0 or self-made only)`);
      if (!s.path || !/^assets\/audio\//.test(s.path)) errors.push(`rule 13: sounds.${key}: path "${s.path}" not under assets/audio/`);
      else if (!fileExists(s.path)) errors.push(`rule 13: sounds.${key}: file "${s.path}" does not exist`);
      const row = rows.find((r) => r.file === s.path);
      if (!row) errors.push(`rule 13: sounds.${key}: no CREDITS.md row for "${s.path}"`);
      else if (row.license !== s.license) errors.push(`rule 13: sounds.${key}: CREDITS.md license "${row.license}" != "${s.license}"`);
    }
    // rule 13: pattern notes length
    if (s.pattern) {
      (s.pattern.tracks || []).forEach((t, i) => {
        const n = (t.notes || []).length;
        if (n !== s.pattern.steps) errors.push(`rule 13: sounds.${key}.pattern.tracks[${i}]: ${n} notes, steps is ${s.pattern.steps}`);
      });
    }
    if (s.source === 'procedural' && !s.synth && !s.pattern) errors.push(`sounds.${key}: procedural without synth or pattern`);
  }
  if (anyProcedural && !rows.some((r) => r.file === 'data/audio.json' && r.license === 'self-made')) {
    errors.push('rule 13: procedural sounds but no CREDITS.md row with File "data/audio.json" and License "self-made"');
  }

  // rule 13: music / hooks references
  for (const [k, v] of Object.entries((audio && audio.music) || {})) {
    if (!sounds[v]) errors.push(`rule 13: music.${k}: "${v}" not in sounds`);
    else if (!sounds[v].pattern && sounds[v].source === 'procedural') errors.push(`music.${k}: "${v}" has no pattern`);
  }
  const hooks = (audio && audio.hooks) || {};
  for (const [k, v] of Object.entries(hooks)) {
    if (v !== null && !sounds[v]) errors.push(`rule 13: hooks.${k}: "${v}" not in sounds`);
  }

  // AC-18.1: every exported hook is mapped (error); rule 15: unknown hook keys (warning)
  if (Array.isArray(c.hooks)) {
    for (const h of c.hooks) if (!(h in hooks)) errors.push(`AC-18.1: hook "${h}" has no entry in audio.json hooks`);
    for (const k of Object.keys(hooks)) if (!c.hooks.includes(k)) warnings.push(`rule 15: hooks.${k} is not an exported SFX hook`);
  }

  // rule 15: bgm / card sfx keys that fall back (warnings)
  for (const st of (c.stages && c.stages.stages) || []) {
    if (st.bgm && !sounds[st.bgm]) warnings.push(`rule 15: stage ${st.id} bgm "${st.bgm}" not in sounds`);
  }
  for (const sc of (c.story && c.story.scenes) || []) {
    if (sc.bgm && !sounds[sc.bgm]) warnings.push(`rule 15: story ${sc.id} bgm "${sc.bgm}" not in sounds`);
  }
  for (const cd of (c.cards && c.cards.cards) || []) {
    if (cd.sfx && !sounds[cd.sfx]) warnings.push(`rule 15: card ${cd.id} sfx "${cd.sfx}" not in sounds`);
  }
  return { errors, warnings };
}
