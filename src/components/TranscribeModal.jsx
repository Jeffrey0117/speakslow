import React from "react";
import { useTranslation } from "../i18n";

// 把 Float32 PCM 重採樣到 16kHz、包成 16-bit mono WAV（與錄音用同一套規格）
function pcmToWav(float32, srcRate, dstRate = 16000) {
  const ratio = srcRate / dstRate;
  const outLen = Math.floor(float32.length / ratio);
  const int16 = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, float32.length - 1);
    const frac = idx - lo;
    const s = float32[lo] * (1 - frac) + float32[hi] * frac;
    int16[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32767)));
  }
  const dataSize = int16.length * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  const ws = (off, str) => { for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i)); };
  ws(0, "RIFF"); v.setUint32(4, 36 + dataSize, true); ws(8, "WAVE");
  ws(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, dstRate, true); v.setUint32(28, dstRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  ws(36, "data"); v.setUint32(40, dataSize, true);
  new Int16Array(buf, 44).set(int16);
  return new Uint8Array(buf);
}

// 秒數 -> SRT 時間格式 00:00:00,000
function secToSrt(sec) {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msr = ms % 1000;
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(msr, 3)}`;
}

// segments [{start,end,text}] -> SRT 字串（重新編號）
function buildSrt(segs) {
  return segs
    .map((g, i) => `${i + 1}\n${secToSrt(g.start)} --> ${secToSrt(g.end)}\n${g.text}`)
    .join("\n\n") + (segs.length ? "\n" : "");
}

const CHUNK_SEC = 60;

export default function TranscribeModal({ onClose }) {
  const { t } = useTranslation();
  const [status, setStatus] = React.useState("idle"); // idle|decoding|transcribing|done|error
  const [progress, setProgress] = React.useState(0);
  const [transcript, setTranscript] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [errMsg, setErrMsg] = React.useState("");
  const [mode, setMode] = React.useState("txt"); // txt | srt
  const cancelRef = React.useRef(false);
  const fileInputRef = React.useRef(null);
  const modeRef = React.useRef("txt");
  modeRef.current = mode;

  const run = React.useCallback(async (file) => {
    if (!file) return;
    cancelRef.current = false;
    setFileName(file.name);
    setStatus("decoding");
    setTranscript("");
    setProgress(0);
    setErrMsg("");
    try {
      const arrayBuffer = await file.arrayBuffer();
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      let audioBuf;
      try {
        audioBuf = await ctx.decodeAudioData(arrayBuffer);
      } finally {
        ctx.close();
      }
      const srcRate = audioBuf.sampleRate;
      const data = audioBuf.getChannelData(0); // 取第一聲道
      const srt = modeRef.current === "srt";
      // 切 60 秒一段（給進度 + 控記憶體；邊界偶有小瑕疵，v1 可接受）
      const chunkSamples = CHUNK_SEC * srcRate;
      const totalChunks = Math.max(1, Math.ceil(data.length / chunkSamples));
      setStatus("transcribing");
      let out = "";          // 逐字稿模式累積文字
      const allSegs = [];    // 字幕模式累積 segment（含全域時間軸）
      for (let i = 0; i < totalChunks; i++) {
        if (cancelRef.current) { setStatus("idle"); return; }
        const slice = data.subarray(i * chunkSamples, Math.min((i + 1) * chunkSamples, data.length));
        const wav = pcmToWav(slice, srcRate, 16000);
        const offset = i * CHUNK_SEC; // 此段在整檔的起始秒數
        try {
          const res = await window.electronAPI?.transcribeAudio?.(wav, srt ? { segments: true, no_persist: true } : { no_persist: true });
          if (res?.success && srt && Array.isArray(res.segments)) {
            for (const g of res.segments) {
              if (g?.text?.trim()) allSegs.push({ start: g.start + offset, end: g.end + offset, text: g.text.trim() });
            }
            setTranscript(buildSrt(allSegs));
          } else if (res?.success && res.text && res.text.trim()) {
            out += (out ? "\n" : "") + res.text.trim();
            setTranscript(out);
          }
        } catch (e) { /* 單段失敗就跳過，繼續 */ }
        setProgress(Math.round(((i + 1) / totalChunks) * 100));
      }
      setStatus("done");
    } catch (e) {
      setErrMsg(e?.message || String(e));
      setStatus("error");
    }
  }, []);

  const onPick = (e) => { const f = e.target.files?.[0]; if (f) run(f); };
  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) run(f);
  };

  const copyAll = async () => {
    try { await window.electronAPI?.copyText?.(transcript); } catch (e) { /* ignore */ }
  };
  const exportTxt = () => {
    try {
      const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (fileName ? fileName.replace(/\.[^.]+$/, "") : "transcript") + (mode === "srt" ? ".srt" : ".txt");
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { /* ignore */ }
  };

  const busy = status === "decoding" || status === "transcribing";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900 rounded-xl overflow-hidden" style={{ WebkitAppRegion: "no-drag" }}>
      {/* 標題列（可拖曳移動視窗） */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-gray-700 shrink-0" style={{ WebkitAppRegion: "drag" }}>
        <div className="flex items-center gap-2 min-w-0">
          <img src="./icon.png" alt="" className="w-5 h-5 rounded-md shrink-0" draggable="false" />
          <span className="brand-title text-base font-bold text-gray-900 dark:text-gray-100">{t("appName")}</span>
        </div>
        <button onClick={onClose} style={{ WebkitAppRegion: "no-drag" }} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col p-3 gap-2">
        {/* 拖放 / 選檔 */}
        {status === "idle" || status === "error" ? (
          <>
          {/* 輸出格式：逐字稿 / 字幕 SRT */}
          <div className="shrink-0 flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm">
            {[["txt", t("transcribe.outTxt")], ["srt", t("transcribe.outSrt")]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`flex-1 px-3 py-1.5 rounded-md transition-colors ${
                  mode === k
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-medium shadow-sm"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="shrink-0 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl py-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-colors"
          >
            <div className="text-3xl mb-1">🎬</div>
            <div className="text-sm text-gray-600 dark:text-gray-300">{t("transcribe.drop")}</div>
            <div className="text-xs text-gray-400 mt-1">{t("transcribe.formats")}</div>
            {status === "error" && (
              <div className="mt-2">
                <div className="text-xs text-red-500">{t("transcribe.failed")}：{errMsg}</div>
                <div className="text-xs text-gray-400 mt-1">{t("transcribe.failedHint")}</div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="video/*,audio/*,.mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a,.ogg,.flac" className="hidden" onChange={onPick} />
          </div>
          </>
        ) : (
          <div className="shrink-0">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
              <span className="truncate max-w-[60%]">{fileName}</span>
              <span>{status === "decoding" ? t("transcribe.decoding") : `${progress}%`}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${status === "decoding" ? 5 : progress}%` }} />
            </div>
          </div>
        )}

        {/* 逐字稿結果 */}
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder={t("transcribe.empty")}
          className="flex-1 min-h-0 w-full resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-sm text-gray-800 dark:text-gray-200 leading-relaxed outline-none"
          style={{ whiteSpace: "pre-wrap" }}
        />

        {/* 動作列 */}
        <div className="shrink-0 flex items-center gap-2">
          {busy ? (
            <button onClick={() => { cancelRef.current = true; }} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
              {t("transcribe.stop")}
            </button>
          ) : (
            <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
              {t("transcribe.another")}
            </button>
          )}
          <div className="flex-1" />
          <button disabled={!transcript} onClick={copyAll} className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 disabled:opacity-40">{t("transcribe.copy")}</button>
          <button disabled={!transcript} onClick={exportTxt} className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-40">{mode === "srt" ? t("transcribe.exportSrt") : t("transcribe.export")}</button>
        </div>
      </div>
    </div>
  );
}
