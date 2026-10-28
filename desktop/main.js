/**
 * AISA HORIZON - AI-FIRST IDE STUDIO
 * Master Electron Desktop Controller
 * Miyazaki Haruto Entertainment Co., Ltd.
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { exec, spawn } = require('child_process');

let mainWindow = null;

function getInitialWorkspace() {
  try {
    const stateFile = path.join(app.getPath('userData'), 'horizon-state.json');
    if (fs.existsSync(stateFile)) {
      const state = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      if (state.lastWorkspace && fs.existsSync(state.lastWorkspace)) {
        return state.lastWorkspace;
      }
    }
  } catch (e) {}

  const mhentUniverse = 'c:\\Users\\Yorutsuki Yurika\\Documents\\Miyazaki Haruto Entertainment Co., Ltd. - Project MHEnt. Universe';
  if (fs.existsSync(mhentUniverse)) {
    return mhentUniverse;
  }

  if (!app.isPackaged) {
    const parent = path.resolve(__dirname, '..', '..');
    if (fs.existsSync(parent)) return parent;
  }

  return app.getPath('documents');
}

function getSessionState() {
  try {
    const stateFile = path.join(app.getPath('userData'), 'horizon-state.json');
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    }
  } catch (e) {}
  return null;
}

function saveSessionState(state) {
  try {
    const stateDir = app.getPath('userData');
    if (!fs.existsSync(stateDir)) fs.mkdirSync(stateDir, { recursive: true });
    const stateFile = path.join(stateDir, 'horizon-state.json');
    let existing = {};
    if (fs.existsSync(stateFile)) {
      try { existing = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch (e) {}
    }
    const updated = {
      ...existing,
      ...state,
      lastWorkspace: state.workspace || state.lastWorkspace || existing.lastWorkspace || activeWorkspacePath,
      updatedAt: new Date().toISOString()
    };
    fs.writeFileSync(stateFile, JSON.stringify(updated, null, 2));
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function saveWorkspaceState(wsPath) {
  saveSessionState({ workspace: wsPath, lastWorkspace: wsPath });
}

// Default workspace with persistence
let activeWorkspacePath = getInitialWorkspace();

// File extension categories
const imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']);
const audioExts = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']);
const videoExts = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi']);
const binaryExts = new Set(['.exe', '.dll', '.zip', '.rar', '.7z', '.tar', '.gz', '.bin', '.iso', '.pdf', '.docx', '.xlsx', '.pptx', '.sys', '.dat']);

function getApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const p0 = path.join(app.getPath('userData'), 'keys.json');
    if (fs.existsSync(p0)) {
      const d = JSON.parse(fs.readFileSync(p0, 'utf-8'));
      if (d.GEMINI_API_KEY) return d.GEMINI_API_KEY;
    }
  } catch (e) {}
  try {
    const p1 = path.join(__dirname, '..', 'data', 'keys.json');
    if (fs.existsSync(p1)) {
      const d = JSON.parse(fs.readFileSync(p1, 'utf-8'));
      if (d.GEMINI_API_KEY) return d.GEMINI_API_KEY;
    }
  } catch (e) {}
  try {
    const p2 = path.join(__dirname, '..', '..', 'mhent-aisa', 'data', 'keys.json');
    if (fs.existsSync(p2)) {
      const d = JSON.parse(fs.readFileSync(p2, 'utf-8'));
      if (d.GEMINI_API_KEY) return d.GEMINI_API_KEY;
    }
  } catch (e) {}
  return '';
}

let workspaceWatcher = null;
let watcherDebounceTimer = null;

function startWorkspaceWatcher(wsPath) {
  if (workspaceWatcher) {
    try {
      workspaceWatcher.close();
    } catch (e) {}
    workspaceWatcher = null;
  }

  if (!wsPath || !fs.existsSync(wsPath)) return;

  try {
    workspaceWatcher = fs.watch(wsPath, { recursive: true }, (eventType, filename) => {
      if (!filename) return;

      const norm = filename.replace(/\\/g, '/');
      if (
        norm.startsWith('.git/') || norm === '.git' ||
        norm.includes('/node_modules/') || norm.startsWith('node_modules/') || norm === 'node_modules' ||
        norm.includes('/dist/') || norm.startsWith('dist/') || norm === 'dist' ||
        norm.includes('/.gemini/') || norm.startsWith('.gemini/') || norm === '.gemini' ||
        norm.includes('/$RECYCLE.BIN/') || norm.startsWith('$RECYCLE.BIN/') ||
        norm.endsWith('.tmp') || norm.endsWith('~') || norm.includes('.crdownload')
      ) {
        return;
      }

      if (watcherDebounceTimer) clearTimeout(watcherDebounceTimer);
      watcherDebounceTimer = setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('horizon:workspace-changed', {
            eventType,
            filename,
            fullPath: path.join(wsPath, filename)
          });
        }
      }, 350);
    });

    workspaceWatcher.on('error', (err) => {
      console.warn('[Workspace Watcher Error]', err);
    });
  } catch (err) {
    console.warn('[Failed to start workspace watcher]', err);
  }
}

async function createWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'horizon-logo.png');

  mainWindow = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1024,
    minHeight: 680,
    frame: false, // Frameless for custom native IDE titlebar
    backgroundColor: '#07080d',
    title: 'AISA Horizon — AI-First IDE Studio (MHEnt Universe)',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false // Allow loading local media files (file://) in video/audio/img tags
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.on('focus', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('horizon:window-focused');
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    startWorkspaceWatcher(activeWorkspacePath);
  });

  mainWindow.on('closed', () => {
    if (workspaceWatcher) {
      try { workspaceWatcher.close(); } catch (e) {}
      workspaceWatcher = null;
    }
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ============================================================================
// 1. WINDOW CONTROLS (CUSTOM TITLEBAR)
// ============================================================================
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:is-maximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// ============================================================================
// 2. WORKSPACE & FILE SYSTEM (MONACO EDITOR & FILE TREE)
// ============================================================================
ipcMain.handle('horizon:get-workspace-path', () => {
  return activeWorkspacePath;
});

ipcMain.handle('horizon:get-session-state', () => {
  return getSessionState();
});

ipcMain.handle('horizon:save-session-state', (event, state) => {
  return saveSessionState(state);
});

ipcMain.handle('horizon:open-workspace-dialog', async () => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Mở Không gian làm việc (Workspace Folder) cho AISA Horizon',
    defaultPath: activeWorkspacePath,
    properties: ['openDirectory']
  });
  if (!res.canceled && res.filePaths && res.filePaths.length > 0) {
    activeWorkspacePath = path.resolve(res.filePaths[0]);
    saveWorkspaceState(activeWorkspacePath);
    startWorkspaceWatcher(activeWorkspacePath);
    return activeWorkspacePath;
  }
  return null;
});

ipcMain.handle('horizon:set-workspace-path', (event, newPath) => {
  if (fs.existsSync(newPath)) {
    activeWorkspacePath = path.resolve(newPath);
    saveWorkspaceState(activeWorkspacePath);
    startWorkspaceWatcher(activeWorkspacePath);
    return { success: true, path: activeWorkspacePath };
  }
  return { success: false, error: 'Thư mục không tồn tại' };
});

ipcMain.handle('horizon:save-api-key', (event, newKey) => {
  try {
    const userDir = app.getPath('userData');
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    fs.writeFileSync(path.join(userDir, 'keys.json'), JSON.stringify({ GEMINI_API_KEY: (newKey || '').trim() }, null, 2));
    process.env.GEMINI_API_KEY = (newKey || '').trim();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('horizon:read-dir', async (event, dirPath = null) => {
  try {
    const targetDir = path.resolve(dirPath || activeWorkspacePath);
    if (!fs.existsSync(targetDir)) {
      return { success: false, error: 'Thư mục không tồn tại' };
    }

    const entries = await fsPromises.readdir(targetDir, { withFileTypes: true });
    const items = [];

    for (const ent of entries) {
      if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === '$RECYCLE.BIN') continue;
      const full = path.join(targetDir, ent.name);
      try {
        const stats = await fsPromises.stat(full);
        items.push({
          name: ent.name,
          path: full,
          isDirectory: ent.isDirectory(),
          size: stats.size,
          mtime: stats.mtimeMs
        });
      } catch (e) {
        items.push({
          name: ent.name,
          path: full,
          isDirectory: ent.isDirectory(),
          size: 0,
          mtime: 0
        });
      }
    }

    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return { success: true, path: targetDir, items };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Smart File Reader with Media & Binary detection
ipcMain.handle('horizon:read-file', async (event, filePath) => {
  try {
    const full = path.resolve(filePath);
    if (!fs.existsSync(full)) {
      return { success: false, error: 'Tệp không tồn tại' };
    }
    const stat = await fsPromises.stat(full);
    const ext = path.extname(full).toLowerCase();
    const name = path.basename(full);

    // 1. Image files
    if (imageExts.has(ext)) {
      return {
        success: true,
        isMedia: true,
        mediaType: 'image',
        path: full,
        name,
        ext,
        size: stat.size,
        url: `file:///${full.replace(/\\/g, '/')}`
      };
    }

    // 2. Audio files
    if (audioExts.has(ext)) {
      return {
        success: true,
        isMedia: true,
        mediaType: 'audio',
        path: full,
        name,
        ext,
        size: stat.size,
        url: `file:///${full.replace(/\\/g, '/')}`
      };
    }

    // 3. Video files
    if (videoExts.has(ext)) {
      return {
        success: true,
        isMedia: true,
        mediaType: 'video',
        path: full,
        name,
        ext,
        size: stat.size,
        url: `file:///${full.replace(/\\/g, '/')}`
      };
    }

    // 4. Other non-editable binary files (exe, zip, rar, 7z, bin, etc.)
    if (binaryExts.has(ext)) {
      return {
        success: true,
        isBinary: true,
        path: full,
        name,
        ext,
        size: stat.size
      };
    }

    // 5. Text files (skip if > 15MB)
    if (stat.size > 15 * 1024 * 1024) {
      return {
        success: true,
        isBinary: true,
        path: full,
        name,
        ext,
        size: stat.size,
        message: 'Tệp quá lớn (>15MB) để mở trong trình chỉnh sửa văn bản.'
      };
    }

    const content = await fsPromises.readFile(full, 'utf-8');
    return {
      success: true,
      isText: true,
      path: full,
      name,
      ext,
      size: stat.size,
      content
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('horizon:write-file', async (event, { filePath, content }) => {
  try {
    const full = path.resolve(filePath);
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) {
      await fsPromises.mkdir(dir, { recursive: true });
    }
    await fsPromises.writeFile(full, content, 'utf-8');
    return { success: true, path: full };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('horizon:create-file', async (event, filePath) => {
  try {
    const full = path.resolve(filePath);
    if (fs.existsSync(full)) return { success: false, error: 'Tệp đã tồn tại' };
    const dir = path.dirname(full);
    if (!fs.existsSync(dir)) await fsPromises.mkdir(dir, { recursive: true });
    await fsPromises.writeFile(full, '', 'utf-8');
    return { success: true, path: full };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('horizon:create-dir', async (event, dirPath) => {
  try {
    const full = path.resolve(dirPath);
    if (fs.existsSync(full)) return { success: false, error: 'Thư mục đã tồn tại' };
    await fsPromises.mkdir(full, { recursive: true });
    return { success: true, path: full };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('horizon:delete-path', async (event, targetPath) => {
  try {
    const full = path.resolve(targetPath);
    if (!fs.existsSync(full)) return { success: false, error: 'Không tìm thấy tệp hoặc thư mục' };
    const stat = await fsPromises.stat(full);
    if (stat.isDirectory()) {
      await fsPromises.rm(full, { recursive: true, force: true });
    } else {
      await fsPromises.unlink(full);
    }
    return { success: true, path: full };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('horizon:rename-path', async (event, { oldPath, newPath }) => {
  try {
    const from = path.resolve(oldPath);
    const to = path.resolve(newPath);
    if (!fs.existsSync(from)) return { success: false, error: 'Tệp gốc không tồn tại' };
    await fsPromises.rename(from, to);
    return { success: true, path: to };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('horizon:reveal-in-explorer', (event, targetPath) => {
  try {
    const full = path.resolve(targetPath);
    shell.showItemInFolder(full);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('horizon:open-external', async (event, targetPath) => {
  try {
    const full = path.resolve(targetPath);
    await shell.openPath(full);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Drag & Drop Import Files & Folders into Target Directory
ipcMain.handle('horizon:import-files', async (event, { sourcePaths, targetDir }) => {
  try {
    const destDir = path.resolve(targetDir || activeWorkspacePath);
    if (!fs.existsSync(destDir)) {
      await fsPromises.mkdir(destDir, { recursive: true });
    }

    const imported = [];
    const errors = [];

    for (const src of (sourcePaths || [])) {
      try {
        const srcPath = path.resolve(src);
        if (!fs.existsSync(srcPath)) continue;

        const baseName = path.basename(srcPath);
        let destPath = path.join(destDir, baseName);

        // Skip if source and target are the same file
        if (srcPath.toLowerCase() === destPath.toLowerCase()) {
          continue;
        }

        // Avoid overwriting if file with same name exists
        if (fs.existsSync(destPath)) {
          const ext = path.extname(baseName);
          const nameWithoutExt = path.basename(baseName, ext);
          let counter = 1;
          while (fs.existsSync(path.join(destDir, `${nameWithoutExt} (${counter})${ext}`))) {
            counter++;
          }
          destPath = path.join(destDir, `${nameWithoutExt} (${counter})${ext}`);
        }

        const stat = await fsPromises.stat(srcPath);
        if (stat.isDirectory()) {
          await fsPromises.cp(srcPath, destPath, { recursive: true, force: true });
        } else {
          await fsPromises.copyFile(srcPath, destPath);
        }

        imported.push({
          source: srcPath,
          destination: destPath,
          name: path.basename(destPath),
          isDirectory: stat.isDirectory()
        });
      } catch (itemErr) {
        errors.push({ source: src, error: itemErr.message });
      }
    }

    return { success: true, imported, errors };
  } catch (err) {
    return { success: false, error: err.message, imported: [] };
  }
});

// Helper for recursive file traversal (ignoring heavy/hidden folders)
async function getAllWorkspaceFiles(dir, maxDepth = 6, currentDepth = 0) {
  if (currentDepth > maxDepth) return [];
  let results = [];
  try {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.name === '.git' || ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '.gemini' || ent.name === '$RECYCLE.BIN') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        const sub = await getAllWorkspaceFiles(full, maxDepth, currentDepth + 1);
        results = results.concat(sub);
      } else {
        results.push(full);
      }
    }
  } catch (e) {}
  return results;
}

ipcMain.handle('horizon:list-all-files', async () => {
  try {
    const all = await getAllWorkspaceFiles(activeWorkspacePath);
    const rels = all.map(f => ({
      fullPath: f,
      relativePath: path.relative(activeWorkspacePath, f),
      name: path.basename(f),
      ext: path.extname(f).toLowerCase()
    }));
    return { success: true, files: rels };
  } catch (err) {
    return { success: false, error: err.message, files: [] };
  }
});

const rgPath = path.join(__dirname, '..', 'bin', 'rg.exe');

async function executeRipgrep(query, { isCaseSensitive = false, isRegex = false, maxMatches = 200 } = {}) {
  if (!fs.existsSync(rgPath)) return null;
  return new Promise((resolve) => {
    const flags = ['--json', '--line-number', '-m', String(maxMatches)];
    if (!isCaseSensitive) flags.push('-i');
    if (!isRegex) flags.push('-F');
    flags.push('-e', query, '.');

    exec(`"${rgPath}" ${flags.map(f => `"${f.replace(/"/g, '\\"')}"`).join(' ')}`, {
      cwd: activeWorkspacePath,
      shell: 'powershell.exe',
      maxBuffer: 15 * 1024 * 1024
    }, (err, stdout) => {
      if (!stdout) return resolve([]);
      const fileMap = new Map();
      let totalMatches = 0;
      const lines = stdout.split(/\r?\n/);
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'match' && parsed.data) {
            const relPath = (parsed.data.path?.text || '').replace(/^(\.[\\/])*/, '');
            const fullPath = path.resolve(activeWorkspacePath, relPath);
            if (!fileMap.has(fullPath)) {
              fileMap.set(fullPath, {
                fullPath,
                relativePath: relPath,
                name: path.basename(fullPath),
                matches: []
              });
            }
            fileMap.get(fullPath).matches.push({
              lineNumber: parsed.data.line_number,
              lineContent: (parsed.data.lines?.text || '').trim()
            });
            totalMatches++;
            if (totalMatches >= maxMatches) break;
          }
        } catch (e) {}
      }
      resolve(Array.from(fileMap.values()));
    });
  });
}

