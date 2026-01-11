# 聲聲慢 (QuQu) 專案路線圖

> 規格驅動開發文檔 | 版本 1.0 | 2025-01-12

---

## 目錄

1. [專案概述](#專案概述)
2. [待開發功能列表](#待開發功能列表)
3. [功能規格詳述](#功能規格詳述)
4. [AI 文字優化服務研究](#ai-文字優化服務研究)
5. [技術堆疊](#技術堆疊)
6. [開發優先序](#開發優先序)

---

## 專案概述

**聲聲慢 (QuQu)** 是一款中文語音轉文字桌面應用程式，使用 Electron + React 開發，支援離線語音辨識（Sherpa-ONNX / FunASR）與 AI 文字優化。

### 目前已完成功能

- ✅ 離線語音辨識（Sherpa-ONNX SenseVoice）
- ✅ 雲端 ASR 支援（Google、Azure、Gemini）
- ✅ 中文標點恢復（FunASR ct-punc + 規則式備援）
- ✅ 簡繁轉換
- ✅ AI 文字優化（可選）
- ✅ 歷史記錄側邊欄
- ✅ 音訊錄製與儲存
- ✅ 自訂字體（源雲明體 + jf open 粉圓）

---

## 待開發功能列表

| # | 功能 | 優先級 | 狀態 | 預估複雜度 |
|---|------|--------|------|------------|
| 1 | [UI 持續改進](#1-ui-持續改進) | 高 | 規劃中 | 中 |
| 2 | [字典功能](#2-字典功能) | 高 | 規劃中 | 中 |
| 3 | [AI 優化整合（DeepSeek）](#3-ai-優化整合) | 高 | 研究中 | 中 |
| 4 | [串流辨識恢復](#4-串流辨識恢復) | 中 | 規劃中 | 高 |
| 5 | [手機 App 開發](#5-手機-app-開發) | 中 | 規劃中 | 高 |
| 6 | [語音識別資料整理](#6-語音識別資料整理) | 低 | 規劃中 | 低 |
| 7 | [AprilVoice 網頁版上線](#7-aprilvoice-網頁版上線) | 中 | 規劃中 | 高 |

---

## 功能規格詳述

### 1. UI 持續改進

#### 1.1 功能概述

持續優化使用者介面，提升使用體驗。

#### 1.2 待改進項目

| 項目 | 描述 | 狀態 |
|------|------|------|
| 動畫過渡效果 | 錄音狀態切換、側邊欄展開收起的動畫 | 待開發 |
| 深色模式完善 | 確保所有元件支援深色模式 | 待開發 |
| 響應式設計 | 視窗大小調整時的自適應佈局 | 待開發 |
| 無障礙支援 | 鍵盤導航、螢幕閱讀器支援 | 待開發 |
| 多語言 UI | 介面語言切換（繁中/簡中/英文） | 部分完成 |

#### 1.3 設計規範

```
字體系統：
├── 品牌標題：源雲明體 (GenWan)
├── 內容文字：jf open 粉圓 (OpenHuninn)
└── 系統備援：PingFang SC, Microsoft YaHei

配色方案：
├── 主色調：藍色系 (#3B82F6)
├── 強調色：綠色系（成功）、紅色系（錯誤）
└── 背景：漸層灰白（淺色）/ 漸層深灰（深色）

圓角規範：
├── 主面板：rounded-3xl (24px)
├── 按鈕：rounded-xl (12px)
└── 小元件：rounded-lg (8px)
```

---

### 2. 字典功能

#### 2.1 功能概述

建立使用者自訂字典，用於：
- 專有名詞校正（人名、地名、術語）
- 常用詞彙替換
- 語音辨識後處理

#### 2.2 技術規格

```javascript
// 字典資料結構
interface DictionaryEntry {
  id: string;
  original: string;      // 原始詞彙（可能的錯誤辨識）
  replacement: string;   // 替換詞彙
  category?: string;     // 分類（人名、地名、術語等）
  enabled: boolean;      // 是否啟用
  createdAt: Date;
  updatedAt: Date;
}

// 範例
{
  original: "聲聲慢",
  replacement: "聲聲慢",  // 確保正確
  category: "品牌名稱"
}
```

#### 2.3 資料庫設計

```sql
CREATE TABLE dictionary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original TEXT NOT NULL,
  replacement TEXT NOT NULL,
  category TEXT,
  enabled INTEGER DEFAULT 1,
  priority INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dictionary_original ON dictionary(original);
CREATE INDEX idx_dictionary_category ON dictionary(category);
```

#### 2.4 處理流程

```
語音辨識結果
    │
    ▼
┌─────────────────┐
│  字典後處理模組  │
├─────────────────┤
│ 1. 載入啟用字典 │
│ 2. 依優先級排序 │
│ 3. 執行替換     │
│ 4. 回傳結果     │
└─────────────────┘
    │
    ▼
處理後文字 → AI 優化（可選）
```

#### 2.5 UI 設計

- 設定頁面新增「字典管理」分頁
- 支援新增、編輯、刪除、匯入、匯出
- 批次啟用/停用
- 搜尋過濾功能

---

### 3. AI 優化整合

#### 3.1 功能概述

整合 AI 服務進行語音辨識後的文字優化，包括：
- 標點符號修正
- 語句通順化
- 錯別字校正
- 格式調整

#### 3.2 AI 服務比較研究

| 服務商 | 模型 | 輸入價格 ($/1M tokens) | 輸出價格 ($/1M tokens) | 特點 |
|--------|------|------------------------|------------------------|------|
| **DeepSeek** | V3.2-Exp | **$0.28** | **$0.42** | 最便宜，中文優化 |
| DeepSeek | V3 (cache hit) | $0.028 | $0.42 | 快取命中更便宜 |
| OpenAI | GPT-4o | $2.50 | $10.00 | 通用性強 |
| OpenAI | GPT-4o-mini | $0.15 | $0.60 | 輕量版本 |
| Anthropic | Claude 3.5 Sonnet | $3.00 | $15.00 | 長文處理強 |
| Anthropic | Claude 3 Haiku | $0.25 | $1.25 | 輕量版本 |
| Google | Gemini 1.5 Flash | $0.075 | $0.30 | 快速便宜 |

#### 3.3 建議方案

**主要選擇：DeepSeek V3**
- 成本優勢明顯（比 GPT-4o 便宜約 90%）
- 中文語言模型，對中文優化效果好
- 支援快取機制，進一步降低成本

**備選方案：Gemini 1.5 Flash**
- Google 基礎設施穩定
- 價格也很便宜
- 可作為備援

#### 3.4 API 整合設計

```javascript
// AI 優化服務抽象層
interface AIOptimizer {
  provider: 'deepseek' | 'openai' | 'gemini' | 'claude';
  optimize(text: string, options?: OptimizeOptions): Promise<string>;
  estimateCost(text: string): number;
}

interface OptimizeOptions {
  mode: 'punctuation' | 'fluency' | 'full';  // 優化模式
  preserveFormat?: boolean;                    // 保留原格式
  language?: 'zh-TW' | 'zh-CN';               // 目標語言
}
```

#### 3.5 設定選項

| 設定項 | 類型 | 預設值 | 說明 |
|--------|------|--------|------|
| `ai_provider` | enum | `'deepseek'` | AI 服務提供商 |
| `ai_api_key` | string | `''` | API 金鑰 |
| `ai_optimization_mode` | enum | `'full'` | 優化模式 |
| `enable_ai_optimization` | boolean | `false` | 是否啟用 AI 優化 |
| `ai_fallback_provider` | enum | `'gemini'` | 備援服務 |

---

### 4. 串流辨識恢復

#### 4.1 功能概述

恢復即時串流語音辨識功能，讓使用者在說話過程中即時看到辨識結果。

#### 4.2 技術方案

```
方案一：WebSocket 串流（Sherpa-ONNX）
├── 優點：低延遲、離線可用
├── 缺點：需要重新整合 Sherpa 串流 API
└── 狀態：需研究 sherpa-onnx-node 串流支援

方案二：分段辨識
├── 優點：實作簡單
├── 缺點：有明顯斷句
└── 做法：每 2-3 秒送出一段音訊辨識

方案三：雲端串流 API
├── Google Speech-to-Text Streaming
├── Azure Speech SDK Streaming
└── 優點：成熟穩定，缺點：需網路
```

#### 4.3 UI 設計

```
┌────────────────────────────────────┐
│  🎤 錄音中...                      │
├────────────────────────────────────┤
│                                    │
│  今天天氣很好，我想去_             │ ← 即時辨識結果
│                        ▌           │ ← 游標閃爍
│                                    │
└────────────────────────────────────┘
```

---

### 5. 手機 App 開發

#### 5.1 功能概述

開發 iOS / Android 手機版本，提供行動裝置上的語音轉文字功能。

#### 5.2 技術方案比較

| 方案 | 技術 | 優點 | 缺點 |
|------|------|------|------|
| React Native | JavaScript | 與現有程式碼共用、開發快 | 效能略差 |
| Flutter | Dart | 效能好、UI 美觀 | 需學新語言 |
| 原生開發 | Swift/Kotlin | 最佳效能 | 開發成本高 |
| Capacitor | Web 技術 | 最大程度復用 | 效能限制 |

#### 5.3 建議方案

**React Native + Expo**
- 可復用現有 React 元件
- Expo 提供完整的工具鏈
- 社群資源豐富

#### 5.4 核心功能

- [ ] 語音錄製與辨識
- [ ] 雲端 ASR 服務（手機端主要使用雲端）
- [ ] 歷史記錄同步
- [ ] 分享功能
- [ ] 離線模式（可選，需研究 ONNX Runtime Mobile）

---

### 6. 語音識別資料整理

#### 6.1 功能概述

整理完整的語音識別技術資料，記錄開發經驗與最佳實踐。

#### 6.2 內容大綱

```
語音識別技術指南
├── 1. 引擎比較
│   ├── Sherpa-ONNX
│   ├── FunASR
│   ├── Whisper
│   ├── Vosk
│   └── 雲端服務比較
│
├── 2. 中文處理
│   ├── 標點恢復方案
│   ├── 簡繁轉換
│   ├── 方言處理
│   └── 專有名詞處理
│
├── 3. 效能優化
│   ├── 模型量化
│   ├── 硬體加速
│   └── 記憶體管理
│
├── 4. 實作經驗
│   ├── Electron 整合
│   ├── 音訊處理
│   └── 錯誤處理
│
└── 5. 最佳實踐
    ├── 音訊品質建議
    ├── 使用場景建議
    └── 常見問題解答
```

---

### 7. AprilVoice 網頁版上線

#### 7.1 功能概述

將 AprilVoice 部署為網頁服務，提供線上語音轉文字功能。

#### 7.2 架構設計

```
                    ┌─────────────────┐
                    │   CDN / 靜態    │
                    │   前端資源      │
                    └────────┬────────┘
                             │
┌─────────────┐    ┌────────▼────────┐    ┌─────────────┐
│   使用者    │◄───│   Web Frontend  │───►│  API 閘道   │
│   瀏覽器    │    │   (React)       │    │  (FastAPI)  │
└─────────────┘    └─────────────────┘    └──────┬──────┘
                                                  │
                   ┌──────────────────────────────┼───────────────────┐
                   │                              │                   │
           ┌───────▼───────┐             ┌───────▼───────┐    ┌──────▼──────┐
           │  ASR Worker   │             │   AI 優化     │    │   資料庫    │
           │  (Sherpa)     │             │   Worker      │    │  (Postgres) │
           └───────────────┘             └───────────────┘    └─────────────┘
```

#### 7.3 部署方案

| 項目 | 技術選擇 | 說明 |
|------|----------|------|
| 前端託管 | Vercel / Cloudflare Pages | 靜態網站部署 |
| 後端 API | Railway / Fly.io | Python FastAPI |
| ASR 服務 | GPU 伺服器 | RunPod / Vast.ai |
| 資料庫 | Supabase / PlanetScale | PostgreSQL |
| 檔案儲存 | Cloudflare R2 | 音訊檔案 |

#### 7.4 商業模式（可選）

```
免費方案：
├── 每日 10 分鐘免費額度
├── 標準音質
└── 基本功能

付費方案：
├── 無限使用時間
├── 高品質辨識
├── AI 文字優化
├── 歷史記錄保存
└── 優先處理佇列
```

---

## AI 文字優化服務研究

### 價格對比總結

基於 2025 年 1 月最新資料：

| 排名 | 服務 | 成本 (每百萬 tokens) | 推薦指數 |
|------|------|---------------------|----------|
| 1 | DeepSeek V3 | $0.28 / $0.42 | ⭐⭐⭐⭐⭐ |
| 2 | Gemini 1.5 Flash | $0.075 / $0.30 | ⭐⭐⭐⭐ |
| 3 | GPT-4o-mini | $0.15 / $0.60 | ⭐⭐⭐ |
| 4 | Claude 3 Haiku | $0.25 / $1.25 | ⭐⭐⭐ |
| 5 | GPT-4o | $2.50 / $10.00 | ⭐⭐ |

### 建議

1. **主要服務**：DeepSeek V3
   - 中文優化最佳
   - 成本最低
   - 開源可自架

2. **備援服務**：Gemini 1.5 Flash
   - Google 基礎設施穩定
   - 價格便宜
   - 回應速度快

### 參考資料

- [LLM API Pricing Comparison 2025](https://intuitionlabs.ai/articles/llm-api-pricing-comparison-2025)
- [DeepSeek vs GPT-4o Comparison](https://skywork.ai/blog/llm/deepseek-vs-gpt-4o-speed-accuracy-and-api-cost-compared/)
- [AI API Pricing Comparison](https://intuitionlabs.ai/articles/ai-api-pricing-comparison-grok-gemini-openai-claude)

---

## 技術堆疊

### 桌面版 (QuQu)

```
Frontend:
├── React 18
├── Vite
├── Tailwind CSS
└── Lucide Icons

Backend:
├── Electron
├── better-sqlite3
└── sherpa-onnx-node

ASR Engines:
├── Sherpa-ONNX (離線)
├── FunASR (標點恢復)
├── Google Speech-to-Text
├── Azure Speech Services
└── Gemini (可選)
```

### 網頁版 (AprilVoice)

```
Frontend:
├── React / Next.js
├── Tailwind CSS
└── Web Audio API

Backend:
├── FastAPI (Python)
├── Sherpa-ONNX
└── PostgreSQL
```

### 手機版

```
Framework:
├── React Native
└── Expo

ASR:
├── 雲端服務為主
└── 離線模式（研究中）
```

---

## 開發優先序

### Phase 1：短期（1-2 週）

1. ✅ UI 改進（關閉按鈕、圓角、側邊欄）
2. 🔄 字典功能實作
3. 🔄 DeepSeek AI 整合

### Phase 2：中期

4. 串流辨識恢復
5. AprilVoice 網頁版基礎架構

### Phase 3：長期

6. 手機 App 開發
7. 語音識別資料整理文檔

---

## 更新日誌

| 日期 | 版本 | 更新內容 |
|------|------|----------|
| 2025-01-12 | 1.0 | 初版建立 |

---

*本文檔將持續更新，作為專案開發的指導方針。*
