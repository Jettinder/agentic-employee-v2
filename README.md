# Full Agentic Employee (Enterprise) — V2

Objective: In 48 hours, deliver a working V2 agent that autonomously interprets objectives, plans, executes real actions via MCP tools, self-verifies, and iterates — with guardrails and audit.

Key modules:
- core: agentic loop orchestrator (objective→plan→act→verify→iterate)
- execution: MCP-native adapters (filesystem, terminal, editor)
- guardrails: policy engine + pre/post hooks
- audit: immutable audit writer + structured logging
- vault: scoped credentials + grants
- runner: deterministic task runner
- cli: entrypoints (e.g., `runner start demo-e2e`)

Getting started:
- pnpm i
- pnpm build
- pnpm demo:e2e

