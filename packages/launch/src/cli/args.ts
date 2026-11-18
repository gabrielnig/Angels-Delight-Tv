export interface ArgSpec {
  values: string[];
  booleans: string[];
}

export type ParsedArgs =
  | { ok: true; values: Record<string, string>; flags: Record<string, boolean> }
  | { ok: false; error: string };

/** Small flag parser: `--name value`, `--name=value` and boolean `--flag`. Unknown flags are errors. */
export function parseArgs(argv: string[], spec: ArgSpec): ParsedArgs {
  const values: Record<string, string> = {};
  const flags: Record<string, boolean> = Object.fromEntries(
    spec.booleans.map((name) => [name, false]),
  );
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--') continue;
    if (!arg.startsWith('--')) return { ok: false, error: `Unexpected argument: ${arg}` };
    const [name = '', inline] = arg.slice(2).split(/=(.*)/s);
    if (spec.booleans.includes(name)) {
      flags[name] = true;
      continue;
    }
    if (!spec.values.includes(name)) return { ok: false, error: `Unknown option: --${name}` };
    const value = inline ?? argv[++i];
    if (value === undefined || value.startsWith('--'))
      return { ok: false, error: `--${name} needs a value` };
    values[name] = value;
  }
  return { ok: true, values, flags };
}
