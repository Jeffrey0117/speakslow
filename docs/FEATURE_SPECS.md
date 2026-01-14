# QuQu 功能規格文件

## 總覽

本文件採用規格驅動開發 (Specification-Driven Development) 方式，定義三個待開發功能的完整規格。

---

## Feature 1: 游標位置文字插入 (Cursor Position Text Insertion)

### 1.1 功能概述

**目標**: 模擬 WisprFlow / TypeLess 的核心功能，讓使用者在系統任意應用程式中，將語音辨識結果直接插入到游標所在位置。

**使用情境**:
- 使用者在 Word 文件中打字，游標停在某段落
- 按下快捷鍵開始錄音
- 說話完畢，辨識結果自動插入到 Word 游標位置
- 無需手動複製貼上

### 1.1.1 TypeLess 模式（按住錄音）

**目標**: 提供類似 TypeLess 的「按住說話」體驗，更直覺的錄音方式。

**交互方式**:
| 操作 | 行為 |
|------|------|
| 按住快捷鍵 | 開始錄音 |
| 放開快捷鍵 | 停止錄音 → 辨識 → 文字出現在游標位置 |
| 用戶自行按 Enter | 送出文字（我們不自動送出） |

**與現有模式的差異**:
| 項目 | 現有模式 | TypeLess 模式 |
|------|----------|---------------|
| 觸發方式 | 按一下開始，再按一下停止 | 按住開始，放開停止 |
| 自動貼上 | ✅ 自動貼上 | ✅ 自動貼上 |
| 自動送出 (Enter) | ⚙️ 可設定 | ❌ 不自動送出 |
| 適用場景 | 長段落錄音 | 快速短句輸入 |

**設定選項**:
| 設定項 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `typelessMode` | boolean | `false` | 啟用 TypeLess 模式（按住錄音） |
| `typelessAutoEnter` | boolean | `false` | TypeLess 模式下是否自動按 Enter（預設不送出） |

### 1.2 技術規格

#### 1.2.1 實現方式

| 項目 | 規格 |
|------|------|
| 主要方法 | 剪貼板 + 模擬貼上 (Ctrl+V / Cmd+V) |
| 備選方法 | 使用 robotjs 直接鍵盤輸入 (逐字) |
| 平台支援 | Windows、macOS、Linux |

#### 1.2.2 工作流程

```
┌─────────────────────────────────────────────────────────────┐
│                    游標位置插入流程                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 使用者在目標應用中定位游標                               │
│     └─ 例: Word、VSCode、瀏覽器輸入框                        │
│                                                             │
│  2. 使用者觸發錄音 (快捷鍵或浮動按鈕)                        │
│     └─ 觸發前: 保存當前剪貼板內容 (可選)                     │
│                                                             │
│  3. 使用者說話，錄音進行中                                   │
│     └─ 顯示錄音指示器                                        │
│                                                             │
│  4. 使用者停止錄音                                           │
│     └─ 送出音訊到 FunASR 辨識                                │
│                                                             │
│  5. 取得辨識結果                                             │
│     └─ (可選) AI 文字優化                                    │
│     └─ (可選) 簡繁轉換                                       │
│                                                             │
│  6. 執行文字插入                                             │
│     ├─ Step A: 將辨識文字寫入剪貼板                          │
│     ├─ Step B: 模擬 Ctrl+V (Windows/Linux) 或 Cmd+V (macOS)  │
│     └─ Step C: (可選) 恢復原剪貼板內容                       │
│                                                             │
│  7. 完成，顯示成功通知                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 1.2.3 Electron 主進程 API

```javascript
// electron/clipboardManager.js

