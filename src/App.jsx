import React, { useState, useEffect, useRef, useCallback } from "react";
import "./index.css";
import { toast } from "sonner";
import { LoadingDots } from "./components/ui/loading-dots";
import { useHotkey } from "./hooks/useHotkey";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useRecording } from "./hooks/useRecording";
import { useStreamingRecording } from "./hooks/useStreamingRecording";
import { useTextProcessing } from "./hooks/useTextProcessing";
import { useModelStatus } from "./hooks/useModelStatus";
import { usePermissions } from "./hooks/usePermissions";
import { useTranslation } from "./i18n";
import { Mic, MicOff, Settings, Copy, Download, X, Pin, Minus, Sparkles } from "lucide-react";
import SettingsPanel from "./components/SettingsPanel";
import { ModelDownloadProgress } from "./components/ui/model-status-indicator";

// 动态导入设置页面组件
const SettingsPage = React.lazy(() => import('./settings.jsx').then(module => ({ default: module.SettingsPage })));

// 动态导入 TypeLess 指示器组件
const TypelessIndicator = React.lazy(() => import('./components/TypelessIndicator'));

// 声波图标组件（空闲/悬停状态）- 使用 React.memo 優化
const SoundWaveIcon = React.memo(({ size = 16, isActive = false }) => {
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
});

// 加载指示器组件（Sherpa 启动中）- 使用 React.memo 優化
const LoadingIndicator = React.memo(({ size = 20 }) => {
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
});

// 语音波形指示器组件（处理状态）- 使用 React.memo 優化
const VoiceWaveIndicator = React.memo(({ isListening }) => {
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
});

// 處理中小進度條 - 簡單一條放在文字下面（統一藍色，不變色）
const ProcessingProgressBar = React.memo(() => {
  return (
    <div className="w-32 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mx-auto mt-2">
      <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full processing-progress-bar" />
    </div>
  );
});

// 有趣的處理中訊息列表（幽默版）
const PROCESSING_MESSAGES = [
  '正在聽你的幹話...',
  '話不要說太多啊...',
  '你講了一句話，下一句就是第二句...',
  '認真聽你唬爛中...',
  '努力理解你在說啥...',
  '解碼你的聲波中...',
  '文字正在組裝...',
  '啟動語音魔法...',
  '正在努力辨識...',
  '嗯嗯好我聽到了...',
  '讓我想想你說啥...',
  '等我一下喔...',
];

