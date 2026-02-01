/**
 * CLI Provider - Uses installed CLI tools (Claude Code, Gemini CLI, Codex)
 * Falls back to these when API providers fail or for complex coding tasks
 */

import { spawn, execSync } from 'child_process';
import type { ProviderClient, CompletionRequest, CompletionResponse, ProviderConfig, Message } from '../types.js';

export type CLITool = 'claude' | 'gemini' | 'codex';

interface CLIConfig extends ProviderConfig {
  tool: CLITool;
  path?: string;
}

export class CLIProvider {
  name: string;
  private config: CLIConfig;
  private toolPath: string;
  private toolName: CLITool;

  constructor(config: CLIConfig) {
    this.config = config;
    this.toolName = config.tool;
    this.toolPath = config.path || config.tool;
    this.name = `cli-${config.tool}`;
  }

  isAvailable(): boolean {
    // Check if the CLI tool exists
    try {
      execSync(`which ${this.toolPath}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Combine messages into a single prompt
    const prompt = this.buildPrompt(request.messages);
    
    // Execute CLI tool
    const response = await this.executeCLI(prompt);
    
    return {
      id: `cli-${Date.now()}`,
      provider: this.name as any,
      model: this.toolName,
      message: {
        role: 'assistant',
        content: response,
      },
      finish_reason: 'stop',
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    };
  }

  private buildPrompt(messages: Message[]): string {
    return messages
      .map(m => {
        if (m.role === 'system') return `System: ${m.content}`;
        if (m.role === 'user') return `User: ${m.content}`;
        if (m.role === 'assistant') return `Assistant: ${m.content}`;
        return m.content;
      })
      .join('\n\n');
  }

  private async executeCLI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let args: string[] = [];
      
      switch (this.toolName) {
        case 'claude':
          // Claude Code: claude -p "prompt"
          args = ['-p', prompt];
          break;
        case 'gemini':
          // Gemini CLI: gemini "prompt"
          args = [prompt];
          break;
        case 'codex':
          // Codex CLI: codex "prompt"
          args = [prompt];
          break;
      }

      const proc = spawn(this.toolPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 120000, // 2 minutes timeout
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`CLI ${this.toolName} failed: ${stderr || stdout}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`CLI ${this.toolName} error: ${err.message}`));
      });
    });
  }
}

/**
 * Detect available CLI tools
 */
export function detectCLITools(): CLITool[] {
  const tools: CLITool[] = [];
  
  const checkTool = (name: CLITool) => {
    try {
      execSync(`which ${name}`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  };
  
  if (checkTool('claude')) tools.push('claude');
  if (checkTool('gemini')) tools.push('gemini');
  if (checkTool('codex')) tools.push('codex');
  
  return tools;
}

/**
 * Create CLI provider for a specific tool
 */
export function createCLIProvider(tool: CLITool): CLIProvider {
  return new CLIProvider({ 
    tool,
    apiKey: '', // Not needed for CLI
  });
}
