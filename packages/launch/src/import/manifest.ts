import { ALLOWED_EXTENSIONS, titleFromFilename } from '@ad/video';
import { BOM, parseCsv } from './csv';

export type Suitability = 'everyone' | 'kids' | 'older';

/** One manifest record with canonical column names, before validation. `line` is where the person finds it. */
export interface RawRow {
  line: number;
  values: Record<string, string>;
}

export interface ManifestRow {
  line: number;
  file: string;
  title: string;
  description: string;
  categories: string[];
  series: string | null;
  season: number | null;
  episode: number | null;
  suitability: Suitability | null;
  language: string;
  script: string | null;
  poster: string | null;
}

export interface RowProblem {
  line: number;
  field: string;
  message: string;
}

const CANONICAL = [
  'file',
  'title',
  'description',
  'category',
  'series',
  'season',
  'episode',
  'age_rating',
  'language',
  'script',
  'poster',
] as const;

const ALIASES: Record<string, (typeof CANONICAL)[number]> = {
  filename: 'file',
  file_name: 'file',
  video: 'file',
  path: 'file',
  desc: 'description',
  categories: 'category',
  age: 'age_rating',
  rating: 'age_rating',
  suitability: 'age_rating',
  lang: 'language',
  thumbnail: 'poster',
  image: 'poster',
};

function canonicalName(header: string): string | null {
  const name = header
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if ((CANONICAL as readonly string[]).includes(name)) return name;
  return ALIASES[name] ?? null;
}

export type ParsedManifest = { ok: true; rows: RawRow[] } | { ok: false; error: string };

function toRawRows(records: Record<string, unknown>[], firstLine: number): ParsedManifest {
  const unknown = new Set<string>();
  const rows: RawRow[] = [];
  for (const [index, record] of records.entries()) {
    const values: Record<string, string> = {};
    for (const [header, value] of Object.entries(record)) {
      const name = canonicalName(header);
      if (!name) {
        unknown.add(header);
        continue;
      }
      const text = Array.isArray(value)
        ? value.map((item) => String(item)).join('|')
        : value === null || value === undefined
          ? ''
          : String(value);
      values[name] = text;
    }
    rows.push({ line: firstLine + index, values });
  }
  if (unknown.size > 0) {
    return {
      ok: false,
      error: `Unknown column${unknown.size > 1 ? 's' : ''}: ${[...unknown].join(', ')}. Known columns: ${CANONICAL.join(', ')}`,
    };
  }
  if (rows.length > 0 && !rows.some((row) => 'file' in row.values)) {
    return { ok: false, error: 'The manifest needs a file column' };
  }
  return { ok: true, rows };
}

export function parseManifestText(text: string, format: 'csv' | 'json'): ParsedManifest {
  if (format === 'csv') {
    const parsed = parseCsv(text);
    if (!parsed.ok) return parsed;
    const header = (text.startsWith(BOM) ? text.slice(1) : text).split(/\r?\n/, 1)[0] ?? '';
    if (!header.split(',').some((name) => canonicalName(name.replace(/^"|"$/g, '')) === 'file')) {
      return { ok: false, error: 'The manifest needs a file column' };
    }
    return toRawRows(parsed.rows, 2);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The manifest is not valid JSON' };
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as { videos?: unknown }).videos)
      ? (data as { videos: unknown[] }).videos
      : null;
  if (
    !list ||
    list.some((item) => typeof item !== 'object' || item === null || Array.isArray(item))
  ) {
    return {
      ok: false,
      error: 'The JSON manifest must be a list of objects, or { "videos": [...] }',
    };
  }
  return toRawRows(list as Record<string, unknown>[], 1);
}

const SUITABILITY_WORDS: Record<string, Suitability> = {
  everyone: 'everyone',
  all: 'everyone',
  g: 'everyone',
  general: 'everyone',
  kids: 'kids',
  kid: 'kids',
  children: 'kids',
  k: 'kids',
  older: 'older',
  teen: 'older',
  teens: 'older',
  adult: 'older',
  pg: 'older',
  'pg-13': 'older',
  '13+': 'older',
  '16+': 'older',
  '18+': 'older',
};

const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'webp'];
const SCRIPT_EXT = ['txt'];

const extensionOf = (name: string) =>
  name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';

/** A manifest path must stay inside the content folder. */
function unsafePath(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:/.test(path) || path.split(/[\\/]/).includes('..');
}

export interface ValidateContext {
  /** Does this path (relative to the content folder) exist? */
  exists(path: string): Promise<boolean>;
}

