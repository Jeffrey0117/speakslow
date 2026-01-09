import React, { useState, useEffect, useRef, useCallback } from "react";
import "./index.css";
import { toast } from "sonner";
import { LoadingDots } from "./components/ui/loading-dots";
import { useHotkey } from "./hooks/useHotkey";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useRecording } from "./hooks/useRecording";
import { useTextProcessing } from "./hooks/useTextProcessing";
import { useModelStatus } from "./hooks/useModelStatus";
import { usePermissions } from "./hooks/usePermissions";
import { useTranslation } from "./i18n";
import { Mic, MicOff, Settings, History, Copy, Download } from "lucide-react";
import SettingsPanel from "./components/SettingsPanel";
import { ModelDownloadProgress } from "./components/ui/model-status-indicator";

// 动态导入设置页面组件
const SettingsPage = React.lazy(() => import('./settings.jsx').then(module => ({ default: module.SettingsPage })));

// 声波图标组件（空闲/悬停状态）
const SoundWaveIcon = ({ size = 16, isActive = false }) => {
  return (
    <div className="flex items-center justify-center gap-1">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className={`bg-slate-600 dark:bg-gray-300 rounded-full transition-all duration-150 shadow-sm ${
            isActive ? "wave-bar" : ""
          }`}
          style={{
            width: size * 0.15,
            height: isActive ? size * 0.8 : size * 0.4,
            animationDelay: isActive ? `${i * 0.1}s` : "0s",
          }}
        />
      ))}
    </div>
  );
};

