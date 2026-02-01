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
import { getEmailClient, getCalendarClient, getSlackClient, getNotificationManager } from '../integrations/index.js';
import * as journal from '../journal/index.js';

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
      case 'email':
        result = await executeEmail(ctx, args);
        break;
      case 'calendar':
        result = await executeCalendar(ctx, args);
        break;
      case 'slack':
        result = await executeSlack(ctx, args);
        break;
      case 'notify':
        result = await executeNotify(ctx, args);
        break;
      case 'journal':
        result = await executeJournal(ctx, args);
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
 * Filesystem operations (with journal tracking)
 */
async function executeFilesystem(ctx: RunContext, args: any): Promise<any> {
  const { promises: fs } = await import('fs');
  const { existsSync } = await import('fs');
  const { op, path: filePath, content, mode, destination } = args;

  switch (op) {
    case 'write': {
      // Check if file exists for journal
      let originalContent: string | null = null;
      const fileExists = existsSync(filePath);
      if (fileExists) {
        try {
          originalContent = await fs.readFile(filePath, 'utf-8');
        } catch {}
      }
      
      // Write the file
      const result = await execFilesystem(ctx, { op, path: filePath, content, mode });
      
      // Journal the action
      if (fileExists && originalContent !== null) {
        await journal.journalFileModify(ctx.runId, filePath, originalContent, content);
      } else {
        await journal.journalFileCreate(ctx.runId, filePath, content);
      }
      
      return result;
    }
    
    case 'mkdir': {
      const result = await execFilesystem(ctx, { op, path: filePath, content, mode });
      await journal.journalDirectoryCreate(ctx.runId, filePath);
      return result;
    }
    
    case 'chmod': {
      return execFilesystem(ctx, { op, path: filePath, content, mode });
    }
    
    case 'read': {
      const data = await fs.readFile(filePath, 'utf-8');
      return { content: data, size: data.length };
    }
    
    case 'list': {
      const entries = await fs.readdir(filePath, { withFileTypes: true });
      return entries.map(e => ({
        name: e.name,
        type: e.isDirectory() ? 'directory' : 'file',
      }));
    }
    
    case 'delete': {
      // Backup content before delete for journal
      let originalContent: string | null = null;
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile()) {
          originalContent = await fs.readFile(filePath, 'utf-8');
        }
      } catch {}
      
      await fs.rm(filePath, { recursive: true, force: true });
      
      // Journal the deletion
      if (originalContent !== null) {
        await journal.journalFileDelete(ctx.runId, filePath, originalContent);
      }
      
      return { deleted: filePath };
    }
    
    case 'move': {
      await fs.rename(filePath, destination);
      return { moved: filePath, to: destination };
    }
    
    case 'copy': {
      await fs.cp(filePath, destination, { recursive: true });
      return { copied: filePath, to: destination };
    }
    
    default:
      throw new Error(`Unknown filesystem operation: ${op}`);
  }
}

/**
 * Terminal execution (with journal tracking)
 */
async function executeTerminal(ctx: RunContext, args: any): Promise<any> {
  const result = await execTerminal(ctx, {
    cmd: args.cmd,
    cwd: args.cwd,
  });
  
  const output = {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode: result.exitCode ?? (result.ok ? 0 : 1),
  };
  
  // Journal the terminal command (for audit, not rollbackable)
  await journal.journalTerminalCommand(
    ctx.runId, 
    args.cmd, 
    output.stdout + (output.stderr ? '\n' + output.stderr : '')
  );
  
  return output;
}

/**
 * Editor operations (with journal tracking)
 */
