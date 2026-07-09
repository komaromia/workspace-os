CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "_schema_bootstrap_probe" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"embedding" vector(3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
