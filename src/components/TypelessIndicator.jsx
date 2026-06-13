import React, { useEffect, useState } from "react";
import { useTranslation } from "../i18n";

/**
 * TypeLess 錄音指示器組件（講話時跳出來的「藥丸」）
 * 一般聽寫：紅色「錄音中」。
 * 操作模式：淺藍 + 虛線框 +「聽指令」，一眼分辨你是在下指令而非聽寫。
 */
const TypelessIndicator = () => {
  const { t } = useTranslation();
  const [commandMode, setCommandMode] = useState(false);

  // 操作模式狀態由主行程廣播（主視窗 toggle / 指示器顯示時推送）
  useEffect(() => {
    let unsub = null;
    window.electronAPI
      ?.getCommandMode?.()
      .then((v) => { if (typeof v === "boolean") setCommandMode(v); })
      .catch(() => {});
    unsub = window.electronAPI?.onCommandModeChanged?.((v) => setCommandMode(!!v));
    return () => { if (typeof unsub === "function") unsub(); };
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center">
      <div
        className={`pill-bounce backdrop-blur-sm rounded-full px-5 py-2 flex items-center gap-2.5 ${
          commandMode
            ? "bg-sky-400 border border-sky-300/60"
            : "bg-red-500 border border-red-400/60"
        }`}
      >
        {/* 靜止白點（不跳動）*/}
        <div className="w-3 h-3 bg-white rounded-full" />

        {/* 文字 */}
        <span className="text-white font-semibold text-[15px] whitespace-nowrap tracking-wide">
          {commandMode ? t("panel.commandListening") : t("panel.recordingIndicator")}
        </span>

        {/* 聲波動畫 */}
        <div className="flex items-center gap-0.5">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-white/80 rounded-full animate-pulse"
              style={{
                height: `${12 + Math.random() * 8}px`,
                animationDelay: `${i * 0.15}s`,
                animationDuration: "0.6s",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TypelessIndicator;
