/**
 * Domain Manager
 * Manages domain selection, switching, and provides domain-specific context
 */

import type { DomainBrain, DomainId, DomainMemory, DomainSwitchEvent } from './types.js';
import { ALL_BRAINS, getBrain } from './brains/index.js';
import { auditEvent } from '../audit/logger.js';
import type { RunContext } from '../core/types.js';
import { promises as fs } from 'fs';
import { join } from 'path';

const DOMAIN_MEMORY_DIR = '.data/domains';

export class DomainManager {
  private currentDomain: DomainBrain;
  private domainMemory: Map<DomainId, DomainMemory> = new Map();
  private switchHistory: DomainSwitchEvent[] = [];
  
  constructor(initialDomain?: DomainId) {
    this.currentDomain = getBrain(initialDomain || 'general');
  }
  
  /**
   * Get current active domain
   */
  getCurrentDomain(): DomainBrain {
    return this.currentDomain;
  }
  
  /**
   * Get current domain ID
   */
  getCurrentDomainId(): DomainId {
    return this.currentDomain.id;
  }
  
  /**
   * Switch to a specific domain
   */
  async switchDomain(domainId: DomainId, reason: string, ctx?: RunContext): Promise<DomainBrain> {
    const previousDomain = this.currentDomain.id;
    this.currentDomain = getBrain(domainId);
    
    const switchEvent: DomainSwitchEvent = {
      from: previousDomain,
      to: domainId,
      reason,
      timestamp: Date.now(),
    };
    
    this.switchHistory.push(switchEvent);
    
    if (ctx) {
      await auditEvent(ctx, 'DOMAIN_SWITCH', {
        from: previousDomain,
        to: domainId,
        reason,
      });
    }
    
    console.log(`[Domain] Switched from ${previousDomain} to ${domainId}: ${reason}`);
    
    return this.currentDomain;
  }
  
