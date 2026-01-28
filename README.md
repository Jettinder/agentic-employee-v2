# Full Agentic Employee (Enterprise) — V2

Objective: Autonomous objective→plan→act→verify→iterate with MCP-native execution, guardrails, audit, vault, and deterministic runner.

Quickstart
- npm i (or pnpm i)
- npm run build
- npm run demo:e2e

What the demo does
- Creates demo_v2/
- Writes demo_v2/main.sh
- chmod + executes script
- Verifies stdout contains "Agent OK" + ISO timestamp
- Produces JSON logs and writes to .data/audit.sqlite

