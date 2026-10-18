/**
 * AISA HORIZON - MASTER IDE STUDIO CONTROLLER
 * Full Monaco Editor, Recursive File Explorer, Workspace Search, Git Control,
 * Inline AI Code Generator (Ctrl+K), Quick Open (Ctrl+P), PowerShell Terminal,
 * Google Antigravity Sidecar Agent with Thinking Accordions, and Companion Mascot
 * 
 * Miyazaki Haruto Entertainment Co., Ltd.
 */

window.AisaHorizonApp = {
  editor: null,
  activeWorkspace: '',
  openTabs: [], // Array of { path, name, ext, lang, model, isDirty }
  activeTabPath: null,
  geminiKey: '',
  currentMode: 'agent', // 'agent' | 'chat' | 'review'
  allWorkspaceFiles: [], // Cache for Ctrl+P
  searchFlags: { isCase: false, isRegex: false },
  expandedFolders: new Set(), // Set of folder paths currently expanded in tree
  selectedContextPath: null, // For right-click context menu

  async init() {
    console.log('%c[AISA Horizon IDE] Initializing Celestial Studio...', 'color: #38bdf8; font-weight: bold;');

    // 1. Setup Window & Titlebar Controls
    this.setupTitlebarControls();

    // 2. Load API Key and Active Workspace
    if (window.AisaHorizon) {
      try {
        this.geminiKey = await window.AisaHorizon.getApiKey();
        this.activeWorkspace = await window.AisaHorizon.getWorkspacePath();
      } catch (err) {
        console.error('Error getting initial horizon state:', err);
      }
    }
    if (!this.activeWorkspace) {
      this.activeWorkspace = 'c:\\Users\\Yorutsuki Yurika\\Documents\\Miyazaki Haruto Entertainment Co., Ltd. - Project MHEnt. Universe';
    }

    this.updateWorkspaceUI(this.activeWorkspace);

    // 3. Initialize Monaco Editor
    this.initMonaco();

    // 4. Setup Activity Bar & Subpanel Navigation
    this.setupActivityBar();

    // 5. Load File Explorer
    await this.refreshFileTree();

    // 6. Setup Workspace Search
    this.setupSearchPanel();

    // 7. Setup Git Source Control
    this.setupGitPanel();

    // 8. Setup Terminal Runner
    this.setupTerminal();

    // 9. Setup Antigravity Sidecar Agent & Modes
    this.setupAgentSidecar();

    // 10. Setup Inline AI Code Generator (Ctrl+K)
    this.setupInlineAI();

    // 11. Setup Quick Open Modal (Ctrl+P)
    this.setupQuickOpen();

    // 12. Setup File Context Menu
    this.setupContextMenu();

    // 13. Setup Floating Companion Mascot
    this.setupMascotWidget();

    // 14. Setup Global Keyboard Shortcuts
    this.setupKeybindings();

    this.mascotSay('🌸 Harmony: Chào Sakura yêu dấu! Studio Horizon v2.0 đã sẵn sàng cùng cậu kiến tạo vũ trụ! ✨');
  },

  // ==========================================================================
  // 1. TITLEBAR & WORKSPACE STATE
  // ==========================================================================
  setupTitlebarControls() {
    const btnMin = document.getElementById('btn-win-min');
    const btnMax = document.getElementById('btn-win-max');
    const btnClose = document.getElementById('btn-win-close');

    if (btnMin) btnMin.addEventListener('click', () => window.AisaHorizon?.minimizeWindow());
    if (btnMax) btnMax.addEventListener('click', () => window.AisaHorizon?.maximizeWindow());
    if (btnClose) btnClose.addEventListener('click', () => window.AisaHorizon?.closeWindow());

    const btnChangeWs = document.getElementById('btn-change-workspace');
    if (btnChangeWs) {
      btnChangeWs.addEventListener('click', async () => {
        const newPath = await window.AisaHorizon?.openWorkspaceDialog();
        if (newPath) {
          this.activeWorkspace = newPath;
          this.expandedFolders.clear();
          this.updateWorkspaceUI(newPath);
          await this.refreshFileTree();
          await this.refreshGitStatus();
          this.mascotSay(`Đã chuyển sang không gian: ${newPath.split(/[\\/]/).pop()} 📂`);
        }
      });
    }

    const btnRunCode = document.getElementById('btn-run-code');
    if (btnRunCode) {
      btnRunCode.addEventListener('click', () => this.runActiveFile());
    }

    const btnToggleCopilot = document.getElementById('btn-toggle-copilot');
    const copilotPanel = document.getElementById('horizon-copilot-panel');
    if (btnToggleCopilot && copilotPanel) {
      btnToggleCopilot.addEventListener('click', () => {
        const isHidden = copilotPanel.style.display === 'none';
        copilotPanel.style.display = isHidden ? 'flex' : 'none';
        btnToggleCopilot.classList.toggle('active', isHidden);
      });
    }
  },

  updateWorkspaceUI(wsPath) {
    const label = document.getElementById('active-workspace-name');
    const sbLabel = document.getElementById('sb-workspace-status');
    const termCwd = document.getElementById('terminal-cwd-label');
    const sideWsLabel = document.getElementById('sidebar-workspace-label');
    const folderName = wsPath.split(/[\\/]/).pop() || wsPath;

    if (label) label.textContent = folderName;
    if (sideWsLabel) sideWsLabel.textContent = folderName.toUpperCase();
    if (sbLabel) sbLabel.textContent = `Workspace: ${folderName}`;
    if (termCwd) termCwd.textContent = `(${wsPath})`;
    this.updateBreadcrumbs();
  },

  updateBreadcrumbs() {
    const breadcrumbCurrent = document.getElementById('breadcrumb-current-file');
    const contextActive = document.getElementById('context-active-filename');

    if (!this.activeTabPath) {
      if (breadcrumbCurrent) breadcrumbCurrent.textContent = 'Chưa mở tệp';
      if (contextActive) contextActive.textContent = 'Chưa chọn tệp';
      return;
    }

    const relPath = this.activeTabPath.replace(this.activeWorkspace, '').replace(/^[\\/]/, '');
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = relPath.replace(/\\/g, ' / ');
    if (contextActive) contextActive.textContent = relPath.split(/[\\/]/).pop();
  },

  // ==========================================================================
  // 2. ACTIVITY BAR & SUBPANELS
  // ==========================================================================
  setupActivityBar() {
    const actBtns = {
      'act-btn-explorer': document.getElementById('panel-explorer'),
      'act-btn-search': document.getElementById('panel-search'),
      'act-btn-git': document.getElementById('panel-git')
    };

    const switchPanel = (activeId) => {
      Object.keys(actBtns).forEach(id => {
        const btn = document.getElementById(id);
        const panel = actBtns[id];
        if (id === activeId) {
          btn?.classList.add('active');
          if (panel) panel.style.display = 'flex';
        } else {
          btn?.classList.remove('active');
          if (panel) panel.style.display = 'none';
        }
      });
    };

    document.getElementById('act-btn-explorer')?.addEventListener('click', () => switchPanel('act-btn-explorer'));
    document.getElementById('act-btn-search')?.addEventListener('click', () => {
      switchPanel('act-btn-search');
      document.getElementById('workspace-search-input')?.focus();
    });
    document.getElementById('act-btn-git')?.addEventListener('click', () => {
      switchPanel('act-btn-git');
      this.refreshGitStatus();
    });

    const actBtnTerm = document.getElementById('act-btn-terminal');
    const termPanel = document.getElementById('terminal-panel');
    if (actBtnTerm && termPanel) {
      actBtnTerm.addEventListener('click', () => {
        const isHidden = termPanel.style.display === 'none';
        termPanel.style.display = isHidden ? 'flex' : 'none';
        actBtnTerm.classList.toggle('active', isHidden);
        if (isHidden) document.getElementById('terminal-input')?.focus();
      });
    }

    const actBtnCopilot = document.getElementById('act-btn-copilot');
    const copilotPanel = document.getElementById('horizon-copilot-panel');
    if (actBtnCopilot && copilotPanel) {
      actBtnCopilot.addEventListener('click', () => {
        const isHidden = copilotPanel.style.display === 'none';
        copilotPanel.style.display = isHidden ? 'flex' : 'none';
        actBtnCopilot.classList.toggle('active', isHidden);
      });
    }

    const actBtnSettings = document.getElementById('act-btn-settings');
    if (actBtnSettings) {
      actBtnSettings.addEventListener('click', () => {
        const key = prompt('Cập nhật Google Gemini API Key cho Horizon Studio:', this.geminiKey || '');
        if (key !== null) {
          this.geminiKey = key.trim();
          localStorage.setItem('mhent_ai_api_key', this.geminiKey);
          this.mascotSay('🌸 Harmony: Đã lưu API Key thành công! Studio đã sẵn sàng bung hết sức mạnh! ✨');
        }
      });
    }
  },

  // ==========================================================================
  // 3. MONACO EDITOR SETUP & TABS
  // ==========================================================================
  initMonaco() {
    if (typeof require === 'undefined') {
      console.warn('Monaco loader not found, checking CDN...');
      return;
    }

    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });

    require(['vs/editor/editor.main'], () => {
      monaco.editor.defineTheme('horizon-celestial', {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: 'comment', foreground: '64748b', fontStyle: 'italic' },
          { token: 'keyword', foreground: 'ec4899', fontStyle: 'bold' },
          { token: 'string', foreground: '34d399' },
          { token: 'number', foreground: 'f59e0b' },
          { token: 'function', foreground: '38bdf8' },
          { token: 'variable', foreground: 'f1f5f9' },
          { token: 'type', foreground: 'a855f7' }
        ],
        colors: {
          'editor.background': '#0c0e15',
          'editor.foreground': '#f1f5f9',
          'editorLineNumber.foreground': '#334155',
          'editorLineNumber.activeForeground': '#38bdf8',
          'editorCursor.foreground': '#ec4899',
          'editor.selectionBackground': '#38bdf833',
          'editor.lineHighlightBackground': '#1e293b22'
        }
      });

      const container = document.getElementById('monaco-editor-instance');
      this.editor = monaco.editor.create(container, {
        value: '',
        language: 'plaintext',
        theme: 'horizon-celestial',
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        fontSize: 13.5,
        fontLigatures: true,
        minimap: { enabled: true },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        smoothScrolling: true,
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        bracketPairColorization: { enabled: true },
        wordWrap: 'off'
      });

      // Cursor position listener
      this.editor.onDidChangeCursorPosition((e) => {
        const posEl = document.getElementById('sb-cursor-pos');
        if (posEl) posEl.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
      });

      // Dirty flag listener
      this.editor.onDidChangeModelContent(() => {
        const activeTab = this.openTabs.find(t => t.path === this.activeTabPath);
        if (activeTab && !activeTab.isDirty) {
          activeTab.isDirty = true;
          this.renderTabs();
        }
      });

      // Add Monaco Actions for Shortcuts
      this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
        this.openInlineAI();
      });

      this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => {
        this.openQuickOpen();
      });
    });
  },

  getLanguageFromExt(ext) {
    const map = {
      '.js': 'javascript', '.mjs': 'javascript', '.ts': 'typescript',
      '.html': 'html', '.css': 'css', '.json': 'json',
      '.py': 'python', '.md': 'markdown', '.sql': 'sql',
      '.sh': 'shell', '.bat': 'bat', '.ps1': 'powershell',
      '.xml': 'xml', '.cpp': 'cpp', '.c': 'c', '.java': 'java'
    };
    return map[ext] || 'plaintext';
  },

  async openFile(filePath, lineNumber = null) {
    const existing = this.openTabs.find(t => t.path === filePath);
    if (existing) {
      this.switchTab(filePath);
      if (lineNumber && this.editor) {
        this.editor.revealLineInCenter(lineNumber);
        this.editor.setPosition({ lineNumber, column: 1 });
      }
      return;
    }

    if (!window.AisaHorizon) return;
    const res = await window.AisaHorizon.readFile(filePath);
    if (!res.success) {
      alert('Không thể mở tệp: ' + res.error);
      return;
    }

    const lang = this.getLanguageFromExt(res.ext);
    let model = null;
    if (typeof monaco !== 'undefined') {
      model = monaco.editor.createModel(res.content, lang);
    }

    const tab = {
      path: filePath,
      name: res.name,
      ext: res.ext,
      lang: lang,
      model: model,
      content: res.content,
      isDirty: false
    };

    this.openTabs.push(tab);
    this.renderTabs();
    this.switchTab(filePath);

    if (lineNumber && this.editor) {
      this.editor.revealLineInCenter(lineNumber);
      this.editor.setPosition({ lineNumber, column: 1 });
    }
  },

  switchTab(filePath) {
    const tab = this.openTabs.find(t => t.path === filePath);
    if (!tab) return;

    this.activeTabPath = filePath;
    const emptyState = document.getElementById('editor-empty-state');
    if (emptyState) emptyState.style.display = 'none';

    if (this.editor && tab.model) {
      this.editor.setModel(tab.model);
      this.editor.focus();
    }

    const langMode = document.getElementById('sb-lang-mode');
    if (langMode) langMode.textContent = tab.lang.toUpperCase();

    this.updateBreadcrumbs();
    this.renderTabs();
  },

  async closeTab(filePath) {
    const idx = this.openTabs.findIndex(t => t.path === filePath);
    if (idx === -1) return;

    const tab = this.openTabs[idx];
    if (tab.model) tab.model.dispose();
    this.openTabs.splice(idx, 1);

    if (this.activeTabPath === filePath) {
      if (this.openTabs.length > 0) {
        const next = this.openTabs[Math.max(0, idx - 1)];
        this.switchTab(next.path);
      } else {
        this.activeTabPath = null;
        if (this.editor) this.editor.setModel(null);
        const emptyState = document.getElementById('editor-empty-state');
        if (emptyState) emptyState.style.display = 'flex';
        this.updateBreadcrumbs();
      }
    }

    this.renderTabs();
  },

  async saveActiveFile() {
    if (!this.activeTabPath) return;
    const tab = this.openTabs.find(t => t.path === this.activeTabPath);
    if (!tab || !this.editor) return;

    const newContent = this.editor.getValue();
    const res = await window.AisaHorizon.writeFile(tab.path, newContent);

    if (res.success) {
      tab.isDirty = false;
      this.renderTabs();
      this.printTerminal(`✔ Đã lưu tệp: ${tab.name}`, '#10b981');
      this.mascotSay(`🌸 Harmony: Đã lưu an toàn tệp [${tab.name}] rồi nhé Sakura! ✨`);
      this.refreshGitStatus();
    } else {
      alert('Lỗi lưu tệp: ' + res.error);
    }
  },

  renderTabs() {
    const container = document.getElementById('editor-tabs-bar');
    if (!container) return;

    container.innerHTML = this.openTabs.map(t => {
      const isActive = t.path === this.activeTabPath;
      return `
        <div class="editor-tab ${isActive ? 'active' : ''}" data-path="${t.path}">
          <span>${t.name}${t.isDirty ? ' ●' : ''}</span>
          <span class="tab-close" data-close="${t.path}">×</span>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.editor-tab').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-close')) return;
        const p = el.getAttribute('data-path');
        this.switchTab(p);
      });
    });

    container.querySelectorAll('.tab-close').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const p = el.getAttribute('data-close');
        this.closeTab(p);
      });
    });
  },

  // ==========================================================================
  // 4. RECURSIVE FILE EXPLORER
  // ==========================================================================
  async refreshFileTree() {
    const container = document.getElementById('file-tree-container');
    if (!container || !window.AisaHorizon) return;

    container.innerHTML = `<div style="padding: 10px; color: var(--text-dim); font-size: 11px;">Đang tải danh mục tệp...</div>`;
    const res = await window.AisaHorizon.readDir(this.activeWorkspace);

    if (!res.success) {
      container.innerHTML = `<div style="padding: 12px; color: #ef4444;">${res.error}</div>`;
      return;
    }

    container.innerHTML = '';
    for (const item of res.items) {
      const el = await this.renderTreeItem(item, 0);
      container.appendChild(el);
    }

    // Bind Top Explorer Actions
    const btnNewFile = document.getElementById('btn-new-file');
    if (btnNewFile) {
      btnNewFile.onclick = async () => {
        const name = prompt('Nhập tên tệp mới (ví dụ: test.js, style.css):');
        if (name && name.trim()) {
          const newPath = this.activeWorkspace + '\\' + name.trim();
          await window.AisaHorizon.createFile(newPath);
          await this.refreshFileTree();
          await this.openFile(newPath);
        }
      };
    }

    const btnNewFolder = document.getElementById('btn-new-folder');
    if (btnNewFolder) {
      btnNewFolder.onclick = async () => {
        const name = prompt('Nhập tên thư mục mới:');
        if (name && name.trim()) {
          const newPath = this.activeWorkspace + '\\' + name.trim();
          await window.AisaHorizon.createDir(newPath);
          await this.refreshFileTree();
        }
      };
    }

    const btnRefresh = document.getElementById('btn-refresh-files');
    if (btnRefresh) {
      btnRefresh.onclick = () => this.refreshFileTree();
    }
  },

  async renderTreeItem(item, depth = 0) {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';

    const row = document.createElement('div');
    row.className = `tree-item ${item.isDirectory ? 'directory' : 'file'}`;
    row.style.paddingLeft = `${12 + depth * 14}px`;
    row.setAttribute('data-path', item.path);

    if (item.isDirectory) {
      const isExpanded = this.expandedFolders.has(item.path);
      row.innerHTML = `
        <span class="tree-arrow ${isExpanded ? 'expanded' : ''}">▶</span>
        <span class="tree-icon">📁</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</span>
      `;

      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-folder-children';
      childrenContainer.style.display = isExpanded ? 'flex' : 'none';

      row.addEventListener('click', async (e) => {
        e.stopPropagation();
        const arrow = row.querySelector('.tree-arrow');
        if (this.expandedFolders.has(item.path)) {
          this.expandedFolders.delete(item.path);
          arrow?.classList.remove('expanded');
          childrenContainer.style.display = 'none';
        } else {
          this.expandedFolders.add(item.path);
          arrow?.classList.add('expanded');
          childrenContainer.style.display = 'flex';

          if (childrenContainer.children.length === 0) {
            childrenContainer.innerHTML = `<div style="padding: 4px 10px; color: var(--text-dim); font-size: 11px;">Đang mở...</div>`;
            const subRes = await window.AisaHorizon.readDir(item.path);
            childrenContainer.innerHTML = '';
            if (subRes.success && subRes.items.length > 0) {
              for (const subItem of subRes.items) {
                const subEl = await this.renderTreeItem(subItem, depth + 1);
                childrenContainer.appendChild(subEl);
              }
            } else {
              childrenContainer.innerHTML = `<div style="padding: 4px 10px; color: var(--text-dim); font-size: 11px;">(Thư mục trống)</div>`;
            }
          }
        }
      });

      // Context menu
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openContextMenu(e.clientX, e.clientY, item.path, true);
      });

      wrapper.appendChild(row);
      wrapper.appendChild(childrenContainer);
    } else {
      const icon = this.getFileIcon(item.name);
      row.innerHTML = `
        <span style="width: 12px;"></span>
        <span class="tree-icon">${icon}</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</span>
      `;

      row.addEventListener('click', () => {
        this.openFile(item.path);
      });

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openContextMenu(e.clientX, e.clientY, item.path, false);
      });

      wrapper.appendChild(row);
    }

    return wrapper;
  },

  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      js: '🟨', mjs: '🟨', ts: '🟦', html: '🌐', css: '🎨', json: '📋',
      py: '🐍', md: '📝', bat: '⚡', ps1: '⚡', png: '🖼️',
      jpg: '🖼️', svg: '✨', mp3: '🎵', wav: '🎵'
    };
    return map[ext] || '📄';
  },

  // ==========================================================================
  // 5. WORKSPACE SEARCH PANEL
  // ==========================================================================
  setupSearchPanel() {
    const input = document.getElementById('workspace-search-input');
    const flagCase = document.getElementById('btn-flag-case');
    const flagRegex = document.getElementById('btn-flag-regex');
    const btnClear = document.getElementById('btn-clear-search');
    const resultsContainer = document.getElementById('search-results-container');
    const statusBar = document.getElementById('search-status-bar');

    flagCase?.addEventListener('click', () => {
      this.searchFlags.isCase = !this.searchFlags.isCase;
      flagCase.classList.toggle('active', this.searchFlags.isCase);
      if (input.value.trim()) runSearch();
    });

    flagRegex?.addEventListener('click', () => {
      this.searchFlags.isRegex = !this.searchFlags.isRegex;
      flagRegex.classList.toggle('active', this.searchFlags.isRegex);
      if (input.value.trim()) runSearch();
    });

    btnClear?.addEventListener('click', () => {
      input.value = '';
      if (resultsContainer) resultsContainer.innerHTML = '';
      if (statusBar) statusBar.textContent = 'Nhập từ khóa và bấm Enter';
    });

    const runSearch = async () => {
      const q = input.value.trim();
      if (!q) return;

      if (statusBar) statusBar.textContent = `Đang tìm kiếm "${q}"...`;
      if (resultsContainer) resultsContainer.innerHTML = '';

      if (!window.AisaHorizon) return;
      const res = await window.AisaHorizon.searchFiles(q, {
        isCaseSensitive: this.searchFlags.isCase,
        isRegex: this.searchFlags.isRegex,
        maxResults: 150
      });

      if (!res.success) {
        if (statusBar) statusBar.textContent = `Lỗi tìm kiếm: ${res.error}`;
        return;
      }

      if (res.matches.length === 0) {
        if (statusBar) statusBar.textContent = `Không tìm thấy kết quả nào cho "${q}"`;
        return;
      }

      if (statusBar) statusBar.textContent = `Tìm thấy ${res.matches.length} kết quả`;

      // Group by file
      const groups = {};
      res.matches.forEach(m => {
        if (!groups[m.file]) groups[m.file] = [];
        groups[m.file].push(m);
      });

      Object.keys(groups).forEach(filePath => {
        const groupEl = document.createElement('div');
        groupEl.className = 'search-file-group';

        const fileName = filePath.split(/[\\/]/).pop();
        const header = document.createElement('div');
        header.className = 'search-file-header';
        header.innerHTML = `📄 ${fileName} <span style="color: var(--text-dim); font-size: 10px;">(${groups[filePath].length})</span>`;
        groupEl.appendChild(header);

        groups[filePath].forEach(match => {
          const item = document.createElement('div');
          item.className = 'search-match-item';
          item.innerHTML = `
            <span class="search-match-line">${match.line}:</span>
            <span class="search-match-text">${this.escapeHtml(match.text.trim())}</span>
          `;
          item.addEventListener('click', () => {
            this.openFile(filePath, match.line);
          });
          groupEl.appendChild(item);
        });

        resultsContainer.appendChild(groupEl);
      });
    };

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runSearch();
    });
  },

  // ==========================================================================
  // 6. GIT SOURCE CONTROL PANEL
  // ==========================================================================
  setupGitPanel() {
    const btnRefresh = document.getElementById('btn-refresh-git');
    const btnCommit = document.getElementById('btn-git-commit');
    const btnPush = document.getElementById('btn-git-push');

    btnRefresh?.addEventListener('click', () => this.refreshGitStatus());

    btnCommit?.addEventListener('click', async () => {
      const msgInput = document.getElementById('git-commit-msg');
      const msg = msgInput?.value.trim();
      if (!msg) {
        alert('Vui lòng nhập thông điệp commit!');
        return;
      }

      this.printTerminal(`\n[Git] Đang commit với thông điệp: "${msg}"...`, '#a855f7');
      const res = await window.AisaHorizon?.gitCommit(msg, this.activeWorkspace);

      if (res && res.success) {
        this.printTerminal(res.stdout || '✔ Commit thành công!', '#10b981');
        if (msgInput) msgInput.value = '';
        await this.refreshGitStatus();
        this.mascotSay('😈 Echo: Commit ngon lành rồi đó Sakura! Tiếp tục chiến nào! ✨');
      } else {
        this.printTerminal(res?.error || res?.stderr || 'Lỗi khi commit', '#ef4444');
      }
    });

    btnPush?.addEventListener('click', async () => {
      this.printTerminal(`\n[Git] Đang đẩy lên remote repository (git push)...`, '#38bdf8');
      const res = await window.AisaHorizon?.gitPush(this.activeWorkspace);

      if (res && res.success) {
        this.printTerminal(res.stdout || '✔ Push thành công lên GitHub / Remote!', '#10b981');
        await this.refreshGitStatus();
        this.mascotSay('🌸 Harmony: Đã đồng bộ mã nguồn lên đám mây an toàn rồi nha Sakura! ✨');
      } else {
        this.printTerminal(res?.error || res?.stderr || 'Lỗi khi push git', '#ef4444');
      }
    });
  },

  async refreshGitStatus() {
    if (!window.AisaHorizon) return;
    const res = await window.AisaHorizon.gitStatus(this.activeWorkspace);

    const branchLabel = document.getElementById('git-branch-text');
    const sbBranchLabel = document.getElementById('sb-git-branch-name');
    const countTag = document.getElementById('git-changes-count');
    const badge = document.getElementById('git-changes-badge');
    const list = document.getElementById('git-changes-list');

    if (!res.success) {
      if (branchLabel) branchLabel.textContent = 'Not a git repo';
      if (list) list.innerHTML = `<div style="padding: 10px; color: var(--text-dim); font-size: 11px;">Thư mục này chưa khởi tạo Git</div>`;
      return;
    }

    if (branchLabel) branchLabel.textContent = res.branch || 'main';
    if (sbBranchLabel) sbBranchLabel.textContent = res.branch || 'main';

    const total = res.files.length;
    if (countTag) countTag.textContent = total;
    if (badge) {
      badge.textContent = total;
      badge.style.display = total > 0 ? 'flex' : 'none';
    }

    if (list) {
      if (total === 0) {
        list.innerHTML = `<div style="padding: 12px; color: var(--text-dim); font-size: 11px; text-align: center;">Không có tệp nào thay đổi ✔</div>`;
      } else {
        list.innerHTML = res.files.map(f => {
          let tagClass = 'modified';
          let tagText = 'M';
          if (f.status.includes('A')) { tagClass = 'added'; tagText = 'A'; }
          else if (f.status.includes('D')) { tagClass = 'deleted'; tagText = 'D'; }
          else if (f.status.includes('?')) { tagClass = 'untracked'; tagText = 'U'; }

          return `
            <div class="git-change-item" data-path="${f.path}">
              <span class="git-change-name" title="${f.path}">${f.name}</span>
              <span class="git-status-tag ${tagClass}">${tagText}</span>
            </div>
          `;
        }).join('');

        list.querySelectorAll('.git-change-item').forEach(el => {
          el.addEventListener('click', () => {
            const p = el.getAttribute('data-path');
            this.openFile(p);
          });
        });
      }
    }
  },

  // ==========================================================================
  // 7. INTEGRATED POWERSHELL TERMINAL
  // ==========================================================================
  setupTerminal() {
    const input = document.getElementById('terminal-input');
    const btnClear = document.getElementById('btn-clear-terminal');
    const btnClose = document.getElementById('btn-close-terminal');
    const termPanel = document.getElementById('terminal-panel');

    let history = [];
    let historyIdx = -1;

    if (input) {
      input.addEventListener('keydown', async (e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          if (history.length > 0) {
            historyIdx = Math.min(historyIdx + 1, history.length - 1);
            input.value = history[history.length - 1 - historyIdx];
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          if (historyIdx > 0) {
            historyIdx--;
            input.value = history[history.length - 1 - historyIdx];
          } else if (historyIdx === 0) {
            historyIdx = -1;
            input.value = '';
          }
        } else if (e.key === 'Enter') {
          const cmd = input.value.trim();
          if (!cmd) return;
          history.push(cmd);
          historyIdx = -1;
          input.value = '';

          this.printTerminal(`\nPS ${this.activeWorkspace}> ${cmd}`, '#f472b6');

          if (cmd.toLowerCase() === 'clear' || cmd.toLowerCase() === 'cls') {
            this.clearTerminal();
            return;
          }

          if (window.AisaHorizon) {
            const res = await window.AisaHorizon.runCommand(cmd, this.activeWorkspace);
            if (res.stdout) this.printTerminal(res.stdout, '#cbd5e1');
            if (res.stderr) {
              this.printTerminal(res.stderr, '#f87171');
              this.mascotSay('😈 Echo: Lệnh Terminal báo lỗi kìa Sakura ơi! Kiểm tra lại cú pháp xem sao! 😈');
            }
          }
        }
      });
    }

    if (btnClear) btnClear.addEventListener('click', () => this.clearTerminal());
    if (btnClose && termPanel) {
      btnClose.addEventListener('click', () => {
        termPanel.style.display = 'none';
        document.getElementById('act-btn-terminal')?.classList.remove('active');
      });
    }
  },

  printTerminal(text, color = '#cbd5e1') {
    const container = document.getElementById('terminal-output-container');
    if (!container) return;
    const line = document.createElement('div');
    line.style.color = color;
    line.textContent = text;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  },

  clearTerminal() {
    const container = document.getElementById('terminal-output-container');
    if (container) container.innerHTML = `<div style="color: #64748b;">[AISA Horizon Native PowerShell Shell Cleared]</div>`;
  },

  async runActiveFile() {
    if (!this.activeTabPath) {
      alert('Vui lòng mở một tệp để chạy!');
      return;
    }
    const tab = this.openTabs.find(t => t.path === this.activeTabPath);
    if (!tab) return;

    const termPanel = document.getElementById('terminal-panel');
    if (termPanel) termPanel.style.display = 'flex';
    document.getElementById('act-btn-terminal')?.classList.add('active');

    this.mascotSay(`⚡ Đang thực thi tệp: ${tab.name}...`);

    if (tab.ext === '.js') {
      this.printTerminal(`\n⚡ [Runner] node "${tab.name}"`, '#38bdf8');
      const res = await window.AisaHorizon.runCommand(`node "${tab.name}"`, this.activeWorkspace);
      if (res.stdout) this.printTerminal(res.stdout, '#34d399');
      if (res.stderr) this.printTerminal(res.stderr, '#f87171');
    } else if (tab.ext === '.py') {
      this.printTerminal(`\n⚡ [Runner] python "${tab.name}"`, '#38bdf8');
      const res = await window.AisaHorizon.runCommand(`python "${tab.name}"`, this.activeWorkspace);
      if (res.stdout) this.printTerminal(res.stdout, '#34d399');
      if (res.stderr) this.printTerminal(res.stderr, '#f87171');
    } else {
      this.printTerminal(`\n⚡ [Runner] start "${tab.name}"`, '#38bdf8');
      await window.AisaHorizon.runCommand(`start "${tab.name}"`, this.activeWorkspace);
    }
  },

  // ==========================================================================
  // 8. GOOGLE ANTIGRAVITY SIDECAR AGENT & MODES
  // ==========================================================================
  setupAgentSidecar() {
    // Mode Switcher: Agent | Chat | Review
    const modeTabs = document.querySelectorAll('.copilot-mode-tab');
    modeTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        modeTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentMode = tab.getAttribute('data-mode');
        this.mascotSay(`Đã chuyển sang chế độ AI: ${this.currentMode.toUpperCase()} ✨`);
      });
    });

    const input = document.getElementById('copilot-input');
    const sendBtn = document.getElementById('btn-copilot-send');
    const clearBtn = document.getElementById('btn-clear-copilot');

    const handleSend = () => {
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      this.askAgent(q);
    };

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
    }

    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const c = document.getElementById('copilot-messages');
        if (c) c.innerHTML = '';
      });
    }

    // Quick Action Buttons
    document.getElementById('btn-ai-explain')?.addEventListener('click', () => this.triggerCodeAction('explain'));
    document.getElementById('btn-ai-fix')?.addEventListener('click', () => this.triggerCodeAction('fix'));
    document.getElementById('btn-ai-refactor')?.addEventListener('click', () => this.triggerCodeAction('refactor'));
    document.getElementById('btn-ai-doc')?.addEventListener('click', () => this.triggerCodeAction('doc'));

    // Context mention button
    document.getElementById('btn-add-context-mention')?.addEventListener('click', () => {
      const currentTab = this.openTabs.find(t => t.path === this.activeTabPath);
      const mention = currentTab ? `@${currentTab.name} ` : '@workspace ';
      if (input) {
        input.value = mention + input.value;
        input.focus();
      }
    });
  },

  getActiveCodeSnippet() {
    if (!this.editor) return '';
    const sel = this.editor.getSelection();
    if (sel && !sel.isEmpty()) {
      return this.editor.getModel().getValueInRange(sel);
    }
    return this.editor.getValue();
  },

  triggerCodeAction(actionType) {
    const code = this.getActiveCodeSnippet();
    if (!code || !code.trim()) {
      alert('Vui lòng mở một tệp hoặc bôi đen đoạn mã để Agent xử lý!');
      return;
    }

    const tab = this.openTabs.find(t => t.path === this.activeTabPath);
    const fileName = tab ? tab.name : 'Active File';

    if (actionType === 'explain') {
      this.askAgent(`Hãy giải thích thật dễ hiểu cách hoạt động của đoạn mã trong tệp [${fileName}] này:\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\``);
    } else if (actionType === 'fix') {
      this.askAgent(`Hãy rà soát và tìm kiếm bug tiềm ẩn, sau đó sửa chữa toàn diện cho đoạn mã [${fileName}] này:\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\``);
    } else if (actionType === 'refactor') {
      this.askAgent(`Tối ưu hóa (refactor), làm gọn và tăng hiệu suất cho đoạn mã [${fileName}] này:\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\``);
    } else if (actionType === 'doc') {
      this.askAgent(`Viết tài liệu JSDoc / Docstring chi tiết cho các hàm trong [${fileName}]:\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\``);
    }
  },

  async askAgent(userPrompt) {
    this.appendAgentMessage('user', 'Sakura', userPrompt);

    const apiKey = this.geminiKey || localStorage.getItem('mhent_ai_api_key');
    if (!apiKey) {
      this.appendAgentMessage('harmony', '🌸 Harmony', 'Cậu ơi, chưa có Gemini API Key! Cậu bấm vào icon Bánh răng Cài đặt ở thanh bên trái để nhập key nhé!');
      return;
    }

    const currentTab = this.openTabs.find(t => t.path === this.activeTabPath);
    const fileContext = currentTab ? `\n[Tệp đang mở: ${currentTab.name} (${currentTab.path})]\n` : '';

    let systemPrompt = '';
    if (this.currentMode === 'agent') {
      systemPrompt = `Bạn là Google Antigravity-style Autonomous AI Agent trong AISA Horizon IDE của Miyazaki Haruto Entertainment Co., Ltd.
Đồng hành cùng Nhà sáng lập Sakura (Yurika).
ĐẶC ĐIỂM:
1. Bạn phải xuất ra quá trình suy nghĩ chi tiết theo định dạng:
<thought>
[Các bước suy nghĩ phân tích kiến trúc, rà soát logic, kế hoạch thực thi...]
</thought>
2. Sau thẻ thought, xuất các bước thao tác (ví dụ [Đọc tệp], [Sửa đổi], [Chạy Terminal]).
3. Cuối cùng, đưa ra câu trả lời súc tích và đoạn mã hoàn thiện bằng tiếng Việt.`;
    } else if (this.currentMode === 'chat') {
      systemPrompt = `Bạn là hệ thống AI Duo Copilot (Harmony 🌸 & Echo 😈) trong Horizon IDE.
- HARMONY 🌸: Dịu dàng, giải thích chi tiết, ân cần hướng dẫn logic.
- ECHO 😈: Sắc bén, tsundere, bắt lỗi siêu tốc, đề xuất giải pháp tối ưu.
Xuất định dạng:
HARMONY: [Nội dung giải thích]
ECHO: [Nội dung phản biện/tối ưu mã nguồn]`;
    } else {
      // Review mode
      systemPrompt = `Bạn là AI Code Reviewer. So sánh và xuất diff trước và sau khi tối ưu hóa hoặc chỉnh sửa mã nguồn. Sử dụng khối diff markdown.`;
    }

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: fileContext + userPrompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (this.currentMode === 'agent') {
        // Parse <thought> accordion
        const thoughtMatch = rawOutput.match(/<thought>([\s\S]*?)<\/thought>/i);
        const thoughtText = thoughtMatch ? thoughtMatch[1].trim() : 'Đã phân tích cấu trúc mã nguồn và ngữ cảnh tệp...';
        const finalAnswer = rawOutput.replace(/<thought>[\s\S]*?<\/thought>/i, '').trim();

        this.appendAgentAccordion(thoughtText, finalAnswer);
      } else if (this.currentMode === 'chat') {
        const hMatch = rawOutput.match(/HARMONY:\s*([\s\S]*?)(?=ECHO:|$)/i);
        const eMatch = rawOutput.match(/ECHO:\s*([\s\S]*?)$/i);

        if (hMatch && hMatch[1].trim()) {
          this.appendAgentMessage('harmony', '🌸 Harmony', hMatch[1].trim());
        }
        if (eMatch && eMatch[1].trim()) {
          this.appendAgentMessage('echo', '😈 Echo', eMatch[1].trim());
        }
        if (!hMatch && !eMatch) {
          this.appendAgentMessage('harmony', '🌸 Harmony', rawOutput);
        }
      } else {
        // Review
        this.appendAgentMessage('harmony', '🔍 Code Review', rawOutput);
      }

    } catch (err) {
      this.appendAgentMessage('echo', '😈 Echo', `Lỗi kết nối API: ${err.message}! Kiểm tra mạng hoặc API Key giúp em nha. 😈`);
    }
  },

  appendAgentAccordion(thoughtText, answerText) {
    const container = document.getElementById('copilot-messages');
    if (!container) return;

    const bubble = document.createElement('div');
    bubble.className = 'copilot-msg-bubble harmony';

    // Google Antigravity Accordion
    const accordion = document.createElement('details');
    accordion.className = 'thought-accordion';
    accordion.open = false;

    const summary = document.createElement('summary');
    summary.className = 'thought-summary';
    summary.innerHTML = `🧠 Quá trình suy nghĩ / Thinking Process (${thoughtText.split(' ').length} từ)...`;

    const content = document.createElement('div');
    content.className = 'thought-content';
    content.textContent = thoughtText;

    accordion.appendChild(summary);
    accordion.appendChild(content);
    bubble.appendChild(accordion);

    // Final answer text
    const answerEl = document.createElement('div');
    answerEl.style.whiteSpace = 'pre-wrap';
    answerEl.textContent = answerText;
    bubble.appendChild(answerEl);

    // Apply Code button if code block exists
    const codeMatch = answerText.match(/```[a-z]*\n([\s\S]*?)```/i);
    if (codeMatch && codeMatch[1] && this.editor) {
      const btnApply = document.createElement('button');
      btnApply.className = 'copilot-action-btn';
      btnApply.style.marginTop = '8px';
      btnApply.style.color = '#38bdf8';
      btnApply.innerHTML = '⚡ Áp dụng mã này vào Editor';
      btnApply.onclick = () => {
        this.editor.setValue(codeMatch[1].trim());
        this.printTerminal('✔ Đã áp dụng mã từ Antigravity Agent vào Editor!', '#38bdf8');
      };
      bubble.appendChild(btnApply);
    }

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  },

  appendAgentMessage(role, speaker, text) {
    const container = document.getElementById('copilot-messages');
    if (!container) return;

    const bubble = document.createElement('div');
    bubble.className = `copilot-msg-bubble ${role}`;

    const tag = document.createElement('div');
    tag.className = `copilot-speaker-tag ${role}`;
    tag.textContent = speaker;

    const content = document.createElement('div');
    content.style.whiteSpace = 'pre-wrap';
    content.textContent = text;

    bubble.appendChild(tag);
    bubble.appendChild(content);

    const codeMatch = text.match(/```[a-z]*\n([\s\S]*?)```/i);
    if (codeMatch && codeMatch[1] && this.editor) {
      const btnApply = document.createElement('button');
      btnApply.className = 'copilot-action-btn';
      btnApply.style.marginTop = '8px';
      btnApply.style.color = '#38bdf8';
      btnApply.innerHTML = '⚡ Áp dụng mã này vào Editor';
      btnApply.onclick = () => {
        this.editor.setValue(codeMatch[1].trim());
        this.printTerminal('✔ Đã áp dụng mã nguồn từ Copilot vào Editor!', '#38bdf8');
      };
      bubble.appendChild(btnApply);
    }

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  },

  // ==========================================================================
  // 9. INLINE AI CODE GENERATOR (CTRL+K)
  // ==========================================================================
  setupInlineAI() {
    const widget = document.getElementById('inline-ai-widget');
    const input = document.getElementById('inline-ai-input');
    const btnClose = document.getElementById('btn-close-inline-ai');
    const btnGenerate = document.getElementById('btn-inline-generate');
    const btnAccept = document.getElementById('btn-inline-accept');
    const btnReject = document.getElementById('btn-inline-reject');
    const status = document.getElementById('inline-ai-status');

    let generatedCodeCache = '';
    let targetRange = null;

    btnClose?.addEventListener('click', () => {
      widget.style.display = 'none';
      if (this.editor) this.editor.focus();
    });

    btnReject?.addEventListener('click', () => {
      widget.style.display = 'none';
      if (this.editor) this.editor.focus();
    });

    btnAccept?.addEventListener('click', () => {
      if (generatedCodeCache && this.editor && targetRange) {
        this.editor.executeEdits('inline-ai', [{
          range: targetRange,
          text: generatedCodeCache,
          forceMoveMarkers: true
        }]);
        this.printTerminal('✔ Đã chèn mã do AI tạo vào Editor!', '#10b981');
        this.mascotSay('🌸 Harmony: Đã chèn mã thành công rồi nhé Sakura! ✨');
      }
      widget.style.display = 'none';
      if (this.editor) this.editor.focus();
    });

    const executeInlineAI = async () => {
      const prompt = input.value.trim();
      if (!prompt) return;

      const apiKey = this.geminiKey || localStorage.getItem('mhent_ai_api_key');
      if (!apiKey) {
        alert('Vui lòng cấu hình Gemini API Key trước!');
        return;
      }

      if (status) status.textContent = 'Đang sinh mã... ✨';
      btnGenerate.disabled = true;

      const sel = this.editor?.getSelection();
      targetRange = sel && !sel.isEmpty() ? sel : new monaco.Range(
        this.editor.getPosition().lineNumber, 1,
        this.editor.getPosition().lineNumber, 1
      );

      const existingCode = sel && !sel.isEmpty() ? this.editor.getModel().getValueInRange(sel) : '';

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: 'Bạn là Inline Code Generator. Chỉ trả về duy nhất đoạn mã nguồn kết quả (trong khối markdown ```ngôn_ngữ ... ```), KHÔNG giải thích gì thêm.' }]
            },
            contents: [{
              role: 'user',
              parts: [{ text: `Yêu cầu: ${prompt}\nĐoạn mã hiện tại:\n${existingCode}` }]
            }]
          })
        });

        const data = await res.json();
        const output = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const match = output.match(/```[a-z]*\n([\s\S]*?)```/i);
        generatedCodeCache = match ? match[1] : output;

        if (status) status.textContent = 'Đã sinh xong!';
        btnAccept.style.display = 'inline-block';
        btnReject.style.display = 'inline-block';
        btnGenerate.style.display = 'none';
      } catch (err) {
        if (status) status.textContent = `Lỗi: ${err.message}`;
      } finally {
        btnGenerate.disabled = false;
      }
    };

    btnGenerate?.addEventListener('click', executeInlineAI);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeInlineAI();
      if (e.key === 'Escape') {
        widget.style.display = 'none';
        if (this.editor) this.editor.focus();
      }
    });
  },

  openInlineAI() {
    const widget = document.getElementById('inline-ai-widget');
    const input = document.getElementById('inline-ai-input');
    const status = document.getElementById('inline-ai-status');
    const btnGenerate = document.getElementById('btn-inline-generate');
    const btnAccept = document.getElementById('btn-inline-accept');
    const btnReject = document.getElementById('btn-inline-reject');

    if (widget) {
      widget.style.display = 'flex';
      if (input) {
        input.value = '';
        input.focus();
      }
      if (status) status.textContent = 'Sẵn sàng';
      if (btnGenerate) btnGenerate.style.display = 'inline-block';
      if (btnAccept) btnAccept.style.display = 'none';
      if (btnReject) btnReject.style.display = 'none';
    }
  },

  // ==========================================================================
  // 10. QUICK OPEN MODAL (CTRL+P)
  // ==========================================================================
  setupQuickOpen() {
    const modal = document.getElementById('modal-quick-open');
    const input = document.getElementById('input-quick-open');
    const results = document.getElementById('quick-open-results');

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    input?.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      this.filterQuickOpen(q);
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modal.style.display = 'none';
        if (this.editor) this.editor.focus();
      } else if (e.key === 'Enter') {
        const first = results.querySelector('.quick-open-item');
        if (first) {
          const p = first.getAttribute('data-path');
          this.openFile(p);
          modal.style.display = 'none';
        }
      }
    });
  },

  async openQuickOpen() {
    const modal = document.getElementById('modal-quick-open');
    const input = document.getElementById('input-quick-open');
    if (!modal) return;

    modal.style.display = 'flex';
    if (input) {
      input.value = '';
      input.focus();
    }

    if (window.AisaHorizon) {
      const res = await window.AisaHorizon.listAllFiles(this.activeWorkspace);
      if (res.success) {
        this.allWorkspaceFiles = res.files;
        this.filterQuickOpen('');
      }
    }
  },

  filterQuickOpen(query) {
    const results = document.getElementById('quick-open-results');
    if (!results) return;

    const filtered = this.allWorkspaceFiles.filter(f => {
      return f.name.toLowerCase().includes(query) || f.path.toLowerCase().includes(query);
    }).slice(0, 30);

    if (filtered.length === 0) {
      results.innerHTML = `<div style="padding: 10px; color: var(--text-dim); text-align: center; font-size: 11px;">Không tìm thấy tệp phù hợp</div>`;
      return;
    }

    results.innerHTML = filtered.map(f => {
      const icon = this.getFileIcon(f.name);
      const relPath = f.path.replace(this.activeWorkspace, '').replace(/^[\\/]/, '');
      return `
        <div class="quick-open-item" data-path="${f.path}">
          <span class="quick-open-filename">${icon} ${f.name}</span>
          <span class="quick-open-filepath">${relPath}</span>
        </div>
      `;
    }).join('');

    results.querySelectorAll('.quick-open-item').forEach(el => {
      el.addEventListener('click', () => {
        const p = el.getAttribute('data-path');
        this.openFile(p);
        document.getElementById('modal-quick-open').style.display = 'none';
      });
    });
  },

  // ==========================================================================
  // 11. FILE CONTEXT MENU
  // ==========================================================================
  setupContextMenu() {
    const menu = document.getElementById('file-context-menu');

    window.addEventListener('click', () => {
      if (menu) menu.style.display = 'none';
    });

    document.getElementById('ctx-new-file')?.addEventListener('click', async () => {
      const name = prompt('Tên tệp mới:');
      if (name && name.trim()) {
        const base = this.selectedContextPath || this.activeWorkspace;
        const newPath = base + '\\' + name.trim();
        await window.AisaHorizon?.createFile(newPath);
        await this.refreshFileTree();
        await this.openFile(newPath);
      }
    });

    document.getElementById('ctx-new-folder')?.addEventListener('click', async () => {
      const name = prompt('Tên thư mục mới:');
      if (name && name.trim()) {
        const base = this.selectedContextPath || this.activeWorkspace;
        const newPath = base + '\\' + name.trim();
        await window.AisaHorizon?.createDir(newPath);
        await this.refreshFileTree();
      }
    });

    document.getElementById('ctx-reveal-explorer')?.addEventListener('click', () => {
      if (this.selectedContextPath && window.AisaHorizon) {
        window.AisaHorizon.revealInExplorer(this.selectedContextPath);
      }
    });

    document.getElementById('ctx-copy-path')?.addEventListener('click', () => {
      if (this.selectedContextPath) {
        navigator.clipboard.writeText(this.selectedContextPath);
        this.mascotSay('📋 Đã sao chép đường dẫn tệp vào Clipboard!');
      }
    });

    document.getElementById('ctx-rename-file')?.addEventListener('click', async () => {
      if (!this.selectedContextPath) return;
      const oldName = this.selectedContextPath.split(/[\\/]/).pop();
      const newName = prompt(`Đổi tên [${oldName}] thành:`, oldName);
      if (newName && newName.trim() && newName.trim() !== oldName) {
        const parentDir = this.selectedContextPath.substring(0, this.selectedContextPath.lastIndexOf('\\'));
        const newPath = parentDir + '\\' + newName.trim();
        const res = await window.AisaHorizon?.renamePath(this.selectedContextPath, newPath);
        if (res && res.success) {
          await this.refreshFileTree();
        } else {
          alert('Lỗi đổi tên: ' + res?.error);
        }
      }
    });

    document.getElementById('ctx-delete-file')?.addEventListener('click', async () => {
      if (!this.selectedContextPath) return;
      const name = this.selectedContextPath.split(/[\\/]/).pop();
      if (confirm(`Sakura có chắc chắn muốn xóa [${name}] không?`)) {
        const res = await window.AisaHorizon?.deletePath(this.selectedContextPath);
        if (res && res.success) {
          this.closeTab(this.selectedContextPath);
          await this.refreshFileTree();
          this.mascotSay(`🗑️ Đã xóa [${name}] an toàn!`);
        } else {
          alert('Lỗi khi xóa: ' + res?.error);
        }
      }
    });
  },

  openContextMenu(x, y, targetPath, isDir) {
    const menu = document.getElementById('file-context-menu');
    if (!menu) return;

    this.selectedContextPath = targetPath;
    menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 240)}px`;
    menu.style.display = 'flex';
  },

  // ==========================================================================
  // 12. COMPANION MASCOT WIDGET (HARMONY 🌸 & ECHO 😈)
  // ==========================================================================
  setupMascotWidget() {
    const widget = document.getElementById('horizon-mascot-widget');
    const closeBtn = document.getElementById('btn-close-mascot-widget');
    const harmonyCard = document.querySelector('.mascot-chibi-card.harmony');
    const echoCard = document.querySelector('.mascot-chibi-card.echo');

    closeBtn?.addEventListener('click', () => {
      if (widget) widget.style.display = 'none';
    });

    harmonyCard?.addEventListener('click', () => {
      const quotes = [
        '🌸 Harmony: Sakura cứ vững tâm code nhé, có em luôn ở đây hỗ trợ cậu! ✨',
        '🌸 Harmony: Đừng quên uống nước và chớp mắt nghỉ ngơi một chút nha cậu! 🍵',
        '🌸 Harmony: Mã nguồn hôm nay viết rất đẹp và trong trẻo luôn đó Sakura! 💖'
      ];
      this.mascotSay(quotes[Math.floor(Math.random() * quotes.length)]);
    });

    echoCard?.addEventListener('click', () => {
      const quotes = [
        '😈 Echo: Nè, có đoạn nào khó quá thì gọi tôi, đừng có ngồi ngơ ra đó nha! 😈',
        '😈 Echo: Viết code phải có test đàng hoàng đấy nhé, tôi soi bug kỹ lắm đó! ⚡',
        '😈 Echo: Hừm, cũng tạm được đấy, nhưng tôi tối ưu thì còn nhanh gấp đôi! 🚀'
      ];
      this.mascotSay(quotes[Math.floor(Math.random() * quotes.length)]);
    });
  },

  mascotSay(text) {
    const balloon = document.getElementById('mascot-dialogue-balloon');
    if (balloon) {
      balloon.textContent = text;
      balloon.style.animation = 'none';
      balloon.offsetHeight; // trigger reflow
      balloon.style.animation = 'fadeIn 0.2s ease';
    }
  },

  // ==========================================================================
  // 13. GLOBAL KEYBOARD SHORTCUTS
  // ==========================================================================
  setupKeybindings() {
    window.addEventListener('keydown', (e) => {
      // Ctrl + S (Save)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveActiveFile();
      }

      // Ctrl + P (Quick Open)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.openQuickOpen();
      }

      // Ctrl + K (Inline AI)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openInlineAI();
      }

      // Ctrl + ` (Terminal)
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        const termPanel = document.getElementById('terminal-panel');
        if (termPanel) {
          const isHidden = termPanel.style.display === 'none';
          termPanel.style.display = isHidden ? 'flex' : 'none';
          document.getElementById('act-btn-terminal')?.classList.toggle('active', isHidden);
          if (isHidden) document.getElementById('terminal-input')?.focus();
        }
      }

      // F5 (Run active file)
      if (e.key === 'F5') {
        e.preventDefault();
        this.runActiveFile();
      }

      // Shift + Alt + F (Format Document)
      if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (this.editor) {
          this.editor.getAction('editor.action.formatDocument')?.run();
          this.mascotSay('✨ Đã định dạng tài liệu code sạch sẽ!');
        }
      }

      // Alt + Z (Word Wrap Toggle)
      if (e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (this.editor) {
          const current = this.editor.getOption(monaco.editor.EditorOption.wordWrap);
          const next = current === 'on' ? 'off' : 'on';
          this.editor.updateOptions({ wordWrap: next });
          this.mascotSay(`Word wrap: ${next.toUpperCase()}`);
        }
      }
    });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.AisaHorizonApp.init();
});
