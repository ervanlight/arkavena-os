# ai-scribe — FROZEN

This module is frozen by owner decision **D7** (`ARCHITECTURE.md` §9). It stays
empty until the owner explicitly asks for it. It is listed in the folder
structure (§1.1) only so the structure is complete.

Until the freeze is lifted, the following are forbidden **anywhere in this
repository**, not just in this folder:

- calling the Claude API, or any other LLM API
- stubs, placeholder calls, or "we'll fill this in later" adapters
- prompt templates
- environment variables holding an AI API key
- adding `@anthropic-ai/sdk` or any comparable SDK to `package.json`

Lifting the freeze requires an ADR in `docs/decisions/` plus explicit owner
approval. Do not treat a task that merely *sounds* AI-adjacent as authorization.
