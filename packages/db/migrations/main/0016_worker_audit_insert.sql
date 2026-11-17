-- The monthly audit purge deletes as ad_maintenance, which cannot insert, and then writes one row that records
-- the purge. The worker runs the job, so it needs INSERT on audit_log. The append only trigger still blocks
-- UPDATE, DELETE and TRUNCATE for every role except ad_maintenance, so this does not weaken tamper resistance.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_worker') THEN
    GRANT INSERT ON audit_log TO ad_worker;
  END IF;
END
$$;
