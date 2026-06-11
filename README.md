<div align="center">

<br/>

# 聲聲慢 (SpeakSlow)

### 給開發者的中文語音輸入 — 對著 Cursor / Claude Code 講中文，本地、免費、隱私

**開源、100% 本地的 Wispr Flow 替代方案，專為中文與 AI 編程（vibe coding）打造**

<img src="https://img.shields.io/badge/license-Apache_2.0-blue.svg" alt="License">
<img src="https://img.shields.io/badge/platform-Windows-0078D6" alt="Platform">
<img src="https://img.shields.io/badge/ASR-sherpa--onnx-orange" alt="ASR">
<img src="https://img.shields.io/badge/100%25-local-success" alt="Local">
<img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome">

</div>

<br/>

> 按一下 **右 Alt / 右 Ctrl** → 講中文 → 文字**自動貼到你游標所在的位置**。終端機、記事本、Cursor、Claude Code、Chrome 輸入框都行。語音辨識**完全在你電腦本地運行**，一個字都不上雲。

<!-- 👇 之後放一段 Demo GIF：右 Ctrl → 講中文 → 文字打進 Cursor -->
<div align="center">
  <em>（Demo GIF 施工中）</em>
</div>

<br/>

## 🎯 為誰而做

- **AI 編程（vibe coding）的人** — 用 Cursor / Claude Code / Copilot 時，**用講的比打字快**。中文口述需求、貼上、繼續寫 code，手不離開節奏。
- **中文使用者** — 專為中文優化的本地辨識，比通用聽寫準。

## 🆚 為什麼不用現成的？

| | 🎯 聲聲慢 | 🪟 Windows 內建語音輸入 | 💰 Wispr Flow |
|---|---|---|---|
| **處理位置** | ✅ **本地** | ❌ 雲端（微軟伺服器）| ❌ 雲端 |
| **隱私** | ✅ 語音不外流 | ❌ 上傳語音 | ❌ 上傳語音 |
| **價格** | ✅ 開源免費 | （系統內建）| ❌ $12/月 |
| **中文優化** | ✅ 專門 | ⚠️ 通用 | ⚠️ 通用 |
| **AI 潤飾 / 排版 / 校稿** | ✅ 可接（甚至本地 LLM）| ❌ 無 | ⚠️ 部分 |
| **熱詞 / 字典** | ✅ | ❌ | ⚠️ |
| **離線可用** | ✅ | ❌ | ❌ |

## 🔒 100% 本地，連 AI 潤飾都能不上雲

語音辨識本來就在本地。更進一步：AI 潤飾走**相容 OpenAI 的介面**，你可以把它指向**本機的 Ollama / LM Studio**（跑在你自己的顯卡上）——

> **講話 → 辨識 → AI 潤稿，整條鏈都在你電腦裡，什麼都不離開。** 免費、免 API key、離線可用。

## ✨ 特色

- 🎙️ **右 Alt / 右 Ctrl 一鍵切換** — 按一下開始、再按一下停止並貼上；錄音中按 `Esc` 取消。（瀏覽器裡用右 Ctrl 避開選單）
- ⚡ **極速本地辨識** — sherpa-onnx **Paraformer（int8、非自回歸）**，講完約 0.3 秒貼上。
- 🧠 **長音訊不幻聽** — 自動用 VAD 把長語音分段辨識，講一大段也完整。
- 📋 **貼到游標處、不污染剪貼簿** — 貼上後自動還原你原本的剪貼簿。
- 🈶 **自動標點 + 口語清理** — 去口吃疊字、補標點、全形英文轉半形。
- 🤖 **AI 潤飾 / 校稿 / 排版（可選）** — 接任何相容 OpenAI 的 API 或**本地 LLM**。
- 🎯 **精準重辨（Whisper）** — 對英文/難句不滿意？歷史一鍵用 Whisper 重新辨識。
- 🔤 **熱詞 / 字典** — 提升專有名詞、自動校正常錯詞。
- 🕘 **歷史紀錄** — 保存原始錄音，隨時重新辨識；搜尋、統計、匯出。

## 🚀 快速開始（開發）

需求：**Node.js 18+**、**Python 3.x**

```bash
# 1. 取得專案
git clone https://github.com/Jeffrey0117/speakslow.git
cd speakslow

# 2. Node 依賴
npm install
npx electron-builder install-app-deps   # 原生模組的 Electron 預編譯檔

# 3. Python 環境 + sherpa-onnx
python -m venv .venv
.venv/Scripts/python.exe -m pip install sherpa-onnx numpy opencc

# 4. 下載模型（離線辨識 + 標點 + 串流 + VAD）
.venv/Scripts/python.exe download_all_models.py

# 5. 啟動
npm run dev
```

> 模型檔較大（約 250MB～），已在 `.gitignore` 排除，需執行 `download_all_models.py` 下載。
> 📦 一鍵安裝檔（.exe）施工中 — 之後不用裝 Python/Node 也能用。

## 🛠️ 技術棧

- **前端**：React 19、Tailwind CSS、Vite
- **桌面端**：Electron
- **語音辨識（本地）**：[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) — Paraformer（離線）、Zipformer（串流）、Whisper（精準）、Silero VAD、ct-transformer（標點）
- **資料庫**：better-sqlite3
- **全域熱鍵**：uiohook-napi

## 🗺️ Roadmap

- [ ] 一鍵 Windows 安裝檔（.exe）
- [ ] AI 寫作模式（潤飾 / 排版 / 校稿 / 摘要）
- [ ] 內建本地 LLM 一鍵設定
- [ ] Web / API 服務（讓其他專案共用本機辨識）

> 目前**專注 Windows**。

## 🤝 貢獻

歡迎 issue / PR！這是個給中文開發者的工具，你的回饋就是方向。

## 🙏 致謝

- [SpeakSlow (yan5xu/speakslow)](https://github.com/yan5xu/speakslow) — 原始專案，本專案在其基礎上改用 sherpa-onnx 引擎並重做 UI 與互動。
- [sherpa-onnx (k2-fsa)](https://github.com/k2-fsa/sherpa-onnx) — 本地語音辨識引擎。
- [Wispr Flow](https://wisprflow.ai/) — 產品概念的啟發。

## 📄 授權

本專案採用 [Apache License 2.0](LICENSE)。
