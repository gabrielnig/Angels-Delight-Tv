import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { createdAt, timestamptz } from './columns';

/**
 * Search quality tables (M45-S07 to S09, migration 0043). None holds an account, profile, session or address,
 * so none has row level security. They are reached only by the catalog and admin services.
 */

/** Words of live title and category names, the list "did you mean" corrects against. */
export const searchTerms = pgTable('search_terms', { term: text('term').primaryKey() }, (t) => [
  check('search_terms_term_length', sql`char_length(${t.term}) BETWEEN 2 AND 40`),
]);

/** One group of words that mean the same to a viewer, edited in the Discovery tab. */
export const searchSynonyms = pgTable(
  'search_synonyms',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    terms: text('terms').array().notNull(),
    createdAt: createdAt(),
  },
  (t) => [check('search_synonyms_group_size', sql`cardinality(${t.terms}) BETWEEN 2 AND 20`)],
);

/** Searches that found nothing, counted by their normalised words and deleted after 90 days. */
export const searchMisses = pgTable(
  'search_misses',
  {
    queryNorm: text('query_norm').primaryKey(),
    hits: integer('hits').notNull().default(1),
    lastSeen: timestamptz('last_seen').notNull().defaultNow(),
  },
  (t) => [
    check('search_misses_query_length', sql`char_length(${t.queryNorm}) BETWEEN 1 AND 80`),
    check('search_misses_hits_positive', sql`${t.hits} >= 1`),
    index('search_misses_last_seen_idx').on(t.lastSeen),
  ],
);
