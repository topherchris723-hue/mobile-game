export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  readonly time: number;
  readonly level: LogLevel;
  readonly message: string;
}

export interface Logger {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string, cause?: unknown): void;
  /** Most recent entries, oldest first. */
  entries(): readonly LogEntry[];
  subscribe(listener: (entry: LogEntry) => void): () => void;
}

/** Describes any thrown value, including its stack when there is one. */
export function describeError(cause: unknown): string {
  if (cause instanceof Error) return cause.stack ?? `${cause.name}: ${cause.message}`;
  if (typeof cause === 'string') return cause;
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}

/** The single logging path for the game (CLAUDE.md §8): a ring buffer the debug overlay can show. */
export function createLogger(capacity = 200): Logger {
  const buffer: LogEntry[] = [];
  const listeners = new Set<(entry: LogEntry) => void>();

  const write = (level: LogLevel, message: string): void => {
    const entry: LogEntry = { time: performance.now(), level, message };
    buffer.push(entry);
    if (buffer.length > capacity) buffer.shift();
    for (const listener of listeners) listener(entry);
    // Warnings and errors also reach the browser console so automated tests can detect them.
    // eslint-disable-next-line no-console -- the logger is the one sanctioned console writer
    if (level === 'error') console.error(message);
    // eslint-disable-next-line no-console -- see above
    else if (level === 'warn') console.warn(message);
  };

  return {
    debug: (message) => {
      write('debug', message);
    },
    info: (message) => {
      write('info', message);
    },
    warn: (message) => {
      write('warn', message);
    },
    error: (message, cause) => {
      write('error', cause === undefined ? message : `${message}\n${describeError(cause)}`);
    },
    entries: () => buffer,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
