/**
 * TypeLess 模式管理器
 * 實現「按住說話」功能：按住快捷鍵開始錄音，放開停止錄音
 */

const { uIOhook, UiohookKey } = require('uiohook-napi');

class TypelessManager {
  constructor(logger = null) {
    this.logger = logger;
    this.isEnabled = false;
    this.isKeyDown = false;
    // 預設：右 Alt（單擊切換）。uiohook 能區分左右 Alt（AltRight=3640）
    this.triggerKey = UiohookKey.AltRight;
    this.modifiers = {
      ctrl: false,
      shift: false,
      alt: false,
      meta: false
    };
    // 操作模式：'toggle' 單擊切換（按一下開始、再按一下停止）| 'hold' 按住說話
    this.mode = 'toggle';
    this.isActive = false;   // toggle 模式：目前是否正在錄音
    this.triggerHeld = false; // 防止長按時的自動重複觸發

    // 回調函數
    this.onStartRecording = null;
    this.onStopRecording = null;

    // 綁定事件處理器
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
  }

  /**
   * 設置回調函數
   */
  setCallbacks({ onStartRecording, onStopRecording }) {
    this.onStartRecording = onStartRecording;
    this.onStopRecording = onStopRecording;
    this.safeLog('info', 'TypeLess 回調函數已設置');
  }

  /**
   * 檢查修飾鍵是否匹配
   */
  checkModifiers(event) {
    const ctrlMatch = this.modifiers.ctrl === (event.ctrlKey || false);
    const shiftMatch = this.modifiers.shift === (event.shiftKey || false);
    const altMatch = this.modifiers.alt === (event.altKey || false);
    const metaMatch = this.modifiers.meta === (event.metaKey || false);

    return ctrlMatch && shiftMatch && altMatch && metaMatch;
  }

  /**
   * 處理按鍵按下事件
   */
  handleKeyDown(event) {
    if (!this.isEnabled) return;
    if (event.keycode !== this.triggerKey) return;

    if (this.mode === 'toggle') {
      // 單擊切換：忽略長按造成的自動重複（keydown 會連續觸發）
      if (this.triggerHeld) return;
      this.triggerHeld = true;

      this.isActive = !this.isActive;
      if (this.isActive) {
        this.safeLog('info', 'TypeLess(切換): 開始錄音');
        if (this.onStartRecording) this.onStartRecording();
      } else {
        this.safeLog('info', 'TypeLess(切換): 停止錄音');
        if (this.onStopRecording) this.onStopRecording();
      }
      return;
    }

    // hold 模式：按住說話（需檢查修飾鍵）
    if (this.checkModifiers(event)) {
      if (!this.isKeyDown) {
        this.isKeyDown = true;
        this.safeLog('info', 'TypeLess: 開始錄音 (keydown)');
        if (this.onStartRecording) this.onStartRecording();
      }
    }
  }

  /**
   * 處理按鍵放開事件
   */
  handleKeyUp(event) {
    if (!this.isEnabled) return;
    if (event.keycode !== this.triggerKey) return;

    // 放開觸發鍵：解除長按鎖定
    this.triggerHeld = false;

    // hold 模式才在放開時停止錄音；toggle 模式由再次按下控制
    if (this.mode === 'hold' && this.isKeyDown) {
      this.isKeyDown = false;
      this.safeLog('info', 'TypeLess: 停止錄音 (keyup)');
      if (this.onStopRecording) this.onStopRecording();
    }
  }

  /**
   * 啟用 TypeLess 模式
   */
  enable() {
    if (this.isEnabled) {
      this.safeLog('warn', 'TypeLess 模式已經啟用');
      return;
    }

    try {
      // 註冊事件監聽器
      uIOhook.on('keydown', this.handleKeyDown);
      uIOhook.on('keyup', this.handleKeyUp);

      // 啟動監聽
      uIOhook.start();

      this.isEnabled = true;
      this.safeLog('info', 'TypeLess 模式已啟用');
    } catch (error) {
      this.safeLog('error', 'TypeLess 模式啟用失敗', error);
      throw error;
    }
  }

