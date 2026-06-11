import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { toast, Toaster } from "sonner";
import { Settings, Save, Eye, EyeOff, X, Loader2, TestTube, CheckCircle, XCircle, Mic, Shield, Globe, Keyboard, Sparkles, BookText, Tag, History, Info, Heart } from "lucide-react";
import { usePermissions } from "./hooks/usePermissions";
import PermissionCard from "./components/ui/permission-card";
import HotkeySettings from "./components/HotkeySettings";
import HotwordsManager from "./components/HotwordsManager";
import DictionaryManager from "./components/DictionaryManager";
import HistoryView from "./components/HistoryView";
import { useTranslation, LanguageProvider } from "./i18n";

// 設定面板左側分頁（依重要性排序）
const SETTINGS_TABS = [
  { id: 'general', label: '一般設定', icon: Settings },
  { id: 'history', label: '歷史紀錄', icon: History },
  { id: 'ai', label: 'AI 文字優化', icon: Sparkles },
  { id: 'hotkeys', label: '快捷鍵', icon: Keyboard },
  { id: 'hotwords', label: '熱詞', icon: Tag },
  { id: 'dictionary', label: '字典', icon: BookText },
  { id: 'permissions', label: '權限管理', icon: Shield },
  { id: 'about', label: '關於', icon: Info },
];

