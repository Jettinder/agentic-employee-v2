/**
 * Intelligent AI Router
 * Selects the best provider for each task
 */

import type { 
  ProviderName, 
  ProviderClient, 
  CompletionRequest, 
  CompletionResponse, 
  AIConfig, 
  TaskType,
  RoutingRule 
} from './types.js';
import { OpenAIProvider } from './providers/openai.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { PerplexityProvider } from './providers/perplexity.js';
import { GeminiProvider } from './providers/gemini.js';
import { CLIProvider, detectCLITools, createCLIProvider, type CLITool } from './providers/cli.js';
import { auditEvent } from '../audit/logger.js';
import type { RunContext } from '../core/types.js';

// Default routing rules - Uses configured default provider
const DEFAULT_ROUTING_RULES: RoutingRule[] = [
  {
    match: { taskType: 'search', keywords: ['search', 'find', 'lookup', 'current', 'latest', 'news', 'today'] },
    provider: 'perplexity',
    model: process.env.PERPLEXITY_MODEL || 'sonar-pro',
    reason: 'Real-time search and current information',
  },
  {
    match: { taskType: 'coding', keywords: ['code', 'function', 'bug', 'debug', 'implement', 'refactor', 'typescript', 'python'] },
    provider: (process.env.DEFAULT_AI_PROVIDER as any) || 'anthropic',
    model: process.env.ANTHROPIC_MODEL || process.env.OPENAI_MODEL || 'claude-sonnet-4-20250514',
    reason: 'Superior coding capabilities',
  },
  {
    match: { taskType: 'analysis', keywords: ['analyze', 'explain', 'compare', 'review', 'understand'] },
    provider: (process.env.DEFAULT_AI_PROVIDER as any) || 'anthropic',
    model: process.env.ANTHROPIC_MODEL || process.env.OPENAI_MODEL || 'claude-sonnet-4-20250514',
    reason: 'Deep reasoning and analysis',
  },
  {
    match: { taskType: 'planning', keywords: ['plan', 'steps', 'how to', 'strategy', 'approach'] },
    provider: (process.env.DEFAULT_AI_PROVIDER as any) || 'anthropic',
    model: process.env.ANTHROPIC_MODEL || process.env.OPENAI_MODEL || 'claude-sonnet-4-20250514',
    reason: 'Strong planning and decomposition',
  },
  {
    match: { taskType: 'vision' },
    provider: 'openai',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    reason: 'Vision capabilities',
  },
  {
    match: { taskType: 'execution', toolRequired: ['filesystem', 'terminal', 'editor', 'computer'] },
    provider: (process.env.DEFAULT_AI_PROVIDER as any) || 'anthropic',
    model: process.env.ANTHROPIC_MODEL || process.env.OPENAI_MODEL || 'claude-sonnet-4-20250514',
    reason: 'Reliable tool execution',
  },
];

export class AIRouter {
  private providers: Map<ProviderName, ProviderClient> = new Map();
  private config: AIConfig;
  private defaultProvider: ProviderName = 'anthropic';

  constructor(config: AIConfig) {
    this.config = config;
    this.initProviders();
    
    if (config.routing?.default) {
      this.defaultProvider = config.routing.default;
    }
  }

  private initProviders() {
    if (this.config.openai?.apiKey) {
      this.providers.set('openai', new OpenAIProvider(this.config.openai));
    }
    if (this.config.anthropic?.apiKey) {
      this.providers.set('anthropic', new AnthropicProvider(this.config.anthropic));
    }
    if (this.config.perplexity?.apiKey) {
      this.providers.set('perplexity', new PerplexityProvider(this.config.perplexity));
    }
    if (this.config.gemini?.apiKey) {
      this.providers.set('gemini', new GeminiProvider(this.config.gemini));
    }
    
    // Add CLI tools as fallback providers
    const cliTools = detectCLITools();
    for (const tool of cliTools) {
      const cliProvider = createCLIProvider(tool);
      if (cliProvider.isAvailable()) {
        this.providers.set(`cli-${tool}` as any, cliProvider as any);
      }
    }
  }

  /**
   * Get available providers
   */
  getAvailableProviders(): ProviderName[] {
    return Array.from(this.providers.entries())
      .filter(([_, client]) => client.isAvailable())
      .map(([name]) => name);
  }

  /**
   * Detect task type from request
   */
  detectTaskType(request: CompletionRequest): TaskType {
    const lastUserMsg = [...request.messages].reverse().find(m => m.role === 'user');
    const content = lastUserMsg?.content.toLowerCase() || '';
    
    // Search indicators
    if (content.match(/search|find|lookup|current|latest|news|today|what is|who is/)) {
      return 'search';
    }
    
    // Coding indicators
    if (content.match(/code|function|class|bug|debug|implement|refactor|fix|error|compile|syntax/)) {
      return 'coding';
    }
    
    // Analysis indicators
    if (content.match(/analyze|explain|compare|review|understand|why|how does/)) {
      return 'analysis';
    }
    
    // Planning indicators
    if (content.match(/plan|steps|how to|strategy|approach|breakdown|decompose/)) {
      return 'planning';
    }
    
    // Vision indicators (check for image URLs or base64)
    if (content.match(/image|picture|photo|screenshot|look at this/)) {
      return 'vision';
    }
    
    // Tool execution
    if (request.tools && request.tools.length > 0) {
      return 'execution';
    }
    
    return 'conversation';
  }

