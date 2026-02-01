#!/bin/bash
#
# Agentic Employee v2 - Setup Wizard
# Interactive setup for first-time configuration
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# ASCII Art Logo
echo -e "${CYAN}"
cat << "EOF"
    _                    _   _        ______                 _                       
   / \   __ _  ___ _ __ | |_(_) ___  | ____|_ __ ___  _ __ | | ___  _   _  ___  ___ 
  / _ \ / _` |/ _ \ '_ \| __| |/ __| |  _| | '_ ` _ \| '_ \| |/ _ \| | | |/ _ \/ _ \
 / ___ \ (_| |  __/ | | | |_| | (__  | |___| | | | | | |_) | | (_) | |_| |  __/  __/
/_/   \_\__, |\___|_| |_|\__|_|\___| |_____|_| |_| |_| .__/|_|\___/ \__, |\___|\___|
        |___/                                        |_|            |___/           
EOF
echo -e "${NC}"
echo -e "${BOLD}Welcome to Agentic Employee v2 Setup${NC}\n"

# Check Node.js
echo -e "${BLUE}Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js 18+ first.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}Error: Node.js 18+ required. Current version: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi
echo -e "${GREEN}✓ Dependencies installed${NC}"

# Create .env if not exists
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ Created .env file${NC}"
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

echo ""
echo -e "${BOLD}API Key Configuration${NC}"
echo -e "You need at least ONE AI provider API key to use Agentic Employee.\n"

# Function to prompt for API key
prompt_key() {
    local key_name=$1
    local env_var=$2
    local current_value=$(grep "^$env_var=" .env 2>/dev/null | cut -d'=' -f2)
    
    if [ -n "$current_value" ] && [ "$current_value" != "your_key_here" ] && [ "$current_value" != "" ]; then
        echo -e "${GREEN}✓ $key_name already configured${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}$key_name:${NC}"
    read -p "  Enter your API key (or press Enter to skip): " new_value
    
    if [ -n "$new_value" ]; then
        # Update or add the key in .env
        if grep -q "^$env_var=" .env; then
            sed -i "s|^$env_var=.*|$env_var=$new_value|" .env
        else
            echo "$env_var=$new_value" >> .env
        fi
        echo -e "${GREEN}  ✓ Saved${NC}"
        return 0
    fi
    return 1
}

echo -e "${CYAN}AI Providers (need at least one):${NC}"
prompt_key "Anthropic (Claude)" "ANTHROPIC_API_KEY"
prompt_key "OpenAI (GPT-4)" "OPENAI_API_KEY"
prompt_key "Perplexity (Search)" "PERPLEXITY_API_KEY"
prompt_key "Google Gemini" "GEMINI_API_KEY"

echo ""
echo -e "${CYAN}Optional Integrations:${NC}"
echo -e "(Press Enter to skip any you don't need)\n"

# Check if user wants optional config
read -p "Configure email integration? (y/N): " config_email
if [[ "$config_email" =~ ^[Yy]$ ]]; then
    prompt_key "SMTP Host" "SMTP_HOST"
    prompt_key "SMTP User" "SMTP_USER"
    prompt_key "SMTP Password" "SMTP_PASSWORD"
fi

read -p "Configure Slack integration? (y/N): " config_slack
if [[ "$config_slack" =~ ^[Yy]$ ]]; then
    prompt_key "Slack Bot Token" "SLACK_BOT_TOKEN"
    prompt_key "Slack Signing Secret" "SLACK_SIGNING_SECRET"
fi

read -p "Configure Google Calendar? (y/N): " config_gcal
if [[ "$config_gcal" =~ ^[Yy]$ ]]; then
    prompt_key "Google Client ID" "GOOGLE_CLIENT_ID"
    prompt_key "Google Client Secret" "GOOGLE_CLIENT_SECRET"
fi

# Build
echo ""
echo -e "${BLUE}Building project...${NC}"
npm run build
echo -e "${GREEN}✓ Build complete${NC}"

# Linux desktop tools
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo ""
    echo -e "${BLUE}Checking Linux desktop tools...${NC}"
    MISSING_TOOLS=""
    
    if ! command -v scrot &> /dev/null; then
        MISSING_TOOLS="$MISSING_TOOLS scrot"
    fi
    if ! command -v xdotool &> /dev/null; then
        MISSING_TOOLS="$MISSING_TOOLS xdotool"
    fi
    if ! command -v xclip &> /dev/null; then
        MISSING_TOOLS="$MISSING_TOOLS xclip"
    fi
    
    if [ -n "$MISSING_TOOLS" ]; then
        echo -e "${YELLOW}For desktop automation (screenshots, mouse/keyboard), install:${NC}"
        echo -e "  sudo apt install$MISSING_TOOLS"
    else
        echo -e "${GREEN}✓ Desktop tools installed${NC}"
    fi
fi

# Verify setup
echo ""
echo -e "${BLUE}Verifying setup...${NC}"
npm run status 2>/dev/null || true

# Done
echo ""
echo -e "${GREEN}${BOLD}✅ Setup Complete!${NC}"
echo ""
echo -e "Quick start commands:"
echo -e "  ${CYAN}npm run dev -- run \"Your task here\"${NC}  - Run a task"
echo -e "  ${CYAN}npm run chat${NC}                          - Interactive mode"
echo -e "  ${CYAN}npm run web${NC}                           - Web dashboard"
echo -e "  ${CYAN}npm run dev -- --help${NC}                 - Show all commands"
echo ""
echo -e "Documentation: ${BLUE}README.md${NC}"
echo ""
