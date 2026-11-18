-- Seeds the four site pages with marked placeholder text (M26-S01 AC3, D-106). Each page is one published version,
-- so a fresh site shows the Draft banner and the launch checklist stays open until the admin publishes real text.
-- Pages that already exist are left alone.
INSERT INTO settings (key, value, is_public)
VALUES ('pages.terms', '{"draft": null, "versions": [{"version": 1, "body": "<p>[Add your terms of use here before launch]</p>", "publishedAt": "2026-11-18T00:00:00.000Z", "publishedBy": "system"}]}'::jsonb, false)
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
INSERT INTO settings (key, value, is_public)
VALUES ('pages.privacy', '{"draft": null, "versions": [{"version": 1, "body": "<p>[Add your privacy policy here before launch]</p>", "publishedAt": "2026-11-18T00:00:00.000Z", "publishedBy": "system"}]}'::jsonb, false)
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
INSERT INTO settings (key, value, is_public)
VALUES ('pages.about', '{"draft": null, "versions": [{"version": 1, "body": "<p>[Add your about page here before launch]</p>", "publishedAt": "2026-11-18T00:00:00.000Z", "publishedBy": "system"}]}'::jsonb, false)
ON CONFLICT (key) DO NOTHING;
--> statement-breakpoint
INSERT INTO settings (key, value, is_public)
VALUES ('pages.help', '{"draft": null, "versions": [{"version": 1, "body": "<p>[Add your help page here before launch]</p>", "publishedAt": "2026-11-18T00:00:00.000Z", "publishedBy": "system"}]}'::jsonb, false)
ON CONFLICT (key) DO NOTHING;
