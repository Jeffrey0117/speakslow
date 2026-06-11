import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { useTranslation, LanguageProvider } from "./i18n";
import HistoryView from "./components/HistoryView";

// 歷史紀錄獨立視窗（內容共用 components/HistoryView）
const HistoryPage = () => {
  const { t } = useTranslation();

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeHistoryWindow();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="h-screen flex flex-col">
        {/* 標題列 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 chinese-title">
            {t('appName')} - {t('history.title')}
          </h1>
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {t('common.close')}
          </button>
        </div>

        {/* 內容 */}
        <div className="flex-1 overflow-hidden p-6">
          <div className="max-w-4xl mx-auto h-full">
            <HistoryView />
          </div>
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('history-root');
const root = createRoot(container);
root.render(
  <LanguageProvider>
    <HistoryPage />
  </LanguageProvider>
);
