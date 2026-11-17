ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY accounts_self ON accounts FOR ALL
  USING (id = app_account_id())
  WITH CHECK (id = app_account_id());
--> statement-breakpoint
CREATE POLICY accounts_admin_read ON accounts FOR SELECT
  USING (app_actor_role() = 'admin');
--> statement-breakpoint
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE profiles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY profiles_owner ON profiles FOR ALL
  USING (account_id = app_account_id())
  WITH CHECK (account_id = app_account_id());
--> statement-breakpoint
CREATE POLICY profiles_admin_read ON profiles FOR SELECT
  USING (app_actor_role() = 'admin');
--> statement-breakpoint
ALTER TABLE watch_progress ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE watch_progress FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY watch_progress_owner ON watch_progress FOR ALL
  USING (owns_profile(profile_id))
  WITH CHECK (owns_profile(profile_id));
--> statement-breakpoint
ALTER TABLE my_list ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE my_list FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY my_list_owner ON my_list FOR ALL
  USING (owns_profile(profile_id))
  WITH CHECK (owns_profile(profile_id));
--> statement-breakpoint
-- FORCE applies policies to the table owner too. The SECURITY DEFINER helpers (auth_find_account,
-- keep_one_active_admin) run as the owner, so the owner role gets a read-only policy. It only exists when the
-- migrator role does (a superuser migrator bypasses row level security anyway).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_migrator') THEN
    CREATE POLICY accounts_definer_read ON accounts FOR SELECT TO ad_migrator USING (true);
  END IF;
END
$$;
