const { clipboard } = require("electron");

/**
 * 操作模式（語音指令）派發層 —— 刻意保持「瘦」。
 *
 * 設計界線（別讓它長肥）：
 *  - 預設關閉，不開的人完全感覺不到它。
 *  - 核心只做「扳機」：聽到觸發詞 → 抓選取 → 餵給轉換 → 貼回去。
 *  - 內建指令極少（目前只有簡繁互轉，因為 opencc 本來就在 sherpa server 裡）。
 *    其他能力一律靠外部腳本（之後接 stdin/stdout 過濾器 / webhook），不在這裡擴張。
 *
 * 一條指令 = { triggers:[...], kind:'transform', mode:'to_traditional', label:'轉成繁體' }
 */

// 內建指令表（v0 玩具版，只有簡繁互轉）
const BUILTIN_COMMANDS = [
  {
    triggers: ["轉成繁體", "轉為繁體", "變成繁體", "簡體變繁體", "簡轉繁", "轉繁體", "轉繁"],
    kind: "transform",
    mode: "to_traditional",
    label: "轉成繁體",
  },
  {
    triggers: ["轉成簡體", "轉為簡體", "變成簡體", "繁體變簡體", "繁轉簡", "轉簡體", "轉簡"],
    kind: "transform",
    mode: "to_simplified",
    label: "轉成簡體",
  },
];

// 正規化辨識結果：去空白、去標點、轉小寫，方便「包含」比對
function normalize(text) {
  return (text || "")
    .replace(/[\s。，、！？；：．,.!?;:]/g, "")
    .toLowerCase()
    .trim();
}

function matchCommand(text) {
  const norm = normalize(text);
  if (!norm) return null;
  for (const cmd of BUILTIN_COMMANDS) {
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
 * 執行一條轉換指令：抓選取 → 轉換 → 貼回去取代選取。
 * 全程重用既有的常駐 PowerShell（還原焦點 + SendKeys）與 sherpa opencc。
 */
async function runTransform(ctx, cmd) {
  const { clipboardManager, sherpaManager } = ctx;

  // 1) 記住使用者原本的剪貼簿，最後還原
  const userClipboard = clipboard.readText();

  // 2) 還原焦點到剛剛打字的視窗 + Ctrl+C，把選取抓進剪貼簿
  const copied = clipboardManager.focusAndCopyFast();
  if (!copied) {
    return { matched: true, success: false, label: cmd.label, error: "無法複製選取（PowerShell 未就緒）" };
  }
  await delay(220); // 等 Ctrl+C 寫入剪貼簿

  const selection = clipboard.readText();
  if (!selection || selection.trim() === "") {
    // 還原使用者原本的剪貼簿
    clipboard.writeText(userClipboard);
    return { matched: true, success: false, label: cmd.label, error: "沒有選取到文字" };
  }

  // 3) 丟給 sherpa（opencc）轉換
  let transformed;
  try {
    const res = await sherpaManager.transformText(selection, cmd.mode);
    if (!res || !res.success || typeof res.text !== "string") {
      clipboard.writeText(userClipboard);
      return { matched: true, success: false, label: cmd.label, error: (res && res.error) || "轉換失敗" };
    }
    transformed = res.text;
  } catch (e) {
    clipboard.writeText(userClipboard);
    return { matched: true, success: false, label: cmd.label, error: e.message };
  }

  // 4) 貼回去取代選取（pasteText 會自己還原焦點 + Ctrl+V）
  try {
    await clipboardManager.pasteText(transformed);
  } catch (e) {
    return { matched: true, success: false, label: cmd.label, error: "貼上失敗：" + e.message };
  }

  // 5) 蓋過 pasteText 的內部還原，把使用者「真正原本」的剪貼簿補回去
  setTimeout(() => {
    try { clipboard.writeText(userClipboard); } catch (e) { /* ignore */ }
  }, 700);

  return { matched: true, success: true, label: cmd.label };
}

/**
 * 入口：拿到一段辨識文字，比對 + 執行。
 * @returns {{matched:boolean, success?:boolean, label?:string, error?:string}}
 */
async function runVoiceCommand(ctx, text) {
  const cmd = matchCommand(text);
  if (!cmd) return { matched: false };
  if (cmd.kind === "transform") return await runTransform(ctx, cmd);
  return { matched: false };
}

module.exports = { runVoiceCommand, matchCommand, BUILTIN_COMMANDS };