  /**
   * Select the best provider for a request
   */
  selectProvider(request: CompletionRequest, forceProvider?: ProviderName): { provider: ProviderName; model?: string; reason: string } {
    // If forced, use that provider
    if (forceProvider && this.providers.get(forceProvider)?.isAvailable()) {
      return { provider: forceProvider, reason: 'Explicitly requested' };
    }

    const taskType = this.detectTaskType(request);
    const lastUserMsg = [...request.messages].reverse().find(m => m.role === 'user');
    const content = lastUserMsg?.content.toLowerCase() || '';

    // Check routing rules
    const rules = [...(this.config.routing?.rules || []), ...DEFAULT_ROUTING_RULES];
    
    for (const rule of rules) {
      // Check task type match
      if (rule.match.taskType) {
        const types = Array.isArray(rule.match.taskType) ? rule.match.taskType : [rule.match.taskType];
        if (!types.includes(taskType)) continue;
      }

      // Check keyword match
      if (rule.match.keywords) {
        const hasKeyword = rule.match.keywords.some(kw => content.includes(kw.toLowerCase()));
        if (!hasKeyword && rule.match.taskType === undefined) continue;
      }

      // Check tool requirements
      if (rule.match.toolRequired && request.tools) {
        const toolNames = request.tools.map(t => t.name);
        const hasRequiredTool = rule.match.toolRequired.some(t => toolNames.includes(t));
        if (!hasRequiredTool) continue;
      }

      // Check if provider is available
      if (this.providers.get(rule.provider)?.isAvailable()) {
        return {
          provider: rule.provider,
          model: rule.model,
          reason: rule.reason || `Matched rule for ${taskType}`,
        };
      }
    }

    // Fallback to default or first available
    if (this.providers.get(this.defaultProvider)?.isAvailable()) {
      return { provider: this.defaultProvider, reason: 'Default provider' };
    }

    const available = this.getAvailableProviders();
    if (available.length > 0) {
      return { provider: available[0], reason: 'First available provider' };
    }

    throw new Error('No AI providers available');
  }

  /**
   * Route and complete a request with automatic fallback
   */
  async complete(
    request: CompletionRequest, 
    ctx?: RunContext,
    options?: { forceProvider?: ProviderName }
  ): Promise<CompletionResponse> {
    const selection = this.selectProvider(request, options?.forceProvider);
    const availableProviders = this.getAvailableProviders();
    
    // Build fallback chain: selected provider first, then others
    const providerChain = [selection.provider, ...availableProviders.filter(p => p !== selection.provider)];
    
    let lastError: Error | null = null;
    
    for (const providerName of providerChain) {
      const provider = this.providers.get(providerName);
      if (!provider?.isAvailable()) continue;
      
      // Get model for this provider
      const model = providerName === selection.provider 
        ? selection.model 
        : undefined; // Use provider's default
      
      const finalRequest = model 
        ? { ...request, model }
        : request;

      if (ctx) {
        await auditEvent(ctx, 'AI_REQUEST', {
          provider: providerName,
          model: finalRequest.model,
          reason: providerName === selection.provider ? selection.reason : 'Fallback provider',
          taskType: this.detectTaskType(request),
          messageCount: request.messages.length,
          toolCount: request.tools?.length || 0,
        });
      }

      try {
        const startTime = Date.now();
        const response = await provider.complete(finalRequest);
        const duration = Date.now() - startTime;

        if (ctx) {
          await auditEvent(ctx, 'AI_RESPONSE', {
            provider: providerName,
            model: response.model,
            durationMs: duration,
            usage: response.usage,
            finishReason: response.finish_reason,
            hasToolCalls: !!response.message.tool_calls?.length,
          });
        }

        return response;
      } catch (error: any) {
        lastError = error;
        console.warn(`[Router] Provider ${providerName} failed: ${error.message}, trying next...`);
        continue;
      }
    }
    
    // All providers failed
    throw lastError || new Error('All AI providers failed');
  }

  /**
   * Get a specific provider
   */
  getProvider(name: ProviderName): ProviderClient | undefined {
    return this.providers.get(name);
  }
}

/**
 * Create router from environment variables
 */
export function createRouterFromEnv(): AIRouter {
  const config: AIConfig = {
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      defaultModel: process.env.OPENAI_MODEL || 'gpt-4o',
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      defaultModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    },
    perplexity: {
      apiKey: process.env.PERPLEXITY_API_KEY || '',
      defaultModel: process.env.PERPLEXITY_MODEL || 'sonar-pro',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || '',
      defaultModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp',
    },
    routing: {
      default: (process.env.DEFAULT_AI_PROVIDER as ProviderName) || 'anthropic',
    },
  };

  return new AIRouter(config);
}