async function executeEditor(ctx: RunContext, args: any): Promise<any> {
  const { promises: fs } = await import('fs');
  const { path: filePath, op, search, replace, line, content, startLine, endLine, patch } = args;

  switch (op) {
    case 'replace': {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const newContent = fileContent.replace(search, replace);
      await fs.writeFile(filePath, newContent);
      // Journal the modification
      await journal.journalFileModify(ctx.runId, filePath, fileContent, newContent, `Replace in ${filePath}`);
      return { replaced: true, path: filePath };
    }
    case 'insert': {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n');
      lines.splice(line - 1, 0, content);
      const newContent = lines.join('\n');
      await fs.writeFile(filePath, newContent);
      // Journal the modification
      await journal.journalFileModify(ctx.runId, filePath, fileContent, newContent, `Insert at line ${line} in ${filePath}`);
      return { inserted: true, path: filePath, atLine: line };
    }
    case 'delete_lines': {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const lines = fileContent.split('\n');
      lines.splice(startLine - 1, endLine - startLine + 1);
      const newContent = lines.join('\n');
      await fs.writeFile(filePath, newContent);
      // Journal the modification
      await journal.journalFileModify(ctx.runId, filePath, fileContent, newContent, `Delete lines ${startLine}-${endLine} in ${filePath}`);
      return { deleted: true, path: filePath, lines: `${startLine}-${endLine}` };
    }
    case 'patch': {
      // Simple patch application - in production use a proper diff library
      // For now, delegate to execEditor
      return execEditor(ctx, { path: filePath, patch });
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

/**
 * Email operations
 */
async function executeEmail(ctx: RunContext, args: any): Promise<any> {
  const client = getEmailClient();
  const { action } = args;

  switch (action) {
    case 'send': {
      const { to, subject, body } = args;
      return client.send({
        to: Array.isArray(to) ? to : [to],
        subject,
        html: body,
      });
    }
    case 'send_template': {
      const { to, template, templateData } = args;
      return client.sendTemplate(
        Array.isArray(to) ? to : [to],
        template,
        templateData || {}
      );
    }
    default:
      throw new Error(`Unknown email action: ${action}`);
  }
}

/**
 * Calendar operations
 */
async function executeCalendar(ctx: RunContext, args: any): Promise<any> {
  const client = getCalendarClient();
  const { action } = args;

  switch (action) {
    case 'create': {
      const { summary, description, start, end, attendees } = args;
      return client.createEvent({
        summary,
        description,
        start: new Date(start),
        end: new Date(end),
        attendees,
      });
    }
    case 'list': {
      const { hours } = args;
      const now = new Date();
      const future = new Date(now.getTime() + (hours || 24) * 60 * 60 * 1000);
      return client.listEvents({ timeMin: now, timeMax: future });
    }
    case 'upcoming': {
      const { hours } = args;
      return client.getUpcoming(hours || 24);
    }
    case 'delete': {
      const { eventId } = args;
      return client.deleteEvent(eventId);
    }
    case 'find_slot': {
      const { duration } = args;
      return client.findFreeSlot(duration || 30);
    }
    default:
      throw new Error(`Unknown calendar action: ${action}`);
  }
}

/**
 * Slack operations
 */
async function executeSlack(ctx: RunContext, args: any): Promise<any> {
  const client = getSlackClient();
  const { action } = args;

  switch (action) {
    case 'send': {
      const { channel, message, threadTs } = args;
      return client.sendMessage({ channel, text: message, threadTs });
    }
    case 'notify': {
      const { type, title, message, channel } = args;
      return client.sendNotification(type, title, message, channel);
    }
    case 'list_channels': {
      return client.listChannels();
    }
    default:
      throw new Error(`Unknown slack action: ${action}`);
  }
}

/**
 * Notification operations
 */
async function executeNotify(ctx: RunContext, args: any): Promise<any> {
  const manager = getNotificationManager();
  const { type, title, message, priority, channels } = args;

  return manager.notify({
    type,
    title,
    message,
    priority,
    channels,
  }, ctx);
}

/**
 * Journal operations (view history, rollback)
 */
async function executeJournal(ctx: RunContext, args: any): Promise<any> {
  const { op, runId, entryId, limit } = args;
  const targetRunId = runId || ctx.runId;

  switch (op) {
    case 'list_runs': {
      const runs = await journal.listRecentRuns(limit || 20);
      return { 
        runs,
        count: runs.length,
        currentRun: ctx.runId
      };
    }
    
    case 'view': {
      const entries = await journal.loadJournal(targetRunId);
      return {
        runId: targetRunId,
        entries: entries.slice(0, limit || 50),
        totalCount: entries.length,
        rollbackableCount: entries.filter(e => e.canRollback && !e.rolledBack).length
      };
    }
    
    case 'summary': {
      const summary = await journal.exportJournalSummary(targetRunId);
      return { runId: targetRunId, summary };
    }
    
    case 'rollback_entry': {
      if (!entryId) {
        throw new Error('entryId is required for rollback_entry');
      }
      return journal.rollbackEntry(entryId, targetRunId);
    }
    
    case 'rollback_run': {
      return journal.rollbackRun(targetRunId);
    }
    
    default:
      throw new Error(`Unknown journal operation: ${op}`);
  }
}
