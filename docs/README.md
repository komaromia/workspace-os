# Knowledge base

This is the working knowledge base for **workspace-os** — a peer workspace for
humans and AI agents. It is meant to stay authoritative as the project grows;
update it alongside the code, not after the fact.

## Contents

- **[architecture/foundations.md](architecture/foundations.md)** — language & repo shape, recommended TypeScript
  stack, guiding principles, build phasing. The source-of-truth summary of section 0 of the
  original design doc.
- **[architecture/repo-layout.md](architecture/repo-layout.md)** — what lives in each top-level folder and why.
- **[epics/](epics/)** — one file per implementation epic (16 total), each with goal, why it matters,
  key stories, and acceptance criteria. Start at [epics/00-overview.md](epics/00-overview.md).
- **[decisions/](decisions/)** — architecture decision records (ADRs) for choices worth
  remembering the reasoning behind, not just the outcome.

## How to use this

- Before starting an epic, read its file in `epics/` in full — acceptance criteria are the
  definition of done, not a suggestion.
- If you make an architectural choice that isn't obvious from the code (a library swap, a
  rejected alternative, a constraint from the hardened profile), write an ADR in `decisions/`
  rather than letting the reasoning live only in a PR description or chat log.
- Keep `epics/` in sync with reality: when an epic's scope changes, edit the file — don't leave
  it as a stale plan next to code that diverged from it.
