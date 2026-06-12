import { useState, useCallback, useRef } from 'react';
import { useTranslation } from '../i18n';

/**
 * 热键管理Hook
 * 处理全局快捷键功能，包括F2双击功能
 */
export const useHotkey = () => {
  const { t } = useTranslation();
  // 錄音熱鍵已統一為 TypeLess「右 Alt / 右 Ctrl」（單擊切換），由 TypelessManager 處理
  const [hotkey, setHotkey] = useState('右 Alt / 右 Ctrl');
  const [isRegistered, setIsRegistered] = useState(false);
  const registeredHotkeyRef = useRef(null); // 跟踪已注册的热键

  // 錄音熱鍵已統一固定為「右 Alt」（TypeLess），不再從設定動態載入覆蓋顯示。
  // （舊邏輯會抓「目前註冊的快捷鍵」，移除 toggle-recording 後會誤抓到 Escape 等）

  // 移除F2双击相关的复杂逻辑，专注于传统热键

  // 注册传统热键 - 添加防重复注册机制
  const registerHotkey = async (newHotkey) => {
    try {
      // 防重复注册：如果已经注册了相同的热键，直接返回成功
      if (registeredHotkeyRef.current === newHotkey && isRegistered) {
        console.log(`热键 ${newHotkey} 已注册，跳过重复注册`);
        return true;
      }

      if (window.electronAPI) {
        const result = await window.electronAPI.registerHotkey(newHotkey);
        if (result.success) {
          registeredHotkeyRef.current = newHotkey;
          setHotkey(newHotkey);
          setIsRegistered(true);
          return true;
        }
      }
      return false;
    } catch (error) {
      if (window.electronAPI && window.electronAPI.log) {
        window.electronAPI.log('error', '注册热键失败:', error);
      }
      return false;
    }
  };

  // 注销传统热键
  const unregisterHotkey = async (hotkeyToUnregister) => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.unregisterHotkey(hotkeyToUnregister || hotkey);
        if (result.success) {
          setIsRegistered(false);
        }
      }
    } catch (error) {
      if (window.electronAPI && window.electronAPI.log) {
        window.electronAPI.log('error', '注销热键失败:', error);
      }
    }
  };

  // 同步录音状态到主进程
  const syncRecordingState = useCallback(async (isRecording) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.setRecordingState(isRecording);
      }
    } catch (error) {
      if (window.electronAPI && window.electronAPI.log) {
        window.electronAPI.log('error', '同步录音状态失败:', error);
      }
    }
  }, []);

  // 格式化热键显示
  const formatHotkey = (hotkeyString) => {
    return hotkeyString
      .replace('CommandOrControl', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl')
      .replace('Shift', '⇧')
      .replace('Alt', '⌥')
      .replace('Space', t('settings.hotkeysTab.spaceKey'))
      .replace('F2', 'F2')
      .replace('+', ' + ');
  };

  return {
    // 已固定為中文鍵名（右 Alt / 右 Ctrl），直接顯示（不經過 Mac 取向的 formatHotkey）
    hotkey: hotkey.includes('右') ? t('panel.hotkeyName') : formatHotkey(hotkey),
    rawHotkey: hotkey,
    isRegistered,
    registerHotkey,
    unregisterHotkey,
    syncRecordingState
  };
};