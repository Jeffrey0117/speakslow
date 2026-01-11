<div align="center">

<!-- 在這裡放置您的Logo圖片 -->
<!-- 例如: <img src="assets/logo.png" width="150" /> -->
<br/>
<br/>

# 聲聲慢 (SpeakSlow)

**開源免費的 Wispr Flow 替代方案 | 為中文而生的下一代智能語音工作流**

</div>

<div align="center">

<!-- 徽章 (Badges) - 您可以後續替換為動態徽章服務 (如 shields.io) -->
<img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="License">
<img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Platform">
<img src="https://img.shields.io/badge/release-v1.0.0-brightgreen" alt="Release">
<img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">

</div>

<br/>

> **厭倦了 Wispr Flow 的訂閱費用？尋找開源免費的語音輸入方案？來試試「聲聲慢」！**

**聲聲慢 (SpeakSlow)** 是 **Wispr Flow 的開源免費替代方案**，專為中文用戶打造的注重隱私的桌面端語音輸入與文字處理工具。與 Wispr Flow 不同，聲聲慢完全開源免費，數據本地處理，專為中文優化，支援國產AI模型。

### 🆚 vs Wispr Flow：開源免費的替代方案

| 核心對比 | 🎯 聲聲慢 (SpeakSlow) | 💰 Wispr Flow |
|---------|---------------------|---------------|
| **價格** | ✅ **完全免費** | ❌ $12/月訂閱 |
| **隱私** | ✅ **本地處理** | ❌ 雲端處理 |
| **中文** | ✅ **專為中文優化** | ⚠️ 通用支援 |
| **AI模型** | ✅ **國產AI支援** | ❌ 僅國外模型 |

想像一下，你可以像和朋友聊天一樣寫作。說的內容被實時、精準地轉換成文字，口誤和「嗯、啊」等廢話被自動修正，甚至能根據你的要求，自動整理成郵件格式或代碼片段。**這就是「聲聲慢」為你帶來的體驗 —— 而且完全免費！**

---

## ✨ 核心優勢

| 特性 | 聲聲慢 (SpeakSlow) 的解決方案 |
| :--- | :--- |
| 🎯 **頂尖中文識別，隱私至上** | 內置阿里巴巴 **FunASR Paraformer** 模型，在您的電腦本地運行。這意味著它能聽懂中文互聯網的「梗」，也能保護您最私密的語音數據不被上傳。 |
| 💡 **會思考的「兩段式引擎」** | 獨創 **「ASR精準識別 + LLM智能優化」** 工作流。它不僅能轉錄，更能「理解」和「重塑」您的語言。**自動過濾口頭禪**、**修正錯誤表述**（例如將「週三開會，不對，是週四」直接輸出為「週四開會」），這些都只是基礎操作。 |
| 🌐 **為國內優化的開放AI生態** | 支援任何兼容OpenAI API的服務，並**優先適配國內頂尖模型** (如通義千問、Kimi等)。這意味著更快的響應速度、更低的費用和更好的合規性。 |
| 🚀 **開發者與效率專家摯愛** | 能準確識別並格式化 `camelCase` 和 `snake_case` 等編程術語。通過自定義AI指令，更能實現**上下文感知**，根據您當前的應用（寫代碼、回郵件）智能調整輸出格式。 |


## 🎬 功能演示

<!-- 在這裡放置您的GIF演示圖 -->
<!-- 例如: <img src="assets/demo.gif" /> -->
<p align="center"><i>(這裡是應用的GIF演示圖)</i></p>

- **一鍵喚醒**: 全局快捷鍵 F2，隨時隨地開始記錄。
- **實時識別**: 本地 FunASR 引擎提供高精度中文識別。
- **智能優化**: 連接您的AI模型，自動潤色、糾錯、總結。
- **無縫貼上**: 轉換完成的文字自動貼上到您當前游標位置。

### 🚀 從 Wispr Flow 遷移？

如果你正在使用 Wispr Flow 但希望**節省訂閱費用**、**保護隱私數據**、**更好的中文支援**，那麼聲聲慢就是你的完美選擇！

## 🚀 快速開始

### 1. 環境要求
- **Node.js 18+** 和 pnpm
- **Python 3.8+** (用於運行本地FunASR服務)
- **macOS 10.15+**, **Windows 10+**, 或 **Linux**

### 2. 項目初始化

#### 方案一：使用 uv (推薦) 🌟