  /**
   * Auto-detect the best domain for a given objective/message
   */
  detectDomain(text: string): { domain: DomainId; confidence: number; reason: string } {
    const lowerText = text.toLowerCase();
    const scores: Record<DomainId, number> = {
      general: 0,
      developer: 0,
      marketing: 0,
      sales: 0,
      operations: 0,
      finance: 0,
      hr: 0,
      support: 0,
    };
    
    // Score each domain based on keyword matches
    for (const [domainId, brain] of Object.entries(ALL_BRAINS)) {
      const keywords = brain.triggerKeywords || [];
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          scores[domainId as DomainId] += 1;
        }
      }
    }
    
    // Find the domain with highest score
    let bestDomain: DomainId = 'general';
    let bestScore = 0;
    
    for (const [domainId, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domainId as DomainId;
      }
    }
    
    // Calculate confidence (0-1)
    const totalKeywords = Object.values(ALL_BRAINS)
      .flatMap(b => b.triggerKeywords || []).length;
    const confidence = bestScore > 0 ? Math.min(bestScore / 5, 1) : 0.5;
    
    // If no matches or low confidence, default to general
    if (bestScore === 0) {
      return {
        domain: 'general',
        confidence: 0.5,
        reason: 'No specific domain keywords detected, using general',
      };
    }
    
    return {
      domain: bestDomain,
      confidence,
      reason: `Detected ${bestScore} keywords matching ${bestDomain} domain`,
    };
  }
  
  /**
   * Auto-switch domain based on objective
   */
  async autoSwitchDomain(objective: string, ctx?: RunContext): Promise<DomainBrain> {
    const detection = this.detectDomain(objective);
    
    if (detection.domain !== this.currentDomain.id && detection.confidence > 0.3) {
      return this.switchDomain(detection.domain, detection.reason, ctx);
    }
    
    return this.currentDomain;
  }
  
  /**
   * Get the system prompt for current domain
   */
  getSystemPrompt(): string {
    const brain = this.currentDomain;
    
    let prompt = `# Domain: ${brain.name}\n\n`;
    prompt += brain.systemPrompt;
    
    // Add knowledge section if available
    if (brain.knowledge) {
      prompt += `\n\n# Domain Knowledge\n${brain.knowledge}`;
    }
    
    // Add rules section
    if (brain.rules && brain.rules.length > 0) {
      prompt += '\n\n# Rules & Policies\n';
      for (const rule of brain.rules) {
        const prefix = rule.type === 'must' ? '✅ MUST' :
                      rule.type === 'must_not' ? '❌ MUST NOT' :
                      rule.type === 'should' ? '👍 SHOULD' : '⚠️ SHOULD NOT';
        prompt += `\n${prefix}: ${rule.rule}`;
      }
    }
    
    // Add autonomy note
    if (brain.autonomyLevel !== undefined) {
      const level = brain.autonomyLevel;
      if (level < 0.5) {
        prompt += '\n\n⚠️ **Low Autonomy Mode**: Request approval for significant actions.';
      } else if (level < 0.8) {
        prompt += '\n\n📋 **Medium Autonomy Mode**: Proceed with routine tasks, confirm major decisions.';
      } else {
        prompt += '\n\n🚀 **High Autonomy Mode**: Execute tasks independently, report results.';
      }
    }
    
    return prompt;
  }
  
  /**
   * Get tools filtered for current domain
   */
  filterToolsForDomain(allTools: any[]): any[] {
    const brain = this.currentDomain;
    
    let filtered = allTools;
    
    // Remove restricted tools
    if (brain.restrictedTools && brain.restrictedTools.length > 0) {
      filtered = filtered.filter(t => !brain.restrictedTools!.includes(t.name));
    }
    
    // Add domain-specific tools
    if (brain.domainTools && brain.domainTools.length > 0) {
      filtered = [...filtered, ...brain.domainTools];
    }
    
    return filtered;
  }
  
  /**
   * Get preferred model for current domain
   */
  getPreferredModel(): string | undefined {
    return this.currentDomain.preferredModel;
  }
  
  /**
   * Get autonomy level for current domain
   */
  getAutonomyLevel(): number {
    return this.currentDomain.autonomyLevel ?? 0.7;
  }
  
  /**
   * Load domain memory from disk
   */
  async loadDomainMemory(domainId: DomainId): Promise<DomainMemory> {
    if (this.domainMemory.has(domainId)) {
      return this.domainMemory.get(domainId)!;
    }
    
    const filePath = join(DOMAIN_MEMORY_DIR, `${domainId}.json`);
    
    try {
      await fs.mkdir(DOMAIN_MEMORY_DIR, { recursive: true });
      const data = await fs.readFile(filePath, 'utf-8');
      const memory = JSON.parse(data) as DomainMemory;
      this.domainMemory.set(domainId, memory);
      return memory;
    } catch {
      // Create new memory for this domain
      const memory: DomainMemory = {
        domainId,
        data: {},
        lessons: [],
        lastActive: Date.now(),
      };
      this.domainMemory.set(domainId, memory);
      return memory;
    }
  }
  
  /**
   * Save domain memory to disk
   */
  async saveDomainMemory(domainId: DomainId): Promise<void> {
    const memory = this.domainMemory.get(domainId);
    if (!memory) return;
    
    memory.lastActive = Date.now();
    
    const filePath = join(DOMAIN_MEMORY_DIR, `${domainId}.json`);
    await fs.mkdir(DOMAIN_MEMORY_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(memory, null, 2));
  }
  
  /**
   * Add a lesson learned to current domain
   */
  async addLesson(lesson: string): Promise<void> {
    const memory = await this.loadDomainMemory(this.currentDomain.id);
    if (!memory.lessons) memory.lessons = [];
    memory.lessons.push(lesson);
    await this.saveDomainMemory(this.currentDomain.id);
  }
  
  /**
   * Get switch history
   */
  getSwitchHistory(): DomainSwitchEvent[] {
    return this.switchHistory;
  }
  
  /**
   * List all available domains
   */
  listDomains(): Array<{ id: DomainId; name: string; description: string; active: boolean }> {
    return Object.values(ALL_BRAINS).map(brain => ({
      id: brain.id,
      name: brain.name,
      description: brain.description,
      active: brain.id === this.currentDomain.id,
    }));
  }
}

// Singleton instance
let domainManager: DomainManager | null = null;

export function getDomainManager(): DomainManager {
  if (!domainManager) {
    domainManager = new DomainManager();
  }
  return domainManager;
}

export function createDomainManager(initialDomain?: DomainId): DomainManager {
  domainManager = new DomainManager(initialDomain);
  return domainManager;
}
