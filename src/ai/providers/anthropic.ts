/**
 * Anthropic Provider (Claude)
 */

import type { ProviderClient, CompletionRequest, CompletionResponse, ProviderConfig, Message, ToolDefinition } from '../types.js';

export class AnthropicProvider implements ProviderClient {
  name = 'anthropic' as const;
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey && this.config.enabled !== false;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model || this.config.defaultModel || 'claude-sonnet-4-20250514';
    
    // Extract system message
    const systemMsg = request.messages.find(m => m.role === 'system');
    const otherMessages = request.messages.filter(m => m.role !== 'system');

    const body: any = {
      model,
      max_tokens: request.max_tokens ?? 4096,
      messages: this.convertMessages(otherMessages),
    };

    if (systemMsg) {
      body.system = systemMsg.content;
    }

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));
    }

    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    // Parse response - Claude returns content as array of blocks
    let content = '';
    const toolCalls: any[] = [];
    
    for (const block of data.content) {
      if (block.type === 'text') {
        content += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        });
      }
    }

    return {
      id: data.id,
      provider: 'anthropic',
      model: data.model,
      message: {
        role: 'assistant',
        content,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      usage: data.usage ? {
        prompt_tokens: data.usage.input_tokens,
        completion_tokens: data.usage.output_tokens,
        total_tokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
      finish_reason: data.stop_reason === 'tool_use' ? 'tool_calls' : 
                     data.stop_reason === 'max_tokens' ? 'length' : 'stop',
    };
  }

  private convertMessages(messages: Message[]): any[] {
    return messages.map(m => {
      if (m.role === 'tool') {
        // Convert tool result to Claude format
        return {
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: m.tool_call_id,
            content: m.content,
          }],
        };
      }
      
      if (m.tool_calls && m.tool_calls.length > 0) {
        // Convert assistant message with tool calls
        const content: any[] = [];
        if (m.content) {
          content.push({ type: 'text', text: m.content });
        }
        for (const tc of m.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
          });
        }
        return { role: 'assistant', content };
      }

      return { role: m.role, content: m.content };
    });
  }
}