// Fisher-Yates shuffle 演算法
const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// 隨機訊息 Hook - Shuffle 輪播版本（像隨機播放音樂一樣）
// 每個訊息都會出現一次，播完一輪再重新打亂
const useRandomMessage = (isActive, messages) => {
  const [message, setMessage] = useState('');
  const prevActiveRef = useRef(false);
  const shuffledQueueRef = useRef([]);
  const lastMessageRef = useRef('');

  useEffect(() => {
    // 只在狀態從 false 變成 true 時選擇新訊息
    if (isActive && !prevActiveRef.current) {
      // 如果隊列空了，重新 shuffle
      if (shuffledQueueRef.current.length === 0) {
        let newQueue = shuffleArray(messages);
        // 避免新一輪的第一個跟上一輪最後一個重複
        if (newQueue[0] === lastMessageRef.current && newQueue.length > 1) {
          // 把第一個移到後面去
          newQueue = [...newQueue.slice(1), newQueue[0]];
        }
        shuffledQueueRef.current = newQueue;
      }

      // 從隊列取出下一個訊息
      const nextMessage = shuffledQueueRef.current.shift();
      lastMessageRef.current = nextMessage;
      setMessage(nextMessage);
    }
    prevActiveRef.current = isActive;
  }, [isActive, messages]);

  return message;
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

// 文本显示区域组件 - 簡化版，只顯示一個結果
// 移除了 isProcessing 時的載入文字，避免閃跳
const TextDisplay = React.memo(({ originalText, processedText, onCopy, t }) => {
  // 顯示的文字：優先顯示 AI 優化後的，沒有就顯示原始的
  const displayText = processedText || originalText;

  // 沒有文字就不顯示這個區塊
  if (!displayText) {
    return null;
  }

  return (
    <div className="relative bg-white/90 dark:bg-gray-800/90 rounded-xl p-4 pr-12 shadow-md border border-gray-200/70 dark:border-gray-700/60">
      {/* 右上角複製按鈕 */}
      <button
        onClick={() => onCopy(displayText)}
        className="absolute top-3 right-3 p-1.5 hover:bg-slate-200/70 dark:hover:bg-gray-700/70 rounded-md transition-colors"
        title={t ? t('app.copy') : "複製文字"}
      >
        <Copy className="w-4 h-4 text-slate-500 dark:text-gray-400" />
      </button>

      <p className="chinese-content text-gray-800 dark:text-gray-200 leading-relaxed fade-in">
        {displayText}
      </p>
    </div>
  );
});

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

  // TypeLess 錄音指示器頁面
  if (page === 'typeless-indicator') {
    return (
      <React.Suspense fallback={<div className="w-full h-full" />}>
        <TypelessIndicator />
      </React.Suspense>
    );
  }

  const [isHovered, setIsHovered] = useState(false);
  const [originalText, setOriginalText] = useState("");
  const [processedText, setProcessedText] = useState("");
  const [showTextArea, setShowTextArea] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true); // 視窗置頂狀態
  const [aiOptimizationEnabled, setAiOptimizationEnabled] = useState(false); // AI 優化狀態

  // 錄音完成後動作設定
  const [pasteAfterTranscription, setPasteAfterTranscription] = useState(true);
  const [autoEnterAfterPaste, setAutoEnterAfterPaste] = useState(false);

  // 點擊錄音流程：等待使用者點擊目標位置
  const [waitingForTarget, setWaitingForTarget] = useState(false);

  // i18n
  const { t, language, convert } = useTranslation();

  // 加载通知设置和貼上相關設定
  useEffect(() => {
    const loadSettings = async () => {
      if (window.electronAPI) {
        const enabled = await window.electronAPI.getSetting('enable_notifications', true);
        setNotificationsEnabled(enabled !== false);

        // 載入貼上相關設定
        const paste = await window.electronAPI.getSetting('paste_after_transcription', true);
        setPasteAfterTranscription(paste !== false);

        const autoEnter = await window.electronAPI.getSetting('auto_enter_after_paste', false);
        setAutoEnterAfterPaste(autoEnter === true);

        // 載入置頂狀態
        const alwaysOnTop = await window.electronAPI.getSetting('window_always_on_top', true);
        setIsAlwaysOnTop(alwaysOnTop !== false);

        // 載入 AI 優化狀態
        const aiEnabled = await window.electronAPI.getSetting('enable_ai_optimization', false);
        setAiOptimizationEnabled(aiEnabled === true);
      }
    };
    loadSettings();

    // 监听设置变化（跨視窗同步）
    if (window.electronAPI?.onSettingChanged) {
      const unsubscribe = window.electronAPI.onSettingChanged((data) => {
        if (data.key === 'enable_notifications') {
          setNotificationsEnabled(data.value !== false);
        } else if (data.key === 'paste_after_transcription') {
          setPasteAfterTranscription(data.value !== false);
        } else if (data.key === 'auto_enter_after_paste') {
          setAutoEnterAfterPaste(data.value === true);
        } else if (data.key === 'window_always_on_top') {
          setIsAlwaysOnTop(data.value !== false);
        } else if (data.key === 'enable_ai_optimization') {
          setAiOptimizationEnabled(data.value === true);
        }
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, []);

  // 条件性显示通知的辅助函数
  const showNotification = useCallback((type, message, options) => {
    if (!notificationsEnabled && type !== 'error') return;
    toast[type](message, options);
  }, [notificationsEnabled]);
  
  const { isDragging, handleMouseDown, handleMouseMove, handleMouseUp, handleClick } = useWindowDrag();
  const modelStatus = useModelStatus();
  
  // 傳統錄音模式
  const {
    isRecording: isRecordingNormal,
    isProcessing: isRecordingProcessingNormal,
    isOptimizing,
    startRecording: startRecordingNormal,
    stopRecording: stopRecordingNormal,
    cancelRecording: cancelRecordingNormal,
    error: recordingErrorNormal
  } = useRecording();

  // 串流錄音模式
  const {
    isRecording: isRecordingStreaming,
    isProcessing: isProcessingStreaming,
    isInitializing: isInitializingStreaming,
    error: streamingError,
    partialText,
    fullText,
    startStreaming,
    stopStreaming,
    cancelStreaming
  } = useStreamingRecording();

  // 串流模式設定
  const [streamingMode, setStreamingMode] = useState(false);

  // TypeLess 模式（按住錄音）
  const [typelessMode, setTypelessMode] = useState(false);

  // 載入串流模式設定
  useEffect(() => {
    const loadStreamingMode = async () => {
      if (window.electronAPI) {
        const enabled = await window.electronAPI.getSetting('enable_streaming_mode', false);
        setStreamingMode(enabled);
      }
    };
    loadStreamingMode();

    // 監聽設定變更事件（跨視窗同步）
    if (window.electronAPI?.onSettingChanged) {
      const unsubscribe = window.electronAPI.onSettingChanged((data) => {
        if (data.key === 'enable_streaming_mode') {
          setStreamingMode(data.value);
          console.log('串流模式已更新:', data.value);
        }
      });
      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, []);

  // 啟用 TypeLess 模式（右 Alt 已是唯一錄音方式，固定一律啟用，不再受設定開關控制）
  useEffect(() => {
    const enableTypeless = async () => {
      if (window.electronAPI) {
        setTypelessMode(true);
        // 觸發鍵由主進程固定為右 Alt（setRightAltToggle），這裡傳入值會被忽略
        await window.electronAPI.enableTypelessMode('AltRight');
      }
    };
    enableTypeless();
  }, []);

  // 統一的錄音狀態（根據模式選擇）
  const isRecording = streamingMode ? isRecordingStreaming : isRecordingNormal;
  const isRecordingProcessing = streamingMode ? isProcessingStreaming : isRecordingProcessingNormal;
  const recordingError = streamingMode ? streamingError : recordingErrorNormal;

  // 統一的錄音函數
  const startRecording = useCallback(() => {
    if (streamingMode) {
      startStreaming();
    } else {
      startRecordingNormal();
    }
  }, [streamingMode, startStreaming, startRecordingNormal]);

  const stopRecording = useCallback(() => {
    if (streamingMode) {
      stopStreaming();
    } else {
      stopRecordingNormal();
    }
  }, [streamingMode, stopStreaming, stopRecordingNormal]);

  const {
    processText,
    isProcessing: isTextProcessing,
    error: textProcessingError
  } = useTextProcessing();

  // 防重复粘贴的引用
  const lastPasteRef = useRef({ text: '', timestamp: 0 });
  const PASTE_DEBOUNCE_TIME = 1000; // 1秒内相同文本不重复粘贴

  // 安全粘贴函数（根據設定決定是否貼上和送出 Enter）
  const safePaste = useCallback(async (text) => {
    const now = Date.now();
    const lastPaste = lastPasteRef.current;

    // 防重复粘贴：如果是相同文本且在防抖时间内，则跳过
    if (lastPaste.text === text && (now - lastPaste.timestamp) < PASTE_DEBOUNCE_TIME) {
      return;
    }

    // 更新最后粘贴记录
    lastPasteRef.current = { text, timestamp: now };

    try {
      if (window.electronAPI) {
        // 永遠自動貼上：交由主進程處理剪貼簿（保存原本 → 寫入辨識文字 → 貼上 → 還原原本）
        // 不在前端先寫剪貼簿，否則主進程會把「辨識文字」誤當成原本內容
        await window.electronAPI.pasteText(text);

        // 如果啟用完全信任模式，貼上後自動發送 Enter
        if (autoEnterAfterPaste) {
          await new Promise(resolve => setTimeout(resolve, 100));
          await window.electronAPI.sendEnter();
        }
      } else {
        // 沒有 electronAPI（理論上不會發生）：退而求其次寫入剪貼簿
        try {
          await navigator.clipboard.writeText(text);
        } catch (clipErr) {
          /* ignore */
        }
      }

      // 不需要成功通知，文字已經貼上了使用者自然知道
    } catch (error) {
      // 失敗時才需要通知
      showNotification('error', t('notifications.pasteFailed'), {
        description: t('notifications.pasteFailedDesc')
      });
    }
  }, [showNotification, t, pasteAfterTranscription, autoEnterAfterPaste]);

  // 处理录音完成（Sherpa 识别完成）
  const handleRecordingComplete = useCallback(async (transcriptionResult) => {
    const text = transcriptionResult?.text;
    if (text) {
      // 立即显示 Sherpa 识别的原始文本
      setOriginalText(text);
      setShowTextArea(true);

      // 清空之前的处理结果，等待AI优化
      setProcessedText("");

      // 如果是串流模式，直接貼上（不經過 AI 優化）
      if (transcriptionResult?.streaming) {
        await safePaste(text);
      }

      // 不需要成功通知，文字出來就知道成功了
    }
  }, [safePaste]);

  // 处理AI优化完成
  const handleAIOptimizationComplete = useCallback(async (optimizedResult) => {
    if (optimizedResult.success && optimizedResult.enhanced_by_ai && optimizedResult.text) {
      // 显示AI优化后的文本
      setProcessedText(optimizedResult.text);

      // 自动粘贴AI优化后的文本
      await safePaste(optimizedResult.text);

      // 不需要成功通知，文字出來就知道成功了
    } else {
      // AI优化未启用或失败，使用 optimizedResult.text（即原始文本）
      const textToPaste = optimizedResult.text;
      if (textToPaste) {
        await safePaste(textToPaste);
      }
    }
  }, [safePaste]);

  // 设置转录完成回调
  useEffect(() => {
    window.onTranscriptionComplete = handleRecordingComplete;
    window.onAIOptimizationComplete = handleAIOptimizationComplete;

    return () => {
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
      // 顯示聲聲慢視窗
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
      return;
    }

    const initializeHotkey = async () => {
      try {
        // 初始化自定義快捷鍵系統
        if (window.electronAPI?.initCustomHotkeys) {
          const result = await window.electronAPI.initCustomHotkeys();
          if (result.success) {
            console.log('自定義快捷鍵初始化成功:', result.hotkeys);
          }
        } else {
          // 後備：使用舊的單一熱鍵註冊
          await registerHotkey('CommandOrControl+Shift+Space');
        }
      } catch (error) {
        // 热键注册失败时静默处理
        console.warn('快捷鍵初始化失敗:', error);
      }
    };

    initializeHotkey();
  }, [registerHotkey]);

  // 处理关闭窗口
  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.hideWindow();
    }
  };

  // 切換視窗置頂狀態
  const handleToggleAlwaysOnTop = async () => {
    if (window.electronAPI) {
      const newValue = !isAlwaysOnTop;
      setIsAlwaysOnTop(newValue);
      await window.electronAPI.setAlwaysOnTop(newValue);
      toast.success(newValue ? '視窗置頂已開啟' : '視窗置頂已關閉');
    }
  };

  // 縮小視窗
  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimizeWindow();
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

  // 處理取消錄音：丟棄音訊，不轉錄、不貼上（而非 stopRecording 會處理結果）
  const handleCancelRecording = useCallback(() => {
    if (isRecordingNormal) {
      cancelRecordingNormal();
      showNotification('info', '錄音已取消');
    } else if (streamingMode) {
      cancelStreaming();
      showNotification('info', '錄音已取消');
    }
  }, [isRecordingNormal, cancelRecordingNormal, streamingMode, cancelStreaming, showNotification]);

  // 處理複製上次結果
  const handleCopyLastResult = useCallback(async () => {
    if (processedText) {
      try {
        await navigator.clipboard.writeText(processedText);
        showNotification('success', '已複製上次結果');
      } catch (err) {
        if (window.electronAPI) {
          await window.electronAPI.copyText(processedText);
          showNotification('success', '已複製上次結果');
        }
      }
    } else if (originalText) {
      try {
        await navigator.clipboard.writeText(originalText);
        showNotification('success', '已複製原始文字');
      } catch (err) {
        if (window.electronAPI) {
          await window.electronAPI.copyText(originalText);
          showNotification('success', '已複製原始文字');
        }
      }
    } else {
      showNotification('warning', '沒有可複製的結果');
    }
  }, [processedText, originalText, showNotification]);

  // 监听全局热键触发事件
  useEffect(() => {
    if (window.electronAPI) {
      // 監聽新的快捷鍵操作事件
      const unsubscribeAction = window.electronAPI.onHotkeyAction?.((event, data) => {
        const { actionId } = data;
        switch (actionId) {
          case 'toggle-recording':
            toggleRecording();
            break;
          case 'cancel-recording':
            handleCancelRecording();
            break;
          case 'copy-last':
            handleCopyLastResult();
            break;
          default:
            console.warn('未知的快捷鍵操作:', actionId);
        }
      });

      // 监听传统热键触发（兼容舊系統）
      const unsubscribeHotkey = window.electronAPI.onHotkeyTriggered(() => {
        toggleRecording();
      });

      // 监听旧的toggle事件（保持兼容性）
      const unsubscribeToggle = window.electronAPI.onToggleDictation(() => {
        toggleRecording();
      });

      return () => {
        if (unsubscribeAction) unsubscribeAction();
        if (unsubscribeHotkey) unsubscribeHotkey();
        if (unsubscribeToggle) unsubscribeToggle();
      };
    }
  }, [toggleRecording, handleCancelRecording, handleCopyLastResult]);

  // TypeLess 模式事件監聽（按住錄音）
  useEffect(() => {
    if (!window.electronAPI || !typelessMode) return;

    // 監聽 TypeLess 開始錄音事件
    // Typeless 一律使用離線辨識路徑（startRecordingNormal），不受串流模式影響，
    // 因此即使串流模型未下載/串流模式開啟，按住說話依然可用。
    const unsubscribeStart = window.electronAPI.onTypelessStartRecording?.(() => {
      console.log('TypeLess: 收到開始錄音事件');
      if (!isRecordingNormal && !isRecordingProcessingNormal && modelStatus.isReady) {
        startRecordingNormal();
      }
    });

    // 監聽 TypeLess 停止錄音事件
    const unsubscribeStop = window.electronAPI.onTypelessStopRecording?.(() => {
      console.log('TypeLess: 收到停止錄音事件');
      if (isRecordingNormal) {
        stopRecordingNormal();
      }
    });

    // 監聽 TypeLess 取消錄音事件（錄音中按 Esc）：丟棄音訊，不轉錄、不貼上
    const unsubscribeCancel = window.electronAPI.onTypelessCancelRecording?.(() => {
      console.log('TypeLess: 收到取消錄音事件 (Esc)');
      if (isRecordingNormal) {
        cancelRecordingNormal();
        showNotification('info', '錄音已取消');
      }
    });

    return () => {
      if (unsubscribeStart) unsubscribeStart();
      if (unsubscribeStop) unsubscribeStop();
      if (unsubscribeCancel) unsubscribeCancel();
    };
  }, [typelessMode, isRecordingNormal, isRecordingProcessingNormal, modelStatus.isReady, startRecordingNormal, stopRecordingNormal, cancelRecordingNormal, showNotification]);

  // 同步录音状态到热键管理器
  useEffect(() => {
    if (syncRecordingState) {
      syncRecordingState(isRecording);
    }
    // 同步真實錄音狀態給 TypeLess，避免「右 Alt 切換」與「滑鼠點麥克風」打架
    if (window.electronAPI?.syncTypelessState) {
      window.electronAPI.syncTypelessState(isRecording);
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
    // 串流模式初始化中
    if (streamingMode && isInitializingStreaming) return "initializing";
    if (isRecording) return "recording";
    if (isRecordingProcessing) return "processing";
    if (isOptimizing) return "optimizing";
    if (isHovered && !isRecording && !isRecordingProcessing && !isOptimizing && !isInitializingStreaming) return "hover";
    return "idle";
  };

  const micState = getMicState();
  const isListening = isRecording || isRecordingProcessing;

  // 隨機處理中訊息（processing 和 optimizing 都用同一組）
  const processingMessage = useRandomMessage(
    micState === "processing" || micState === "optimizing",
    PROCESSING_MESSAGES
  );

  // 获取麦克风按钮属性
  const getMicButtonProps = () => {
    const baseClasses =
      "rounded-full w-16 h-16 flex items-center justify-center relative overflow-hidden border-2 mic-button-transition shadow-xl mic-button-ripple";

    // 串流模式用琥珀色邊框，一般模式用白色邊框
    const borderColor = streamingMode ? "border-amber-400" : "border-white/80";

    // 统一的按钮样式
    const buttonStyle = `${baseClasses} ${borderColor} bg-gradient-to-br from-slate-100 to-slate-200 dark:from-gray-700 dark:to-gray-600 hover:from-slate-200 hover:to-slate-300 dark:hover:from-gray-600 dark:hover:to-gray-500 hover:shadow-2xl transform hover:scale-105`;

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
          tooltip: streamingMode ? `開始即時辨識 (${hotkey})` : t('app.startRecording', { hotkey }),
          disabled: false
        };
      case "hover":
        return {
          className: `${buttonStyle} scale-105 shadow-2xl cursor-pointer`,
          tooltip: streamingMode ? `開始即時辨識 (${hotkey})` : t('app.startRecording', { hotkey }),
          disabled: false
        };
      case "initializing":
        return {
          className: `${buttonStyle} processing-shimmer cursor-not-allowed opacity-80`,
          tooltip: '串流啟動中...',
          disabled: true
        };
      case "recording":
        return {
          className: `${buttonStyle} recording-pulse recording-glow cursor-pointer ${streamingMode ? 'streaming-ring' : ''}`,
          tooltip: t('app.recording'),
          disabled: false
        };
      case "processing":
        return {
          className: `${buttonStyle} processing-shimmer cursor-not-allowed opacity-80`,
          tooltip: t('app.processing'),
          disabled: true
        };
      case "optimizing":
        return {
          className: `${buttonStyle} processing-shimmer cursor-not-allowed opacity-80`,
          tooltip: t('app.optimizing'),
          disabled: true
        };
      default:
        return {
          className: `${buttonStyle} cursor-pointer`,
          tooltip: streamingMode ? `開始即時辨識 (${hotkey})` : t('app.clickToRecord', { hotkey }),
          disabled: false
        };
    }
  };

  const micProps = getMicButtonProps();

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4 pt-4 pb-2 rounded-3xl overflow-hidden flex flex-col border border-gray-200/80 dark:border-gray-700/60 shadow-2xl">
      {/* 主界面 */}
      <div className="w-full max-w-2xl mx-auto flex-1 min-h-0 flex flex-col">
        {/* 标题栏 */}
        <div
          className="flex flex-col mb-5 draggable"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 chinese-title">
              {t('appName')}
            </h1>
          <div className="flex items-center space-x-2 non-draggable">
            <Tooltip content={t('app.settings')} position="bottom">
              <button
                onClick={handleOpenSettings}
                className="p-2.5 hover:bg-white/70 dark:hover:bg-gray-700/70 rounded-xl transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </Tooltip>
            <Tooltip content={isAlwaysOnTop ? '取消置頂' : '視窗置頂'} position="bottom">
              <button
                onClick={handleToggleAlwaysOnTop}
                className={`p-2.5 rounded-xl transition-colors ${
                  isAlwaysOnTop
                    ? 'bg-blue-100 dark:bg-blue-900/50 hover:bg-blue-200 dark:hover:bg-blue-800/50'
                    : 'hover:bg-white/70 dark:hover:bg-gray-700/70'
                }`}
              >
                <Pin className={`w-5 h-5 ${
                  isAlwaysOnTop
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-600 dark:text-gray-400'
                }`} />
              </button>
            </Tooltip>
            <Tooltip content="縮小" position="bottom">
              <button
                onClick={handleMinimize}
                className="p-2.5 hover:bg-white/70 dark:hover:bg-gray-700/70 rounded-xl transition-colors"
              >
                <Minus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </Tooltip>
            <Tooltip content={t('app.close') || '關閉'} position="bottom">
              <button
                onClick={handleClose}
                className="p-2.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400 hover:text-red-500" />
              </button>
            </Tooltip>
          </div>
          </div>
          {/* AI 優化狀態指示器 - 標題下方 */}
          {aiOptimizationEnabled && (
            <div className="mt-2">
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 rounded-full">
                <Sparkles className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                <span className="text-xs font-medium text-purple-600 dark:text-purple-300">AI 優化已啟用</span>
              </div>
            </div>
          )}
        </div>

        {/* 录音控制区域 */}
        <div className="text-center mb-5 flex-shrink-0">
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
              className={`${micProps.className} non-draggable shadow-lg ${
                streamingMode && isRecording ? 'streaming-recording-pulse' : ''
              }`}
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
              ) : micState === "initializing" ? (
                <LoadingIndicator size={20} />
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
            ) : micState === "initializing" ? (
              '串流啟動中...'
            ) : micState === "recording" ? (
              streamingMode ? '串流辨識中...' : t('app.recording')
            ) : (micState === "processing" || micState === "optimizing") ? (
              processingMessage || t('app.processing')
            ) : streamingMode ? (
              `點擊開始即時辨識 (${hotkey})`
            ) : (
              t('app.clickToRecord', { hotkey })
            )}
          </p>

          {/* 處理中/優化中/初始化中的小進度條 */}
          {(micState === "processing" || micState === "optimizing" || micState === "initializing") && (
            <ProcessingProgressBar />
          )}

          {/* 串流辨識即時文字顯示 */}
          {streamingMode && isRecording && (partialText || fullText) && (
            <div className="mt-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg max-h-32 overflow-y-auto">
              <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                {fullText}
                {partialText && (
                  <span className="text-blue-500 dark:text-blue-400 opacity-70">
                    {partialText}
                  </span>
                )}
              </p>
            </div>
          )}
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
        <div className="flex-1 min-h-0 text-area-scroll">
          <TextDisplay
            originalText={originalText}
            processedText={processedText}
            onCopy={handleCopyText}
            t={t}
          />
        </div>

        {/* 底部置中標記（貼底）*/}
        <div className="text-center pt-1.5 flex-shrink-0 select-none">
          <span className="text-[11px] tracking-wide text-gray-400 dark:text-gray-600">
            聲聲慢 · by 切版職人
          </span>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

    </div>
  );
}