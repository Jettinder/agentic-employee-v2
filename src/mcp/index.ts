/**
 * MCP (Model Context Protocol) Integration
 * Connects to external MCP servers for extended capabilities
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import type { ToolDefinition } from '../ai/types.js';
import * as journal from '../journal/index.js';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled?: boolean;
}

export interface MCPManager {
  clients: Map<string, Client>;
  tools: Map<string, { server: string; tool: any }>;
}

// Default MCP servers configuration
export const DEFAULT_MCP_SERVERS: MCPServerConfig[] = [
  {
    name: 'context7',
    command: 'npx',
    args: ['-y', '@upstash/context7-mcp@latest'],
    enabled: true,
  },
  {
    name: 'github',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN || '' },
    enabled: !!process.env.GITHUB_TOKEN,
  },
  {
    name: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/home'],
    enabled: true,
  },
  {
    name: 'brave-search',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY || '' },
    enabled: !!process.env.BRAVE_API_KEY,
  },
  {
    name: 'puppeteer',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    enabled: true,
  },
  {
    name: 'memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    enabled: true,
  },
];

/**
 * MCP Client Manager - handles connections to MCP servers
 */
export class MCPClientManager {
  private clients: Map<string, Client> = new Map();
  private tools: Map<string, { server: string; tool: any }> = new Map();
  private serverConfigs: MCPServerConfig[];

  constructor(servers?: MCPServerConfig[]) {
    this.serverConfigs = servers || DEFAULT_MCP_SERVERS;
  }

  /**
   * Connect to all enabled MCP servers
   */
  async connectAll(): Promise<void> {
    const enabledServers = this.serverConfigs.filter(s => s.enabled !== false);
    
    console.log(`[MCP] Connecting to ${enabledServers.length} servers...`);
    
    for (const server of enabledServers) {
      try {
        await this.connect(server);
        console.log(`[MCP] Connected to ${server.name}`);
      } catch (error: any) {
        console.warn(`[MCP] Failed to connect to ${server.name}: ${error.message}`);
      }
    }
  }

  /**
   * Connect to a single MCP server
   */
  async connect(config: MCPServerConfig): Promise<Client> {
    const client = new Client({
      name: `agentic-employee-${config.name}`,
      version: '1.0.0',
    }, {
      capabilities: {},
    });

    // Build clean env without undefined values
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries({ ...process.env, ...config.env })) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env,
    });

    await client.connect(transport);
    this.clients.set(config.name, client);

    // Discover and register tools from this server
    await this.discoverTools(config.name, client);

    return client;
  }

  /**
   * Discover tools from connected server
   */
  private async discoverTools(serverName: string, client: Client): Promise<void> {
    try {
      const toolsResult = await client.listTools();
      
      for (const tool of toolsResult.tools) {
        const toolId = `${serverName}__${tool.name}`;
        this.tools.set(toolId, { server: serverName, tool });
        console.log(`[MCP] Registered tool: ${toolId}`);
      }
    } catch (error: any) {
      console.warn(`[MCP] Could not list tools from ${serverName}: ${error.message}`);
    }
  }

  /**
   * Get all available tools as ToolDefinitions for the AI
   */
  getAllTools(): ToolDefinition[] {
    const definitions: ToolDefinition[] = [];

    for (const [toolId, { tool }] of this.tools) {
      definitions.push({
        name: toolId,
        description: tool.description || `MCP tool: ${tool.name}`,
        parameters: tool.inputSchema || { type: 'object', properties: {} },
      });
    }

    return definitions;
  }

  /**
   * Execute an MCP tool (with journal tracking for filesystem operations)
   */
  async executeTool(toolId: string, args: Record<string, any>, runId?: string): Promise<any> {
    const toolInfo = this.tools.get(toolId);
    if (!toolInfo) {
      throw new Error(`Unknown MCP tool: ${toolId}`);
    }

    const client = this.clients.get(toolInfo.server);
    if (!client) {
      throw new Error(`MCP server not connected: ${toolInfo.server}`);
    }

    // Journal tracking for filesystem operations
    const journalRunId = runId || this.currentRunId;
    if (journalRunId && toolInfo.server === 'filesystem') {
      await this.journalFilesystemOp(journalRunId, toolInfo.tool.name, args);
    }

    const result = await client.callTool({
      name: toolInfo.tool.name,
      arguments: args,
    });

    return result;
  }

  // Current run ID for journal tracking
  private currentRunId: string | null = null;
  
  setRunId(runId: string): void {
    this.currentRunId = runId;
  }

  /**
   * Journal filesystem operations from MCP
   */
  private async journalFilesystemOp(runId: string, toolName: string, args: Record<string, any>): Promise<void> {
    try {
      const filePath = args.path as string;
      
      switch (toolName) {
        case 'write_file': {
          // Check if file exists
          const fileExists = existsSync(filePath);
          let originalContent: string | null = null;
          if (fileExists) {
            try {
              originalContent = await readFile(filePath, 'utf-8');
            } catch {}
          }
          
          // Defer journaling until after write (we'll journal based on result)
          // For now, journal as create or modify
          if (fileExists && originalContent !== null) {
            await journal.journalFileModify(runId, filePath, originalContent, args.content || '');
          } else {
            await journal.journalFileCreate(runId, filePath, args.content || '');
          }
          break;
        }
        
        case 'create_directory': {
          await journal.journalDirectoryCreate(runId, filePath);
          break;
        }
        
        // read operations don't need journaling
      }
    } catch (error: any) {
      // Don't fail the operation if journaling fails
      console.warn(`[MCP Journal] Warning: ${error.message}`);
    }
  }

  /**
   * Check if a tool is an MCP tool
   */
  isMCPTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  /**
   * Disconnect all clients
   */
  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.close();
        console.log(`[MCP] Disconnected from ${name}`);
      } catch (error: any) {
        console.warn(`[MCP] Error disconnecting from ${name}: ${error.message}`);
      }
    }
    this.clients.clear();
    this.tools.clear();
  }

  /**
   * Get connected server names
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Get tool count
   */
  getToolCount(): number {
    return this.tools.size;
  }
}

// Singleton instance
let mcpManager: MCPClientManager | null = null;

export function getMCPManager(): MCPClientManager {
  if (!mcpManager) {
    mcpManager = new MCPClientManager();
  }
  return mcpManager;
}

export async function initMCP(): Promise<MCPClientManager> {
  const manager = getMCPManager();
  await manager.connectAll();
  return manager;
}
