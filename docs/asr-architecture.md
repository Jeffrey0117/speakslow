# 聲聲慢 (SpeakSlow) 語音辨識底層架構分析報告

## 執行摘要

聲聲慢 是一個開源、免費的語音輸入工具，作為 Wispr Flow 的替代方案。它基於 **Electron + React** 前端和 **Python FunASR** 後端的多層架構，專為中文優化。核心特點是完全本地處理、隱私保護、支援可配置的 AI 文字優化。

---

## 1. 核心技術棧

### 1.1 語音識別引擎 (FunASR)

**核心組件**: `funasr_server.py`

| 模型 | 用途 | 來源 |
|------|------|------|
| **Paraformer Large** | ASR 語音識別 | `damo/speech_paraformer-large_asr_nat-zh-cn-16k` |
| **FSMN VAD** | 語音活動檢測 | `damo/speech_fsmn_vad_zh-cn-16k-common` |
| **CT-Transformer** | 標點恢復 | `damo/punc_ct-transformer_zh-cn-common` |

**技術規格**:

| 項目 | 值 |
|------|-----|
| 採樣率 | 16000 Hz |
| 聲道數 | 1 (單聲道) |
| 輸入格式 | WebM Opus → WAV |
| 處理策略 | 本地 CPU 運算 |
| 初始化時間 | ~10-30 秒 |

---

## 2. 完整工作流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    1. 使用者操作層                               │
├─────────────────────────────────────────────────────────────────┤
│  熱鍵觸發 → startRecording()                                    │
│  Navigator.mediaDevices.getUserMedia({                          │
│    sampleRate: 16000,                                           │
│    channelCount: 1,                                             │
│    echoCancellation: true,                                      │
│    noiseSuppression: true                                       │
│  })                                                             │
│  MediaRecorder 採集音訊 (WebM Opus)                              │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                2. 音訊轉換層 (前端)                              │
├─────────────────────────────────────────────────────────────────┤
│  convertToWav(audioBlob):                                       │
│    ├─ FileReader.readAsArrayBuffer(WebM)                       │
│    ├─ AudioContext.decodeAudioData()                           │
│    ├─ audioBufferToWav() - 44 bytes header + PCM data         │
│    └─ 輸出: audio/wav Blob → Uint8Array                        │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│            3. Electron IPC 通訊層                                │
├─────────────────────────────────────────────────────────────────┤
│  window.electronAPI.transcribeAudio(uint8Array)                 │
│  ipcRenderer.invoke("transcribe-audio", audioData)              │
│  主進程: funasrManager.transcribeAudio(data, options)          │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│           4. Python FunASR 服務層                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────┐                           │
│  │ VAD 處理 (過濾靜音段)           │                           │
│  │ vad_model.generate(audio_path)  │                           │
│  └─────────────────────────────────┘                           │
│                 ↓                                                │
│  ┌─────────────────────────────────┐                           │
│  │ ASR 識別 (Paraformer)           │                           │
│  │ asr_model.generate(input=audio) │                           │
│  │ → raw_text                      │                           │
│  └─────────────────────────────────┘                           │
│                 ↓                                                │
│  ┌─────────────────────────────────┐                           │
│  │ 標點恢復 (CT-Transformer)        │                           │
│  │ punc_model.generate(raw_text)   │                           │
│  │ → final_text                    │                           │
│  └─────────────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│        5. AI 文字優化層 (可選)                                   │
├─────────────────────────────────────────────────────────────────┤
│  if (enable_ai_optimization):                                  │
│    POST {baseUrl}/chat/completions                             │
│    → 優化後文字                                                  │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│           6. 簡繁轉換層 (可選)                                   │
├─────────────────────────────────────────────────────────────────┤
│  if (targetLang === 'zh-TW' && shouldConvert):                │
│    text = convertText(text, 'zh-TW')  // OpenCC.js            │
└─────────────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│            7. 資料庫保存 + 文字插入                              │
├─────────────────────────────────────────────────────────────────┤
│  databaseManager.saveTranscription(data)                       │
│  clipboardManager.pasteText(text)                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. 核心檔案說明

### 3.1 後端 Python 服務

