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
  // AI 固定指令（精選、輸出彼此明顯不同；其餘模糊需求一律走 freeform）
  { kind: "ai", aiMode: "optimize", label: "潤稿" },
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

  // 3) AI 固定指令（只留輸出明顯不同的幾個；濃縮/抓單字/改寫等模糊需求交給 freeform）
  if (norm.includes("潤稿") || norm.includes("潤飾") || norm.includes("修順") || norm.includes("順稿") || norm.includes("校對")) {
    return find((c) => c.aiMode === "optimize");
  }
  if (norm.includes("總結") || norm.includes("摘要") || norm.includes("重點整理")) {
    return find((c) => c.aiMode === "summarize");
  }
  if (norm.includes("文案") || norm.includes("社群貼文") || norm.includes("行銷文")) {
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

  // 刻意「不還原」使用者原本的剪貼簿 —— 讓結果留在剪貼簿。
  // 這樣唯讀來源（文章 / PDF：選得到字但貼不回去）也救得回：貼上失敗沒關係，
  // 結果就在剪貼簿，使用者自己 Ctrl+V 貼到別處即可。可編輯來源則照樣在地替換，
  // 結果也順便在剪貼簿（無害）。代價只是蓋掉原本剪貼簿內容，剛做完轉換很直覺。
  // resultText 讓指令流的「複製」可以直接拿結果（不靠脆弱的選取+Ctrl+C）。
  return { matched: true, success: true, label, resultText: out };
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

// freeform：把使用者整句話當「給 AI 的指示」，套用在選取的文字上
function freeformPrompt(instruction, selection) {
  return (
    "請依照下面的「指示」處理「文字」，只輸出處理後的結果本身，不要任何說明、前言或引號：\n\n" +
    "【指示】" + instruction + "\n\n" +
    "【文字】\n" + selection
  );
}

/**
 * 執行單一指令（比對 + 套用）。沒對到固定指令時，若有 AI 金鑰就走 freeform
 * （講什麼做什麼），把整句當指示套在選取上；沒選取則回報，不浪費額度。
 */
async function runSingleCommand(ctx, text) {
  const cmd = matchCommand(text);
  if (!cmd) {
    if (ctx.aiProcessor && text && text.trim()) {
      const instruction = text.trim();
      const label = "✨ " + (instruction.length > 14 ? instruction.slice(0, 14) + "…" : instruction);
      return await applyToSelection(ctx, label, (sel) =>
        ctx.aiProcessor.processTextWithAI(sel, "freeform", freeformPrompt(instruction, sel))
      );
    }
    return { matched: false };
  }

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
  let lastResult = null; // 最近一次轉換／翻譯的結果文字
  for (const seg of segments) {
    const cmd = matchCommand(seg);
    // 「複製」緊接在轉換之後：直接把已知結果寫進剪貼簿，不靠選取+Ctrl+C（最可靠）
    if (cmd && cmd.kind === "key" && cmd.keys === "^c" && lastResult != null) {
      try { clipboard.writeText(lastResult); } catch (e) { /* ignore */ }
      ran.push({ matched: true, success: true, label: "複製" });
      await delay(150);
      continue;
    }
    const r = await runSingleCommand(ctx, seg);
    if (r.matched) {
      ran.push(r);
      lastResult = typeof r.resultText === "string" ? r.resultText : null;
      await delay(350); // 等選取／按鍵／貼上生效，下一段才接得上
    }
  }

  if (ran.length === 0) return { matched: false };
  const allOk = ran.every((r) => r.success);
  const labels = ran.map((r) => r.label).join(" → ");
  const firstErr = ran.find((r) => !r.success);
  // 帶上最後的轉換結果（若有）→ 讓提示顯示「已複製」、唯讀來源也救得回
  return {
    matched: true,
    success: allOk,
    label: labels,
    error: firstErr ? firstErr.error : undefined,
    resultText: lastResult != null ? lastResult : undefined,
  };
}

module.exports = { runVoiceCommand, matchCommand, splitCommands, BUILTIN_COMMANDS };
