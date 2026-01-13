# 聲聲慢 優化分析報告 v2

## 優化歷程回顧

### 時間線（由舊到新）

```
c64ee80 - POC: sherpa-onnx 取代 FunASR (10x 快, 75% 小)
dbc5805 - 新增規則式標點恢復
ec4ac7f - 整合 FunASR ct-punc + 規則式備援
ccaa3c4 - 新增 Silero VAD + 動態線程
33f992c - 音訊預處理：音量正規化、降噪
0ccd1ee - 串流辨識 + OpenCC 簡轉繁
b4b240b - 熱詞 (Hotwords) 功能
83e23d5 - 串流 VAD 能量偵測
822b279 - OpenCC s2twp → s2t
5990dfb - 串流音訊預處理
1f00f66 - 串流 endpoint 加標點 ← 關鍵
6cf7efe - 改用 modified_beam_search
4d9b3e6 - 串流模式視覺區分 + 修重複標點
30549ca - 修復重複標點和 stream_end 錯誤
afd9e0a - 防止 stream_end 重複標點
8b16d8c - 極端優化：int8、激進 endpoint ← 問題來源？
0368298 - 回退激進優化 ← 部分回退
a9a3695 - 改用 fp32 模型 ← 修正 int8 問題
```

---

## 關鍵優化分析

### 1. 極端優化 (8b16d8c) vs 回退 (0368298)

| 參數 | 極端優化 | 回退值 | 當前值 |
|------|----------|--------|--------|
| **模型** | int8 量化 | - | **fp32** |
| send_interval | 150ms | 250ms | 250ms |
| buffer_size | 2048 | 4096 | 4096 |
| silence_duration | 300ms | 500ms | 500ms |
| VAD_threshold | 0.008 | 0.01 | 0.01 |
| rule1_trailing_silence | 1.2s | 1.8s | **1.8s** |
| rule2_trailing_silence | 0.6s | 0.9s | **0.9s** |
| rule3_utterance_length | 8 | 12 | **12** |

**觀察：** 前端參數已回退，但後端 endpoint 參數維持較保守值。

### 2. 串流標點流程

```
stream_feed() 被呼叫
    ↓
解碼產生 partial_text
    ↓
is_endpoint() 檢查 ──→ 否 ──→ 返回 partial（無標點）
    ↓ 是
_add_punctuation(partial_text)
    ↓
存入 text_buffer
    ↓
重置 stream

stream_end() 被呼叫
    ↓
取得 remaining_text
    ↓
合併 text_buffer + _add_punctuation(remaining)
    ↓
返回最終結果
```

**問題點：**
- 若 endpoint 從未觸發（短句），標點只在 `stream_end` 加一次
- endpoint 參數較保守 → 短句可能不觸發 → 無標點

### 3. 標點系統架構

```
_add_punctuation(text)
    ↓
優先嘗試 FunASR ct-punc ──→ 失敗（未安裝）
    ↓
使用 add_punctuation() 規則式
    ↓
返回加標點文字
```

**現狀：** FunASR 未安裝，100% 使用規則式標點。

---

## 規則式標點涵蓋範圍

### 已實作規則

| 類型 | 範例 | 觸發 |
|------|------|------|
| 問句結尾 | 嗎、呢、麼 | 句末 → ？ |
| 疑問詞 | 什麼、怎麼、為什麼 | 出現 → ？ |
| 語氣詞後 | 啊、喔、嗯 | 後加逗號 |
| 連接詞前 | 然後、所以、但是 | 前加逗號 |
| 主詞+副詞 | 我就、他也、她會 | 前加逗號 |
| 結構性 | 當...的時候 | 智能斷句 |

### 規則式的限制

1. **無法處理：** 語義停頓、情感斷句
2. **可能誤判：** 詞彙歧義（「可是」vs「可」+「是」）
3. **串流特殊：** 部分句子無法判斷完整性

---

## 問題診斷

### 串流模式無逗點

**可能原因：**

1. **endpoint 未觸發**
   - 短句（< 12 字）不觸發 endpoint
   - 說話連續無停頓

2. **標點規則未命中**
   - 句子不含觸發詞（如「好」「謝謝」「知道了」）

3. **text_buffer 邏輯**
   - 僅 endpoint 時加標點
   - 最終 remaining 可能漏標點

**驗證方法：**
```bash
# 觀察 log
tail -f ~/AppData/Local/Temp/ququ_logs/sherpa_server.log | grep "端點\|標點"
```

### 準確度下降

**可能原因：**

1. **VAD 過於激進**
   - 能量閾值可能切斷低音量語音

2. **endpoint 參數**
   - trailing_silence 過短 → 語音被截斷

3. **解碼參數**
   - modified_beam_search 雖準但需調參
   - num_active_paths=4 可能不夠

---

## 當前參數設定

### 串流辨識器

```python
# sherpa_server.py 當前設定
endpoint_config = {
    "rule1_min_trailing_silence": 1.8,  # 長靜音
    "rule2_min_trailing_silence": 0.9,  # 短靜音
    "rule3_min_utterance_length": 12,   # 最小字數
}

# 解碼設定
decoding_method = "modified_beam_search"
num_active_paths = 4
blank_penalty = 0.0  # 可調
```

