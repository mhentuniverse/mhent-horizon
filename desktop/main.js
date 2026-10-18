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
        timeout: 60000
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
// 4. API KEYS & COPILOT CORE
// ============================================================================
ipcMain.handle('horizon:get-api-key', () => {
  return getApiKey();
});
