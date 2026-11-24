import { normalizeTerm, parseSynonymGroups, type SynonymLineError } from '@ad/catalog';

/**
 * Checks the synonyms textarea line by line (M45-S08, S137 state 4). The catalog parser owns the shape rules. This
 * adds the repeat check and a worked example, and keeps line numbers whole so the editor can point at the line.
 * Server only: it imports the catalog.
 */
export function checkSynonymText(text: string): { groups: string[][]; errors: SynonymLineError[] } {
  const groups: string[][] = [];
  const errors: SynonymLineError[] = [];
  text.split(/\r?\n/).forEach((raw, index) => {
    if (raw.trim() === '') return;
    const line = index + 1;
    const seen = new Set<string>();
    for (const word of raw.split(',').map(normalizeTerm).filter(Boolean)) {
      if (seen.has(word)) {
        errors.push({ line, message: `"${word}" is listed twice.` });
        return;
      }
      seen.add(word);
    }
    const parsed = parseSynonymGroups(raw);
    if (parsed.errors.length > 0) {
      const message = parsed.errors[0]!.message;
      errors.push({
        line,
        message:
          message === 'Add at least two different words'
            ? 'Add at least two different words, like "saving, savings".'
            : message,
      });
    } else {
      groups.push(...parsed.groups);
    }
  });
  return { groups, errors };
}
