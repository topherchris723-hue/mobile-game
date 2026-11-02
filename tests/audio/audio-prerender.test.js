// audio-designer (round 7, release review R-2 perf): pre-rendered SFX and music notes.
// A hit must cost one source node in the hit frame (not a 6–10 node graph), rendering must happen only in idle
// callbacks (never inside sfx()), the gesture rule must still hold, and only playing tracks keep note buffers.
// Each check also runs on a deliberately broken engine and must FAIL (L-shared-006).
import { describe, it, expect } from 'vitest';
import { readJson } from '../helpers/load-data.js';
import { AudioEngine } from '../../src/audio/engine.js';
import { prerenderOpts, MockOfflineContext } from './mock-audio.js';

const AUDIO = readJson('data/audio.json');
const FULL = { master_volume: 1, bgm_volume: 1, sfx_volume: 1, muted: false };
const synthKeys = Object.keys(AUDIO.sounds).filter((k) => AUDIO.sounds[k].synth);

async function warmed(Engine) {
  const o = prerenderOpts();
  const e = new (Engine || AudioEngine)(AUDIO, FULL, o);
  e.setMusicContext('battle', 'bgm_battle_01');
  e.onGesture();
  const ctx = o.created[0];
  const jobs = await o.flushIdle();
  return { e, o, ctx, jobs };
}

/** Cost of one hit in the hit frame, after pre-rendering. */
async function checkHitCost(Engine) {
  const f = [];
  const { e, o, ctx } = await warmed(Engine);
  if (e.buffers.size !== synthKeys.length) f.push('not every sound pre-rendered: ' + e.buffers.size + '/' + synthKeys.length);
  for (let i = 0; i < 3; i++) { ctx.advance(1); e.sfx('hit_fist'); } // warm the gain pool
  ctx.advance(1);
  const src0 = ctx.sourcesStarted;
  const gains0 = ctx.gains.length;
  const off0 = o.offline.length;
  const r = e.sfx('hit_climax');
  if (!r.played) f.push('hit did not play');
  if (ctx.sourcesStarted - src0 !== 1) f.push('hit started ' + (ctx.sourcesStarted - src0) + ' sources (want 1)');
  if (ctx.gains.length - gains0 !== 0) f.push('hit created ' + (ctx.gains.length - gains0) + ' gain nodes (want 0, pooled)');
  if (o.offline.length !== off0) f.push('sfx() rendered in the hit frame');
  return f;
}

class NoPrerenderEngine extends AudioEngine {
  queueSoundRenders() {}
}
class NoPoolEngine extends AudioEngine {
  voiceGain(t, gain) {
    const node = this.ctx.createGain();
    node.gain.value = gain;
    node.connect(this.sfxBus);
    return { node, busyUntil: 0 };
  }
}
/** Broken: renders a missing sound synchronously inside sfx() (work moved INTO the hit frame). */
class SyncRenderEngine extends NoPrerenderEngine {
  playSound(key) {
    if (this.ctx && !this.buffers.has(key) && this.sounds[key] && this.sounds[key].synth) {
      this.renderQueue.unshift({ kind: 'sound', key });
      this.renderNext();
    }
    return super.playSound(key);
  }
}

describe('R-2: a pre-rendered hit costs 1 source node and no new gain node', () => {
  it('real engine passes', async () => {
    expect(await checkHitCost(AudioEngine)).toEqual([]);
  });
  it('negative: no pre-rendering FAILS (the live graph starts 4 sources for hit_climax)', async () => {
    const f = await checkHitCost(NoPrerenderEngine);
    expect(f).toContain('hit started 4 sources (want 1)');
  });
  it('negative: a new gain node per hit FAILS', async () => {
    expect(await checkHitCost(NoPoolEngine)).toContain('hit created 1 gain nodes (want 0, pooled)');
  });
  it('negative: rendering inside sfx() FAILS', async () => {
    expect(await checkHitCost(SyncRenderEngine)).toContain('sfx() rendered in the hit frame');
  });
});

