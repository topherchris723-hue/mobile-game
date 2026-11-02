// Headless AudioContext mock for tests/audio (audio-designer). AudioParams keep their automation list and
// compute the value at any time (set / linear / exponential ramps, cancel), so gain ramps can be measured.

export class MockParam {
  constructor(ctx, value) {
    this.ctx = ctx;
    this.events = [{ type: 'set', v: value, t: 0 }];
  }
  get value() {
    return this.valueAt(this.ctx.currentTime);
  }
  set value(v) {
    this.setValueAtTime(v, this.ctx.currentTime);
  }
  insert(e) {
    this.events.push(e);
    this.events.sort((a, b) => a.t - b.t);
    return this;
  }
  setValueAtTime(v, t) { return this.insert({ type: 'set', v, t }); }
  linearRampToValueAtTime(v, t) { return this.insert({ type: 'lin', v, t }); }
  exponentialRampToValueAtTime(v, t) {
    if (!(v > 0)) throw new RangeError('exponential ramp target must be > 0');
    return this.insert({ type: 'exp', v, t });
  }
  setTargetAtTime(v, t) { return this.insert({ type: 'set', v, t }); }
  cancelScheduledValues(t) {
    this.events = this.events.filter((e) => e.t < t);
    if (!this.events.length) this.events.push({ type: 'set', v: 0, t: 0 });
    return this;
  }
  valueAt(t) {
    let v = this.events[0].v;
    let pt = this.events[0].t;
    for (const e of this.events) {
      if (e.t <= t) {
        v = e.v;
        pt = e.t;
        continue;
      }
      if (e.type === 'lin') return v + (e.v - v) * ((t - pt) / (e.t - pt));
      if (e.type === 'exp') return v > 0 ? v * Math.pow(e.v / v, (t - pt) / (e.t - pt)) : v;
      break;
    }
    return v;
  }
}

class MockNode {
  constructor(ctx) {
    this.ctx = ctx;
    this.outputs = [];
  }
  connect(n) {
    this.outputs.push(n);
    return n;
  }
  disconnect() {
    this.outputs = [];
  }
}

class MockSource extends MockNode {
  constructor(ctx, kind) {
    super(ctx);
    this.kind = kind;
    this.startAt = null;
    this.stopAt = null;
  }
  start(t) {
    this.startAt = t || 0;
    this.ctx.sourcesStarted += 1;
    this.ctx.sources.push(this);
  }
  stop(t) {
    this.stopAt = t || 0;
  }
}

export class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.sampleRate = 8000;
    this.state = 'suspended';
    this.sourcesStarted = 0;
    this.sources = [];
    this.gains = [];
    this.destination = new MockNode(this);
    MockAudioContext.instances.push(this);
  }
  resume() {
    if (this.state !== 'closed') this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    if (this.state !== 'closed') this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
  createGain() {
    const n = new MockNode(this);
    n.gain = new MockParam(this, 1);
    this.gains.push(n);
    return n;
  }
  createOscillator() {
    const n = new MockSource(this, 'osc');
    n.type = 'sine';
    n.frequency = new MockParam(this, 440);
    n.detune = new MockParam(this, 0);
    return n;
  }
  createBufferSource() {
    const n = new MockSource(this, 'buffer');
    n.buffer = null;
    n.loop = false;
    return n;
  }
  createBiquadFilter() {
    const n = new MockNode(this);
    n.type = 'lowpass';
    n.frequency = new MockParam(this, 350);
    n.Q = new MockParam(this, 1);
    return n;
  }
  createBuffer(ch, len, sr) {
    const data = new Float32Array(len);
    return {
      numberOfChannels: ch, length: len, sampleRate: sr || this.sampleRate, duration: len / (sr || this.sampleRate),
      getChannelData: () => data,
      copyToChannel: (src) => data.set(src.subarray(0, len)),
    };
  }
  createDynamicsCompressor() {
    const n = new MockNode(this);
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new MockParam(this, 0);
    return n;
  }
  /** Test helper: advance the clock. */
  advance(s) {
    this.currentTime += s;
  }
}
MockAudioContext.instances = [];

/** OfflineAudioContext mock: startRendering resolves to a buffer whose samples encode the frame index (for slicing
 *  checks). Every instance is recorded in MockOfflineContext.instances. */
export class MockOfflineContext extends MockAudioContext {
  constructor(ch, frames, sr) {
    super();
    MockAudioContext.instances.pop();
    this.frames = frames;
    this.sampleRate = sr;
    MockOfflineContext.instances.push(this);
  }
  startRendering() {
    const b = this.createBuffer(1, this.frames, this.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = i;
    return Promise.resolve(b);
  }
}
MockOfflineContext.instances = [];

/** Engine options with pre-rendering: offline factory + a manual idle queue (flushIdle runs it to the end). */
export function prerenderOpts() {
  const o = testOpts();
  o.offline = [];
  o.idleQueue = [];
  o.createOffline = (ch, frames, sr) => {
    const c = new MockOfflineContext(ch, frames, sr);
    o.offline.push(c);
    return c;
  };
  o.idle = (fn) => o.idleQueue.push(fn);
  o.flushIdle = async () => {
    let jobs = 0;
    for (let guard = 0; guard < 1000; guard++) {
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      const fn = o.idleQueue.shift();
      if (!fn) break;
      jobs += 1;
      fn();
    }
    await new Promise((r) => setTimeout(r, 0));
    return jobs;
  };
  return o;
}

/** Engine options for tests: mock context factory, manual timers, silent warnings collected in `warnings`. */
export function testOpts() {
  const warnings = [];
  const o = {
    listen: false,
    createOffline: null, // live synthesis only; prerenderOpts() turns pre-rendering on
    created: [],
    warnings,
    createContext: () => {
      const c = new MockAudioContext();
      o.created.push(c);
      return c;
    },
    setInterval: () => 1,
    clearInterval: () => {},
    warn: (m) => warnings.push(m),
  };
  return o;
}

/** A minimal fake EventTarget / document for listener tests. */
export function fakeTarget() {
  const map = new Map();
  return {
    hidden: false,
    addEventListener(t, fn) {
      if (!map.has(t)) map.set(t, []);
      map.get(t).push(fn);
    },
    removeEventListener(t, fn) {
      map.set(t, (map.get(t) || []).filter((f) => f !== fn));
    },
    dispatch(t) {
      for (const fn of map.get(t) || []) fn({ type: t });
    },
    count(t) {
      return (map.get(t) || []).length;
    },
  };
}
