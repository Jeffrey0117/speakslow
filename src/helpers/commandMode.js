const { clipboard } = require("electron");
const { translateFree } = require("./translate");

/**
 * 操作模式（語音指令）派發層 —— 刻意保持「瘦」。
 *
 * 設計界線（別讓它長肥）：
 *  - 預設關閉，不開的人完全感覺不到它。
 *  - 核心只做「扳機」：聽到觸發詞 → 抓選取 → 餵給某個轉換 → 貼回去取代。
 *  - 內建指令極少：簡繁互轉（opencc，本來就在 sherpa server）＋ 翻譯（重用既有 AI 金鑰）。
 *    其他能力一律靠外部腳本（之後接 stdin/stdout 過濾器 / webhook），不在這裡擴張。
 *
 * 一條指令 = { kind, label, mode|aiMode }
 *   kind 'transform' → 走 sherpa opencc（mode: to_traditional / to_simplified）
 *   kind 'translate' → 走免費 Google 翻譯（tl: 目標語言代碼），不燒 AI 額度
 */

const BUILTIN_COMMANDS = [
  { kind: "transform", mode: "to_traditional", label: "轉成繁體" },
  { kind: "transform", mode: "to_simplified", label: "轉成簡體" },
  { kind: "translate", tl: "en", lang: "en", label: "翻成英文" },
  { kind: "translate", tl: "zh-TW", lang: "zh", label: "翻成中文" },
  { kind: "translate", tl: "ja", lang: "ja", label: "翻成日文" },
  // AI 指令（走既有 AI 金鑰，會用到額度；翻譯走免費 Google，這些則需要真智慧）
  { kind: "ai", aiMode: "condense", label: "濃縮" },
  { kind: "ai", aiMode: "extract_vocab", label: "抓單字" },
  { kind: "ai", aiMode: "summarize", label: "總結" },
  { kind: "ai", aiMode: "copywrite", label: "寫成文案" },
  // 按鍵指令（送 SendKeys 給前景視窗，免費、瞬間；讓你能串指令流）
  { kind: "key", keys: "^a", label: "全選", triggers: ["全選", "全部選取", "選取全部", "選全部"] },
  { kind: "key", keys: "^c", label: "複製", triggers: ["複製", "拷貝"] },
  { kind: "key", keys: "^v", label: "貼上", triggers: ["貼上", "貼上來"] },
  { kind: "key", keys: "{ENTER}", label: "送出", triggers: ["送出", "傳送", "發送", "換行", "斷行"] },
  { kind: "key", keys: "^a{DEL}", label: "全部清除", triggers: ["全部刪除", "全部清掉", "全部清除", "清空"] },
];

// 正規化辨識結果：去空白、去標點、轉小寫，方便關鍵詞比對
function normalize(text) {
  return (text || "")
    .replace(/[\s。，、！？；：．,.!?;:]/g, "")
    .toLowerCase()
    .trim();
}

