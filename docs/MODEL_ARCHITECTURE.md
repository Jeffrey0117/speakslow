# 聲聲慢 - 模型架構與優化規格

## 目前模型架構

```
┌─────────────────────────────────────────────────────────────────┐
│                        聲聲慢 語音辨識系統                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   音訊輸入   │ -> │  Silero VAD │ -> │   ASR 模型  │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                            │                  │                 │
│                      過濾靜音段         ┌─────┴─────┐           │
│                                        │           │           │
│                                   ┌────▼────┐ ┌────▼────┐      │
│                                   │ 離線模式 │ │ 串流模式 │      │
│                                   │Paraformer│ │Zipformer│      │
│                                   └────┬────┘ └────┬────┘      │
│                                        │           │           │
│                                        └─────┬─────┘           │
│                                              │                 │
│                                        ┌─────▼─────┐           │
│                                        │  ct-punc  │           │
│                                        │  標點模型  │           │
│                                        └─────┬─────┘           │
│                                              │                 │
│                                        ┌─────▼─────┐           │
│                                        │  OpenCC   │           │
│                                        │  簡轉繁   │           │
│                                        └─────┬─────┘           │
│                                              │                 │
│                                        ┌─────▼─────┐           │
│                                        │ 字典替換  │           │
│                                        └─────┬─────┘           │
│                                              ▼                 │
│                                         最終文字               │
└─────────────────────────────────────────────────────────────────┘
```

## 模型清單

### 1. ASR 離線模型 - Paraformer
| 項目 | 值 |
|------|-----|
| 名稱 | `sherpa-onnx-paraformer-zh-2023-09-14` |
| 類型 | 非串流 (Offline) |
| 架構 | Paraformer |
| 語言 | 中文 |
| 大小 | ~234 MB |
| 用途 | 錄音完成後一次性轉錄 |
| 優點 | 準確度高、支援長音訊 |
| 缺點 | 無法即時顯示 |

### 2. ASR 串流模型 - Zipformer
| 項目 | 值 |
|------|-----|
| 名稱 | `sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20` |
| 類型 | 串流 (Online/Streaming) |
| 架構 | Zipformer Transducer |
| 語言 | 中英雙語 |
| 大小 | ~511 MB |
| 用途 | 邊錄邊轉、即時顯示 |
| 優點 | 即時反饋、支援 Hotwords |
| 缺點 | 準確度略低於離線模型 |

### 3. VAD 模型 - Silero
| 項目 | 值 |
|------|-----|
| 名稱 | `silero_vad.onnx` |
| 類型 | Voice Activity Detection |
| 大小 | ~644 KB |
| 用途 | 過濾靜音、節省運算 |
| 參數 | threshold=0.5, min_silence=0.25s |

### 4. 標點模型 - FunASR ct-punc
| 項目 | 值 |
|------|-----|
| 名稱 | `ct-punc` (ct-transformer) |
| 來源 | FunASR / ModelScope |
| 用途 | 自動添加標點符號 |
| 備註 | 背景載入，約 75 秒 |

---

## 優化規劃

### Phase 1: 熱詞功能 ⏳
**狀態**: 規格已完成，待實作

詳見 `docs/HOTWORDS_SPEC.md`

- [ ] 後端：串流辨識器加入 hotwords 參數
- [ ] 後端：`decoding_method` 改為 `modified_beam_search`
- [ ] 前端：設定頁面熱詞管理 UI
- [ ] 儲存：hotwords.txt 檔案管理

### Phase 2: VAD 優化 📋
**狀態**: 待規劃

#### 目前問題
1. VAD 只用於離線模式，串流模式未使用
2. 參數可能需要針對中文調整
3. 靜音判斷閾值需要測試優化

#### 優化方向
```python
# 目前參數
vad_config.silero_vad.threshold = 0.5
vad_config.silero_vad.min_silence_duration = 0.25
vad_config.silero_vad.min_speech_duration = 0.25
vad_config.silero_vad.max_speech_duration = 15.0
vad_config.silero_vad.window_size = 512

# 待測試優化
# - threshold: 0.3-0.7 範圍測試
# - min_silence: 配合斷句需求調整
# - 串流模式 VAD 整合
```

