CREATE TABLE IF NOT EXISTS "policy_versions" (
	"policy_id" text NOT NULL,
	"version" integer NOT NULL,
	"actions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "policy_versions_policy_id_version_pk" PRIMARY KEY("policy_id","version")
);
