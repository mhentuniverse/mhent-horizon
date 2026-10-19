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

// Default workspace is the MHEnt Universe root folder
let activeWorkspacePath = path.resolve(__dirname, '..', '..');

// File extension categories
const imageExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico']);
const audioExts = new Set(['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac']);
const videoExts = new Set(['.mp4', '.webm', '.mov', '.mkv', '.avi']);
const binaryExts = new Set(['.exe', '.dll', '.zip', '.rar', '.7z', '.tar', '.gz', '.bin', '.iso', '.pdf', '.docx', '.xlsx', '.pptx', '.sys', '.dat']);

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

// Global Text Search across Workspace Files
ipcMain.handle('horizon:search-files', async (event, { query, isRegex = false, isCaseSensitive = false }) => {
  if (!query || !query.trim()) return { success: true, results: [], totalMatches: 0 };
  try {
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
// 3. INTEGRATED TERMINAL EXECUTION (POWERSHELL / CMD)
// ============================================================================
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
