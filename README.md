# Agentic Employee v2

An autonomous AI employee that can operate a computer like a human — clicking, typing, browsing, and completing complex tasks across applications.

## Features

### 🧠 Domain Brain System
8 specialized brains that auto-switch based on task:

| Domain | Expertise | Autonomy |
|--------|-----------|----------|
| **Developer** | Coding, debugging, DevOps | 80% |
| **Marketing** | Content, social, SEO, campaigns | 60% |
| **Sales** | Leads, outreach, CRM, closing | 50% |
| **Operations** | Automation, data, reporting | 90% |
| **Finance** | Invoicing, budgets, analysis | 30% |
| **HR** | Recruiting, onboarding, policies | 40% |
| **Support** | Tickets, customer service | 70% |
| **General** | Everything else | 70% |

### 🛠️ Tools (45+)

**Built-in (13):**
- `filesystem` - Read, write, manage files
- `terminal` - Execute shell commands
- `editor` - Search/replace, patches
- `search` - Web search via Perplexity
- `computer` - Mouse, keyboard, screenshots, windows
- `email` - Send emails, templates
- `calendar` - Google Calendar events
- `slack` - Send messages, notifications
- `notify` - Multi-channel notifications
- `memory` - Persistent storage
- `think` - Reasoning tool
- `report` - Progress reporting
- `request_approval` - Human-in-the-loop

**MCP Servers (32+):**
- Context7 - Documentation lookup
- Filesystem MCP - Extended file operations
- Puppeteer - Browser automation
- Memory - Knowledge graph

### 🤖 AI Providers
Intelligent routing to best model:

| Task Type | Provider | Model |
|-----------|----------|-------|
| Coding | Anthropic | claude-sonnet-4-20250514 |
| Search | Perplexity | sonar-pro |
| Vision | OpenAI | gpt-4.1 |
| General | Anthropic | claude-sonnet-4-20250514 |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file and add your API keys
cp .env.example .env

# Build
npm run build

# Check status
npm run status

# Run with an objective
npm run dev -- run "Create a Python script that calculates prime numbers"

# Force specific domain
npm run dev -- run "..." --domain developer

# Interactive chat
npm run chat

# List domains
npm run dev -- domains

# Web dashboard
npm run web
```

## CLI Commands

```bash
# Agent execution
npm run dev -- run <objective>          # Run task
npm run dev -- run <obj> --domain <d>   # Force domain
npm run dev -- run <obj> --verbose      # Detailed logs
npm run chat                            # Interactive mode
npm run plan <objective>                # Generate plan only

# Domain management  
npm run dev -- domains                  # List all domains
npm run dev -- domains --show <domain>  # Domain details

# System
npm run status                          # System status
npm run web                             # Start web dashboard

# Memory & Audit
npm run dev -- memory list              # List memories
npm run dev -- memory stats             # Memory statistics
npm run dev -- audit --list             # List audit runs
```

## Architecture

```
src/
├── ai/                 # AI providers + routing
│   ├── providers/      # OpenAI, Anthropic, Perplexity, Gemini
│   └── router.ts       # Intelligent model selection
├── core/               # Agent engine
│   ├── agent-loop.ts   # Main execution loop
│   └── orchestrator.ts # Step execution
├── domains/            # Domain Brain System
│   ├── brains/         # 8 specialized domains
│   ├── manager.ts      # Domain switching
│   └── types.ts        # Type definitions
├── tools/              # Tool system
│   ├── definitions.ts  # Tool schemas
│   └── executor.ts     # Tool execution
├── integrations/       # External services
│   ├── email/          # SMTP/Gmail
│   ├── calendar/       # Google Calendar
│   ├── slack/          # Slack messaging
│   └── notifications/  # Multi-channel alerts
├── computer/           # Desktop automation
├── mcp/                # MCP server integration
├── scheduler/          # Cron-based tasks
├── memory/             # Persistent storage
├── audit/              # Action logging
├── vault/              # Secrets management
└── web/                # Dashboard & API
```

## Configuration

See `.env.example` for all options:

```bash
# AI Providers (at least one required)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
GEMINI_API_KEY=AIza...

# Integrations (optional)
SMTP_HOST=smtp.gmail.com
SMTP_USER=...
SLACK_BOT_TOKEN=xoxb-...
GOOGLE_CLIENT_ID=...
```

## How It Works

1. **You give an objective** → "Write a sales email for our new product"
2. **Domain auto-detected** → Switches to Sales brain
3. **Agent plans** → Breaks into steps
4. **Agent executes** → Uses tools to complete each step
5. **Agent verifies** → Checks results, adapts if needed
6. **Agent reports** → Provides final summary

The agent handles errors autonomously, tries alternative approaches, and asks for approval only when necessary (based on domain autonomy level).

## License

MIT
