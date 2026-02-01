/**
 * Tool Executor
 * Executes tool calls and returns results
 */

import { z } from 'zod';
import { execFilesystem, execTerminal, execEditor } from '../execution/index.js';
import type { RunContext } from '../core/types.js';
import { auditEvent } from '../audit/logger.js';
import { preCheck } from '../guardrails/hooks.js';
import { getComputerControl } from '../computer/index.js';
import { getMCPManager } from '../mcp/index.js';

export interface ToolResult {
  success: boolean;
  output: any;
  error?: string;
}

/**
 * Execute a tool call
 */
export async function executeTool(
  ctx: RunContext,
  toolName: string,
  args: Record<string, any>
): Promise<ToolResult> {
  await auditEvent(ctx, 'TOOL_EXEC_START', { tool: toolName, args });

  try {
    let result: any;

    switch (toolName) {
      case 'filesystem':
        result = await executeFilesystem(ctx, args);
        break;
      case 'terminal':
        result = await executeTerminal(ctx, args);
        break;
      case 'editor':
        result = await executeEditor(ctx, args);
        break;
      case 'search':
        result = await executeSearch(ctx, args);
        break;
      case 'think':
        // Think tool just returns the thought - it's for the AI's reasoning
        result = { thought: args.thought, acknowledged: true };
        break;
      case 'memory':
        result = await executeMemory(ctx, args);
        break;
      case 'request_approval':
        result = await executeRequestApproval(ctx, args);
        break;
      case 'report':
        result = { reported: true, type: args.type, message: args.message };
        break;
      case 'computer':
        result = await executeComputer(ctx, args);
        break;
      default:
        // Check if it's an MCP tool
        const mcpManager = getMCPManager();
        if (mcpManager.isMCPTool(toolName)) {
          result = await mcpManager.executeTool(toolName, args);
          break;
        }
        throw new Error(`Unknown tool: ${toolName}`);
    }

    await auditEvent(ctx, 'TOOL_EXEC_END', { tool: toolName, success: true });
    return { success: true, output: result };

  } catch (error: any) {
    await auditEvent(ctx, 'TOOL_EXEC_ERROR', { 
      tool: toolName, 
      error: error.message,
      code: error.code,
    });
    return { 
      success: false, 
      output: null, 
      error: error.message || 'Unknown error' 
    };
  }
}

/**
 * Filesystem operations
 */
async function executeFilesystem(ctx: RunContext, args: any): Promise<any> {
  const { promises: fs } = await import('fs');
  const { op, path, content, mode, destination } = args;

  // Use existing execution for basic ops
  if (['write', 'mkdir', 'chmod'].includes(op)) {
    return execFilesystem(ctx, { op, path, content, mode });
  }

  switch (op) {
    case 'read': {
      const data = await fs.readFile(path, 'utf-8');
      return { content: data, size: data.length };
    }
    case 'list': {
      const entries = await fs.readdir(path, { withFileTypes: true });
      return entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }));
    }
    case 'delete': {
      await fs.rm(path, { recursive: true, force: true });
      return { deleted: path };
    }
    case 'move': {
      await fs.rename(path, destination);
      return { moved: path, to: destination };
    }
    case 'copy': {
      await fs.cp(path, destination, { recursive: true });
      return { copied: path, to: destination };
    }
    default:
      throw new Error(`Unknown filesystem operation: ${op}`);
  }
}

/**
 * Terminal execution
 */
async function executeTerminal(ctx: RunContext, args: any): Promise<any> {
  const result = await execTerminal(ctx, {
    cmd: args.cmd,
    cwd: args.cwd,
  });
  
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.exitCode ?? (result.ok ? 0 : 1),
  };
}

/**
 * Editor operations
 */
