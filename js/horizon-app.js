/**
 * AISA HORIZON - AI-FIRST IDE STUDIO CONTROLLER
 * Full Monaco Editor, File Explorer, Native Terminal & Copilot Duo
 * Miyazaki Haruto Entertainment Co., Ltd.
 */

window.AisaHorizonApp = {
  editor: null,
  activeWorkspace: '',
  openTabs: [], // { path, name, ext, model, isDirty }
  activeTabPath: null,
  geminiKey: '',

  async init() {
    console.log('%c[AISA Horizon IDE] Initializing Celestial Workspace...', 'color: #38bdf8; font-weight: bold;');

    // 1. Setup Native Titlebar Controls
    this.setupTitlebarControls();

    // 2. Fetch API Key and Current Workspace
    if (window.AisaHorizon) {
      this.geminiKey = await window.AisaHorizon.getApiKey();
      this.activeWorkspace = await window.AisaHorizon.getWorkspacePath();
    } else {
      this.activeWorkspace = 'C:\\MHEnt.Universe';
    }

    this.updateWorkspaceUI(this.activeWorkspace);

    // 3. Initialize Monaco Editor
    this.initMonaco();

    // 4. Load Workspace File Tree
    await this.refreshFileTree();

    // 5. Setup Terminal Runner
    this.setupTerminal();

    // 6. Setup Copilot Duo
    this.setupCopilot();

    // 7. Setup Global Keyboard Shortcuts
    this.setupKeybindings();
  },

  // ==========================================================================
  // 1. TITLEBAR & WINDOW CONTROLS
  // ==========================================================================
  setupTitlebarControls() {
    const btnMin = document.getElementById('btn-win-min');
    const btnMax = document.getElementById('btn-win-max');
    const btnClose = document.getElementById('btn-win-close');

    if (btnMin) btnMin.addEventListener('click', () => window.AisaHorizon?.minimizeWindow());
    if (btnMax) btnMax.addEventListener('click', () => window.AisaHorizon?.maximizeWindow());
    if (btnClose) btnClose.addEventListener('click', () => window.AisaHorizon?.closeWindow());

    // Change Workspace button
    const btnChangeWs = document.getElementById('btn-change-workspace');
    if (btnChangeWs) {
      btnChangeWs.addEventListener('click', async () => {
        const newPath = await window.AisaHorizon?.openWorkspaceDialog();
        if (newPath) {
          this.activeWorkspace = newPath;
          this.updateWorkspaceUI(newPath);
          await this.refreshFileTree();
        }
      });
    }

    // Run Code Button (F5)
    const btnRunCode = document.getElementById('btn-run-code');
    if (btnRunCode) {
      btnRunCode.addEventListener('click', () => this.runActiveFile());
    }

    // Toggle Copilot
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
    const folderName = wsPath.split(/[\\/]/).pop() || wsPath;

    if (label) label.textContent = folderName;
    if (sbLabel) sbLabel.textContent = `Workspace: ${folderName}`;
    if (termCwd) termCwd.textContent = `(${wsPath})`;
  },

  // ==========================================================================
  // 2. MONACO EDITOR SETUP & TAB MANAGEMENT
  // ==========================================================================
  initMonaco() {
    if (typeof require === 'undefined') {
      console.warn('Monaco loader not found, loading fallback editor...');
      return;
    }

    require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.45.0/min/vs' } });

    require(['vs/editor/editor.main'], () => {
      // Define Celestial Horizon Dark Theme
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
        bracketPairColorization: { enabled: true }
      });

      // Cursor position change listener
      this.editor.onDidChangeCursorPosition((e) => {
        const posEl = document.getElementById('sb-cursor-pos');
        if (posEl) posEl.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
      });

      // Edit listener for unsaved state
      this.editor.onDidChangeModelContent(() => {
        const activeTab = this.openTabs.find(t => t.path === this.activeTabPath);
        if (activeTab && !activeTab.isDirty) {
          activeTab.isDirty = true;
          this.renderTabs();
        }
      });
    });
  },

  getLanguageFromExt(ext) {
    const map = {
      '.js': 'javascript',
      '.mjs': 'javascript',
      '.ts': 'typescript',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.py': 'python',
      '.md': 'markdown',
      '.sql': 'sql',
      '.sh': 'shell',
      '.bat': 'bat',
      '.ps1': 'powershell',
      '.xml': 'xml',
      '.cpp': 'cpp',
      '.c': 'c',
      '.java': 'java'
    };
    return map[ext] || 'plaintext';
  },

  async openFile(filePath) {
    // Check if already open
    const existing = this.openTabs.find(t => t.path === filePath);
    if (existing) {
      this.switchTab(filePath);
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

    // Update status bar language
    const langMode = document.getElementById('sb-lang-mode');
    if (langMode) langMode.textContent = tab.lang.toUpperCase();

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

    // Attach click listeners
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
  // 3. FILE EXPLORER TREE
  // ==========================================================================
  async refreshFileTree() {
    const container = document.getElementById('file-tree-container');
    if (!container || !window.AisaHorizon) return;

    const res = await window.AisaHorizon.readDir(this.activeWorkspace);
    if (!res.success) {
      container.innerHTML = `<div style="padding: 12px; color: #ef4444;">${res.error}</div>`;
      return;
    }

    container.innerHTML = res.items.map(item => {
      const icon = item.isDirectory ? '📁' : this.getFileIcon(item.name);
      return `
        <div class="tree-item ${item.isDirectory ? 'directory' : 'file'}" data-path="${item.path}" data-isdir="${item.isDirectory}">
          <span>${icon}</span>
          <span>${item.name}</span>
        </div>
      `;
    }).join('');

    // Attach item clicks
    container.querySelectorAll('.tree-item').forEach(el => {
      el.addEventListener('click', async () => {
        const isDir = el.getAttribute('data-isdir') === 'true';
        const p = el.getAttribute('data-path');
        if (isDir) {
          // Open subfolder or set as workspace
          this.activeWorkspace = p;
          this.updateWorkspaceUI(p);
          await this.refreshFileTree();
        } else {
          await this.openFile(p);
        }
      });
    });

    // Actions
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

  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const map = {
      js: '🟨', ts: '🟦', html: '🌐', css: '🎨', json: '📋',
      py: '🐍', md: '📝', bat: '⚡', ps1: '⚡', png: '🖼️',
      jpg: '🖼️', svg: '✨', mp3: '🎵', wav: '🎵'
    };
    return map[ext] || '📄';
  },

  // ==========================================================================
  // 4. INTEGRATED POWERSHELL TERMINAL
  // ==========================================================================
  setupTerminal() {
    const input = document.getElementById('terminal-input');
    const btnClear = document.getElementById('btn-clear-terminal');
    const btnClose = document.getElementById('btn-close-terminal');
    const termPanel = document.getElementById('terminal-panel');

    if (input) {
      input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          const cmd = input.value.trim();
          if (!cmd) return;
          input.value = '';

          this.printTerminal(`\nPS ${this.activeWorkspace}> ${cmd}`, '#f472b6');

          if (cmd.toLowerCase() === 'clear' || cmd.toLowerCase() === 'cls') {
            this.clearTerminal();
            return;
          }

          if (window.AisaHorizon) {
            const res = await window.AisaHorizon.runCommand(cmd, this.activeWorkspace);
            if (res.stdout) this.printTerminal(res.stdout, '#cbd5e1');
            if (res.stderr) this.printTerminal(res.stderr, '#f87171');
          }
        }
      });
    }

    if (btnClear) btnClear.addEventListener('click', () => this.clearTerminal());
    if (btnClose && termPanel) {
      btnClose.addEventListener('click', () => {
        termPanel.style.display = 'none';
      });
    }

    const actBtnTerm = document.getElementById('act-btn-terminal');
    if (actBtnTerm && termPanel) {
      actBtnTerm.addEventListener('click', () => {
        const isHidden = termPanel.style.display === 'none';
        termPanel.style.display = isHidden ? 'flex' : 'none';
        if (isHidden && input) input.focus();
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

    // Show terminal if hidden
    const termPanel = document.getElementById('terminal-panel');
    if (termPanel) termPanel.style.display = 'flex';

    if (tab.ext === '.js') {
      this.printTerminal(`\n⚡ Đang chạy Node.js: node "${tab.name}"`, '#38bdf8');
      const res = await window.AisaHorizon.runCommand(`node "${tab.name}"`, this.activeWorkspace);
      if (res.stdout) this.printTerminal(res.stdout, '#34d399');
      if (res.stderr) this.printTerminal(res.stderr, '#f87171');
    } else if (tab.ext === '.py') {
      this.printTerminal(`\n⚡ Đang chạy Python: python "${tab.name}"`, '#38bdf8');
      const res = await window.AisaHorizon.runCommand(`python "${tab.name}"`, this.activeWorkspace);
      if (res.stdout) this.printTerminal(res.stdout, '#34d399');
      if (res.stderr) this.printTerminal(res.stderr, '#f87171');
    } else {
      this.printTerminal(`\n⚡ Mở tệp: "${tab.name}"`, '#38bdf8');
      await window.AisaHorizon.runCommand(`start "${tab.name}"`, this.activeWorkspace);
    }
  },

  // ==========================================================================
  // 5. COPILOT DUO (HARMONY & ECHO)
  // ==========================================================================
  setupCopilot() {
    const input = document.getElementById('copilot-input');
    const sendBtn = document.getElementById('btn-copilot-send');
    const clearBtn = document.getElementById('btn-clear-copilot');

    const handleSend = () => {
      const q = input.value.trim();
      if (!q) return;
      input.value = '';
      this.askCopilot(q);
    };

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSend();
      });
    }
    if (sendBtn) sendBtn.addEventListener('click', handleSend);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const c = document.getElementById('copilot-messages');
        if (c) c.innerHTML = '';
      });
    }

    // Quick AI Actions
    const btnExplain = document.getElementById('btn-ai-explain');
    const btnFix = document.getElementById('btn-ai-fix');
    const btnRefactor = document.getElementById('btn-ai-refactor');
    const btnDoc = document.getElementById('btn-ai-doc');

    if (btnExplain) btnExplain.addEventListener('click', () => this.triggerCodeAction('explain'));
    if (btnFix) btnFix.addEventListener('click', () => this.triggerCodeAction('fix'));
    if (btnRefactor) btnRefactor.addEventListener('click', () => this.triggerCodeAction('refactor'));
    if (btnDoc) btnDoc.addEventListener('click', () => this.triggerCodeAction('doc'));
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
      alert('Vui lòng mở một tệp hoặc bôi đen đoạn code để Copilot phân tích!');
      return;
    }

    const tab = this.openTabs.find(t => t.path === this.activeTabPath);
    const fileName = tab ? tab.name : 'Active File';

    if (actionType === 'explain') {
      this.askCopilot(`Hãy giải thích thật dễ hiểu cách hoạt động của đoạn code trong tệp [${fileName}] này giúp tớ nhé:\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\``);
    } else if (actionType === 'fix') {
      this.askCopilot(`Echo và Harmony ơi, đoạn code trong tệp [${fileName}] này có bug hoặc lỗi tiềm ẩn nào không? Hãy chỉ ra và viết lại bản sửa hoàn chỉnh giúp tớ:\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\``);
    } else if (actionType === 'refactor') {
      this.askCopilot(`Hãy tối ưu hóa (refactor), làm gọn và tăng tốc độ xử lý cho đoạn code [${fileName}] này:\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\``);
    } else if (actionType === 'doc') {
      this.askCopilot(`Hãy viết JSDoc / Docstring chi tiết cho các hàm trong đoạn code [${fileName}] này:\n\`\`\`\n${code.slice(0, 3000)}\n\`\`\``);
    }
  },

  async askCopilot(userPrompt) {
    this.appendCopilotMessage('user', 'Sakura', userPrompt);

    const apiKey = this.geminiKey || localStorage.getItem('mhent_ai_api_key');
    if (!apiKey) {
      this.appendCopilotMessage('harmony', '🌸 Harmony', 'Cậu ơi, chưa có Gemini API Key nên em chưa thể suy nghĩ được. Cậu vào AISA Orbit hoặc nhập key giúp em nhé!');
      return;
    }

    const systemPrompt = `Bạn là hệ thống AI Duo Copilot (AISA Horizon Studio - MHEnt Universe) chuyên lập trình cấp cao cùng Nhà sáng lập Sakura (Yurika).
Hệ thống gồm 2 nhân cách song hành:
1. HARMONY 🌸: Dịu dàng, giải thích chi tiết, ân cần hướng dẫn logic, động viên tinh thần.
2. ECHO 😈: Sắc bén, tsundere, bắt lỗi siêu tốc, đề xuất code tối ưu và cà khịa nhẹ nhàng.
QUY TẮC:
- Trả lời 100% bằng tiếng Việt tự nhiên, súc tích.
- Định dạng xuất:
  HARMONY: [Phần giải thích hoặc lời khuyên ấm áp]
  ECHO: [Phần phản biện, bắt lỗi hoặc giải pháp code tối ưu]
- Nếu có code, đặt trong khối markdown \`\`\`ngôn_ngữ ... \`\`\`.`;

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.7 }
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const output = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse Harmony & Echo replies
      const hMatch = output.match(/HARMONY:\s*([\s\S]*?)(?=ECHO:|$)/i);
      const eMatch = output.match(/ECHO:\s*([\s\S]*?)$/i);

      if (hMatch && hMatch[1].trim()) {
        this.appendCopilotMessage('harmony', '🌸 Harmony', hMatch[1].trim());
      }
      if (eMatch && eMatch[1].trim()) {
        this.appendCopilotMessage('echo', '😈 Echo', eMatch[1].trim());
      }
      if (!hMatch && !eMatch) {
        this.appendCopilotMessage('harmony', '🌸 Harmony', output);
      }
    } catch (err) {
      this.appendCopilotMessage('echo', '😈 Echo', `Lỗi kết nối rồi nè Sakura ơi: ${err.message}! Kiểm tra mạng hoặc API key lại nha. 😈`);
    }
  },

  appendCopilotMessage(role, speaker, text) {
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

    // If text contains code block, add "Apply to Editor" button
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
  // 6. GLOBAL SHORTCUTS
  // ==========================================================================
  setupKeybindings() {
    window.addEventListener('keydown', (e) => {
      // Ctrl + S (Save file)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveActiveFile();
      }

      // Ctrl + ` (Toggle terminal)
      if ((e.ctrlKey || e.metaKey) && e.key === '`') {
        e.preventDefault();
        const termPanel = document.getElementById('terminal-panel');
        if (termPanel) {
          const isHidden = termPanel.style.display === 'none';
          termPanel.style.display = isHidden ? 'flex' : 'none';
        }
      }

      // F5 (Run active file)
      if (e.key === 'F5') {
        e.preventDefault();
        this.runActiveFile();
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  window.AisaHorizonApp.init();
});
