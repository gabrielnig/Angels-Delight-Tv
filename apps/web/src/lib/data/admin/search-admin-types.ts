import type { AdminActor } from './types';

export interface MissDto {
  /** The normalised words that were searched. No account, profile, session or address is ever stored with them. */
  query: string;
  hits: number;
  /** ISO time of the last search. */
  lastSeen: string;
}

export interface SearchAdminData {
  /** One synonym group per line, words separated by commas. */
  synonyms: string;
  misses: MissDto[];
}

export type SynonymSaveResult =
  | { ok: true; synonyms: string }
  | { ok: false; errors: { line: number; message: string }[]; error?: string };

export interface SearchAdminService {
  load(actor: AdminActor): Promise<SearchAdminData>;
  saveSynonyms(actor: AdminActor, text: string): Promise<SynonymSaveResult>;
}
