/** Fixed simulation rate. Game rules always advance in steps of exactly this size. */
export const TICK_RATE_HZ = 60;
export const TICK_MS = 1000 / TICK_RATE_HZ;

/** A frame longer than this (tab switch, GC pause) is clamped so the simulation never tries to catch up for seconds. */
export const MAX_FRAME_DELTA_MS = 250;
