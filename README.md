# Full Agentic Employee (Enterprise) — V2

Objective: Autonomous objective→plan→act→verify→iterate with MCP-native execution, guardrails, audit, vault, and deterministic runner.

Quickstart
- npm i (or pnpm i)
- npm run build
- npm run demo:e2e

Demo flow
- Intentionally attempts a denied filesystem write outside sandbox, then auto-applies fallback to allowed path.
- Creates demo_v2/, writes and chmods main.sh, runs it via terminal.
- post-validate ensures stdout contains "Agent OK" + ISO timestamp.
- JSON logs streamed and audit events written to .data/audit.sqlite.