/**
 * 將文字插入到系統游標位置
 * @param {string} text - 要插入的文字
 * @param {Object} options - 選項
 * @param {boolean} options.preserveClipboard - 是否保留原剪貼板內容 (預設 false)
 * @param {number} options.pasteDelay - 貼上前延遲毫秒數 (預設 50)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function insertTextAtCursor(text, options = {}) {
  const { preserveClipboard = false, pasteDelay = 50 } = options;

  // 實現邏輯...
}
```

#### 1.2.4 IPC 通道定義

| 通道名稱 | 方向 | 參數 | 回傳 |
|----------|------|------|------|
| `insert-text-at-cursor` | Renderer → Main | `{ text: string, options: Object }` | `{ success: boolean, error?: string }` |
| `get-clipboard-content` | Renderer → Main | 無 | `{ text: string, html?: string }` |
| `set-clipboard-content` | Renderer → Main | `{ text: string }` | `{ success: boolean }` |

#### 1.2.5 設定選項

| 設定項 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `insertMode` | enum | `'clipboard'` | 插入模式: `'clipboard'` (剪貼板) 或 `'keyboard'` (鍵盤模擬) |
| `preserveClipboard` | boolean | `false` | 插入後是否恢復原剪貼板內容 |
| `autoInsert` | boolean | `true` | 辨識完成後自動插入 (false = 只複製到剪貼板) |
| `insertDelay` | number | `50` | 插入前延遲 (毫秒)，用於等待焦點恢復 |

#### 1.2.6 平台特定實現

**Windows**:
```javascript
// 使用 robotjs 或 @nut-tree/nut-js
const robot = require('robotjs');

function simulatePaste() {
  robot.keyTap('v', ['control']);
}
```

**macOS**:
```javascript
function simulatePaste() {
  robot.keyTap('v', ['command']);
}
```

**Linux**:
```javascript
function simulatePaste() {
  // 嘗試 Ctrl+V，某些應用可能需要 Ctrl+Shift+V
  robot.keyTap('v', ['control']);
}
```

### 1.3 UI 規格

#### 1.3.1 設定頁面新增項目

```
┌─────────────────────────────────────────────────────────────┐
│  文字插入設定                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  插入模式                                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ ◉ 剪貼板貼上 (推薦)                                  │    │
│  │ ○ 鍵盤模擬輸入                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ☑ 辨識完成後自動插入到游標位置                             │
│  ☐ 插入後恢復原剪貼板內容                                   │
│                                                             │
│  插入延遲: [50] 毫秒                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 錯誤處理

| 錯誤情境 | 處理方式 |
|----------|----------|
| 無法寫入剪貼板 | 顯示錯誤通知，建議手動複製 |
| 模擬按鍵失敗 | 降級為只複製到剪貼板 |
| 目標應用不接受貼上 | 通知使用者手動 Ctrl+V |
| 插入後發現錯誤 | 提供撤銷功能 (Ctrl+Z) |

### 1.5 測試案例

| 測試 ID | 測試項目 | 預期結果 |
|---------|----------|----------|
| TC-1.1 | 在記事本中插入文字 | 文字出現在游標位置 |
| TC-1.2 | 在 Word 中插入文字 | 文字出現在游標位置 |
| TC-1.3 | 在瀏覽器輸入框插入 | 文字出現在輸入框 |
| TC-1.4 | 在 VSCode 中插入 | 文字出現在編輯器游標位置 |
| TC-1.5 | 保留剪貼板測試 | 原剪貼板內容在插入後恢復 |
| TC-1.6 | 快速連續插入 | 每次插入都正確完成 |

---

## Feature 2: 即時串流模式 (Real-time Streaming Mode)

### 2.1 功能概述

**目標**: 實現「邊說邊出字」的即時辨識體驗，文字在說話過程中逐步出現，而非等待說完才顯示。

**使用情境**:
- 使用者開始錄音
- 說第一句話時，文字已經開始出現
- 持續說話，文字持續更新
- 停止錄音，最終結果確認

### 2.2 技術規格

#### 2.2.1 串流模式對比

| 項目 | 批次模式 (現有) | 串流模式 (新增) |
|------|-----------------|-----------------|
| 處理方式 | 錄完再辨識 | 邊錄邊辨識 |
| 延遲感受 | 較長 (2-10秒) | 較短 (<1秒) |
| 準確度 | 較高 (完整上下文) | 稍低 (部分上下文) |
| CPU 負載 | 集中爆發 | 持續穩定 |
| 適用場景 | 短句、精確需求 | 長段落、即時回饋 |

#### 2.2.2 FunASR 串流配置

```python
# funasr_server.py - 串流模式擴展

class FunASRStreamingServer:
    def __init__(self):
        # 使用 FunASR 的串流模型
        self.streaming_model = AutoModel(
            model="damo/speech_paraformer-large_asr_nat-zh-cn-16k-common-vocab8404-online",
            vad_model="damo/speech_fsmn_vad_zh-cn-16k-common",
            punc_model="damo/punc_ct-transformer_zh-cn-common",
            # 串流專用參數
            mode="online",  # 或 "2pass" 兩遍模式
            chunk_size=[0, 10, 5],  # 左、中、右 chunk 大小
            encoder_chunk_look_back=4,
            decoder_chunk_look_back=1,
        )

    def process_audio_chunk(self, audio_chunk, is_final=False):
        """
        處理音訊片段
        @param audio_chunk: 音訊數據 (bytes)
        @param is_final: 是否為最後一個片段
        @return: { partial_text: str, is_final: bool }
        """
        result = self.streaming_model.generate(
            input=audio_chunk,
            is_final=is_final
        )
        return {
            "partial_text": result[0]["text"],
            "is_final": is_final
        }
```

#### 2.2.3 IPC 通訊協議 (串流)

```
┌──────────────────────────────────────────────────────────────┐
│                    串流 IPC 協議                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Renderer                         Main                       │
│     │                              │                         │
│     │──── start-streaming ────────▶│                         │
│     │     { sampleRate: 16000 }    │                         │
│     │                              │                         │
│     │──── audio-chunk ────────────▶│                         │
│     │     { data: Uint8Array,      │                         │
│     │       sequence: 1 }          │──── [FunASR] ──▶        │
│     │                              │                         │
│     │◀─── partial-result ──────────│                         │
│     │     { text: "你好",           │                         │
│     │       sequence: 1,           │                         │
│     │       is_final: false }      │                         │
│     │                              │                         │
│     │──── audio-chunk ────────────▶│                         │
│     │     { data: Uint8Array,      │                         │
│     │       sequence: 2 }          │                         │
│     │                              │                         │
│     │◀─── partial-result ──────────│                         │
│     │     { text: "你好世界",       │                         │
│     │       sequence: 2,           │                         │
│     │       is_final: false }      │                         │
│     │                              │                         │
│     │──── stop-streaming ─────────▶│                         │
│     │                              │                         │
│     │◀─── final-result ────────────│                         │
│     │     { text: "你好世界！",     │                         │
│     │       confidence: 0.95,      │                         │
│     │       is_final: true }       │                         │
│     │                              │                         │
└──────────────────────────────────────────────────────────────┘
```

#### 2.2.4 前端音訊串流

```javascript
// hooks/useStreamingRecording.js

const CHUNK_INTERVAL_MS = 200;  // 每 200ms 發送一個 chunk
const SAMPLE_RATE = 16000;

function useStreamingRecording() {
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const socketRef = useRef(null);

  const startStreaming = async () => {
    // 建立 AudioContext
    audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });

    // 取得麥克風
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
      }
    });

    // 建立 ScriptProcessor 或 AudioWorklet
    const source = audioContextRef.current.createMediaStreamSource(stream);
    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

    processorRef.current.onaudioprocess = (e) => {
      const audioData = e.inputBuffer.getChannelData(0);
      // 發送到主進程
      window.electronAPI.sendAudioChunk(audioData);
    };

    source.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);
  };

  // ...
}
```

#### 2.2.5 兩種串流策略

**策略 A: 純串流模式 (Online)**
```
音訊 ──▶ 即時辨識 ──▶ 顯示
         (低延遲，準確度略低)
```

**策略 B: 兩遍模式 (2-pass)**
```
音訊 ──▶ 即時辨識 ──▶ 顯示 (暫時結果)
    └──▶ 完整辨識 ──▶ 更新 (最終結果)
         (結合低延遲和高準確度)
```

建議採用 **策略 B** 以獲得最佳使用者體驗。

### 2.3 UI 規格

#### 2.3.1 串流模式切換

```
┌─────────────────────────────────────────────────────────────┐
│  辨識模式                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │   ⏺ 標準模式      │  │   ⚡ 即時模式     │                │
│  │   (錄完再辨識)    │  │   (邊說邊出字)   │                 │
│  └──────────────────┘  └──────────────────┘                 │
│                                                             │
│  即時模式說明:                                               │
│  • 文字會在說話過程中逐步出現                                │
│  • 最終結果可能會有微調                                      │
│  • 適合長段落輸入                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2.3.2 即時文字顯示區

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  🎤 正在聆聽...                              [停止]         │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │  今天天氣很好，我想去公園走走|                        │   │
│  │                              ↑                      │   │
│  │                           游標閃爍                   │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  💡 說完後點擊停止，或靜默 3 秒自動結束                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.4 設定選項

| 設定項 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `streamingMode` | boolean | `false` | 是否啟用即時串流模式 |
| `chunkInterval` | number | `200` | 音訊片段發送間隔 (毫秒) |
| `silenceTimeout` | number | `3000` | 靜默多久自動停止 (毫秒) |
| `useTwoPass` | boolean | `true` | 是否使用兩遍模式提高準確度 |

### 2.5 錯誤處理

| 錯誤情境 | 處理方式 |
|----------|----------|
| 串流連線中斷 | 自動降級到批次模式 |
| 辨識延遲過高 | 通知使用者，建議切換模式 |
| 音訊片段丟失 | 跳過該片段，繼續處理 |
| 記憶體不足 | 自動清理緩衝區 |

### 2.6 測試案例

| 測試 ID | 測試項目 | 預期結果 |
|---------|----------|----------|
| TC-2.1 | 短句即時辨識 | <500ms 內開始顯示文字 |
| TC-2.2 | 長段落串流 | 持續更新，無明顯卡頓 |
| TC-2.3 | 靜默自動停止 | 3秒靜默後自動結束 |
| TC-2.4 | 兩遍模式準確度 | 最終結果比中間結果更準確 |
| TC-2.5 | 模式切換 | 切換後立即生效 |
| TC-2.6 | 降級處理 | 串流失敗時自動降級 |

---

## Feature 3: 通知系統重新設計 (Notification System Redesign)

### 3.1 現有問題分析

| 問題 | 影響 |
|------|------|
| 通知疊加 | 多個通知堆疊在一起，視覺雜亂 |
| 位置不當 | 可能遮擋重要內容 |
| 樣式單調 | 缺乏視覺區分度 |
| 無法操作 | 通知沒有可互動元素 |
| sonner 限制 | 自訂能力有限 |

### 3.2 設計目標

1. **不疊加**: 同類型通知合併或替換
2. **不遮擋**: 智慧定位，避開關鍵區域
3. **可區分**: 不同類型通知有不同視覺樣式
4. **可互動**: 支援操作按鈕 (如撤銷、複製)
5. **可配置**: 使用者可自訂通知行為

### 3.3 套件評估

| 套件 | 優點 | 缺點 | 推薦度 |
|------|------|------|--------|
| **sonner** (現有) | 簡單易用 | 自訂受限，疊加問題 | ⭐⭐ |
| **react-hot-toast** | 輕量、API 友善 | 功能有限 | ⭐⭐⭐ |
| **react-toastify** | 功能豐富 | 樣式較傳統 | ⭐⭐⭐ |
| **自訂實現** | 完全可控 | 開發成本高 | ⭐⭐⭐⭐ |
| **notistack** | Material 風格，堆疊管理好 | 依賴 MUI | ⭐⭐⭐ |

**建議方案**: 自訂實現 + 簡單動畫庫 (framer-motion)

### 3.4 UI 規格

#### 3.4.1 通知類型與樣式

```
┌────────────────────────────────────────────────────────────┐
│  通知類型定義                                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ✅ 成功 (Success)                                          │
│  ┌──────────────────────────────────────────────────┐      │
│  │ ✓  辨識完成                              [複製]  │      │
│  │    "今天天氣很好..."                              │      │
│  └──────────────────────────────────────────────────┘      │
│  背景: 綠色漸層  邊框: 綠色  圖標: ✓                        │
│                                                            │
│  ⚠️ 警告 (Warning)                                          │
│  ┌──────────────────────────────────────────────────┐      │
│  │ ⚠  辨識結果可能不準確                            │      │
│  │    信心度: 62%                                   │      │
│  └──────────────────────────────────────────────────┘      │
│  背景: 黃色漸層  邊框: 橙色  圖標: ⚠                        │
│                                                            │
│  ❌ 錯誤 (Error)                                            │
│  ┌──────────────────────────────────────────────────┐      │
│  │ ✕  辨識失敗                             [重試]   │      │
│  │    請檢查麥克風權限                               │      │
│  └──────────────────────────────────────────────────┘      │
│  背景: 紅色漸層  邊框: 紅色  圖標: ✕                        │
│                                                            │
│  ℹ️ 資訊 (Info)                                              │
│  ┌──────────────────────────────────────────────────┐      │
│  │ ℹ  模型載入中... 23%                             │      │
│  │    ████████░░░░░░░░░░░░                          │      │
│  └──────────────────────────────────────────────────┘      │
│  背景: 藍色漸層  邊框: 藍色  圖標: ℹ                        │
│                                                            │
│  🎤 錄音中 (Recording)                                      │
│  ┌──────────────────────────────────────────────────┐      │
│  │ 🎤 正在錄音                          00:05 [停止]│      │
│  │    ▁▂▃▄▅▆▇█▇▆▅▄▃▂▁                               │      │
│  └──────────────────────────────────────────────────┘      │
│  背景: 紫色漸層  邊框: 紫色  圖標: 🎤 (動態脈動)             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 3.4.2 通知位置

```
┌────────────────────────────────────────────────────────────┐
│                                                            │
│                                        ┌─────────────┐     │
│                                        │  通知區域   │     │
│                                        │  (右上角)   │     │
│                                        └─────────────┘     │
│                                                            │
│                                                            │
│                      主要內容區域                           │
│                                                            │
│                                                            │
│                                                            │
│  可配置位置:                                               │
│  • top-right (預設) - 右上角                               │
│  • top-left - 左上角                                       │
│  • bottom-right - 右下角                                   │
│  • bottom-left - 左下角                                    │
│  • top-center - 頂部中央                                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 3.4.3 堆疊策略

```
傳統堆疊 (問題):          新策略 (解決):
┌─────────────┐           ┌─────────────┐
│ 通知 1      │           │ 辨識完成 ×3 │  ← 合併同類型
├─────────────┤           │ 點擊展開... │
│ 通知 2      │           └─────────────┘
├─────────────┤
│ 通知 3      │           或
├─────────────┤
│ 通知 4      │           ┌─────────────┐
├─────────────┤           │ 最新通知    │  ← 只顯示最新
│ ...         │           │ (替換舊的)  │
└─────────────┘           └─────────────┘
```

### 3.5 元件架構

```
┌────────────────────────────────────────────────────────────┐
│                    通知系統架構                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 NotificationProvider                  │  │
│  │  (Context Provider - 管理所有通知狀態)                │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                               │
│              ┌─────────────┴─────────────┐                 │
│              │                           │                 │
│  ┌───────────▼──────────┐   ┌───────────▼──────────┐      │
│  │  NotificationQueue   │   │  NotificationDisplay │      │
│  │  (狀態管理)          │   │  (渲染層)            │      │
│  │  - add()             │   │  - position          │      │
│  │  - remove()          │   │  - animations        │      │
│  │  - merge()           │   │  - interactions      │      │
│  └──────────────────────┘   └──────────────────────┘      │
│                                        │                   │
│                    ┌───────────────────┼───────────────┐   │
│                    │                   │               │   │
│         ┌─────────▼────┐    ┌─────────▼────┐   ┌──────▼──┐│
│         │ ToastSuccess │    │ ToastError   │   │ ...     ││
│         └──────────────┘    └──────────────┘   └─────────┘│
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 3.6 API 設計

```typescript
// hooks/useNotification.js

interface NotificationOptions {
  type: 'success' | 'warning' | 'error' | 'info' | 'recording';
  title: string;
  message?: string;
  duration?: number;        // 自動關閉時間 (ms)，0 = 不自動關閉
  dismissible?: boolean;    // 是否可手動關閉
  actions?: NotificationAction[];
  mergeKey?: string;        // 相同 key 的通知會合併
  progress?: number;        // 0-100，用於進度通知
}

interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
}

// 使用範例
const { notify, dismiss, dismissAll } = useNotification();

// 基本使用
notify({
  type: 'success',
  title: '辨識完成',
  message: '已複製到剪貼板'
});

// 帶操作按鈕
notify({
  type: 'success',
  title: '辨識完成',
  message: '"今天天氣很好..."',
  actions: [
    { label: '複製', onClick: () => copyToClipboard(text) },
    { label: '撤銷', onClick: () => undo(), variant: 'secondary' }
  ]
});

// 進度通知
notify({
  type: 'info',
  title: '模型載入中',
  progress: 45,
  mergeKey: 'model-loading'  // 更新時會替換而非新增
});

// 錄音中通知 (持續顯示)
notify({
  type: 'recording',
  title: '正在錄音',
  duration: 0,  // 不自動關閉
  dismissible: false
});
```

### 3.7 設定選項

| 設定項 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `notificationPosition` | enum | `'top-right'` | 通知顯示位置 |
| `notificationDuration` | number | `3000` | 預設自動關閉時間 (毫秒) |
| `maxNotifications` | number | `3` | 最大同時顯示數量 |
| `mergeNotifications` | boolean | `true` | 是否合併同類型通知 |
| `showNotifications` | boolean | `true` | 是否顯示通知 |
| `soundEnabled` | boolean | `false` | 是否播放通知音效 |

### 3.8 動畫規格

| 動畫 | 參數 |
|------|------|
| 進入 | `slideIn` from right, duration: 200ms, easing: ease-out |
| 離開 | `fadeOut` + `slideOut`, duration: 150ms, easing: ease-in |
| 堆疊調整 | `translateY`, duration: 150ms, easing: ease-out |

### 3.9 測試案例

| 測試 ID | 測試項目 | 預期結果 |
|---------|----------|----------|
| TC-3.1 | 顯示成功通知 | 綠色樣式，3秒後消失 |
| TC-3.2 | 顯示錯誤通知 | 紅色樣式，帶重試按鈕 |
| TC-3.3 | 通知合併 | 相同類型合併顯示數量 |
| TC-3.4 | 最大數量限制 | 超過3個時移除最舊的 |
| TC-3.5 | 手動關閉 | 點擊×可關閉 |
| TC-3.6 | 位置切換 | 切換後新通知在新位置 |
| TC-3.7 | 深色模式 | 樣式適配深色主題 |

---

## 實作優先順序

```
Phase 1: 基礎功能 (1-2 天)
├─ Feature 1: 游標位置插入 (核心功能)
│  └─ 剪貼板 + Ctrl+V 方案
│
Phase 2: 進階功能 (2-3 天)
├─ Feature 3: 通知重設計 (改善體驗)
│  └─ 自訂通知元件
│
Phase 3: 高級功能 (3-5 天)
└─ Feature 2: 即時串流 (技術挑戰)
   └─ FunASR 串流模型整合
```

---

## 技術依賴

| 功能 | 新增依賴 |
|------|----------|
| Feature 1 | `robotjs` 或 `@nut-tree/nut-js` (鍵盤模擬) |
| Feature 2 | 無 (使用現有 FunASR) |
| Feature 3 | `framer-motion` (動畫) |

---

## 變更記錄

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.0 | 2025-01-10 | 初版規格 |
| 1.1 | 2025-01-10 | 新增 Feature 4-6: 填充詞過濾、自定義快捷鍵、性能優化 |

---

## Feature 4: 填充詞過濾 (Filler Word Filtering)

### 4.1 功能概述

**目標**: 自動過濾語音辨識結果中的填充詞（如「呃」、「啊」、「嗯」、「那個」等），提供更乾淨的輸出文字。

**使用情境**:
- 使用者說話時自然地使用填充詞：「呃...今天我想...嗯...去買個東西」
- 系統自動過濾後輸出：「今天我想去買個東西」
- 使用者可選擇保留或過濾填充詞

### 4.2 技術規格

#### 4.2.1 填充詞清單

| 類別 | 詞彙 | 說明 |
|------|------|------|
| **語氣詞** | 呃、啊、嗯、欸、噢、哦、唔 | 思考或猶豫時的發聲 |
| **口頭禪** | 那個、這個、就是、然後、所以說 | 常見口頭填充 |
| **重複詞** | 對對對、好好好、是是是 | 連續重複的確認詞 |
| **猶豫詞** | 怎麼說呢、就是說、你知道嗎 | 組織思路時的填充 |

#### 4.2.2 過濾規則

```javascript
// helpers/fillerFilter.js

/**
 * 填充詞過濾配置
 */
