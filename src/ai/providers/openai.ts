/**
 * OpenAI Provider
 */

import type { ProviderClient, CompletionRequest, CompletionResponse, ProviderConfig, Message, ToolDefinition } from '../types.js';

export class OpenAIProvider implements ProviderClient {
  name = 'openai' as const;
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.openai.com/v1';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey && this.config.enabled !== false;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const model = request.model || this.config.defaultModel || 'gpt-4-turbo-preview';
    
    const body: any = {
      model,
      messages: this.convertMessages(request.messages),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.max_tokens ?? 4096,
    };

    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      body.tool_choice = 'auto';
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
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices[0];
    const msg = choice.message;

    return {
      id: data.id,
      provider: 'openai',
      model: data.model,
      message: {
        role: 'assistant',
        content: msg.content || '',
        tool_calls: msg.tool_calls?.map((tc: any) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      },
      usage: data.usage ? {
        prompt_tokens: data.usage.prompt_tokens,
        completion_tokens: data.usage.completion_tokens,
        total_tokens: data.usage.total_tokens,
      } : undefined,
      finish_reason: choice.finish_reason === 'tool_calls' ? 'tool_calls' : 
                     choice.finish_reason === 'length' ? 'length' : 'stop',
    };
  }

  private convertMessages(messages: Message[]): any[] {
    return messages.map(m => {
      const msg: any = { role: m.role, content: m.content };
      if (m.name) msg.name = m.name;
      if (m.tool_call_id) msg.tool_call_id = m.tool_call_id;
      if (m.tool_calls) msg.tool_calls = m.tool_calls;
      return msg;
    });
  }
}