[uv](https://github.com/astral-sh/uv) 是現代化的 Python 包管理器，能自動管理 Python 版本和依賴，避免環境衝突：

```bash
# 1. 克隆項目
git clone https://github.com/yan5xu/speakslow.git
cd speakslow

# 2. 安裝 Node.js 依賴
pnpm install

# 3. 安裝 uv (如果尚未安裝)
# macOS/Linux:
curl -LsSf https://astral.sh/uv/install.sh | sh
# Windows:
# powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# 4. 初始化 Python 環境 (uv 會自動下載 Python 3.11 和所有依賴)
uv sync

# 5. 下載 FunASR 模型
uv run python download_models.py

# 6. 啟動應用!
pnpm run dev
```

#### 方案二：使用系統 Python

如果您更喜歡使用系統 Python 環境：

```bash
# 1. 克隆項目
git clone https://github.com/yan5xu/speakslow.git
cd speakslow

# 2. 安裝 Node.js 依賴
pnpm install

# 3. 創建虛擬環境 (推薦)
python3 -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# 4. 安裝 Python 依賴
pip install funasr modelscope torch torchaudio librosa numpy

# 5. 下載 FunASR 模型
python download_models.py

# 6. 啟動應用!
pnpm run dev
```

#### 方案三：使用嵌入式 Python 環境

項目還支援完全隔離的嵌入式 Python 環境（主要用於生產構建）：

```bash
# 1-2. 同上克隆項目和安裝 Node.js 依賴

# 3. 準備嵌入式 Python 環境
pnpm run prepare:python

# 4. 測試環境是否正常
pnpm run test:python

# 5. 啟動應用
pnpm run dev
```

### 3. 配置AI模型
啟動應用後，在 **設定頁面** 中填入您的AI服務商提供的 **API Key**、**Base URL** 和 **模型名稱**。支援通義千問、Kimi、智譜AI等國產模型，配置將自動保存在本地。

### 4. 故障排除

#### 常見初始化問題

**問題**: `ModuleNotFoundError: No module named 'funasr'`
```bash
# 解決方案 1: 使用 uv (推薦)
uv sync
uv run python download_models.py

# 解決方案 2: 重新安裝依賴
pip install funasr modelscope torch torchaudio librosa numpy

# 解決方案 3: 使用嵌入式環境
pnpm run prepare:python
```

**問題**: FunASR 模型下載失敗或載入緩慢
```bash
# 檢查網路連接，確保能訪問 modelscope.cn
# 如果在 macOS 上遇到 SSL 警告：
pip install "urllib3<2.0"

# 手動下載模型：
python download_models.py
# 或使用 uv:
uv run python download_models.py
```

**問題**: Python 版本不兼容
```bash
# 使用 uv 自動管理 Python 版本 (推薦)
uv sync  # 會自動下載 Python 3.11

# 或手動安裝 Python 3.8+
# 檢查當前版本: python3 --version
```

#### 環境選擇建議

| 使用場景 | 推薦方案 | 優點 |
|---------|---------|------|
| **新用戶/快速體驗** | uv | 自動管理，無環境衝突 |
| **開發者/自定義需求** | 系統 Python + 虛擬環境 | 靈活控制，便於調試 |
| **生產部署** | 嵌入式環境 | 完全隔離，無外部依賴 |

#### 其他常見問題

- **權限問題**: 在某些系統上可能需要使用 `--user` 參數安裝Python包
- **網路問題**: 首次運行時需要下載FunASR模型，請確保網路連接正常
- **模型路徑**: 模型默認下載到 `~/.cache/modelscope/` 目錄

## 🛠️ 技術棧

- **前端**: React 19, TypeScript, Tailwind CSS, shadcn/ui, Vite
- **桌面端**: Electron
- **語音技術 (本地)**: FunASR (Paraformer-large, FSMN-VAD, CT-Transformer)
- **AI模型 (可配置)**: 兼容 OpenAI, Anthropic, 阿里雲通義千問, Kimi 等
- **資料庫**: better-sqlite3

## 🤝 參與貢獻

我們是一個開放和友好的社區，歡迎任何形式的貢獻！

### 📋 項目管理

我們使用 GitHub Projects 來管理項目的開發進度和任務規劃：

- 📊 **項目看板**: [聲聲慢 開發看板](https://github.com/users/yan5xu/projects/2) - 查看當前開發狀態、功能規劃和進度跟踪
- 🎯 **任務管理**: 所有功能開發、Bug修復和改進建議都在項目看板中進行跟踪
- 🔄 **開發流程**: 從想法提出到功能發布的完整流程可視化

### 如何參與

- 🤔 **提建議**: 對產品有任何想法？歡迎到 [Issues](https://github.com/yan5xu/speakslow/issues) 頁面提出。
- 🐛 **報Bug**: 發現程式出錯了？請毫不猶豫地告訴我們。
- 💻 **貢獻代碼**: 如果您想添加新功能或修復Bug，請參考以下步驟：
    1.  Fork 本項目
    2.  創建您的特性分支 (`git checkout -b feature/your-amazing-feature`)
    3.  提交您的更改 (`git commit -m 'feat: Add some amazing feature'`)
    4.  將您的分支推送到遠程 (`git push origin feature/your-amazing-feature`)
    5.  創建一個 Pull Request

## 💬 交流與社區 (Communication & Community)

「聲聲慢」是一個由社區驅動的開源項目，我們相信開放的交流能激發最好的創意。你的每一個想法、每一次反饋都對項目至關重要。

我們誠摯地邀請你加入官方微信交流群，在這裡你可以：

*   🚀 **獲取一手資訊**：第一時間了解項目更新、新功能預告和開發路線圖。
*   💬 **直接與開發者對話**：遇到安裝難題？有絕妙的功能點子？在群裡可以直接 @ 作者和核心貢獻者。
*   💡 **分享與學習**：交流你的 AI 指令 (Prompt) 和自動化工作流，看看別人是怎麼把「聲聲慢」玩出花的。
*   🤝 **參與項目共建**：從一個想法的提出，到一次代碼的提交 (Pull Request)，社區是你最好的起點。

<div align="center">

| 微信掃碼，加入官方交流群 |
| :----------------------------------------------------------: |
| <img src="assets/wechat-community-qrcode.png" width="200" alt="SpeakSlow Official WeChat Group" /> <br> *SpeakSlow Official WeChat Group* |
| <p style="font-size:12px; color: #888;">如果二維碼過期或無法加入，請在 <a href="https://github.com/yan5xu/speakslow/issues">Issues</a> 中提一個 Issue 提醒我們，謝謝！</p> |

</div>

## 🙏 致謝

本項目的誕生離不開以下優秀項目的啟發和支援：

- [FunASR](https://github.com/modelscope/FunASR): 阿里巴巴開源的工業級語音識別工具包。
- [OpenWhispr](https://github.com/HeroTools/open-whispr): 為本項目提供了優秀的架構參考。
- [shadcn/ui](https://ui.shadcn.com/): 提供了高質量、可組合的React組件。

## 📄 許可證

本項目採用 [Apache License 2.0](LICENSE) 許可證。
