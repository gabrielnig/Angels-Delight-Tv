CREATE TABLE "user_keys" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"dek_wrapped" "bytea" NOT NULL,
	"kek_version" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
