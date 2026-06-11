import React from "react";

/**
 * TypeLess 錄音指示器組件
 * 顯示一個小型的錄音狀態指示器，出現在螢幕右上角
 */
const TypelessIndicator = () => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="pill-bounce bg-red-500 backdrop-blur-sm rounded-full px-5 py-2 flex items-center gap-2.5 border border-red-400/60">
        {/* 靜止白點（不跳動）*/}
        <div className="w-3 h-3 bg-white rounded-full" />

        {/* 文字 */}
        <span className="text-white font-semibold text-[15px] whitespace-nowrap tracking-wide">
          錄音中...
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
                animationDuration: '0.6s',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TypelessIndicator;
