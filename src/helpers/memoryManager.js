/**
 * 記憶體管理器
 * 用於優化應用的記憶體使用和資源清理
 */

class MemoryManager {
  constructor(options = {}) {
    this.cacheLimit = options.cacheLimit || 50;  // 最多快取 50 條記錄
    this.audioChunkLimit = options.audioChunkLimit || 100;  // 最多保留 100 個音訊片段
    this.cleanupIntervalMs = options.cleanupIntervalMs || 60000;  // 每分鐘清理一次
    this.cleanupTimer = null;
    this.isRunning = false;
  }

  /**
   * 啟動自動清理
   */
  startAutoCleanup() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.cleanupTimer = setInterval(() => {
      this.performCleanup();
    }, this.cleanupIntervalMs);
  }

  /**
   * 停止自動清理
   */
  stopAutoCleanup() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.isRunning = false;
  }

  /**
   * 執行清理任務
   */
  performCleanup() {
    // 使用 requestIdleCallback 在空閒時執行清理
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        this.cleanupResources();
      }, { timeout: 5000 });
    } else {
      setTimeout(() => {
        this.cleanupResources();
      }, 100);
    }
  }

  /**
   * 清理資源
   */
  cleanupResources() {
    // 清理過期的 URL objects
    this.cleanupBlobUrls();

    // 觸發瀏覽器垃圾回收提示（實際 GC 由瀏覽器決定）
    if (window.gc) {
      try {
        window.gc();
      } catch (e) {
        // 忽略錯誤
      }
    }
  }

  /**
   * 清理 Blob URLs
   */
  cleanupBlobUrls() {
    // 這會在組件中呼叫，清理已經不再使用的 blob URLs
  }

  /**
   * 限制陣列大小，移除舊元素
   * @param {Array} array - 要限制的陣列
   * @param {number} limit - 最大數量
   * @returns {Array} 限制後的陣列
   */
  limitArraySize(array, limit) {
    if (!array || !Array.isArray(array)) return array;
    if (array.length <= limit) return array;
    return array.slice(-limit);
  }

  /**
   * 清理音訊片段快取
   * @param {Array} audioChunks - 音訊片段陣列
   * @returns {Array} 清理後的陣列
   */
  cleanAudioChunks(audioChunks) {
    return this.limitArraySize(audioChunks, this.audioChunkLimit);
  }

  /**
   * 清理歷史記錄快取
   * @param {Array} history - 歷史記錄陣列
   * @returns {Array} 清理後的陣列
   */
  cleanHistoryCache(history) {
    return this.limitArraySize(history, this.cacheLimit);
  }

  /**
   * 獲取記憶體使用資訊（僅在 Node.js/Electron 主進程可用）
   * @returns {Object|null} 記憶體使用資訊
   */
  getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const used = process.memoryUsage();
      return {
        heapUsed: Math.round(used.heapUsed / 1024 / 1024),  // MB
        heapTotal: Math.round(used.heapTotal / 1024 / 1024),
        rss: Math.round(used.rss / 1024 / 1024),
        external: Math.round((used.external || 0) / 1024 / 1024),
      };
    }

    // 瀏覽器環境使用 performance.memory (僅 Chrome 支援)
    if (window.performance && window.performance.memory) {
      const memory = window.performance.memory;
      return {
        heapUsed: Math.round(memory.usedJSHeapSize / 1024 / 1024),
        heapTotal: Math.round(memory.totalJSHeapSize / 1024 / 1024),
        heapLimit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024),
      };
    }

    return null;
  }

  /**
   * 釋放音訊資源
   * @param {AudioContext} audioContext - 要釋放的 AudioContext
   */
  releaseAudioContext(audioContext) {
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
    }
  }

  /**
   * 釋放 MediaStream
   * @param {MediaStream} stream - 要釋放的 MediaStream
   */
  releaseMediaStream(stream) {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  }
}

// 創建單例實例
const memoryManager = new MemoryManager();

// 導出單例和類
module.exports = { memoryManager, MemoryManager };
