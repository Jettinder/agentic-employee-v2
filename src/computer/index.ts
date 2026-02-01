/**
 * Computer Control Module
 * Full desktop automation: mouse, keyboard, screenshots, clipboard
 * Uses xdotool, scrot, xclip on Linux
 */

import { exec, execSync, spawn } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const execAsync = promisify(exec);

export interface MousePosition {
  x: number;
  y: number;
}

export interface ScreenInfo {
  width: number;
  height: number;
}

export interface WindowInfo {
  id: string;
  name: string;
  class: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Computer Control - Full desktop automation
 */
export class ComputerControl {
  private screenshotDir: string;

  constructor() {
    this.screenshotDir = join(tmpdir(), 'agentic-screenshots');
  }

  async init(): Promise<void> {
    await fs.mkdir(this.screenshotDir, { recursive: true });
    
    // Check dependencies
    const deps = ['xdotool', 'scrot', 'xclip'];
    for (const dep of deps) {
      try {
        await execAsync(`which ${dep}`);
      } catch {
        console.warn(`Warning: ${dep} not found. Some features may not work.`);
      }
    }
  }

  // ============ MOUSE CONTROL ============

  /**
   * Get current mouse position
   */
  async getMousePosition(): Promise<MousePosition> {
    const { stdout } = await execAsync('xdotool getmouselocation --shell');
    const x = parseInt(stdout.match(/X=(\d+)/)?.[1] || '0');
    const y = parseInt(stdout.match(/Y=(\d+)/)?.[1] || '0');
    return { x, y };
  }

  /**
   * Move mouse to absolute position
   */
  async mouseMove(x: number, y: number): Promise<void> {
    await execAsync(`xdotool mousemove ${x} ${y}`);
  }

  /**
   * Move mouse relative to current position
   */
  async mouseMoveRelative(dx: number, dy: number): Promise<void> {
    await execAsync(`xdotool mousemove_relative ${dx} ${dy}`);
  }

  /**
   * Click mouse button
   * @param button 1=left, 2=middle, 3=right
   */
  async mouseClick(button: 1 | 2 | 3 = 1): Promise<void> {
    await execAsync(`xdotool click ${button}`);
  }

  /**
   * Double click
   */
  async mouseDoubleClick(button: 1 | 2 | 3 = 1): Promise<void> {
    await execAsync(`xdotool click --repeat 2 --delay 100 ${button}`);
  }

  /**
   * Click at specific position
   */
  async clickAt(x: number, y: number, button: 1 | 2 | 3 = 1): Promise<void> {
    await this.mouseMove(x, y);
    await this.mouseClick(button);
  }

  /**
   * Drag from one position to another
   */
  async drag(fromX: number, fromY: number, toX: number, toY: number): Promise<void> {
    await this.mouseMove(fromX, fromY);
    await execAsync('xdotool mousedown 1');
    await this.mouseMove(toX, toY);
    await execAsync('xdotool mouseup 1');
  }

  /**
   * Scroll mouse wheel
   * @param direction 'up' | 'down'
   * @param clicks number of scroll clicks
   */
  async scroll(direction: 'up' | 'down', clicks: number = 3): Promise<void> {
    const button = direction === 'up' ? 4 : 5;
    await execAsync(`xdotool click --repeat ${clicks} --delay 50 ${button}`);
  }

  // ============ KEYBOARD CONTROL ============

  /**
   * Type text with keyboard
   */
  async type(text: string, delay: number = 12): Promise<void> {
    // Escape special characters for xdotool
    await execAsync(`xdotool type --delay ${delay} -- "${text.replace(/"/g, '\\"')}"`);
  }

  /**
   * Press a single key or key combination
   * Examples: 'Return', 'Tab', 'ctrl+c', 'alt+F4', 'super'
   */
  async keyPress(key: string): Promise<void> {
    await execAsync(`xdotool key ${key}`);
  }

