const { spawn } = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

let _current = null;

/**
 * 用 Windows 內建 SAPI 朗讀文字（免費、免相依、免網路）。
 * CJK 安全：文字寫成 UTF-8 暫存檔，PowerShell 以 UTF-8 讀回，避免編碼亂碼。
 * 偏好繁體中文語音（系統有的話），抓不到就用預設。
 */
function speakSapi(text) {
  if (process.platform !== "win32") {
    return { success: false, error: "目前只支援 Windows 朗讀" };
  }
  if (!text || !text.trim()) {
    return { success: false, error: "沒有文字可朗讀" };
  }
  try {
    // 先停掉上一段，避免兩段疊著念
    if (_current && !_current.killed) {
      try { _current.kill(); } catch (e) { /* ignore */ }
    }
    const tmp = path.join(os.tmpdir(), "speakslow_tts.txt");
    fs.writeFileSync(tmp, text, "utf8");
    const tmpEsc = tmp.replace(/\\/g, "\\\\");
    const script =
      "$t=[System.IO.File]::ReadAllText('" + tmpEsc + "',[System.Text.Encoding]::UTF8);" +
      "Add-Type -AssemblyName System.Speech;" +
      "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer;" +
      "try{$s.SelectVoiceByHints('NotSet','NotSet',0,(New-Object System.Globalization.CultureInfo('zh-TW')))}catch{};" +
      "$s.Speak($t)";
    const ps = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", script], {
      windowsHide: true,
    });
    ps.on("error", () => { /* ignore */ });
    _current = ps;
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function stopSpeaking() {
  if (_current && !_current.killed) {
    try { _current.kill(); } catch (e) { /* ignore */ }
  }
  _current = null;
}

module.exports = { speakSapi, stopSpeaking };
