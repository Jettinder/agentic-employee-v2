/**
 * Tool Definitions for AI
 * These tools map to the execution layer
 */

import type { ToolDefinition } from '../ai/types.js';

export const filesystemTool: ToolDefinition = {
  name: 'filesystem',
  description: 'Perform filesystem operations: read, write, mkdir, chmod, list directory contents',
  parameters: {
    type: 'object',
    properties: {
      op: {
        type: 'string',
        enum: ['read', 'write', 'mkdir', 'chmod', 'list', 'delete', 'move', 'copy'],
        description: 'The filesystem operation to perform',
      },
      path: {
        type: 'string',
        description: 'The file or directory path',
      },
      content: {
        type: 'string',
        description: 'Content to write (for write operation)',
      },
      mode: {
        type: 'string',
        description: 'File mode/permissions (for chmod, e.g. "755")',
      },
      destination: {
        type: 'string',
        description: 'Destination path (for move/copy operations)',
      },
    },
    required: ['op', 'path'],
  },
};

export const terminalTool: ToolDefinition = {
  name: 'terminal',
  description: 'Execute shell commands in the terminal',
  parameters: {
    type: 'object',
    properties: {
      cmd: {
        type: 'string',
        description: 'The shell command to execute',
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the command',
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default 30000)',
      },
      background: {
        type: 'boolean',
        description: 'Run command in background',
      },
    },
    required: ['cmd'],
  },
};

export const editorTool: ToolDefinition = {
  name: 'editor',
  description: 'Edit files with search/replace, insert, or patch operations',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'File path to edit',
      },
      op: {
        type: 'string',
        enum: ['replace', 'insert', 'delete_lines', 'patch'],
        description: 'Edit operation type',
      },
      search: {
        type: 'string',
        description: 'Text to search for (for replace)',
      },
      replace: {
        type: 'string',
        description: 'Replacement text',
      },
      line: {
        type: 'number',
        description: 'Line number for insert operation',
      },
      content: {
        type: 'string',
        description: 'Content to insert',
      },
      startLine: {
        type: 'number',
        description: 'Start line for delete_lines',
      },
      endLine: {
        type: 'number',
        description: 'End line for delete_lines',
      },
      patch: {
        type: 'string',
        description: 'Unified diff patch to apply',
      },
    },
    required: ['path', 'op'],
  },
};

export const searchTool: ToolDefinition = {
  name: 'search',
  description: 'Search the web for information. Use for current events, facts, documentation lookup.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query',
      },
      type: {
        type: 'string',
        enum: ['web', 'news', 'code', 'docs'],
        description: 'Type of search (default: web)',
      },
    },
    required: ['query'],
  },
};

export const thinkTool: ToolDefinition = {
  name: 'think',
  description: 'Use this tool to think through complex problems step by step before acting. Good for planning, debugging, and analysis.',
  parameters: {
    type: 'object',
    properties: {
      thought: {
        type: 'string',
        description: 'Your reasoning process and analysis',
      },
    },
    required: ['thought'],
  },
};

export const memoryTool: ToolDefinition = {
  name: 'memory',
  description: 'Store or retrieve information from long-term memory',
  parameters: {
    type: 'object',
    properties: {
      op: {
        type: 'string',
        enum: ['store', 'retrieve', 'search', 'list'],
        description: 'Memory operation',
      },
      key: {
        type: 'string',
        description: 'Memory key/identifier',
      },
      value: {
        type: 'string',
        description: 'Value to store',
      },
      query: {
        type: 'string',
        description: 'Search query for semantic search',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization',
      },
    },
    required: ['op'],
  },
};

export const requestApprovalTool: ToolDefinition = {
  name: 'request_approval',
  description: 'Request human approval for sensitive or high-impact actions',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Description of the action requiring approval',
      },
      reason: {
        type: 'string',
        description: 'Why this action needs approval',
      },
      impact: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Impact level of the action',
      },
    },
    required: ['action', 'reason', 'impact'],
  },
};

export const reportTool: ToolDefinition = {
  name: 'report',
  description: 'Report progress, completion, or issues to the user',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['progress', 'complete', 'error', 'info', 'question'],
        description: 'Type of report',
      },
      message: {
        type: 'string',
        description: 'The message to report',
      },
      details: {
        type: 'object',
        description: 'Additional details/data',
      },
    },
    required: ['type', 'message'],
  },
};

