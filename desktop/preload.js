/**
 * AISA HORIZON - PRELOAD BRIDGE
 * Exposes Native IDE APIs to the Monaco Editor & Copilot Renderer
 * Miyazaki Haruto Entertainment Co., Ltd.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('AisaHorizon', {
  isDesktop: true,
  platform: process.platform,

  // Window Controls (Custom Frameless Titlebar)
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),

  // Workspace Operations
  getWorkspacePath: () => ipcRenderer.invoke('horizon:get-workspace-path'),
  openWorkspaceDialog: () => ipcRenderer.invoke('horizon:open-workspace-dialog'),
  setWorkspacePath: (newPath) => ipcRenderer.invoke('horizon:set-workspace-path', newPath),
  readDir: (dirPath = null) => ipcRenderer.invoke('horizon:read-dir', dirPath),

  // File Operations (Monaco Editor Integration)
  readFile: (filePath) => ipcRenderer.invoke('horizon:read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('horizon:write-file', { filePath, content }),
  createFile: (filePath) => ipcRenderer.invoke('horizon:create-file', filePath),
  createDir: (dirPath) => ipcRenderer.invoke('horizon:create-dir', dirPath),
  deletePath: (targetPath) => ipcRenderer.invoke('horizon:delete-path', targetPath),
  renamePath: (oldPath, newPath) => ipcRenderer.invoke('horizon:rename-path', { oldPath, newPath }),
  revealInExplorer: (targetPath) => ipcRenderer.invoke('horizon:reveal-in-explorer', targetPath),
  searchFiles: (params) => ipcRenderer.invoke('horizon:search-files', params),
  listAllFiles: () => ipcRenderer.invoke('horizon:list-all-files'),

  // Git Source Control
  gitStatus: () => ipcRenderer.invoke('horizon:git-status'),
  gitCommit: (message) => ipcRenderer.invoke('horizon:git-commit', message),
  gitPush: () => ipcRenderer.invoke('horizon:git-push'),

  // Integrated Terminal Runner (PowerShell / CMD)
  runCommand: (command, cwd = null) => ipcRenderer.invoke('horizon:run-command', { command, cwd }),

  // Gemini API Key for Copilot & Agent
  getApiKey: () => ipcRenderer.invoke('horizon:get-api-key')
});