  /**
   * Press multiple keys in sequence
   */
  async keySequence(keys: string[]): Promise<void> {
    for (const key of keys) {
      await this.keyPress(key);
      await this.sleep(50);
    }
  }

  /**
   * Hold a key down
   */
  async keyDown(key: string): Promise<void> {
    await execAsync(`xdotool keydown ${key}`);
  }

  /**
   * Release a held key
   */
  async keyUp(key: string): Promise<void> {
    await execAsync(`xdotool keyup ${key}`);
  }

  /**
   * Common shortcuts
   */
  async copy(): Promise<void> {
    await this.keyPress('ctrl+c');
  }

  async paste(): Promise<void> {
    await this.keyPress('ctrl+v');
  }

  async cut(): Promise<void> {
    await this.keyPress('ctrl+x');
  }

  async undo(): Promise<void> {
    await this.keyPress('ctrl+z');
  }

  async redo(): Promise<void> {
    await this.keyPress('ctrl+shift+z');
  }

  async selectAll(): Promise<void> {
    await this.keyPress('ctrl+a');
  }

  async save(): Promise<void> {
    await this.keyPress('ctrl+s');
  }

  async find(): Promise<void> {
    await this.keyPress('ctrl+f');
  }

  async newTab(): Promise<void> {
    await this.keyPress('ctrl+t');
  }

  async closeTab(): Promise<void> {
    await this.keyPress('ctrl+w');
  }

  async switchTab(): Promise<void> {
    await this.keyPress('ctrl+Tab');
  }

  async altTab(): Promise<void> {
    await this.keyPress('alt+Tab');
  }

  // ============ SCREEN & SCREENSHOTS ============

  /**
   * Get screen resolution
   */
  async getScreenInfo(): Promise<ScreenInfo> {
    const { stdout } = await execAsync('xdotool getdisplaygeometry');
    const [width, height] = stdout.trim().split(' ').map(Number);
    return { width, height };
  }

  /**
   * Take screenshot of entire screen
   */
  async screenshot(filename?: string): Promise<string> {
    const file = filename || join(this.screenshotDir, `screenshot-${Date.now()}.png`);
    await execAsync(`scrot "${file}"`);
    return file;
  }

  /**
   * Take screenshot of specific region
   */
  async screenshotRegion(x: number, y: number, width: number, height: number, filename?: string): Promise<string> {
    const file = filename || join(this.screenshotDir, `screenshot-${Date.now()}.png`);
    await execAsync(`scrot -a ${x},${y},${width},${height} "${file}"`);
    return file;
  }

  /**
   * Take screenshot of active window
   */
  async screenshotWindow(filename?: string): Promise<string> {
    const file = filename || join(this.screenshotDir, `screenshot-${Date.now()}.png`);
    await execAsync(`scrot -u "${file}"`);
    return file;
  }

  /**
   * Take screenshot and return as base64
   */
  async screenshotBase64(): Promise<string> {
    const file = await this.screenshot();
    const data = await fs.readFile(file);
    await fs.unlink(file); // Clean up
    return data.toString('base64');
  }

  // ============ CLIPBOARD ============

  /**
   * Get clipboard content
   */
  async getClipboard(): Promise<string> {
    try {
      const { stdout } = await execAsync('xclip -selection clipboard -o');
      return stdout;
    } catch {
      return '';
    }
  }

  /**
   * Set clipboard content
   */
  async setClipboard(text: string): Promise<void> {
    const child = spawn('xclip', ['-selection', 'clipboard']);
    child.stdin.write(text);
    child.stdin.end();
    await new Promise<void>((resolve) => child.on('close', () => resolve()));
  }

  // ============ WINDOW MANAGEMENT ============

  /**
   * Get active window ID
   */
  async getActiveWindow(): Promise<string> {
    const { stdout } = await execAsync('xdotool getactivewindow');
    return stdout.trim();
  }