// Global Text Search across Workspace Files (Ripgrep-accelerated)
ipcMain.handle('horizon:search-files', async (event, { query, isRegex = false, isCaseSensitive = false }) => {
  if (!query || !query.trim()) return { success: true, results: [], totalMatches: 0 };
  try {
    const rgResults = await executeRipgrep(query, { isRegex, isCaseSensitive });
    if (rgResults) {
      const totalCount = rgResults.reduce((acc, r) => acc + r.matches.length, 0);
      return { success: true, results: rgResults, totalMatches: totalCount, engine: 'ripgrep' };
    }

    const files = await getAllWorkspaceFiles(activeWorkspacePath);
    const results = [];
    let regex = null;

    if (isRegex) {
      try {
        regex = new RegExp(query, isCaseSensitive ? 'g' : 'gi');
      } catch (e) {
        return { success: false, error: 'Biểu thức chính quy không hợp lệ' };
      }
    }

    let matchCount = 0;
    const maxMatches = 200;

    for (const file of files) {
      if (matchCount >= maxMatches) break;
      const ext = path.extname(file).toLowerCase();
      if (imageExts.has(ext) || audioExts.has(ext) || videoExts.has(ext) || binaryExts.has(ext)) continue;

      try {
        const stat = await fsPromises.stat(file);
        if (stat.size > 2 * 1024 * 1024) continue; // Skip files > 2MB

        const content = await fsPromises.readFile(file, 'utf-8');
        const lines = content.split(/\r?\n/);
        const fileMatches = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          let matched = false;

          if (regex) {
            regex.lastIndex = 0;
            matched = regex.test(line);
          } else {
            const haystack = isCaseSensitive ? line : line.toLowerCase();
            const needle = isCaseSensitive ? query : query.toLowerCase();
            matched = haystack.includes(needle);
          }

          if (matched) {
            fileMatches.push({
              lineNumber: i + 1,
              lineContent: line.trim()
            });
            matchCount++;
            if (matchCount >= maxMatches) break;
          }
        }

        if (fileMatches.length > 0) {
          results.push({
            fullPath: file,
            relativePath: path.relative(activeWorkspacePath, file),
            name: path.basename(file),
            matches: fileMatches
          });
        }
      } catch (err) {}
    }

    return { success: true, results, totalMatches: matchCount };
  } catch (err) {
    return { success: false, error: err.message, results: [], totalMatches: 0 };
  }
});