const FILLER_CONFIG = {
  // 基本填充詞 (單字)
  basic: ['呃', '啊', '嗯', '欸', '噢', '哦', '唔', '蛤'],

  // 口頭禪 (短語)
  phrases: ['那個', '這個', '就是', '然後', '所以說', '就是說'],

  // 重複詞模式 (正則)
  patterns: [
    /對{2,}/g,      // 對對對...
    /好{2,}/g,      // 好好好...
    /是{2,}/g,      // 是是是...
    /嗯{2,}/g,      // 嗯嗯嗯...
    /啊{2,}/g,      // 啊啊啊...
  ],

  // 猶豫短語
  hesitation: ['怎麼說呢', '你知道嗎', '我的意思是'],
};

/**
 * 過濾填充詞
 * @param {string} text - 原始文字
 * @param {Object} options - 過濾選項
 * @returns {string} 過濾後的文字
 */
function filterFillerWords(text, options = {}) {
  const {
    filterBasic = true,
    filterPhrases = true,
    filterPatterns = true,
    filterHesitation = false,  // 預設不過濾猶豫短語
    customWords = [],
  } = options;

  let result = text;

  // 過濾基本填充詞
  if (filterBasic) {
    FILLER_CONFIG.basic.forEach(word => {
      result = result.replace(new RegExp(word, 'g'), '');
    });
  }

  // 過濾口頭禪
  if (filterPhrases) {
    FILLER_CONFIG.phrases.forEach(phrase => {
      result = result.replace(new RegExp(phrase, 'g'), '');
    });
  }

  // 過濾重複詞模式
  if (filterPatterns) {
    FILLER_CONFIG.patterns.forEach(pattern => {
      result = result.replace(pattern, '');
    });
  }

  // 過濾猶豫短語
  if (filterHesitation) {
    FILLER_CONFIG.hesitation.forEach(phrase => {
      result = result.replace(new RegExp(phrase, 'g'), '');
    });
  }

  // 過濾自定義詞彙
  customWords.forEach(word => {
    result = result.replace(new RegExp(word, 'g'), '');
  });

  // 清理多餘空白和標點
  result = result
    .replace(/\s{2,}/g, ' ')           // 多個空白變一個
    .replace(/，{2,}/g, '，')           // 多個逗號變一個
    .replace(/。{2,}/g, '。')           // 多個句號變一個
    .replace(/^\s*[，。]\s*/g, '')      // 移除開頭的標點
    .trim();

  return result;
}
```

#### 4.2.3 處理流程

```
┌─────────────────────────────────────────────────────────────┐
│                    填充詞過濾流程                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 語音辨識完成                                            │
│     └─ 原始文字: "呃...今天我想...嗯...去買個東西"           │
│                                                             │
│  2. 檢查使用者設定                                          │
│     └─ enableFillerFilter: true/false                       │
│                                                             │
│  3. (如啟用) 執行過濾                                       │
│     ├─ Step 1: 移除基本填充詞                               │
│     ├─ Step 2: 移除口頭禪                                   │
│     ├─ Step 3: 處理重複詞                                   │
│     └─ Step 4: 清理格式                                     │
│                                                             │
│  4. 輸出結果                                                │
│     └─ 過濾後: "今天我想去買個東西"                          │
│                                                             │
│  5. (可選) 保留原始文字                                     │
│     └─ raw_text: 原始文字供使用者參考                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 4.2.4 IPC 通道定義