  /**
   * Get window info
   */
  async getWindowInfo(windowId?: string): Promise<WindowInfo> {
    const id = windowId || await this.getActiveWindow();
    const { stdout: geometry } = await execAsync(`xdotool getwindowgeometry --shell ${id}`);
    const { stdout: name } = await execAsync(`xdotool getwindowname ${id}`);
    
    let windowClass = '';
    try {
      const { stdout: classOut } = await execAsync(`xprop -id ${id} WM_CLASS`);
      windowClass = classOut.match(/"([^"]+)"/)?.[1] || '';
    } catch {}

    return {
      id,
      name: name.trim(),
      class: windowClass,
      x: parseInt(geometry.match(/X=(\d+)/)?.[1] || '0'),
      y: parseInt(geometry.match(/Y=(\d+)/)?.[1] || '0'),
      width: parseInt(geometry.match(/WIDTH=(\d+)/)?.[1] || '0'),
      height: parseInt(geometry.match(/HEIGHT=(\d+)/)?.[1] || '0'),
    };
  }

  /**
   * Focus a window by ID
   */
  async focusWindow(windowId: string): Promise<void> {
    await execAsync(`xdotool windowactivate ${windowId}`);
  }

  /**
   * Find windows by name (regex)
   */
  async findWindows(namePattern: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`xdotool search --name "${namePattern}"`);
      return stdout.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Find and focus window by name
   */
  async focusWindowByName(namePattern: string): Promise<boolean> {
    const windows = await this.findWindows(namePattern);
    if (windows.length > 0) {
      await this.focusWindow(windows[0]);
      return true;
    }
    return false;
  }

  /**
   * Minimize active window
   */
  async minimizeWindow(windowId?: string): Promise<void> {
    const id = windowId || await this.getActiveWindow();
    await execAsync(`xdotool windowminimize ${id}`);
  }

  /**
   * Maximize active window
   */
  async maximizeWindow(windowId?: string): Promise<void> {
    const id = windowId || await this.getActiveWindow();
    await execAsync(`wmctrl -i -r ${id} -b add,maximized_vert,maximized_horz`);
  }

  /**
   * Close active window
   */
  async closeWindow(windowId?: string): Promise<void> {
    const id = windowId || await this.getActiveWindow();
    await execAsync(`xdotool windowclose ${id}`);
  }

  /**
   * Resize window
   */
  async resizeWindow(width: number, height: number, windowId?: string): Promise<void> {
    const id = windowId || await this.getActiveWindow();
    await execAsync(`xdotool windowsize ${id} ${width} ${height}`);
  }

  /**
   * Move window
   */
  async moveWindow(x: number, y: number, windowId?: string): Promise<void> {
    const id = windowId || await this.getActiveWindow();
    await execAsync(`xdotool windowmove ${id} ${x} ${y}`);
  }

  // ============ APPLICATION LAUNCHING ============

  /**
   * Launch an application
   */
  async launchApp(command: string): Promise<void> {
    spawn(command, { detached: true, stdio: 'ignore', shell: true }).unref();
  }

  /**
   * Launch and wait for window
   */
  async launchAndWait(command: string, windowNamePattern: string, timeout: number = 10000): Promise<string | null> {
    await this.launchApp(command);
    
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const windows = await this.findWindows(windowNamePattern);
      if (windows.length > 0) {
        await this.sleep(500); // Let it fully load
        return windows[0];
      }
      await this.sleep(200);
    }
    return null;
  }

  // ============ UTILITIES ============

  /**
   * Sleep for specified milliseconds
   */
  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Wait for a condition to be true
   */
  async waitFor(condition: () => Promise<boolean>, timeout: number = 10000, interval: number = 200): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await this.sleep(interval);
    }
    return false;
  }

  /**
   * Execute a sequence of actions
   */
  async sequence(actions: Array<() => Promise<void>>, delay: number = 100): Promise<void> {
    for (const action of actions) {
      await action();
      await this.sleep(delay);
    }
  }
}

// Singleton instance
let instance: ComputerControl | null = null;

export function getComputerControl(): ComputerControl {
  if (!instance) {
    instance = new ComputerControl();
  }
  return instance;
}

export default ComputerControl;
