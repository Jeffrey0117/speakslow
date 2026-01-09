// 繁體中文翻譯
export default {
  // 應用名稱
  appName: '蛐蛐',

  // 設定頁面
  settings: {
    title: '設定',
    generalSettings: '一般設定',
    generalDescription: '應用的基本設定選項。',
    notifications: '顯示通知',
    notificationsDesc: '控制是否顯示操作成功等提示通知',
    language: '介面語言',
    languageDesc: '選擇應用介面顯示的語言',
    convertTranscription: '轉換辨識結果',
    convertTranscriptionDesc: '將語音辨識結果轉換為當前語言',

    permissions: '權限管理',
    permissionsDesc: '測試和管理應用權限，確保麥克風和輔助功能正常運作。',
    micPermission: '麥克風權限',
    micPermissionDesc: '錄製語音所需的權限',
    testMic: '測試麥克風',
    accessibilityPermission: '輔助功能權限',
    accessibilityPermissionDesc: '自動貼上文字所需的權限',
    testPermission: '測試權限',

    aiConfig: 'AI設定',
    aiConfigDesc: '設定AI模型以優化和增強語音辨識結果。如果API Key無效或未填寫，優化功能將自動停用。',
    enableAI: '啟用AI文字優化',
    apiKey: 'API Key',
    apiKeyPlaceholder: '請輸入您的AI API Key',
    apiKeyDesc: '用於AI文字優化功能的API金鑰',
    baseUrl: 'API Base URL',
    baseUrlDesc: 'AI服務的API端點地址，支援OpenAI相容的API',
    aiModel: 'AI模型',
    aiModelDesc: '選擇用於文字優化的AI模型。推薦使用阿里雲Qwen3模型獲得更好的中文處理效果。',
    predefinedModel: '預設模型',
    customModel: '自訂模型',
    customModelPlaceholder: '輸入自訂模型名稱，如：qwen3-30b-a3b-instruct-2507',
    aliRecommend: '阿里雲推薦',
    openaiConfig: 'OpenAI配置',
    alibabaConfig: '阿里雲配置',
    configApplied: '已套用{provider}推薦配置',
    configIncomplete: '配置不完整',
    configIncompleteDesc: '請先輸入API金鑰',

    testConfig: '測試設定',
    testConfigDesc: '測試當前編輯的設定（無需儲存）',
    testing: '測試中...',
    testSuccess: 'AI設定測試成功',
    testSuccessDesc: '模型：{model}',
    testFailed: 'AI設定測試失敗',
    testFailedDesc: '未知錯誤',

    saveSettings: '儲存設定',
    saving: '儲存中...',
    saveSuccess: '設定儲存成功',
    saveFailed: '儲存設定失敗',
    loadFailed: '載入設定失敗',

    about: '關於蛐蛐',
    aboutDesc: '基於FunASR和AI的中文語音轉文字應用',
    features: {
      recognition: '高精度中文語音辨識',
      ai: 'AI智慧文字優化',
      realtime: '即時語音處理',
      privacy: '隱私保護設計'
    }
  },

  // 主介面
  app: {
    history: '歷史紀錄',
    settings: '設定',
    needDownload: '需要下載AI模型檔案才能開始使用',
    downloading: '正在下載模型檔案...',
    loading: '模型載入中，請稍候...',
    loadingSettings: '載入設定頁面...',
    modelError: '模型錯誤',
    modelNotReady: '模型未就緒，請稍候...',
    recording: '正在錄音，再次點擊停止',
    processing: '正在辨識語音...',
    optimizing: 'AI正在優化文字，請稍候...',
    clickToRecord: '點擊麥克風或按 {hotkey} 開始錄音',
    startRecording: '按 [{hotkey}] 開始錄音',

    aiOptimized: 'AI優化後',
    aiOptimizing: 'AI正在優化文字...',
    copyOriginal: '複製辨識文字',
    copyOptimized: '複製優化文字',
    paste: '貼上優化文字',
    export: '匯出文字'
  },

  // 歷史紀錄頁面
  history: {
    title: '歷史紀錄',
    search: '搜尋轉錄內容...',
    noRecords: '暫無轉錄歷史',
    noMatch: '沒有找到符合的紀錄',
    copyText: '複製文字',
    delete: '刪除',
    confirmDelete: '確認刪除',
    deleteSuccess: '已刪除紀錄',
    deleteFailed: '刪除紀錄失敗',
    loadFailed: '載入歷史紀錄失敗',
    aiOptimized: 'AI優化'
  },

  // 通知訊息
  notifications: {
    enabled: '已啟用通知',
    disabled: '已關閉通知',
    aiEnabled: '已啟用AI文字優化',
    aiDisabled: '已關閉AI文字優化',
    copied: '文字已複製到剪貼簿',
    copyFailed: '無法複製文字到剪貼簿: {error}',
    pasted: '文字已自動貼上到當前輸入框',
    pasteToClipboard: '文字已複製到剪貼簿，請手動貼上',
    pasteFailed: '貼上失敗',
    pasteFailedDesc: '請檢查輔助功能權限。文字已複製到剪貼簿 - 請手動使用 Cmd+V 貼上。',
    exported: '文字已匯出到檔案',
    exportFailed: '無法匯出文字檔案',
    transcriptionComplete: '語音辨識完成',
    aiComplete: 'AI文字優化完成',
    aiFailedUsedOriginal: '已貼上原始辨識文字',
    downloadStarted: '開始下載模型檔案...',
    downloadComplete: '模型下載完成，正在載入...',
    downloadFailed: '模型下載失敗: {error}',
    pleaseDownload: '請先下載AI模型檔案',
    modelDownloading: '模型正在下載中，請稍候...',
    modelLoading: '模型正在載入中，請稍候...',
    modelNotReady: '模型未就緒，請稍候...',
    languageChanged: '語言已切換'
  },

  // 語言選項
  languages: {
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文'
  },

  // 通用
  common: {
    confirm: '確認',
    cancel: '取消',
    close: '關閉',
    save: '儲存',
    delete: '刪除',
    edit: '編輯',
    loading: '載入中...',
    error: '錯誤',
    success: '成功',
    warning: '警告',
    info: '提示'
  }
};
