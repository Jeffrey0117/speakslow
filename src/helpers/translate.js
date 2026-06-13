/**
 * 免費翻譯（Google translate gtx 端點）— 免金鑰、自動偵測來源語言。
 * 操作模式的「翻成英文/中文/日文」用這個，不燒使用者的 AI 額度。
 *
 * 端點：translate.googleapis.com/translate_a/single?client=gtx
 *   sl=auto（自動偵測來源）, tl=目標語言, dt=t（要翻譯結果）
 *   回傳是巢狀陣列：data[0] 是分段，每段 [譯文, 原文, ...]，串起來即全文。
 */

async function translateFree(text, tl) {
  if (!text || !text.trim()) return { success: false, error: "沒有可翻譯的文字" };
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    "?client=gtx&sl=auto&dt=t" +
    "&tl=" + encodeURIComponent(tl) +
    "&q=" + encodeURIComponent(text);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { success: false, error: `翻譯服務錯誤（${res.status}）` };
    }
    const data = await res.json();
    const segments = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];
    const out = segments
      .map((seg) => (Array.isArray(seg) ? seg[0] : ""))
      .join("");
    if (!out || !out.trim()) {
      return { success: false, error: "翻譯回傳空白" };
    }
    return { success: true, text: out };
  } catch (e) {
    const msg = e.name === "TimeoutError" ? "翻譯逾時（網路？）" : e.message;
    return { success: false, error: msg };
  }
}

module.exports = { translateFree };