#### 待辦事項
- [ ] 串流模式整合 VAD（目前只有離線用）
- [ ] VAD 參數可調整（設定頁面）
- [ ] 測試不同 threshold 對準確度影響
- [ ] 端點檢測 (endpoint) 與 VAD 協同

### Phase 3: 串流模型優化 📋
**狀態**: 待評估

#### 評估項目
1. **準確度比較**
   - Paraformer vs Zipformer 同一段音訊比較
   - 記錄 WER (Word Error Rate)

2. **延遲測試**
   - 首字延遲 (First Token Latency)
   - 整體 RTF (Real Time Factor)

3. **模型選擇**
   ```
   可選串流模型:
   - zipformer-bilingual-zh-en (目前)
   - zipformer-zh-only (純中文可能更準)
   - conformer 系列
   - lstm 系列 (更輕量)
   ```

#### 待辦事項
- [ ] 建立測試音檔集
- [ ] 量化準確度指標
- [ ] 評估其他串流模型
- [ ] INT8 量化版本測試（目前用 FP32）

### Phase 4: 標點模型優化 📋
**狀態**: 待評估

#### 目前狀況
- ct-punc 載入需 75 秒（太久）
- 背景載入，不阻塞主流程
- 載入失敗時回退到規則式

#### 優化方向
- [ ] 測試 ct-punc-c 模型（更小更快）
- [ ] ONNX 轉換（脫離 PyTorch）
- [ ] 預熱機制優化
- [ ] 考慮純規則式（如果準確度可接受）

---

## 模型路徑結構

```
ququ/
├── poc-sherpa/
│   ├── sherpa-onnx-paraformer-zh-2023-09-14/
│   │   ├── model.int8.onnx          # ASR 離線模型
│   │   └── tokens.txt
│   │
│   ├── sherpa-onnx-streaming-zipformer-bilingual-zh-en-2023-02-20/
│   │   ├── encoder-epoch-99-avg-1.onnx   # 串流 encoder
│   │   ├── decoder-epoch-99-avg-1.onnx   # 串流 decoder
│   │   ├── joiner-epoch-99-avg-1.onnx    # 串流 joiner
│   │   ├── tokens.txt
│   │   ├── bpe.model                      # BPE 模型（熱詞用）
│   │   └── bpe.vocab                      # BPE 詞彙
│   │
│   └── silero_vad.onnx                    # VAD 模型
│
└── ~/.cache/modelscope/
    └── iic/punc_ct-transformer_.../       # FunASR 標點模型
        └── model.pt
```

---

## 效能基準 (Benchmark)

### 目前測試結果
| 指標 | 離線模式 | 串流模式 |
|------|---------|---------|
| RTF | ~0.1 | ~0.3 |
| 首字延遲 | N/A | ~500ms |
| 記憶體 | ~500MB | ~800MB |
| 準確度 | 基準 | 待測 |

### 目標
| 指標 | 目標值 |
|------|--------|
| 串流首字延遲 | < 300ms |
| 串流 RTF | < 0.2 |
| 熱詞辨識率 | > 95% |
| VAD 過濾效率 | > 30% |

---

## 開發優先順序

```
1. [高] 熱詞功能 - 使用者最需要
2. [高] 串流準確度評估 - 確認是否需要換模型
3. [中] VAD 串流整合 - 減少運算浪費
4. [中] INT8 模型測試 - 減少記憶體
5. [低] 標點模型優化 - 已可用，非急迫
```

---

## 參考資料

- [Sherpa-ONNX 模型列表](https://k2-fsa.github.io/sherpa/onnx/pretrained_models/index.html)
- [Silero VAD](https://github.com/snakers4/silero-vad)
- [FunASR ct-punc](https://modelscope.cn/models/iic/punc_ct-transformer_cn-en-common-vocab471067-large)