### 前端設定 (useStreamingRecording.js)

```javascript
// 當前設定
sendInterval: 250ms
bufferSize: 4096
silenceDuration: 500ms
vadThreshold: 0.01
```

---

## 建議調整方案

### 方案 A：提升標點覆蓋率

```python
# 1. 在 stream_end 強制加標點
if not text_with_punc.endswith(('。', '？', '！', '，')):
    text_with_punc = _add_punctuation(text_with_punc)

# 2. 對 partial_text 也做輕量標點（僅句末）
if len(partial_text) > 5 and not is_endpoint:
    # 輕量標點：只加句末標點，不加逗號
    partial_text = add_ending_punctuation(partial_text)
```

### 方案 B：調整 endpoint 敏感度

```python
# 更敏感的 endpoint
endpoint_config = {
    "rule1_min_trailing_silence": 1.5,  # 從 1.8 降到 1.5
    "rule2_min_trailing_silence": 0.7,  # 從 0.9 降到 0.7
    "rule3_min_utterance_length": 8,    # 從 12 降到 8
}
```

### 方案 C：混合標點策略

```python
# 串流中：僅語氣詞後加逗號（低風險）
# endpoint 時：完整標點
# stream_end：強制完整標點 + 句末標點
```

---

## 測試計劃

### 測試句子

```
1. 短句無觸發詞：「好」「謝謝」「知道了」「沒問題」
2. 中等句：「我等一下再回你」「這個可以」
3. 長句：「我跟你說啊這個東西真的很厲害你不信的話你自己試試看」
4. 疑問句：「這是什麼」「你在哪裡」
5. 連續說話：無停頓連續多句
```

### 預期結果

| 輸入 | 當前 | 期望 |
|------|------|------|
| 好 | 好 | 好。 |
| 謝謝 | 謝謝 | 謝謝。 |
| 我等一下再回你 | 我等一下再回你 | 我等一下再回你。 |
| 這是什麼 | 這是什麼 | 這是什麼？ |

---

## 下一步

1. [ ] 確認問題：觀察 log 確定 endpoint 是否觸發
2. [ ] 決定方案：A/B/C 或混合
3. [ ] 實作修改
4. [ ] 測試驗證

---

## 離線辨識準確度分析

### 處理流程

```
音訊檔案
    ↓
_read_wave_file()
    ↓
_preprocess_audio()  ← 可能問題點
    ├─ 音量正規化（auto-gain up to 10x）
    └─ 噪音門檻（threshold = 0.01）
    ↓
_extract_speech_segments()  ← 可能問題點
    └─ Silero VAD 提取語音段
    ↓
recognizer.decode_stream()
    ↓
_add_punctuation()
    ↓
輸出結果
```

### 可疑參數

#### 1. 噪音門檻（Noise Gate）

```python
# sherpa_server.py:457-458
noise_threshold = 0.01
samples = np.where(np.abs(samples) < noise_threshold, 0, samples)
```

**問題：** 0.01 門檻可能太高，會切掉：
- 輕聲子音（ㄆ、ㄊ、ㄎ 等送氣音）
- 尾音、語尾助詞
- 低音量說話者

**建議：** 降低到 0.005 或 0.003

#### 2. VAD 參數

```python
# sherpa_server.py:339-343
vad_config.silero_vad.threshold = 0.5      # 語音檢測閾值
vad_config.silero_vad.min_silence_duration = 0.25  # 最小靜音
vad_config.silero_vad.min_speech_duration = 0.25   # 最小語音
vad_config.silero_vad.max_speech_duration = 15.0   # 最大語音
```

**潛在問題：**
| 參數 | 當前值 | 風險 |
|------|--------|------|
| threshold | 0.5 | 可能漏掉輕聲語音 |
| min_silence | 0.25s | 短停頓被當成分段點 |
| min_speech | 0.25s | 短詞可能被跳過 |

**建議：** threshold 降到 0.4，min_speech 降到 0.15

#### 3. 音量正規化

```python
# sherpa_server.py:445-449
if max_val < 0.1:  # 音量太小
    gain = min(target_peak / max_val, 10.0)  # 最大 10x 增益
```

**風險：** 10x 增益可能把噪音也放大，干擾辨識

**建議：** 限制最大增益到 5x 或 3x

### 對比實驗

| 設定 | 當前 | 保守 | 激進 |
|------|------|------|------|
| noise_threshold | 0.01 | 0.003 | 0.02 |
| vad.threshold | 0.5 | 0.4 | 0.6 |
| vad.min_speech | 0.25 | 0.15 | 0.3 |
| max_gain | 10x | 5x | 15x |

### 快速測試方法

```bash
# 觀察 VAD 跳過了多少
tail -f ~/AppData/Local/Temp/ququ_logs/sherpa_server.log | grep "VAD\|跳過\|預處理"
```

### 建議修改順序

1. **最小風險：** 降低 noise_threshold 到 0.005
2. **中等風險：** 降低 VAD threshold 到 0.4
3. **需測試：** 調整 max_gain

---

*報告日期：2025-01-14*
*分析深度：Commit 歷史 + 代碼邏輯 + 參數分析*
