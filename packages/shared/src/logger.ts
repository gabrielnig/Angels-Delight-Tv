export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const SECRET_FIELD =
  /pass(word)?|secret|token|authorization|cookie|api_?key|private_?key|kek|pepper|e_?mail/i;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const maskEmails = (text: string) => text.replace(EMAIL, '[email]');

export interface Logger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  bindings?: Record<string, unknown>;
  write?: (line: string) => void;
  now?: () => Date;
}

function scrub(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return maskEmails(value);
  if (value instanceof Error) {
    return {
      name: value.name,
      message: maskEmails(value.message),
      stack: value.stack ? maskEmails(value.stack) : undefined,
    };
  }
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => scrub(item, seen));
  return Object.fromEntries(
    Object.entries(value).map(([key, inner]) => [
      key,
      SECRET_FIELD.test(key) ? '[redacted]' : scrub(inner, seen),
    ]),
  );
}

/** Structured JSON lines on stdout. Apps log through this instead of console. */
export function createLogger(options: LoggerOptions = {}): Logger {
  const threshold = LEVEL_ORDER[options.level ?? 'info'];
  const write = options.write ?? ((line: string) => void process.stdout.write(`${line}\n`));
  const now = options.now ?? (() => new Date());
  const bindings = options.bindings ?? {};

  const emit = (level: LogLevel, message: string, fields: Record<string, unknown> = {}) => {
    if (LEVEL_ORDER[level] < threshold) return;
    const entry = scrub(
      { time: now().toISOString(), level, msg: message, ...bindings, ...fields },
      new WeakSet(),
    );
    write(JSON.stringify(entry));
  };

  return {
    debug: (message, fields) => emit('debug', message, fields),
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields),
    child: (extra) => createLogger({ ...options, bindings: { ...bindings, ...extra } }),
  };
}