export const computerTool: ToolDefinition = {
  name: 'computer',
  description: 'Control the computer like a human user: mouse movements, clicks, keyboard typing, screenshots, clipboard, and window management. Use this to interact with any GUI application.',
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'screenshot',
          'screenshot_region',
          'screenshot_window',
          'mouse_move',
          'mouse_click',
          'mouse_double_click',
          'mouse_drag',
          'mouse_scroll',
          'type',
          'key_press',
          'key_sequence',
          'clipboard_get',
          'clipboard_set',
          'window_focus',
          'window_find',
          'window_info',
          'window_list',
          'window_minimize',
          'window_maximize',
          'window_close',
          'window_resize',
          'window_move',
          'launch_app',
          'get_mouse_position',
          'get_screen_info',
        ],
        description: 'The computer action to perform',
      },
      x: {
        type: 'number',
        description: 'X coordinate for mouse operations',
      },
      y: {
        type: 'number',
        description: 'Y coordinate for mouse operations',
      },
      width: {
        type: 'number',
        description: 'Width for region/resize operations',
      },
      height: {
        type: 'number',
        description: 'Height for region/resize operations',
      },
      button: {
        type: 'number',
        enum: [1, 2, 3],
        description: 'Mouse button: 1=left, 2=middle, 3=right',
      },
      text: {
        type: 'string',
        description: 'Text to type or set in clipboard',
      },
      key: {
        type: 'string',
        description: 'Key to press (e.g., "Return", "Tab", "ctrl+c", "alt+F4")',
      },
      keys: {
        type: 'array',
        items: { type: 'string' },
        description: 'Sequence of keys to press',
      },
      direction: {
        type: 'string',
        enum: ['up', 'down'],
        description: 'Scroll direction',
      },
      clicks: {
        type: 'number',
        description: 'Number of scroll clicks',
      },
      windowId: {
        type: 'string',
        description: 'Window ID for window operations',
      },
      windowName: {
        type: 'string',
        description: 'Window name pattern (regex) for finding windows',
      },
      command: {
        type: 'string',
        description: 'Command to launch an application',
      },
      toX: {
        type: 'number',
        description: 'Destination X for drag operation',
      },
      toY: {
        type: 'number',
        description: 'Destination Y for drag operation',
      },
    },
    required: ['action'],
  },
};

import { getIntegrationTools } from '../integrations/tools.js';

export const journalTool: ToolDefinition = {
  name: 'journal',
  description: 'View and manage action journal for the current or previous runs. Use to see what changes were made and optionally rollback.',
  parameters: {
    type: 'object',
    properties: {
      op: {
        type: 'string',
        enum: ['list_runs', 'view', 'summary', 'rollback_entry', 'rollback_run'],
        description: 'Operation: list_runs (show recent runs), view (show entries), summary (human-readable), rollback_entry (undo one action), rollback_run (undo all actions in a run)',
      },
      runId: {
        type: 'string',
        description: 'Run ID to view/rollback (optional, defaults to current run)',
      },
      entryId: {
        type: 'string',
        description: 'Entry ID to rollback (for rollback_entry operation)',
      },
      limit: {
        type: 'number',
        description: 'Max number of runs/entries to show',
      },
    },
    required: ['op'],
  },
};

/**
 * Get all built-in tools
 */
export function getBuiltinTools(): ToolDefinition[] {
  return [
    filesystemTool,
    terminalTool,
    editorTool,
    searchTool,
    thinkTool,
    memoryTool,
    requestApprovalTool,
    reportTool,
    computerTool,
    journalTool,
    ...getIntegrationTools(),
  ];
}

/**
 * Get all available tools (built-in + MCP)
 */
export function getAllTools(): ToolDefinition[] {
  return getBuiltinTools();
}

/**
 * Get all tools including MCP tools (async)
 */
export async function getAllToolsWithMCP(): Promise<ToolDefinition[]> {
  const { getMCPManager } = await import('../mcp/index.js');
  const mcpManager = getMCPManager();
  const mcpTools = mcpManager.getAllTools();
  return [...getBuiltinTools(), ...mcpTools];
}

/**
 * Get tools by category
 */
export function getToolsByCategory(category: 'execution' | 'search' | 'memory' | 'meta'): ToolDefinition[] {
  const categories: Record<string, string[]> = {
    execution: ['filesystem', 'terminal', 'editor'],
    search: ['search'],
    memory: ['memory'],
    meta: ['think', 'request_approval', 'report'],
  };
  
  const toolNames = categories[category] || [];
  return getAllTools().filter(t => toolNames.includes(t.name));
}