| 檔案 | 職責 |
|------|------|
| `funasr_server.py` | FunASR 主服務，載入模型、處理識別請求 |
| `download_models.py` | 模型下載腳本，支援並行下載和進度報告 |

**FunASR Server 架構**:

```python
FunASRServer:
├─ _load_asr_model()      # Paraformer 大型模型
├─ _load_vad_model()      # 語音活動檢測
├─ _load_punc_model()     # 標點恢復
├─ transcribe_audio()     # 核心轉錄方法
└─ main_loop()            # JSON stdin/stdout 通訊
```

**IPC 通訊協議**:

```json
// 請求
{
  "action": "transcribe",
  "audio_path": "/tmp/audio.wav",
  "options": {
    "batch_size_s": 60,
    "use_vad": true,
    "use_punc": true
  }
}

// 響應
{
  "success": true,
  "text": "識別結果",
  "confidence": 0.95,
  "duration": 3.5
}
```

### 3.2 前端 React Hooks

| 檔案 | 職責 |
|------|------|
| `useRecording.js` | 錄音控制、音訊轉換、觸發識別 |
| `useTextProcessing.js` | AI 文字優化邏輯 |
| `useModelStatus.js` | 模型狀態監控 |
| `useHotkey.js` | 快捷鍵綁定 |

**useRecording 核心邏輯**:

```javascript
useRecording:
├─ startRecording()       // 啟動 MediaRecorder
├─ stopRecording()        // 停止並觸發轉換
├─ convertToWav()         // WebM → WAV
├─ transcribeAudio()      // 調用 Electron API
└─ 回調: onTranscriptionComplete, onAIOptimizationComplete
```

### 3.3 Electron 主進程

| 檔案 | 職責 |
|------|------|
| `main.js` | Electron 主進程入口 |
| `preload.js` | 安全 API 橋接 (contextBridge) |
| `funasrManager.js` | Python 子進程管理 |
| `ipcHandlers.js` | IPC 事件處理器 |
| `databaseManager.js` | SQLite 數據庫操作 |
| `clipboardManager.js` | 剪貼板和文字插入 |

---

## 4. AI 文字優化

### 4.1 優化模式

| 模式 | 用途 | 觸發條件 |
|------|------|----------|
| `optimize` | 短文本優化 | <150 字符 |
| `optimize_long` | 長文本分段優化 | >150 字符 |
| `correct` | 語法糾錯 | 手動選擇 |
| `asr_enhance` | ASR 特化優化 | 手動選擇 |

### 4.2 優化 Prompt 設計原則

```
核心原則:
1. 最小化修改 - 只處理非內容性的言語錯誤
2. 保留原貌 - 最大限度保留用戶用詞和語氣
3. 可讀性優先 - 提升流暢性而不改變原意

處理項目:
✓ 糾正同音錯字
✓ 移除填充詞: "呃", "嗯", "那個"
✓ 處理重複與口吃: "我我我" → "我"
✓ 整合自我修正

禁止項目:
✗ 風格轉換 (口語 → 書面語)
✗ 替換用詞
✗ 改變句式
✗ 增刪情感語氣詞
```

---

## 5. 簡繁轉換

### 5.1 實現方式

使用 **OpenCC.js** (開放中文轉換):

```javascript
// src/i18n/index.jsx
import * as OpenCC from 'opencc-js';

const s2tConverter = OpenCC.Converter({ from: 'cn', to: 'tw' });
const t2sConverter = OpenCC.Converter({ from: 'tw', to: 'cn' });

export const convertText = (text, targetLang) => {
  if (targetLang === 'zh-TW') return s2tConverter(text);
  if (targetLang === 'zh-CN') return t2sConverter(text);
  return text;
};
```

### 5.2 轉換時機

```javascript
// useRecording.js
if (shouldConvert && targetLang === 'zh-TW') {
  raw_text = convertText(raw_text, 'zh-TW');
}
```

---

## 6. 系統架構圖