// ============================================================================
// 3. INTEGRATED TERMINAL EXECUTION (POWERSHELL / CMD) - STREAMING PTY READY
// ============================================================================
let activeTerminalProcess = null;

ipcMain.handle('horizon:run-command-stream', async (event, { command, cwd = null }) => {
  const targetCwd = cwd || activeWorkspacePath;

  if (activeTerminalProcess && activeTerminalProcess.pid) {
    try {
      exec(`taskkill /pid ${activeTerminalProcess.pid} /T /F`);
    } catch (e) {}
    activeTerminalProcess = null;
  }

  return new Promise((resolve) => {
    try {
      const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', command], {
        cwd: targetCwd,
        env: process.env,
        shell: false
      });

      activeTerminalProcess = child;

      child.stdout.on('data', (data) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('terminal:stream-data', { type: 'stdout', text: data.toString() });
        }
      });

      child.stderr.on('data', (data) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('terminal:stream-data', { type: 'stderr', text: data.toString() });
        }
      });

      child.on('error', (err) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('terminal:stream-data', { type: 'stderr', text: err.message });
        }
        activeTerminalProcess = null;
        resolve({ success: false, error: err.message });
      });

      child.on('close', (code) => {
        if (event.sender && !event.sender.isDestroyed()) {
          event.sender.send('terminal:stream-exit', { code });
        }
        activeTerminalProcess = null;
        resolve({ success: code === 0, code });
      });

    } catch (err) {
      activeTerminalProcess = null;
      resolve({ success: false, error: err.message });
    }
  });
});