describe('R-2: rendering only in idle callbacks, in small batches, after the gesture', () => {
  it('no offline render before the first gesture; none until an idle callback runs', async () => {
    const o = prerenderOpts();
    const e = new AudioEngine(AUDIO, FULL, o);
    e.setMusicContext('menu');
    e.sfx('ui_press');
    expect([o.offline.length, o.idleQueue.length]).toEqual([0, 0]);
    e.onGesture();
    expect(o.offline.length).toBe(0); // queued, not rendered
    expect(o.idleQueue.length).toBe(1);
    // before the buffers exist the live path plays (never silent)
    const ctx = o.created[0];
    const s0 = ctx.sourcesStarted;
    expect(e.sfx('hit_fist').played).toBe(true);
    expect(ctx.sourcesStarted - s0).toBe(AUDIO.sounds.sfx_hit_fist.synth.voices.length);
    const jobs = await o.flushIdle();
    expect(e.buffers.size).toBe(synthKeys.length);
    expect(jobs).toBe(o.offline.length);
  });
  it('each job builds ≤ 8 voices (or one larger sound alone), hit sounds first', async () => {
    const { o, e } = await warmed();
    // schema: a synth has ≤ 8 voices, so even a single-item job stays ≤ 8
    const perJob = o.offline.map((off) => off.sourcesStarted);
    expect(Math.max(...perJob)).toBeLessThanOrEqual(8);
    const totalVoices = perJob.reduce((a, b) => a + b, 0);
    expect(o.offline.length).toBeGreaterThanOrEqual(Math.ceil(totalVoices / 8));
    const order = [...e.buffers.keys()];
    expect(order.slice(0, 4).every((k) => /^sfx_(hit|card|combo|riposte|tag|knockdown|slip|perfect|swipe|ui_press)/.test(k))).toBe(true);
  });
  it('batched items start on 128-frame boundaries and each slice is that item (frame-index samples)', async () => {
    MockOfflineContext.instances = [];
    const { e, ctx } = await warmed();
    for (const [k, buf] of e.buffers) {
      const d = buf.getChannelData(0);
      expect([k, d[0] % 128]).toEqual([k, 0]);
      expect(d[d.length - 1] - d[0]).toBe(d.length - 1);
      const len = Math.max(...AUDIO.sounds[k].synth.voices.map((v) => (v.start_s || 0) + v.duration_s));
      expect(buf.length).toBe(Math.ceil((len + 0.02) * ctx.sampleRate));
    }
  });
});

describe('R-2: music notes', () => {
  it('after pre-rendering, every battle note is one source node; switching tracks frees the old note buffers', async () => {
    const { e, o, ctx } = await warmed();
    const pat = AUDIO.sounds.bgm_battle_01.pattern;
    const distinct = pat.tracks.reduce((n, tr) => n + new Set(tr.notes.filter((x) => x !== null)).size, 0);
    expect(e.noteBuffers.size).toBe(distinct);
    const p = e.currentPlayer();
    const s0 = ctx.sourcesStarted;
    const g0 = ctx.gains.length;
    let notes = 0;
    for (let step = 0; step < pat.steps; step++) {
      for (const tr of pat.tracks) if (tr.notes[step] !== null) notes++;
      e.scheduleStep(p, step, ctx.currentTime + 1);
    }
    expect([ctx.sourcesStarted - s0, ctx.gains.length - g0]).toEqual([notes, 0]);
    e.setMusicContext('summon');
    await o.flushIdle();
    ctx.advance(2);
    e.pump();
    expect([...e.noteBuffers.keys()].every((k) => k.startsWith('bgm_summon_01|'))).toBe(true);
    expect(e.debug().bufferBytes).toBeGreaterThan(0);
  });
});

describe('R-2: stealing a pre-rendered voice', () => {
  it('a higher-priority 13th sound stops the oldest lowest one with a 5 ms fade on its pooled gain; the node is reused only after', async () => {
    const { e, ctx } = await warmed();
    const res = [];
    for (const k of ['swipe_up', 'swipe_down', 'swipe_left', 'swipe_right']) res.push(e.sfx(k));
    // fill to 12 with priority ≤ 2 sounds, then a priority-3 sound steals a priority-0 swipe
    for (const h of ['hit_fist', 'hit_bolt', 'hit_signature', 'hit_climax', 'card_fist', 'card_bolt', 'slip', 'tag']) res.push(e.sfx(h));
    expect(res.filter((r) => r.played).length).toBe(12);
    const pool = e.gainPool.length;
    const ko = e.sfx('ko');
    expect(ko.played).toBe(true);
    expect(e.gainPool.length).toBe(pool + 1); // the stolen node is still fading, so a new one is made
    const stolen = e.gainPool.find((g) => g.busyUntil <= ctx.currentTime + 0.06 && g.busyUntil > ctx.currentTime);
    expect(stolen).toBeTruthy();
    expect(stolen.node.gain.valueAt(ctx.currentTime + 0.006)).toBeLessThan(0.001);
  });
});