async function executeEditor(ctx: RunContext, args: any): Promise<any> {
  const { promises: fs } = await import('fs');
  const { path, op, search, replace, line, content, startLine, endLine, patch } = args;

  switch (op) {
    case 'replace': {
      const fileContent = await fs.readFile(path, 'utf-8');
      const newContent = fileContent.replace(search, replace);
      await fs.writeFile(path, newContent);
      return { replaced: true, path };
    }
    case 'insert': {
      const fileContent = await fs.readFile(path, 'utf-8');
      const lines = fileContent.split('\n');
      lines.splice(line - 1, 0, content);
      await fs.writeFile(path, lines.join('\n'));
      return { inserted: true, path, atLine: line };
    }
    case 'delete_lines': {
      const fileContent = await fs.readFile(path, 'utf-8');
      const lines = fileContent.split('\n');
      lines.splice(startLine - 1, endLine - startLine + 1);
      await fs.writeFile(path, lines.join('\n'));
      return { deleted: true, path, lines: `${startLine}-${endLine}` };
    }
    case 'patch': {
      // Simple patch application - in production use a proper diff library
      // For now, delegate to execEditor
      return execEditor(ctx, { path, patch });
    }
    default:
      throw new Error(`Unknown editor operation: ${op}`);
  }
}

/**
 * Web search (placeholder - integrate with actual search API)
 */
async function executeSearch(ctx: RunContext, args: any): Promise<any> {
  const { query, type = 'web' } = args;
  
  // This would integrate with Perplexity or another search API
  // For now, return a placeholder that indicates the AI should use Perplexity
  return {
    note: 'Search should be routed through Perplexity provider',
    query,
    type,
    suggestion: 'Use the AI router with forceProvider: "perplexity" for search tasks',
  };
}

/**
 * Memory operations (placeholder - integrate with actual memory store)
 */
async function executeMemory(ctx: RunContext, args: any): Promise<any> {
  const { promises: fs } = await import('fs');
  const path = await import('path');
  
  const memoryDir = '.data/memory';
  const memoryFile = path.join(memoryDir, 'store.json');
  
  // Ensure memory directory exists
  await fs.mkdir(memoryDir, { recursive: true });
  
  // Load existing memory
  let memory: Record<string, any> = {};
  try {
    const data = await fs.readFile(memoryFile, 'utf-8');
    memory = JSON.parse(data);
  } catch {
    // File doesn't exist yet
  }

  const { op, key, value, query, tags } = args;

  switch (op) {
    case 'store': {
      memory[key] = { value, tags, timestamp: Date.now() };
      await fs.writeFile(memoryFile, JSON.stringify(memory, null, 2));
      return { stored: key };
    }
    case 'retrieve': {
      const item = memory[key];
      return item ? { found: true, ...item } : { found: false };
    }
    case 'search': {
      // Simple keyword search - in production use vector embeddings
      const results = Object.entries(memory)
        .filter(([k, v]: [string, any]) => 
          k.includes(query) || 
          v.value?.toString().includes(query) ||
          v.tags?.some((t: string) => t.includes(query))
        )
        .map(([k, v]) => ({ key: k, ...v }));
      return { results };
    }
    case 'list': {
      return { 
        keys: Object.keys(memory),
        count: Object.keys(memory).length,
      };
    }
    default:
      throw new Error(`Unknown memory operation: ${op}`);
  }
}

/**
 * Request approval (placeholder - integrate with notification system)
 */
async function executeRequestApproval(ctx: RunContext, args: any): Promise<any> {
  const { action, reason, impact } = args;
  
  await auditEvent(ctx, 'APPROVAL_REQUESTED', { action, reason, impact });
  
  // In production, this would:
  // 1. Send notification to user
  // 2. Wait for approval or timeout
  // 3. Return approval status
  
  // For now, auto-approve low impact, require manual for others
  if (impact === 'low') {
    return { approved: true, auto: true, reason: 'Low impact auto-approved' };
  }
  
  return {
    approved: false,
    pending: true,
    message: `Approval required for: ${action}. Reason: ${reason}. Impact: ${impact}`,
  };
}

/**
 * Computer control - mouse, keyboard, screenshots, windows
 */