ipcMain.handle('horizon:stop-command', async () => {
  if (activeTerminalProcess && activeTerminalProcess.pid) {
    try {
      exec(`taskkill /pid ${activeTerminalProcess.pid} /T /F`);
      activeTerminalProcess = null;
      return { success: true, message: 'Đã dừng tiến trình' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false, message: 'Không có tiến trình nào đang chạy' };
});

ipcMain.handle('horizon:run-command', async (event, { command, cwd = null }) => {
  const targetCwd = cwd || activeWorkspacePath;
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: targetCwd,
        maxBuffer: 20 * 1024 * 1024,
        shell: 'powershell.exe',
        timeout: 90000
      },
      (error, stdout, stderr) => {
        resolve({
          success: !error,
          code: error ? (error.code || 1) : 0,
          stdout: stdout || '',
          stderr: stderr || (error ? error.message : ''),
          cwd: targetCwd
        });
      }
    );
  });
});

// ============================================================================
// 4. GIT SOURCE CONTROL OPERATIONS (MULTI-REPO AWARE)
// ============================================================================
// Find all git repositories in the workspace
async function discoverGitRepos(root) {
  const repos = [];
  try {
    // Check root itself
    if (fs.existsSync(path.join(root, '.git'))) {
      repos.push({ name: path.basename(root) || 'root', path: root });
    }
    // Check immediate subdirectories
    const entries = await fsPromises.readdir(root, { withFileTypes: true });
    for (const ent of entries) {
      if (ent.isDirectory() && ent.name !== 'node_modules' && ent.name !== '.gemini' && ent.name !== 'dist') {
        const sub = path.join(root, ent.name);
        if (fs.existsSync(path.join(sub, '.git'))) {
          repos.push({ name: ent.name, path: sub });
        }
      }
    }
  } catch (e) {}
  return repos;
}

