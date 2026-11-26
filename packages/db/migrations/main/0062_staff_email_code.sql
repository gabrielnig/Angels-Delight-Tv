-- L16 (D-397): staff can use an emailed one time code as the second sign in step. The code reuses email_tokens and
-- verification_codes (hashed, attempt counted), so only the two new purposes are added. Own file: a new enum value cannot
-- be used in the transaction that adds it. No new table, so purge, export and row level security are unchanged.
ALTER TYPE "token_purpose" ADD VALUE IF NOT EXISTS 'staff_sign_in';--> statement-breakpoint
ALTER TYPE "token_purpose" ADD VALUE IF NOT EXISTS 'staff_confirm';
