import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { toast, Toaster } from "sonner";
import { Settings, Save, Eye, EyeOff, X, Loader2, TestTube, CheckCircle, XCircle, Mic, Shield, Globe } from "lucide-react";
import { usePermissions } from "./hooks/usePermissions";
import PermissionCard from "./components/ui/permission-card";
import HotkeySettings from "./components/HotkeySettings";
import { useTranslation, LanguageProvider } from "./i18n";

const SettingsPage = () => {
  const { t, language, setLanguage, languages } = useTranslation();

  const [settings, setSettings] = useState({
    ai_api_key: "",
    ai_base_url: "https://api.openai.com/v1",
    ai_model: "gpt-3.5-turbo",
    enable_ai_optimization: false,
    enable_notifications: true,
    enable_streaming_mode: false,
    language: "zh-TW",
    convert_transcription: true,
    // 錄音完成後動作設定
    paste_after_transcription: true,  // 自動貼上辨識結果
    auto_enter_after_paste: false     // 貼上後自動送出（完全信任模式）
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
          language: allSettings.language || "zh-TW", // 默认繁体中文
          convert_transcription: allSettings.convert_transcription !== false, // 默认转换
          // 錄音完成後動作設定
          paste_after_transcription: allSettings.paste_after_transcription !== false, // 默認自動貼上
          auto_enter_after_paste: allSettings.auto_enter_after_paste === true // 默認不自動送出
        };
        setSettings(prev => ({ ...prev, ...loadedSettings }));
        
        // 检查是否使用自定义模型
        const predefinedModels = ["gpt-3.5-turbo", "gpt-4", "gpt-4-turbo", "gpt-4o", "gpt-4o-mini", "qwen3-30b-a3b-instruct-2507"];
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
        }
        // 設定變更會透過 IPC 自動廣播到所有視窗
      }
    } catch (error) {
      console.error("保存设置失败:", error);
      toast.error(t('settings.saveFailed'));
    }
  };

  // 应用推荐配置
  const applyRecommendedConfig = () => {
    setSettings(prev => ({
      ...prev,
      ai_base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      ai_model: "qwen3-30b-a3b-instruct-2507"
    }));
    setCustomModel(true);
    toast.info(t('settings.configApplied', { provider: t('settings.alibabaConfig') }));
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
      {/* 标题栏 - 固定 */}
      <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Settings className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100 chinese-title">{t('settings.title')}</h1>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      </div>

      {/* 主要内容 - 可滚动 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-2xl mx-auto p-6 pb-8">
          {/* 权限管理部分 */}
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
                {/* 自動貼上開關 */}
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-800 dark:text-gray-200">
                      自動貼上辨識結果
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      辨識完成後自動貼到游標位置
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings.paste_after_transcription}
                    onClick={() => {
                      const newValue = !settings.paste_after_transcription;
                      handleToggleChange('paste_after_transcription', newValue);
                      // 如果關閉自動貼上，也要關閉自動送出
                      if (!newValue && settings.auto_enter_after_paste) {
                        handleToggleChange('auto_enter_after_paste', false);
                      }
                    }}
                    className={`${
                      settings.paste_after_transcription ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    } relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
                  >
                    <span
                      aria-hidden="true"
                      className={`${
                        settings.paste_after_transcription ? 'translate-x-4' : 'translate-x-0'
                      } inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
                    />
                  </button>
                </div>

                {/* 貼上後自動送出開關（完全信任模式） */}
                <div className={`flex items-center justify-between ${!settings.paste_after_transcription ? 'opacity-50' : ''}`}>
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
                    disabled={!settings.paste_after_transcription}
                    onClick={() => handleToggleChange('auto_enter_after_paste', !settings.auto_enter_after_paste)}
                    className={`${
                      settings.auto_enter_after_paste ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                    } ${!settings.paste_after_transcription ? 'cursor-not-allowed' : 'cursor-pointer'} relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2`}
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

          {/* 快捷鍵設定部分 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div className="p-6">
              <HotkeySettings />
            </div>
          </div>

          {/* AI配置部分 */}
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
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={applyRecommendedConfig}
                        className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        {t('settings.aliRecommend')}
                      </button>
                      <button
                        type="button"
                        onClick={resetToOpenAI}
                        className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                      >
                        OpenAI
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
                        onChange={(e) => handleInputChange('ai_model', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      >
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-4-turbo">GPT-4 Turbo</option>
                        <option value="gpt-4o">GPT-4o</option>
                        <option value="gpt-4o-mini">GPT-4o Mini</option>
                        <option value="qwen3-30b-a3b-instruct-2507">Qwen3-30B (推荐)</option>
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

          {/* 关于部分 */}
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <div className="p-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 chinese-title mb-3">
                {t('settings.about')}
              </h2>
              <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 p-3 rounded-lg">
                <p className="text-xs text-gray-700 dark:text-gray-300 mb-1">
                  🎤 <strong>{t('appName')} (SpeakSlow)</strong> - {t('settings.aboutDesc')}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  • {t('settings.features.recognition')}<br/>
                  • {t('settings.features.ai')}<br/>
                  • {t('settings.features.realtime')}<br/>
                  • {t('settings.features.privacy')}
                </p>
              </div>
            </div>
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