| 通道名稱 | 方向 | 參數 | 回傳 |
|----------|------|------|------|
| `filter-filler-words` | Renderer → Main | `{ text: string, options: Object }` | `{ filtered: string, removed: string[] }` |
| `get-filler-settings` | Renderer → Main | 無 | `{ enabled: boolean, options: Object }` |
| `set-filler-settings` | Renderer → Main | `{ enabled: boolean, options: Object }` | `{ success: boolean }` |

### 4.3 UI 規格

#### 4.3.1 設定頁面

```
┌─────────────────────────────────────────────────────────────┐
│  填充詞過濾設定                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ☑ 啟用填充詞過濾                                           │
│                                                             │
│  過濾類型:                                                  │
│  ☑ 語氣詞 (呃、啊、嗯、欸...)                               │
│  ☑ 口頭禪 (那個、這個、就是...)                             │
│  ☑ 重複詞 (對對對、好好好...)                               │
│  ☐ 猶豫短語 (怎麼說呢、你知道嗎...)                         │
│                                                             │
│  自定義過濾詞:                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 輸入自定義詞彙，用逗號分隔                           │   │
│  │ 例: 額,哈,反正                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ☑ 在結果中顯示被過濾的詞彙 (用於檢查)                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 4.3.2 結果顯示

```
┌─────────────────────────────────────────────────────────────┐
│  辨識結果                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ 已過濾                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 今天我想去買個東西                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  已移除: 呃、嗯                                [顯示原文]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.4 設定選項

| 設定項 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `enableFillerFilter` | boolean | `true` | 是否啟用填充詞過濾 |
| `filterBasic` | boolean | `true` | 過濾基本語氣詞 |
| `filterPhrases` | boolean | `true` | 過濾口頭禪 |
| `filterPatterns` | boolean | `true` | 過濾重複詞 |
| `filterHesitation` | boolean | `false` | 過濾猶豫短語 |
| `customFillerWords` | string[] | `[]` | 自定義過濾詞列表 |
| `showRemovedWords` | boolean | `true` | 顯示被移除的詞彙 |

### 4.5 測試案例

| 測試 ID | 測試輸入 | 預期輸出 |
|---------|----------|----------|
| TC-4.1 | "呃今天天氣很好" | "今天天氣很好" |
| TC-4.2 | "那個我想說那個" | "我想說" |
| TC-4.3 | "對對對沒錯" | "沒錯" |
| TC-4.4 | "嗯...讓我想想嗯..." | "讓我想想" |
| TC-4.5 | "正常句子沒有填充詞" | "正常句子沒有填充詞" (不變) |
| TC-4.6 | 空字串 | 空字串 |

---

## Feature 5: 自定義快捷鍵 (Custom Hotkey Configuration)

### 5.1 功能概述

**目標**: 讓使用者自定義錄音、停止、切換模式等操作的快捷鍵，提供個人化操作體驗。

**使用情境**:
- 使用者覺得預設的 Ctrl+Shift+Space 不順手
- 使用者想改成單鍵 F9 來開始/停止錄音
- 使用者需要避開與其他應用衝突的快捷鍵

### 5.2 技術規格

#### 5.2.1 可配置的快捷鍵操作

| 操作 ID | 操作名稱 | 預設快捷鍵 | 說明 |
|---------|----------|------------|------|
| `toggle-recording` | 開始/停止錄音 | `Ctrl+Shift+Space` | 主要錄音切換 |
| `cancel-recording` | 取消錄音 | `Escape` | 取消當前錄音不處理 |
| `show-window` | 顯示主視窗 | `Ctrl+Shift+Q` | 顯示/隱藏應用視窗 |
| `open-settings` | 開啟設定 | `Ctrl+,` | 開啟設定頁面 |
| `copy-last` | 複製上次結果 | `Ctrl+Shift+C` | 複製最近一次辨識結果 |
| `toggle-mode` | 切換辨識模式 | `Ctrl+Shift+M` | 標準/即時模式切換 |

#### 5.2.2 快捷鍵格式

```javascript
// 快捷鍵格式定義
const HOTKEY_FORMAT = {
  // 修飾鍵
  modifiers: ['Ctrl', 'Alt', 'Shift', 'Meta', 'CmdOrCtrl'],

  // 特殊鍵
  special: [
    'Space', 'Enter', 'Escape', 'Tab', 'Backspace', 'Delete',
    'Up', 'Down', 'Left', 'Right',
    'Home', 'End', 'PageUp', 'PageDown',
    'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12',
  ],

  // 標準鍵
  standard: 'A-Z, 0-9',
};

// 快捷鍵字串格式: "Modifier+Modifier+Key"
// 例: "Ctrl+Shift+Space", "F9", "Alt+R"
```

#### 5.2.3 快捷鍵管理器

