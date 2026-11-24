-- Account purge removes the notification choices and the sealed digest address (M44, SECURITY section on retention).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ad_app') THEN
    GRANT DELETE ON viewer_notification_prefs TO ad_app;
  END IF;
END $$;
