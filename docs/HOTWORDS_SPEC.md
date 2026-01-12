# 熱詞功能規格書

## 概述

熱詞（Hotwords）功能讓使用者可以新增專有名詞、人名、公司名稱等詞彙，提升這些詞彙的辨識準確度。

**注意**：這與「字典替換」功能不同
- **熱詞**：提升特定詞彙的辨識機率（輸入端優化）
- **字典替換**：辨識後的文字校正（輸出端修正）

## 使用情境

1. **專業術語**：醫學、法律、科技領域的專有名詞
2. **人名地名**：客戶名稱、公司名稱、產品名稱
3. **縮寫簡稱**：常用縮寫、內部術語
4. **品牌名稱**：聲聲慢、iPhone、ChatGPT

## 技術實現

### Sherpa-ONNX 熱詞支援

```python
# 串流辨識器初始化
OnlineRecognizer.from_transducer(
    tokens=tokens_path,
    encoder=encoder_path,
    decoder=decoder_path,
    joiner=joiner_path,

    # 熱詞相關參數
    hotwords_file='hotwords.txt',      # 熱詞檔案路徑
    hotwords_score=1.5,                 # 熱詞提升分數 (1.0-3.0)
    decoding_method='modified_beam_search',  # 必須使用此方法
    bpe_vocab='bpe.vocab',              # BPE 詞彙表（模型自帶）
    modeling_unit='cjkchar+bpe',        # 中英文混合
)

# 或動態指定熱詞
stream = recognizer.create_stream(hotwords="聲聲慢 語音轉錄")
```

### 熱詞檔案格式

```text
# hotwords.txt - 每行一個詞彙
聲聲慢
語音轉錄
人工智慧
機器學習
台積電
鴻海
```

## UI 設計

### 設定頁面 - 熱詞管理

```
┌─────────────────────────────────────────────┐
│  ⚙️ 設定                                     │
├─────────────────────────────────────────────┤
│                                             │
│  🎯 熱詞設定                                 │
│  ─────────────────────────────────────────  │
│  提升特定詞彙的辨識準確度                    │
│                                             │
│  ┌─────────────────────────────────┐        │
│  │ 聲聲慢                     [x]  │        │
│  │ 語音轉錄                   [x]  │        │
│  │ 台積電                     [x]  │        │
│  │ 人工智慧                   [x]  │        │
│  └─────────────────────────────────┘        │
│                                             │
│  ┌─────────────────────┐  ┌──────┐         │
│  │ 輸入新詞彙...        │  │ 新增 │         │
│  └─────────────────────┘  └──────┘         │
│                                             │
│  熱詞強度: ━━━━━━━●━━━ 1.5                  │
│  (1.0 輕微 ─ 2.0 中等 ─ 3.0 強烈)           │
│                                             │
│  ⚠️ 提示：熱詞過多可能影響辨識速度           │
│                                             │
├─────────────────────────────────────────────┤
│  📖 字典替換（辨識後校正）                   │
│  ─────────────────────────────────────────  │
│  ...                                        │
└─────────────────────────────────────────────┘
```

## 資料儲存

### 儲存路徑
```
%APPDATA%/speakslow/
├── hotwords.txt          # 熱詞列表
├── hotwords_config.json  # 熱詞設定
└── settings.json         # 其他設定
```

### hotwords_config.json
```json
{
  "enabled": true,
  "score": 1.5,
  "words": [
    "聲聲慢",
    "語音轉錄",
    "台積電"
  ]
}
```

## 實現步驟

### Phase 1: 後端支援
1. [ ] 修改 `sherpa_server.py` - 串流辨識器加入熱詞參數
2. [ ] 新增熱詞檔案讀寫功能
3. [ ] 新增 IPC handler: `get-hotwords`, `set-hotwords`
4. [ ] 支援動態更新熱詞（不需重啟）

### Phase 2: 前端 UI
1. [ ] 設定頁面新增「熱詞設定」區塊
2. [ ] 熱詞列表 CRUD 介面
3. [ ] 熱詞強度滑桿
4. [ ] 匯入/匯出熱詞功能

### Phase 3: 進階功能
1. [ ] 熱詞分類（人名、地名、術語）
2. [ ] 預設熱詞包（醫學、法律、科技）
3. [ ] 熱詞使用統計

## API 設計

### IPC Handlers

```javascript
// 取得熱詞設定
window.electronAPI.getHotwords()
// 返回: { enabled: true, score: 1.5, words: ['聲聲慢', ...] }

// 更新熱詞設定
window.electronAPI.setHotwords({
  enabled: true,
  score: 1.5,
  words: ['聲聲慢', '語音轉錄']
})
// 返回: { success: true }

// 新增單一熱詞
window.electronAPI.addHotword('新詞彙')
// 返回: { success: true, words: [...] }

// 刪除單一熱詞
window.electronAPI.removeHotword('舊詞彙')
// 返回: { success: true, words: [...] }
```

## 注意事項

1. **解碼方法**：必須使用 `modified_beam_search`，`greedy_search` 不支援熱詞
2. **效能影響**：熱詞過多（>100）可能略微影響辨識速度
3. **分數調整**：
   - 1.0-1.5：輕微提升，適合常見詞
   - 1.5-2.0：中等提升，適合專有名詞
   - 2.0-3.0：強烈提升，適合罕見詞（可能產生誤判）
4. **詞彙長度**：建議 2-10 字，過短容易誤判，過長效果有限

## 與字典替換的差異

| 功能 | 熱詞 | 字典替換 |
|------|------|----------|
| 作用階段 | 辨識時 | 辨識後 |
| 目的 | 提升辨識率 | 修正錯字 |
| 原理 | 提高機率分數 | 文字取代 |
| 適用 | 專有名詞 | 同音錯字 |
| 範例 | "台積電" | "台機電"→"台積電" |

## 參考資料

- [Sherpa-ONNX Hotwords 文件](https://k2-fsa.github.io/sherpa/onnx/hotwords/)
- [Transducer 模型熱詞原理](https://github.com/k2-fsa/sherpa-onnx/blob/master/docs/source/onnx/hotwords/index.rst)