```javascript
// helpers/hotkeyManager.js

class HotkeyManager {
  constructor() {
    this.hotkeys = new Map();
    this.defaults = {
      'toggle-recording': 'CmdOrCtrl+Shift+Space',
      'cancel-recording': 'Escape',
      'show-window': 'CmdOrCtrl+Shift+Q',
      'open-settings': 'CmdOrCtrl+,',
      'copy-last': 'CmdOrCtrl+Shift+C',
      'toggle-mode': 'CmdOrCtrl+Shift+M',
    };
  }

  /**
   * 註冊快捷鍵
   * @param {string} actionId - 操作 ID
   * @param {string} accelerator - Electron 快捷鍵格式
   * @param {Function} callback - 回呼函數
   */
  register(actionId, accelerator, callback) {
    // 先取消註冊舊的
    this.unregister(actionId);

    // 註冊新的
    const success = globalShortcut.register(accelerator, callback);
    if (success) {
      this.hotkeys.set(actionId, { accelerator, callback });
    }
    return success;
  }

  /**
   * 取消註冊快捷鍵
   * @param {string} actionId - 操作 ID
   */
  unregister(actionId) {
    const hotkey = this.hotkeys.get(actionId);
    if (hotkey) {
      globalShortcut.unregister(hotkey.accelerator);
      this.hotkeys.delete(actionId);
    }
  }

  /**
   * 驗證快捷鍵是否有效
   * @param {string} accelerator - 快捷鍵字串
   * @returns {{ valid: boolean, error?: string }}
   */
  validate(accelerator) {
    // 檢查格式
    if (!accelerator || typeof accelerator !== 'string') {
      return { valid: false, error: '快捷鍵不能為空' };
    }

    // 檢查是否為保留鍵
    const reserved = ['Ctrl+C', 'Ctrl+V', 'Ctrl+X', 'Ctrl+A', 'Ctrl+Z'];
    if (reserved.includes(accelerator)) {
      return { valid: false, error: '此快捷鍵為系統保留' };
    }

    // 檢查是否與現有快捷鍵衝突
    for (const [id, hotkey] of this.hotkeys) {
      if (hotkey.accelerator === accelerator) {
        return { valid: false, error: `與「${id}」衝突` };
      }
    }

    return { valid: true };
  }

  /**
   * 重設為預設值
   * @param {string} actionId - 操作 ID (可選，不傳則重設全部)
   */
  resetToDefault(actionId = null) {
    if (actionId) {
      return this.defaults[actionId];
    }
    return { ...this.defaults };
  }
}
```

#### 5.2.4 IPC 通道定義

| 通道名稱 | 方向 | 參數 | 回傳 |
|----------|------|------|------|
| `get-hotkey-settings` | Renderer → Main | 無 | `{ hotkeys: Object }` |
| `set-hotkey` | Renderer → Main | `{ actionId: string, accelerator: string }` | `{ success: boolean, error?: string }` |
| `validate-hotkey` | Renderer → Main | `{ accelerator: string }` | `{ valid: boolean, error?: string }` |
| `reset-hotkeys` | Renderer → Main | `{ actionId?: string }` | `{ hotkeys: Object }` |
| `get-hotkey-defaults` | Renderer → Main | 無 | `{ defaults: Object }` |

### 5.3 UI 規格

#### 5.3.1 快捷鍵設定頁面

```
┌─────────────────────────────────────────────────────────────┐
│  快捷鍵設定                                    [重設全部]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  開始/停止錄音                                              │
│  ┌────────────────────────────────────┐  [錄製] [重設]     │
│  │  Ctrl + Shift + Space              │                    │
│  └────────────────────────────────────┘                    │
│                                                             │
│  取消錄音                                                   │
│  ┌────────────────────────────────────┐  [錄製] [重設]     │
│  │  Escape                            │                    │
│  └────────────────────────────────────┘                    │
│                                                             │
│  顯示主視窗                                                 │
│  ┌────────────────────────────────────┐  [錄製] [重設]     │
│  │  Ctrl + Shift + Q                  │                    │
│  └────────────────────────────────────┘                    │
│                                                             │
│  開啟設定                                                   │
│  ┌────────────────────────────────────┐  [錄製] [重設]     │
│  │  Ctrl + ,                          │                    │
│  └────────────────────────────────────┘                    │
│                                                             │
│  複製上次結果                                               │
│  ┌────────────────────────────────────┐  [錄製] [重設]     │
│  │  Ctrl + Shift + C                  │                    │
│  └────────────────────────────────────┘                    │
│                                                             │
│  💡 點擊 [錄製] 後按下想要的快捷鍵組合                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.3.2 快捷鍵錄製對話框

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    🎹 錄製快捷鍵                             │
│                                                             │
│              請按下您想要的快捷鍵組合...                     │
│                                                             │
│                 ┌─────────────────────┐                     │
│                 │   Ctrl + Shift + _  │                     │
│                 └─────────────────────┘                     │
│                                                             │
│                   [取消]    [清除]                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.4 設定選項

| 設定項 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `hotkeys` | Object | (見預設值表) | 所有快捷鍵設定 |
| `enableGlobalHotkeys` | boolean | `true` | 是否啟用全域快捷鍵 |

### 5.5 錯誤處理

| 錯誤情境 | 處理方式 |
|----------|----------|
| 快捷鍵已被佔用 | 顯示衝突提示，詢問是否覆蓋 |
| 系統保留快捷鍵 | 拒絕設定，顯示原因 |
| 快捷鍵格式無效 | 顯示格式說明 |
| 註冊失敗 | 顯示錯誤，恢復原設定 |

### 5.6 測試案例

| 測試 ID | 測試項目 | 預期結果 |
|---------|----------|----------|
| TC-5.1 | 錄製新快捷鍵 | 正確捕捉按鍵組合 |
| TC-5.2 | 設定單一功能鍵 (F9) | 快捷鍵生效 |
| TC-5.3 | 設定組合鍵 | 快捷鍵生效 |
| TC-5.4 | 衝突檢測 | 正確提示衝突 |
| TC-5.5 | 重設單一快捷鍵 | 恢復預設值 |
| TC-5.6 | 重設全部快捷鍵 | 所有快捷鍵恢復預設 |
| TC-5.7 | 停用全域快捷鍵 | 快捷鍵不再響應 |

---

## Feature 6: 性能優化 (Performance Optimization)

### 6.1 功能概述

**目標**: 優化應用的響應速度、記憶體使用和整體流暢度，提供更好的使用者體驗。

**優化範圍**:
- 啟動速度優化
- 錄音延遲優化
- 記憶體管理優化
- UI 渲染優化
- 背景任務優化

### 6.2 現狀分析

#### 6.2.1 需要優化的區域

| 區域 | 現狀問題 | 優化目標 |
|------|----------|----------|
| 啟動時間 | 可能需要數秒載入 | < 2 秒可用 |
| 錄音啟動 | 按下到錄音開始有延遲 | < 200ms 延遲 |
| 辨識等待 | 等待辨識結果時 UI 卡頓 | UI 保持 60fps |
| 記憶體占用 | 長時間使用記憶體增長 | 穩定在 200MB 以下 |
| 電池消耗 | 後台可能消耗電力 | 閒置時 < 1% CPU |

### 6.3 技術規格

#### 6.3.1 啟動優化

```javascript
// 延遲載入非關鍵模組
const lazyModules = {
  settings: () => import('./pages/Settings'),
  history: () => import('./pages/History'),
  analytics: () => import('./helpers/analytics'),
};

// 預載入關鍵資源
const preloadCritical = async () => {
  // 預熱 AudioContext
  const audioContext = new AudioContext({ sampleRate: 16000 });
  await audioContext.resume();
  audioContext.close();

  // 預載入常用設定
  await window.electronAPI.getSetting('language');
  await window.electronAPI.getSetting('enable_ai_optimization');
};
```

#### 6.3.2 錄音響應優化

```javascript
// hooks/useRecording.js 優化

// 1. 預先創建 AudioContext (不要等到錄音時)
const audioContextRef = useRef(null);

useEffect(() => {
  // 預熱 AudioContext
  audioContextRef.current = new AudioContext({ sampleRate: 16000 });
  return () => audioContextRef.current?.close();
}, []);

// 2. 快取麥克風權限狀態
const [micPermission, setMicPermission] = useState('unknown');

useEffect(() => {
  navigator.permissions.query({ name: 'microphone' })
    .then(result => setMicPermission(result.state));
}, []);

// 3. 使用 AudioWorklet 替代 ScriptProcessor (更高效)
const createAudioProcessor = async (context) => {
  await context.audioWorklet.addModule('/audio-processor.js');
  return new AudioWorkletNode(context, 'audio-processor');
};
```

#### 6.3.3 記憶體管理優化

```javascript
// helpers/memoryManager.js

class MemoryManager {
  constructor() {
    this.cacheLimit = 50;  // 最多快取 50 條記錄
    this.audioChunkLimit = 100;  // 最多保留 100 個音訊片段
  }

  /**
   * 清理過期的音訊快取
   */
  cleanAudioCache() {
    if (audioChunksRef.current.length > this.audioChunkLimit) {
      audioChunksRef.current = audioChunksRef.current.slice(-this.audioChunkLimit);
    }
  }

  /**
   * 清理歷史記錄快取
   */
  cleanHistoryCache(history) {
    if (history.length > this.cacheLimit) {
      return history.slice(-this.cacheLimit);
    }
    return history;
  }