function matchCommand(text) {
  const norm = normalize(text);
  if (!norm) return null;
  const lastOf = (...ws) => Math.max(...ws.map((w) => norm.lastIndexOf(w)));
  const find = (pred) => BUILTIN_COMMANDS.find(pred) || null;

  // 1) 簡繁互轉優先：用「繁體 / 簡體」關鍵詞判斷目標，動詞講法不限
  const tradIdx = lastOf("繁體", "繁体", "正體", "正体");
  const simpIdx = lastOf("簡體", "简体");
  if (tradIdx !== -1 || simpIdx !== -1) {
    const mode = tradIdx >= simpIdx ? "to_traditional" : "to_simplified";
    return find((c) => c.mode === mode);
  }

  // 2) 翻譯：用語言關鍵詞判斷目標，取「後面出現的」當目標
  //（例：「把日文翻成中文」→ 中文；容忍 翻成 / 翻譯成 / 轉成 各種講法）
  const enIdx = lastOf("英文", "英語", "english");
  const jaIdx = lastOf("日文", "日語", "日本語", "japanese");
  const zhIdx = lastOf("中文", "chinese");
  const maxIdx = Math.max(enIdx, jaIdx, zhIdx);
  if (maxIdx !== -1) {
    if (maxIdx === enIdx) return find((c) => c.lang === "en");
    if (maxIdx === jaIdx) return find((c) => c.lang === "ja");
    return find((c) => c.lang === "zh");
  }

  // 3) AI 指令（關鍵詞）
  if (norm.includes("濃縮") || norm.includes("精簡") || norm.includes("縮短") || norm.includes("精煉")) {
    return find((c) => c.aiMode === "condense");
  }
  if (norm.includes("單字") || norm.includes("生字") || norm.includes("詞彙") || norm.includes("單詞")) {
    return find((c) => c.aiMode === "extract_vocab");
  }
  if (norm.includes("總結") || norm.includes("摘要") || norm.includes("重點整理")) {
    return find((c) => c.aiMode === "summarize");
  }
  if (norm.includes("文案") || norm.includes("行銷文")) {
    return find((c) => c.aiMode === "copywrite");
  }

  // 4) 按鍵指令（觸發詞子字串；多字詞要排在單字詞前，例如「全部刪除」先於「刪除」）
  for (const cmd of BUILTIN_COMMANDS) {
    if (cmd.kind !== "key") continue;
    for (const trig of cmd.triggers) {
      if (norm.includes(normalize(trig))) return cmd;
    }
  }

  return null;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 共用：對「目前選取的文字」套一個產生器，再把結果貼回去取代選取。
 * @param ctx        IPC context（含 clipboardManager）
 * @param producer   async (selection) => { success, text, error }
 * @returns          { matched:true, success, label, error }
 */
async function applyToSelection(ctx, label, producer) {
  const { clipboardManager } = ctx;

  // 1) 記住使用者原本的剪貼簿，最後還原
  const userClipboard = clipboard.readText();

  // 2) 還原焦點到剛剛打字的視窗 + Ctrl+C，把選取抓進剪貼簿
  if (!clipboardManager.focusAndCopyFast()) {
    return { matched: true, success: false, label, error: "無法複製選取（PowerShell 未就緒）" };
  }
  await delay(220);

  const selection = clipboard.readText();
  if (!selection || selection.trim() === "") {
    clipboard.writeText(userClipboard);
    return { matched: true, success: false, label, error: "沒有選取到文字" };
  }

  // 3) 套用產生器（opencc / AI 翻譯）
  let out;
  try {
    const res = await producer(selection);
    if (!res || !res.success || typeof res.text !== "string" || res.text.trim() === "") {
      clipboard.writeText(userClipboard);
      return { matched: true, success: false, label, error: (res && res.error) || "處理失敗" };
    }
    out = res.text;
  } catch (e) {
    clipboard.writeText(userClipboard);
    return { matched: true, success: false, label, error: e.message };
  }

  // 4) 貼回去取代選取（pasteText 自己會還原焦點 + Ctrl+V）
  try {
    await clipboardManager.pasteText(out);
  } catch (e) {
    return { matched: true, success: false, label, error: "貼上失敗：" + e.message };
  }

  // 5) 蓋過 pasteText 的內部還原，把使用者「真正原本」的剪貼簿補回去
  setTimeout(() => {
    try { clipboard.writeText(userClipboard); } catch (e) { /* ignore */ }
  }, 700);

  return { matched: true, success: true, label };
}

/**
 * 入口：拿到一段辨識文字，比對 + 執行。
 * @returns {{matched:boolean, success?:boolean, label?:string, error?:string}}
 */
async function runVoiceCommand(ctx, text) {
  const cmd = matchCommand(text);
  if (!cmd) return { matched: false };

  if (cmd.kind === "transform") {
    return await applyToSelection(ctx, cmd.label, (sel) =>
      ctx.sherpaManager.transformText(sel, cmd.mode)
    );
  }

  if (cmd.kind === "translate") {
    // 免費 Google 翻譯，不碰 AI 額度
    return await applyToSelection(ctx, cmd.label, (sel) => translateFree(sel, cmd.tl));
  }

  if (cmd.kind === "ai") {
    // 走既有 AI 金鑰（會用到額度）
    if (!ctx.aiProcessor) {
      return { matched: true, success: false, label: cmd.label, error: "AI 未設定" };
    }
    return await applyToSelection(ctx, cmd.label, (sel) =>
      ctx.aiProcessor.processTextWithAI(sel, cmd.aiMode)
    );
  }

  if (cmd.kind === "key") {
    // 純按鍵：不抓選取、不轉換，直接送鍵給前景視窗（免費、瞬間）
    const ok = ctx.clipboardManager.focusAndSendKeysFast(cmd.keys);
    return ok
      ? { matched: true, success: true, label: cmd.label }
      : { matched: true, success: false, label: cmd.label, error: "送鍵失敗（PowerShell 未就緒）" };
  }

  return { matched: false };
}

module.exports = { runVoiceCommand, matchCommand, BUILTIN_COMMANDS };
