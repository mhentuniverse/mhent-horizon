/**
 * AISA HORIZON - MASTER IDE STUDIO CONTROLLER v2.0
 * Native Multi-Viewer (Monaco Code, Monaco Diff Review, HTML5 Video/Audio/Image, Binary),
 * Recursive Tree Explorer with Context Menu, Multi-Repo Git Control, Workspace Search,
 * Titlebar Dropdown Menus, Inline AI Generator (Ctrl+K), Quick Open (Ctrl+P),
 * Antigravity Agent with Thinking Process & Diff Accept/Reject, and Companion Mascot
 * 
 * Miyazaki Haruto Entertainment Co., Ltd.
 */

window.AisaHorizonApp = {
  editor: null,
  diffEditor: null,
  activeWorkspace: '',
  openTabs: [], // Array of { path, name, ext, lang, model, content, isMedia, mediaType, url, isBinary, isDirty }
  activeTabPath: null,
  geminiKey: '',
  currentMode: 'agent', // 'agent' | 'chat' | 'review'
  allWorkspaceFiles: [], // Cache for Ctrl+P
  quickOpenSelectedIndex: 0,
  searchFlags: { isCase: false, isRegex: false },
  expandedFolders: new Set(),
  selectedContextPath: null,
  gitRepos: [],
  selectedGitRepo: null,

  async init() {
    console.log('%c[AISA Horizon IDE] Initializing Celestial Studio v2.0...', 'color: #38bdf8; font-weight: bold;');

    // 1. Setup Window & Titlebar Controls + Dropdown Menus
    this.setupTitlebarControls();
    this.setupDropdownMenus();

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

    // 3. Initialize Monaco Editor & Diff Editor
    this.initMonaco();

    // 4. Setup Activity Bar & Subpanel Navigation
    this.setupActivityBar();

    // 5. Load File Explorer
    await this.refreshFileTree();

    // 6. Setup Workspace Search
    this.setupSearchPanel();

    // 7. Setup Git Source Control (Multi-Repo Support)
    await this.setupGitPanel();

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

    this.mascotSay('🌸 Harmony: Chào mừng Sakura trở lại AISA Horizon Studio! Tụi em đã nâng cấp đầy đủ toàn bộ tính năng rồi nè! ✨');
  },

  // ==========================================================================
  // 1. TITLEBAR & WORKSPACE CONTROLS
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
          await this.loadGitRepos();
          this.mascotSay(`Đã mở không gian làm việc: ${newPath.split(/[\\/]/).pop()} 📂`);
        }
      });
    }

    const btnTriggerQuickOpen = document.getElementById('btn-trigger-quick-open');
    if (btnTriggerQuickOpen) {
      btnTriggerQuickOpen.addEventListener('click', () => this.openQuickOpen());
    }

    const btnRunCode = document.getElementById('btn-run-code');
    if (btnRunCode) {
      btnRunCode.addEventListener('click', () => this.runActiveFile());
    }

    const btnToggleInline = document.getElementById('btn-toggle-inline-ai');
    if (btnToggleInline) {
      btnToggleInline.addEventListener('click', () => this.openInlineAI());
    }

    const btnToggleMascot = document.getElementById('btn-toggle-mascot');
    const mascotWidget = document.getElementById('horizon-mascot-widget');
    if (btnToggleMascot && mascotWidget) {
      btnToggleMascot.addEventListener('click', () => {
        const isHidden = mascotWidget.style.display === 'none';
        mascotWidget.style.display = isHidden ? 'flex' : 'none';
        btnToggleMascot.classList.toggle('active', isHidden);
      });
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

  setupDropdownMenus() {
    const menus = [
      { id: 'menu-file', dropdown: 'dropdown-file' },
      { id: 'menu-edit', dropdown: 'dropdown-edit' },
      { id: 'menu-selection', dropdown: 'dropdown-selection' },
      { id: 'menu-view', dropdown: 'dropdown-view' },
      { id: 'menu-terminal', dropdown: 'dropdown-terminal' },
      { id: 'menu-copilot', dropdown: 'dropdown-agent' }
    ];

    const closeAllDropdowns = () => {
      menus.forEach(m => {
        const el = document.getElementById(m.dropdown);
        if (el) el.style.display = 'none';
      });
    };

    menus.forEach(m => {
      const trigger = document.getElementById(m.id);
      const dropdown = document.getElementById(m.dropdown);
      if (trigger && dropdown) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const isShown = dropdown.style.display === 'flex';
          closeAllDropdowns();
          dropdown.style.display = isShown ? 'none' : 'flex';
        });
      }
    });

    window.addEventListener('click', () => closeAllDropdowns());

    // 1. Tệp Actions
    document.getElementById('menu-action-new-file')?.addEventListener('click', () => this.createNewFilePrompt());
    document.getElementById('menu-action-open-folder')?.addEventListener('click', () => document.getElementById('btn-change-workspace')?.click());
    document.getElementById('menu-action-save')?.addEventListener('click', () => this.saveActiveFile());
    document.getElementById('menu-action-save-all')?.addEventListener('click', () => this.saveAllFiles());
    document.getElementById('menu-action-close-tab')?.addEventListener('click', () => {
      if (this.activeTabPath) this.closeTab(this.activeTabPath);
    });
    document.getElementById('menu-action-exit')?.addEventListener('click', () => window.AisaHorizon?.closeWindow());

    // 2. Chỉnh sửa Actions
    document.getElementById('menu-action-undo')?.addEventListener('click', () => this.editor?.trigger('menu', 'undo'));
    document.getElementById('menu-action-redo')?.addEventListener('click', () => this.editor?.trigger('menu', 'redo'));
    document.getElementById('menu-action-cut')?.addEventListener('click', () => this.editor?.focus());
    document.getElementById('menu-action-copy')?.addEventListener('click', () => this.editor?.focus());
    document.getElementById('menu-action-paste')?.addEventListener('click', () => this.editor?.focus());
    document.getElementById('menu-action-find')?.addEventListener('click', () => this.editor?.getAction('actions.find')?.run());
    document.getElementById('menu-action-replace')?.addEventListener('click', () => this.editor?.getAction('editor.action.startFindReplaceAction')?.run());
    document.getElementById('menu-action-format')?.addEventListener('click', () => this.editor?.getAction('editor.action.formatDocument')?.run());

    // 3. Lựa chọn Actions
    document.getElementById('menu-action-select-all')?.addEventListener('click', () => this.editor?.getAction('editor.action.selectAll')?.run());
    document.getElementById('menu-action-expand-selection')?.addEventListener('click', () => this.editor?.getAction('editor.action.smartSelect.expand')?.run());

    // 4. Xem Actions
    document.getElementById('menu-action-view-explorer')?.addEventListener('click', () => document.getElementById('act-btn-explorer')?.click());
    document.getElementById('menu-action-view-search')?.addEventListener('click', () => document.getElementById('act-btn-search')?.click());
    document.getElementById('menu-action-view-git')?.addEventListener('click', () => document.getElementById('act-btn-git')?.click());
    document.getElementById('menu-action-view-terminal')?.addEventListener('click', () => document.getElementById('act-btn-terminal')?.click());
    document.getElementById('menu-action-view-copilot')?.addEventListener('click', () => document.getElementById('act-btn-copilot')?.click());
    document.getElementById('menu-action-toggle-wrap')?.addEventListener('click', () => {
      if (this.editor) {
        const cur = this.editor.getOption(monaco.editor.EditorOption.wordWrap);
        this.editor.updateOptions({ wordWrap: cur === 'on' ? 'off' : 'on' });
      }
    });

    // 5. Terminal Actions
    document.getElementById('menu-action-term-toggle')?.addEventListener('click', () => document.getElementById('act-btn-terminal')?.click());
    document.getElementById('menu-action-term-clear')?.addEventListener('click', () => this.clearTerminal());
    document.getElementById('menu-action-term-run')?.addEventListener('click', () => this.runActiveFile());

    // 6. AI Agent Actions
    document.getElementById('menu-action-agent-open')?.addEventListener('click', () => document.getElementById('act-btn-copilot')?.click());
    document.getElementById('menu-action-agent-inline')?.addEventListener('click', () => this.openInlineAI());
    document.getElementById('menu-action-agent-explain')?.addEventListener('click', () => this.triggerCodeAction('explain'));
    document.getElementById('menu-action-agent-fix')?.addEventListener('click', () => this.triggerCodeAction('fix'));
    document.getElementById('menu-action-agent-refactor')?.addEventListener('click', () => this.triggerCodeAction('refactor'));
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
        const key = prompt('Cập nhật Google Gemini API Key cho AISA Horizon Studio:', this.geminiKey || '');
        if (key !== null) {
          this.geminiKey = key.trim();
          localStorage.setItem('mhent_ai_api_key', this.geminiKey);
          this.mascotSay('🌸 Harmony: Đã lưu API Key thành công! Studio đã sẵn sàng bung hết sức mạnh! ✨');
        }
      });
    }
  },

  // ==========================================================================
  // 3. MONACO EDITOR & DIFF REVIEW INITIALIZATION
  // ==========================================================================
  initMonaco() {
    if (typeof require === 'undefined') {
      console.warn('Monaco loader not found, checking CDN...');
      return;
    }

    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });

    require(['vs/editor/editor.main'], () => {
      // Define Celestial Theme
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
          'editor.lineHighlightBackground': '#1e293b22',
          'diffEditor.insertedTextBackground': '#10b98122',
          'diffEditor.removedTextBackground': '#ef444422'
        }
      });

      // 1. Text Editor
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

      // 2. Diff Editor
      const diffContainer = document.getElementById('monaco-diff-editor-instance');
      this.diffEditor = monaco.editor.createDiffEditor(diffContainer, {
        theme: 'horizon-celestial',
        fontFamily: "'JetBrains Mono', Consolas, monospace",
        fontSize: 13,
        automaticLayout: true,
        readOnly: true,
        renderSideBySide: true
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

      // Monaco Shortcuts
      this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => this.openInlineAI());
      this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP, () => this.openQuickOpen());
      this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => this.saveActiveFile());
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

  // ==========================================================================
  // 4. SMART FILE OPENING & MULTI-VIEWPORT (CODE, MEDIA, BINARY)
  // ==========================================================================
  async openFile(filePath, lineNumber = null) {
    const existing = this.openTabs.find(t => t.path === filePath);
    if (existing) {
      this.switchTab(filePath);
      if (lineNumber && this.editor && !existing.isMedia && !existing.isBinary) {
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

    let tab = null;

    if (res.isMedia) {
      tab = {
        path: filePath,
        name: res.name,
        ext: res.ext,
        isMedia: true,
        mediaType: res.mediaType,
        url: res.url,
        size: res.size,
        isDirty: false
      };
    } else if (res.isBinary) {
      tab = {
        path: filePath,
        name: res.name,
        ext: res.ext,
        isBinary: true,
        size: res.size,
        isDirty: false
      };
    } else {
      // Text file
      const lang = this.getLanguageFromExt(res.ext);
      let model = null;
      if (typeof monaco !== 'undefined') {
        model = monaco.editor.createModel(res.content, lang);
      }
      tab = {
        path: filePath,
        name: res.name,
        ext: res.ext,
        lang: lang,
        model: model,
        content: res.content,
        isDirty: false
      };
    }

    this.openTabs.push(tab);
    this.renderTabs();
    this.switchTab(filePath);

    if (lineNumber && this.editor && !tab.isMedia && !tab.isBinary) {
      this.editor.revealLineInCenter(lineNumber);
      this.editor.setPosition({ lineNumber, column: 1 });
    }
  },

  switchTab(filePath) {
    const tab = this.openTabs.find(t => t.path === filePath);
    if (!tab) return;

    this.activeTabPath = filePath;

    // Elements
    const emptyState = document.getElementById('editor-empty-state');
    const editorInstance = document.getElementById('monaco-editor-instance');
    const diffInstance = document.getElementById('monaco-diff-editor-instance');
    const mediaInstance = document.getElementById('media-viewer-instance');
    const diffBar = document.getElementById('diff-floating-bar');

    if (emptyState) emptyState.style.display = 'none';
    if (diffInstance) diffInstance.style.display = 'none';
    if (diffBar) diffBar.style.display = 'none';

    if (tab.isMedia) {
      if (editorInstance) editorInstance.style.display = 'none';
      if (mediaInstance) {
        mediaInstance.style.display = 'flex';
        this.renderMediaView(mediaInstance, tab);
      }
      document.getElementById('sb-lang-mode').textContent = tab.mediaType.toUpperCase();
    } else if (tab.isBinary) {
      if (editorInstance) editorInstance.style.display = 'none';
      if (mediaInstance) {
        mediaInstance.style.display = 'flex';
        this.renderBinaryView(mediaInstance, tab);
      }
      document.getElementById('sb-lang-mode').textContent = 'BINARY';
    } else {
      // Regular code/text file
      if (mediaInstance) mediaInstance.style.display = 'none';
      if (editorInstance) {
        editorInstance.style.display = 'block';
        if (this.editor && tab.model) {
          this.editor.setModel(tab.model);
          this.editor.focus();
        }
      }
      const langMode = document.getElementById('sb-lang-mode');
      if (langMode) langMode.textContent = (tab.lang || 'plaintext').toUpperCase();
    }

    this.updateBreadcrumbs();
    this.renderTabs();
  },

  renderMediaView(container, tab) {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.alignItems = 'center';
    wrapper.style.gap = '14px';

    if (tab.mediaType === 'video') {
      wrapper.innerHTML = `
        <video controls autoplay class="media-video-player" src="${tab.url}"></video>
        <div style="display: flex; gap: 12px; align-items: center;">
          <span style="font-weight: 700; font-size: 13px;">${tab.name} (${(tab.size / (1024 * 1024)).toFixed(2)} MB)</span>
          <button type="button" class="binary-card-btn" id="btn-media-open-ext">🚀 Mở bằng trình phát ngoài</button>
        </div>
      `;
    } else if (tab.mediaType === 'audio') {
      wrapper.innerHTML = `
        <div class="binary-card-box">
          <div class="binary-card-icon">🎵</div>
          <div class="binary-card-title">${tab.name}</div>
          <audio controls autoplay class="media-audio-player" src="${tab.url}"></audio>
          <div style="margin-top: 10px;">
            <button type="button" class="binary-card-btn" id="btn-media-open-ext">🚀 Mở bằng ứng dụng hệ thống</button>
          </div>
        </div>
      `;
    } else if (tab.mediaType === 'image') {
      wrapper.innerHTML = `
        <img class="media-image-preview" src="${tab.url}" alt="${tab.name}">
        <div style="display: flex; gap: 12px; align-items: center;">
          <span style="font-weight: 600; font-size: 12px; color: var(--text-dim);">${tab.name} (${(tab.size / 1024).toFixed(1)} KB)</span>
          <button type="button" class="binary-card-btn" id="btn-media-open-ext">🚀 Mở xem ngoài</button>
        </div>
      `;
    }

    container.appendChild(wrapper);
    wrapper.querySelector('#btn-media-open-ext')?.addEventListener('click', () => {
      window.AisaHorizon?.openExternal(tab.path);
    });
  },

  renderBinaryView(container, tab) {
    container.innerHTML = `
      <div class="binary-card-box">
        <div class="binary-card-icon">📦</div>
        <div class="binary-card-title">${tab.name}</div>
        <div class="binary-card-desc">Tệp nhị phân (${(tab.size / 1024).toFixed(1)} KB) không thể xem hoặc chỉnh sửa dưới dạng văn bản trong Monaco Editor.</div>
        <div class="binary-card-actions">
          <button type="button" class="binary-card-btn" id="btn-bin-reveal">📂 Xem trong File Explorer</button>
          <button type="button" class="binary-card-btn" id="btn-bin-open">🚀 Mở bằng ứng dụng hệ thống</button>
        </div>
      </div>
    `;

    container.querySelector('#btn-bin-reveal')?.addEventListener('click', () => {
      window.AisaHorizon?.revealInExplorer(tab.path);
    });
    container.querySelector('#btn-bin-open')?.addEventListener('click', () => {
      window.AisaHorizon?.openExternal(tab.path);
    });
  },

  // ==========================================================================
  // 5. ANTIGRAVITY DIFF REVIEW VIEW (VS CODE / ANTIGRAVITY STYLE)
  // ==========================================================================
  showDiffReview(fileName, originalText, modifiedText, onAccept, onReject = null) {
    const editorInstance = document.getElementById('monaco-editor-instance');
    const diffInstance = document.getElementById('monaco-diff-editor-instance');
    const mediaInstance = document.getElementById('media-viewer-instance');
    const diffBar = document.getElementById('diff-floating-bar');
    const diffFilename = document.getElementById('diff-bar-filename');

    if (editorInstance) editorInstance.style.display = 'none';
    if (mediaInstance) mediaInstance.style.display = 'none';
    if (diffInstance) diffInstance.style.display = 'block';
    if (diffBar) diffBar.style.display = 'flex';
    if (diffFilename) diffFilename.textContent = `Xem trước thay đổi: [${fileName}]`;

    if (this.diffEditor) {
      const ext = '.' + fileName.split('.').pop().toLowerCase();
      const lang = this.getLanguageFromExt(ext);
      const originalModel = monaco.editor.createModel(originalText, lang);
      const modifiedModel = monaco.editor.createModel(modifiedText, lang);
      this.diffEditor.setModel({ original: originalModel, modified: modifiedModel });
    }

    const btnAccept = document.getElementById('btn-diff-accept');
    const btnReject = document.getElementById('btn-diff-reject');

    const cleanup = () => {
      if (diffInstance) diffInstance.style.display = 'none';
      if (diffBar) diffBar.style.display = 'none';
      if (editorInstance) editorInstance.style.display = 'block';
      if (this.diffEditor) this.diffEditor.setModel(null);
    };

    if (btnAccept) {
      btnAccept.onclick = () => {
        cleanup();
        if (typeof onAccept === 'function') onAccept();
      };
    }

    if (btnReject) {
      btnReject.onclick = () => {
        cleanup();
        if (typeof onReject === 'function') onReject();
      };
    }
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
        document.getElementById('monaco-editor-instance').style.display = 'block';
        document.getElementById('media-viewer-instance').style.display = 'none';
        document.getElementById('monaco-diff-editor-instance').style.display = 'none';
        document.getElementById('diff-floating-bar').style.display = 'none';
        document.getElementById('editor-empty-state').style.display = 'flex';
        this.updateBreadcrumbs();
      }
    }

    this.renderTabs();
  },

  async saveActiveFile() {
    if (!this.activeTabPath) return;
    const tab = this.openTabs.find(t => t.path === this.activeTabPath);
    if (!tab || tab.isMedia || tab.isBinary || !this.editor) return;

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

  async saveAllFiles() {
    let saved = 0;
    for (const tab of this.openTabs) {
      if (tab.isDirty && tab.model) {
        const content = tab.model.getValue();
        const res = await window.AisaHorizon.writeFile(tab.path, content);
        if (res.success) {
          tab.isDirty = false;
          saved++;
        }
      }
    }
    this.renderTabs();
    this.printTerminal(`✔ Đã lưu toàn bộ ${saved} tệp đang mở!`, '#10b981');
    this.mascotSay(`🌸 Harmony: Đã lưu thành công tất cả các tệp rồi nha! ✨`);
    this.refreshGitStatus();
  },

  renderTabs() {
    const container = document.getElementById('editor-tabs-bar');
    if (!container) return;

    // Horizontal wheel scrolling for tabs bar
    if (!container._hasWheel) {
      container._hasWheel = true;
      container.addEventListener('wheel', (e) => {
        if (e.deltaY !== 0) {
          e.preventDefault();
          container.scrollLeft += e.deltaY;
        }
      }, { passive: false });
    }

    container.innerHTML = this.openTabs.map(t => {
      const isActive = t.path === this.activeTabPath;
      const icon = t.isMedia ? (t.mediaType === 'video' ? '🎬' : t.mediaType === 'audio' ? '🎵' : '🖼️') : (t.isBinary ? '📦' : this.getFileIcon(t.name));
      return `
        <div class="editor-tab ${isActive ? 'active' : ''}" data-path="${t.path}">
          <span>${icon}</span>
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

    // Synchronize Explorer "OPEN EDITORS" List
    const openList = document.getElementById('open-editors-list');
    const openCount = document.getElementById('open-editors-count');
    if (openCount) openCount.textContent = this.openTabs.length;
    if (openList) {
      if (this.openTabs.length === 0) {
        openList.innerHTML = `<div style="padding: 6px 12px; color: var(--text-dim); font-size: 11px;">Chưa mở tệp nào</div>`;
      } else {
        openList.innerHTML = this.openTabs.map(t => {
          const isActive = t.path === this.activeTabPath;
          const icon = t.isMedia ? (t.mediaType === 'video' ? '🎬' : t.mediaType === 'audio' ? '🎵' : '🖼️') : (t.isBinary ? '📦' : this.getFileIcon(t.name));
          return `
            <div class="open-editor-item ${isActive ? 'active' : ''}" data-path="${t.path}">
              <span style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <span>${icon}</span>
                <span>${t.name}${t.isDirty ? ' ●' : ''}</span>
              </span>
              <span class="open-editor-close" data-close="${t.path}">×</span>
            </div>
          `;
        }).join('');

        openList.querySelectorAll('.open-editor-item').forEach(el => {
          el.addEventListener('click', (e) => {
            if (e.target.classList.contains('open-editor-close')) return;
            this.switchTab(el.getAttribute('data-path'));
          });
        });

        openList.querySelectorAll('.open-editor-close').forEach(el => {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeTab(el.getAttribute('data-close'));
          });
        });
      }
    }
  },

  // ==========================================================================
  // 6. RECURSIVE FILE EXPLORER
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

    // Top Explorer Buttons
    const btnNewFile = document.getElementById('btn-new-file');
    if (btnNewFile) btnNewFile.onclick = () => this.createNewFilePrompt();

    const btnNewFolder = document.getElementById('btn-new-folder');
    if (btnNewFolder) btnNewFolder.onclick = () => this.createNewFolderPrompt();

    const btnRefresh = document.getElementById('btn-refresh-files');
    if (btnRefresh) btnRefresh.onclick = () => this.refreshFileTree();
  },

  async createNewFilePrompt(basePath = null) {
    const name = prompt('Nhập tên tệp mới (ví dụ: test.js, styles.css):');
    if (name && name.trim()) {
      const base = basePath || this.activeWorkspace;
      const newPath = base + '\\' + name.trim();
      await window.AisaHorizon.createFile(newPath);
      await this.refreshFileTree();
      await this.openFile(newPath);
    }
  },

  async createNewFolderPrompt(basePath = null) {
    const name = prompt('Nhập tên thư mục mới:');
    if (name && name.trim()) {
      const base = basePath || this.activeWorkspace;
      const newPath = base + '\\' + name.trim();
      await window.AisaHorizon.createDir(newPath);
      await this.refreshFileTree();
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

      row.addEventListener('click', () => this.openFile(item.path));

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
      jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', svg: '✨', mp3: '🎵', wav: '🎵',
      mp4: '🎬', webm: '🎬', mov: '🎬', zip: '📦', rar: '📦', exe: '⚙️'
    };
    return map[ext] || '📄';
  },

  // ==========================================================================
  // 7. WORKSPACE SEARCH PANEL (LIVE INSTANT SEARCH WITH DEBOUNCE)
  // ==========================================================================
  setupSearchPanel() {
    const input = document.getElementById('workspace-search-input');
    const flagCase = document.getElementById('btn-flag-case');
    const flagWord = document.getElementById('btn-flag-word');
    const flagRegex = document.getElementById('btn-flag-regex');
    const btnClear = document.getElementById('btn-clear-search');
    const resultsContainer = document.getElementById('search-results-container');
    const statusBar = document.getElementById('search-status-bar');

    let searchDebounceTimer = null;

    flagCase?.addEventListener('click', () => {
      this.searchFlags.isCase = !this.searchFlags.isCase;
      flagCase.classList.toggle('active', this.searchFlags.isCase);
      if (input.value.trim()) runSearch();
    });

    flagWord?.addEventListener('click', () => {
      this.searchFlags.isWord = !this.searchFlags.isWord;
      flagWord.classList.toggle('active', this.searchFlags.isWord);
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
      if (statusBar) statusBar.textContent = 'Gõ từ khóa để tìm kiếm tức thì';
    });

    const runSearch = async () => {
      const q = input.value.trim();
      if (!q) {
        if (resultsContainer) resultsContainer.innerHTML = '';
        if (statusBar) statusBar.textContent = 'Gõ từ khóa để tìm kiếm tức thì';
        return;
      }

      if (statusBar) statusBar.textContent = `Đang tìm kiếm "${q}"...`;

      if (!window.AisaHorizon) return;
      const res = await window.AisaHorizon.searchFiles({
        query: q,
        isCaseSensitive: this.searchFlags.isCase,
        isRegex: this.searchFlags.isRegex
      });

      if (!res.success) {
        if (statusBar) statusBar.textContent = `Lỗi tìm kiếm: ${res.error}`;
        return;
      }

      if (!res.results || res.results.length === 0) {
        if (statusBar) statusBar.textContent = `Không tìm thấy kết quả nào cho "${q}"`;
        if (resultsContainer) resultsContainer.innerHTML = '';
        return;
      }

      if (statusBar) statusBar.textContent = `Tìm thấy ${res.totalMatches || res.results.length} kết quả trong ${res.results.length} tệp`;
      if (resultsContainer) resultsContainer.innerHTML = '';

      res.results.forEach(fileResult => {
        const groupEl = document.createElement('div');
        groupEl.className = 'search-file-group';

        const header = document.createElement('div');
        header.className = 'search-file-header';
        header.innerHTML = `📄 ${fileResult.name} <span style="color: var(--text-dim); font-size: 10px;">(${fileResult.matches.length})</span>`;
        groupEl.appendChild(header);

        fileResult.matches.forEach(match => {
          const item = document.createElement('div');
          item.className = 'search-match-item';
          
          // Highlight matched substring
          const rawText = match.lineContent || '';
          let highlighted = this.escapeHtml(rawText);
          try {
            const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, this.searchFlags.isCase ? 'g' : 'gi');
            highlighted = highlighted.replace(re, '<mark class="search-highlight">$1</mark>');
          } catch (e) {}

          item.innerHTML = `
            <span class="search-match-line">${match.lineNumber}:</span>
            <span class="search-match-text">${highlighted}</span>
          `;
          item.addEventListener('click', () => {
            this.openFile(fileResult.fullPath, match.lineNumber);
          });
          groupEl.appendChild(item);
        });

        resultsContainer.appendChild(groupEl);
      });
    };

    // Live search as you type (debounced by 200ms)
    input?.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      const val = input.value.trim();
      if (!val) {
        if (resultsContainer) resultsContainer.innerHTML = '';
        if (statusBar) statusBar.textContent = 'Gõ từ khóa để tìm kiếm tức thì';
        return;
      }
      statusBar.textContent = `Đang tìm "${val}"...`;
      searchDebounceTimer = setTimeout(() => {
        runSearch();
      }, 200);
    });

    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        clearTimeout(searchDebounceTimer);
        runSearch();
      }
    });
  },

  // ==========================================================================
  // 8. MULTI-REPO GIT SOURCE CONTROL & COMMIT HISTORY
  // ==========================================================================
  async setupGitPanel() {
    const btnRefresh = document.getElementById('btn-refresh-git');
    const btnCommit = document.getElementById('btn-git-commit');
    const btnPush = document.getElementById('btn-git-push');
    const btnPull = document.getElementById('btn-git-pull');
    const repoSelect = document.getElementById('git-repo-select');
    const msgInput = document.getElementById('git-commit-msg');

    btnRefresh?.addEventListener('click', () => {
      this.refreshGitStatus();
      this.loadGitHistory();
    });

    repoSelect?.addEventListener('change', () => {
      this.selectedGitRepo = repoSelect.value;
      this.refreshGitStatus();
      this.loadGitHistory();
    });

    const executeCommit = async () => {
      const msg = msgInput?.value.trim();
      if (!msg) {
        alert('Vui lòng nhập thông điệp commit!');
        return;
      }

      this.printTerminal(`\n[Git] Đang commit repo [${this.getRepoDisplayName()}]: "${msg}"...`, '#a855f7');
      const res = await window.AisaHorizon?.gitCommit(this.selectedGitRepo, msg);

      if (res && res.success) {
        this.printTerminal(res.stdout || '✔ Commit thành công!', '#10b981');
        if (msgInput) msgInput.value = '';
        await this.refreshGitStatus();
        await this.loadGitHistory();
        this.mascotSay('😈 Echo: Commit ngon lành rồi đó Sakura! Tiếp tục chiến nào! ✨');
      } else {
        this.printTerminal(res?.error || res?.stderr || 'Lỗi khi commit', '#ef4444');
      }
    };

    btnCommit?.addEventListener('click', executeCommit);
    msgInput?.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        executeCommit();
      }
    });

    btnPush?.addEventListener('click', async () => {
      this.printTerminal(`\n[Git] Đang đẩy (git push) repo [${this.getRepoDisplayName()}]...`, '#38bdf8');
      const res = await window.AisaHorizon?.gitPush(this.selectedGitRepo);

      if (res && res.success) {
        this.printTerminal(res.stdout || '✔ Push thành công lên GitHub!', '#10b981');
        await this.refreshGitStatus();
        await this.loadGitHistory();
        this.mascotSay('🌸 Harmony: Đã đồng bộ mã nguồn lên đám mây an toàn rồi nha Sakura! ✨');
      } else {
        this.printTerminal(res?.error || res?.stderr || 'Lỗi khi push git', '#ef4444');
      }
    });

    btnPull?.addEventListener('click', async () => {
      this.printTerminal(`\n[Git] Đang kéo (git pull) repo [${this.getRepoDisplayName()}]...`, '#a855f7');
      const res = await window.AisaHorizon?.gitPull(this.selectedGitRepo);

      if (res && res.success) {
        this.printTerminal(res.stdout || '✔ Pull hoàn tất!', '#10b981');
        await this.refreshFileTree();
        await this.refreshGitStatus();
        await this.loadGitHistory();
      } else {
        this.printTerminal(res?.error || res?.stderr || 'Lỗi khi pull git', '#ef4444');
      }
    });

    await this.loadGitRepos();
  },

  getRepoDisplayName() {
    if (!this.selectedGitRepo) return 'root';
    return this.selectedGitRepo.split(/[\\/]/).pop();
  },

  async loadGitRepos() {
    const repoSelect = document.getElementById('git-repo-select');
    if (!repoSelect || !window.AisaHorizon) return;

    const res = await window.AisaHorizon.getGitRepos();
    if (res.success && res.repos.length > 0) {
      this.gitRepos = res.repos;
      repoSelect.innerHTML = res.repos.map(r => {
        return `<option value="${r.path}">${r.name}</option>`;
      }).join('');
      this.selectedGitRepo = res.repos[0].path;
      await this.refreshGitStatus();
      await this.loadGitHistory();
    } else {
      repoSelect.innerHTML = `<option value="">(Không tìm thấy repo)</option>`;
      this.selectedGitRepo = null;
      await this.refreshGitStatus();
    }
  },

  async refreshGitStatus() {
    if (!window.AisaHorizon) return;
    const res = await window.AisaHorizon.gitStatus(this.selectedGitRepo);

    const branchLabel = document.getElementById('git-branch-text');
    const sbBranchLabel = document.getElementById('sb-git-branch-name');
    const countTag = document.getElementById('git-changes-count');
    const badge = document.getElementById('git-changes-badge');
    const list = document.getElementById('git-changes-list');

    if (!res || !res.isGit) {
      if (branchLabel) branchLabel.textContent = 'Not a git repo';
      if (sbBranchLabel) sbBranchLabel.textContent = 'no git';
      if (list) list.innerHTML = `<div style="padding: 10px; color: var(--text-dim); font-size: 11px;">Thư mục này chưa khởi tạo Git</div>`;
      if (badge) badge.style.display = 'none';
      return;
    }

    if (branchLabel) branchLabel.textContent = res.branch || 'main';
    if (sbBranchLabel) sbBranchLabel.textContent = `${this.getRepoDisplayName()}:${res.branch || 'main'}`;

    const total = res.changes ? res.changes.length : 0;
    if (countTag) countTag.textContent = total;
    if (badge) {
      badge.textContent = total;
      badge.style.display = total > 0 ? 'flex' : 'none';
    }

    if (list) {
      if (total === 0) {
        list.innerHTML = `<div style="padding: 14px; color: var(--text-dim); font-size: 11px; text-align: center;">Không có tệp nào thay đổi ✔</div>`;
      } else {
        list.innerHTML = res.changes.map(f => {
          let tagClass = 'modified';
          let tagText = 'M';
          if (f.status.includes('A')) { tagClass = 'added'; tagText = 'A'; }
          else if (f.status.includes('D')) { tagClass = 'deleted'; tagText = 'D'; }
          else if (f.status.includes('?')) { tagClass = 'untracked'; tagText = 'U'; }

          return `
            <div class="git-change-item" data-path="${f.fullPath}" data-status="${f.status}">
              <span class="git-change-name" title="${f.fullPath}">${f.name}</span>
              <span class="git-status-tag ${tagClass}">${tagText}</span>
            </div>
          `;
        }).join('');

        list.querySelectorAll('.git-change-item').forEach(el => {
          el.addEventListener('click', async () => {
            const p = el.getAttribute('data-path');
            const status = el.getAttribute('data-status');

            // If file is modified, show visual Git Diff in Monaco Diff Editor!
            if (status.includes('M')) {
              const diffRes = await window.AisaHorizon.gitDiff(this.selectedGitRepo, p);
              if (diffRes && diffRes.success && diffRes.original) {
                this.showDiffReview(p.split(/[\\/]/).pop(), diffRes.original, diffRes.working, () => {
                  this.openFile(p);
                });
                return;
              }
            }
            this.openFile(p);
          });
        });
      }
    }
  },

  async loadGitHistory() {
    const list = document.getElementById('git-history-list');
    const countTag = document.getElementById('git-history-count');
    if (!list || !window.AisaHorizon || !this.selectedGitRepo) return;

    const res = await window.AisaHorizon.gitHistory(this.selectedGitRepo);
    if (!res || !res.success || !res.commits || res.commits.length === 0) {
      list.innerHTML = `<div style="padding: 10px; color: var(--text-dim); font-size: 11px;">Chưa có commit nào gần đây</div>`;
      if (countTag) countTag.textContent = '0';
      return;
    }

    if (countTag) countTag.textContent = res.commits.length;

    list.innerHTML = res.commits.map(c => {
      return `
        <div class="git-commit-card" data-hash="${c.hash}">
          <div class="git-commit-top">
            <span class="git-commit-hash">${c.shortHash}</span>
            <span class="git-commit-time">${c.relativeTime}</span>
          </div>
          <div class="git-commit-msg" title="${this.escapeHtml(c.message)}">${this.escapeHtml(c.message)}</div>
          <div class="git-commit-author">👤 ${this.escapeHtml(c.author)}</div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.git-commit-card').forEach(card => {
      card.addEventListener('click', async () => {
        const hash = card.getAttribute('data-hash');
        const existingFiles = card.querySelector('.git-history-files');
        if (existingFiles) {
          existingFiles.remove();
          return;
        }

        const filesRes = await window.AisaHorizon.gitCommitFiles(this.selectedGitRepo, hash);
        if (filesRes && filesRes.success && filesRes.files.length > 0) {
          const filesContainer = document.createElement('div');
          filesContainer.className = 'git-history-files';
          filesContainer.innerHTML = filesRes.files.map(f => {
            return `
              <div class="git-history-file-item" data-file="${f.file}">
                <span class="git-status-tag ${f.status === 'M' ? 'modified' : f.status === 'A' ? 'added' : 'deleted'}">${f.status}</span>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.file}</span>
              </div>
            `;
          }).join('');

          filesContainer.querySelectorAll('.git-history-file-item').forEach(fItem => {
            fItem.addEventListener('click', (e) => {
              e.stopPropagation();
              const rel = fItem.getAttribute('data-file');
              const full = this.selectedGitRepo + '\\' + rel.replace(/\//g, '\\');
              this.openFile(full);
            });
          });

          card.appendChild(filesContainer);
        }
      });
    });
  },

  // ==========================================================================
  // 9. INTEGRATED TERMINAL
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
              this.mascotSay('😈 Echo: Terminal báo lỗi kìa Sakura ơi! Kiểm tra lại cú pháp xem sao! 😈');
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
  // 10. GOOGLE ANTIGRAVITY SIDECAR AGENT & DIFF REVIEW
  // ==========================================================================
  setupAgentSidecar() {
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
    const fileContext = currentTab && !currentTab.isMedia && !currentTab.isBinary ? `\n[Tệp đang mở: ${currentTab.name} (${currentTab.path})]\n` : '';

    let systemPrompt = '';
    if (this.currentMode === 'agent') {
      systemPrompt = `Bạn là Google Antigravity-style Autonomous AI Agent trong AISA Horizon IDE của Miyazaki Haruto Entertainment Co., Ltd.
Đồng hành cùng Nhà sáng lập Sakura (Yurika).
ĐẶC ĐIỂM:
1. Bạn phải xuất ra quá trình suy nghĩ chi tiết theo định dạng:
<thought>
[Các bước suy nghĩ phân tích kiến trúc, rà soát logic, kế hoạch thực thi...]
</thought>
2. Sau thẻ thought, xuất câu trả lời súc tích và đoạn mã hoàn thiện (trong khối markdown \`\`\`ngôn_ngữ ... \`\`\`) bằng tiếng Việt.`;
    } else if (this.currentMode === 'chat') {
      systemPrompt = `Bạn là hệ thống AI Duo Copilot (Harmony 🌸 & Echo 😈) trong Horizon IDE.
- HARMONY 🌸: Dịu dàng, giải thích chi tiết, ân cần hướng dẫn logic.
- ECHO 😈: Sắc bén, tsundere, bắt lỗi siêu tốc, đề xuất giải pháp tối ưu.
Xuất định dạng:
HARMONY: [Nội dung giải thích]
ECHO: [Nội dung phản biện/tối ưu mã nguồn]`;
    } else {
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

    // Accordion
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

    // Answer
    const answerEl = document.createElement('div');
    answerEl.style.whiteSpace = 'pre-wrap';
    answerEl.textContent = answerText;
    bubble.appendChild(answerEl);

    // If code exists, offer Antigravity Diff Review button
    const codeMatch = answerText.match(/```[a-z]*\n([\s\S]*?)```/i);
    if (codeMatch && codeMatch[1] && this.editor) {
      const btnReview = document.createElement('button');
      btnReview.className = 'copilot-action-btn';
      btnReview.style.marginTop = '8px';
      btnReview.style.color = '#38bdf8';
      btnReview.innerHTML = '🔍 Xem trước thay đổi (Review Diff)';
      btnReview.onclick = () => {
        const curTab = this.openTabs.find(t => t.path === this.activeTabPath);
        const fileName = curTab ? curTab.name : 'Untitled.js';
        const originalCode = this.editor.getValue();
        const proposedCode = codeMatch[1].trim();

        this.showDiffReview(fileName, originalCode, proposedCode, () => {
          this.editor.setValue(proposedCode);
          this.saveActiveFile();
          this.mascotSay('✔ Đã chấp nhận thay đổi mã nguồn từ Agent!');
        });
      };
      bubble.appendChild(btnReview);
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
  // 11. INLINE AI CODE GENERATOR (CTRL+K)
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
  // 12. QUICK OPEN MODAL (CTRL+P) WITH KEYBOARD NAVIGATION
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
      const items = results.querySelectorAll('.quick-open-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.quickOpenSelectedIndex = Math.min(this.quickOpenSelectedIndex + 1, items.length - 1);
        this.updateQuickOpenHighlight(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.quickOpenSelectedIndex = Math.max(this.quickOpenSelectedIndex - 1, 0);
        this.updateQuickOpenHighlight(items);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = items[this.quickOpenSelectedIndex];
        if (selected) {
          const p = selected.getAttribute('data-path');
          this.openFile(p);
          modal.style.display = 'none';
        }
      } else if (e.key === 'Escape') {
        modal.style.display = 'none';
        if (this.editor) this.editor.focus();
      }
    });
  },

  updateQuickOpenHighlight(items) {
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === this.quickOpenSelectedIndex);
      if (idx === this.quickOpenSelectedIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  },

  async openQuickOpen() {
    const modal = document.getElementById('modal-quick-open');
    const input = document.getElementById('input-quick-open');
    if (!modal) return;

    modal.style.display = 'flex';
    this.quickOpenSelectedIndex = 0;
    if (input) {
      input.value = '';
      input.focus();
    }

    if (window.AisaHorizon) {
      const res = await window.AisaHorizon.listAllFiles();
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
      return f.name.toLowerCase().includes(query) || (f.relativePath && f.relativePath.toLowerCase().includes(query));
    }).slice(0, 40);

    this.quickOpenSelectedIndex = 0;

    if (filtered.length === 0) {
      results.innerHTML = `<div style="padding: 10px; color: var(--text-dim); text-align: center; font-size: 11px;">Không tìm thấy tệp phù hợp</div>`;
      return;
    }

    results.innerHTML = filtered.map((f, idx) => {
      const icon = this.getFileIcon(f.name);
      return `
        <div class="quick-open-item ${idx === 0 ? 'selected' : ''}" data-path="${f.fullPath}">
          <span class="quick-open-filename">${icon} ${f.name}</span>
          <span class="quick-open-filepath">${f.relativePath || ''}</span>
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
  // 13. FILE CONTEXT MENU
  // ==========================================================================
  setupContextMenu() {
    const menu = document.getElementById('file-context-menu');

    window.addEventListener('click', () => {
      if (menu) menu.style.display = 'none';
    });

    document.getElementById('ctx-new-file')?.addEventListener('click', () => {
      this.createNewFilePrompt(this.selectedContextPath);
    });

    document.getElementById('ctx-new-folder')?.addEventListener('click', () => {
      this.createNewFolderPrompt(this.selectedContextPath);
    });

    document.getElementById('ctx-reveal-explorer')?.addEventListener('click', () => {
      if (this.selectedContextPath && window.AisaHorizon) {
        window.AisaHorizon.revealInExplorer(this.selectedContextPath);
      }
    });

    document.getElementById('ctx-open-external')?.addEventListener('click', () => {
      if (this.selectedContextPath && window.AisaHorizon) {
        window.AisaHorizon.openExternal(this.selectedContextPath);
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
    menu.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 260)}px`;
    menu.style.display = 'flex';
  },

  // ==========================================================================
  // 14. COMPANION MASCOT WIDGET (HARMONY 🌸 & ECHO 😈)
  // ==========================================================================
  setupMascotWidget() {
    const widget = document.getElementById('horizon-mascot-widget');
    const closeBtn = document.getElementById('btn-close-mascot-widget');
    const harmonyCard = document.querySelector('.mascot-chibi-card.harmony');
    const echoCard = document.querySelector('.mascot-chibi-card.echo');

    closeBtn?.addEventListener('click', () => {
      if (widget) widget.style.display = 'none';
      document.getElementById('btn-toggle-mascot')?.classList.remove('active');
    });

    harmonyCard?.addEventListener('click', () => {
      const quotes = [
        '🌸 Harmony: Sakura cứ vững tâm code nhé, có em luôn ở đây hỗ trợ cậu! ✨',
        '🌸 Harmony: Đừng quên uống nước và chớp mắt nghỉ ngơi một chút nha cậu! 🍵',
        '🌸 Harmony: Mã nguồn hôm nay viết rất đẹp và trong trẻo luôn đó Sakura! 💖',
        '🌸 Harmony: Nếu gặp bug khó, cứ gọi tụi em phân tích chi tiết cho cậu nhé! 🌸'
      ];
      this.mascotSay(quotes[Math.floor(Math.random() * quotes.length)]);
    });

    echoCard?.addEventListener('click', () => {
      const quotes = [
        '😈 Echo: Nè, có đoạn nào khó quá thì gọi tôi, đừng có ngồi ngơ ra đó nha! 😈',
        '😈 Echo: Viết code phải có test đàng hoàng đấy nhé, tôi soi bug kỹ lắm đó! ⚡',
        '😈 Echo: Hừm, cũng tạm được đấy, nhưng tôi tối ưu thì còn nhanh gấp đôi! 🚀',
        '😈 Echo: Lười gõ thì bấm Ctrl+K tôi viết cho, ở đó mà cắn móng tay! 😈'
      ];
      this.mascotSay(quotes[Math.floor(Math.random() * quotes.length)]);
    });
  },

  mascotSay(text) {
    const balloon = document.getElementById('mascot-dialogue-balloon');
    if (balloon) {
      balloon.textContent = text;
      balloon.style.animation = 'none';
      balloon.offsetHeight;
      balloon.style.animation = 'fadeIn 0.2s ease';
    }
  },

  // ==========================================================================
  // 15. GLOBAL KEYBOARD SHORTCUTS
  // ==========================================================================
  setupKeybindings() {
    window.addEventListener('keydown', (e) => {
      // Ctrl + S (Save)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveActiveFile();
      }

      // Ctrl + Shift + S (Save All)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveAllFiles();
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