  /**
   * 強制垃圾回收 (Electron 主進程)
   */
  forceGC() {
    if (global.gc) {
      global.gc();
    }
  }

  /**
   * 監控記憶體使用
   */
  getMemoryUsage() {
    const used = process.memoryUsage();
    return {
      heapUsed: Math.round(used.heapUsed / 1024 / 1024),  // MB
      heapTotal: Math.round(used.heapTotal / 1024 / 1024),
      rss: Math.round(used.rss / 1024 / 1024),
    };
  }
}
```

#### 6.3.4 UI 渲染優化

```javascript
// React 渲染優化

// 1. 使用 React.memo 避免不必要的重渲染
const TranscriptionResult = React.memo(({ text, confidence }) => {
  return (
    <div className="result">
      <p>{text}</p>
      <span>{confidence}%</span>
    </div>
  );
});

// 2. 使用 useMemo 快取計算結果
const filteredHistory = useMemo(() => {
  return history.filter(item => item.text.includes(searchQuery));
}, [history, searchQuery]);

// 3. 使用 useCallback 避免函數重建
const handleRecordingComplete = useCallback((result) => {
  setTranscription(result);
}, []);

// 4. 虛擬化長列表
import { FixedSizeList } from 'react-window';

const HistoryList = ({ items }) => (
  <FixedSizeList
    height={400}
    width="100%"
    itemCount={items.length}
    itemSize={60}
  >
    {({ index, style }) => (
      <HistoryItem style={style} item={items[index]} />
    )}
  </FixedSizeList>
);
```

#### 6.3.5 背景任務優化

```javascript
// 使用 requestIdleCallback 執行低優先級任務
const scheduleBackgroundTask = (task) => {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(task, { timeout: 5000 });
  } else {
    setTimeout(task, 100);
  }
};

// 背景保存轉錄記錄
scheduleBackgroundTask(() => {
  window.electronAPI.saveTranscription(transcriptionData);
});

// 使用 Web Worker 處理耗時計算
const audioWorker = new Worker('/audio-worker.js');
audioWorker.postMessage({ type: 'convert', data: audioBlob });
audioWorker.onmessage = (e) => {
  const wavBlob = e.data;
  // 處理轉換後的音訊
};
```

### 6.4 效能指標

#### 6.4.1 目標指標

| 指標 | 當前 | 目標 | 測量方法 |
|------|------|------|----------|
| 冷啟動時間 | ~3s | < 2s | performance.now() |
| 錄音啟動延遲 | ~500ms | < 200ms | 按鍵到麥克風啟動 |
| 辨識結果延遲 | 取決於音訊長度 | 無卡頓 | UI 響應性 |
| 記憶體占用 | ~300MB | < 200MB | process.memoryUsage() |
| 閒置 CPU | ~5% | < 1% | 工作管理員 |
| UI 幀率 | 不穩定 | 60fps | Chrome DevTools |

#### 6.4.2 監控儀表板

```
┌─────────────────────────────────────────────────────────────┐
│  性能監控 (開發者模式)                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  記憶體使用                                                  │
│  ████████████░░░░░░░░  156 MB / 200 MB                      │
│                                                             │
│  CPU 使用率                                                  │
│  ██░░░░░░░░░░░░░░░░░░  0.8%                                 │
│                                                             │
│  最近操作延遲:                                               │
│  • 錄音啟動: 180ms ✓                                        │
│  • 辨識完成: 1.2s                                           │
│  • UI 渲染: 16ms ✓                                          │
│                                                             │
│  快取狀態:                                                   │
│  • 歷史記錄: 23 / 50                                        │
│  • 音訊快取: 0 MB                                           │
│                                                             │
│                                   [清理快取] [強制 GC]       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.5 設定選項

| 設定項 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `enablePerformanceMode` | boolean | `false` | 啟用性能模式 (減少動畫) |
| `maxHistoryCache` | number | `50` | 歷史記錄快取數量上限 |
| `autoCleanCache` | boolean | `true` | 自動清理過期快取 |
| `showPerformanceMonitor` | boolean | `false` | 顯示性能監控 (開發者) |
| `reducedMotion` | boolean | `false` | 減少動畫效果 |

### 6.6 優化實施計劃

```
┌─────────────────────────────────────────────────────────────┐
│                    性能優化實施計劃                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Phase 1: 快速優化 (立即見效)                               │
│  ├─ React.memo 包裝關鍵組件                                 │
│  ├─ 移除 console.log (已完成 ✓)                             │
│  ├─ 預熱 AudioContext                                       │
│  └─ 延遲載入設定頁面                                        │
│                                                             │
│  Phase 2: 記憶體優化                                        │
│  ├─ 實現快取清理機制                                        │
│  ├─ 限制歷史記錄數量                                        │
│  └─ 音訊資源及時釋放                                        │
│                                                             │
│  Phase 3: 進階優化                                          │
│  ├─ AudioWorklet 替代 ScriptProcessor                       │
│  ├─ Web Worker 音訊轉換                                     │
│  └─ 虛擬化歷史列表                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.7 測試案例

| 測試 ID | 測試項目 | 預期結果 |
|---------|----------|----------|
| TC-6.1 | 冷啟動時間 | < 2 秒 |
| TC-6.2 | 錄音啟動延遲 | < 200ms |
| TC-6.3 | 連續錄音 10 次 | 記憶體不增長 |
| TC-6.4 | 閒置 10 分鐘 | CPU < 1% |
| TC-6.5 | 快取清理 | 正確清理過期資料 |
| TC-6.6 | 100 條歷史列表滾動 | 60fps 無卡頓 |
| TC-6.7 | 性能模式開啟 | 動畫減少，響應更快 |

---

## Feature 7: 音檔儲存與下載 (Audio Storage & Download)

### 7.1 功能概述

**目標**: 將每次錄音的音檔保存到本地，並在歷史記錄頁面提供播放和下載功能。

**使用情境**:
- 使用者完成錄音後，音檔自動儲存到本地
- 在歷史記錄頁面可以重新播放該錄音
- 可以下載音檔到指定位置 (WAV 或 MP3 格式)
- 支援批次匯出多個音檔

### 7.2 技術規格

#### 7.2.1 資料庫結構變更

```sql
-- 修改 transcriptions 表，新增音檔路徑欄位
ALTER TABLE transcriptions ADD COLUMN audio_path TEXT;
ALTER TABLE transcriptions ADD COLUMN audio_format TEXT DEFAULT 'wav';
ALTER TABLE transcriptions ADD COLUMN audio_size INTEGER;
```

#### 7.2.2 音檔儲存路徑

```
{userData}/
├── transcriptions.db
└── audio/
    ├── 2025/
    │   ├── 01/
    │   │   ├── rec_20250111_143025_a1b2c3.wav
    │   │   ├── rec_20250111_143530_d4e5f6.wav
    │   │   └── ...
    │   └── 02/
    │       └── ...
    └── ...
```

**命名規則**: `rec_{YYYYMMDD}_{HHMMSS}_{randomId}.wav`

#### 7.2.3 音檔管理類

```javascript
// helpers/audioStorage.js

const path = require('path');
const fs = require('fs');

class AudioStorageManager {
  constructor(userDataPath) {
    this.basePath = path.join(userDataPath, 'audio');
    this.ensureDirectory();
  }

  /**
   * 確保音檔目錄存在
   */
  ensureDirectory() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  /**
   * 生成音檔儲存路徑
   * @returns {string} 完整檔案路徑
   */
  generatePath() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const randomId = Math.random().toString(36).substring(2, 8);

