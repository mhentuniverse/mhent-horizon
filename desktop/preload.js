/**
 * AISA HORIZON - PRELOAD BRIDGE
 * Exposes Native IDE APIs to the Monaco Editor & Copilot Renderer
 * Miyazaki Haruto Entertainment Co., Ltd.
 */

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('AisaHorizon', {
  isDesktop: true,
  platform: process.platform,

  // Window Controls (Custom Frameless Titlebar)
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),

  // Workspace Operations & File System Watcher
  getWorkspacePath: () => ipcRenderer.invoke('horizon:get-workspace-path'),
  openWorkspaceDialog: () => ipcRenderer.invoke('horizon:open-workspace-dialog'),
  setWorkspacePath: (newPath) => ipcRenderer.invoke('horizon:set-workspace-path', newPath),
  readDir: (dirPath = null) => ipcRenderer.invoke('horizon:read-dir', dirPath),
  onWorkspaceChanged: (callback) => ipcRenderer.on('horizon:workspace-changed', (event, val) => callback(val)),
  onWindowFocused: (callback) => ipcRenderer.on('horizon:window-focused', (event, val) => callback(val)),
  getSessionState: () => ipcRenderer.invoke('horizon:get-session-state'),
  saveSessionState: (state) => ipcRenderer.invoke('horizon:save-session-state', state),

  // File Operations (Monaco Editor & Media Integration)
  readFile: (filePath) => ipcRenderer.invoke('horizon:read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('horizon:write-file', { filePath, content }),
  createFile: (filePath) => ipcRenderer.invoke('horizon:create-file', filePath),
  createDir: (dirPath) => ipcRenderer.invoke('horizon:create-dir', dirPath),
  deletePath: (targetPath) => ipcRenderer.invoke('horizon:delete-path', targetPath),
  renamePath: (oldPath, newPath) => ipcRenderer.invoke('horizon:rename-path', { oldPath, newPath }),
  revealInExplorer: (targetPath) => ipcRenderer.invoke('horizon:reveal-in-explorer', targetPath),
  openExternal: (targetPath) => ipcRenderer.invoke('horizon:open-external', targetPath),
  searchFiles: (params) => ipcRenderer.invoke('horizon:search-files', params),
  listAllFiles: () => ipcRenderer.invoke('horizon:list-all-files'),

  // Drag & Drop Import & Path Resolution
  importFiles: (sourcePaths, targetDir) => ipcRenderer.invoke('horizon:import-files', { sourcePaths, targetDir }),
  getPathForFile: (file) => {
    try {
      if (webUtils && typeof webUtils.getPathForFile === 'function') {
        return webUtils.getPathForFile(file);
      }
    } catch (e) {}
    return file?.path || '';
  },

  // Git Source Control (Multi-Repo Support)
  getGitRepos: () => ipcRenderer.invoke('horizon:get-git-repos'),
  gitStatus: (repoPath = null) => ipcRenderer.invoke('horizon:git-status', repoPath),
  gitHistory: (repoPath = null) => ipcRenderer.invoke('horizon:git-history', repoPath),
  gitCommitFiles: (repoPath, commitHash) => ipcRenderer.invoke('horizon:git-commit-files', { repoPath, commitHash }),
  gitStageFile: (repoPath, filePath) => ipcRenderer.invoke('horizon:git-stage-file', { repoPath, filePath }),
  gitUnstageFile: (repoPath, filePath) => ipcRenderer.invoke('horizon:git-unstage-file', { repoPath, filePath }),
  gitDiscardFile: (repoPath, filePath) => ipcRenderer.invoke('horizon:git-discard-file', { repoPath, filePath }),
  gitCommit: (repoPath, message) => ipcRenderer.invoke('horizon:git-commit', { repoPath, message }),
  gitPush: (repoPath = null) => ipcRenderer.invoke('horizon:git-push', repoPath),
  gitPull: (repoPath = null) => ipcRenderer.invoke('horizon:git-pull', repoPath),
  gitDiff: (repoPath, filePath) => ipcRenderer.invoke('horizon:git-diff', { repoPath, filePath }),

  // Integrated Terminal Runner (PowerShell / CMD) - Streaming & Interactive
  runCommand: (command, cwd = null) => ipcRenderer.invoke('horizon:run-command', { command, cwd }),
  runCommandStream: (command, cwd = null) => ipcRenderer.invoke('horizon:run-command-stream', { command, cwd }),
  stopCommand: () => ipcRenderer.invoke('horizon:stop-command'),
  onTerminalStreamData: (callback) => ipcRenderer.on('terminal:stream-data', (event, val) => callback(val)),
  onTerminalStreamExit: (callback) => ipcRenderer.on('terminal:stream-exit', (event, val) => callback(val)),

  // Gemini API Key for Copilot & Agent
  getApiKey: () => ipcRenderer.invoke('horizon:get-api-key'),
  saveApiKey: (key) => ipcRenderer.invoke('horizon:save-api-key', key),

  // Autonomous Agent Tool Execution & Safety
  replaceFileContent: (filePath, targetContent, replacementContent) => ipcRenderer.invoke('horizon:replace-file-content', { filePath, targetContent, replacementContent }),
  agentExecuteTool: (toolName, args) => ipcRenderer.invoke('horizon:agent-execute-tool', { toolName, args }),
  undoLastAgentAction: () => ipcRenderer.invoke('horizon:undo-last-agent-action'),
  checkOllama: (customUrl = null) => ipcRenderer.invoke('horizon:check-ollama', customUrl),
  ollamaChat: (params) => ipcRenderer.invoke('horizon:ollama-chat', params),
  listGeminiModels: (apiKey = null) => ipcRenderer.invoke('horizon:list-gemini-models', apiKey)
});

