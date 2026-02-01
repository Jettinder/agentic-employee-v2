/**
 * Memory Module
 * Persistent storage for agent context and learning
 */

import { promises as fs } from 'fs';
import { join } from 'path';

export interface MemoryEntry {
  key: string;
  value: any;
  tags?: string[];
  timestamp: number;
  accessCount?: number;
  lastAccessed?: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface Memory {
  entries: Record<string, MemoryEntry>;
  conversations: Record<string, ConversationTurn[]>;
  metadata: {
    created: number;
    lastModified: number;
    version: string;
  };
}

export class MemoryStore {
  private dataDir: string;
  private memory: Memory;
  private loaded: boolean = false;

  constructor(dataDir: string = '.data/memory') {
    this.dataDir = dataDir;
    this.memory = this.createEmptyMemory();
  }

  private createEmptyMemory(): Memory {
    return {
      entries: {},
      conversations: {},
      metadata: {
        created: Date.now(),
        lastModified: Date.now(),
        version: '1.0.0',
      },
    };
  }

  /**
   * Load memory from disk
   */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const data = await fs.readFile(this.getStorePath(), 'utf-8');
      this.memory = JSON.parse(data);
      this.loaded = true;
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading memory:', error);
      }
      this.memory = this.createEmptyMemory();
      this.loaded = true;
    }
  }

  /**
   * Save memory to disk
   */
  async save(): Promise<void> {
    this.memory.metadata.lastModified = Date.now();
    await fs.mkdir(this.dataDir, { recursive: true });
    await fs.writeFile(
      this.getStorePath(),
      JSON.stringify(this.memory, null, 2)
    );
  }

  private getStorePath(): string {
    return join(this.dataDir, 'store.json');
  }

  /**
   * Store a value
   */
  async store(key: string, value: any, tags?: string[]): Promise<void> {
    await this.load();
    this.memory.entries[key] = {
      key,
      value,
      tags,
      timestamp: Date.now(),
      accessCount: 0,
    };
    await this.save();
  }

  /**
   * Retrieve a value
   */
  async retrieve(key: string): Promise<MemoryEntry | null> {
    await this.load();
    const entry = this.memory.entries[key];
    if (entry) {
      entry.accessCount = (entry.accessCount || 0) + 1;
      entry.lastAccessed = Date.now();
      await this.save();
    }
    return entry || null;
  }

  /**
   * Search entries by tags or content
   */
  async search(query: string, options?: { tags?: string[]; limit?: number }): Promise<MemoryEntry[]> {
    await this.load();
    
    const queryLower = query.toLowerCase();
    const results: MemoryEntry[] = [];

    for (const entry of Object.values(this.memory.entries)) {
      // Check key match
      if (entry.key.toLowerCase().includes(queryLower)) {
        results.push(entry);
        continue;
      }

      // Check value match (for strings)
      if (typeof entry.value === 'string' && entry.value.toLowerCase().includes(queryLower)) {
        results.push(entry);
        continue;
      }

      // Check tags match
      if (entry.tags?.some(t => t.toLowerCase().includes(queryLower))) {
        results.push(entry);
        continue;
      }

      // Check tag filter
      if (options?.tags && entry.tags) {
        if (options.tags.some(t => entry.tags!.includes(t))) {
          results.push(entry);
        }
      }
    }

    // Sort by recency and access count
    results.sort((a, b) => {
      const scoreA = (a.accessCount || 0) * 0.3 + (a.timestamp / 1e12);
      const scoreB = (b.accessCount || 0) * 0.3 + (b.timestamp / 1e12);
      return scoreB - scoreA;
    });

    return options?.limit ? results.slice(0, options.limit) : results;
  }

  /**
   * Delete an entry
   */
  async delete(key: string): Promise<boolean> {
    await this.load();
    if (this.memory.entries[key]) {
      delete this.memory.entries[key];
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * List all keys
   */
  async list(): Promise<string[]> {
    await this.load();
    return Object.keys(this.memory.entries);
  }

  /**
   * Store conversation history
   */
  async storeConversation(sessionId: string, turns: ConversationTurn[]): Promise<void> {
    await this.load();
    this.memory.conversations[sessionId] = turns;
    await this.save();
  }

  /**
   * Get conversation history
   */
  async getConversation(sessionId: string): Promise<ConversationTurn[]> {
    await this.load();
    return this.memory.conversations[sessionId] || [];
  }

  /**
   * Append to conversation
   */
  async appendConversation(sessionId: string, turn: ConversationTurn): Promise<void> {
    await this.load();
    if (!this.memory.conversations[sessionId]) {
      this.memory.conversations[sessionId] = [];
    }
    this.memory.conversations[sessionId].push(turn);
    await this.save();
  }

  /**
   * Clear all memory (dangerous!)
   */
  async clear(): Promise<void> {
    this.memory = this.createEmptyMemory();
    await this.save();
  }

  /**
   * Export memory for backup
   */
  async export(): Promise<Memory> {
    await this.load();
    return JSON.parse(JSON.stringify(this.memory));
  }

  /**
   * Import memory from backup
   */
  async import(data: Memory): Promise<void> {
    this.memory = data;
    this.loaded = true;
    await this.save();
  }

  /**
   * Get statistics
   */
  async stats(): Promise<{
    entryCount: number;
    conversationCount: number;
    totalTurns: number;
    created: Date;
    lastModified: Date;
  }> {
    await this.load();
    
    const totalTurns = Object.values(this.memory.conversations)
      .reduce((sum, turns) => sum + turns.length, 0);

    return {
      entryCount: Object.keys(this.memory.entries).length,
      conversationCount: Object.keys(this.memory.conversations).length,
      totalTurns,
      created: new Date(this.memory.metadata.created),
      lastModified: new Date(this.memory.metadata.lastModified),
    };
  }
}

// Singleton instance
let defaultStore: MemoryStore | null = null;

export function getMemoryStore(dataDir?: string): MemoryStore {
  if (!defaultStore || dataDir) {
    defaultStore = new MemoryStore(dataDir);
  }
  return defaultStore;
}