async function executeComputer(ctx: RunContext, args: any): Promise<any> {
  const computer = getComputerControl();
  await computer.init();

  const { action } = args;

  switch (action) {
    // Screenshots
    case 'screenshot': {
      const file = await computer.screenshot();
      const base64 = await computer.screenshotBase64();
      return { file, base64, note: 'Screenshot captured' };
    }
    case 'screenshot_region': {
      const { x, y, width, height } = args;
      const file = await computer.screenshotRegion(x, y, width, height);
      return { file, note: 'Region screenshot captured' };
    }
    case 'screenshot_window': {
      const file = await computer.screenshotWindow();
      return { file, note: 'Window screenshot captured' };
    }

    // Mouse
    case 'get_mouse_position': {
      const pos = await computer.getMousePosition();
      return { x: pos.x, y: pos.y };
    }
    case 'mouse_move': {
      const { x, y } = args;
      await computer.mouseMove(x, y);
      return { moved: true, x, y };
    }
    case 'mouse_click': {
      const { x, y, button = 1 } = args;
      if (x !== undefined && y !== undefined) {
        await computer.clickAt(x, y, button);
      } else {
        await computer.mouseClick(button);
      }
      return { clicked: true, button };
    }
    case 'mouse_double_click': {
      const { button = 1 } = args;
      await computer.mouseDoubleClick(button);
      return { doubleClicked: true, button };
    }
    case 'mouse_drag': {
      const { x, y, toX, toY } = args;
      await computer.drag(x, y, toX, toY);
      return { dragged: true, from: { x, y }, to: { x: toX, y: toY } };
    }
    case 'mouse_scroll': {
      const { direction, clicks = 3 } = args;
      await computer.scroll(direction, clicks);
      return { scrolled: true, direction, clicks };
    }

    // Keyboard
    case 'type': {
      const { text } = args;
      await computer.type(text);
      return { typed: true, length: text.length };
    }
    case 'key_press': {
      const { key } = args;
      await computer.keyPress(key);
      return { pressed: true, key };
    }
    case 'key_sequence': {
      const { keys } = args;
      await computer.keySequence(keys);
      return { sequence: true, keys };
    }

    // Clipboard
    case 'clipboard_get': {
      const content = await computer.getClipboard();
      return { content };
    }
    case 'clipboard_set': {
      const { text } = args;
      await computer.setClipboard(text);
      return { set: true, length: text.length };
    }

    // Screen info
    case 'get_screen_info': {
      const info = await computer.getScreenInfo();
      return { width: info.width, height: info.height };
    }

    // Window management
    case 'window_info': {
      const { windowId } = args;
      const info = await computer.getWindowInfo(windowId);
      return info;
    }
    case 'window_focus': {
      const { windowId, windowName } = args;
      if (windowName) {
        const found = await computer.focusWindowByName(windowName);
        return { focused: found, pattern: windowName };
      } else if (windowId) {
        await computer.focusWindow(windowId);
        return { focused: true, windowId };
      }
      return { error: 'Provide windowId or windowName' };
    }
    case 'window_find': {
      const { windowName } = args;
      const windows = await computer.findWindows(windowName);
      return { windows, count: windows.length };
    }
    case 'window_list': {
      // List all windows by searching for any
      const windows = await computer.findWindows('.');
      return { windows, count: windows.length };
    }
    case 'window_minimize': {
      const { windowId } = args;
      await computer.minimizeWindow(windowId);
      return { minimized: true };
    }
    case 'window_maximize': {
      const { windowId } = args;
      await computer.maximizeWindow(windowId);
      return { maximized: true };
    }
    case 'window_close': {
      const { windowId } = args;
      await computer.closeWindow(windowId);
      return { closed: true };
    }
    case 'window_resize': {
      const { windowId, width, height } = args;
      await computer.resizeWindow(width, height, windowId);
      return { resized: true, width, height };
    }
    case 'window_move': {
      const { windowId, x, y } = args;
      await computer.moveWindow(x, y, windowId);
      return { moved: true, x, y };
    }

    // App launching
    case 'launch_app': {
      const { command, windowName } = args;
      if (windowName) {
        const windowId = await computer.launchAndWait(command, windowName);
        return { launched: true, command, windowId };
      } else {
        await computer.launchApp(command);
        return { launched: true, command };
      }
    }

    default:
      throw new Error(`Unknown computer action: ${action}`);
  }
}
