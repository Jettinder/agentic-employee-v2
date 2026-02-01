/**
 * Action Journal System
 * Tracks all modifications for rollback capability
 */

import { mkdir, writeFile, readFile, unlink, copyFile, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { homedir } from 'os';

export interface JournalEntry {
  id: string;
  timestamp: string;
  runId: string;
  action: ActionType;
  target: string;
  description: string;
  beforeState?: string;  // For files: original content or "null" if didn't exist
  afterState?: string;   // For files: new content
  command?: string;      // For terminal commands
  canRollback: boolean;
  rolledBack: boolean;
  metadata?: Record<string, any>;
}

export type ActionType = 
  | 'file_create'
  | 'file_modify'
  | 'file_delete'
  | 'file_move'
  | 'directory_create'
  | 'terminal_command'
  | 'browser_action'
  | 'email_send'
  | 'calendar_event'
  | 'slack_message';

const JOURNAL_DIR = join(homedir(), '.agentic-employee', 'journal');
const BACKUPS_DIR = join(homedir(), '.agentic-employee', 'backups');

let currentRunId: string = '';
let journalEntries: JournalEntry[] = [];

/**
 * Initialize journal for a run
 */
export async function initJournal(runId: string): Promise<void> {
  currentRunId = runId;
  journalEntries = [];
  
  await mkdir(JOURNAL_DIR, { recursive: true });
  await mkdir(BACKUPS_DIR, { recursive: true });
}

/**
 * Generate unique entry ID
 */
function generateEntryId(): string {
  return `entry-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Record a file creation
 */
export async function journalFileCreate(
  runId: string,
  filePath: string,
  content: string,
  description?: string
): Promise<string> {
  const entryId = generateEntryId();
  
  const entry: JournalEntry = {
    id: entryId,
    timestamp: new Date().toISOString(),
    runId,
    action: 'file_create',
    target: filePath,
    description: description || `Created file: ${filePath}`,
    beforeState: 'null',  // File didn't exist
    afterState: content,
    canRollback: true,
    rolledBack: false
  };
  
  journalEntries.push(entry);
  await saveJournalEntry(entry);
  
  return entryId;
}

/**
 * Record a file modification (backup original first)
 */
export async function journalFileModify(
  runId: string,
  filePath: string,
  originalContent: string,
  newContent: string,
  description?: string
): Promise<string> {
  const entryId = generateEntryId();
  
  // Backup original file
  const backupPath = join(BACKUPS_DIR, `${entryId}-${basename(filePath)}`);
  await writeFile(backupPath, originalContent, 'utf-8');
  
  const entry: JournalEntry = {
    id: entryId,
    timestamp: new Date().toISOString(),
    runId,
    action: 'file_modify',
    target: filePath,
    description: description || `Modified file: ${filePath}`,
    beforeState: originalContent,
    afterState: newContent,
    canRollback: true,
    rolledBack: false,
    metadata: { backupPath }
  };
  
  journalEntries.push(entry);
  await saveJournalEntry(entry);
  
  return entryId;
}

/**
 * Record a file deletion (backup original first)
 */
export async function journalFileDelete(
  runId: string,
  filePath: string,
  originalContent: string,
  description?: string
): Promise<string> {
  const entryId = generateEntryId();
  
  // Backup original file
  const backupPath = join(BACKUPS_DIR, `${entryId}-${basename(filePath)}`);
  await writeFile(backupPath, originalContent, 'utf-8');
  
  const entry: JournalEntry = {
    id: entryId,
    timestamp: new Date().toISOString(),
    runId,
    action: 'file_delete',
    target: filePath,
    description: description || `Deleted file: ${filePath}`,
    beforeState: originalContent,
    afterState: 'null',
    canRollback: true,
    rolledBack: false,
    metadata: { backupPath }
  };
  
  journalEntries.push(entry);
  await saveJournalEntry(entry);
  
  return entryId;
}

/**
 * Record a terminal command (limited rollback)
 */
export async function journalTerminalCommand(
  runId: string,
  command: string,
  output: string,
  description?: string
): Promise<string> {
  const entryId = generateEntryId();
  
  // Terminal commands are generally NOT rollbackable
  // Exception: we track them for audit
  const entry: JournalEntry = {
    id: entryId,
    timestamp: new Date().toISOString(),
    runId,
    action: 'terminal_command',
    target: 'terminal',
    description: description || `Executed: ${command.substring(0, 100)}`,
    command,
    afterState: output,
    canRollback: false,  // Can't undo terminal commands
    rolledBack: false
  };
  
  journalEntries.push(entry);
  await saveJournalEntry(entry);
  
  return entryId;
}

/**
 * Record directory creation
 */
export async function journalDirectoryCreate(
  runId: string,
  dirPath: string,
  description?: string
): Promise<string> {
  const entryId = generateEntryId();
  
  const entry: JournalEntry = {
    id: entryId,
    timestamp: new Date().toISOString(),
    runId,
    action: 'directory_create',
    target: dirPath,
    description: description || `Created directory: ${dirPath}`,
    beforeState: 'null',
    canRollback: true,  // Can rmdir if empty
    rolledBack: false
  };
  
  journalEntries.push(entry);
  await saveJournalEntry(entry);
  
  return entryId;
}

/**
 * Record email sent (NOT rollbackable)
 */
export async function journalEmailSend(
  runId: string,
  to: string,
  subject: string,
  description?: string
): Promise<string> {
  const entryId = generateEntryId();
  
  const entry: JournalEntry = {
    id: entryId,
    timestamp: new Date().toISOString(),
    runId,
    action: 'email_send',
    target: to,
    description: description || `Sent email to ${to}: ${subject}`,
    canRollback: false,  // Can't unsend email
    rolledBack: false,
    metadata: { subject }
  };
  
  journalEntries.push(entry);
  await saveJournalEntry(entry);
  
  return entryId;
}

/**
 * Save journal entry to disk
 */
async function saveJournalEntry(entry: JournalEntry): Promise<void> {
  const journalFile = join(JOURNAL_DIR, `${entry.runId}.jsonl`);
  const line = JSON.stringify(entry) + '\n';
  await writeFile(journalFile, line, { flag: 'a' });
}

/**
 * Load journal entries for a run
 */
export async function loadJournal(runId: string): Promise<JournalEntry[]> {
  const journalFile = join(JOURNAL_DIR, `${runId}.jsonl`);
  
  if (!existsSync(journalFile)) {
    return [];
  }
  
  const content = await readFile(journalFile, 'utf-8');
  const lines = content.trim().split('\n').filter(l => l);
  
  return lines.map(line => JSON.parse(line) as JournalEntry);
}

/**
 * List recent runs with journals
 */
export async function listRecentRuns(limit: number = 20): Promise<string[]> {
  if (!existsSync(JOURNAL_DIR)) {
    return [];
  }
  
  const files = await readdir(JOURNAL_DIR);
  const jsonlFiles = files
    .filter(f => f.endsWith('.jsonl'))
    .map(f => f.replace('.jsonl', ''))
    .sort()
    .reverse()
    .slice(0, limit);
  
  return jsonlFiles;
}

/**
 * Rollback a specific entry
 */
export async function rollbackEntry(entryId: string, runId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const entries = await loadJournal(runId);
  const entry = entries.find(e => e.id === entryId);
  
  if (!entry) {
    return { success: false, message: `Entry ${entryId} not found` };
  }
  
  if (!entry.canRollback) {
    return { success: false, message: `Entry ${entryId} cannot be rolled back (${entry.action})` };
  }
  
  if (entry.rolledBack) {
    return { success: false, message: `Entry ${entryId} was already rolled back` };
  }
  
  try {
    switch (entry.action) {
      case 'file_create':
        // Delete the created file
        if (existsSync(entry.target)) {
          await unlink(entry.target);
        }
        break;
        
      case 'file_modify':
        // Restore from backup
        if (entry.metadata?.backupPath && existsSync(entry.metadata.backupPath)) {
          await copyFile(entry.metadata.backupPath, entry.target);
        } else if (entry.beforeState) {
          await writeFile(entry.target, entry.beforeState, 'utf-8');
        }
        break;
        
      case 'file_delete':
        // Restore from backup
        if (entry.metadata?.backupPath && existsSync(entry.metadata.backupPath)) {
          await mkdir(dirname(entry.target), { recursive: true });
          await copyFile(entry.metadata.backupPath, entry.target);
        } else if (entry.beforeState && entry.beforeState !== 'null') {
          await mkdir(dirname(entry.target), { recursive: true });
          await writeFile(entry.target, entry.beforeState, 'utf-8');
        }
        break;
        
      case 'directory_create':
        // Only works if directory is empty
        try {
          const { rmdir } = await import('fs/promises');
          await rmdir(entry.target);
        } catch {
          return { success: false, message: `Cannot remove directory ${entry.target} (not empty?)` };
        }
        break;
        
      default:
        return { success: false, message: `Rollback not supported for ${entry.action}` };
    }
    
    // Mark as rolled back
    entry.rolledBack = true;
    
    // Append rollback record
    const rollbackRecord = {
      ...entry,
      id: `rollback-${entry.id}`,
      timestamp: new Date().toISOString(),
      description: `ROLLBACK: ${entry.description}`
    };
    await saveJournalEntry(rollbackRecord);
    
    return { success: true, message: `Successfully rolled back: ${entry.description}` };
    
  } catch (error: any) {
    return { success: false, message: `Rollback failed: ${error.message}` };
  }
}

/**
 * Rollback entire run (in reverse order)
 */
export async function rollbackRun(runId: string): Promise<{
  success: boolean;
  results: Array<{ entryId: string; success: boolean; message: string }>;
}> {
  const entries = await loadJournal(runId);
  const rollbackable = entries
    .filter(e => e.canRollback && !e.rolledBack && !e.id.startsWith('rollback-'))
    .reverse();  // Rollback in reverse order
  
  const results: Array<{ entryId: string; success: boolean; message: string }> = [];
  
  for (const entry of rollbackable) {
    const result = await rollbackEntry(entry.id, runId);
    results.push({ entryId: entry.id, ...result });
  }
  
  return {
    success: results.every(r => r.success),
    results
  };
}

/**
 * Get current run's journal entries
 */
export function getCurrentJournal(): JournalEntry[] {
  return [...journalEntries];
}

/**
 * Export journal summary (human-readable)
 */
export async function exportJournalSummary(runId: string): Promise<string> {
  const entries = await loadJournal(runId);
  
  if (entries.length === 0) {
    return `No journal entries for run ${runId}`;
  }
  
  const lines = [
    `# Action Journal: ${runId}`,
    `Generated: ${new Date().toISOString()}`,
    `Total Actions: ${entries.length}`,
    '',
    '## Actions',
    ''
  ];
  
  for (const entry of entries) {
    const rollbackStatus = entry.canRollback 
      ? (entry.rolledBack ? '🔄 ROLLED BACK' : '✅ Can rollback')
      : '⚠️ Cannot rollback';
    
    lines.push(`### ${entry.id}`);
    lines.push(`- **Time:** ${entry.timestamp}`);
    lines.push(`- **Action:** ${entry.action}`);
    lines.push(`- **Target:** ${entry.target}`);
    lines.push(`- **Description:** ${entry.description}`);
    lines.push(`- **Status:** ${rollbackStatus}`);
    if (entry.command) {
      lines.push(`- **Command:** \`${entry.command}\``);
    }
    lines.push('');
  }
  
  return lines.join('\n');
}

export default {
  initJournal,
  journalFileCreate,
  journalFileModify,
  journalFileDelete,
  journalTerminalCommand,
  journalDirectoryCreate,
  journalEmailSend,
  loadJournal,
  listRecentRuns,
  rollbackEntry,
  rollbackRun,
  getCurrentJournal,
  exportJournalSummary
};
