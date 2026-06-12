const { ipcMain } = require("electron");

module.exports = function register(ctx) {
  // AI文本处理（實作在 aiTextProcessor.js）
  ipcMain.handle("process-text", async (event, text, mode = 'optimize') => {
    return await ctx.aiProcessor.processTextWithAI(text, mode);
  });

  ipcMain.handle("check-ai-status", async (event, testConfig = null) => {
    return await ctx.aiProcessor.checkAIStatus(testConfig);
  });
};