    const dirPath = path.join(this.basePath, String(year), month);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    const filename = `rec_${year}${month}${day}_${hours}${minutes}${seconds}_${randomId}.wav`;
    return path.join(dirPath, filename);
  }

  /**
   * 儲存音檔
   * @param {Buffer|Uint8Array} audioData - WAV 音檔數據
   * @returns {Promise<{path: string, size: number}>}
   */
  async saveAudio(audioData) {
    const filePath = this.generatePath();
    const buffer = Buffer.from(audioData);

    await fs.promises.writeFile(filePath, buffer);

    return {
      path: filePath,
      size: buffer.length,
      format: 'wav'
    };
  }

  /**
   * 讀取音檔
   * @param {string} filePath - 音檔路徑
   * @returns {Promise<Buffer>}
   */
  async readAudio(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error('音檔不存在');
    }
    return await fs.promises.readFile(filePath);
  }

  /**
   * 刪除音檔
   * @param {string} filePath - 音檔路徑
   */
  async deleteAudio(filePath) {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  /**
   * 計算音檔總佔用空間
   * @returns {Promise<number>} 總大小 (bytes)
   */
  async getTotalSize() {
    let totalSize = 0;
    const walk = async (dir) => {
      const files = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const file of files) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
          await walk(filePath);
        } else if (file.name.endsWith('.wav')) {
          const stats = await fs.promises.stat(filePath);
          totalSize += stats.size;
        }
      }
    };
    await walk(this.basePath);
    return totalSize;
  }

  /**
   * 清理舊音檔 (超過指定天數)
   * @param {number} daysToKeep - 保留天數
   * @returns {Promise<{deleted: number, freedSpace: number}>}
   */
  async cleanOldAudio(daysToKeep = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deleted = 0;
    let freedSpace = 0;

    // 實現清理邏輯...

    return { deleted, freedSpace };
  }
}

module.exports = AudioStorageManager;
```

#### 7.2.4 IPC 通道定義

| 通道名稱 | 方向 | 參數 | 回傳 |
|----------|------|------|------|
| `save-audio` | Renderer → Main | `{ audioData: Uint8Array, transcriptionId?: number }` | `{ success: boolean, path: string, size: number }` |
| `get-audio` | Renderer → Main | `{ transcriptionId: number }` | `{ success: boolean, audioData: ArrayBuffer }` |
| `delete-audio` | Renderer → Main | `{ transcriptionId: number }` | `{ success: boolean }` |
| `download-audio` | Renderer → Main | `{ transcriptionId: number, savePath: string, format: 'wav' \| 'mp3' }` | `{ success: boolean, path: string }` |
| `get-audio-stats` | Renderer → Main | 無 | `{ totalSize: number, fileCount: number }` |
| `clean-old-audio` | Renderer → Main | `{ daysToKeep: number }` | `{ deleted: number, freedSpace: number }` |
| `export-audio-batch` | Renderer → Main | `{ transcriptionIds: number[], format: 'wav' \| 'mp3', outputDir: string }` | `{ success: boolean, exportedCount: number }` |

#### 7.2.5 錄音流程修改

```javascript
// hooks/useRecording.js 修改

const stopRecording = async () => {
  // ... 現有的停止錄音邏輯 ...

  // 1. 取得 WAV 音檔數據
  const wavData = convertToWav(audioChunks);

  // 2. 送去辨識
  const transcriptionResult = await window.electronAPI.transcribeAudio(wavData);

  // 3. 儲存音檔 (如果啟用)
  let audioInfo = null;
  if (settings.saveAudioEnabled) {
    audioInfo = await window.electronAPI.saveAudio({ audioData: wavData });
  }

  // 4. 儲存轉錄記錄 (包含音檔路徑)
  await window.electronAPI.saveTranscription({
    text: transcriptionResult.text,
    raw_text: transcriptionResult.raw_text,
    audio_path: audioInfo?.path || null,
    audio_size: audioInfo?.size || null,
    audio_format: 'wav',
    // ... 其他欄位
  });
};
```

### 7.3 UI 規格

#### 7.3.1 歷史記錄 - 音檔播放器

```
┌─────────────────────────────────────────────────────────────┐
│  辨識記錄                                     2025/01/11 14:30 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  今天天氣很好，我想去公園走走。                               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ▶   advancement ████████░░░░░░░░░░  0:03 / 0:08     │   │
│  │     [播放] [暫停]                         [下載 ▼]   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  🎤 音檔大小: 128 KB                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 7.3.2 下載選單

```
┌─────────────────────┐
│  下載音檔           │
├─────────────────────┤
│  📁 下載為 WAV      │
│  🎵 下載為 MP3      │
│  ─────────────────  │
│  📂 開啟所在資料夾   │
└─────────────────────┘
```

#### 7.3.3 設定頁面 - 音檔管理

```
┌─────────────────────────────────────────────────────────────┐
│  音檔儲存設定                                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ☑ 儲存錄音音檔                                             │
│    └ 每次錄音後自動保存音檔到本地                            │
│                                                             │
│  自動清理:                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ◉ 保留 30 天                                        │   │
│  │ ○ 保留 7 天                                         │   │
│  │ ○ 保留 90 天                                        │   │
│  │ ○ 永不刪除                                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  儲存空間:                                                  │
│  ├ 已使用: 256 MB (123 個檔案)                              │
│  └ [清理舊檔案] [開啟音檔資料夾]                             │
│                                                             │
│  匯出格式:                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ◉ WAV (無損，檔案較大)                               │   │
│  │ ○ MP3 (有損壓縮，檔案較小)                           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 設定選項

| 設定項 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `saveAudioEnabled` | boolean | `true` | 是否儲存錄音音檔 |
| `audioRetentionDays` | number | `30` | 音檔保留天數 (0 = 永不刪除) |
| `defaultExportFormat` | enum | `'wav'` | 預設匯出格式: `'wav'` 或 `'mp3'` |
| `autoCleanAudio` | boolean | `true` | 是否自動清理過期音檔 |

### 7.5 錯誤處理

| 錯誤情境 | 處理方式 |
|----------|----------|
| 磁碟空間不足 | 提示使用者清理空間，可選擇不儲存音檔 |
| 音檔寫入失敗 | 記錄錯誤，不影響轉錄功能 |
| 音檔讀取失敗 | 顯示「音檔不可用」，提供重新錄音選項 |
| 格式轉換失敗 | 降級為原始格式下載 |

### 7.6 測試案例

| 測試 ID | 測試項目 | 預期結果 |
|---------|----------|----------|
| TC-7.1 | 錄音後自動儲存 | 音檔出現在正確路徑 |
| TC-7.2 | 歷史記錄播放音檔 | 正確播放對應錄音 |
| TC-7.3 | 下載為 WAV | 檔案正確儲存 |
| TC-7.4 | 下載為 MP3 | 格式轉換正確 |
| TC-7.5 | 刪除記錄同時刪除音檔 | 音檔一併清除 |
| TC-7.6 | 自動清理 30 天前音檔 | 舊檔案被刪除 |
| TC-7.7 | 關閉音檔儲存 | 不生成音檔，不影響辨識 |
| TC-7.8 | 批次匯出 | 多個音檔正確匯出 |

---

## Feature 8: 自訂詞典/熱詞 (Custom Dictionary / Hotwords)

### 8.1 功能概述

**目標**: 讓使用者預設常用但 ASR 可能辨識錯誤的詞彙，提升特定詞彙的辨識準確率。

**使用情境**:
- 使用者經常說「蛐蛐」但被辨識為「曲曲」或「驅驅」
- 使用者需要辨識專業術語如「Kubernetes」「GraphQL」
- 使用者需要辨識人名、公司名等專有名詞

### 8.2 技術規格

#### 8.2.1 FunASR 熱詞支援

FunASR 原生支援熱詞 (hotword) 功能，可在辨識時傳入熱詞列表提升辨識率。

```python
# funasr_server.py 修改

def transcribe(self, audio_data, hotwords=None):
    """
    執行語音辨識
    @param audio_data: 音訊數據
    @param hotwords: 熱詞列表 ["詞彙1", "詞彙2", ...]
    """
    result = self.asr_model.generate(
        input=audio_data,
        hotword=hotwords,  # 傳入熱詞
        batch_size_s=300,
    )
    return result
```

#### 8.2.2 資料庫結構

```sql
-- 新增詞典表
CREATE TABLE IF NOT EXISTS dictionary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL UNIQUE,        -- 詞彙
  phonetic TEXT,                    -- 注音/拼音 (可選)
  category TEXT DEFAULT 'general',  -- 分類: general, name, tech, company
  weight INTEGER DEFAULT 1,         -- 權重 1-10
  enabled BOOLEAN DEFAULT 1,        -- 是否啟用
  use_count INTEGER DEFAULT 0,      -- 使用次數統計
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_dictionary_category ON dictionary(category);
CREATE INDEX IF NOT EXISTS idx_dictionary_enabled ON dictionary(enabled);
```

#### 8.2.3 詞典管理類

```javascript
// helpers/dictionaryManager.js

class DictionaryManager {
  constructor(db) {
    this.db = db;
  }

