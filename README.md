# 🤖 Agentic Employee v2

> **Your autonomous AI employee that works like a human** — clicking, typing, browsing, and completing complex business tasks across applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

---

## ✨ Features

### 🧠 8 Specialized Domain Brains
Automatically switches to the right expertise based on your task:

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

### 🛠️ 45+ Tools

**Built-in:**
- `filesystem` — Read, write, manage files
- `terminal` — Execute shell commands
- `editor` — Search/replace, patches
- `computer` — Mouse, keyboard, screenshots, windows
- `email` — Send emails with templates
- `calendar` — Google Calendar integration
- `slack` — Send messages and notifications
- `journal` — Track actions for rollback
- `memory` — Persistent knowledge storage
- `think` — Reasoning and planning
- `report` — Progress updates
- `request_approval` — Human-in-the-loop

**MCP Integrations (32+):**
- Context7 — Documentation lookup
- Filesystem MCP — Extended file operations
- Puppeteer — Browser automation
- Memory Graph — Knowledge relationships

### 🤖 Multi-Provider AI
Intelligent routing to the best model for each task:

| Task Type | Provider | Model |
|-----------|----------|-------|
| Coding | Anthropic | Claude Sonnet 4 |
| Search | Perplexity | Sonar Pro |
| Vision | OpenAI | GPT-4.1 |
| General | Configurable | Your choice |

### ⏪ Action Journal & Rollback
Every file change is tracked. Made a mistake? Roll it back:
```bash
npm run dev -- journal --list           # See recent runs
npm run dev -- journal --run <id>       # View actions
npm run dev -- journal --rollback-run <id>  # Undo everything
```

---

## 🚀 Quick Start

### 1. Install
```bash
git clone https://github.com/Jettinder/agentic-employee-v2.git
cd agentic-employee-v2
npm install
```

### 2. Configure
```bash
# Interactive setup (recommended)
bash scripts/setup.sh

# Or manual setup
cp .env.example .env
# Edit .env and add your API keys
```

### 3. Build
```bash
npm run build
```

### 4. Run
```bash
# Run a task
npm run dev -- run "Create a Python script that monitors CPU usage"

# Interactive chat
npm run chat

# Web dashboard
npm run web
```

---

## 📖 Commands

### Running Tasks
```bash
# Basic run
npm run dev -- run "Your task here"

# Force specific domain
npm run dev -- run "..." --domain developer

# Verbose output
npm run dev -- run "..." --verbose

# Custom limits
npm run dev -- run "..." --max-iterations 100 --max-tools 200
```

### Interactive Mode
```bash
npm run chat              # Start chat mode
# Commands: /quit, /clear
```

### System
```bash
npm run status            # Check system status
npm run dev -- check      # Validate configuration
npm run dev -- domains    # List available domains
npm run dev -- domains --show developer  # Domain details
```

### Journal & Rollback
```bash
npm run dev -- journal --list              # List runs with journals
npm run dev -- journal --run <id>          # View run details
npm run dev -- journal --rollback <entry> --run <id>  # Rollback one action
npm run dev -- journal --rollback-run <id> # Rollback entire run
```

### Memory
```bash
npm run dev -- memory list     # List stored memories
npm run dev -- memory stats    # Memory statistics
npm run dev -- memory get <key>
npm run dev -- memory set <key> <value>
npm run dev -- memory search <query>
```

### Audit
```bash
npm run dev -- audit --list        # List all runs
npm run dev -- audit --runId <id>  # View run events
```

---

## 🏗️ Architecture

```
src/
├── ai/                 # AI providers + intelligent routing
│   ├── providers/      # OpenAI, Anthropic, Perplexity, Gemini
│   └── router.ts       # Model selection logic
├── core/               # Agent engine
│   ├── agent-loop.ts   # Main execution loop
│   └── orchestrator.ts # Step execution
├── domains/            # Domain Brain System
│   └── brains/         # 8 specialized domains
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
├── journal/            # Action tracking & rollback
├── scheduler/          # Cron-based tasks
├── memory/             # Persistent storage
├── audit/              # Action logging
├── vault/              # Secrets management
└── web/                # Dashboard & API
```

---

## ⚙️ Configuration

See `.env.example` for all options. Key settings:

```bash
# AI Providers (at least one required)
ANTHROPIC_API_KEY=sk-ant-...      # Recommended
OPENAI_API_KEY=sk-...
PERPLEXITY_API_KEY=pplx-...
GEMINI_API_KEY=AIza...

# Integrations (optional)
SMTP_HOST=smtp.gmail.com
SLACK_BOT_TOKEN=xoxb-...
GOOGLE_CLIENT_ID=...

# Behavior
MAX_ITERATIONS=50
MAX_TOOL_CALLS=100
DEFAULT_DOMAIN=general
```

---

## 🐳 Docker

```bash
# Build
docker build -t agentic-employee .

# Run task
docker run --env-file .env agentic-employee run "Your task"

# Docker Compose (web dashboard)
docker-compose up -d
```

---

## 🔒 Security

- **Vault**: AES-256-GCM encrypted secrets storage
- **Audit Trail**: All actions logged with timestamps
- **Approval Gates**: High-impact actions require human approval
- **Journal**: Full rollback capability for file changes
- **Scoped Access**: Domain-based tool restrictions

---

## 🤝 How It Works

1. **You give an objective** → "Write a sales email for our new product"
2. **Domain auto-detected** → Switches to Sales brain (50% autonomy)
3. **Agent plans** → Breaks task into executable steps
4. **Agent executes** → Uses tools, handles errors, adapts
5. **Agent verifies** → Checks results before proceeding
6. **Agent reports** → Provides final summary

The agent operates autonomously within its domain's autonomy level. Low autonomy = more approval requests.

---

## 📋 Requirements

- **Node.js** 18 or higher
- **npm** or **yarn**
- **Linux** for desktop automation (scrot, xdotool, xclip)
- At least **one AI provider API key**

### Linux Desktop Tools (optional)
```bash
sudo apt install scrot xdotool xclip
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🆘 Support

- **Documentation**: This README + inline code comments
- **Issues**: [GitHub Issues](https://github.com/Jettinder/agentic-employee-v2/issues)
- **Configuration Help**: Run `npm run dev -- check`

---

<p align="center">
  <b>Built with ❤️ for autonomous productivity</b>
</p>