ipcMain.handle('horizon:get-git-repos', async () => {
  const repos = await discoverGitRepos(activeWorkspacePath);
  return { success: true, repos };
});

function resolveRepoPath(requestedRepo) {
  if (requestedRepo && fs.existsSync(requestedRepo)) return path.resolve(requestedRepo);
  // Default to first discovered git repo or active workspace
  if (fs.existsSync(path.join(activeWorkspacePath, '.git'))) return activeWorkspacePath;
  // Try subfolders
  try {
    const entries = fs.readdirSync(activeWorkspacePath);
    for (const name of entries) {
      const sub = path.join(activeWorkspacePath, name);
      if (fs.existsSync(path.join(sub, '.git'))) return sub;
    }
  } catch (e) {}
  return activeWorkspacePath;
}

ipcMain.handle('horizon:git-status', async (event, targetRepo = null) => {
  const repoCwd = resolveRepoPath(targetRepo);
  return new Promise((resolve) => {
    exec('git rev-parse --abbrev-ref HEAD', { cwd: repoCwd, shell: 'powershell.exe' }, (err1, stdout1) => {
      if (err1) {
        return resolve({ success: false, isGit: false, repoPath: repoCwd, branch: '', staged: [], unstaged: [], changes: [] });
      }
      const branch = (stdout1 || '').trim();
      exec('git status --porcelain -uall', { cwd: repoCwd, shell: 'powershell.exe' }, (err2, stdout2) => {
        const staged = [];
        const unstaged = [];
        const changes = [];
        const lines = (stdout2 || '').split(/\r?\n/).filter(l => l.trim());

        for (const line of lines) {
          const x = line[0];
          const y = line[1];
          const file = line.slice(3).trim();
          const fullPath = path.resolve(repoCwd, file);
          const name = path.basename(file);

          const item = { status: line.slice(0, 2).trim(), file, name, fullPath };
          changes.push(item);

          if (x !== ' ' && x !== '?') {
            staged.push({ status: x, file, name, fullPath });
          }
          if (y !== ' ' || (x === '?' && y === '?')) {
            unstaged.push({ status: y === '?' ? 'U' : y, file, name, fullPath });
          }
        }
        resolve({ success: true, isGit: true, repoPath: repoCwd, branch, staged, unstaged, changes });
      });
    });
  });
});

