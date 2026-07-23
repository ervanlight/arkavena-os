# ai-scribe

Owner decision D7's freeze was lifted 2026-07-23 — see
[ADR 0020](../../../docs/decisions/0020-fase10-ai-scribe-unfreeze-and-scope.md)
for scope, model choice, cost/budget mechanism, and what is deliberately
deferred (voice-note transcription needs a second AI vendor decision this ADR
does not make; draft weekly report and draft assessment/proposal wait for a
follow-up round, F10-2).

This module never writes to another module's table. Every action here reads
its source data through the owning module's public API and returns suggested
text; the human saves it through that module's own existing create/update
action, unchanged.
