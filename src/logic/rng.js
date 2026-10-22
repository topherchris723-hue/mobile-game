// Seeded random number generator (mulberry32). GDD §5.0: crits, AI rolls and shuffles all use it.
// Port note: uses 32-bit integer math only; C# can use uint with unchecked arithmetic.

export class SeededRng {
  /** Create a generator from a 32-bit integer seed. */
  constructor(seed) {
    this.state = seed >>> 0;
  }

  /** Next float in [0, 1). */
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [0, n). */
  nextInt(n) {
    return Math.floor(this.next() * n);
  }

  /** Shuffle an array in place (Fisher–Yates). Returns the same array. */
  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const tmp = list[i];
      list[i] = list[j];
      list[j] = tmp;
    }
    return list;
  }

  /** Derive an independent child generator (used to give each AI its own stream). */
  fork() {
    return new SeededRng(Math.floor(this.next() * 4294967296));
  }
}
