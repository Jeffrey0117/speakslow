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

  // 4) 貼回去取代選取（手動管剪貼簿，全程 await，避免計時還原打架）
  clipboard.writeText(out);
  if (!clipboardManager.focusAndPasteFast()) {
    clipboard.writeText(userClipboard);
    return { matched: true, success: false, label, error: "貼上失敗（PowerShell 未就緒）" };
  }
  await delay(280); // 等 Ctrl+V 落地

  // 5) 讓「結果」維持選取：游標停在貼上文字末端，用 Shift+← 把整段選回來。
  //    這樣指令流接「複製」或再一個轉換才有東西可吃（字元數計，CJK 多為 1）。
  const count = [...out].length;
  if (count > 0 && count <= 2000) {
    // 用括號群組讓 Shift 在整段 LEFT 連按期間都按住（+({LEFT N})）
    clipboardManager.focusAndSendKeysFast(`+({LEFT ${count}})`);
    await delay(150);
  }

  // 6) 還原使用者原本的剪貼簿（貼上已 await 完成，安全；後續「複製」會自己再寫）
  clipboard.writeText(userClipboard);
  return { matched: true, success: true, label };
}

// 開頭若命中按鍵指令觸發詞，回傳該觸發詞（取最長），否則 null
const KEY_COMMANDS = BUILTIN_COMMANDS.filter((c) => c.kind === "key");
function keyTriggerAtStart(seg) {
  let best = null;
  for (const cmd of KEY_COMMANDS) {
    for (const trig of cmd.triggers) {
      if (seg.startsWith(trig) && (!best || trig.length > best.length)) best = trig;
    }
  }
  return best;
}

// 指令流：把一句話拆成多段依序執行。
// 1) 先依連接詞 / 標點 / 空白粗拆（「全選然後翻成英文」）。
// 2) 再對每段「貪婪剝掉開頭的按鍵指令」，這樣就算沒講連接詞也能拆
//    （「全選翻譯成英文」→ 全選 + 翻譯成英文）。按鍵指令是前置動作，
//    翻譯／AI／簡繁是吃選取的尾段動作，故只剝開頭的按鍵指令。
function splitCommands(text) {
  const rough = (text || "")
    .split(/然後再|然後|接著|再來|之後|[，,、；;。\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  for (let seg of rough) {
    let guard = 0;
    while (seg && guard++ < 12) {
      const trig = keyTriggerAtStart(seg);
      if (trig && seg.length > trig.length) {
        out.push(trig);
        seg = seg.slice(trig.length).trim();
      } else {
        out.push(seg);
        seg = "";
      }
    }
  }
  return out;
}

/**
 * 執行單一指令（比對 + 套用）。
 */
async function runSingleCommand(ctx, text) {
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

/**
 * 入口：拿到一段辨識文字，拆成指令流後依序執行。
 * 單一指令 → 直接執行；多段（全選然後翻譯…）→ 照順序跑，段與段間留時間
 * 讓前一個的選取／按鍵生效，這樣「全選 → 翻成英文」一句話就成立。
 * @returns {{matched:boolean, success?:boolean, label?:string, error?:string}}
 */
async function runVoiceCommand(ctx, text) {
  const segments = splitCommands(text);
  if (segments.length <= 1) {
    return await runSingleCommand(ctx, text);
  }

  const ran = [];
  for (const seg of segments) {
    const r = await runSingleCommand(ctx, seg);
    if (r.matched) {
      ran.push(r);
      await delay(350); // 等選取／按鍵／貼上生效，下一段才接得上
    }
  }

  if (ran.length === 0) return { matched: false };
  const allOk = ran.every((r) => r.success);
  const labels = ran.map((r) => r.label).join(" → ");
  const firstErr = ran.find((r) => !r.success);
  return { matched: true, success: allOk, label: labels, error: firstErr ? firstErr.error : undefined };
}

module.exports = { runVoiceCommand, matchCommand, splitCommands, BUILTIN_COMMANDS };
