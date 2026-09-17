# 0000 - Record architecture decisions with MADR

## Status
Accepted

## Context and Problem Statement
This project's architecture will be built up across multiple work sessions
(and multiple Claude Code sessions/agents). Decisions need to be traceable
after the fact - what was chosen, why, and what it was chosen over - without
re-deriving the reasoning from git history or code alone.

## Decision Outcome
Use MADR (Markdown Architecture Decision Records), one file per decision
under `docs/adr/`, numbered sequentially. Every decision - including ones
synthesized by an AI research pass rather than hand-picked - must cite a
source: an official doc, a standards body, or a named comparison/benchmark.
"This is what the assistant knows" is not a citation on its own.

## Sources
- MADR project site: https://adr.github.io/madr/
- MADR GitHub repository: https://github.com/adr/madr