ipcMain.handle('horizon:git-history', async (event, targetRepo = null) => {
  const repoCwd = resolveRepoPath(targetRepo);
  return new Promise((resolve) => {
    exec('git log -n 30 --pretty=format:"%H|%h|%an|%ar|%s"', { cwd: repoCwd, shell: 'powershell.exe' }, (err, stdout) => {
      if (err) return resolve({ success: false, commits: [] });
      const lines = (stdout || '').split(/\r?\n/).filter(l => l.trim());
      const commits = lines.map(line => {
        const [hash, shortHash, author, relativeTime, ...msgParts] = line.split('|');
        return {
          hash,
          shortHash,
          author,
          relativeTime,
          message: msgParts.join('|')
        };
      });
      resolve({ success: true, commits, repoPath: repoCwd });
    });
  });
});

ipcMain.handle('horizon:git-commit-files', async (event, { repoPath, commitHash }) => {
  const repoCwd = resolveRepoPath(repoPath);
  return new Promise((resolve) => {
    exec(`git diff-tree --no-commit-id --name-status -r "${commitHash}"`, { cwd: repoCwd, shell: 'powershell.exe' }, (err, stdout) => {
      if (err) return resolve({ success: false, files: [] });
      const lines = (stdout || '').split(/\r?\n/).filter(l => l.trim());
      const files = lines.map(l => {
        const parts = l.split(/\s+/);
        return { status: parts[0], file: parts.slice(1).join(' ') };
      });
      resolve({ success: true, files });
    });
  });
});

ipcMain.handle('horizon:git-stage-file', async (event, { repoPath, filePath }) => {
  const repoCwd = resolveRepoPath(repoPath);
  const rel = path.relative(repoCwd, filePath).replace(/\\/g, '/');
  return new Promise((resolve) => {
    exec(`git add "${rel}"`, { cwd: repoCwd, shell: 'powershell.exe' }, (err, stdout, stderr) => {
      resolve({ success: !err, error: stderr || (err ? err.message : '') });
    });
  });
});

ipcMain.handle('horizon:git-unstage-file', async (event, { repoPath, filePath }) => {
  const repoCwd = resolveRepoPath(repoPath);
  const rel = path.relative(repoCwd, filePath).replace(/\\/g, '/');
  return new Promise((resolve) => {
    exec(`git reset HEAD "${rel}"`, { cwd: repoCwd, shell: 'powershell.exe' }, (err, stdout, stderr) => {
      resolve({ success: !err, error: stderr || (err ? err.message : '') });
    });
  });
});

ipcMain.handle('horizon:git-discard-file', async (event, { repoPath, filePath }) => {
  const repoCwd = resolveRepoPath(repoPath);
  const rel = path.relative(repoCwd, filePath).replace(/\\/g, '/');
  return new Promise((resolve) => {
    exec(`git checkout -- "${rel}"; git clean -fd "${rel}"`, { cwd: repoCwd, shell: 'powershell.exe' }, (err, stdout, stderr) => {
      resolve({ success: !err, error: stderr || (err ? err.message : '') });
    });
  });
});

ipcMain.handle('horizon:git-commit', async (event, { repoPath, message }) => {
  const repoCwd = resolveRepoPath(repoPath);
  const safeMsg = (message || 'update').replace(/"/g, '\\"');
  return new Promise((resolve) => {
    exec(`git add -A; git commit -m "${safeMsg}"`, { cwd: repoCwd, shell: 'powershell.exe' }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        stdout: stdout || '',
        stderr: stderr || (err ? err.message : '')
      });
    });
  });
});

ipcMain.handle('horizon:git-push', async (event, repoPath = null) => {
  const repoCwd = resolveRepoPath(repoPath);
  return new Promise((resolve) => {
    exec('git push', { cwd: repoCwd, shell: 'powershell.exe' }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        stdout: stdout || '',
        stderr: stderr || (err ? err.message : '')
      });
    });
  });
});

ipcMain.handle('horizon:git-pull', async (event, repoPath = null) => {
  const repoCwd = resolveRepoPath(repoPath);
  return new Promise((resolve) => {
    exec('git pull', { cwd: repoCwd, shell: 'powershell.exe' }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        stdout: stdout || '',
        stderr: stderr || (err ? err.message : '')
      });
    });
  });
});

ipcMain.handle('horizon:git-diff', async (event, { repoPath, filePath }) => {
  const repoCwd = resolveRepoPath(repoPath);
  const relPath = path.relative(repoCwd, filePath).replace(/\\/g, '/');
  return new Promise((resolve) => {
    exec(`git show HEAD:"${relPath}"`, { cwd: repoCwd, shell: 'powershell.exe', maxBuffer: 10 * 1024 * 1024 }, async (err1, stdoutOriginal) => {
      const original = err1 ? '' : stdoutOriginal;
      let working = '';
      try {
        if (fs.existsSync(filePath)) {
          working = await fsPromises.readFile(filePath, 'utf-8');
        }
      } catch (e) {}

      exec(`git diff HEAD -- "${relPath}"`, { cwd: repoCwd, shell: 'powershell.exe' }, (err2, stdoutDiff) => {
        resolve({
          success: true,
          original,
          working,
          diffText: stdoutDiff || ''
        });
      });
    });
  });
});

// ============================================================================
// 5. API KEYS & COPILOT CORE
// ============================================================================
ipcMain.handle('horizon:get-api-key', () => {
  return getApiKey();
});

