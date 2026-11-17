-- ad_keys_app reads and creates keys. ad_keys_shred can only delete (the crypto-shredding step). A DELETE with a
-- WHERE clause needs SELECT on the filtered column, so shred gets SELECT on account_id only.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_keys_app') THEN
    GRANT SELECT, INSERT ON user_keys TO ad_keys_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_keys_shred') THEN
    GRANT SELECT (account_id) ON user_keys TO ad_keys_shred;
    GRANT DELETE ON user_keys TO ad_keys_shred;
  END IF;
END
$$;
