// 简体中文翻译
export default {
  // 应用名称
  appName: '声声慢',

  // 设置页面
  settings: {
    title: '设置',
    generalSettings: '一般设置',
    generalDescription: '应用的基本设置选项。',
    notifications: '显示通知',
    notificationsDesc: '控制是否显示操作成功等提示通知',
    language: '界面语言',
    languageDesc: '选择应用界面显示的语言',
    convertTranscription: '转换识别结果',
    convertTranscriptionDesc: '将语音识别结果转换为当前语言',

    permissions: '权限管理',
    permissionsDesc: '测试和管理应用权限，确保麦克风和辅助功能正常运作。',
    micPermission: '麦克风权限',
    micPermissionDesc: '录制语音所需的权限',
    testMic: '测试麦克风',
    accessibilityPermission: '辅助功能权限',
    accessibilityPermissionDesc: '自动粘贴文本所需的权限',
    testPermission: '测试权限',

    aiConfig: 'AI设置',
    aiConfigDesc: '设置AI模型以优化和增强语音识别结果。如果API Key无效或未填写，优化功能将自动停用。',
    enableAI: '启用AI文本优化',
    apiKey: 'API Key',
    apiKeyPlaceholder: '请输入您的AI API Key',
    apiKeyDesc: '用于AI文本优化功能的API密钥',
    baseUrl: 'API Base URL',
    baseUrlDesc: 'AI服务的API端点地址，支持OpenAI兼容的API',
    aiModel: 'AI模型',
    aiModelDesc: '选择用于文本优化的AI模型。推荐使用阿里云Qwen3模型获得更好的中文处理效果。',
    predefinedModel: '预设模型',
    customModel: '自定义模型',
    customModelPlaceholder: '输入自定义模型名称，如：qwen3-30b-a3b-instruct-2507',
    aliRecommend: '阿里云推荐',
    openaiConfig: 'OpenAI配置',
    alibabaConfig: '阿里云配置',
    configApplied: '已应用{provider}推荐配置',
    configIncomplete: '配置不完整',
    configIncompleteDesc: '请先输入API密钥',

    testConfig: '测试设置',
    testConfigDesc: '测试当前编辑的设置（无需保存）',
    testing: '测试中...',
    testSuccess: 'AI设置测试成功',
    testSuccessDesc: '模型：{model}',
    testFailed: 'AI设置测试失败',
    testFailedDesc: '未知错误',

    saveSettings: '保存设置',
    saving: '保存中...',
    saveSuccess: '设置保存成功',
    saveFailed: '保存设置失败',
    loadFailed: '加载设置失败',

    about: '关于声声慢',
    aboutDesc: '基于 Sherpa-ONNX 和 AI 的简体中文语音转文字应用',
    features: {
      recognition: '高精度中文语音识别',
      ai: 'AI智能文本优化',
      realtime: '实时语音处理',
      privacy: '隐私保护设计'
    },

    // 热词设置
    hotwords: {
      title: '热词设置',
      description: '提升特定词汇的识别准确度，适用于专有名词、人名、公司名称等',
      enable: '启用热词',
      enableDesc: '开启后热词会在识别时生效',
      enabled: '热词功能已启用',
      disabled: '热词功能已停用',
      list: '热词列表',
      empty: '尚未添加任何热词',
      emptyHint: '在下方输入框添加常用的专有名词',
      placeholder: '输入新词汇...',
      add: '添加',
      remove: '移除',
      added: '已添加热词',
      removed: '已移除热词',
      duplicate: '此热词已存在',
      tooShort: '热词至少需要 2 个字符',
      tooLong: '热词不应超过 10 个字符',
      loadFailed: '加载热词设置失败',
      addFailed: '添加热词失败',
      removeFailed: '删除热词失败',
      score: '热词强度',
      scoreMild: '轻微',
      scoreLow: '偏低',
      scoreMedium: '中等',
      scoreHigh: '偏高',
      scoreStrong: '强烈',
      warning: '热词过多可能影响识别速度，建议不超过 50 个',
      tipTitle: '使用提示',
      tipContent: '热词适合 2-10 个字的专有名词。强度越高识别优先度越高，但可能导致误判。建议从中等强度开始调整。'
    },
    dictionary: {
      title: '字典管理',
      description: '设定词汇替换规则，自动校正语音识别结果中的专有名词（人名、地名、术语等）',
      search: '搜寻...',
      allCategories: '所有分类',
      add: '新增',
      import: '导入',
      export: '导出',
      edit: '编辑项目',
      addNew: '新增项目',
      original: '原始词汇',
      replacement: '替换为',
      category: '分类',
      actions: '操作',
      noMatch: '没有符合的项目',
      empty: '尚无字典项目，点击「新增」建立第一个替换规则',
      total: '共',
      items: '个项目',
      enabled: '个启用'
    }
  },

  // 主界面
  app: {
    history: '历史记录',
    settings: '设置',
    needDownload: '需要下载AI模型文件才能开始使用',
    downloading: '正在下载模型文件...',
    loading: '模型加载中，请稍候...',
    loadingSettings: '加载设置页面...',
    modelError: '模型错误',
    modelNotReady: '模型未就绪，请稍候...',
    recording: '正在录音，再次点击停止',
    processing: '正在识别语音...',
    optimizing: 'AI正在优化文本，请稍候...',
    clickToRecord: '点击麦克风或按 {hotkey} 开始录音',
    startRecording: '按 [{hotkey}] 开始录音',
    waitingForTarget: '请点击目标位置...',

    aiOptimized: 'AI优化后',
    aiOptimizing: 'AI正在优化文本...',
    copyOriginal: '复制识别文本',
    copyOptimized: '复制优化文本',
    paste: '粘贴优化文本',
    export: '导出文本'
  },

  // 历史记录页面
  history: {
    title: '历史记录',
    search: '搜索转录内容...',
    noRecords: '暂无转录历史',
    noMatch: '没有找到匹配的记录',
    copyText: '复制文本',
    delete: '删除',
    confirmDelete: '确认删除',
    deleteSuccess: '已删除记录',
    deleteFailed: '删除记录失败',
    loadFailed: '加载历史记录失败',
    aiOptimized: 'AI优化',
    total: '共 ',
    records: ' 条'
  },

  // 通知消息
  notifications: {
    enabled: '已启用通知',
    disabled: '已关闭通知',
    aiEnabled: '已启用AI文本优化',
    aiDisabled: '已关闭AI文本优化',
    copied: '文本已复制到剪贴板',
    copyFailed: '无法复制文本到剪贴板: {error}',
    pasted: '已复制并尝试粘贴 (Ctrl+V)',
    pasteToClipboard: '文本已复制到剪贴板，请手动粘贴',
    pasteFailed: '粘贴失败',
    pasteFailedDesc: '请检查辅助功能权限。文本已复制到剪贴板 - 请手动使用 Cmd+V 粘贴。',
    exported: '文本已导出到文件',
    exportFailed: '无法导出文本文件',
    transcriptionComplete: '语音识别完成',
    aiComplete: 'AI文本优化完成',
    aiFailedUsedOriginal: '已粘贴原始识别文本',
    downloadStarted: '开始下载模型文件...',
    downloadComplete: '模型下载完成，正在加载...',
    downloadFailed: '模型下载失败: {error}',
    pleaseDownload: '请先下载AI模型文件',
    modelDownloading: '模型正在下载中，请稍候...',
    modelLoading: '模型正在加载中，请稍候...',
    modelNotReady: '模型未就绪，请稍候...',
    languageChanged: '语言已切换',
    clickTarget: '请点击要粘贴文本的位置',
    cancelled: '已取消'
  },

  // 语言选项
  languages: {
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文'
  },

  // 通用
  common: {
    confirm: '确认',
    cancel: '取消',
    close: '关闭',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    warning: '警告',
    info: '提示'
  }
};
