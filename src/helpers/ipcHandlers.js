const { ipcMain, app } = require("electron");
const path = require("path");
const fs = require("fs");
const AITextProcessor = require("./aiTextProcessor");

class IPCHandlers {
  constructor(managers) {
    this.environmentManager = managers.environmentManager;
    this.databaseManager = managers.databaseManager;
    this.clipboardManager = managers.clipboardManager;
    this.sherpaManager = managers.sherpaManager;
    this.windowManager = managers.windowManager;
    this.hotkeyManager = managers.hotkeyManager;
    this.typelessManager = managers.typelessManager;
    this.logger = managers.logger; // 添加logger引用
    this.aiProcessor = new AITextProcessor(this.databaseManager, this.logger);
    
    // 跟踪F2热键注册状态
    this.f2RegisteredSenders = new Set();
    
    this.setupHandlers();
  }

  setupHandlers() {
    // 环境和配置相关
    ipcMain.handle("get-config", () => {
      return this.environmentManager.exportConfig();
    });

    ipcMain.handle("validate-environment", () => {
      return this.environmentManager.validateEnvironment();
    });

    // 录音相关
    ipcMain.handle("start-recording", async () => {
      // TODO: 实现录音开始功能
      return { success: true };
    });

    ipcMain.handle("stop-recording", async () => {
      // TODO: 实现录音停止功能
      return { success: true };
    });

    // Sherpa ASR 相关
    ipcMain.handle("check-sherpa-status", async () => {
      console.log("[IPC] check-sherpa-status 被調用, serverReady:", this.sherpaManager.serverReady);
      const status = await this.sherpaManager.checkStatus();
      console.log("[IPC] check-sherpa-status 返回:", JSON.stringify(status));
      return {
        ...status,
        server_ready: this.sherpaManager.serverReady
      };
    });

    ipcMain.handle("sherpa-status", async () => {
      return await this.sherpaManager.checkStatus();
    });

    // 模型文件管理
    ipcMain.handle("check-model-files", async () => {
      console.log("[IPC] check-model-files 被調用");
      const result = await this.sherpaManager.checkModelFiles();
      // 同時返回服務器狀態，避免前端需要額外調用
      const serverStatus = {
        server_ready: this.sherpaManager.serverReady,
        models_initialized: this.sherpaManager.modelsInitialized
      };
      console.log("[IPC] check-model-files 返回:", JSON.stringify({...result, ...serverStatus}));
      return { ...result, ...serverStatus };
    });

    ipcMain.handle("get-download-progress", async () => {
      return await this.sherpaManager.getDownloadProgress();
    });

    ipcMain.handle("download-models", async (event) => {
      return await this.sherpaManager.downloadModels((progress) => {
        event.sender.send("model-download-progress", progress);
      });
    });

    // AI文本处理（實作在 aiTextProcessor.js）
    ipcMain.handle("process-text", async (event, text, mode = 'optimize') => {
      return await this.aiProcessor.processTextWithAI(text, mode);
    });

    ipcMain.handle("check-ai-status", async (event, testConfig = null) => {
      return await this.aiProcessor.checkAIStatus(testConfig);
    });

    // 音频转录相关
    ipcMain.handle("transcribe-audio", async (event, audioData, options) => {
      // 錄音的持久化由 sherpaManager.transcribeAudio 負責（persistAudioFile，
      // 回傳 audio_path）。這裡不再另存一份 — 之前重複存檔導致每段錄音
      // 落地兩份 WAV，且此處覆蓋 audio_path 讓另一份變成孤兒檔。
      return await this.sherpaManager.transcribeAudio(audioData, options);
    });

    // 串流辨識 API (Zipformer Transducer)
    ipcMain.handle("streaming-start", async (event, options = {}) => {
      try {
        return await this.sherpaManager.streamingStart(options);
      } catch (error) {
        this.logger.error("串流辨識啟動失敗:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("streaming-feed", async (event, audioChunk, isFinal = false) => {
      try {
        return await this.sherpaManager.streamingFeed(audioChunk, isFinal);
      } catch (error) {
        this.logger.error("串流辨識送入音訊失敗:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("streaming-end", async () => {
      try {
        return await this.sherpaManager.streamingEnd();
      } catch (error) {
        this.logger.error("串流辨識結束失敗:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("preload-streaming-model", async () => {
      try {
        return await this.sherpaManager.preloadStreamingModel();
      } catch (error) {
        this.logger.error("預載串流模型失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 数据库相关
    ipcMain.handle("save-transcription", (event, data) => {
      return this.databaseManager.saveTranscription(data);
    });

    ipcMain.handle("get-transcriptions", (event, limit, offset) => {
      return this.databaseManager.getTranscriptions(limit, offset);
    });

    ipcMain.handle("get-transcription", (event, id) => {
      return this.databaseManager.getTranscriptionById(id);
    });

    ipcMain.handle("delete-transcription", (event, id) => {
      return this.databaseManager.deleteTranscription(id);
    });

    // 重新辨識：用保存的原始錄音重跑，更新該筆文字
    ipcMain.handle("retranscribe-transcription", async (event, id, options = {}) => {
      try {
        const record = this.databaseManager.getTranscriptionById(id);
        if (!record) return { success: false, error: "找不到該筆紀錄" };
        if (!record.audio_path) {
          return { success: false, error: "這筆沒有保存錄音檔（舊資料無法重辨）" };
        }
        const fs = require("fs");
        if (!fs.existsSync(record.audio_path)) {
          return { success: false, error: "錄音檔已不存在" };
        }
        const result = await this.sherpaManager.transcribeFilePath(record.audio_path, options);
        if (!result || !result.success) {
          return { success: false, error: result?.error || "辨識失敗" };
        }
        this.databaseManager.updateTranscriptionText(id, result.text, null);
        return { success: true, text: result.text };
      } catch (e) {
        return { success: false, error: e.message };
      }
    });

    ipcMain.handle("search-transcriptions", (event, query, limit) => {
      return this.databaseManager.searchTranscriptions(query, limit);
    });

    ipcMain.handle("get-transcription-stats", () => {
      return this.databaseManager.getTranscriptionStats();
    });

    ipcMain.handle("get-daily-stats", (event, days) => {
      return this.databaseManager.getDailyStats(days || 14);
    });

    ipcMain.handle("clear-all-transcriptions", () => {
      return this.databaseManager.clearAllTranscriptions();
    });

    // ===== 字典功能 =====
    ipcMain.handle("get-dictionary-entries", (event, limit, offset) => {
      return this.databaseManager.getDictionaryEntries(limit, offset);
    });

    ipcMain.handle("add-dictionary-entry", (event, original, replacement, category) => {
      return this.databaseManager.addDictionaryEntry(original, replacement, category);
    });

    ipcMain.handle("update-dictionary-entry", (event, id, data) => {
      return this.databaseManager.updateDictionaryEntry(id, data);
    });

    ipcMain.handle("delete-dictionary-entry", (event, id) => {
      return this.databaseManager.deleteDictionaryEntry(id);
    });

    ipcMain.handle("search-dictionary", (event, query) => {
      return this.databaseManager.searchDictionary(query);
    });

    ipcMain.handle("get-dictionary-categories", () => {
      return this.databaseManager.getDictionaryCategories();
    });

    ipcMain.handle("apply-dictionary", (event, text) => {
      return this.databaseManager.applyDictionary(text);
    });

    ipcMain.handle("toggle-dictionary-entry", (event, id) => {
      const entry = this.databaseManager.db.prepare("SELECT enabled FROM dictionary WHERE id = ?").get(id);
      if (entry) {
        return this.databaseManager.updateDictionaryEntry(id, { enabled: !entry.enabled });
      }
      return null;
    });

    // 字典匯出
    ipcMain.handle("export-dictionary", async () => {
      try {
        const { dialog } = require("electron");
        const fs = require("fs");

        const entries = this.databaseManager.exportDictionary();

        const { filePath, canceled } = await dialog.showSaveDialog({
          title: "匯出字典",
          defaultPath: `dictionary_${new Date().toISOString().slice(0, 10)}.json`,
          filters: [
            { name: "JSON 檔案", extensions: ["json"] },
            { name: "CSV 檔案", extensions: ["csv"] }
          ]
        });

        if (canceled || !filePath) {
          return { success: false, canceled: true };
        }

        if (filePath.endsWith(".csv")) {
          // CSV 格式
          const csvHeader = "原始詞彙,替換為,分類,啟用\n";
          const csvRows = entries.map(e =>
            `"${e.original}","${e.replacement}","${e.category || ''}",${e.enabled ? '是' : '否'}`
          ).join("\n");
          fs.writeFileSync(filePath, csvHeader + csvRows, "utf-8");
        } else {
          // JSON 格式
          fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), "utf-8");
        }

        return { success: true, count: entries.length, path: filePath };
      } catch (error) {
        this.logger.error("匯出字典失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 字典匯入
    ipcMain.handle("import-dictionary", async (event, mode) => {
      try {
        const { dialog } = require("electron");
        const fs = require("fs");

        const { filePaths, canceled } = await dialog.showOpenDialog({
          title: "匯入字典",
          filters: [
            { name: "JSON 檔案", extensions: ["json"] },
            { name: "CSV 檔案", extensions: ["csv"] },
            { name: "所有檔案", extensions: ["*"] }
          ],
          properties: ["openFile"]
        });

        if (canceled || filePaths.length === 0) {
          return { success: false, canceled: true };
        }

        const filePath = filePaths[0];
        const content = fs.readFileSync(filePath, "utf-8");
        let entries = [];

        if (filePath.endsWith(".csv")) {
          // 解析 CSV
          const lines = content.split("\n").filter(l => l.trim());
          // 跳過標題行
          for (let i = 1; i < lines.length; i++) {
            const match = lines[i].match(/"([^"]*)",?"([^"]*)",?"([^"]*)",?(是|否|1|0|true|false)?/i);
            if (match) {
              entries.push({
                original: match[1],
                replacement: match[2],
                category: match[3] || '',
                enabled: !match[4] || ['是', '1', 'true'].includes(match[4].toLowerCase())
              });
            }
          }
        } else {
          // 解析 JSON
          entries = JSON.parse(content);
          if (!Array.isArray(entries)) {
            entries = [entries];
          }
        }

        const result = this.databaseManager.importDictionary(entries, mode || 'merge');
        return { success: true, ...result, path: filePath };
      } catch (error) {
        this.logger.error("匯入字典失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 清空字典
    ipcMain.handle("clear-dictionary", () => {
      return this.databaseManager.clearDictionary();
    });

    // ===== 熱詞功能 =====
    ipcMain.handle("get-hotwords", async () => {
      try {
        return await this.sherpaManager.getHotwords();
      } catch (error) {
        this.logger.error("取得熱詞設定失敗:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("set-hotwords", async (event, config) => {
      try {
        // config: { enabled: boolean, score: number, words: string[] }
        return await this.sherpaManager.setHotwords(config);
      } catch (error) {
        this.logger.error("設定熱詞失敗:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("add-hotword", async (event, word) => {
      try {
        return await this.sherpaManager.addHotword(word);
      } catch (error) {
        this.logger.error("新增熱詞失敗:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("remove-hotword", async (event, word) => {
      try {
        return await this.sherpaManager.removeHotword(word);
      } catch (error) {
        this.logger.error("刪除熱詞失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 音訊檔案操作。
    // 安全：路徑來自渲染層（可能被 XSS 污染），必須限制在 userData/audio 內，
    // 否則 get-audio-file 等於「任意檔案讀取」、save-audio-file 等於「任意檔案複製」。
    const resolveAudioPath = (p) => {
      if (!p || typeof p !== "string") return null;
      const audioRoot = path.join(
        require("electron").app.getPath("userData"),
        "audio"
      );
      const resolved = path.resolve(p);
      return resolved.startsWith(audioRoot + path.sep) ? resolved : null;
    };

    ipcMain.handle("get-audio-file", async (event, audioPath) => {
      try {
        const safePath = resolveAudioPath(audioPath);
        if (!safePath || !fs.existsSync(safePath)) {
          return { success: false, error: '音訊檔案不存在' };
        }
        const buffer = fs.readFileSync(safePath);
        return { success: true, data: buffer.toString('base64'), mimeType: 'audio/wav' };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle("save-audio-file", async (event, audioPath, savePath) => {
      try {
        // 來源限制在 audio 目錄；目的地由系統存檔對話框產生（使用者明確選擇）
        const safeSource = resolveAudioPath(audioPath);
        if (!safeSource || !fs.existsSync(safeSource)) {
          return { success: false, error: '來源音訊檔案不存在' };
        }
        if (!savePath || typeof savePath !== "string") {
          return { success: false, error: '無效的儲存路徑' };
        }
        fs.copyFileSync(safeSource, savePath);
        return { success: true, path: savePath };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });

    ipcMain.handle("show-save-dialog", async (event, options) => {
      const { dialog } = require('electron');
      const result = await dialog.showSaveDialog(options);
      return result;
    });

    // 设置相关
    ipcMain.handle("get-setting", (event, key, defaultValue) => {
      return this.databaseManager.getSetting(key, defaultValue);
    });

    ipcMain.handle("set-setting", (event, key, value) => {
      const result = this.databaseManager.setSetting(key, value);

      // 廣播設定變更到所有視窗（用於跨視窗同步）
      const { BrowserWindow } = require('electron');
      BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
          win.webContents.send('setting-changed', { key, value });
        }
      });

      return result;
    });

    ipcMain.handle("get-all-settings", () => {
      return this.databaseManager.getAllSettings();
    });

    ipcMain.handle("get-settings", () => {
      return this.databaseManager.getAllSettings();
    });

    ipcMain.handle("save-setting", (event, key, value) => {
      return this.databaseManager.setSetting(key, value);
    });

    ipcMain.handle("reset-settings", () => {
      // TODO: 实现重置设置功能
      return this.databaseManager.resetSettings();
    });

    // 剪贴板相关
    ipcMain.handle("copy-text", async (event, text) => {
      try {
        return await this.clipboardManager.copyText(text);
      } catch (error) {
        this.logger.error("复制文本失败:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("paste-text", async (event, text) => {
      return this.clipboardManager.pasteText(text);
    });

    // 發送 Enter 鍵（完全信任模式）
    ipcMain.handle("send-enter", async () => {
      return this.clipboardManager.sendEnter();
    });

    ipcMain.handle("insert-text-directly", async (event, text) => {
      try {
        return await this.clipboardManager.insertTextDirectly(text);
      } catch (error) {
        this.logger.error("直接插入文本失败:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("enable-macos-accessibility", async () => {
      try {
        if (process.platform === "darwin") {
          const result = await this.clipboardManager.enableMacOSAccessibility();
          return { success: result };
        }
        return { success: true, message: "非 macOS 平台，无需设置" };
      } catch (error) {
        this.logger.error("启用 macOS accessibility 失败:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("read-clipboard", async () => {
      try {
        const text = await this.clipboardManager.readClipboard();
        return { success: true, text };
      } catch (error) {
        this.logger.error("读取剪贴板失败:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("write-clipboard", async (event, text) => {
      try {
        return await this.clipboardManager.writeClipboard(text);
      } catch (error) {
        this.logger.error("写入剪贴板失败:", error);
        return { success: false, error: error.message };
      }
    });

    // 焦點管理 - 儲存和恢復前景視窗
    ipcMain.handle("save-foreground-window", () => {
      try {
        return this.clipboardManager.saveForegroundWindow();
      } catch (error) {
        this.logger.error("儲存前景視窗失敗:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("restore-foreground-window", async () => {
      try {
        return await this.clipboardManager.restoreForegroundWindow();
      } catch (error) {
        this.logger.error("恢復前景視窗失敗:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-clipboard-history", () => {
      // TODO: 实现剪贴板历史功能
      return [];
    });

    ipcMain.handle("clear-clipboard-history", () => {
      // TODO: 实现清除剪贴板历史功能
      return true;
    });

    // 窗口管理相关
    ipcMain.handle("hide-window", () => {
      if (this.windowManager.mainWindow) {
        this.windowManager.mainWindow.hide();
      }
      return true;
    });

    ipcMain.handle("show-window", () => {
      if (this.windowManager.mainWindow) {
        this.windowManager.mainWindow.show();
      }
      return true;
    });

    ipcMain.handle("minimize-window", () => {
      if (this.windowManager.mainWindow) {
        this.windowManager.mainWindow.minimize();
      }
      return true;
    });

    ipcMain.handle("close-window", () => {
      if (this.windowManager.mainWindow) {
        this.windowManager.mainWindow.close();
      }
      return true;
    });

    ipcMain.handle("show-control-panel", () => {
      this.windowManager.showControlPanel();
      return true;
    });

    ipcMain.handle("hide-control-panel", () => {
      this.windowManager.hideControlPanel();
      return true;
    });

    ipcMain.handle("open-control-panel", () => {
      this.windowManager.showControlPanel();
      return true;
    });

    ipcMain.handle("close-control-panel", () => {
      this.windowManager.hideControlPanel();
      return true;
    });

    ipcMain.handle("open-history-window", () => {
      this.windowManager.showHistoryWindow();
      return true;
    });

    ipcMain.handle("close-history-window", () => {
      this.windowManager.closeHistoryWindow();
      return true;
    });

    ipcMain.handle("hide-history-window", () => {
      this.windowManager.hideHistoryWindow();
      return true;
    });

    ipcMain.handle("open-settings-window", () => {
      this.windowManager.showSettingsWindow();
      return true;
    });

    ipcMain.handle("close-settings-window", () => {
      this.windowManager.closeSettingsWindow();
      return true;
    });

    ipcMain.handle("hide-settings-window", () => {
      this.windowManager.hideSettingsWindow();
      return true;
    });

    ipcMain.handle("close-app", () => {
      require("electron").app.quit();
    });

    // =====================================================
    // 視窗控制設定 API
    // =====================================================

    // 設置主視窗置頂狀態
    ipcMain.handle("set-always-on-top", async (event, value) => {
      try {
        this.windowManager.setMainWindowAlwaysOnTop(value);
        // 同時保存到設定
        await this.databaseManager.setSetting('window_always_on_top', value);
        return { success: true };
      } catch (error) {
        this.logger.error("設置置頂狀態失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 獲取主視窗置頂狀態
    ipcMain.handle("get-always-on-top", () => {
      try {
        if (this.windowManager.mainWindow && !this.windowManager.mainWindow.isDestroyed()) {
          return { success: true, value: this.windowManager.mainWindow.isAlwaysOnTop() };
        }
        return { success: false, error: "主視窗不存在" };
      } catch (error) {
        this.logger.error("獲取置頂狀態失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 热键管理 - 添加发送者跟踪机制
    this.hotkeyRegisteredSenders = new Set(); // 跟踪已注册热键的发送者
    
    ipcMain.handle("register-hotkey", (event, hotkey) => {
      try {
        if (this.hotkeyManager) {
          const senderId = event.sender.id;

          // 检查是否已经为这个发送者注册过热键
          if (this.hotkeyRegisteredSenders.has(senderId)) {
            this.logger.info(`发送者 ${senderId} 已注册过热键，跳过重复注册`);
            return { success: true };
          }

          const success = this.hotkeyManager.registerHotkey(hotkey, () => {
            // 熱鍵觸發時同步儲存當前前景視窗（在主進程）
            // 使用 execSync 確保在發送事件前完成
            this.logger.info(`热键 ${hotkey} 被触发，同步儲存前景視窗`);
            try {
              const result = this.clipboardManager.saveForegroundWindow();
              this.logger.info('儲存前景視窗結果:', result);
            } catch (err) {
              this.logger.warn('儲存前景視窗失敗:', err.message);
            }

            // 發送热键触发事件到主窗口（在儲存視窗 handle 後）
            if (this.windowManager && this.windowManager.mainWindow && !this.windowManager.mainWindow.isDestroyed()) {
              this.windowManager.mainWindow.webContents.send("hotkey-triggered", { hotkey });
            }
          });
          
          if (success) {
            // 添加发送者到跟踪列表
            this.hotkeyRegisteredSenders.add(senderId);
            
            // 监听窗口关闭事件，清理注册记录
            event.sender.on('destroyed', () => {
              this.hotkeyRegisteredSenders.delete(senderId);
              this.logger.info(`清理发送者 ${senderId} 的热键注册记录`);
            });
            
            this.logger.info(`热键 ${hotkey} 注册成功，发送者: ${senderId}`);
          } else {
            this.logger.error(`热键 ${hotkey} 注册失败`);
          }
          
          return { success };
        }
        return { success: false, error: "热键管理器未初始化" };
      } catch (error) {
        this.logger.error("注册热键失败:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("unregister-hotkey", (event, hotkey) => {
      try {
        if (this.hotkeyManager) {
          const success = this.hotkeyManager.unregisterHotkey(hotkey);
          return { success };
        }
        return { success: false, error: "热键管理器未初始化" };
      } catch (error) {
        this.logger.error("注销热键失败:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-current-hotkey", () => {
      try {
        if (this.hotkeyManager) {
          const hotkeys = this.hotkeyManager.getRegisteredHotkeys();
          // 返回第一个非F2的热键，或默认热键
          const mainHotkey = hotkeys.find(key => key !== 'F2') || "CommandOrControl+Shift+Space";
          return mainHotkey;
        }
        return "CommandOrControl+Shift+Space";
      } catch (error) {
        this.logger.error("获取当前热键失败:", error);
        return "CommandOrControl+Shift+Space";
      }
    });

    // F2热键管理
    ipcMain.handle("register-f2-hotkey", (event) => {
      try {
        const senderId = event.sender.id;
        
        // 检查是否已经为这个发送者注册过F2热键
        if (this.f2RegisteredSenders.has(senderId)) {
          this.logger.info(`F2热键已为发送者 ${senderId} 注册过，跳过重复注册`);
          return { success: true };
        }
        
        if (this.hotkeyManager) {
          // 只有在没有任何发送者注册时才注册热键
          const isFirstRegistration = this.f2RegisteredSenders.size === 0;
          
          if (isFirstRegistration) {
            const success = this.hotkeyManager.registerF2DoubleClick((data) => {
              // 发送F2双击事件到所有注册的渲染进程
              this.logger.info("发送F2双击事件到渲染进程:", data);
              this.f2RegisteredSenders.forEach(id => {
                const window = require("electron").BrowserWindow.getAllWindows().find(w => w.webContents.id === id);
                if (window && !window.isDestroyed()) {
                  window.webContents.send("f2-double-click", data);
                }
              });
            });
            
            if (!success) {
              return { success: false, error: "F2热键注册失败" };
            }
          }
          
          // 添加发送者到跟踪列表
          this.f2RegisteredSenders.add(senderId);
          
          // 监听窗口关闭事件，清理注册记录
          event.sender.on('destroyed', () => {
            this.f2RegisteredSenders.delete(senderId);
            this.logger.info(`清理发送者 ${senderId} 的F2热键注册记录`);

            // 如果没有发送者了，注销热键
            if (this.f2RegisteredSenders.size === 0) {
              this.hotkeyManager.unregisterHotkey('F2');
              this.logger.info('所有发送者都已注销，注销F2热键');
            }
          });
          
          return { success: true };
        }
        return { success: false, error: "热键管理器未初始化" };
      } catch (error) {
        this.logger.error("注册F2热键失败:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("unregister-f2-hotkey", (event) => {
      try {
        const senderId = event.sender.id;
        
        if (this.hotkeyManager && this.f2RegisteredSenders.has(senderId)) {
          this.f2RegisteredSenders.delete(senderId);
          
          // 如果没有其他发送者注册F2热键，则注销热键
          if (this.f2RegisteredSenders.size === 0) {
            const success = this.hotkeyManager.unregisterHotkey('F2');
            this.logger.info('所有发送者都已注销，注销F2热键');
            return { success };
          } else {
            this.logger.info(`发送者 ${senderId} 已注销，但还有其他发送者注册了F2热键`);
            return { success: true };
          }
        }
        return { success: false, error: "热键管理器未初始化或未注册" };
      } catch (error) {
        this.logger.error("注销F2热键失败:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("set-recording-state", (event, isRecording) => {
      try {
        if (this.hotkeyManager) {
          this.hotkeyManager.setRecordingState(isRecording);
          return { success: true };
        }
        return { success: false, error: "热键管理器未初始化" };
      } catch (error) {
        this.logger.error("设置录音状态失败:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-recording-state", () => {
      try {
        if (this.hotkeyManager) {
          const isRecording = this.hotkeyManager.getRecordingState();
          return { success: true, isRecording };
        }
        return { success: false, error: "热键管理器未初始化" };
      } catch (error) {
        this.logger.error("获取录音状态失败:", error);
        return { success: false, error: error.message };
      }
    });

    // =====================================================
    // TypeLess 模式（按住錄音）API
    // =====================================================

    // 啟用 TypeLess 模式
    ipcMain.handle("enable-typeless-mode", async (event, hotkey) => {
      try {
        if (!this.typelessManager) {
          return { success: false, error: "TypeLess 管理器未初始化" };
        }

        // TypeLess 固定使用「右 Alt 單擊切換」。
        // （uiohook 可區分左右 Alt，但 Electron accelerator 無法表達單獨的右 Alt，
        //   因此忽略設定中的快捷鍵字串，直接設定右 Alt 切換模式）
        this.typelessManager.setRightAltToggle();

        // 設置回調函數
        this.typelessManager.setCallbacks({
          onStartRecording: () => {
            this.logger.info('TypeLess: 觸發開始錄音');
            // 先儲存當前前景視窗
            try {
              const result = this.clipboardManager.saveForegroundWindow();
              this.logger.info('TypeLess: 儲存前景視窗結果:', result);
            } catch (err) {
              this.logger.warn('TypeLess: 儲存前景視窗失敗:', err.message);
            }
            // 顯示錄音指示器視窗
            if (this.windowManager) {
              this.windowManager.showTypelessIndicator();
            }
            // 發送開始錄音事件到渲染進程
            if (this.windowManager?.mainWindow && !this.windowManager.mainWindow.isDestroyed()) {
              this.windowManager.mainWindow.webContents.send("typeless-start-recording");
            }
          },
          onStopRecording: () => {
            this.logger.info('TypeLess: 觸發停止錄音');
            // 隱藏錄音指示器視窗
            if (this.windowManager) {
              this.windowManager.hideTypelessIndicator();
            }
            // 發送停止錄音事件到渲染進程
            if (this.windowManager?.mainWindow && !this.windowManager.mainWindow.isDestroyed()) {
              this.windowManager.mainWindow.webContents.send("typeless-stop-recording");
            }
          },
          onCancelRecording: () => {
            this.logger.info('TypeLess: 觸發取消錄音 (Esc)');
            // 隱藏錄音指示器視窗
            if (this.windowManager) {
              this.windowManager.hideTypelessIndicator();
            }
            // 發送取消錄音事件到渲染進程（丟棄音訊、不轉錄、不貼上）
            if (this.windowManager?.mainWindow && !this.windowManager.mainWindow.isDestroyed()) {
              this.windowManager.mainWindow.webContents.send("typeless-cancel-recording");
            }
          }
        });

        // 啟用 TypeLess 模式
        this.typelessManager.enable();

        return { success: true };
      } catch (error) {
        this.logger.error("啟用 TypeLess 模式失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 停用 TypeLess 模式
    ipcMain.handle("disable-typeless-mode", async () => {
      try {
        if (!this.typelessManager) {
          return { success: false, error: "TypeLess 管理器未初始化" };
        }

        this.typelessManager.disable();
        return { success: true };
      } catch (error) {
        this.logger.error("停用 TypeLess 模式失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 獲取 TypeLess 模式狀態
    ipcMain.handle("get-typeless-status", () => {
      try {
        if (!this.typelessManager) {
          return { success: false, error: "TypeLess 管理器未初始化" };
        }

        return {
          success: true,
          enabled: this.typelessManager.isEnabled,
          isKeyDown: this.typelessManager.isKeyDown
        };
      } catch (error) {
        this.logger.error("獲取 TypeLess 狀態失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 同步真實錄音狀態給 TypeLess（避免快捷鍵切換與滑鼠點擊狀態打架）
    ipcMain.handle("sync-typeless-state", (event, isRecording) => {
      try {
        if (this.typelessManager) {
          this.typelessManager.syncActiveState(isRecording);
        }
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // 更新 TypeLess 快捷鍵
    ipcMain.handle("set-typeless-hotkey", async (event, hotkey) => {
      try {
        if (!this.typelessManager) {
          return { success: false, error: "TypeLess 管理器未初始化" };
        }

        this.typelessManager.setHotkey(hotkey);
        return { success: true };
      } catch (error) {
        this.logger.error("設置 TypeLess 快捷鍵失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // =====================================================
    // 自定義快捷鍵設定 API
    // =====================================================

    // 獲取所有快捷鍵設定
    ipcMain.handle("get-hotkey-settings", async () => {
      try {
        if (!this.hotkeyManager) {
          return { success: false, error: "快捷鍵管理器未初始化" };
        }

        // 從資料庫讀取已保存的快捷鍵設定
        const savedHotkeys = await this.databaseManager.getSetting('custom_hotkeys', null);
        const defaultHotkeys = this.hotkeyManager.getDefaultHotkeys();
        const currentBindings = this.hotkeyManager.getHotkeyBindings();

        // 合併：預設值為基礎，已保存的設定覆蓋（確保新增的快捷鍵也會顯示）
        const mergedHotkeys = { ...defaultHotkeys, ...(savedHotkeys || {}), ...currentBindings };

        return {
          success: true,
          hotkeys: mergedHotkeys,
          defaults: defaultHotkeys,
        };
      } catch (error) {
        this.logger.error("獲取快捷鍵設定失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 獲取預設快捷鍵
    ipcMain.handle("get-hotkey-defaults", () => {
      try {
        if (!this.hotkeyManager) {
          return { success: false, error: "快捷鍵管理器未初始化" };
        }
        return {
          success: true,
          defaults: this.hotkeyManager.getDefaultHotkeys(),
        };
      } catch (error) {
        this.logger.error("獲取預設快捷鍵失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 驗證快捷鍵
    ipcMain.handle("validate-hotkey", (event, accelerator, excludeActionId = null) => {
      try {
        if (!this.hotkeyManager) {
          return { valid: false, error: "快捷鍵管理器未初始化" };
        }
        return this.hotkeyManager.validateHotkey(accelerator, excludeActionId);
      } catch (error) {
        this.logger.error("驗證快捷鍵失敗:", error);
        return { valid: false, error: error.message };
      }
    });

    // 設置單個快捷鍵
    ipcMain.handle("set-action-hotkey", async (event, actionId, accelerator) => {
      try {
        if (!this.hotkeyManager) {
          return { success: false, error: "快捷鍵管理器未初始化" };
        }

        // 註冊新快捷鍵
        const result = this.hotkeyManager.registerActionHotkey(actionId, accelerator);

        if (result.success) {
          // 保存到資料庫
          const currentHotkeys = await this.databaseManager.getSetting('custom_hotkeys', {});
          currentHotkeys[actionId] = accelerator;
          await this.databaseManager.setSetting('custom_hotkeys', currentHotkeys);
          this.logger.info(`快捷鍵已更新: ${actionId} -> ${accelerator}`);

          // 廣播快捷鍵變更到所有視窗
          const { BrowserWindow } = require('electron');
          BrowserWindow.getAllWindows().forEach(win => {
            win.webContents.send('hotkey-changed', { actionId, accelerator });
          });
        }

        return result;
      } catch (error) {
        this.logger.error("設置快捷鍵失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 重設快捷鍵
    ipcMain.handle("reset-hotkeys", async (event, actionId = null) => {
      try {
        if (!this.hotkeyManager) {
          return { success: false, error: "快捷鍵管理器未初始化" };
        }

        const result = this.hotkeyManager.resetToDefault(actionId);

        if (result.success) {
          if (actionId) {
            // 更新資料庫中的單個快捷鍵
            const currentHotkeys = await this.databaseManager.getSetting('custom_hotkeys', {});
            const defaults = this.hotkeyManager.getDefaultHotkeys();
            currentHotkeys[actionId] = defaults[actionId];
            await this.databaseManager.setSetting('custom_hotkeys', currentHotkeys);
          } else {
            // 重設所有：清除自定義設定
            await this.databaseManager.setSetting('custom_hotkeys', null);
          }
          this.logger.info(`快捷鍵已重設: ${actionId || '全部'}`);
        }

        return {
          success: result.success,
          hotkeys: this.hotkeyManager.getDefaultHotkeys(),
        };
      } catch (error) {
        this.logger.error("重設快捷鍵失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // 初始化快捷鍵（從資料庫載入並註冊）
    ipcMain.handle("init-custom-hotkeys", async () => {
      try {
        if (!this.hotkeyManager) {
          return { success: false, error: "快捷鍵管理器未初始化" };
        }

        // 設置操作回調函數
        const self = this;

        // 開始/停止錄音
        this.hotkeyManager.setActionCallback('toggle-recording', (info) => {
          self.logger.info(`快捷鍵觸發: toggle-recording (${info.accelerator})`);
          // 儲存前景視窗
          try {
            self.clipboardManager.saveForegroundWindow();
          } catch (err) {
            self.logger.warn('儲存前景視窗失敗:', err.message);
          }
          // 發送事件到主視窗
          if (self.windowManager?.mainWindow && !self.windowManager.mainWindow.isDestroyed()) {
            self.windowManager.mainWindow.webContents.send("hotkey-action", { actionId: 'toggle-recording' });
            // 也發送舊的事件以保持兼容性
            self.windowManager.mainWindow.webContents.send("hotkey-triggered", { hotkey: info.accelerator });
          }
        });

        // 取消錄音
        this.hotkeyManager.setActionCallback('cancel-recording', (info) => {
          self.logger.info(`快捷鍵觸發: cancel-recording (${info.accelerator})`);
          if (self.windowManager?.mainWindow && !self.windowManager.mainWindow.isDestroyed()) {
            self.windowManager.mainWindow.webContents.send("hotkey-action", { actionId: 'cancel-recording' });
          }
        });

        // 顯示主視窗
        this.hotkeyManager.setActionCallback('show-window', (info) => {
          self.logger.info(`快捷鍵觸發: show-window (${info.accelerator})`);
          if (self.windowManager?.mainWindow) {
            if (self.windowManager.mainWindow.isMinimized()) {
              self.windowManager.mainWindow.restore();
            }
            self.windowManager.mainWindow.show();
            self.windowManager.mainWindow.focus();
          }
        });

        // 複製上次結果
        this.hotkeyManager.setActionCallback('copy-last', (info) => {
          self.logger.info(`快捷鍵觸發: copy-last (${info.accelerator})`);
          if (self.windowManager?.mainWindow && !self.windowManager.mainWindow.isDestroyed()) {
            self.windowManager.mainWindow.webContents.send("hotkey-action", { actionId: 'copy-last' });
          }
        });

        // 從資料庫讀取設定，並與預設值合併（確保新增的快捷鍵也會被註冊）
        const savedHotkeys = await this.databaseManager.getSetting('custom_hotkeys', null);
        const defaults = this.hotkeyManager.getDefaultHotkeys();
        // 合併：預設值為基礎，已保存的設定覆蓋
        const hotkeyConfig = { ...defaults, ...(savedHotkeys || {}) };

        // 註冊所有快捷鍵
        // 略過已停用的錄音熱鍵：toggle-recording（已統一為 TypeLess 右 Alt）
        // 與 typeless-recording（由 TypelessManager 以 uiohook 處理，非 globalShortcut）
        const SKIP_ACTIONS = new Set(['toggle-recording', 'typeless-recording', 'cancel-recording']);
        const results = {};
        for (const [actionId, accelerator] of Object.entries(hotkeyConfig)) {
          if (SKIP_ACTIONS.has(actionId)) continue;
          results[actionId] = this.hotkeyManager.registerActionHotkey(actionId, accelerator);
        }

        return {
          success: true,
          hotkeys: hotkeyConfig,
          results,
        };
      } catch (error) {
        this.logger.error("初始化快捷鍵失敗:", error);
        return { success: false, error: error.message };
      }
    });

    // =====================================================
    // 文件操作
    ipcMain.handle("export-transcriptions", (event, format) => {
      // TODO: 实现导出转录功能
      return { success: true, path: "" };
    });

    ipcMain.handle("import-settings", () => {
      // TODO: 实现导入设置功能
      return { success: true };
    });

    ipcMain.handle("export-settings", () => {
      // TODO: 实现导出设置功能
      return { success: true, path: "" };
    });

    // 文件系统相关。
    // 安全：show-item-in-folder 限制在 userData 內；open-external 只允許 https。
    ipcMain.handle("show-item-in-folder", (event, fullPath) => {
      if (!fullPath || typeof fullPath !== "string") return;
      const userDataRoot = require("electron").app.getPath("userData");
      const resolved = path.resolve(fullPath);
      if (!resolved.startsWith(userDataRoot + path.sep)) return;
      require("electron").shell.showItemInFolder(resolved);
    });

    ipcMain.handle("open-external", (event, url) => {
      try {
        if (new URL(url).protocol !== "https:") return;
      } catch (e) {
        return;
      }
      require("electron").shell.openExternal(url);
    });

    // 系统信息
    ipcMain.handle("get-system-info", () => {
      return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron
      };
    });

    ipcMain.handle("check-permissions", async () => {
      try {
        // 检查辅助功能权限
        const hasAccessibility = await this.clipboardManager.checkAccessibilityPermissions();
        
        return {
          microphone: true, // 麦克风权限由前端检查
          accessibility: hasAccessibility
        };
      } catch (error) {
        this.logger.error("检查权限失败:", error);
        return {
          microphone: false,
          accessibility: false,
          error: error.message
        };
      }
    });

    ipcMain.handle("request-permissions", async () => {
      try {
        // 对于辅助功能权限，我们只能引导用户手动授予
        // 这里可以打开系统设置页面
        if (process.platform === "darwin") {
          this.clipboardManager.openSystemSettings();
        }
        return { success: true };
      } catch (error) {
        this.logger.error("请求权限失败:", error);
        return { success: false, error: error.message };
      }
    });

    // 测试辅助功能权限
    ipcMain.handle("test-accessibility-permission", async () => {
      try {
        // 使用测试文本检查权限
        await this.clipboardManager.pasteText("聲聲慢權限測試");
        return { success: true, message: "辅助功能权限测试成功" };
      } catch (error) {
        this.logger.error("辅助功能权限测试失败:", error);
        return { success: false, error: error.message };
      }
    });

    // 打开系统权限设置
    ipcMain.handle("open-system-permissions", () => {
      try {
        if (process.platform === "darwin") {
          this.clipboardManager.openSystemSettings();
          return { success: true };
        } else {
          return { success: false, error: "当前平台不支持自动打开权限设置" };
        }
      } catch (error) {
        this.logger.error("打开系统权限设置失败:", error);
        return { success: false, error: error.message };
      }
    });

    // 应用信息
    ipcMain.handle("get-app-version", () => {
      return require("electron").app.getVersion();
    });

    ipcMain.handle("get-app-path", (event, name) => {
      return require("electron").app.getPath(name);
    });

    ipcMain.handle("check-for-updates", () => {
      // TODO: 实现更新检查功能
      return { hasUpdate: false };
    });

    // 调试和日志
    ipcMain.handle("log", (event, level, message, data) => {
      this.logger[level](`[渲染进程] ${message}`, data || "");
      return true;
    });

    ipcMain.handle("get-debug-info", () => {
      return {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        appVersion: require("electron").app.getVersion()
      };
    });

    // 保持向后兼容性
    ipcMain.handle("log-message", (event, level, message, data) => {
      this.logger[level](`[渲染进程] ${message}`, data || "");
      return true;
    });

    // 中文特定功能
    ipcMain.handle("detect-language", (event, text) => {
      // TODO: 实现语言检测功能
      return { language: "zh-CN", confidence: 0.95 };
    });

    ipcMain.handle("segment-chinese", (event, text) => {
      // TODO: 实现中文分词功能
      return { segments: text.split("") };
    });

    ipcMain.handle("add-punctuation", (event, text) => {
      // TODO: 实现标点符号添加功能
      return { text: text };
    });

    // 音频处理
    ipcMain.handle("convert-audio-format", (event, audioData, targetFormat) => {
      // TODO: 实现音频格式转换功能
      return { success: true, data: audioData };
    });

    ipcMain.handle("enhance-audio", (event, audioData) => {
      // TODO: 实现音频增强功能
      return { success: true, data: audioData };
    });

    // 模型管理 - 更新为实际功能
    ipcMain.handle("download-model", async (event, modelName) => {
      // 使用统一的模型下载功能
      return await this.sherpaManager.downloadModels((progress) => {
        event.sender.send("model-download-progress", progress);
      });
    });

    ipcMain.handle("get-available-models", () => {
      // 返回 Sherpa 支持的模型列表
      return {
        models: [
          {
            name: "sherpa-onnx-paraformer-zh",
            displayName: "Sherpa Paraformer (中文)",
            type: "asr",
            size: "約 220MB",
            description: "Sherpa-ONNX 中文語音識別模型"
          }
        ]
      };
    });

    ipcMain.handle("get-current-model", async () => {
      const status = await this.sherpaManager.checkStatus();
      return {
        model: "sherpa-onnx-paraformer-zh",
        status: status.models_downloaded ? "ready" : "not_downloaded",
        details: status
      };
    });

    ipcMain.handle("switch-model", (event, modelName) => {
      // Sherpa 目前使用固定模型，暂不支持切换
      return {
        success: false,
        error: "Sherpa 目前使用固定模型，暂不支持切换"
      };
    });

    // 性能监控
    ipcMain.handle("get-performance-stats", () => {
      // TODO: 实现性能统计功能
      return { stats: {} };
    });

    ipcMain.handle("clear-performance-stats", () => {
      // TODO: 实现清除性能统计功能
      return { success: true };
    });

    // 错误报告
    ipcMain.handle("report-error", (event, error) => {
      this.logger.error("渲染进程错误:", error);
      // TODO: 实现错误报告功能
      return true;
    });

    // 开发工具
    if (process.env.NODE_ENV === "development") {
      ipcMain.handle("open-dev-tools", (event) => {
        const window = require("electron").BrowserWindow.fromWebContents(event.sender);
        if (window) {
          window.webContents.openDevTools();
        }
      });

      ipcMain.handle("reload-window", (event) => {
        const window = require("electron").BrowserWindow.fromWebContents(event.sender);
        if (window) {
          window.reload();
        }
      });
    }

    // 日志和调试相关
    ipcMain.handle("get-app-logs", (event, lines = 100) => {
      try {
        if (this.logger && this.logger.getRecentLogs) {
          return {
            success: true,
            logs: this.logger.getRecentLogs(lines)
          };
        }
        return {
          success: false,
          error: "日志管理器不可用"
        };
      } catch (error) {
        this.logger.error("获取应用日志失败:", error);
        return {
          success: false,
          error: error.message
        };
      }
    });

    ipcMain.handle("get-sherpa-logs", (event, lines = 100) => {
      try {
        if (this.logger && this.logger.getSherpaLogs) {
          return {
            success: true,
            logs: this.logger.getSherpaLogs(lines)
          };
        }
        return {
          success: false,
          error: "日志管理器不可用"
        };
      } catch (error) {
        this.logger.error("获取Sherpa日志失败:", error);
        return {
          success: false,
          error: error.message
        };
      }
    });

    ipcMain.handle("get-log-file-path", () => {
      try {
        if (this.logger && this.logger.getLogFilePath) {
          return {
            success: true,
            appLogPath: this.logger.getLogFilePath(),
            sherpaLogPath: this.logger.getSherpaLogFilePath ? this.logger.getSherpaLogFilePath() : null
          };
        }
        return {
          success: false,
          error: "日志管理器不可用"
        };
      } catch (error) {
        this.logger.error("获取日志文件路径失败:", error);
        return {
          success: false,
          error: error.message
        };
      }
    });

    ipcMain.handle("open-log-file", (event, logType = 'app') => {
      try {
        if (this.logger) {
          const logPath = logType === 'sherpa'
            ? (this.logger.getSherpaLogFilePath ? this.logger.getSherpaLogFilePath() : this.logger.getLogFilePath())
            : this.logger.getLogFilePath();
          
          require("electron").shell.showItemInFolder(logPath);
          return { success: true };
        }
        return {
          success: false,
          error: "日志管理器不可用"
        };
      } catch (error) {
        this.logger.error("打开日志文件失败:", error);
        return {
          success: false,
          error: error.message
        };
      }
    });

    ipcMain.handle("get-system-debug-info", () => {
      try {
        const debugInfo = {
          system: {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            electronVersion: process.versions.electron,
            appVersion: require("electron").app.getVersion()
          },
          environment: {
            NODE_ENV: process.env.NODE_ENV,
            PATH: process.env.PATH,
            AI_API_KEY: '通过控制面板设置',
            AI_BASE_URL: '通过控制面板设置',
            AI_MODEL: '通过控制面板设置'
          },
          sherpaStatus: {
            isInitialized: this.sherpaManager.isInitialized,
            serverReady: this.sherpaManager.serverReady
          }
        };

        if (this.logger && this.logger.getSystemInfo) {
          debugInfo.loggerInfo = this.logger.getSystemInfo();
        }

        return {
          success: true,
          debugInfo
        };
      } catch (error) {
        this.logger.error("获取系统调试信息失败:", error);
        return {
          success: false,
          error: error.message
        };
      }
    });

    ipcMain.handle("test-sherpa-environment", async () => {
      try {
        this.logger && this.logger.info && this.logger.info('开始测试Sherpa环境');

        const sherpaStatus = await this.sherpaManager.checkStatus();

        const testResult = {
          success: true,
          sherpaStatus,
          timestamp: new Date().toISOString()
        };

        this.logger && this.logger.info && this.logger.info('Sherpa环境测试完成', testResult);

        return testResult;
      } catch (error) {
        const errorResult = {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };

        this.logger && this.logger.error && this.logger.error('Sherpa环境测试失败', errorResult);

        return errorResult;
      }
    });

    ipcMain.handle("restart-sherpa-server", async () => {
      try {
        this.logger && this.logger.info && this.logger.info('手动重启Sherpa服务器');

        // 使用新的restartServer方法
        const result = await this.sherpaManager.restartServer();

        return result;
      } catch (error) {
        this.logger && this.logger.error && this.logger.error('重启Sherpa服务器失败', error);
        return {
          success: false,
          error: error.message
        };
      }
    });
  }


}

module.exports = IPCHandlers;