// 加载指示器组件（FunASR启动中）
const LoadingIndicator = ({ size = 20 }) => {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-gray-500 rounded-full"
          style={{
            height: size * 0.6,
            animation: `loading-dots 1.4s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
};

// 语音波形指示器组件（处理状态）
const VoiceWaveIndicator = ({ isListening }) => {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className={`w-0.5 bg-white rounded-full transition-all duration-150 drop-shadow-sm ${
            isListening ? "animate-pulse h-5" : "h-2"
          }`}
          style={{
            animationDelay: isListening ? `${i * 0.1}s` : "0s",
            animationDuration: isListening ? `${0.6 + i * 0.1}s` : "0s",
          }}
        />
      ))}
    </div>
  );
};

// 增强的工具提示组件
const Tooltip = ({ children, content, position = "top" }) => {
  const [isVisible, setIsVisible] = useState(false);

  const getPositionClasses = () => {
    if (position === "bottom") {
      return {
        tooltip: "absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 text-white bg-gradient-to-r from-neutral-800 to-neutral-700 rounded-md whitespace-nowrap z-50 transition-opacity duration-150",
        arrow: "absolute bottom-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-b-2 border-transparent border-b-neutral-800"
      };
    }
    // 默认为顶部
    return {
      tooltip: "absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-white bg-gradient-to-r from-neutral-800 to-neutral-700 rounded-md whitespace-nowrap z-50 transition-opacity duration-150",
      arrow: "absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-neutral-800"
    };
  };

  const { tooltip, arrow } = getPositionClasses();

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div
          className={tooltip}
          style={{ fontSize: "10px" }}
        >
          {content}
          <div className={arrow}></div>
        </div>
      )}
    </div>
  );
};

// 文本显示区域组件
const TextDisplay = ({ originalText, processedText, isProcessing, onCopy, onExport, onPaste, t }) => {
  if (!originalText && !processedText) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 原始识别文本 - 复制按钮在右上角 */}
      {originalText && (
        <div className="relative bg-slate-100/80 dark:bg-gray-800/80 rounded-lg p-4 pr-12 shadow-sm">
          <button
            onClick={() => onCopy(originalText)}
            className="absolute top-3 right-3 p-1.5 hover:bg-slate-200/70 dark:hover:bg-gray-700/70 rounded-md transition-colors"
            title={t ? t('app.copyOriginal') : "複製辨識文字"}
          >
            <Copy className="w-4 h-4 text-slate-500 dark:text-gray-400" />
          </button>
          <p className="chinese-content text-gray-800 dark:text-gray-200 leading-relaxed">
            {originalText}
          </p>
        </div>
      )}

      {/* AI处理后文本 */}
      {(processedText || isProcessing) && (
        <div className="relative bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl p-5 pr-14 border-l-4 border-emerald-400 dark:border-emerald-500 shadow-lg border border-emerald-200/50 dark:border-emerald-700/50">
          {/* 右上角按钮组 */}
          {processedText && (
            <div className="absolute top-3 right-3 flex space-x-1">
              <button
                onClick={() => onPaste(processedText)}
                className="p-1.5 hover:bg-emerald-200/70 dark:hover:bg-emerald-700/30 rounded-md transition-colors"
                title={t ? t('app.paste') : "貼上優化文字"}
              >
                <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </button>
              <button
                onClick={() => onCopy(processedText)}
                className="p-1.5 hover:bg-emerald-200/70 dark:hover:bg-emerald-700/30 rounded-md transition-colors"
                title={t ? t('app.copyOptimized') : "複製優化文字"}
              >
                <Copy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </button>
              <button
                onClick={() => onExport(processedText)}
                className="p-1.5 hover:bg-emerald-200/70 dark:hover:bg-emerald-700/30 rounded-md transition-colors"
                title={t ? t('app.export') : "匯出文字"}
              >
                <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </button>
            </div>
          )}

          <h3 className="text-base font-semibold chinese-title text-emerald-700 dark:text-emerald-400 mb-3">
            {t ? t('app.aiOptimized') : 'AI優化後'}
          </h3>

          {isProcessing ? (
            <div className="flex items-center space-x-3 text-emerald-700 dark:text-emerald-400">
              <LoadingDots />
              <span className="status-text">{t ? t('app.aiOptimizing') : 'AI正在優化文字...'}</span>
            </div>
          ) : (
            <p className="chinese-content leading-loose fade-in text-gray-800 dark:text-gray-200">
              {processedText}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// 设置页面包装组件 - 用于 ?page=settings 路由
const SettingsPageWrapper = () => {
  const { t } = useTranslation();
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <LoadingDots />
          <span className="text-gray-700 dark:text-gray-300">{t('app.loadingSettings')}</span>
        </div>
      </div>
    }>
      <SettingsPage />
    </React.Suspense>
  );
};

export default function App() {
  // 检查URL参数来决定渲染哪个页面
  const urlParams = new URLSearchParams(window.location.search);
  const page = urlParams.get('page');

  // 如果是设置页面，直接渲染设置组件（使用单独组件避免hooks规则问题）
  if (page === 'settings') {
    return <SettingsPageWrapper />;
  }

  const [isHovered, setIsHovered] = useState(false);
  const [originalText, setOriginalText] = useState("");
  const [processedText, setProcessedText] = useState("");
  const [showTextArea, setShowTextArea] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // 點擊錄音流程：等待使用者點擊目標位置
  const [waitingForTarget, setWaitingForTarget] = useState(false);

  // i18n
  const { t, language, convert } = useTranslation();

  // 加载通知设置
  useEffect(() => {
    const loadNotificationSetting = async () => {
      if (window.electronAPI) {
        const enabled = await window.electronAPI.getSetting('enable_notifications', true);
        setNotificationsEnabled(enabled !== false);
      }
    };
    loadNotificationSetting();

    // 监听设置变化
    const handleSettingsChange = () => {
      loadNotificationSetting();
    };
    window.addEventListener('settings-changed', handleSettingsChange);
    return () => window.removeEventListener('settings-changed', handleSettingsChange);
  }, []);

  // 条件性显示通知的辅助函数
  const showNotification = useCallback((type, message, options) => {
    if (!notificationsEnabled && type !== 'error') return;
    toast[type](message, options);
  }, [notificationsEnabled]);
  
  const { isDragging, handleMouseDown, handleMouseMove, handleMouseUp, handleClick } = useWindowDrag();
  const modelStatus = useModelStatus();
  
  const {
    isRecording,
    isProcessing: isRecordingProcessing,
    isOptimizing,
    startRecording,
    stopRecording,
    error: recordingError
  } = useRecording();
  
  const {
    processText,
    isProcessing: isTextProcessing,
    error: textProcessingError
  } = useTextProcessing();

  // 防重复粘贴的引用
  const lastPasteRef = useRef({ text: '', timestamp: 0 });
  const PASTE_DEBOUNCE_TIME = 1000; // 1秒内相同文本不重复粘贴

  // 安全粘贴函数
  const safePaste = useCallback(async (text) => {
    const now = Date.now();
    const lastPaste = lastPasteRef.current;

    // 防重复粘贴：如果是相同文本且在防抖时间内，则跳过
    if (lastPaste.text === text && (now - lastPaste.timestamp) < PASTE_DEBOUNCE_TIME) {
      console.log("🚫 跳过重复粘贴，文本:", text.substring(0, 50) + "...");
      return;
    }

    // 更新最后粘贴记录
    lastPasteRef.current = { text, timestamp: now };

    console.log("🔄 safePaste 被调用，文本:", text.substring(0, 50) + "...");
    try {
      // 先用 navigator.clipboard 直接在前端寫入（最可靠）
      try {
        await navigator.clipboard.writeText(text);
        // 等待一下確保剪貼簿寫入完成
        await new Promise(resolve => setTimeout(resolve, 50));
        console.log("✅ navigator.clipboard 寫入成功");
      } catch (clipErr) {
        console.warn("⚠️ navigator.clipboard 失敗，嘗試 Electron API:", clipErr);
        // 備用：用 Electron 寫入剪貼簿
        if (window.electronAPI) {
          await window.electronAPI.copyText(text);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      // 再透過 Electron API 嘗試自動貼上
      if (window.electronAPI) {
        // 先恢復焦點到原本的視窗
        console.log("🔄 嘗試恢復焦點到原本視窗");
        await window.electronAPI.restoreForegroundWindow();

        // 給一點時間讓視窗切換完成
        await new Promise(resolve => setTimeout(resolve, 150));

        console.log("📱 呼叫 Electron pasteText");
        await window.electronAPI.pasteText(text);
        console.log("✅ Electron pasteText 完成");
      }

      showNotification('success', t('notifications.copied'));
    } catch (error) {
      console.error("❌ 粘贴文本失败:", error);
      showNotification('error', t('notifications.pasteFailed'), {
        description: t('notifications.pasteFailedDesc')
      });
    }
  }, [showNotification, t]);

  // 处理录音完成（FunASR识别完成）
  const handleRecordingComplete = useCallback(async (transcriptionResult) => {
    console.log("🎤 handleRecordingComplete 被调用:", transcriptionResult);
    const text = transcriptionResult?.text;
    if (text) {
      console.log("✅ 转录成功，文本:", text);
      // 立即显示FunASR识别的原始文本
      setOriginalText(text);
      setShowTextArea(true);

      // 清空之前的处理结果，等待AI优化
      setProcessedText("");

      showNotification('success', t('notifications.transcriptionComplete'));
    } else {
      console.log("❌ 转录失败或无文本:", transcriptionResult);
    }
  }, [showNotification, t]);

  // 处理AI优化完成
  const handleAIOptimizationComplete = useCallback(async (optimizedResult) => {
    console.log('AI优化完成回调被触发:', optimizedResult);
    if (optimizedResult.success && optimizedResult.enhanced_by_ai && optimizedResult.text) {
      // 显示AI优化后的文本
      setProcessedText(optimizedResult.text);

      // 自动粘贴AI优化后的文本
      console.log("📋 准备粘贴AI优化后的文本:", optimizedResult.text);
      await safePaste(optimizedResult.text);
      console.log("✅ AI优化文本粘贴完成");

      showNotification('success', t('notifications.aiComplete'));
      console.log('AI优化文本已设置:', optimizedResult.text);
    } else {
      // AI优化未启用或失败，使用 optimizedResult.text（即原始文本）
      // 注意：不使用閉包中的 originalText，因為可能是過時的值
      const textToPaste = optimizedResult.text;
      console.log('AI优化未启用或失败，使用原始文本:', textToPaste);
      if (textToPaste) {
        console.log("📋 粘贴原始文本:", textToPaste);
        await safePaste(textToPaste);
      } else {
        console.warn('無可用文本進行粘貼');
      }
    }
  }, [safePaste, showNotification, t]);

  // 设置转录完成回调
  useEffect(() => {
    console.log('设置回调函数');
    window.onTranscriptionComplete = handleRecordingComplete;
    window.onAIOptimizationComplete = handleAIOptimizationComplete;
    
    // 验证回调函数是否正确设置
    console.log('回调函数设置完成:', {
      onTranscriptionComplete: typeof window.onTranscriptionComplete,
      onAIOptimizationComplete: typeof window.onAIOptimizationComplete
    });
    
    return () => {
      console.log('清理回调函数');
      window.onTranscriptionComplete = null;
      window.onAIOptimizationComplete = null;
    };
  }, [handleRecordingComplete, handleAIOptimizationComplete]);

  // 处理复制文本
  const handleCopyText = useCallback(async (text) => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.copyText(text);
        if (result.success) {
          showNotification('success', t('notifications.copied'));
        } else {
          throw new Error(result.error || t('common.error'));
        }
      } else {
        await navigator.clipboard.writeText(text);
        showNotification('success', t('notifications.copied'));
      }
    } catch (error) {
      console.error("复制文本失败:", error);
      showNotification('error', t('notifications.copyFailed', { error: error.message }));
    }
  }, [showNotification, t]);


  // 处理导出文本
  const handleExportText = useCallback(async (text) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.exportTranscriptions('txt');
        showNotification('success', t('notifications.exported'));
      } else {
        // Web环境下载文件
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${t('appName')}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      showNotification('error', t('notifications.exportFailed'));
    }
  }, [showNotification, t]);

  // 处理模型下载
  const handleDownloadModels = useCallback(async () => {
    try {
      // 显示开始下载的提示
      showNotification('info', t('notifications.downloadStarted'));

      const result = await modelStatus.downloadModels();
      if (result.success) {
        showNotification('success', t('notifications.downloadComplete'));
      } else {
        showNotification('error', t('notifications.downloadFailed', { error: result.error }));
      }
    } catch (error) {
      console.error('下载模型失败:', error);
      showNotification('error', t('notifications.downloadFailed', { error: error.message }));
    }
  }, [modelStatus, showNotification, t]);

  // 檢查模型狀態的輔助函數
  const checkModelReady = useCallback(() => {
    if (modelStatus.stage === 'need_download') {
      showNotification('warning', t('notifications.pleaseDownload'));
      return false;
    }
    if (modelStatus.stage === 'downloading') {
      showNotification('warning', t('notifications.modelDownloading'));
      return false;
    }
    if (modelStatus.stage === 'loading') {
      showNotification('warning', t('notifications.modelLoading'));
      return false;
    }
    if (modelStatus.stage === 'error') {
      showNotification('error', `${t('app.modelError')}: ${modelStatus.error}`);
      return false;
    }
    if (!modelStatus.isReady) {
      showNotification('warning', t('notifications.modelNotReady'));
      return false;
    }
    return true;
  }, [modelStatus, showNotification, t]);

  // 熱鍵觸發的錄音切換（前景視窗已由主進程儲存）
  const toggleRecordingByHotkey = useCallback(async () => {
    if (!checkModelReady()) return;

    if (!isRecording && !isRecordingProcessing) {
      // 熱鍵觸發：前景視窗已在主進程儲存，直接開始錄音
      startRecording();
    } else if (isRecording) {
      stopRecording();
    }
  }, [checkModelReady, isRecording, isRecordingProcessing, startRecording, stopRecording]);

  // 點擊按鈕觸發的錄音 - 簡單版：直接開始錄音
  const handleClickRecording = useCallback(async () => {
    if (!checkModelReady()) return;

    if (isRecording) {
      // 如果正在錄音，停止錄音
      stopRecording();
      return;
    }

    if (isRecordingProcessing) {
      // 正在處理中，忽略
      return;
    }

    // 直接開始錄音
    startRecording();
  }, [checkModelReady, isRecording, isRecordingProcessing, stopRecording, startRecording]);

  // 當熱鍵觸發且在等待模式時，儲存視窗並開始錄音
  const handleHotkeyWhileWaiting = useCallback(async () => {
    if (waitingForTarget) {
      setWaitingForTarget(false);
      // 前景視窗已由主進程在熱鍵觸發時儲存
      startRecording();
      // 顯示 QuQu 視窗
      if (window.electronAPI) {
        window.electronAPI.showWindow();
      }
    }
  }, [waitingForTarget, startRecording]);

  // 統一的錄音切換（供熱鍵使用）
  const toggleRecording = useCallback(async () => {
    if (waitingForTarget) {
      // 在等待模式中按熱鍵，開始錄音
      await handleHotkeyWhileWaiting();
    } else {
      // 正常熱鍵觸發
      await toggleRecordingByHotkey();
    }
  }, [waitingForTarget, handleHotkeyWhileWaiting, toggleRecordingByHotkey]);

  // 使用热键Hook，不再使用F2双击功能
  const { hotkey, syncRecordingState, registerHotkey } = useHotkey();

  // 注册传统热键监听 - 只在主窗口注册，避免重复
  useEffect(() => {
    // 检查是否为控制面板窗口
    const urlParams = new URLSearchParams(window.location.search);
    const isControlPanel = urlParams.get('panel') === 'control';
    
    // 只有主窗口才注册热键
    if (isControlPanel) {
      console.log('控制面板窗口，跳过热键注册');
      return;
    }

    const initializeHotkey = async () => {
      try {
        // 注册默认热键 Ctrl+Shift+Space
        const success = await registerHotkey('CommandOrControl+Shift+Space');
        if (success) {
          console.log('主窗口热键注册成功');
        } else {
          console.error('主窗口热键注册失败');
        }
      } catch (error) {
        console.error('主窗口热键注册异常:', error);
      }
    };

    if (registerHotkey) {
      initializeHotkey();
    }
  }, [registerHotkey]);

  // 处理关闭窗口
  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.hideWindow();
    }
  };

  // 处理打开设置
  const handleOpenSettings = () => {
    if (window.electronAPI) {
      window.electronAPI.openSettingsWindow();
    } else {
      // Web环境下仍然使用模态框
      setShowSettings(true);
    }
  };

  // 处理打开历史记录
  const handleOpenHistory = () => {
    if (window.electronAPI) {
      window.electronAPI.openHistoryWindow();
    }
  };


  // 监听全局热键触发事件
  useEffect(() => {
    if (window.electronAPI) {
      // 监听传统热键触发
      const unsubscribeHotkey = window.electronAPI.onHotkeyTriggered((event, data) => {
        console.log('收到热键触发事件:', data);
        console.log('当前录音状态:', isRecording, '处理状态:', isRecordingProcessing);
        toggleRecording();
      });

      // 监听旧的toggle事件（保持兼容性）
      const unsubscribeToggle = window.electronAPI.onToggleDictation(() => {
        console.log('收到旧版toggle事件');
        console.log('当前录音状态:', isRecording, '处理状态:', isRecordingProcessing);
        toggleRecording();
      });

      return () => {
        if (unsubscribeHotkey) unsubscribeHotkey();
        if (unsubscribeToggle) unsubscribeToggle();
      };
    }
  }, [toggleRecording, isRecording, isRecordingProcessing]);

  // 同步录音状态到热键管理器
  useEffect(() => {
    if (syncRecordingState) {
      syncRecordingState(isRecording);
    }
  }, [isRecording, syncRecordingState]);

  // 监听键盘事件
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, []);

  // 错误处理
  useEffect(() => {
    if (recordingError) {
      toast.error(recordingError);
    }
  }, [recordingError]);

  useEffect(() => {
    if (textProcessingError) {
      toast.error(textProcessingError);
    }
  }, [textProcessingError]);

  // 确定当前麦克风状态
  const getMicState = () => {
    if (isRecording) return "recording";
    if (isRecordingProcessing) return "processing";
    if (isOptimizing) return "optimizing";
    if (isHovered && !isRecording && !isRecordingProcessing && !isOptimizing) return "hover";
    return "idle";
  };

  const micState = getMicState();
  const isListening = isRecording || isRecordingProcessing;

  // 获取麦克风按钮属性
  const getMicButtonProps = () => {
    const baseClasses =
      "rounded-full w-16 h-16 flex items-center justify-center relative overflow-hidden border-2 border-white/80 transition-all duration-300 shadow-xl";

    // 统一的按钮样式，不再根据状态变色
    const buttonStyle = `${baseClasses} bg-gradient-to-br from-slate-100 to-slate-200 dark:from-gray-700 dark:to-gray-600 hover:from-slate-200 hover:to-slate-300 dark:hover:from-gray-600 dark:hover:to-gray-500 hover:shadow-2xl transform hover:scale-105`;

    // 如果模型未就绪，显示禁用状态（统一的灰色）
    if (!modelStatus.isReady) {
      return {
        className: `${baseClasses} bg-gradient-to-br from-gray-300 to-gray-400 dark:from-gray-600 dark:to-gray-700 cursor-not-allowed opacity-70`,
        tooltip: modelStatus.stage === 'need_download' ? t('notifications.pleaseDownload') :
                 modelStatus.stage === 'downloading' ? `${t('app.downloading')} ${modelStatus.downloadProgress || 0}%` :
                 modelStatus.stage === 'loading' ? t('app.loading') :
                 modelStatus.stage === 'error' ? `${t('app.modelError')}: ${modelStatus.error}` :
                 t('app.modelNotReady'),
        disabled: true
      };
    }

    switch (micState) {
      case "idle":
        return {
          className: `${buttonStyle} cursor-pointer`,
          tooltip: t('app.startRecording', { hotkey }),
          disabled: false
        };
      case "hover":
        return {
          className: `${buttonStyle} scale-105 shadow-2xl cursor-pointer`,
          tooltip: t('app.startRecording', { hotkey }),
          disabled: false
        };
      case "recording":
        return {
          className: `${buttonStyle} recording-pulse cursor-pointer`,
          tooltip: t('app.recording'),
          disabled: false
        };
      case "processing":
        return {
          className: `${buttonStyle} cursor-not-allowed opacity-70`,
          tooltip: t('app.processing'),
          disabled: true
        };
      case "optimizing":
        return {
          className: `${buttonStyle} cursor-not-allowed opacity-70`,
          tooltip: t('app.optimizing'),
          disabled: true
        };
      default:
        return {
          className: `${buttonStyle} cursor-pointer`,
          tooltip: t('app.clickToRecord', { hotkey }),
          disabled: false
        };
    }
  };

  const micProps = getMicButtonProps();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-4 pb-4">
      {/* 主界面 */}
      <div className="max-w-2xl mx-auto min-h-screen flex flex-col">
        {/* 标题栏 */}
        <div
          className="flex items-center justify-between mb-8 draggable"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 chinese-title">
            {t('appName')}
          </h1>
          <div className="flex items-center space-x-3 non-draggable">
            <Tooltip content={t('app.history')} position="bottom">
              <button
                onClick={handleOpenHistory}
                className="p-3 hover:bg-white/70 dark:hover:bg-gray-700/70 rounded-xl transition-colors shadow-sm"
              >
                <History className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>
            </Tooltip>
            <Tooltip content={t('app.settings')} position="bottom">
              <button
                onClick={handleOpenSettings}
                className="p-3 hover:bg-white/70 dark:hover:bg-gray-700/70 rounded-xl transition-colors shadow-sm"
              >
                <Settings className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </button>
            </Tooltip>
          </div>
        </div>

        {/* 录音控制区域 */}
        <div className="text-center mb-8 flex-shrink-0">
          <Tooltip content={micProps.tooltip}>
            <button
              onClick={(e) => {
                if (handleClick(e) && !micProps.disabled) {
                  handleClickRecording();
                }
              }}
              onMouseEnter={() => {
                if (!micProps.disabled) {
                  setIsHovered(true);
                }
              }}
              onMouseLeave={() => setIsHovered(false)}
              className={`${micProps.className} non-draggable shadow-lg`}
              disabled={micProps.disabled}
            >
              {/* 动态内容基于状态 */}
              {modelStatus.stage === 'downloading' ? (
                <LoadingIndicator size={20} />
              ) : modelStatus.stage === 'loading' || !modelStatus.isReady ? (
                <LoadingIndicator size={20} />
              ) : micState === "idle" ? (
                <SoundWaveIcon size={20} isActive={false} />
              ) : micState === "hover" ? (
                <SoundWaveIcon size={20} isActive={false} />
              ) : micState === "recording" ? (
                <SoundWaveIcon size={20} isActive={true} />
              ) : micState === "processing" ? (
                <VoiceWaveIndicator isListening={true} />
              ) : micState === "optimizing" ? (
                <LoadingIndicator size={20} />
              ) : null}

              {/* 移除所有状态指示环，保持简洁 */}
            </button>
          </Tooltip>
          
          <p className="mt-4 status-text text-gray-700 dark:text-gray-300">
            {modelStatus.stage === 'need_download' ? (
              t('app.needDownload')
            ) : modelStatus.stage === 'downloading' ? (
              `${t('app.downloading')} ${modelStatus.downloadProgress || 0}%`
            ) : modelStatus.stage === 'loading' ? (
              t('app.loading')
            ) : modelStatus.stage === 'error' ? (
              `${t('app.modelError')}: ${modelStatus.error}`
            ) : !modelStatus.isReady ? (
              t('app.modelNotReady')
            ) : waitingForTarget ? (
              t('app.waitingForTarget') || '請點擊目標位置後按熱鍵'
            ) : micState === "recording" ? (
              t('app.recording')
            ) : micState === "processing" ? (
              t('app.processing')
            ) : micState === "optimizing" ? (
              t('app.optimizing')
            ) : (
              t('app.clickToRecord', { hotkey })
            )}
          </p>
        </div>

        {/* 模型下载进度显示 */}
        {(modelStatus.stage === 'need_download' || modelStatus.stage === 'downloading') && (
          <div className="mb-6">
            <ModelDownloadProgress
              modelStatus={modelStatus}
              onDownload={handleDownloadModels}
            />
          </div>
        )}

        {/* 文本显示区域 - 可滚动 */}
        <div className="flex-1 text-area-scroll">
          <TextDisplay
            originalText={originalText}
            processedText={processedText}
            isProcessing={isTextProcessing || isOptimizing}
            onCopy={handleCopyText}
            onExport={handleExportText}
            onPaste={safePaste}
            t={t}
          />
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

    </div>
  );
}