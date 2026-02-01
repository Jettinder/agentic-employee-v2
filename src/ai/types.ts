/**
 * AI Provider Types
 * Unified interfaces for multi-provider AI support
 */

export type ProviderName = 'openai' | 'anthropic' | 'perplexity' | 'gemini';

export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface CompletionRequest {
  messages: Message[];
  tools?: ToolDefinition[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

export interface CompletionResponse {
  id: string;
  provider: ProviderName;
  model: string;
  message: Message;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'error';
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  enabled?: boolean;
}

export interface AIConfig {
  openai?: ProviderConfig;
  anthropic?: ProviderConfig;
  perplexity?: ProviderConfig;
  gemini?: ProviderConfig;
  routing?: {
    default: ProviderName;
    rules?: RoutingRule[];
  };
}

export interface RoutingRule {
  match: {
    taskType?: TaskType | TaskType[];
    keywords?: string[];
    toolRequired?: string[];
  };
  provider: ProviderName;
  model?: string;
  reason?: string;
}

export type TaskType = 
  | 'search'           // Web search, current info
  | 'coding'           // Code generation, review, debugging
  | 'analysis'         // Complex reasoning, document analysis
  | 'planning'         // Task planning, decomposition
  | 'execution'        // Tool execution, actions
  | 'conversation'     // General chat
  | 'vision'           // Image understanding
  | 'summarization';   // Summarizing content

export interface ProviderClient {
  name: ProviderName;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  completeStream?(request: CompletionRequest): AsyncIterable<CompletionResponse>;
  isAvailable(): boolean;
}
