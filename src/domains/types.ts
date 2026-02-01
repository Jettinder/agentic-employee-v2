/**
 * Domain Brain System - Types
 * Each domain is a specialized "brain" with its own knowledge, rules, and tools
 */

import type { ToolDefinition } from '../ai/types.js';

/**
 * Domain identifier
 */
export type DomainId = 
  | 'general'
  | 'developer'
  | 'marketing'
  | 'sales'
  | 'operations'
  | 'finance'
  | 'hr'
  | 'support';

/**
 * Domain Brain Configuration
 */
export interface DomainBrain {
  /** Unique domain identifier */
  id: DomainId;
  
  /** Human-readable name */
  name: string;
  
  /** Short description */
  description: string;
  
  /** Specialized system prompt for this domain */
  systemPrompt: string;
  
  /** Domain-specific knowledge/context to inject */
  knowledge?: string;
  
  /** Tools this domain prefers/specializes in */
  preferredTools?: string[];
  
  /** Tools this domain should NOT use */
  restrictedTools?: string[];
  
  /** Additional tools specific to this domain */
  domainTools?: ToolDefinition[];
  
  /** Rules and policies for this domain */
  rules: DomainRule[];
  
  /** Success metrics for this domain */
  metrics?: DomainMetric[];
  
  /** Keywords that trigger this domain */
  triggerKeywords?: string[];
  
  /** AI model preference for this domain */
  preferredModel?: string;
  
  /** Autonomy level (0-1, where 1 is fully autonomous) */
  autonomyLevel?: number;
}

/**
 * Domain-specific rule/policy
 */
export interface DomainRule {
  /** Rule identifier */
  id: string;
  
  /** Rule description */
  description: string;
  
  /** Rule type */
  type: 'must' | 'must_not' | 'should' | 'should_not';
  
  /** The actual rule/constraint */
  rule: string;
  
  /** Severity if violated */
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Domain success metric
 */
export interface DomainMetric {
  /** Metric name */
  name: string;
  
  /** How to measure it */
  measurement: string;
  
  /** Target value/description */
  target?: string;
}

/**
 * Domain memory - isolated per domain
 */
export interface DomainMemory {
  /** Domain this memory belongs to */
  domainId: DomainId;
  
  /** Key-value storage */
  data: Record<string, any>;
  
  /** Conversation history for this domain */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  
  /** Lessons learned in this domain */
  lessons?: string[];
  
  /** Last active timestamp */
  lastActive: number;
}

/**
 * Domain switch event
 */
export interface DomainSwitchEvent {
  from: DomainId | null;
  to: DomainId;
  reason: string;
  timestamp: number;
}
