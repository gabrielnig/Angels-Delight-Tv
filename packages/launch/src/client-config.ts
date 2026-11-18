import { COLOR_KEYS, FONT_KEYS } from '@ad/ui';
import { DEFAULT_THEME, evaluateTheme, parseTheme, type ThemeValues } from '@ad/theme';
import { z } from 'zod';

/**
 * The file the client's details are collected in (docs/CLIENT-INPUTS.md). Every field maps to one place in the
 * running platform: settings, theme, logo assets, legal pages, PWA icons or the production env file.
 * Unknown keys are rejected so a typo never silently does nothing.
 */

const PLACEHOLDER = /replace[-_]me|change[-_]me|todo[-_]client/i;

const noPlaceholder = (value: string) => !PLACEHOLDER.test(value);
const NO_PLACEHOLDER_MESSAGE = 'Replace this placeholder with the real value';

const hostname = z
  .string()
  .trim()
  .toLowerCase()
  .max(253)
  .regex(
    /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,
    'Enter a domain such as example.org, without https:// or a path',
  )
  .refine(noPlaceholder, NO_PLACEHOLDER_MESSAGE);

const email = z
  .string()
  .trim()
  .max(254)
  .regex(/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/, 'Enter a valid email address')
  .refine(noPlaceholder, NO_PLACEHOLDER_MESSAGE);

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a six digit hex colour such as #1F6FB5');

const language = z
  .string()
  .trim()
  .regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, 'Use a language code such as en or yo');

const imageRef = z.strictObject({
  path: z.string().trim().min(1).max(500).refine(noPlaceholder, NO_PLACEHOLDER_MESSAGE),
  altText: z.string().trim().max(200).optional(),
});

/** A legal or info page is either a file next to the config or inline html, never both. */
const pageRef = z
  .strictObject({
    file: z.string().trim().min(1).max(500).optional(),
    html: z.string().min(1).max(200_000).optional(),
  })
  .refine((page) => (page.file === undefined) !== (page.html === undefined), {
    message: 'Give either file or html, not both and not neither',
  })
  .refine((page) => noPlaceholder(page.file ?? '') && noPlaceholder(page.html ?? ''), {
    message: NO_PLACEHOLDER_MESSAGE,
  });

const themeSchema = z.strictObject({
  colors: z
    .strictObject(Object.fromEntries(COLOR_KEYS.map((key) => [key, hex.optional()])))
    .partial(),
  fontKey: z.enum(FONT_KEYS as [string, ...string[]]).optional(),
  typeScale: z.number().optional(),
  radiusScale: z.number().optional(),
  density: z.enum(['compact', 'comfortable', 'spacious']).optional(),
});

const socialLink = z.strictObject({
  label: z.string().trim().min(1).max(30),
  url: z.url({ protocol: /^https$/ }).max(300),
});

export const clientConfigSchema = z
  .strictObject({
    platformName: z.string().trim().min(1).max(60).refine(noPlaceholder, NO_PLACEHOLDER_MESSAGE),
    tagline: z.string().trim().max(120).optional(),
    domain: hostname,
    /** Defaults to `media.` plus the domain in the env file. */
    mediaDomain: hostname.optional(),
    supportEmail: email,
    /** Must already exist (pnpm db:seed:admin). The applier never creates passwords. */
    adminOwnerEmail: email,
    footerText: z.string().trim().max(200).optional(),
    socialLinks: z.array(socialLink).max(6).optional(),
    theme: themeSchema.optional(),
    logo: imageRef.optional(),
    favicon: imageRef.optional(),
    legal: z
      .strictObject({
        terms: pageRef.optional(),
        privacy: pageRef.optional(),
        about: pageRef.optional(),
        help: pageRef.optional(),
      })
      .optional(),
    languages: z
      .strictObject({ default: language, offered: z.array(language).min(1).max(12) })
      .refine((value) => value.offered.includes(value.default), {
        message: 'The default language must be one of the offered languages',
        path: ['default'],
      })
      .optional(),
  })
  .strict();

export type ClientConfig = z.infer<typeof clientConfigSchema>;

export interface ConfigProblem {
  path: string;
  message: string;
}

export type ParsedClientConfig =
  { ok: true; config: ClientConfig } | { ok: false; errors: ConfigProblem[] };

/** Validates untrusted input. Problems name the field and the rule and never repeat the value. */
export function parseClientConfig(input: unknown): ParsedClientConfig {
  const result = clientConfigSchema.safeParse(input);
  if (result.success) return { ok: true, config: result.data };
  return {
    ok: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message:
        issue.code === 'unrecognized_keys'
          ? `Unknown field${issue.keys.length > 1 ? 's' : ''}: ${issue.keys.join(', ')}`
          : issue.message,
    })),
  };
}

export interface ClientThemeGate {
  blocked: boolean;
  messages: string[];
  warnings: string[];
  theme: ThemeValues;
}

/** Builds the full theme from the client's partial values and runs the same readability gate as the admin editor (D-007). */
export function checkClientTheme(
  input: NonNullable<ClientConfig['theme']> | { colors: Record<string, string> },
): ClientThemeGate {
  const defined = Object.fromEntries(
    Object.entries(input).filter(([key, value]) => key !== 'colors' && value !== undefined),
  );
  const theme = parseTheme({
    ...defined,
    colors: { ...DEFAULT_THEME.colors, ...input.colors },
  });
  const gate = evaluateTheme(theme);
  return {
    blocked: gate.blocked,
    messages: gate.blockers.map((check) => check.message),
    warnings: gate.warnings.map((check) => check.message),
    theme,
  };
}
