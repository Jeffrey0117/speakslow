// English translations
export default {
  // App name
  appName: 'SpeakSlow',

  // Settings page
  settings: {
    title: 'Settings',
    generalSettings: 'General',
    generalDescription: 'Basic options for the app.',
    notifications: 'Show Notifications',
    notificationsDesc: 'Control whether to show success and status notifications',
    language: 'Interface Language',
    languageDesc: 'Choose the language used for the app interface',
    convertTranscription: 'Convert Transcription',
    convertTranscriptionDesc: 'Convert speech recognition results to the current language',

    permissions: 'Permissions',
    permissionsDesc: 'Test and manage app permissions to make sure the microphone and accessibility features work properly.',
    micPermission: 'Microphone Permission',
    micPermissionDesc: 'Required for recording your voice',
    testMic: 'Test Microphone',
    accessibilityPermission: 'Accessibility Permission',
    accessibilityPermissionDesc: 'Required for pasting text automatically',
    testPermission: 'Test Permission',

    aiConfig: 'AI Settings',
    aiConfigDesc: 'Configure an AI model to refine and enhance speech recognition results. If the API key is invalid or missing, enhancement will be disabled automatically.',
    enableAI: 'Enable AI Text Enhancement',
    apiKey: 'API Key',
    apiKeyPlaceholder: 'Enter your AI API key',
    apiKeyDesc: 'API key used for AI text enhancement',
    baseUrl: 'API Base URL',
    baseUrlDesc: 'API endpoint for the AI service; OpenAI-compatible APIs are supported',
    aiModel: 'AI Model',
    aiModelDesc: 'Choose the AI model for text enhancement. Alibaba Cloud Qwen3 models are recommended for better Chinese results.',
    predefinedModel: 'Preset Model',
    customModel: 'Custom Model',
    customModelPlaceholder: 'Enter a custom model name, e.g. qwen3-30b-a3b-instruct-2507',
    aliRecommend: 'Alibaba Cloud Pick',
    openaiConfig: 'OpenAI Preset',
    alibabaConfig: 'Alibaba Cloud Preset',
    configApplied: 'Applied recommended {provider} configuration',
    configIncomplete: 'Incomplete Configuration',
    configIncompleteDesc: 'Please enter an API key first',

    testConfig: 'Test Settings',
    testConfigDesc: 'Test the settings you are editing (no need to save)',
    testing: 'Testing...',
    testSuccess: 'AI settings test passed',
    testSuccessDesc: 'Model: {model}',
    testFailed: 'AI settings test failed',
    testFailedDesc: 'Unknown error',

    saveSettings: 'Save Settings',
    saving: 'Saving...',
    saveSuccess: 'Settings saved',
    saveFailed: 'Failed to save settings',
    loadFailed: 'Failed to load settings',

    about: 'About SpeakSlow',
    aboutDesc: 'A Traditional Chinese speech-to-text app powered by Sherpa-ONNX and AI',
    features: {
      recognition: 'High-accuracy Chinese speech recognition',
      ai: 'AI-powered text enhancement',
      realtime: 'Real-time speech processing',
      privacy: 'Privacy-first design'
    },

    // Hotword settings
    hotwords: {
      title: 'Hotwords',
      description: 'Boost recognition accuracy for specific terms such as proper nouns, names, and company names',
      enable: 'Enable Hotwords',
      enableDesc: 'When enabled, hotwords take effect during recognition',
      enabled: 'Hotwords enabled',
      disabled: 'Hotwords disabled',
      list: 'Hotword List',
      empty: 'No hotwords added yet',
      emptyHint: 'Add frequently used proper nouns in the input below',
      placeholder: 'Enter a new term...',
      add: 'Add',
      remove: 'Remove',
      added: 'Hotword added',
      removed: 'Hotword removed',
      duplicate: 'This hotword already exists',
      tooShort: 'Hotwords must be at least 2 characters',
      tooLong: 'Hotwords should not exceed 10 characters',
      loadFailed: 'Failed to load hotword settings',
      addFailed: 'Failed to add hotword',
      removeFailed: 'Failed to remove hotword',
      score: 'Hotword Strength',
      scoreMild: 'Mild',
      scoreLow: 'Low',
      scoreMedium: 'Medium',
      scoreHigh: 'High',
      scoreStrong: 'Strong',
      warning: 'Too many hotwords may slow down recognition; keeping it under 50 is recommended',
      tipTitle: 'Tips',
      tipContent: 'Hotwords work best for proper nouns of 2-10 characters. Higher strength raises recognition priority but may cause false matches. Start with medium strength and adjust from there.'
    },
    dictionary: {
      title: 'Dictionary',
      description: 'Set up replacement rules to automatically correct proper nouns (names, places, terms) in recognition results',
      search: 'Search...',
      allCategories: 'All Categories',
      add: 'Add',
      import: 'Import',
      export: 'Export',
      edit: 'Edit Entry',
      addNew: 'New Entry',
      original: 'Original',
      replacement: 'Replace With',
      category: 'Category',
      actions: 'Actions',
      noMatch: 'No matching entries',
      empty: 'No dictionary entries yet. Click "Add" to create your first replacement rule',
      total: 'Total',
      items: ' entries',
      enabled: ' enabled'
    }
  },

  // Main interface
  app: {
    history: 'History',
    settings: 'Settings',
    copy: 'Copy',
    close: 'Close',
    minimize: 'Minimize',
    needDownload: 'AI model files must be downloaded before you can start',
    downloading: 'Downloading model files...',
    loading: 'Loading model, please wait...',
    loadingSettings: 'Loading settings page...',
    modelError: 'Model Error',
    modelNotReady: 'Model not ready, please wait...',
    recording: 'Recording... click again to stop',
    processing: 'Transcribing speech...',
    optimizing: 'AI is refining the text, please wait...',
    clickToRecord: 'Click the microphone or press {hotkey} to start recording',
    startRecording: 'Press [{hotkey}] to start recording',
    waitingForTarget: 'Click the target location...',

    aiOptimized: 'AI Enhanced',
    aiOptimizing: 'AI is refining the text...',
    copyOriginal: 'Copy Transcription',
    copyOptimized: 'Copy Enhanced Text',
    paste: 'Paste Enhanced Text',
    export: 'Export Text'
  },

  // History page
  history: {
    title: 'History',
    search: 'Search transcripts...',
    noRecords: 'No transcripts yet',
    noMatch: 'No matching records found',
    copyText: 'Copy Text',
    delete: 'Delete',
    confirmDelete: 'Confirm Delete',
    deleteSuccess: 'Record deleted',
    deleteFailed: 'Failed to delete record',
    loadFailed: 'Failed to load history',
    aiOptimized: 'AI Enhanced',
    total: 'Total ',
    records: ' records'
  },

  // Notification messages
  notifications: {
    enabled: 'Notifications enabled',
    disabled: 'Notifications disabled',
    aiEnabled: 'AI text enhancement enabled',
    aiDisabled: 'AI text enhancement disabled',
    copied: 'Text copied to clipboard',
    copyFailed: 'Could not copy text to clipboard: {error}',
    pasted: 'Copied and attempted to paste (Ctrl+V)',
    pasteToClipboard: 'Text copied to clipboard; please paste manually',
    pasteFailed: 'Paste failed',
    pasteFailedDesc: 'Please check accessibility permissions. The text has been copied to the clipboard - paste it manually with Cmd+V.',
    exported: 'Text exported to file',
    exportFailed: 'Could not export text file',
    transcriptionComplete: 'Transcription complete',
    aiComplete: 'AI text enhancement complete',
    aiFailedUsedOriginal: 'Pasted the original transcription',
    downloadStarted: 'Downloading model files...',
    downloadComplete: 'Model downloaded, loading...',
    downloadFailed: 'Model download failed: {error}',
    pleaseDownload: 'Please download the AI model files first',
    modelDownloading: 'Model is downloading, please wait...',
    modelLoading: 'Model is loading, please wait...',
    modelNotReady: 'Model not ready, please wait...',
    languageChanged: 'Language changed',
    clickTarget: 'Click where you want the text pasted',
    cancelled: 'Cancelled'
  },

  // Language options
  languages: {
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文'
  },

  // Common
  common: {
    confirm: 'Confirm',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Info'
  }
};
