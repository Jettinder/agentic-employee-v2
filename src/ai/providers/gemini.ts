/**
 * Google Gemini Provider
 */

import type { ProviderClient, CompletionRequest, CompletionResponse, ProviderConfig, Message } from '../types.js';

export class GeminiProvider implements ProviderClient {
  name = 'gemini' as const;
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  isAvailable(): boolean {
    return !!this.config.apiKey && this.config.enabled !== false;
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    // Latest Gemini model
    const model = request.model || this.config.defaultModel || 'gemini-2.0-flash-exp';
    
    const body: any = {
      contents: this.convertMessages(request.messages),
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.max_tokens ?? 8192,
      },
    };

    // Add tools if provided
    if (request.tools && request.tools.length > 0) {
      body.tools = [{
        functionDeclarations: request.tools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: this.cleanSchemaForGemini(t.parameters),
        })),
      }];
    }

    // Extract system instruction
    const systemMsg = request.messages.find(m => m.role === 'system');
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    // Handle blocked responses
    if (data.promptFeedback?.blockReason) {
      throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      throw new Error('No response from Gemini');
    }

    // Parse response content
    let content = '';
    const toolCalls: any[] = [];

    for (const part of candidate.content?.parts || []) {
      if (part.text) {
        content += part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          id: `gemini_${Date.now()}_${toolCalls.length}`,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        });
      }
    }

    // Determine finish reason
    let finishReason: 'stop' | 'tool_calls' | 'length' | 'error' = 'stop';
    if (toolCalls.length > 0) {
      finishReason = 'tool_calls';
    } else if (candidate.finishReason === 'MAX_TOKENS') {
      finishReason = 'length';
    } else if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
      finishReason = 'error';
    }

    return {
      id: `gemini-${Date.now()}`,
      provider: 'gemini',
      model,
      message: {
        role: 'assistant',
        content,
        tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      },
      usage: data.usageMetadata ? {
        prompt_tokens: data.usageMetadata.promptTokenCount || 0,
        completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
        total_tokens: data.usageMetadata.totalTokenCount || 0,
      } : undefined,
      finish_reason: finishReason,
    };
  }

  private convertMessages(messages: Message[]): any[] {
    const contents: any[] = [];
    
    for (const m of messages) {
      // Skip system messages (handled separately)
      if (m.role === 'system') continue;

      if (m.role === 'tool') {
        // Tool results in Gemini format
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: m.name || 'tool',
              response: { result: m.content },
            },
          }],
        });
      } else if (m.role === 'assistant' && m.tool_calls?.length) {
        // Assistant message with function calls
        const parts: any[] = [];
        if (m.content) {
          parts.push({ text: m.content });
        }
        for (const tc of m.tool_calls) {
          parts.push({
            functionCall: {
              name: tc.function.name,
              args: JSON.parse(tc.function.arguments),
            },
          });
        }
        contents.push({ role: 'model', parts });
      } else {
        // Regular message
        contents.push({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        });
      }
    }

    return contents;
  }

  /**
   * Clean schema for Gemini compatibility
   * Gemini doesn't support some JSON Schema features
   */
  private cleanSchemaForGemini(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;

    const cleaned: any = {};
    
    for (const [key, value] of Object.entries(schema)) {
      // Skip unsupported keywords
      if (['$schema', 'additionalProperties', 'default', 'examples', 'title'].includes(key)) {
        continue;
      }

      if (key === 'properties' && typeof value === 'object') {
        cleaned.properties = {};
        for (const [propKey, propValue] of Object.entries(value as object)) {
          cleaned.properties[propKey] = this.cleanSchemaForGemini(propValue);
        }
      } else if (key === 'items' && typeof value === 'object') {
        cleaned.items = this.cleanSchemaForGemini(value);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        cleaned[key] = this.cleanSchemaForGemini(value);
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }
}
