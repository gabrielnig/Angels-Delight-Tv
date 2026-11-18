import type { ClientConfig } from './client-config';

export interface EnvChange {
  name: string;
  from: string | null;
  to: string;
}

/**
 * Sets values in the text of an env file. Comments, blank lines and order are kept. A commented example line
 * (`# NAME=`) is replaced in place, a name that is missing is appended. Running it twice changes nothing.
 */
export function updateEnvText(
  text: string,
  values: Record<string, string>,
): { text: string; changes: EnvChange[] } {
  for (const [name, value] of Object.entries(values)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name)) throw new Error(`Bad variable name: ${name}`);
    if (/[\r\n]/.test(value)) throw new Error(`The value for ${name} must be one line`);
  }
  const lines = text.split('\n');
  const trailingNewline = lines.at(-1) === '';
  if (trailingNewline) lines.pop();
  const changes: EnvChange[] = [];
  for (const [name, value] of Object.entries(values)) {
    const active = new RegExp(`^${name}=(.*)$`);
    const commented = new RegExp(`^#\\s*${name}=(.*)$`);
    let index = lines.findIndex((line) => active.test(line));
    if (index === -1) index = lines.findIndex((line) => commented.test(line));
    if (index === -1) {
      lines.push(`${name}=${value}`);
      changes.push({ name, from: null, to: value });
      continue;
    }
    const current = active.exec(lines[index]!)?.[1] ?? null;
    const isActive = active.test(lines[index]!);
    if (isActive && current === value) continue;
    lines[index] = `${name}=${value}`;
    changes.push({ name, from: isActive ? current : null, to: value });
  }
  return { text: lines.join('\n') + (trailingNewline || text === '' ? '\n' : ''), changes };
}

/** The env values that follow from the client's domain and contact details. Nothing secret. */
export function envValuesFor(config: ClientConfig): Record<string, string> {
  const mediaDomain = config.mediaDomain ?? `media.${config.domain}`;
  return {
    APP_DOMAIN: config.domain,
    MEDIA_DOMAIN: mediaDomain,
    APP_ORIGIN: `https://${config.domain}`,
    MEDIA_ORIGIN: `https://${mediaDomain}`,
    SUPPORT_EMAIL: config.supportEmail,
    EMAIL_FROM: `${config.platformName.replace(/[<>"\r\n]/g, '')} <no-reply@${config.domain}>`,
  };
}
