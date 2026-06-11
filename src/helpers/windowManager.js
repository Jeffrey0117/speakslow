const { BrowserWindow } = require("electron");
const path = require("path");

class WindowManager {
  constructor(databaseManager = null) {
    this.databaseManager = databaseManager;
    this.mainWindow = null;
    this.controlPanelWindow = null;
    this.historyWindow = null;
    this.settingsWindow = null;
    this.typelessIndicatorWindow = null; // TypeLess 錄音指示器視窗
    this.isQuitting = false; // 用於判斷是否真正退出
  }

  // 設置 databaseManager（用於延遲初始化）
  setDatabaseManager(databaseManager) {
    this.databaseManager = databaseManager;
  }

  // 設置主視窗置頂狀態
  setMainWindowAlwaysOnTop(value) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.setAlwaysOnTop(value);
    }
  }

  async createMainWindow() {
    if (this.mainWindow) {
      this.mainWindow.focus();
      return this.mainWindow;
    }

    // 從設定讀取置頂狀態，預設為 true
    let alwaysOnTop = true;
    if (this.databaseManager) {
      try {
        const savedValue = this.databaseManager.getSetting('window_always_on_top', true);
        alwaysOnTop = savedValue !== false; // 確保預設為 true
      } catch (e) {
        console.warn('讀取置頂設定失敗，使用預設值:', e);
      }
    }

    this.mainWindow = new BrowserWindow({
      width: 472,
      height: 460,
      frame: false,
      transparent: true,
      alwaysOnTop: alwaysOnTop,
      resizable: false,
      skipTaskbar: true,
      movable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "..", "..", "preload.js"),
      },
    });

    const isDev = process.env.NODE_ENV === "development";

    if (isDev) {
      await this.mainWindow.loadURL("http://localhost:5173");
    } else {
      await this.mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
    }

    // 監聽縮小事件
    this.mainWindow.on("minimize", (event) => {
      if (this.databaseManager) {
        try {
          const minimizeToTray = this.databaseManager.getSetting('minimize_to_tray', true);
          if (minimizeToTray) {
            event.preventDefault();
            this.mainWindow.hide();
          }
        } catch (e) {
          console.warn('讀取縮小設定失敗:', e);
        }
      }
    });

    // 監聯關閉事件
    this.mainWindow.on("close", (event) => {
      if (this.isQuitting) return; // 真正退出時不攔截

      if (this.databaseManager) {
        try {
          const closeToTray = this.databaseManager.getSetting('close_to_tray', true);
          if (closeToTray) {
            event.preventDefault();
            this.mainWindow.hide();
          }
        } catch (e) {
          console.warn('讀取關閉設定失敗:', e);
        }
      }
    });

    this.mainWindow.on("closed", () => {
      this.mainWindow = null;
    });

    return this.mainWindow;
  }

  async createControlPanelWindow() {
    if (this.controlPanelWindow) {
      this.controlPanelWindow.focus();
      return this.controlPanelWindow;
    }

    this.controlPanelWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      title: "聲聲慢 - 極速語音轉錄",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "..", "..", "preload.js"),
      },
    });

    const isDev = process.env.NODE_ENV === "development";

    if (isDev) {
      await this.controlPanelWindow.loadURL("http://localhost:5173?panel=control");
    } else {
      await this.controlPanelWindow.loadFile(
        path.join(__dirname, "..", "dist", "index.html"),
        { query: { panel: "control" } }
      );
    }

    this.controlPanelWindow.on("closed", () => {
      this.controlPanelWindow = null;
    });

    return this.controlPanelWindow;
  }

  async createHistoryWindow() {
    if (this.historyWindow) {
      this.historyWindow.focus();
      return this.historyWindow;
    }

    this.historyWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      show: false,
      title: "轉錄歷史 - 聲聲慢",
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "..", "..", "preload.js"),
      },
    });

    const isDev = process.env.NODE_ENV === "development";

    if (isDev) {
      await this.historyWindow.loadURL("http://localhost:5173/history.html");
    } else {
      await this.historyWindow.loadFile(
        path.join(__dirname, "..", "dist", "history.html")
      );
    }

    this.historyWindow.on("closed", () => {
      this.historyWindow = null;
    });

    return this.historyWindow;
  }

  async createSettingsWindow() {
    if (this.settingsWindow) {
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
      width: 920,
      height: 780,
      minWidth: 820,
      minHeight: 640,
      show: false,
      title: "設定 - 聲聲慢",
      frame: false,          // 移除原生標題列（改用 settings.jsx 內的自訂標題列）
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "..", "..", "preload.js"),
      },
    });

    const isDev = process.env.NODE_ENV === "development";

    if (isDev) {
      await this.settingsWindow.loadURL("http://localhost:5173?page=settings");
    } else {
      await this.settingsWindow.loadFile(
        path.join(__dirname, "..", "dist", "settings.html")
      );
    }

    this.settingsWindow.on("closed", () => {
      this.settingsWindow = null;
    });

    return this.settingsWindow;
  }

  showControlPanel() {
    if (this.controlPanelWindow) {
      this.controlPanelWindow.show();
      this.controlPanelWindow.focus();
    } else {
      this.createControlPanelWindow().then(() => {
        this.controlPanelWindow.show();
      });
    }
  }

  hideControlPanel() {
    if (this.controlPanelWindow) {
      this.controlPanelWindow.hide();
    }
  }

  showHistoryWindow() {
    if (this.historyWindow) {
      this.historyWindow.show();
      this.historyWindow.focus();
      this.historyWindow.setAlwaysOnTop(true);
    } else {
      this.createHistoryWindow().then(() => {
        this.historyWindow.show();
        this.historyWindow.focus();
        this.historyWindow.setAlwaysOnTop(true);
      });
    }
  }

  hideHistoryWindow() {
    if (this.historyWindow) {
      this.historyWindow.hide();
    }
  }

  closeHistoryWindow() {
    if (this.historyWindow) {
      this.historyWindow.close();
    }
  }

  showSettingsWindow() {
    if (this.settingsWindow) {
      this.settingsWindow.show();
      this.settingsWindow.focus();
      this.settingsWindow.setAlwaysOnTop(true);
    } else {
      this.createSettingsWindow().then(() => {
        this.settingsWindow.show();
        this.settingsWindow.focus();
        this.settingsWindow.setAlwaysOnTop(true);
      });
    }
  }

  hideSettingsWindow() {
    if (this.settingsWindow) {
      this.settingsWindow.hide();
    }
  }

  closeSettingsWindow() {
    if (this.settingsWindow) {
      this.settingsWindow.close();
    }
  }

  // TypeLess 錄音指示器視窗
  async createTypelessIndicatorWindow() {
    if (this.typelessIndicatorWindow && !this.typelessIndicatorWindow.isDestroyed()) {
      return this.typelessIndicatorWindow;
    }

    const { screen } = require("electron");
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // 視窗尺寸
    const windowWidth = 240;
    const windowHeight = 72;

    this.typelessIndicatorWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: Math.round((screenWidth - windowWidth) / 2), // 螢幕正中間
      y: screenHeight - windowHeight - 24, // 更貼近螢幕底部
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      focusable: false,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "..", "..", "preload.js"),
      },
    });

    const isDev = process.env.NODE_ENV === "development";

    if (isDev) {
      await this.typelessIndicatorWindow.loadURL("http://localhost:5173?page=typeless-indicator");
    } else {
      await this.typelessIndicatorWindow.loadFile(
        path.join(__dirname, "..", "dist", "index.html"),
        { query: { page: "typeless-indicator" } }
      );
    }

    this.typelessIndicatorWindow.on("closed", () => {
      this.typelessIndicatorWindow = null;
    });

    return this.typelessIndicatorWindow;
  }

  showTypelessIndicator() {
    if (this.typelessIndicatorWindow && !this.typelessIndicatorWindow.isDestroyed()) {
      this.typelessIndicatorWindow.show();
    } else {
      this.createTypelessIndicatorWindow().then(() => {
        if (this.typelessIndicatorWindow) {
          this.typelessIndicatorWindow.show();
        }
      });
    }
  }

  hideTypelessIndicator() {
    if (this.typelessIndicatorWindow && !this.typelessIndicatorWindow.isDestroyed()) {
      this.typelessIndicatorWindow.hide();
    }
  }

  closeTypelessIndicator() {
    if (this.typelessIndicatorWindow && !this.typelessIndicatorWindow.isDestroyed()) {
      this.typelessIndicatorWindow.close();
      this.typelessIndicatorWindow = null;
    }
  }

  closeAllWindows() {
    if (this.mainWindow) {
      this.mainWindow.close();
    }
    if (this.controlPanelWindow) {
      this.controlPanelWindow.close();
    }
    if (this.historyWindow) {
      this.historyWindow.close();
    }
    if (this.settingsWindow) {
      this.settingsWindow.close();
    }
    if (this.typelessIndicatorWindow) {
      this.typelessIndicatorWindow.close();
    }
  }
}

module.exports = WindowManager;