/**
 * Checks every row and returns all the problems at once, so the person fixes the sheet in one pass. Nothing is
 * imported until this returns no errors.
 */
export async function validateManifest(
  raw: RawRow[],
  context: ValidateContext,
): Promise<{ rows: ManifestRow[]; errors: RowProblem[] }> {
  const rows: ManifestRow[] = [];
  const errors: RowProblem[] = [];
  const seenFiles = new Map<string, number>();
  const seenEpisodes = new Map<string, number>();

  for (const { line, values } of raw) {
    const problem = (field: string, message: string) => errors.push({ line, field, message });
    const get = (name: string) => (values[name] ?? '').trim();

    const file = get('file');
    if (!file) problem('file', 'File is required');
    else if (unsafePath(file)) problem('file', 'Use a path inside the content folder');
    else if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(file)))
      problem('file', `Use ${ALLOWED_EXTENSIONS.join(', ')} files`);
    else if (!(await context.exists(file))) problem('file', `The file ${file} was not found`);
    else if (seenFiles.has(file))
      problem('file', `The file ${file} is already listed on line ${seenFiles.get(file)}`);
    if (file && !seenFiles.has(file)) seenFiles.set(file, line);

    const title = (
      get('title') || (file ? titleFromFilename(file.split(/[\\/]/).pop()!) : '')
    ).replace(/\s+/g, ' ');
    if (title.length > 200) problem('title', 'Use 200 characters or fewer');

    const description = get('description');
    if (description.length > 5000) problem('description', 'Use 5000 characters or fewer');

    const categories: string[] = [];
    for (const name of get('category')
      .split(/[|;]/)
      .map((part) => part.trim().replace(/\s+/g, ' '))) {
      if (!name) continue;
      if (name.length > 40)
        problem('category', `The category ${name.slice(0, 20)}... is longer than 40 characters`);
      else if (!categories.some((existing) => existing.toLowerCase() === name.toLowerCase()))
        categories.push(name);
    }

    const series = get('series') || null;
    if (series && series.length > 80) problem('series', 'Use 80 characters or fewer');
    const wholeNumber = (field: 'season' | 'episode'): number | null => {
      const text = get(field);
      if (!text) return null;
      if (!/^\d{1,4}$/.test(text) || Number(text) < 1) {
        problem(field, 'Use a whole number from 1');
        return null;
      }
      return Number(text);
    };
    const season = wholeNumber('season');
    const episode = wholeNumber('episode');
    if (series && (season === null || episode === null)) {
      if (season === null && !errors.some((e) => e.line === line && e.field === 'season'))
        problem('season', 'A series needs a season number');
      if (episode === null && !errors.some((e) => e.line === line && e.field === 'episode'))
        problem('episode', 'A series needs an episode number');
    }
    if (!series && (get('season') || get('episode')))
      problem('series', 'Season and episode need a series name');
    if (series && season !== null && episode !== null) {
      const key = `${series.toLowerCase()}|${season}|${episode}`;
      if (seenEpisodes.has(key))
        problem(
          'episode',
          `Season ${season} episode ${episode} of ${series} is already on line ${seenEpisodes.get(key)}`,
        );
      else seenEpisodes.set(key, line);
    }

    let suitability: Suitability | null = null;
    const rating = get('age_rating').toLowerCase();
    if (rating) {
      suitability = SUITABILITY_WORDS[rating] ?? null;
      if (!suitability)
        problem('age_rating', 'Use everyone, kids or older (G, PG and 13+ also work)');
    }

    const language = get('language') || 'en';
    if (!LANGUAGE.test(language)) problem('language', 'Use a language code such as en or yo');

    const optionalFile = async (
      field: 'script' | 'poster',
      extensions: string[],
      label: string,
    ) => {
      const value = get(field);
      if (!value) return null;
      if (unsafePath(value)) problem(field, 'Use a path inside the content folder');
      else if (!extensions.includes(extensionOf(value)))
        problem(field, `Use a ${label} file (${extensions.join(', ')})`);
      else if (!(await context.exists(value))) problem(field, `The file ${value} was not found`);
      return value;
    };
    const script = await optionalFile('script', SCRIPT_EXT, 'text');
    const poster = await optionalFile('poster', IMAGE_EXT, 'image');

    rows.push({
      line,
      file,
      title,
      description,
      categories,
      series,
      season,
      episode,
      suitability,
      language,
      script,
      poster,
    });
  }
  return { rows, errors };
}
