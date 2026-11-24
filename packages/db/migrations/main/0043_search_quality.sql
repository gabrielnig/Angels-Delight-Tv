-- L6 search quality (M45-S07 to S09). Words for "did you mean", synonym groups an admin edits, and searches that
-- found nothing. None of these tables holds an account, profile, session or address, so none has row level
-- security. They are reached only by the catalog and admin services.
CREATE TABLE search_terms (
  term text PRIMARY KEY,
  CONSTRAINT search_terms_term_length CHECK (char_length(term) BETWEEN 2 AND 40)
);
--> statement-breakpoint
CREATE INDEX search_terms_trgm_idx ON search_terms USING gin (term gin_trgm_ops);
--> statement-breakpoint
CREATE TABLE search_synonyms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terms text[] NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT search_synonyms_group_size CHECK (cardinality(terms) BETWEEN 2 AND 20)
);
--> statement-breakpoint
CREATE TABLE search_misses (
  query_norm text PRIMARY KEY,
  hits integer NOT NULL DEFAULT 1,
  last_seen timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT search_misses_query_length CHECK (char_length(query_norm) BETWEEN 1 AND 80),
  CONSTRAINT search_misses_hits_positive CHECK (hits >= 1)
);
--> statement-breakpoint
CREATE INDEX search_misses_last_seen_idx ON search_misses (last_seen);
--> statement-breakpoint
-- A neutral starting set for an education site. The client edits or replaces it in the Discovery tab.
INSERT INTO search_synonyms (terms) VALUES
  (ARRAY['money', 'finance', 'cash', 'budget', 'savings']),
  (ARRAY['maths', 'math', 'mathematics', 'arithmetic']),
  (ARRAY['farming', 'agriculture', 'crops']),
  (ARRAY['kids', 'children', 'child']),
  (ARRAY['health', 'wellness', 'fitness']);
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON search_terms, search_synonyms, search_misses TO ad_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON search_terms, search_misses TO ad_worker;
  END IF;
END
$$;