  /**
   * 停用 TypeLess 模式
   */
  disable() {
    if (!this.isEnabled) {
      return;
    }

    try {
      // 移除事件監聽器
      uIOhook.off('keydown', this.handleKeyDown);
      uIOhook.off('keyup', this.handleKeyUp);

      // 停止監聽
      uIOhook.stop();

      this.isEnabled = false;
      this.isKeyDown = false;
      this.isActive = false;
      this.triggerHeld = false;
      this.safeLog('info', 'TypeLess 模式已停用');
    } catch (error) {
      this.safeLog('error', 'TypeLess 模式停用失敗', error);
    }
  }

  /**
   * 設定為「右 Alt 單擊切換」模式（TypeLess 預設）
   */
  setRightAltToggle() {
    this.triggerKey = UiohookKey.AltRight;
    this.modifiers = { ctrl: false, shift: false, alt: false, meta: false };
    this.mode = 'toggle';
    this.isActive = false;
    this.triggerHeld = false;
    this.safeLog('info', 'TypeLess 設定為「右 Alt 單擊切換」', {
      triggerKey: this.triggerKey,
    });
  }

  /**
   * 設置觸發快捷鍵
   * @param {string} accelerator - Electron 格式的快捷鍵，如 "CommandOrControl+Shift+Space"
   */
  setHotkey(accelerator) {
    const keyMap = {
      'Space': UiohookKey.Space,
      'Enter': UiohookKey.Enter,
      'Tab': UiohookKey.Tab,
      'Backspace': UiohookKey.Backspace,
      'F1': UiohookKey.F1,
      'F2': UiohookKey.F2,
      'F3': UiohookKey.F3,
      'F4': UiohookKey.F4,
      'F5': UiohookKey.F5,
      'F6': UiohookKey.F6,
      'F7': UiohookKey.F7,
      'F8': UiohookKey.F8,
      'F9': UiohookKey.F9,
      'F10': UiohookKey.F10,
      'F11': UiohookKey.F11,
      'F12': UiohookKey.F12,
    };

    // 解析快捷鍵
    const parts = accelerator.split('+');
    const modifiers = {
      ctrl: false,
      shift: false,
      alt: false,
      meta: false
    };

    let triggerKey = null;

    for (const part of parts) {
      const normalizedPart = part.trim();

      if (normalizedPart === 'CommandOrControl' || normalizedPart === 'Ctrl' || normalizedPart === 'Control') {
        modifiers.ctrl = true;
      } else if (normalizedPart === 'Shift') {
        modifiers.shift = true;
      } else if (normalizedPart === 'Alt') {
        modifiers.alt = true;
      } else if (normalizedPart === 'Meta' || normalizedPart === 'Command' || normalizedPart === 'Cmd') {
        modifiers.meta = true;
      } else {
        // 這是觸發鍵
        triggerKey = keyMap[normalizedPart];
        if (!triggerKey && normalizedPart.length === 1) {
          // 單個字母
          triggerKey = normalizedPart.toUpperCase().charCodeAt(0);
        }
      }
    }

    if (triggerKey) {
      this.triggerKey = triggerKey;
      this.modifiers = modifiers;
      this.safeLog('info', `TypeLess 快捷鍵已設置: ${accelerator}`, { triggerKey, modifiers });
    } else {
      this.safeLog('warn', `無法解析快捷鍵: ${accelerator}`);
    }
  }

  /**
   * 安全日誌記錄
   */
  safeLog(level, message, data = null) {
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](message, data);
    } else {
      console[level](`[TypelessManager] ${message}`, data || '');
    }
  }

  /**
   * 清理資源
   */
  cleanup() {
    this.disable();
    this.onStartRecording = null;
    this.onStopRecording = null;
  }
}

module.exports = { TypelessManager };
