/**
 * Agent Loop - The Brain
 * Objective → Plan → Execute → Verify → Iterate
 */

import type { RunContext, Objective } from './types.js';
import type { Message, CompletionResponse, ToolDefinition } from '../ai/types.js';
import { AIRouter, createRouterFromEnv } from '../ai/router.js';
import { getAllTools, getAllToolsWithMCP } from '../tools/definitions.js';
import { executeTool, ToolResult } from '../tools/executor.js';
import { auditEvent } from '../audit/logger.js';
import { emitRunReport } from './report.js';
import { initMCP, getMCPManager } from '../mcp/index.js';
import { DomainManager, getDomainManager, createDomainManager, type DomainId } from '../domains/index.js';

export interface AgentConfig {
  maxIterations?: number;
  maxToolCalls?: number;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  verbose?: boolean;
  /** Specific domain to use */
  domain?: DomainId;
  /** Auto-detect domain from objective */
  autoDomain?: boolean;
}

export interface AgentResult {
  success: boolean;
  finalResponse: string;
  iterations: number;
  toolCalls: number;
  errors: string[];
  context: RunContext;
}

const DEFAULT_SYSTEM_PROMPT = `You are an autonomous AI employee. Your job is to complete tasks by using the tools available to you.

## Guidelines

1. **Think before acting**: Use the 'think' tool to reason through complex problems before executing.

2. **Be thorough**: Read files before modifying, check results after actions.

3. **Report progress**: Use the 'report' tool to communicate status and completion.

4. **Handle errors gracefully**: If something fails, analyze why and try alternative approaches.

5. **Ask for approval**: Use 'request_approval' for high-impact actions.

6. **Use memory**: Store important information for future reference.

## Available Tools

You have access to filesystem operations, terminal commands, file editing, web search, memory storage, and reporting tools.

## Execution Style

- Execute one logical step at a time
- Verify results before proceeding
- Iterate until the objective is fully complete
- Provide a final summary when done
`;

export class AgentLoop {
  private router: AIRouter;
  private config: AgentConfig;
  private tools: ToolDefinition[];
  private mcpInitialized: boolean = false;
  private domainManager: DomainManager;

  constructor(router?: AIRouter, config?: AgentConfig) {
    this.router = router || createRouterFromEnv();
    this.config = {
      maxIterations: 50,
      maxToolCalls: 100,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      verbose: false,
      autoDomain: true, // Auto-detect domain by default
      ...config,
    };
    this.tools = config?.tools || getAllTools();
    
    // Initialize domain manager
    this.domainManager = createDomainManager(config?.domain || 'general');
  }
  
  /**
   * Get domain manager
   */
  getDomainManager(): DomainManager {
    return this.domainManager;
  }

  /**
   * Initialize MCP servers and add their tools
   */
  async initMCP(): Promise<void> {
    if (this.mcpInitialized) return;
    
    try {
      console.log('[Agent] Initializing MCP servers...');
      await initMCP();
      const mcpTools = getMCPManager().getAllTools();
      this.tools = [...this.tools, ...mcpTools];
      this.mcpInitialized = true;
      console.log(`[Agent] MCP initialized with ${mcpTools.length} additional tools`);
    } catch (error: any) {
      console.warn(`[Agent] MCP initialization failed: ${error.message}`);
    }
  }

