CREATE TABLE IF NOT EXISTS "members" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"identity_ref" text NOT NULL,
	"display_name" text NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "persona_versions" (
	"persona_id" text NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"system_prompt" text NOT NULL,
	"allowed_tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persona_versions_persona_id_version_pk" PRIMARY KEY("persona_id","version")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "members_identity_ref_idx" ON "members" USING btree ("identity_ref");