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
  safetyMode: 'ask', // 'ask' | 'auto'
  selectedModel: 'gemini-2.0-flash',

  async init() {
    console.log('%c[AISA Horizon IDE] Initializing Celestial Studio v2.0...', 'color: #38bdf8; font-weight: bold;');

    // 1. Setup Window & Titlebar Controls + Dropdown Menus
    this.setupTitlebarControls();
    this.setupDropdownMenus();
    this.setupLayoutToggles();
    this.setupResizers();
    this.setupSafetyApprovalGate();
    this.setupModelHub();
    this.setupWelcomeScreen();

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
    this.updateWindowTitle();

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

    // 8. Setup Multi-Tab Bottom Panel (Problems, Output, Debug, Terminal, Ports)
    this.setupBottomPanel();

    // 9. Setup Settings & Preferences Modal (Ctrl+,)
    this.setupSettingsModal();

    // 10. Setup Antigravity Sidecar Agent & Modes
    this.setupAgentSidecar();

    // 11. Setup Inline AI Code Generator (Ctrl+K)
    this.setupInlineAI();

    // 12. Setup Quick Open Modal (Ctrl+P)
    this.setupQuickOpen();

    // 13. Setup File Context Menu
    this.setupContextMenu();

    // 14. Setup Floating Companion Mascot
    this.setupMascotWidget();

    // 15. Setup Global Keyboard Shortcuts
    this.setupKeybindings();

    this.mascotSay('🌸 Harmony: Chào mừng Yurika trở lại AISA Horizon Studio! Tụi em đã nâng cấp đầy đủ toàn bộ tính năng rồi nè! ✨');
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
      btnChangeWs.addEventListener('click', () => this.openWorkspaceFolder());
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

  async openWorkspaceFolder() {
    if (!window.AisaHorizon) return;
    try {
      const newPath = await window.AisaHorizon.openWorkspaceDialog();
      if (newPath) {
        this.activeWorkspace = newPath;
        this.expandedFolders.clear();
        this.updateWorkspaceUI(newPath);
        await this.refreshFileTree();
        await this.loadGitRepos();
        this.mascotSay(`Đã mở không gian làm việc: ${newPath.split(/[\\/]/).pop()} 📂`);
        this.showToast({
          title: 'Không gian làm việc',
          message: `Đã mở thư mục dự án: ${newPath}`,
          type: 'success'
        });
      }
    } catch (err) {
      console.error('Lỗi khi mở thư mục dự án:', err);
    }
  },

  updateWindowTitle() {
    const wsName = (this.activeWorkspace || '').split(/[\\/]/).pop() || 'MHEnt. Universe';
    const activeTab = this.openTabs.find(t => t.path === this.activeTabPath);
    const fileName = activeTab ? activeTab.name : 'Chưa mở tệp';

    const elFile = document.getElementById('win-title-file');
    const elWs = document.getElementById('win-title-workspace');
    if (elFile) elFile.textContent = fileName;
    if (elWs) elWs.textContent = wsName;

    // Cập nhật tiêu đề cửa sổ hệ thống
    document.title = `${fileName} — ${wsName} — MHEnt. AISA Horizon`;
  },

  setupLayoutToggles() {
    const btnLeft = document.getElementById('btn-toggle-primary-sidebar');
    const btnBottom = document.getElementById('btn-toggle-bottom-panel');
    const btnRight = document.getElementById('btn-toggle-secondary-sidebar');
    const btnSettings = document.getElementById('btn-top-settings');

    const sidebar = document.getElementById('horizon-sidebar');
    const terminal = document.getElementById('terminal-panel');
    const copilot = document.getElementById('horizon-copilot-panel');

    const togglePanel = (el, btn) => {
      if (!el) return;
      const isHidden = el.style.display === 'none';
      el.style.display = isHidden ? 'flex' : 'none';
      btn?.classList.toggle('active', isHidden);
      setTimeout(() => {
        this.editor?.layout();
        this.diffEditor?.layout();
      }, 50);
    };

    if (btnLeft && sidebar) {
      btnLeft.addEventListener('click', () => togglePanel(sidebar, btnLeft));
    }

    if (btnBottom && terminal) {
      btnBottom.addEventListener('click', () => {
        this.toggleBottomPanel();
      });
    }

    if (btnRight && copilot) {
      btnRight.addEventListener('click', () => togglePanel(copilot, btnRight));
    }

    if (btnSettings) {
      btnSettings.addEventListener('click', () => {
        this.openSettingsModal();
      });
    }

    const dynTitle = document.getElementById('dynamic-window-title');
    if (dynTitle) {
      dynTitle.addEventListener('click', () => this.openWorkspaceFolder());
    }
  },

  setupResizers() {
    const resizerLeft = document.getElementById('resizer-left');
    const resizerRight = document.getElementById('resizer-right');
    const resizerBottom = document.getElementById('resizer-bottom');

    const sidebar = document.getElementById('horizon-sidebar');
    const copilot = document.getElementById('horizon-copilot-panel');
    const terminal = document.getElementById('terminal-panel');

    // 1. Resizer Left (Sidebar Width)
    if (resizerLeft && sidebar) {
      let isDragging = false;
      resizerLeft.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        resizerLeft.classList.add('resizing');
        document.body.classList.add('resizing-active');
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const activityBarWidth = 48;
        const newWidth = Math.max(160, Math.min(600, e.clientX - activityBarWidth));
        sidebar.style.width = `${newWidth}px`;
        this.editor?.layout();
        this.diffEditor?.layout();
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          resizerLeft.classList.remove('resizing');
          document.body.classList.remove('resizing-active');
          this.editor?.layout();
          this.diffEditor?.layout();
        }
      });
    }

    // 2. Resizer Right (AI Studio Width)
    if (resizerRight && copilot) {
      let isDragging = false;
      resizerRight.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        resizerRight.classList.add('resizing');
        document.body.classList.add('resizing-active');
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const newWidth = Math.max(260, Math.min(750, window.innerWidth - e.clientX));
        copilot.style.width = `${newWidth}px`;
        this.editor?.layout();
        this.diffEditor?.layout();
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          resizerRight.classList.remove('resizing');
          document.body.classList.remove('resizing-active');
          this.editor?.layout();
          this.diffEditor?.layout();
        }
      });
    }

    // 3. Resizer Bottom (Terminal Height)
    if (resizerBottom && terminal) {
      let isDragging = false;
      resizerBottom.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        resizerBottom.classList.add('resizing');
        document.body.classList.add('resizing-active');
      });

      window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const statusbarHeight = 26;
        const newHeight = Math.max(100, Math.min(600, window.innerHeight - statusbarHeight - e.clientY));
        terminal.style.height = `${newHeight}px`;
        this.editor?.layout();
        this.diffEditor?.layout();
      });

      window.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          resizerBottom.classList.remove('resizing');
          document.body.classList.remove('resizing-active');
          this.editor?.layout();
          this.diffEditor?.layout();
        }
      });
    }
  },

  setupSafetyApprovalGate() {
    this.safetyMode = 'ask'; // 'ask' | 'auto'
    const btnToggle = document.getElementById('btn-toggle-safety-mode');
    const modeText = document.getElementById('safety-mode-text');
    const modeIcon = document.getElementById('safety-mode-icon');

    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        if (this.safetyMode === 'ask') {
          this.safetyMode = 'auto';
          if (modeText) modeText.innerHTML = 'Lệnh: <b>Tự động chạy</b>';
          if (modeIcon) modeIcon.textContent = '⚡';
          this.showToast({
            title: 'Chế độ Duyệt Lệnh',
            message: 'Đã chuyển sang chế độ Tự động chạy (Auto-run) — Agent sẽ tự thực thi các lệnh mà không cần dừng lại hỏi.',
            type: 'info'
          });
        } else {
          this.safetyMode = 'ask';
          if (modeText) modeText.innerHTML = 'Lệnh: <b>Hỏi trước khi chạy</b>';
          if (modeIcon) modeIcon.textContent = '🛡️';
          this.showToast({
            title: 'Chế độ Duyệt Lệnh',
            message: 'Đã bật chế độ Bảo vệ (Ask for Confirmation) — Agent sẽ hỏi ý kiến cậu trước khi chạy lệnh console hoặc sửa đổi file.',
            type: 'success'
          });
        }
      });
    }
  },

  setupModelHub() {
    const selectModel = document.getElementById('select-agent-model');
    const modelIcon = document.getElementById('agent-model-icon');
    const btnUndo = document.getElementById('btn-undo-agent-action');
    const sbStatus = document.getElementById('sb-ai-status');

    if (selectModel) {
      selectModel.addEventListener('change', async () => {
        this.selectedModel = selectModel.value;

        if (this.selectedModel === 'ollama-local') {
          if (modelIcon) modelIcon.textContent = '🦙';
          const res = await window.AisaHorizon?.checkOllama();
          if (res && res.online) {
            const names = (res.models || []).map(m => m.name).join(', ') || 'qwen2.5-coder';
            if (sbStatus) sbStatus.textContent = `● Ollama Local Online (${res.models.length} models)`;
            this.showToast({
              title: 'Ollama Local AI (0đ)',
              message: `Đã kết nối thành công Ollama! Tìm thấy ${res.models.length} model: ${names}. Hoạt động 100% offline trên GPU không tốn 1 xu và không cần API Key!`,
              type: 'success'
            });
          } else {
            if (sbStatus) sbStatus.textContent = '○ Ollama Offline (localhost:11434)';
            this.showToast({
              title: 'Ollama Chưa Khởi Chạy',
              message: 'Không phát hiện Ollama trên http://localhost:11434. Cậu hãy bật Ollama để dùng Local AI không cần API key nhé!',
              type: 'warning'
            });
          }
        } else if (this.selectedModel === 'mhent-proxy') {
          if (modelIcon) modelIcon.textContent = '🌐';
          if (sbStatus) sbStatus.textContent = '● MHEnt Cloud Proxy Account';
          this.showToast({
            title: 'MHEnt Cloud Account',
            message: 'Đã kích hoạt chế độ Tài khoản Đám mây MHEnt Universe (Tương tự Antigravity/Cursor) — Sử dụng hạn ngạch đám mây tập trung!',
            type: 'info'
          });
        } else if (this.selectedModel === 'custom-key') {
          if (modelIcon) modelIcon.textContent = '🔑';
          this.openSettingsModal('ai');
          this.showToast({
            title: 'Cấu hình API Key',
            message: 'Đã mở bảng Cài Đặt AI để thiết lập API Key hoặc Base URL!',
            type: 'info'
          });
        } else if (this.selectedModel === 'gemini-2.0-pro') {
          if (modelIcon) modelIcon.textContent = '🧠';
          if (sbStatus) sbStatus.textContent = '● Gemini 2.0 Pro Exp Online';
        } else {
          if (modelIcon) modelIcon.textContent = '🌟';
          if (sbStatus) sbStatus.textContent = '● Gemini 2.0 Flash Online';
        }
      });
    }

    if (btnUndo) {
      btnUndo.addEventListener('click', async () => {
        const res = await window.AisaHorizon?.undoLastAgentAction();
        if (res && res.success) {
          this.showToast({
            title: 'Hoàn Tác An Toàn',
            message: res.message,
            type: 'success'
          });
          this.printTerminal(`\n✔ [Rollback] ${res.message}`, '#10b981');
          this.mascotSay(`🌸 Harmony: Đã hoàn tác an toàn tệp ${res.restoredFile ? res.restoredFile.split(/[\\/]/).pop() : ''} rồi nhé Yurika!`);
          await this.refreshFileTree();
          await this.refreshGitStatus();
          if (this.activeTabPath && res.restoredFile && this.activeTabPath.toLowerCase().endsWith(res.restoredFile.split(/[\\/]/).pop().toLowerCase())) {
            const readFileRes = await window.AisaHorizon?.readFile(this.activeTabPath);
            if (readFileRes && readFileRes.success && this.editor) {
              this.editor.setValue(readFileRes.content);
            }
          }
        } else {
          this.showToast({
            title: 'Hoàn Tác',
            message: res?.message || 'Không có bản sao lưu snapshot nào gần đây.',
            type: 'info'
          });
        }
      });
    }
  },

  setupWelcomeScreen() {
    document.getElementById('card-welcome-new-file')?.addEventListener('click', () => this.createNewFilePrompt());
    document.getElementById('card-welcome-open-folder')?.addEventListener('click', () => this.openWorkspaceFolder());
    document.getElementById('card-welcome-quick-open')?.addEventListener('click', () => this.openQuickOpen());
    document.getElementById('card-welcome-agent')?.addEventListener('click', () => document.getElementById('btn-toggle-secondary-sidebar')?.click());
    document.getElementById('card-welcome-terminal')?.addEventListener('click', () => {
      this.switchBottomTab('terminal');
      this.toggleBottomPanel(true);
    });
    document.getElementById('card-welcome-inline-ai')?.addEventListener('click', () => this.openInlineAI());
  },

  showToast({ title = 'AISA Horizon', message = '', type = 'info', actions = [], duration = 5000 }) {
    const container = document.getElementById('horizon-toast-container');
    if (!container) return null;

    const toast = document.createElement('div');
    toast.className = 'horizon-toast';

    const header = document.createElement('div');
    header.className = 'toast-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    const icon = type === 'success' ? '✔' : type === 'warning' ? '⚠' : type === 'error' ? '✖' : '🌸';
    titleEl.innerHTML = `<span>${icon}</span><span>${title}</span>`;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.textContent = '✕';
    closeBtn.onclick = () => dismiss();

    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    toast.appendChild(header);

    if (message) {
      const body = document.createElement('div');
      body.className = 'toast-body';
      body.textContent = message;
      toast.appendChild(body);
    }

    if (actions && actions.length > 0) {
      const actRow = document.createElement('div');
      actRow.className = 'toast-actions';
      actions.forEach(act => {
        const btn = document.createElement('button');
        btn.className = `toast-btn ${act.primary ? 'btn-primary' : ''}`;
        btn.textContent = act.label;
        btn.onclick = () => {
          act.callback?.();
          dismiss();
        };
        actRow.appendChild(btn);
      });
      toast.appendChild(actRow);
    }

    const dismiss = () => {
      toast.classList.add('hiding');
      setTimeout(() => toast.remove(), 250);
    };

    if (duration > 0) {
      setTimeout(dismiss, duration);
    }

    container.appendChild(toast);
    return toast;
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

    let isAnyMenuOpen = false;

    const closeAllDropdowns = () => {
      menus.forEach(m => {
        const el = document.getElementById(m.dropdown);
        const trigger = document.getElementById(m.id);
        if (el) el.style.display = 'none';
        if (trigger) trigger.classList.remove('active');
      });
      isAnyMenuOpen = false;
    };

    const openDropdown = (targetDropdownId, targetTriggerId) => {
      menus.forEach(m => {
        const el = document.getElementById(m.dropdown);
        const trigger = document.getElementById(m.id);
        if (el) el.style.display = (m.dropdown === targetDropdownId) ? 'flex' : 'none';
        if (trigger) trigger.classList.toggle('active', m.id === targetTriggerId);
      });
      isAnyMenuOpen = true;
    };

    menus.forEach(m => {
      const trigger = document.getElementById(m.id);
      if (trigger) {
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          const dropdown = document.getElementById(m.dropdown);
          const isShown = dropdown && dropdown.style.display === 'flex';
          if (isShown) {
            closeAllDropdowns();
          } else {
            openDropdown(m.dropdown, m.id);
          }
        });

        trigger.addEventListener('mouseenter', () => {
          if (isAnyMenuOpen) {
            openDropdown(m.dropdown, m.id);
          }
        });
      }
    });

    window.addEventListener('click', () => closeAllDropdowns());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isAnyMenuOpen) {
        closeAllDropdowns();
      }
    });

    // 1. Tệp Actions
    document.getElementById('menu-action-new-file')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.createNewFilePrompt();
    });
    document.getElementById('menu-action-open-folder')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.openWorkspaceFolder();
    });
    document.getElementById('menu-action-save')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.saveActiveFile();
    });
    document.getElementById('menu-action-save-all')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.saveAllFiles();
    });
    document.getElementById('menu-action-close-tab')?.addEventListener('click', () => {
      closeAllDropdowns();
      if (this.activeTabPath) this.closeTab(this.activeTabPath);
    });
    document.getElementById('menu-action-exit')?.addEventListener('click', () => {
      closeAllDropdowns();
      window.AisaHorizon?.closeWindow();
    });

    // 2. Chỉnh sửa Actions
    document.getElementById('menu-action-undo')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.editor?.trigger('menu', 'undo');
    });
    document.getElementById('menu-action-redo')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.editor?.trigger('menu', 'redo');
    });
    document.getElementById('menu-action-cut')?.addEventListener('click', () => {
      closeAllDropdowns();
      document.execCommand('cut');
      this.editor?.focus();
    });
    document.getElementById('menu-action-copy')?.addEventListener('click', () => {
      closeAllDropdowns();
      document.execCommand('copy');
      this.editor?.focus();
    });
    document.getElementById('menu-action-paste')?.addEventListener('click', async () => {
      closeAllDropdowns();
      try {
        const text = await navigator.clipboard.readText();
        if (text && this.editor) {
          this.editor.trigger('keyboard', 'type', { text });
        }
      } catch (e) {
        this.editor?.focus();
      }
    });
    document.getElementById('menu-action-find')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.editor?.getAction('actions.find')?.run();
    });
    document.getElementById('menu-action-replace')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.editor?.getAction('editor.action.startFindReplaceAction')?.run();
    });
    document.getElementById('menu-action-format')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.editor?.getAction('editor.action.formatDocument')?.run();
    });

    // 3. Lựa chọn Actions
    document.getElementById('menu-action-select-all')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.editor?.getAction('editor.action.selectAll')?.run();
    });
    document.getElementById('menu-action-expand-selection')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.editor?.getAction('editor.action.smartSelect.expand')?.run();
    });

    // 4. Xem Actions
    document.getElementById('menu-action-view-explorer')?.addEventListener('click', () => {
      closeAllDropdowns();
      document.getElementById('act-btn-explorer')?.click();
    });
    document.getElementById('menu-action-view-search')?.addEventListener('click', () => {
      closeAllDropdowns();
      document.getElementById('act-btn-search')?.click();
    });
    document.getElementById('menu-action-view-git')?.addEventListener('click', () => {
      closeAllDropdowns();
      document.getElementById('act-btn-git')?.click();
    });
    document.getElementById('menu-action-view-terminal')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.switchBottomTab('terminal');
      this.toggleBottomPanel(true);
    });
    document.getElementById('menu-action-view-copilot')?.addEventListener('click', () => {
      closeAllDropdowns();
      const copilot = document.getElementById('horizon-copilot-panel');
      if (copilot && copilot.style.display === 'none') {
        document.getElementById('btn-toggle-secondary-sidebar')?.click();
      }
      document.getElementById('copilot-input')?.focus();
    });
    document.getElementById('menu-action-toggle-wrap')?.addEventListener('click', () => {
      closeAllDropdowns();
      if (this.editor) {
        const cur = this.editor.getOption(monaco.editor.EditorOption.wordWrap);
        this.editor.updateOptions({ wordWrap: cur === 'on' ? 'off' : 'on' });
      }
    });

    // 5. Terminal Actions
    document.getElementById('menu-action-term-toggle')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.toggleBottomPanel();
    });
    document.getElementById('menu-action-term-clear')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.clearTerminal();
    });
    document.getElementById('menu-action-term-run')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.runActiveFile();
    });

    // 6. AI Agent Actions
    document.getElementById('menu-action-agent-open')?.addEventListener('click', () => {
      closeAllDropdowns();
      const copilot = document.getElementById('horizon-copilot-panel');
      if (copilot && copilot.style.display === 'none') {
        document.getElementById('btn-toggle-secondary-sidebar')?.click();
      }
      document.getElementById('copilot-input')?.focus();
    });
    document.getElementById('menu-action-agent-inline')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.openInlineAI();
    });
    document.getElementById('menu-action-agent-explain')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.triggerCodeAction('explain');
    });
    document.getElementById('menu-action-agent-fix')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.triggerCodeAction('fix');
    });
    document.getElementById('menu-action-agent-refactor')?.addEventListener('click', () => {
      closeAllDropdowns();
      this.triggerCodeAction('refactor');
    });
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
      this.updateWindowTitle();
      return;
    }

    const relPath = this.activeTabPath.replace(this.activeWorkspace, '').replace(/^[\\/]/, '');
    if (breadcrumbCurrent) breadcrumbCurrent.textContent = relPath.replace(/\\/g, ' / ');
    if (contextActive) contextActive.textContent = relPath.split(/[\\/]/).pop();
    this.updateWindowTitle();
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
        this.openSettingsModal();
      });
    }

    // Explorer Header Action Buttons
    document.getElementById('btn-change-workspace')?.addEventListener('click', () => this.openWorkspaceFolder());
    document.getElementById('btn-new-file')?.addEventListener('click', () => this.createNewFilePrompt());
    document.getElementById('btn-new-folder')?.addEventListener('click', () => this.createNewFolderPrompt());
    document.getElementById('btn-refresh-files')?.addEventListener('click', () => this.refreshFileTree());
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
      this.mascotSay(`🌸 Harmony: Đã lưu an toàn tệp [${tab.name}] rồi nhé Yurika! ✨`);
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
        <div class="editor-tab ${isActive ? 'active' : ''}" data-path="${t.path}" title="${t.path}">
          <span class="tab-icon">${icon}</span>
          <span class="tab-title">${t.name}${t.isDirty ? ' ●' : ''}</span>
          <span class="tab-close" data-close="${t.path}" title="Đóng tệp (Ctrl+W)">×</span>
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

    // Auto-scroll active tab into view
    if (this.activeTabPath) {
      const activeEl = container.querySelector(`.editor-tab[data-path="${CSS.escape(this.activeTabPath)}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }

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

  showInputDialog({ title, desc, icon, defaultValue = '', placeholder = '' }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('horizon-input-modal');
      const titleEl = document.getElementById('input-modal-title');
      const descEl = document.getElementById('input-modal-desc');
      const iconEl = document.getElementById('input-modal-icon');
      const field = document.getElementById('input-modal-field');
      const btnOk = document.getElementById('input-modal-btn-ok');
      const btnCancel = document.getElementById('input-modal-btn-cancel');

      if (!modal || !field) {
        resolve(null);
        return;
      }

      if (titleEl) titleEl.textContent = title || 'Nhập thông tin';
      if (descEl) descEl.textContent = desc || '';
      if (iconEl) iconEl.textContent = icon || '📄';
      field.value = defaultValue || '';
      field.placeholder = placeholder || '';

      modal.style.display = 'flex';
      setTimeout(() => {
        field.focus();
        field.select();
      }, 50);

      const cleanup = (val) => {
        modal.style.display = 'none';
        field.onkeydown = null;
        if (btnOk) btnOk.onclick = null;
        if (btnCancel) btnCancel.onclick = null;
        modal.onclick = null;
        resolve(val);
      };

      field.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          cleanup(field.value.trim());
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cleanup(null);
        }
      };

      if (btnOk) btnOk.onclick = () => cleanup(field.value.trim());
      if (btnCancel) btnCancel.onclick = () => cleanup(null);
      modal.onclick = (e) => {
        if (e.target === modal) cleanup(null);
      };
    });
  },

  showConfirmDialog({ title, desc, okText = 'Xác nhận' }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('horizon-confirm-modal');
      const titleEl = document.getElementById('confirm-modal-title');
      const descEl = document.getElementById('confirm-modal-desc');
      const btnOk = document.getElementById('confirm-modal-btn-ok');
      const btnCancel = document.getElementById('confirm-modal-btn-cancel');

      if (!modal) {
        resolve(false);
        return;
      }

      if (titleEl) titleEl.textContent = title || 'Xác nhận thao tác';
      if (descEl) descEl.textContent = desc || '';
      if (btnOk) btnOk.textContent = okText;

      modal.style.display = 'flex';

      const cleanup = (val) => {
        modal.style.display = 'none';
        if (btnOk) btnOk.onclick = null;
        if (btnCancel) btnCancel.onclick = null;
        modal.onclick = null;
        window.removeEventListener('keydown', handleKey);
        resolve(val);
      };

      const handleKey = (e) => {
        if (e.key === 'Escape') {
          cleanup(false);
        } else if (e.key === 'Enter') {
          cleanup(true);
        }
      };
      window.addEventListener('keydown', handleKey);

      if (btnOk) btnOk.onclick = () => cleanup(true);
      if (btnCancel) btnCancel.onclick = () => cleanup(false);
      modal.onclick = (e) => {
        if (e.target === modal) cleanup(false);
      };
    });
  },

  async createNewFilePrompt(basePath = null) {
    let base = basePath || this.activeWorkspace;
    if (this.selectedContextIsDir === false || (base && base.match(/\.[a-zA-Z0-9]+$/))) {
      base = base.substring(0, base.lastIndexOf('\\')) || base;
    }
    const name = await this.showInputDialog({
      title: 'Tạo tệp mới (New File)',
      desc: `Vị trí tạo tệp: ${base}`,
      icon: '📄',
      placeholder: 'Ví dụ: script.js, style.css hoặc src/components/App.jsx'
    });
    if (name && name.trim()) {
      const cleanName = name.trim();
      let targetPath;
      if (cleanName.includes(':') || cleanName.startsWith('\\') || cleanName.startsWith('/')) {
        targetPath = cleanName;
      } else {
        targetPath = base.replace(/[\\/]+$/, '') + '\\' + cleanName.replace(/\//g, '\\');
      }
      if (!window.AisaHorizon?.createFile) {
        this.showToast({
          title: 'Lỗi môi trường',
          message: 'Không tìm thấy API hệ thống Electron để tạo tệp!',
          type: 'error'
        });
        return;
      }
      const res = await window.AisaHorizon.createFile(targetPath);
      if (res && res.success) {
        await this.refreshFileTree();
        await this.openFile(targetPath);
        this.mascotSay(`🌸 Harmony: Đã tạo tệp mới [${cleanName}] cho Yurika rồi nè! ✨`);
        this.logOutput(`✔ Created new file: ${targetPath}`, 'agent');
        this.showToast({
          title: 'Tạo tệp thành công',
          message: `Đã tạo tệp [${cleanName}] và mở vào trình soạn thảo!`,
          type: 'success'
        });
      } else {
        this.showToast({
          title: 'Lỗi tạo tệp',
          message: res?.error || 'Không thể tạo tệp',
          type: 'error'
        });
        this.printTerminal(`❌ Lỗi tạo tệp: ${res?.error || 'Không thể tạo tệp'}`, '#ef4444');
      }
    }
  },

  async createNewFolderPrompt(basePath = null) {
    let base = basePath || this.activeWorkspace;
    if (this.selectedContextIsDir === false || (base && base.match(/\.[a-zA-Z0-9]+$/))) {
      base = base.substring(0, base.lastIndexOf('\\')) || base;
    }
    const name = await this.showInputDialog({
      title: 'Tạo thư mục mới (New Folder)',
      desc: `Vị trí tạo thư mục: ${base}`,
      icon: '📁',
      placeholder: 'Ví dụ: components, utils hoặc assets/images'
    });
    if (name && name.trim()) {
      const cleanName = name.trim();
      let targetPath;
      if (cleanName.includes(':') || cleanName.startsWith('\\') || cleanName.startsWith('/')) {
        targetPath = cleanName;
      } else {
        targetPath = base.replace(/[\\/]+$/, '') + '\\' + cleanName.replace(/\//g, '\\');
      }
      if (!window.AisaHorizon?.createDir) {
        this.showToast({
          title: 'Lỗi môi trường',
          message: 'Không tìm thấy API hệ thống Electron để tạo thư mục!',
          type: 'error'
        });
        return;
      }
      const res = await window.AisaHorizon.createDir(targetPath);
      if (res && res.success) {
        await this.refreshFileTree();
        this.mascotSay(`🌸 Harmony: Đã tạo thư mục [${cleanName}] thành công! ✨`);
        this.logOutput(`✔ Created directory: ${targetPath}`, 'agent');
        this.showToast({
          title: 'Tạo thư mục thành công',
          message: `Đã tạo thư mục [${cleanName}] thành công!`,
          type: 'success'
        });
      } else {
        this.showToast({
          title: 'Lỗi tạo thư mục',
          message: res?.error || 'Không thể tạo thư mục',
          type: 'error'
        });
        this.printTerminal(`❌ Lỗi tạo thư mục: ${res?.error || 'Không thể tạo thư mục'}`, '#ef4444');
      }
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
        this.mascotSay('😈 Echo: Commit ngon lành rồi đó Yurika! Tiếp tục chiến nào! ✨');
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
        this.mascotSay('🌸 Harmony: Đã đồng bộ mã nguồn lên đám mây an toàn rồi nha Yurika! ✨');
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
  // 9. INTEGRATED TERMINAL (STREAMING PTY & ANSI ACCELERATED)
  // ==========================================================================
  formatAnsiToHtml(rawText) {
    if (!rawText) return '';
    let html = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html
      .replace(/\x1b\[1m/g, '<span class="ansi-bold">')
      .replace(/\x1b\[2m/g, '<span class="ansi-dim">')
      .replace(/\x1b\[31m/g, '<span class="ansi-red">')
      .replace(/\x1b\[32m/g, '<span class="ansi-green">')
      .replace(/\x1b\[33m/g, '<span class="ansi-yellow">')
      .replace(/\x1b\[34m/g, '<span class="ansi-cyan">')
      .replace(/\x1b\[35m/g, '<span class="ansi-purple">')
      .replace(/\x1b\[36m/g, '<span class="ansi-cyan">')
      .replace(/\x1b\[37m/g, '<span style="color:#f1f5f9">')
      .replace(/\x1b\[90m/g, '<span class="ansi-dim">')
      .replace(/\x1b\[0m/g, '</span>')
      .replace(/\x1b\[[0-9;]*m/g, '');

    return html;
  },

  printTerminalHtml(html) {
    const container = document.getElementById('terminal-output-container');
    if (!container) return;
    const line = document.createElement('div');
    line.innerHTML = html;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  },

  activeBottomTab: 'terminal',
  selectedShell: 'powershell',
  selectedOutputChannel: 'agent',

  setupBottomPanel() {
    const termPanel = document.getElementById('terminal-panel');
    const tabBtns = document.querySelectorAll('.bottom-tab-btn');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-panel-tab');
        if (targetTab) this.switchBottomTab(targetTab);
      });
    });

    // Shell selector (powershell vs cmd)
    const shellSelect = document.getElementById('select-terminal-shell');
    if (shellSelect) {
      shellSelect.addEventListener('change', (e) => {
        this.selectedShell = e.target.value;
        this.printTerminal(`[Switched terminal shell profile to: ${this.selectedShell}]`, '#38bdf8');
      });
    }

    // Output Channel selector
    const outChanSelect = document.getElementById('select-output-channel');
    if (outChanSelect) {
      outChanSelect.addEventListener('change', (e) => {
        this.selectedOutputChannel = e.target.value;
      });
    }

    // Clear output button
    document.getElementById('btn-clear-output')?.addEventListener('click', () => {
      const outBox = document.getElementById('output-log-container');
      if (outBox) outBox.innerHTML = '<div class="output-line info">[System] Luồng Output đã được làm sạch.</div>';
    });

    // Refresh ports button
    document.getElementById('btn-refresh-ports')?.addEventListener('click', () => {
      this.refreshPorts();
    });

    // Maximize / Restore Bottom Panel
    const btnMaxBottom = document.getElementById('btn-maximize-bottom-panel');
    if (btnMaxBottom && termPanel) {
      btnMaxBottom.addEventListener('click', () => {
        termPanel.classList.toggle('maximized');
        setTimeout(() => {
          this.editor?.layout();
          this.diffEditor?.layout();
        }, 50);
      });
    }

    // Close Bottom Panel
    const btnCloseBottom = document.getElementById('btn-close-terminal');
    if (btnCloseBottom && termPanel) {
      btnCloseBottom.addEventListener('click', () => {
        this.toggleBottomPanel(false);
      });
    }

    // Setup Debug Console REPL
    this.setupDebugConsole();

    // Setup Streaming Terminal Controls
    this.setupTerminalRunner();

    // Default tab
    this.switchBottomTab('terminal');
  },

  switchBottomTab(tabName) {
    this.activeBottomTab = tabName;
    const tabBtns = document.querySelectorAll('.bottom-tab-btn');
    tabBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-panel-tab') === tabName);
    });

    const subviews = {
      problems: document.getElementById('subview-problems'),
      output: document.getElementById('subview-output'),
      debug: document.getElementById('subview-debug'),
      terminal: document.getElementById('subview-terminal'),
      ports: document.getElementById('subview-ports')
    };

    Object.keys(subviews).forEach(k => {
      const el = subviews[k];
      if (el) el.style.display = (k === tabName) ? 'flex' : 'none';
    });

    // Toggle header action groups
    const termControls = document.getElementById('terminal-controls-group');
    const outControls = document.getElementById('output-controls-group');
    const portsControls = document.getElementById('ports-controls-group');

    if (termControls) termControls.style.display = (tabName === 'terminal') ? 'flex' : 'none';
    if (outControls) outControls.style.display = (tabName === 'output') ? 'flex' : 'none';
    if (portsControls) portsControls.style.display = (tabName === 'ports') ? 'flex' : 'none';

    if (tabName === 'problems') {
      this.refreshProblems();
    } else if (tabName === 'ports') {
      this.refreshPorts();
    } else if (tabName === 'terminal') {
      document.getElementById('terminal-input')?.focus();
    } else if (tabName === 'debug') {
      document.getElementById('debug-console-input')?.focus();
    }
  },

  toggleBottomPanel(forceOpen = null) {
    const termPanel = document.getElementById('terminal-panel');
    const btnBottom = document.getElementById('btn-toggle-bottom-panel');
    if (!termPanel) return;
    const willShow = forceOpen !== null ? forceOpen : (termPanel.style.display === 'none');
    termPanel.style.display = willShow ? 'flex' : 'none';
    btnBottom?.classList.toggle('active', willShow);
    if (willShow) {
      if (this.activeBottomTab === 'terminal') {
        document.getElementById('terminal-input')?.focus();
      } else if (this.activeBottomTab === 'debug') {
        document.getElementById('debug-console-input')?.focus();
      }
    }
    setTimeout(() => {
      this.editor?.layout();
      this.diffEditor?.layout();
    }, 50);
  },

  refreshProblems() {
    const container = document.getElementById('problems-container');
    const badge = document.getElementById('problems-count-badge');
    if (!container) return;

    let markers = [];
    if (window.monaco && this.editor) {
      markers = monaco.editor.getModelMarkers({});
    }

    if (badge) badge.textContent = markers.length;

    if (markers.length === 0) {
      container.innerHTML = `
        <div class="bottom-empty-state">
          <span class="empty-icon" style="color: #10b981;">✔</span>
          <span>Không phát hiện vấn đề hay lỗi cú pháp nào trong không gian làm việc hiện tại.</span>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    markers.forEach(m => {
      const item = document.createElement('div');
      item.className = 'problem-item';
      const isErr = m.severity === 8;
      const isWarn = m.severity === 4;
      const icon = isErr ? '❌' : isWarn ? '⚠️' : 'ℹ️';
      const iconClass = isErr ? 'error' : isWarn ? 'warning' : 'info';

      const fileName = m.resource?.path?.split(/[\\/]/).pop() || 'Tệp hiện tại';

      item.innerHTML = `
        <span class="problem-icon ${iconClass}">${icon}</span>
        <span class="problem-msg">${this.escapeHtml(m.message)}</span>
        <span class="problem-location">${fileName} [${m.startLineNumber}, ${m.startColumn}]</span>
      `;

      item.addEventListener('click', () => {
        if (m.resource?.fsPath) {
          this.openFile(m.resource.fsPath, m.startLineNumber);
        } else if (this.editor) {
          this.editor.revealPositionInCenter({ lineNumber: m.startLineNumber, column: m.startColumn });
          this.editor.setPosition({ lineNumber: m.startLineNumber, column: m.startColumn });
          this.editor.focus();
        }
      });

      container.appendChild(item);
    });
  },

  logOutput(channel, text, type = 'info') {
    const container = document.getElementById('output-log-container');
    if (!container) return;
    const line = document.createElement('div');
    line.className = `output-line ${type}`;
    line.setAttribute('data-channel', channel);
    const time = new Date().toLocaleTimeString();
    line.textContent = `[${time}] [${channel}] ${text}`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
  },

  setupDebugConsole() {
    const input = document.getElementById('debug-console-input');
    const output = document.getElementById('debug-console-output');
    if (!input || !output) return;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = input.value.trim();
        if (!val) return;
        input.value = '';

        const inLine = document.createElement('div');
        inLine.className = 'debug-line input';
        inLine.textContent = `> ${val}`;
        output.appendChild(inLine);

        try {
          const evaluated = eval(val);
          const outLine = document.createElement('div');
          outLine.className = 'debug-line result';
          outLine.textContent = typeof evaluated === 'object' ? JSON.stringify(evaluated, null, 2) : String(evaluated);
          output.appendChild(outLine);
        } catch (err) {
          const errLine = document.createElement('div');
          errLine.className = 'debug-line error';
          errLine.textContent = `Uncaught ${err.name}: ${err.message}`;
          output.appendChild(errLine);
        }
        output.scrollTop = output.scrollHeight;
      }
    });
  },

  async refreshPorts() {
    const tbody = document.getElementById('ports-table-body');
    const badge = document.getElementById('ports-count-badge');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="color: var(--text-dim); text-align: center; padding: 12px;">Đang quét các cổng mạng cục bộ...</td></tr>';

    const testPorts = [
      { port: 3000, desc: 'Web App / Next.js / React' },
      { port: 5173, desc: 'Vite Dev Server' },
      { port: 8080, desc: 'Webpack / Local Backend' },
      { port: 11434, desc: 'Ollama Local AI API' },
      { port: 8000, desc: 'Python FastAPI / Django' },
      { port: 5000, desc: 'Flask / Express Server' }
    ];

    let openCount = 0;
    const rows = [];

    for (const p of testPorts) {
      let isOpen = false;
      try {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 400);
        await fetch(`http://127.0.0.1:${p.port}`, { method: 'GET', mode: 'no-cors', signal: ctrl.signal });
        clearTimeout(timeout);
        isOpen = true;
      } catch (e) {
        isOpen = false;
      }

      if (isOpen) {
        openCount++;
        rows.push(`
          <tr>
            <td><b style="color: var(--accent-blue);">${p.port}</b></td>
            <td>HTTP / TCP</td>
            <td>${p.desc}</td>
            <td><span class="port-status-pill open">● OPEN</span></td>
            <td>
              <button type="button" class="port-open-btn" onclick="window.AisaHorizon?.openExternal('http://localhost:${p.port}')">Mở trình duyệt ↗</button>
            </td>
          </tr>
        `);
      }
    }

    if (badge) badge.textContent = openCount;

    if (rows.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="color: var(--text-dim); text-align: center; padding: 16px;">
            Không phát hiện máy chủ cục bộ nào đang lắng nghe trên các cổng phổ biến (3000, 5173, 8080, 11434). Hãy chạy lệnh 'npm run dev' hoặc khởi động server!
          </td>
        </tr>
      `;
    } else {
      tbody.innerHTML = rows.join('');
    }
  },

  setupTerminalRunner() {
    const input = document.getElementById('terminal-input');
    const btnClear = document.getElementById('btn-clear-terminal');
    const btnStop = document.getElementById('btn-stop-terminal');
    const runningBadge = document.getElementById('terminal-running-badge');

    let history = [];
    let historyIdx = -1;

    // Listen to real-time streaming data from main process
    if (window.AisaHorizon?.onTerminalStreamData) {
      window.AisaHorizon.onTerminalStreamData(({ type, text }) => {
        if (type === 'stderr') {
          this.printTerminalHtml(`<span class="ansi-red">${this.formatAnsiToHtml(text)}</span>`);
        } else {
          this.printTerminalHtml(this.formatAnsiToHtml(text));
        }
      });
    }

    if (window.AisaHorizon?.onTerminalStreamExit) {
      window.AisaHorizon.onTerminalStreamExit(({ code }) => {
        if (runningBadge) runningBadge.style.display = 'none';
        if (btnStop) btnStop.style.display = 'none';
        const color = code === 0 ? '#34d399' : '#f87171';
        this.printTerminal(`[Process completed with exit code ${code}]`, color);
      });
    }

    if (btnStop) {
      btnStop.addEventListener('click', async () => {
        await window.AisaHorizon?.stopCommand();
        if (runningBadge) runningBadge.style.display = 'none';
        btnStop.style.display = 'none';
        this.printTerminal('\n[Process terminated by user (Ctrl+C)]', '#ef4444');
      });
    }

    const selectShell = document.getElementById('select-terminal-shell');
    if (selectShell) {
      selectShell.addEventListener('change', (e) => {
        const shellType = e.target.value;
        this.printTerminal(`[AISA Horizon] Môi trường dòng lệnh hiện tại: ${shellType.toUpperCase()}`, '#38bdf8');
        this.logOutput(`Terminal shell changed to ${shellType}`, 'system');
      });
    }

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

          const prefix = this.selectedShell === 'cmd' ? 'CMD' : 'PS';
          this.printTerminal(`\n${prefix} ${this.activeWorkspace}> ${cmd}`, '#f472b6');

          if (cmd.toLowerCase() === 'clear' || cmd.toLowerCase() === 'cls') {
            this.clearTerminal();
            return;
          }

          if (runningBadge) runningBadge.style.display = 'inline-block';
          if (btnStop) btnStop.style.display = 'inline-flex';

          if (window.AisaHorizon?.runCommandStream) {
            await window.AisaHorizon.runCommandStream(cmd, this.activeWorkspace);
          } else if (window.AisaHorizon?.runCommand) {
            const res = await window.AisaHorizon.runCommand(cmd, this.activeWorkspace);
            if (runningBadge) runningBadge.style.display = 'none';
            if (btnStop) btnStop.style.display = 'none';
            if (res.stdout) this.printTerminal(res.stdout, '#cbd5e1');
            if (res.stderr) {
              this.printTerminal(res.stderr, '#f87171');
              this.mascotSay('😈 Echo: Terminal báo lỗi kìa Yurika ơi! Kiểm tra lại cú pháp xem sao! 😈');
            }
          }
        }
      });
    }

    if (btnClear) btnClear.addEventListener('click', () => this.clearTerminal());
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

    this.switchBottomTab('terminal');
    this.toggleBottomPanel(true);

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

  getAgentToolDeclarations() {
    return [
      {
        name: 'read_file',
        description: 'Đọc nội dung một tệp văn bản từ không gian làm việc.',
        parameters: {
          type: 'OBJECT',
          properties: {
            filePath: { type: 'STRING', description: 'Đường dẫn tệp tương đối hoặc tuyệt đối' },
            startLine: { type: 'INTEGER', description: 'Dòng bắt đầu (1-indexed)' },
            endLine: { type: 'INTEGER', description: 'Dòng kết thúc (1-indexed)' }
          },
          required: ['filePath']
        }
      },
      {
        name: 'write_to_file',
        description: 'Ghi hoặc tạo mới một tệp với nội dung đầy đủ (tự động tạo backup snapshot).',
        parameters: {
          type: 'OBJECT',
          properties: {
            filePath: { type: 'STRING', description: 'Đường dẫn tệp cần ghi' },
            content: { type: 'STRING', description: 'Nội dung đầy đủ của tệp' }
          },
          required: ['filePath', 'content']
        }
      },
      {
        name: 'replace_file_content',
        description: 'Thay thế một đoạn mã chính xác trong tệp bằng đoạn mã mới (tự động tạo backup snapshot).',
        parameters: {
          type: 'OBJECT',
          properties: {
            filePath: { type: 'STRING', description: 'Đường dẫn tệp cần sửa' },
            targetContent: { type: 'STRING', description: 'Đoạn mã hiện tại cần thay thế (phải khớp chính xác)' },
            replacementContent: { type: 'STRING', description: 'Đoạn mã mới thay thế vào' }
          },
          required: ['filePath', 'targetContent', 'replacementContent']
        }
      },
      {
        name: 'list_dir',
        description: 'Liệt kê danh sách các tệp và thư mục con trong thư mục.',
        parameters: {
          type: 'OBJECT',
          properties: {
            dirPath: { type: 'STRING', description: 'Đường dẫn thư mục (để trống nếu muốn đọc thư mục gốc)' }
          }
        }
      },
      {
        name: 'grep_search',
        description: 'Tìm kiếm chuỗi hoặc từ khóa trên toàn bộ dự án.',
        parameters: {
          type: 'OBJECT',
          properties: {
            query: { type: 'STRING', description: 'Từ khóa cần tìm' },
            isCaseSensitive: { type: 'BOOLEAN', description: 'Phân biệt hoa thường' }
          },
          required: ['query']
        }
      },
      {
        name: 'run_command',
        description: 'Thực thi một câu lệnh trong Terminal PowerShell của dự án.',
        parameters: {
          type: 'OBJECT',
          properties: {
            command: { type: 'STRING', description: 'Lệnh cần chạy (ví dụ: npm test, git status...)' },
            cwd: { type: 'STRING', description: 'Thư mục thực thi lệnh (mặc định là thư mục workspace)' }
          },
          required: ['command']
        }
      }
    ];
  },

  async requestToolApproval(toolName, args) {
    if (['read_file', 'list_dir', 'grep_search'].includes(toolName)) {
      return true;
    }

    if (this.safetyMode === 'auto') {
      return true;
    }

    return new Promise((resolve) => {
      const container = document.getElementById('copilot-messages');
      if (!container) return resolve(true);

      const card = document.createElement('div');
      card.className = 'agent-tool-card pending';

      const header = document.createElement('div');
      header.className = 'tool-card-header';
      const label = toolName === 'run_command'
        ? '⚡ Yêu cầu chạy Terminal'
        : toolName === 'write_to_file'
          ? '📄 Yêu cầu tạo/ghi tệp'
          : '📝 Yêu cầu sửa đổi tệp';
      header.innerHTML = `<span>${label}</span><span class="tool-card-badge">Chờ duyệt</span>`;

      const preview = document.createElement('div');
      preview.className = 'tool-card-preview';
      if (toolName === 'run_command') {
        preview.textContent = `$ ${args.command}`;
      } else if (toolName === 'replace_file_content') {
        preview.textContent = `[Tệp: ${args.filePath}]\n--- Cần thay thế:\n${(args.targetContent || '').slice(0, 300)}\n+++ Thay bằng:\n${(args.replacementContent || '').slice(0, 300)}`;
      } else if (toolName === 'write_to_file') {
        preview.textContent = `[Tệp: ${args.filePath}]\n${(args.content || '').slice(0, 400)}...`;
      }

      const actions = document.createElement('div');
      actions.className = 'tool-card-actions';

      const btnAllow = document.createElement('button');
      btnAllow.className = 'tool-btn-allow';
      btnAllow.textContent = '✔ Cho phép (Allow)';
      btnAllow.onclick = () => {
        card.className = 'agent-tool-card executed';
        header.querySelector('.tool-card-badge').textContent = 'Đã duyệt';
        header.querySelector('.tool-card-badge').style.color = '#34d399';
        actions.remove();
        resolve(true);
      };

      const btnDeny = document.createElement('button');
      btnDeny.className = 'tool-btn-deny';
      btnDeny.textContent = '✕ Từ chối (Deny)';
      btnDeny.onclick = () => {
        card.className = 'agent-tool-card denied';
        header.querySelector('.tool-card-badge').textContent = 'Bị từ chối';
        header.querySelector('.tool-card-badge').style.color = '#ef4444';
        actions.remove();
        resolve(false);
      };

      const btnAlways = document.createElement('button');
      btnAlways.className = 'safety-mode-btn';
      btnAlways.textContent = '⚡ Luôn cho phép (Auto)';
      btnAlways.onclick = () => {
        document.getElementById('btn-toggle-safety-mode')?.click();
        card.className = 'agent-tool-card executed';
        header.querySelector('.tool-card-badge').textContent = 'Tự động duyệt';
        actions.remove();
        resolve(true);
      };

      actions.appendChild(btnAllow);
      actions.appendChild(btnDeny);
      actions.appendChild(btnAlways);

      card.appendChild(header);
      card.appendChild(preview);
      card.appendChild(actions);

      container.appendChild(card);
      container.scrollTop = container.scrollHeight;
    });
  },

  async executeAgentTool(toolName, args) {
    if (!window.AisaHorizon?.agentExecuteTool) {
      return { success: false, error: 'Desktop bridge không hỗ trợ agentExecuteTool.' };
    }

    const res = await window.AisaHorizon.agentExecuteTool(toolName, args);

    if (['write_to_file', 'replace_file_content'].includes(toolName) && res.success) {
      this.refreshFileTree();
      this.refreshGitStatus();

      const targetPath = args.filePath;
      const tab = this.openTabs.find(t => t.path && (t.path === targetPath || t.path.endsWith(targetPath.replace(/\//g, '\\')) || targetPath.endsWith(t.path)));
      if (tab) {
        const fileData = await window.AisaHorizon.readFile(tab.path);
        if (fileData.success && this.editor && this.activeTabPath === tab.path) {
          tab.content = fileData.content;
          tab.isDirty = false;
          this.editor.setValue(fileData.content);
          this.renderTabs();
        }
      }
    }

    if (toolName === 'run_command') {
      const termPanel = document.getElementById('terminal-panel');
      if (termPanel && termPanel.style.display === 'none') {
        termPanel.style.display = 'flex';
        document.getElementById('btn-toggle-bottom-panel')?.classList.add('active');
      }
      this.printTerminal(`\n[Agent Execution] ${args.command}`, '#38bdf8');
      if (res.stdout) this.printTerminal(res.stdout, '#cbd5e1');
      if (res.stderr) this.printTerminal(res.stderr, '#f87171');
    }

    return res;
  },

  async runOllamaAgentLoop(userPrompt, fileContext) {
    this.appendAgentMessage('harmony', '🦙 Ollama Local', 'Đang kết nối tới mô hình AI Local trên máy tính (0đ / Miễn phí 100%)...');
    try {
      const res = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'qwen2.5-coder:7b',
          messages: [
            {
              role: 'system',
              content: 'Bạn là Trợ lý AI lập trình trong AISA Horizon IDE. Đồng hành cùng Nhà sáng lập & Kiến trúc sư trưởng Yorutsuki Yurika. Trả lời chi tiết, xuất mã nguồn chuẩn xác bằng tiếng Việt.'
            },
            {
              role: 'user',
              content: fileContext + userPrompt
            }
          ],
          stream: false
        })
      });

      if (!res.ok) throw new Error(`Ollama phản hồi mã HTTP ${res.status}`);
      const data = await res.json();
      const output = data.message?.content || '';
      this.appendAgentAccordion('Xử lý bởi GPU / CPU nội bộ (Ollama Local)', output);
    } catch (e) {
      this.appendAgentMessage('echo', '😈 Echo', `Không thể gửi tới Ollama (${e.message}). Cậu đảm bảo Ollama đang chạy ở cổng 11434 nhé!`);
    }
  },

  async askAgent(userPrompt) {
    this.appendAgentMessage('user', 'Yorutsuki Yurika', userPrompt);

    const currentTab = this.openTabs.find(t => t.path === this.activeTabPath);
    const fileContext = currentTab && !currentTab.isMedia && !currentTab.isBinary ? `\n[Tệp đang mở: ${currentTab.name} (${currentTab.path})]\n` : '';

    if (this.selectedModel === 'ollama-local') {
      await this.runOllamaAgentLoop(userPrompt, fileContext);
      return;
    }

    let apiKey = this.geminiKey || localStorage.getItem('mhent_ai_api_key');
    if (!apiKey) {
      apiKey = await window.AisaHorizon?.getApiKey();
    }
    if (!apiKey && this.selectedModel !== 'mhent-proxy') {
      this.appendAgentMessage('harmony', '🌸 Harmony', 'Cậu ơi, chưa có Gemini API Key! Cậu chọn "🦙 Ollama Local" ở thanh chọn model bên trên để dùng miễn phí không cần key, hoặc bấm vào "🔑 Tự nhập API Key" nhé! ✨');
      return;
    }

    const modelName = this.selectedModel === 'gemini-2.0-pro' ? 'gemini-2.0-pro-exp-02-05' : 'gemini-2.0-flash';
    const systemPrompt = `Bạn là Google Antigravity-style Autonomous AI Agent trong AISA Horizon IDE của Miyazaki Haruto Entertainment Co., Ltd.
Đồng hành cùng Nhà sáng lập & Kiến trúc sư trưởng Yorutsuki Yurika.
ĐẶC ĐIỂM QUAN TRỌNG:
1. Bạn có đầy đủ công cụ thực thi: read_file, write_to_file, replace_file_content, list_dir, grep_search, run_command.
2. Khi người dùng giao nhiệm vụ tạo, sửa code, refactor, kiểm tra lỗi hoặc chạy terminal, bạn hãy CHỦ ĐỘNG GỌI CÔNG CỤ để thực thi trực tiếp, không chỉ nói suông!
3. Luôn suy nghĩ kỹ lưỡng phân tích kiến trúc trước khi hành động:
<thought>
[Kế hoạch thực thi, rà soát logic...]
</thought>
4. Sử dụng tiếng Việt thân thiện, chuyên nghiệp, chính xác.`;

    const contents = [
      { role: 'user', parts: [{ text: fileContext + userPrompt }] }
    ];

    const tools = [{ functionDeclarations: this.getAgentToolDeclarations() }];

    let turn = 0;
    const maxTurns = 6;

    while (turn < maxTurns) {
      turn++;
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents,
            tools: this.currentMode === 'agent' ? tools : undefined,
            generationConfig: { maxOutputTokens: 4096, temperature: 0.4 }
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const candidate = data.candidates?.[0];
        if (!candidate || !candidate.content) {
          this.appendAgentMessage('echo', '😈 Echo', 'Không nhận được phản hồi từ model. Thử lại xem sao nhé!');
          break;
        }

        const parts = candidate.content.parts || [];
        let hasFunctionCall = false;

        for (const part of parts) {
          if (part.text) {
            const rawOutput = part.text;
            if (this.currentMode === 'agent') {
              const thoughtMatch = rawOutput.match(/<thought>([\s\S]*?)<\/thought>/i);
              const thoughtText = thoughtMatch ? thoughtMatch[1].trim() : '';
              const finalAnswer = rawOutput.replace(/<thought>[\s\S]*?<\/thought>/i, '').trim();
              if (thoughtText || finalAnswer) {
                this.appendAgentAccordion(thoughtText || 'Phân tích các bước thực thi...', finalAnswer || rawOutput);
              }
            } else {
              this.appendAgentMessage('harmony', '🌸 Harmony', rawOutput);
            }
          }

          if (part.functionCall) {
            hasFunctionCall = true;
            const call = part.functionCall;
            const toolName = call.name;
            const args = call.args || {};

            const isApproved = await this.requestToolApproval(toolName, args);

            let toolResult = null;
            if (isApproved) {
              toolResult = await this.executeAgentTool(toolName, args);
            } else {
              toolResult = { success: false, error: 'Hành động đã bị Nhà sáng lập Yorutsuki Yurika từ chối.' };
              this.showToast({
                title: 'Lệnh Bị Từ Chối',
                message: `Cậu đã từ chối thực thi công cụ: ${toolName}`,
                type: 'warning'
              });
            }

            contents.push({
              role: 'model',
              parts: [{ functionCall: call }]
            });

            contents.push({
              role: 'user',
              parts: [{
                functionResponse: {
                  name: toolName,
                  response: { content: toolResult }
                }
              }]
            });
          }
        }

        if (!hasFunctionCall) {
          break;
        }

      } catch (err) {
        this.appendAgentMessage('echo', '😈 Echo', `Lỗi ReAct Agent: ${err.message}! Cậu kiểm tra lại mạng hoặc API Key nha. 😈`);
        break;
      }
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
        this.mascotSay('🌸 Harmony: Đã chèn mã thành công rồi nhé Yurika! ✨');
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
      const newName = await this.showInputDialog({
        title: 'Đổi tên tệp / thư mục (Rename)',
        desc: `Đổi tên hiện tại [${oldName}] sang tên mới:`,
        icon: '✏️',
        defaultValue: oldName,
        placeholder: 'Nhập tên mới...'
      });
      if (newName && newName.trim() && newName.trim() !== oldName) {
        const cleanName = newName.trim();
        const parentDir = this.selectedContextPath.substring(0, this.selectedContextPath.lastIndexOf('\\'));
        const newPath = parentDir + '\\' + cleanName;
        const res = await window.AisaHorizon?.renamePath(this.selectedContextPath, newPath);
        if (res && res.success) {
          // If active tab was renamed, update tab
          const tab = this.openTabs.find(t => t.path === this.selectedContextPath);
          if (tab) {
            tab.path = newPath;
            tab.name = cleanName;
          }
          if (this.activeTabPath === this.selectedContextPath) {
            this.activeTabPath = newPath;
          }
          this.renderTabs();
          await this.refreshFileTree();
          this.mascotSay(`✏️ Đã đổi tên thành công sang [${cleanName}]! ✨`);
        } else {
          this.printTerminal(`❌ Lỗi đổi tên: ${res?.error || 'Không thể đổi tên'}`, '#ef4444');
        }
      }
    });

    document.getElementById('ctx-delete-file')?.addEventListener('click', async () => {
      if (!this.selectedContextPath) return;
      const name = this.selectedContextPath.split(/[\\/]/).pop();
      const confirmed = await this.showConfirmDialog({
        title: 'Xóa vĩnh viễn tệp / thư mục',
        desc: `Yurika có chắc chắn muốn xóa [${name}] không? Hành động này sẽ xóa hoàn toàn khỏi ổ đĩa.`,
        okText: 'Xóa vĩnh viễn'
      });
      if (confirmed) {
        const res = await window.AisaHorizon?.deletePath(this.selectedContextPath);
        if (res && res.success) {
          this.closeTab(this.selectedContextPath);
          await this.refreshFileTree();
          this.mascotSay(`🗑️ Đã xóa [${name}] thành công! ✨`);
        } else {
          this.printTerminal(`❌ Lỗi khi xóa: ${res?.error || 'Không thể xóa'}`, '#ef4444');
        }
      }
    });
  },

  openContextMenu(x, y, targetPath, isDir) {
    const menu = document.getElementById('file-context-menu');
    if (!menu) return;

    this.selectedContextPath = targetPath;
    this.selectedContextIsDir = isDir;
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
        '🌸 Harmony: Yurika cứ vững tâm code nhé, có em luôn ở đây hỗ trợ cậu! ✨',
        '🌸 Harmony: Đừng quên uống nước và chớp mắt nghỉ ngơi một chút nha cậu! 🍵',
        '🌸 Harmony: Mã nguồn hôm nay viết rất đẹp và trong trẻo luôn đó Yurika! 💖',
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
  // 15. SETTINGS & PREFERENCES MODAL (CTRL+,)
  // ==========================================================================
  setupSettingsModal() {
    const modal = document.getElementById('modal-settings');
    const closeBtn = document.getElementById('btn-close-settings-modal');
    const navBtns = document.querySelectorAll('.settings-nav-btn');

    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-settings-tab');
        if (tab) this.switchSettingsTab(tab);
      });
    });

    closeBtn?.addEventListener('click', () => this.closeSettingsModal());
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) this.closeSettingsModal();
    });

    // Font size
    const fontSizeInput = document.getElementById('setting-font-size');
    if (fontSizeInput) {
      fontSizeInput.addEventListener('change', (e) => {
        const size = parseInt(e.target.value) || 14;
        this.editor?.updateOptions({ fontSize: size });
        localStorage.setItem('mhent_horizon_font_size', size);
      });
    }

    // Word wrap
    const wordWrapSelect = document.getElementById('setting-word-wrap');
    if (wordWrapSelect) {
      wordWrapSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        this.editor?.updateOptions({ wordWrap: val });
        localStorage.setItem('mhent_horizon_word_wrap', val);
      });
    }

    // Auto save
    const autoSaveSelect = document.getElementById('setting-auto-save');
    if (autoSaveSelect) {
      autoSaveSelect.addEventListener('change', (e) => {
        localStorage.setItem('mhent_horizon_auto_save', e.target.value);
      });
    }

    // Browse workspace button
    document.getElementById('btn-settings-browse-workspace')?.addEventListener('click', () => {
      this.openWorkspaceFolder();
      const wsInput = document.getElementById('setting-workspace-path');
      if (wsInput) wsInput.value = this.activeWorkspace;
    });

    // Toggle Gemini key visibility
    const keyInput = document.getElementById('setting-gemini-key');
    const toggleKeyBtn = document.getElementById('btn-toggle-key-visibility');
    if (keyInput && toggleKeyBtn) {
      toggleKeyBtn.addEventListener('click', () => {
        keyInput.type = (keyInput.type === 'password') ? 'text' : 'password';
        toggleKeyBtn.textContent = (keyInput.type === 'password') ? '👁️' : '🔒';
      });
    }

    // Save Gemini Key
    document.getElementById('btn-save-gemini-key')?.addEventListener('click', async () => {
      const newKey = keyInput ? keyInput.value.trim() : '';
      if (window.AisaHorizon?.saveApiKey) {
        await window.AisaHorizon.saveApiKey(newKey);
      }
      this.geminiKey = newKey;
      localStorage.setItem('mhent_ai_api_key', newKey);
      this.mascotSay('🌸 Harmony: Đã lưu API Key an toàn trong hệ thống Studio! ✨');
      this.showToast({
        title: 'Cài Đặt AI',
        message: 'Đã lưu Google Gemini API Key an toàn trên máy.',
        type: 'success'
      });
    });

    // Test Ollama Connection
    const testOllamaBtn = document.getElementById('btn-test-ollama');
    const ollamaHint = document.getElementById('ollama-status-hint');
    if (testOllamaBtn && ollamaHint) {
      testOllamaBtn.addEventListener('click', async () => {
        ollamaHint.textContent = 'Trạng thái: Đang kiểm tra cổng 11434...';
        ollamaHint.style.color = '#38bdf8';
        if (window.AisaHorizon?.checkOllama) {
          const res = await window.AisaHorizon.checkOllama();
          if (res?.connected) {
            ollamaHint.textContent = `Trạng thái: ✔ Đã kết nối Ollama (${res.models?.length || 0} mô hình sẵn có)`;
            ollamaHint.style.color = '#34d399';
          } else {
            ollamaHint.textContent = 'Trạng thái: ⚠ Không thấy tiến trình Ollama chạy ở http://localhost:11434';
            ollamaHint.style.color = '#f87171';
          }
        }
      });
    }

    // Default model select
    const defaultModelSelect = document.getElementById('setting-default-model');
    if (defaultModelSelect) {
      defaultModelSelect.addEventListener('change', (e) => {
        this.selectedModel = e.target.value;
        const mainSelect = document.getElementById('select-agent-model');
        if (mainSelect) mainSelect.value = this.selectedModel;
      });
    }

    // Safety mode select
    const safetyModeSelect = document.getElementById('setting-safety-mode');
    if (safetyModeSelect) {
      safetyModeSelect.addEventListener('change', (e) => {
        this.safetyMode = e.target.value;
        const stripText = document.getElementById('safety-mode-text');
        if (stripText) {
          stripText.innerHTML = this.safetyMode === 'ask'
            ? 'Lệnh: <b>Hỏi trước khi chạy</b>'
            : 'Lệnh: <b style="color: #f59e0b;">Tự động cho phép</b>';
        }
      });
    }

    // Mascot visibility switch
    const mascotSwitch = document.getElementById('setting-mascot-visible');
    const mascotWidget = document.getElementById('horizon-mascot-widget');
    if (mascotSwitch && mascotWidget) {
      mascotSwitch.addEventListener('change', (e) => {
        mascotWidget.style.display = e.target.checked ? 'flex' : 'none';
        document.getElementById('btn-toggle-mascot')?.classList.toggle('active', e.target.checked);
      });
    }
  },

  openSettingsModal(tab = 'general') {
    const modal = document.getElementById('modal-settings');
    if (!modal) return;
    this.switchSettingsTab(tab);

    const wsInput = document.getElementById('setting-workspace-path');
    if (wsInput) wsInput.value = this.activeWorkspace;

    const keyInput = document.getElementById('setting-gemini-key');
    if (keyInput) keyInput.value = this.geminiKey || '';

    const modelSelect = document.getElementById('setting-default-model');
    if (modelSelect) modelSelect.value = this.selectedModel;

    const safetySelect = document.getElementById('setting-safety-mode');
    if (safetySelect) safetySelect.value = this.safetyMode;

    modal.style.display = 'flex';
  },

  closeSettingsModal() {
    const modal = document.getElementById('modal-settings');
    if (modal) modal.style.display = 'none';
  },

  switchSettingsTab(tabName) {
    const navBtns = document.querySelectorAll('.settings-nav-btn');
    navBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-settings-tab') === tabName);
    });

    const panels = {
      general: document.getElementById('settings-panel-general'),
      ai: document.getElementById('settings-panel-ai'),
      appearance: document.getElementById('settings-panel-appearance'),
      shortcuts: document.getElementById('settings-panel-shortcuts'),
      about: document.getElementById('settings-panel-about')
    };

    Object.keys(panels).forEach(k => {
      const p = panels[k];
      if (p) p.style.display = (k === tabName) ? 'flex' : 'none';
    });
  },

  // ==========================================================================
  // 16. GLOBAL KEYBOARD SHORTCUTS
  // ==========================================================================
  setupKeybindings() {
    window.addEventListener('keydown', (e) => {
      // Ctrl + N (New File)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this.createNewFilePrompt();
      }

      // Ctrl + O (Open Folder)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.openWorkspaceFolder();
      }

      // Ctrl + S (Save)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveActiveFile();
      }

      // Ctrl + Shift + S (Save All)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveAllFiles();
      }

      // Ctrl + W (Close Active Tab)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (this.activeTabPath) this.closeTab(this.activeTabPath);
      }

      // Ctrl + P (Quick Open)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        this.openQuickOpen();
      }

      // Ctrl + K (Inline AI)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        this.openInlineAI();
      }

      // Ctrl + B (Toggle Left Primary Sidebar)
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        document.getElementById('btn-toggle-primary-sidebar')?.click();
      }

      // Ctrl + ` or Ctrl + J (Toggle Bottom Panel)
      if (((e.ctrlKey || e.metaKey) && e.key === '`') || ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'j')) {
        e.preventDefault();
        this.toggleBottomPanel();
      }

      // Ctrl + Shift + I (Toggle Right AI Sidecar)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        document.getElementById('btn-toggle-secondary-sidebar')?.click();
      }

      // Ctrl + Shift + E (Focus Explorer)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        document.getElementById('act-btn-explorer')?.click();
      }

      // Ctrl + Shift + F (Focus Search)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        document.getElementById('act-btn-search')?.click();
      }

      // Ctrl + Shift + G (Focus Git)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        document.getElementById('act-btn-git')?.click();
      }

      // Ctrl + , (Open Settings Modal)
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        this.openSettingsModal();
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

      // Escape (Close open overlays)
      if (e.key === 'Escape') {
        this.closeSettingsModal();
        const quickOpen = document.getElementById('modal-quick-open');
        if (quickOpen) quickOpen.style.display = 'none';
        const ctxMenu = document.getElementById('file-context-menu');
        if (ctxMenu) ctxMenu.style.display = 'none';
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