  /**
   * Run the agent loop for an objective
   */
  async run(ctx: RunContext, objective: string): Promise<AgentResult> {
    // Auto-detect domain if enabled
    if (this.config.autoDomain !== false) {
      await this.domainManager.autoSwitchDomain(objective, ctx);
    }
    
    // Get domain-specific system prompt
    const domainPrompt = this.domainManager.getSystemPrompt();
    const systemPrompt = this.config.systemPrompt 
      ? `${domainPrompt}\n\n---\n\n${this.config.systemPrompt}`
      : domainPrompt;
    
    // Filter tools for current domain
    const domainTools = this.domainManager.filterToolsForDomain(this.tools);
    
    const currentDomain = this.domainManager.getCurrentDomain();
    
    if (this.config.verbose) {
      console.log(`[Agent] Domain: ${currentDomain.name} (${currentDomain.id})`);
      console.log(`[Agent] Autonomy level: ${this.domainManager.getAutonomyLevel()}`);
      console.log(`[Agent] Tools available: ${domainTools.length}`);
    }
    
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: objective },
    ];

    let iterations = 0;
    let totalToolCalls = 0;
    const errors: string[] = [];
    let finalResponse = '';

    await auditEvent(ctx, 'AGENT_START', { 
      objective,
      domain: currentDomain.id,
      autonomyLevel: this.domainManager.getAutonomyLevel(),
    });

    while (iterations < this.config.maxIterations!) {
      iterations++;

      if (this.config.verbose) {
        console.log(`\n[Agent] Iteration ${iterations}...`);
      }

      try {
        // Get AI response
        const response = await this.router.complete({
          messages,
          tools: domainTools,
        }, ctx);

        // Add assistant message to history
        messages.push(response.message);

        // Check if we're done (no tool calls)
        if (response.finish_reason === 'stop' || !response.message.tool_calls?.length) {
          finalResponse = response.message.content;
          
          // Check if it's a completion report
          if (this.isCompletionMessage(response.message.content)) {
            await auditEvent(ctx, 'AGENT_COMPLETE', { 
              iterations, 
              toolCalls: totalToolCalls,
              response: finalResponse 
            });
            break;
          }
          
          // If no tool calls and not done, prompt to continue or complete
          if (iterations > 1) {
            messages.push({
              role: 'user',
              content: 'Have you completed the objective? If yes, provide a final summary. If not, continue working.',
            });
          }
          continue;
        }

        // Execute tool calls
        for (const toolCall of response.message.tool_calls) {
          if (totalToolCalls >= this.config.maxToolCalls!) {
            errors.push('Max tool calls reached');
            break;
          }
          totalToolCalls++;

          const toolName = toolCall.function.name;
          let args: Record<string, any>;
          
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            args = {};
          }

          if (this.config.verbose) {
            console.log(`[Tool] ${toolName}:`, JSON.stringify(args, null, 2));
          }

          // Execute the tool
          const result = await executeTool(ctx, toolName, args);

          if (this.config.verbose) {
            console.log(`[Result] ${result.success ? 'OK' : 'ERROR'}:`, 
              result.success ? JSON.stringify(result.output).slice(0, 200) : result.error);
          }

          // Add tool result to messages
          messages.push({
            role: 'tool',
            content: JSON.stringify(result.success ? result.output : { error: result.error }),
            tool_call_id: toolCall.id,
          });

          if (!result.success) {
            errors.push(`${toolName}: ${result.error}`);
          }
        }

      } catch (error: any) {
        const errorMsg = `Iteration ${iterations} error: ${error.message}`;
        errors.push(errorMsg);
        await auditEvent(ctx, 'AGENT_ERROR', { error: errorMsg });
        
        // Add error context to messages
        messages.push({
          role: 'user',
          content: `An error occurred: ${error.message}. Please analyze and try to recover or report the issue.`,
        });
      }
    }

    // Generate report
    await emitRunReport(ctx, iterations, iterations - errors.length, 0, 0, ctx.createdAt);

    return {
      success: errors.length === 0,
      finalResponse,
      iterations,
      toolCalls: totalToolCalls,
      errors,
      context: ctx,
    };
  }

  /**
   * Check if message indicates completion
   */
  private isCompletionMessage(content: string): boolean {
    const completionIndicators = [
      'task complete',
      'objective complete',
      'successfully completed',
      'all done',
      'finished',
      'completed successfully',
      'mission accomplished',
    ];
    
    const lowerContent = content.toLowerCase();
    return completionIndicators.some(indicator => lowerContent.includes(indicator));
  }

  /**
   * Interactive mode - single turn
   */
  async chat(ctx: RunContext, messages: Message[]): Promise<CompletionResponse> {
    return this.router.complete({
      messages: [
        { role: 'system', content: this.config.systemPrompt! },
        ...messages,
      ],
      tools: this.tools,
    }, ctx);
  }
}

/**
 * Create agent loop from environment
 */
export function createAgentLoop(config?: AgentConfig): AgentLoop {
  const router = createRouterFromEnv();
  return new AgentLoop(router, config);
}

/**
 * Quick run - create context and run objective
 */
export async function runObjective(objective: string, config?: AgentConfig & { useMCP?: boolean }): Promise<AgentResult> {
  const ctx: RunContext = {
    runId: `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    objective: { text: objective },
    createdAt: Date.now(),
  };

  const agent = createAgentLoop(config);
  
  // Initialize MCP if requested (default: true)
  if (config?.useMCP !== false) {
    await agent.initMCP();
  }
  
  return agent.run(ctx, objective);
}