// ============================================================================
// 6. AUTONOMOUS AI AGENT EXECUTION ENGINE & CHECKPOINT ROLLBACK
// ============================================================================
const agentActionHistory = [];

async function createBackup(filePath) {
  try {
    const backupDir = path.join(activeWorkspacePath, '.horizon', 'backups');
    if (!fs.existsSync(backupDir)) {
      await fsPromises.mkdir(backupDir, { recursive: true });
    }
    const full = path.isAbsolute(filePath) ? filePath : path.resolve(activeWorkspacePath, filePath);
    if (fs.existsSync(full)) {
      const timestamp = Date.now();
      const safeName = path.relative(activeWorkspacePath, full).replace(/[\\/:]/g, '_');
      const backupPath = path.join(backupDir, `${timestamp}_${safeName}.bak`);
      await fsPromises.copyFile(full, backupPath);
      const record = { backupPath, originalPath: full, timestamp };
      agentActionHistory.push(record);
      if (agentActionHistory.length > 50) agentActionHistory.shift();
      return record;
    }
  } catch (e) {
    console.error('Backup error:', e);
  }
  return null;
}

ipcMain.handle('horizon:replace-file-content', async (event, { filePath, targetContent, replacementContent }) => {
  try {
    const full = path.isAbsolute(filePath) ? filePath : path.resolve(activeWorkspacePath, filePath);
    if (!fs.existsSync(full)) return { success: false, error: `Tệp không tồn tại: ${filePath}` };

    const fileContent = await fsPromises.readFile(full, 'utf-8');
    if (!fileContent.includes(targetContent)) {
      return { success: false, error: 'Không tìm thấy đoạn mã mục tiêu (targetContent) trong tệp.' };
    }

    // Tạo bản backup snapshot trước khi chỉnh sửa
    const backup = await createBackup(full);

    // Thay thế đoạn mã
    const newContent = fileContent.replace(targetContent, replacementContent);
    await fsPromises.writeFile(full, newContent, 'utf-8');

    return {
      success: true,
      path: full,
      backupPath: backup ? backup.backupPath : null
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('horizon:undo-last-agent-action', async () => {
  if (agentActionHistory.length === 0) {
    return { success: false, message: 'Không có hành động nào gần đây để hoàn tác.' };
  }
  const last = agentActionHistory.pop();
  try {
    if (fs.existsSync(last.backupPath)) {
      await fsPromises.copyFile(last.backupPath, last.originalPath);
      await fsPromises.unlink(last.backupPath);
      return {
        success: true,
        restoredFile: last.originalPath,
        message: `Đã hoàn tác và khôi phục an toàn tệp: ${path.basename(last.originalPath)}`
      };
    }
    return { success: false, message: 'Bản sao lưu không còn tồn tại.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('horizon:agent-execute-tool', async (event, { toolName, args }) => {
  try {
    switch (toolName) {
      case 'read_file': {
        const full = path.isAbsolute(args.filePath) ? args.filePath : path.resolve(activeWorkspacePath, args.filePath);
        if (!fs.existsSync(full)) return { success: false, error: `Không tìm thấy tệp: ${args.filePath}` };
        const content = await fsPromises.readFile(full, 'utf-8');
        const lines = content.split(/\r?\n/);
        const start = args.startLine ? Math.max(1, parseInt(args.startLine)) - 1 : 0;
        const end = args.endLine ? Math.min(lines.length, parseInt(args.endLine)) : lines.length;
        const sliced = lines.slice(start, end).join('\n');
        return { success: true, content: sliced, totalLines: lines.length };
      }

      case 'write_to_file': {
        const full = path.isAbsolute(args.filePath) ? args.filePath : path.resolve(activeWorkspacePath, args.filePath);
        const dir = path.dirname(full);
        if (!fs.existsSync(dir)) await fsPromises.mkdir(dir, { recursive: true });
        await createBackup(full);
        await fsPromises.writeFile(full, args.content, 'utf-8');
        return { success: true, filePath: full, message: `Đã ghi thành công tệp ${path.basename(full)}` };
      }

      case 'replace_file_content': {
        const full = path.isAbsolute(args.filePath) ? args.filePath : path.resolve(activeWorkspacePath, args.filePath);
        if (!fs.existsSync(full)) return { success: false, error: `Tệp không tồn tại: ${args.filePath}` };
        const original = await fsPromises.readFile(full, 'utf-8');
        if (!original.includes(args.targetContent)) {
          return { success: false, error: 'Không tìm thấy targetContent trong tệp.' };
        }
        await createBackup(full);
        const updated = original.replace(args.targetContent, args.replacementContent);
        await fsPromises.writeFile(full, updated, 'utf-8');
        return { success: true, filePath: full, message: `Đã thay thế nội dung trong ${path.basename(full)}` };
      }

      case 'list_dir': {
        const targetDir = args.dirPath
          ? (path.isAbsolute(args.dirPath) ? args.dirPath : path.resolve(activeWorkspacePath, args.dirPath))
          : activeWorkspacePath;
        if (!fs.existsSync(targetDir)) return { success: false, error: `Thư mục không tồn tại: ${args.dirPath}` };
        const entries = await fsPromises.readdir(targetDir, { withFileTypes: true });
        const items = entries
          .filter(e => !['.git', 'node_modules', 'dist', '.gemini'].includes(e.name))
          .map(e => ({
            name: e.name,
            isDirectory: e.isDirectory(),
            path: path.join(targetDir, e.name)
          }));
        return { success: true, dir: targetDir, items };
      }

      case 'grep_search': {
        const query = args.query;
        const isCaseSensitive = !!args.isCaseSensitive;

        // Ưu tiên Ripgrep siêu tốc
        const rgResults = await executeRipgrep(query, { isCaseSensitive, isRegex: false, maxMatches: 50 });
        if (rgResults) {
          const flatMatches = [];
          for (const item of rgResults) {
            for (const m of item.matches) {
              flatMatches.push({
                file: item.relativePath,
                lineNumber: m.lineNumber,
                lineContent: m.lineContent
              });
              if (flatMatches.length >= 50) break;
            }
            if (flatMatches.length >= 50) break;
          }
          return { success: true, query, totalMatches: flatMatches.length, matches: flatMatches, engine: 'ripgrep' };
        }

        const allFiles = await getAllWorkspaceFiles(activeWorkspacePath);
        const matches = [];

        for (const file of allFiles) {
          if (matches.length >= 50) break;
          const ext = path.extname(file).toLowerCase();
          if (imageExts.has(ext) || audioExts.has(ext) || videoExts.has(ext) || binaryExts.has(ext)) continue;

          try {
            const stat = await fsPromises.stat(file);
            if (stat.size > 2 * 1024 * 1024) continue;
            const content = await fsPromises.readFile(file, 'utf-8');
            const lines = content.split(/\r?\n/);

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              const match = isCaseSensitive ? line.includes(query) : line.toLowerCase().includes(query.toLowerCase());
              if (match) {
                matches.push({
                  file: path.relative(activeWorkspacePath, file),
                  lineNumber: i + 1,
                  lineContent: line.trim()
                });
                if (matches.length >= 50) break;
              }
            }
          } catch (e) {}
        }
        return { success: true, query, totalMatches: matches.length, matches };
      }

      case 'run_command': {
        const cwd = args.cwd ? (path.isAbsolute(args.cwd) ? args.cwd : path.resolve(activeWorkspacePath, args.cwd)) : activeWorkspacePath;
        return new Promise((resolve) => {
          exec(args.command, { cwd, shell: 'powershell.exe', maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
            resolve({
              success: !err,
              stdout: stdout || '',
              stderr: stderr || (err ? err.message : ''),
              exitCode: err ? (err.code || 1) : 0
            });
          });
        });
      }

      default:
        return { success: false, error: `Công cụ không xác định: ${toolName}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Ollama Local Detection & Dynamic Model Discovery
ipcMain.handle('horizon:check-ollama', async (event, customUrl) => {
  const hosts = [];
  if (customUrl && typeof customUrl === 'string' && customUrl.trim()) {
    hosts.push(customUrl.trim().replace(/\/+$/, ''));
  }
  hosts.push('http://127.0.0.1:11434', 'http://localhost:11434');

  for (const host of hosts) {
    try {
      const res = await fetch(`${host}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const data = await res.json();
        return {
          online: true,
          connected: true,
          host,
          models: (data.models || []).map(m => ({
            name: m.name,
            model: m.model,
            size: m.size,
            details: m.details
          }))
        };
      }
    } catch (e) {}
  }
  return { online: false, connected: false, models: [] };
});

// Ollama Local Chat Execution (Main Process Bridge to avoid CORS / IPv6 issues)
ipcMain.handle('horizon:ollama-chat', async (event, { model, messages, baseUrl }) => {
  const host = baseUrl || 'http://127.0.0.1:11434';
  try {
    const res = await fetch(`${host}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model || 'qwen2.5:7b',
        messages: messages || [],
        stream: false
      })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { success: false, error: `Ollama trả về mã lỗi HTTP ${res.status}: ${errText}` };
    }
    const data = await res.json();
    return { success: true, message: data.message?.content || '', raw: data };
  } catch (err) {
    return { success: false, error: `Không thể kết nối tới Ollama (${err.message}). Cậu đảm bảo Ollama đang chạy ở cổng 11434 nhé!` };
  }
});

// Dynamic Gemini Models Auto-Discovery via API
ipcMain.handle('horizon:list-gemini-models', async (event, passedKey) => {
  const key = passedKey || getApiKey();
  if (!key) return { success: false, error: 'Chưa có Gemini API Key' };

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      return { success: false, error: `Google API trả về mã lỗi ${res.status}` };
    }
    const data = await res.json();
    const generationModels = (data.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
      .filter(m => !m.name.includes('vision') && !m.name.includes('embedding') && !m.name.includes('aqa') && !m.name.includes('tts'))
      .map(m => ({
        id: m.name.replace('models/', ''),
        displayName: m.displayName || m.name.replace('models/', ''),
        description: m.description || '',
        inputTokenLimit: m.inputTokenLimit,
        outputTokenLimit: m.outputTokenLimit
      }));

    return { success: true, models: generationModels };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

