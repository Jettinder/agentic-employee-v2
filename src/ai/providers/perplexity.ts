/**
 * Perplexity Provider
 * Optimized for search and real-time information
 */

import type { ProviderClient, CompletionRequest, CompletionResponse, ProviderConfig, Message } from '../types.js';

export class PerplexityProvider implements ProviderClient {
  name = 'perplexity' as const;
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.perplexity.ai';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey && this.config.enabled !== false;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Perplexity models: sonar, sonar-pro, sonar-reasoning
    const model = request.model || this.config.defaultModel || 'sonar-pro';
    
    // Perplexity uses OpenAI-compatible API but doesn't support tools
    // For tool-calling tasks, we need to handle this differently
    const body: any = {
      model,
      messages: this.convertMessages(request.messages),
      temperature: request.temperature ?? 0.2, // Lower temp for factual queries
      max_tokens: request.max_tokens ?? 4096,
    };

    // If tools are requested, we need to instruct the model to output structured JSON
    if (request.tools && request.tools.length > 0) {
      // Add instruction for structured output
      const toolsDesc = request.tools.map(t => 
        `- ${t.name}: ${t.description}\n  Parameters: ${JSON.stringify(t.parameters.properties)}`
      ).join('\n');
      
      const systemIdx = body.messages.findIndex((m: any) => m.role === 'system');
      const toolInstructions = `\n\nYou have access to these tools:\n${toolsDesc}\n\nWhen you need to use a tool, respond with JSON: {"tool": "tool_name", "args": {...}}`;
      
      if (systemIdx >= 0) {
        body.messages[systemIdx].content += toolInstructions;
      } else {
        body.messages.unshift({ role: 'system', content: toolInstructions });
      }
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    let content = choice.message.content || '';
    
    // Try to parse tool calls from response if tools were requested
    let toolCalls: any[] | undefined;
    if (request.tools && request.tools.length > 0) {
      const parsed = this.parseToolCalls(content, request.tools);
      if (parsed) {
        toolCalls = parsed.toolCalls;
        content = parsed.remainingContent;
      }
    }

    return {
      id: data.id,
      provider: 'perplexity',
      model: data.model,
      message: {
        role: 'assistant',
        content,
        tool_calls: toolCalls,
      },
      usage: data.usage ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      } : undefined,
      finish_reason: toolCalls ? 'tool_calls' : 'stop',
    };
  }

  private convertMessages(messages: Message[]): any[] {
    return messages.filter(m => m.role !== 'tool').map(m => ({
      role: m.role === 'tool' ? 'user' : m.role,
      content: m.content,
    }));
  }

  private parseToolCalls(content: string, tools: any[]): { toolCalls: any[], remainingContent: string } | null {
    // Try to find JSON tool call in response
    const jsonMatch = content.match(/\{[\s\S]*"tool"[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.tool && tools.some(t => t.name === parsed.tool)) {
        return {
          toolCalls: [{
            id: `pplx_${Date.now()}`,
            type: 'function',
            function: {
              name: parsed.tool,
              arguments: JSON.stringify(parsed.args || {}),
            },
          }],
          remainingContent: content.replace(jsonMatch[0], '').trim(),
        };
      }
    } catch {
      // Not valid JSON
    }
    return null;
  }
}