  /**
   * 新增詞彙
   */
  addWord(word, options = {}) {
    const { phonetic, category = 'general', weight = 1 } = options;

    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO dictionary (word, phonetic, category, weight, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    return stmt.run(word, phonetic, category, weight);
  }

  /**
   * 批次新增詞彙
   */
  addWords(words) {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO dictionary (word, category) VALUES (?, 'general')
    `);

    const insertMany = this.db.transaction((words) => {
      for (const word of words) {
        stmt.run(word);
      }
    });

    insertMany(words);
  }

  /**
   * 刪除詞彙
   */
  removeWord(id) {
    const stmt = this.db.prepare('DELETE FROM dictionary WHERE id = ?');
    return stmt.run(id);
  }

  /**
   * 取得所有啟用的詞彙 (用於傳給 FunASR)
   */
  getEnabledWords() {
    const stmt = this.db.prepare(`
      SELECT word, weight FROM dictionary
      WHERE enabled = 1
      ORDER BY weight DESC, use_count DESC
    `);
    return stmt.all();
  }

  /**
   * 取得所有詞彙 (含停用的)
   */
  getAllWords() {
    const stmt = this.db.prepare(`
      SELECT * FROM dictionary ORDER BY category, word
    `);
    return stmt.all();
  }

  /**
   * 依分類取得詞彙
   */
  getWordsByCategory(category) {
    const stmt = this.db.prepare(`
      SELECT * FROM dictionary WHERE category = ? ORDER BY word
    `);
    return stmt.all(category);
  }

  /**
   * 切換啟用狀態
   */
  toggleEnabled(id) {
    const stmt = this.db.prepare(`
      UPDATE dictionary SET enabled = NOT enabled, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    return stmt.run(id);
  }

  /**
   * 更新使用次數 (辨識結果中出現該詞時呼叫)
   */
  incrementUseCount(word) {
    const stmt = this.db.prepare(`
      UPDATE dictionary SET use_count = use_count + 1, updated_at = CURRENT_TIMESTAMP
      WHERE word = ?
    `);
    return stmt.run(word);
  }

  /**
   * 匯入詞彙 (從文字檔)
   */
  importFromText(text) {
    const words = text.split(/[\n,，]/).map(w => w.trim()).filter(w => w);
    this.addWords(words);
    return words.length;
  }

  /**
   * 匯出詞彙
   */
  exportToText() {
    const words = this.getAllWords();
    return words.map(w => w.word).join('\n');
  }
}

module.exports = DictionaryManager;
```

#### 8.2.4 IPC 通道定義

| 通道名稱 | 方向 | 參數 | 回傳 |
|----------|------|------|------|
| `dictionary-add` | Renderer → Main | `{ word: string, phonetic?: string, category?: string, weight?: number }` | `{ success: boolean, id: number }` |
| `dictionary-add-batch` | Renderer → Main | `{ words: string[] }` | `{ success: boolean, added: number }` |
| `dictionary-remove` | Renderer → Main | `{ id: number }` | `{ success: boolean }` |
| `dictionary-get-all` | Renderer → Main | 無 | `{ words: DictionaryWord[] }` |
| `dictionary-get-by-category` | Renderer → Main | `{ category: string }` | `{ words: DictionaryWord[] }` |
| `dictionary-toggle` | Renderer → Main | `{ id: number }` | `{ success: boolean, enabled: boolean }` |
| `dictionary-import` | Renderer → Main | `{ text: string }` | `{ success: boolean, imported: number }` |
| `dictionary-export` | Renderer → Main | 無 | `{ text: string }` |
| `dictionary-get-enabled` | Renderer → Main | 無 | `{ words: string[] }` |

#### 8.2.5 辨識流程整合

```javascript
// hooks/useRecording.js 修改

const performTranscription = async (audioData) => {
  // 1. 取得啟用的熱詞列表
  const { words } = await window.electronAPI.dictionaryGetEnabled();
  const hotwords = words.map(w => w.word);

  // 2. 執行辨識 (帶熱詞)
  const result = await window.electronAPI.transcribeAudio(audioData, {
    hotwords: hotwords
  });

  // 3. 更新詞彙使用統計
  for (const word of hotwords) {
    if (result.text.includes(word)) {
      await window.electronAPI.dictionaryIncrementUseCount(word);
    }
  }

  return result;
};
```

### 8.3 UI 規格

#### 8.3.1 詞典管理頁面

```
┌─────────────────────────────────────────────────────────────┐
│  自訂詞典                                        [匯入] [匯出]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🔍 搜尋詞彙...                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  分類: [全部 ▼]                                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ☑ 蛐蛐          一般      權重: ████░ 4    [✕]     │   │
│  │ ☑ Kubernetes    技術      權重: █████ 5    [✕]     │   │
│  │ ☑ GraphQL       技術      權重: ████░ 4    [✕]     │   │
│  │ ☐ 小明          人名      權重: ███░░ 3    [✕]     │   │
│  │ ☑ 台積電        公司      權重: █████ 5    [✕]     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  新增詞彙:                                                  │
│  ┌──────────────────────────────┐ ┌────────┐ ┌────────┐   │
│  │ 輸入詞彙                      │ │ 一般 ▼ │ │ [新增] │   │
│  └──────────────────────────────┘ └────────┘ └────────┘   │
│                                                             │
│  💡 提示: 可輸入多個詞彙，用逗號或換行分隔                   │
│                                                             │
│  統計: 共 15 個詞彙 (12 個啟用)                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 8.3.2 快速新增 (主介面)

```
┌─────────────────────────────────────────────────────────────┐
│  辨識結果                                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  今天我去了曲曲公司開會。                                    │
│                      ↑                                      │
│              [加入詞典: 蛐蛐]                                │
│                                                             │
│  💡 選取文字後可快速加入詞典                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 8.3.3 匯入對話框

```
┌─────────────────────────────────────────────────────────────┐
│  匯入詞彙                                           [✕]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  請貼上詞彙列表 (每行一個或用逗號分隔):                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 蛐蛐                                                │   │
│  │ Kubernetes                                          │   │
│  │ Docker, React, Vue                                  │   │
│  │ 台積電                                              │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  或 [選擇檔案] 匯入 .txt 檔案                               │
│                                                             │
│                               [取消]  [匯入 (4 個詞彙)]     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.4 設定選項

| 設定項 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `enableDictionary` | boolean | `true` | 是否啟用自訂詞典 |
| `maxHotwords` | number | `50` | 單次辨識最大熱詞數量 |
| `autoAddFrequentWords` | boolean | `false` | 自動將常用詞加入詞典 (未來功能) |

### 8.5 預設詞庫

可提供預設的常用詞庫讓使用者選擇啟用：

| 詞庫名稱 | 說明 | 詞彙數量 |
|----------|------|----------|
| 台灣地名 | 台灣縣市、地區名稱 | ~50 |
| 科技術語 | 程式、軟體相關術語 | ~100 |
| 網路用語 | PTT、網路流行語 | ~50 |
| 商業公司 | 台灣知名公司名稱 | ~50 |

### 8.6 錯誤處理

| 錯誤情境 | 處理方式 |
|----------|----------|
| 詞彙重複 | 跳過或更新現有詞彙 |
| 詞彙過長 (>50字) | 拒絕新增，提示長度限制 |
| 熱詞數量超過限制 | 只使用權重最高的 N 個 |
| 匯入檔案格式錯誤 | 顯示錯誤，提供格式說明 |

### 8.7 測試案例

| 測試 ID | 測試項目 | 預期結果 |
|---------|----------|----------|
| TC-8.1 | 新增單一詞彙 | 詞彙出現在列表中 |
| TC-8.2 | 批次新增詞彙 | 所有詞彙正確新增 |
| TC-8.3 | 刪除詞彙 | 詞彙從列表移除 |
| TC-8.4 | 切換啟用狀態 | 狀態正確切換 |
| TC-8.5 | 辨識時使用熱詞 | 熱詞辨識準確率提升 |
| TC-8.6 | 匯入文字檔 | 詞彙正確匯入 |
| TC-8.7 | 匯出詞彙 | 產生正確的文字檔 |
| TC-8.8 | 搜尋詞彙 | 正確過濾顯示 |
| TC-8.9 | 依分類篩選 | 正確顯示該分類詞彙 |
| TC-8.10 | 使用次數統計 | 辨識後正確更新計數 |

---

## 變更記錄

| 版本 | 日期 | 變更內容 |
|------|------|----------|
| 1.0 | 2025-01-10 | 初版規格 (Feature 1-3) |
| 1.1 | 2025-01-10 | 新增 Feature 4-6: 填充詞過濾、自定義快捷鍵、性能優化 |
| 1.2 | 2025-01-11 | 新增 Feature 7-8: 音檔儲存與下載、自訂詞典/熱詞 |