const SettingsPage = () => {
  const { t, language, setLanguage, languages } = useTranslation();
  const [activeTab, setActiveTab] = useState('general');

  const [settings, setSettings] = useState({
    ai_api_key: "",
    ai_base_url: "https://api.openai.com/v1",
    ai_model: "gpt-3.5-turbo",
    enable_ai_optimization: false,
    enable_notifications: true,
    enable_streaming_mode: false,
    language: "zh-TW",
    convert_transcription: true,
    // 錄音完成後動作設定（自動貼上已固定開啟，僅保留「自動送出 Enter」）
    auto_enter_after_paste: false,    // 貼上後自動送出（完全信任模式）
    // 視窗控制設定
    window_always_on_top: true,       // 視窗置頂
    minimize_to_tray: true,           // 縮小到系統托盤
    close_to_tray: true               // 關閉到系統托盤
  });
  
  const [customModel, setCustomModel] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // 权限管理
  const showAlert = (alert) => {
    toast(alert.title, {
      description: alert.description,
      duration: 4000,
    });
  };

  const {
    micPermissionGranted,
    accessibilityPermissionGranted,
    requestMicPermission,
    testAccessibilityPermission,
  } = usePermissions(showAlert);

  // 加载设置
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      if (window.electronAPI) {
        const allSettings = await window.electronAPI.getAllSettings();
        const loadedSettings = {
          ai_api_key: allSettings.ai_api_key || "",
          ai_base_url: allSettings.ai_base_url || "https://api.openai.com/v1",
          ai_model: allSettings.ai_model || "gpt-3.5-turbo",
          enable_ai_optimization: allSettings.enable_ai_optimization === true, // 默认为false
          enable_notifications: allSettings.enable_notifications !== false, // 默认为true
          enable_streaming_mode: allSettings.enable_streaming_mode === true, // 默認關閉
          language: allSettings.language || "zh-TW", // 默认繁体中文
          convert_transcription: allSettings.convert_transcription !== false, // 默认转换
          // 錄音完成後動作設定
          auto_enter_after_paste: allSettings.auto_enter_after_paste === true, // 默認不自動送出
          // 視窗控制設定
          window_always_on_top: allSettings.window_always_on_top !== false, // 默認置頂
          minimize_to_tray: allSettings.minimize_to_tray !== false, // 默認縮小到托盤
          close_to_tray: allSettings.close_to_tray !== false // 默認關閉到托盤
        };
        setSettings(prev => ({ ...prev, ...loadedSettings }));
        
        // 检查是否使用自定义模型
        const predefinedModels = ["deepseek-chat", "deepseek-reasoner", "gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini", "gemini-2.0-flash", "gemini-1.5-pro", "qwen2.5", "qwen2.5:3b", "llama3.2"];
        setCustomModel(!predefinedModels.includes(loadedSettings.ai_model));
      }
    } catch (error) {
      console.error("加载设置失败:", error);
      toast.error(t('settings.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  // 保存设置
  const saveSettings = async () => {
    try {
      setSaving(true);
      if (window.electronAPI) {
        // 保存每个设置项
        await window.electronAPI.setSetting('ai_api_key', settings.ai_api_key);
        await window.electronAPI.setSetting('ai_base_url', settings.ai_base_url);
        await window.electronAPI.setSetting('ai_model', settings.ai_model);
        await window.electronAPI.setSetting('enable_ai_optimization', settings.enable_ai_optimization);
        
        toast.success(t('settings.saveSuccess'));
      }
    } catch (error) {
      console.error("保存设置失败:", error);
      toast.error(t('settings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // 处理输入变化
  const handleInputChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // 处理开关切换并自动保存
  const handleToggleChange = async (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));

    // 立即保存开关状态
    try {
      if (window.electronAPI) {
        await window.electronAPI.setSetting(key, value);
        // 根据不同的设置项显示不同的提示
        if (key === 'enable_ai_optimization') {
          toast.success(value ? t('notifications.aiEnabled') : t('notifications.aiDisabled'));
        } else if (key === 'enable_notifications') {
          toast.success(value ? t('notifications.enabled') : t('notifications.disabled'));
        } else if (key === 'enable_streaming_mode') {
          toast.success(value ? '串流辨識模式已開啟' : '串流辨識模式已關閉');
          // 當啟用串流模式時，預載串流模型以減少首次錄音延遲
          if (value) {
            toast.info('正在預載串流模型，請稍候...');
            window.electronAPI.preloadStreamingModel()
              .then(result => {
                if (result.success) {
                  if (result.already_loaded) {
                    toast.success('串流模型已就緒');
                  } else {
                    toast.success('串流模型預載完成');
                  }
                } else {
                  toast.error(`串流模型預載失敗: ${result.error || '未知錯誤'}`);
                }
              })
              .catch(err => {
                console.error('預載串流模型失敗:', err);
                toast.error('串流模型預載失敗，首次錄音可能會較慢');
              });
          }
        } else if (key === 'window_always_on_top') {
          // 視窗置頂需要即時應用
          await window.electronAPI.setAlwaysOnTop(value);
          toast.success(value ? '視窗置頂已開啟' : '視窗置頂已關閉');
        } else if (key === 'minimize_to_tray') {
          toast.success(value ? '縮小到托盤已開啟' : '縮小到托盤已關閉');
        } else if (key === 'close_to_tray') {
          toast.success(value ? '關閉到托盤已開啟' : '關閉到托盤已關閉');
        }
        // 設定變更會透過 IPC 自動廣播到所有視窗
      }
    } catch (error) {
      console.error("保存设置失败:", error);
      toast.error(t('settings.saveFailed'));
    }
  };

  // Gemini（OpenAI 相容端點）
  const applyGeminiConfig = () => {
    setSettings(prev => ({
      ...prev,
      ai_base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
      ai_model: "gemini-2.0-flash"
    }));
    setCustomModel(true);
    toast.info(t('settings.configApplied', { provider: 'Gemini' }));
  };

  // Ollama（本地 LLM，免 API key、全離線）
  const applyOllamaConfig = () => {
    setSettings(prev => ({
      ...prev,
      ai_base_url: "http://localhost:11434/v1",
      ai_api_key: prev.ai_api_key || "ollama",
      ai_model: "qwen2.5"
    }));
    setCustomModel(true);
    toast.info(t('settings.configApplied', { provider: 'Ollama（本地）' }));
  };

  // 重置为OpenAI配置
  const resetToOpenAI = () => {
    setSettings(prev => ({
      ...prev,
      ai_base_url: "https://api.openai.com/v1",
      ai_model: "gpt-3.5-turbo"
    }));
    setCustomModel(false);
    toast.info(t('settings.configApplied', { provider: t('settings.openaiConfig') }));
  };

  // 应用DeepSeek配置
  const applyDeepSeekConfig = () => {
    setSettings(prev => ({
      ...prev,
      ai_base_url: "https://api.deepseek.com",
      ai_model: "deepseek-chat"
    }));
    setCustomModel(true);
    toast.info(t('settings.configApplied', { provider: 'DeepSeek' }));
  };

  // 测试AI配置
  const testAIConfiguration = async () => {
    try {
      setTesting(true);
      setTestResult(null);
      
      // 验证当前输入的配置
      if (!settings.ai_api_key.trim()) {
        setTestResult({
          available: false,
          error: t('settings.configIncompleteDesc'),
          details: t('settings.configIncompleteDesc')
        });
        toast.error(t('settings.configIncomplete'), {
          description: t('settings.configIncompleteDesc')
        });
        return;
      }
      
      if (window.electronAPI) {
        // 使用当前页面的配置进行测试，而不是已保存的配置
        const testConfig = {
          ai_api_key: settings.ai_api_key.trim(),
          ai_base_url: settings.ai_base_url.trim() || 'https://api.openai.com/v1',
          ai_model: settings.ai_model.trim() || 'gpt-3.5-turbo'
        };
        
        const result = await window.electronAPI.checkAIStatus(testConfig);
        setTestResult(result);
        
        if (result.available) {
          toast.success(t('settings.testSuccess'), {
            description: t('settings.testSuccessDesc', { model: result.model || '?' })
          });
        } else {
          toast.error(t('settings.testFailed'), {
            description: result.error || t('settings.testFailedDesc')
          });
        }
      }
    } catch (error) {
      console.error("测试AI配置失败:", error);
      setTestResult({
        available: false,
        error: error.message || t('settings.testFailed')
      });
      toast.error(t('settings.testFailed'), {
        description: error.message || t('settings.testFailedDesc')
      });
    } finally {
      setTesting(false);
    }
  };

  // 关闭窗口
  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.hideSettingsWindow();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="flex items-center space-x-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-gray-700 dark:text-gray-300">{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      {/* 标题栏 - 固定（可拖曳，取代原生標題列）*/}
      <div className="draggable bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Settings className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 chinese-title">{t('settings.title')}</h1>
          </div>
          <button
            onClick={handleClose}
            className="non-draggable p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* 主要內容：左側分頁 + 右側內容 */}
      <div className="flex-1 flex min-h-0">
        {/* 側邊欄分頁 */}
        <nav className="w-44 flex-shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-gray-800/40 py-3">
          {SETTINGS_TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-r-2 border-blue-500 font-medium'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* 內容區 - 可滾動 */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-2xl mx-auto p-6 pb-8">
            {activeTab === 'permissions' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 chinese-title">
                  {t('settings.permissions')}
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {t('settings.permissionsDesc')}
                </p>
              </div>

              <div className="space-y-2">
                <PermissionCard
                  icon={Mic}
                  title={t('settings.micPermission')}
                  description={t('settings.micPermissionDesc')}
                  granted={micPermissionGranted}
                  onRequest={requestMicPermission}
                  buttonText={t('settings.testMic')}
                />

                <PermissionCard
                  icon={Shield}
                  title={t('settings.accessibilityPermission')}
                  description={t('settings.accessibilityPermissionDesc')}
                  granted={accessibilityPermissionGranted}
                  onRequest={testAccessibilityPermission}
                  buttonText={t('settings.testPermission')}
                />
              </div>
            </div>
          </div>

            )}

            {activeTab === 'general' && (<>
          {/* 一般设置部分 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 chinese-title">
                  {t('settings.generalSettings')}
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {t('settings.generalDescription')}
                </p>
              </div>

              <div className="space-y-4">
                {/* 语言选择 */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      {t('settings.language')}
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t('settings.languageDesc')}
                    </p>
                  </div>
                  <select
                    value={settings.language}
                    onChange={async (e) => {
                      const newLang = e.target.value;
                      handleInputChange('language', newLang);
                      await setLanguage(newLang);
                      if (window.electronAPI) {
                        await window.electronAPI.setSetting('language', newLang);
                      }
                      window.dispatchEvent(new Event('language-changed'));
                      // 使用新語言顯示通知，避免異步狀態更新導致顯示舊語言
                      const message = newLang === 'zh-TW' ? '語言已切換' : '语言已切换';
                      toast.success(message);
                    }}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="zh-TW">繁體中文</option>
                    <option value="zh-CN">简体中文</option>
                  </select>
                </div>

                {/* 转换识别结果 */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {t('settings.convertTranscription')}
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t('settings.convertTranscriptionDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.convert_transcription}
                    onClick={() => handleToggleChange('convert_transcription', !settings.convert_transcription)}
                    className={`${
                      settings.convert_transcription ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    } relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${
                        settings.convert_transcription ? 'translate-x-4' : 'translate-x-0'
                      } inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>

                {/* 通知开关 */}
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="notifications-toggle" className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      {t('settings.notifications')}
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {t('settings.notificationsDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.enable_notifications}
                    onClick={() => handleToggleChange('enable_notifications', !settings.enable_notifications)}
                    className={`${
                      settings.enable_notifications ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    } relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${
                        settings.enable_notifications ? 'translate-x-4' : 'translate-x-0'
                      } inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>

                {/* 串流辨識模式開關 */}
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="streaming-toggle" className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      串流辨識模式
                    </label>
                    <p className="text-xs text-orange-500 dark:text-orange-400 mt-0.5">
                      ⚠️ 實驗功能：CPU 模式下辨識較慢且準確度較低，建議使用傳統模式
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.enable_streaming_mode}
                    onClick={() => handleToggleChange('enable_streaming_mode', !settings.enable_streaming_mode)}
                    className={`${
                      settings.enable_streaming_mode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    } relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${
                        settings.enable_streaming_mode ? 'translate-x-4' : 'translate-x-0'
                      } inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>

              </div>
            </div>
          </div>

          {/* 視窗控制設定 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 chinese-title">
                  🪟 視窗控制
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  設定視窗置頂與系統托盤行為
                </p>
              </div>

              <div className="space-y-4">
                {/* 視窗置頂開關 */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      視窗置頂
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      讓應用程式視窗保持在其他視窗之上
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.window_always_on_top}
                    onClick={() => handleToggleChange('window_always_on_top', !settings.window_always_on_top)}
                    className={`${
                      settings.window_always_on_top ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    } relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${
                        settings.window_always_on_top ? 'translate-x-4' : 'translate-x-0'
                      } inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>

                {/* 縮小到托盤開關 */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      縮小到系統托盤
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      縮小視窗時隱藏到系統托盤
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.minimize_to_tray}
                    onClick={() => handleToggleChange('minimize_to_tray', !settings.minimize_to_tray)}
                    className={`${
                      settings.minimize_to_tray ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    } relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${
                        settings.minimize_to_tray ? 'translate-x-4' : 'translate-x-0'
                      } inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>

                {/* 關閉到托盤開關 */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      關閉到系統托盤
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      關閉視窗時隱藏到托盤而非退出應用程式
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.close_to_tray}
                    onClick={() => handleToggleChange('close_to_tray', !settings.close_to_tray)}
                    className={`${
                      settings.close_to_tray ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    } relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${
                        settings.close_to_tray ? 'translate-x-4' : 'translate-x-0'
                      } inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 錄音完成後動作設定 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 chinese-title">
                  📋 錄音完成後動作
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  設定辨識完成後要自動執行的動作
                </p>
              </div>

              <div className="space-y-4">
                {/* 自動貼上：已固定開啟（不再提供開關，避免關掉後 TypeLess 失效） */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      自動貼上辨識結果
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      辨識完成後自動貼到目前游標位置，並還原你原本的剪貼簿內容
                    </p>
                  </div>
                  <span className="text-xs font-medium text-green-600 dark:text-green-400 whitespace-nowrap">永遠開啟</span>
                </div>

                {/* 貼上後自動送出開關（完全信任模式） */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      貼上後自動送出 (Enter)
                    </label>
                    <p className="text-xs text-orange-500 dark:text-orange-400 mt-0.5">
                      ⚠️ 完全信任模式：貼上後自動按 Enter 送出，適用於即時通訊軟體
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.auto_enter_after_paste}
                    onClick={() => handleToggleChange('auto_enter_after_paste', !settings.auto_enter_after_paste)}
                    className={`${
                      settings.auto_enter_after_paste ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                    } cursor-pointer relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${
                        settings.auto_enter_after_paste ? 'translate-x-4' : 'translate-x-0'
                      } inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

            </>)}

            {activeTab === 'history' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-5 h-[calc(100vh-7rem)]">
              <HistoryView />
            </div>
          </div>
            )}

            {activeTab === 'hotkeys' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-6">
              <HotkeySettings />
            </div>
          </div>

            )}

            {activeTab === 'hotwords' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-6">
              <HotwordsManager t={t} />
            </div>
          </div>

            )}

            {activeTab === 'dictionary' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-6">
              <DictionaryManager t={t} />
            </div>
          </div>

            )}

            {activeTab === 'ai' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 chinese-title">
                  {t('settings.aiConfig')}
                </h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                 {t('settings.aiConfigDesc')}
               </p>
              </div>

             <div className="space-y-4">
               {/* AI优化开关 */}
               <div className="flex items-center justify-between pt-4">
                 <label htmlFor="ai-optimization-toggle" className="text-sm font-medium text-gray-800 dark:text-gray-200">
                   {t('settings.enableAI')}
                 </label>
                 <button
                   type="button"
                   role="switch"
                   aria-checked={settings.enable_ai_optimization}
                   onClick={() => handleToggleChange('enable_ai_optimization', !settings.enable_ai_optimization)}
                   className={`${
                     settings.enable_ai_optimization ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                   } relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                 >
                   <span
                     aria-hidden="true"
                     className={`${
                       settings.enable_ai_optimization ? 'translate-x-4' : 'translate-x-0'
                     } inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                   />
                 </button>
               </div>

               {/* API Key */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.apiKey')} *
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? "text" : "password"}
                      value={settings.ai_api_key}
                      onChange={(e) => handleInputChange('ai_api_key', e.target.value)}
                      placeholder={t('settings.apiKeyPlaceholder')}
                      className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.apiKeyDesc')}
                  </p>
                </div>

                {/* Base URL */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('settings.baseUrl')}
                  </label>
                  <input
                    type="url"
                    value={settings.ai_base_url}
                    onChange={(e) => handleInputChange('ai_base_url', e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.baseUrlDesc')}
                  </p>
                </div>

                {/* Model */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                      {t('settings.aiModel')}
                    </label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={applyDeepSeekConfig}
                        className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 rounded hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                      >
                        DeepSeek
                      </button>
                      <button
                        type="button"
                        onClick={applyGeminiConfig}
                        className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                      >
                        Gemini
                      </button>
                      <button
                        type="button"
                        onClick={resetToOpenAI}
                        className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        OpenAI
                      </button>
                      <button
                        type="button"
                        onClick={applyOllamaConfig}
                        className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        Ollama（本地）
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="predefined-model"
                        name="model-type"
                        checked={!customModel}
                        onChange={() => setCustomModel(false)}
                        className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="predefined-model" className="text-xs text-gray-700 dark:text-gray-300">
                        {t('settings.predefinedModel')}
                      </label>
                    </div>
                    
                    {!customModel && (
                      <select
                        value={settings.ai_model}
                        onChange={(e) => {
                          const model = e.target.value;
                          // 根據模型自動設定對應的 base URL
                          let baseUrl = settings.ai_base_url;
                          let providerName = '';

                          if (model.startsWith('deepseek')) {
                            baseUrl = 'https://api.deepseek.com';
                            providerName = 'DeepSeek';
                          } else if (model.startsWith('gpt')) {
                            baseUrl = 'https://api.openai.com/v1';
                            providerName = 'OpenAI';
                          } else if (model.startsWith('gemini')) {
                            baseUrl = 'https://generativelanguage.googleapis.com/v1beta/openai';
                            providerName = 'Gemini';
                          } else if (model.startsWith('qwen') || model.startsWith('llama') || model.startsWith('gemma')) {
                            baseUrl = 'http://localhost:11434/v1';
                            providerName = 'Ollama（本地）';
                          }

                          setSettings(prev => ({
                            ...prev,
                            ai_model: model,
                            ai_base_url: baseUrl
                          }));

                          if (providerName) {
                            toast.info(`已自動設定 ${providerName} API 端點`);
                          }
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <optgroup label="DeepSeek (推薦)">
                          <option value="deepseek-chat">DeepSeek Chat (最划算)</option>
                          <option value="deepseek-reasoner">DeepSeek Reasoner (R1)</option>
                        </optgroup>
                        <optgroup label="OpenAI">
                          <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                          <option value="gpt-4">GPT-4</option>
                          <option value="gpt-4-turbo">GPT-4 Turbo</option>
                          <option value="gpt-4o">GPT-4o</option>
                          <option value="gpt-4o-mini">GPT-4o Mini</option>
                        </optgroup>
                        <optgroup label="Gemini">
                          <option value="gemini-2.0-flash">Gemini 2.0 Flash (快、便宜)</option>
                          <option value="gemini-1.5-pro">Gemini 1.5 Pro (高品質)</option>
                        </optgroup>
                        <optgroup label="Ollama（本地、免費）">
                          <option value="qwen2.5">Qwen2.5 (中文推薦)</option>
                          <option value="qwen2.5:3b">Qwen2.5 3B (更快)</option>
                          <option value="llama3.2">Llama 3.2</option>
                        </optgroup>
                      </select>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="custom-model"
                        name="model-type"
                        checked={customModel}
                        onChange={() => setCustomModel(true)}
                        className="w-3 h-3 text-blue-600 border-gray-300 focus:ring-blue-500"
                      />
                      <label htmlFor="custom-model" className="text-xs text-gray-700 dark:text-gray-300">
                        {t('settings.customModel')}
                      </label>
                    </div>

                    {customModel && (
                      <input
                        type="text"
                        value={settings.ai_model}
                        onChange={(e) => handleInputChange('ai_model', e.target.value)}
                        placeholder={t('settings.customModelPlaceholder')}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      />
                    )}
                  </div>

                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.aiModelDesc')}
                  </p>
                </div>
              </div>

              {/* 测试结果显示 */}
              {testResult && (
                <div className={`mt-4 p-3 rounded-lg border ${
                  testResult.available
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
                }`}>
                  <div className="flex items-center space-x-2">
                    {testResult.available ? (
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                    <span className={`font-medium ${
                      testResult.available
                        ? 'text-green-800 dark:text-green-200'
                        : 'text-red-800 dark:text-red-200'
                    }`}>
                      {testResult.available ? t('settings.testSuccess') : t('settings.testFailed')}
                    </span>
                  </div>

                  {testResult.available && (
                    <div className="mt-2 space-y-1">
                      {testResult.model && (
                        <p className="text-xs text-green-700 dark:text-green-300">
                          {t('settings.testSuccessDesc', { model: testResult.model })}
                        </p>
                      )}
                      {testResult.details && (
                        <p className="text-xs text-green-700 dark:text-green-300">
                          {testResult.details}
                        </p>
                      )}
                      {testResult.response && (
                        <p className="text-xs text-green-700 dark:text-green-300">
                          AI: {testResult.response}
                        </p>
                      )}
                      {testResult.usage && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Token: {testResult.usage.total_tokens || 'N/A'}
                        </p>
                      )}
                    </div>
                  )}

                  {!testResult.available && (
                    <div className="mt-2 space-y-1">
                      {testResult.error && (
                        <p className="text-xs text-red-700 dark:text-red-300">
                          {t('common.error')}: {testResult.error}
                        </p>
                      )}
                      {testResult.details && (
                        <p className="text-xs text-red-600 dark:text-red-400">
                          {testResult.details}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* 操作按钮 */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col">
                  <button
                    onClick={testAIConfiguration}
                    disabled={testing}
                    className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {testing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <TestTube className="w-3 h-3" />
                    )}
                    <span>{testing ? t('settings.testing') : t('settings.testConfig')}</span>
                  </button>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.testConfigDesc')}
                  </p>
                </div>

                <button
                  onClick={saveSettings}
                  disabled={saving || !settings.ai_api_key}
                  className="flex items-center space-x-2 px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                  <span>{saving ? t('settings.saving') : t('settings.saveSettings')}</span>
                </button>
              </div>
            </div>
          </div>

            )}

            {activeTab === 'about' && (
            <div className="space-y-4 max-w-xl">
              {/* 專案 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5 text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 brand-title">
                  聲聲慢 <span className="text-base font-normal text-gray-400">SpeakSlow</span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">專為中文打造、最快的本地語音輸入 · 免費、隱私</p>
                <p className="text-[11px] text-gray-400 mt-2">v1.0.0 · Apache License 2.0</p>
              </div>

              {/* 作者 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">作者</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">由 <strong>切版職人</strong> 開發維護。</p>
                <a href="https://github.com/Jeffrey0117/speakslow" target="_blank" rel="noreferrer"
                   className="inline-block text-xs text-blue-500 hover:underline mt-2">
                  GitHub · Jeffrey0117/speakslow
                </a>
              </div>

              {/* 致謝 */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-5">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-red-400" /> 致謝
                </h3>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-2 leading-relaxed">
                  <li>• <a href="https://github.com/yan5xu/ququ" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">ququ (yan5xu)</a> — 原始專案，本專案在其基礎上改用 sherpa-onnx 引擎並重做 UI 與互動。</li>
                  <li>• <a href="https://github.com/k2-fsa/sherpa-onnx" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">sherpa-onnx (k2-fsa)</a> — 本地語音辨識引擎。</li>
                  <li>• <a href="https://wisprflow.ai/" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Wispr Flow</a> — 產品概念啟發。</li>
                </ul>
              </div>
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// 导出组件供App.jsx使用
export { SettingsPage };

// 如果是直接访问settings.html，则渲染应用
if (document.getElementById("settings-root")) {
  const root = ReactDOM.createRoot(document.getElementById("settings-root"));
  root.render(
    <LanguageProvider>
      <SettingsPage />
      <Toaster />
    </LanguageProvider>
  );
}