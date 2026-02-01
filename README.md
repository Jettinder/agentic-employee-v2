# Agentic Employee v2

An autonomous AI employee that can understand objectives, plan execution, and complete tasks using multiple AI providers.

## Features

- **Multi-Provider AI**: Intelligent routing between OpenAI, Anthropic, and Perplexity
- **Autonomous Execution**: Objective → Plan → Execute → Verify → Iterate
- **Tool System**: Filesystem, terminal, editor, search, memory
- **Guardrails**: Policy-based execution with sandbox support
- **Audit Trail**: Complete logging of all actions and decisions
- **Vault**: Secure secrets management
- **Memory**: Persistent context and learning
- **Web UI**: Dashboard and API for monitoring and control

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and add your API keys
cp .env.example .env

# Build
npm run build

# Check status (verifies API keys)
npm run status

# Run with an objective
npm run dev run "Create a hello world Python script and run it"

# Interactive chat mode
npm run chat

# Generate a plan without executing
npm run plan "Set up a Node.js project with TypeScript"
```

## CLI Commands

```bash
# Run agent with objective
agentic run "your objective here" --verbose

# Interactive chat
agentic chat

# Generate execution plan
agentic plan "your objective" --output plan.json

# Status check
agentic status

# Memory operations
agentic memory list
agentic memory get <key>
agentic memory set <key> <value> --tags "tag1,tag2"
agentic memory search <query>
agentic memory stats

# Audit logs
agentic audit --list
agentic audit --runId <run-id>

# Vault (secrets)
agentic vault list
agentic vault add --name API_KEY --value "secret" --scopes "api,external"
agentic vault revoke --id <id>
```

## Web Server

```bash
# Start web server (default port 3000)
npm run web

# API endpoints:
# POST /api/agent/run          - Run objective
# POST /api/agent/chat         - Chat message
# POST /api/agent/plan         - Generate plan
# GET  /api/agent/status       - System status
# GET  /api/audit/runs         - List runs
# GET  /api/memory             - List memory
# POST /api/memory/search      - Search memory
```

## AI Provider Routing

The system automatically selects the best AI provider for each task:

| Task Type | Provider | Reason |
|-----------|----------|--------|
| Web Search | Perplexity | Real-time information |
| Coding | Anthropic | Superior code generation |
| Analysis | Anthropic | Deep reasoning |
| Planning | Anthropic | Structured decomposition |
| Vision | OpenAI | Image understanding |
| General | Default | Configurable |

## Architecture

```
src/
├── ai/                 # AI provider layer
│   ├── providers/      # OpenAI, Anthropic, Perplexity clients
│   ├── router.ts       # Intelligent provider selection
│   └── types.ts        # Shared types
├── core/               # Core engine
│   ├── agent-loop.ts   # Main execution loop
│   ├── orchestrator.ts # Step execution
│   └── types.ts        # Core types
├── tools/              # Tool system
│   ├── definitions.ts  # Tool schemas
│   └── executor.ts     # Tool execution
├── planner/            # Plan generation
├── memory/             # Persistent storage
├── guardrails/         # Policy enforcement
├── audit/              # Logging
├── vault/              # Secrets
├── execution/          # Low-level executors
└── web/                # Web server & API
```

## Configuration

Environment variables (`.env`):

```bash
# Required: At least one AI provider
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
PERPLEXITY_API_KEY=pplx-...

# Optional: Default provider
DEFAULT_AI_PROVIDER=anthropic  # or openai, perplexity

# Optional: Model overrides
OPENAI_MODEL=gpt-4-turbo-preview
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
PERPLEXITY_MODEL=sonar-pro
```

## Available Tools

| Tool | Description |
|------|-------------|
| `filesystem` | Read, write, mkdir, chmod, list, delete, move, copy |
| `terminal` | Execute shell commands |
| `editor` | Search/replace, insert, delete lines, apply patches |
| `search` | Web search (via Perplexity) |
| `think` | Structured reasoning |
| `memory` | Store/retrieve persistent data |
| `request_approval` | Human-in-the-loop for sensitive actions |
| `report` | Progress and completion reporting |

## Example Usage

```typescript
import { runObjective } from './core/agent-loop.js';

const result = await runObjective(
  "Create a REST API with Express that has CRUD endpoints for users",
  { verbose: true, maxIterations: 30 }
);

console.log(result.finalResponse);
```

## Development

```bash
# Run in dev mode
npm run dev -- run "test objective"

# Build
npm run build

# Run built version
npm start run "test objective"
```

## License

MIT
