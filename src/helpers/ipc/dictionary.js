const { ipcMain } = require("electron");

module.exports = function register(ctx) {
  // ===== 字典功能 =====
  ipcMain.handle("get-dictionary-entries", (event, limit, offset) => {
    return ctx.databaseManager.getDictionaryEntries(limit, offset);
  });

  ipcMain.handle("add-dictionary-entry", (event, original, replacement, category) => {
    return ctx.databaseManager.addDictionaryEntry(original, replacement, category);
  });

  ipcMain.handle("update-dictionary-entry", (event, id, data) => {
    return ctx.databaseManager.updateDictionaryEntry(id, data);
  });

  ipcMain.handle("delete-dictionary-entry", (event, id) => {
    return ctx.databaseManager.deleteDictionaryEntry(id);
  });

  ipcMain.handle("search-dictionary", (event, query) => {
    return ctx.databaseManager.searchDictionary(query);
  });

  ipcMain.handle("get-dictionary-categories", () => {
    return ctx.databaseManager.getDictionaryCategories();
  });

  ipcMain.handle("apply-dictionary", (event, text) => {
    return ctx.databaseManager.applyDictionary(text);
  });

  ipcMain.handle("toggle-dictionary-entry", (event, id) => {
    const entry = ctx.databaseManager.db.prepare("SELECT enabled FROM dictionary WHERE id = ?").get(id);
    if (entry) {
      return ctx.databaseManager.updateDictionaryEntry(id, { enabled: !entry.enabled });
    }
    return null;
  });

  // 字典匯出
  ipcMain.handle("export-dictionary", async () => {
    try {
      const { dialog } = require("electron");
      const fs = require("fs");

      const entries = ctx.databaseManager.exportDictionary();

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
      ctx.logger.error("匯出字典失敗:", error);
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

      const result = ctx.databaseManager.importDictionary(entries, mode || 'merge');
      return { success: true, ...result, path: filePath };
    } catch (error) {
      ctx.logger.error("匯入字典失敗:", error);
      return { success: false, error: error.message };
    }
  });

  // 清空字典
  ipcMain.handle("clear-dictionary", () => {
    return ctx.databaseManager.clearDictionary();
  });
};
