import React from "react";

/**
 * TypeLess 錄音指示器組件
 * 顯示一個小型的錄音狀態指示器，出現在螢幕右上角
 */
const TypelessIndicator = () => {
  return (
    <div className="w-full h-full flex items-center justify-center">
      <div className="bg-red-500/95 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-3 shadow-2xl border border-red-400/50">
        {/* 錄音圓點動畫 */}
        <div className="relative">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
          <div className="absolute inset-0 w-3 h-3 bg-white rounded-full animate-ping opacity-75" />
        </div>

        {/* 文字 */}
        <span className="text-white font-medium text-sm whitespace-nowrap">
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
