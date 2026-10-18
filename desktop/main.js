/**
 * AISA HORIZON - AI-FIRST IDE STUDIO
 * Main Electron Desktop Controller
 * Miyazaki Haruto Entertainment Co., Ltd.
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const { exec, spawn } = require('child_process');

let mainWindow = null;

// Default workspace is the MHEnt Universe root folder
let activeWorkspacePath = path.resolve(__dirname, '..', '..');

function getApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
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

async function createWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'horizon-logo.png');

  mainWindow = new BrowserWindow({
    width: 1520,
    height: 940,
    minWidth: 980,
    minHeight: 640,
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
      webSecurity: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));

  mainWindow.on('closed', () => {
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

ipcMain.handle('horizon:open-workspace-dialog', async () => {
  if (!mainWindow) return null;
  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Mở Không gian làm việc (Workspace Folder) cho AISA Horizon',
    defaultPath: activeWorkspacePath,
    properties: ['openDirectory']
  });
  if (!res.canceled && res.filePaths && res.filePaths.length > 0) {
    activeWorkspacePath = path.resolve(res.filePaths[0]);
    return activeWorkspacePath;
  }
  return null;
});

ipcMain.handle('horizon:set-workspace-path', (event, newPath) => {
  if (fs.existsSync(newPath)) {
    activeWorkspacePath = path.resolve(newPath);
    return { success: true, path: activeWorkspacePath };
  }
  return { success: false, error: 'Thư mục không tồn tại' };
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

ipcMain.handle('horizon:read-file', async (event, filePath) => {
  try {
    const full = path.resolve(filePath);
    if (!fs.existsSync(full)) {
      return { success: false, error: 'Tệp không tồn tại' };
    }
    const stat = await fsPromises.stat(full);
    if (stat.size > 20 * 1024 * 1024) {
      return { success: false, error: 'Tệp quá lớn (>20MB) để mở trong IDE' };
    }
    const content = await fsPromises.readFile(full, 'utf-8');
    return {
      success: true,
      path: full,
      name: path.basename(full),
      ext: path.extname(full).toLowerCase(),
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

// Global Text Search across Workspace Files (ripgrep-like search)
ipcMain.handle('horizon:search-files', async (event, { query, isRegex = false, caseSensitive = false }) => {
  if (!query || !query.trim()) return { success: true, results: [] };
  try {
    const files = await getAllWorkspaceFiles(activeWorkspacePath);
    const binaryExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.zip', '.rar', '.exe', '.dll', '.mp4', '.mp3', '.wav', '.woff', '.woff2', '.ttf']);
    const results = [];
    let regex = null;

    if (isRegex) {
      try {
        regex = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } catch (e) {
        return { success: false, error: 'Biểu thức chính quy không hợp lệ' };
      }
    }

    let matchCount = 0;
    const maxMatches = 150;

    for (const file of files) {
      if (matchCount >= maxMatches) break;
      const ext = path.extname(file).toLowerCase();
      if (binaryExts.has(ext)) continue;

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
            const haystack = caseSensitive ? line : line.toLowerCase();
            const needle = caseSensitive ? query : query.toLowerCase();
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
    return { success: false, error: err.message, results: [] };
  }
});

// ============================================================================
// 3. INTEGRATED TERMINAL EXECUTION (POWERSHELL / CMD)
// ============================================================================
ipcMain.handle('horizon:run-command', async (event, { command, cwd = null }) => {
  const targetCwd = cwd || activeWorkspacePath;
  return new Promise((resolve) => {
    exec(
      command,
      {
        cwd: targetCwd,
        maxBuffer: 15 * 1024 * 1024,
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
// 4. GIT SOURCE CONTROL OPERATIONS
// ============================================================================
ipcMain.handle('horizon:git-status', async () => {
  return new Promise((resolve) => {
    exec('git rev-parse --abbrev-ref HEAD', { cwd: activeWorkspacePath }, (err1, stdout1) => {
      if (err1) {
        return resolve({ isGit: false, branch: '', changes: [] });
      }
      const branch = (stdout1 || '').trim();
      exec('git status --porcelain', { cwd: activeWorkspacePath }, (err2, stdout2) => {
        const changes = [];
        const lines = (stdout2 || '').split('\n').filter(l => l.trim());
        for (const line of lines) {
          const status = line.slice(0, 2).trim();
          const file = line.slice(3).trim();
          changes.push({
            status,
            file,
            name: path.basename(file),
            fullPath: path.resolve(activeWorkspacePath, file)
          });
        }
        resolve({ isGit: true, branch, changes });
      });
    });
  });
});

ipcMain.handle('horizon:git-commit', async (event, message) => {
  const safeMsg = (message || 'update').replace(/"/g, '\\"');
  return new Promise((resolve) => {
    exec(`git add -A; git commit -m "${safeMsg}"`, { cwd: activeWorkspacePath, shell: 'powershell.exe' }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        stdout: stdout || '',
        stderr: stderr || (err ? err.message : '')
      });
    });
  });
});

ipcMain.handle('horizon:git-push', async () => {
  return new Promise((resolve) => {
    exec('git push', { cwd: activeWorkspacePath, shell: 'powershell.exe' }, (err, stdout, stderr) => {
      resolve({
        success: !err,
        stdout: stdout || '',
        stderr: stderr || (err ? err.message : '')
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