```
┌────────────────────────────────────────────────────────────────┐
│                    前端 (Electron Renderer)                      │
├────────────────────────────────────────────────────────────────┤
│  React Components + Custom Hooks                               │
│  Web Audio API + MediaRecorder                                 │
│  ipcRenderer (預載腳本橋接)                                     │
└────────────────────────────────────────────────────────────────┘
                            ↕ IPC (JSON)
┌────────────────────────────────────────────────────────────────┐
│                  Electron 主進程 (Node.js)                       │
├────────────────────────────────────────────────────────────────┤
│  FunASRManager + DatabaseManager + ClipboardManager            │
│  ipcMain 事件處理                                               │
└────────────────────────────────────────────────────────────────┘
                            ↕ 子進程 (stdin/stdout JSON)
┌────────────────────────────────────────────────────────────────┐
│         FunASR Python 服務 (獨立進程)                           │
├────────────────────────────────────────────────────────────────┤
│  ASR 模型 (Paraformer) ~840MB                                  │
│  VAD 模型 (FSMN) ~1.6MB                                        │
│  Punc 模型 (CT-Transformer) ~278MB                             │
└────────────────────────────────────────────────────────────────┘
                            ↕ HTTP (可選)
┌────────────────────────────────────────────────────────────────┐
│         外部 AI 服務 (OpenAI API 相容)                           │
├────────────────────────────────────────────────────────────────┤
│  OpenAI / 阿里雲通義千問 / 智譜 AI / Kimi 等                   │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. 性能指標

### 7.1 延遲分析

| 階段 | 耗時 |
|------|------|
| 音訊轉換 (WebM→WAV) | ~500ms |
| IPC 通訊 | ~50ms |
| ASR 識別 (取決於音訊長度) | 1-10s |
| AI 優化 (可選) | 1-5s |
| 文字插入 | ~100ms |
| **總計** | **2.5-25s** |

### 7.2 資源使用

| 項目 | 佔用 |
|------|------|
| ASR 模型 | ~1.5 GB |
| VAD 模型 | ~50 MB |
| Punc 模型 | ~500 MB |
| Python 進程 | ~200 MB |
| Electron 應用 | ~300 MB |
| **總計** | **~2.5-3 GB** |

---

## 8. 可重用組件

### 8.1 核心可提取模組

| 模組 | 路徑 | 可重用性 |
|------|------|----------|
| FunASR 服務 | `funasr_server.py` | 完整獨立，可直接調用 |
| 音訊轉換 | `useRecording.js` 中的 `convertToWav` | 純函數，可提取 |
| 簡繁轉換 | `src/i18n/index.jsx` | 完整獨立模組 |
| AI 優化提示詞 | 內嵌於 hooks | 可提取為配置檔 |

### 8.2 API 調用範例

**直接調用 FunASR 服務**:

```python
import subprocess
import json

# 啟動服務
proc = subprocess.Popen(
    ['python', 'funasr_server.py'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    text=True
)

# 發送轉錄請求
request = {
    "action": "transcribe",
    "audio_path": "/path/to/audio.wav",
    "options": {"use_vad": True, "use_punc": True}
}
proc.stdin.write(json.dumps(request) + '\n')
proc.stdin.flush()

# 讀取結果
result = json.loads(proc.stdout.readline())
print(result['text'])
```

**使用 OpenCC.js 簡繁轉換**:

```javascript
import * as OpenCC from 'opencc-js';

const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
const traditionalText = converter('简体中文文本');
// → "簡體中文文本"
```

---

## 9. 技術棧總結

| 層級 | 技術 | 用途 |
|------|------|------|
| 前端 UI | React 19 + Tailwind CSS | 使用者介面 |
| 桌面框架 | Electron 31 | 跨平台桌面應用 |
| 構建工具 | Vite 6 | 前端打包 |
| 後端 | Python 3.8+ | ASR 服務 |
| ASR 框架 | FunASR 0.2.x | 語音識別 |
| 深度學習 | PyTorch 2.x | 模型推理 |
| 數據存儲 | SQLite 3 | 本地數據庫 |
| 簡繁轉換 | OpenCC.js | 中文轉換 |

---

## 10. 隱私與安全

- **完全本地處理**: 語音識別在本地 CPU 運行，無雲上傳
- **可選 AI 優化**: 用戶明確啟用才發送文本到雲端
- **無數據收集**: 不上傳遙測數據，不追蹤用戶活動
- **API 金鑰加密**: 存儲在本地 SQLite，不寫入日誌
