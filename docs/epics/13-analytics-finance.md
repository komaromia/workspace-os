# Epic 13 — Analytics & finance integrations

**Phase:** 3 — Business surface

## Goal

Pull in analytics and financial data, and let a "data analyst" agent analyze it and produce
artifacts.

## Why it matters

Analyzing performance and collecting finances is core to "building the business" inside the
workspace.

## Key stories

- Data connectors ingest from marketing/analytics/finance sources into an analytics store (DuckDB
  simple / ClickHouse hardened). Connectors may run as external infrastructure so the codebase
  stays single-language.
- A data-analyst persona queries the store in a sandbox and emits dashboards/reports as
  artifacts.
- Data classification and scoping so agents and connectors see only permitted data.

## Acceptance criteria

- Data lands in the analytics store.
- An agent runs an analysis and produces a dashboard/report artifact.
- Data access respects classification rules.
