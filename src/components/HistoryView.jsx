import React from "react";
import { useTranslation } from "../i18n";

// 統計橫幅組件 - 用幽默方式展示成就
const StatsBanner = ({ stats }) => {
  const getLevelInfo = (chars) => {
    if (chars === 0) return { emoji: '🤫', message: '別害羞，說點什麼吧～', color: 'gray', borderClass: 'border-gray-300 dark:border-gray-600' };
    if (chars < 100) return { emoji: '👋', message: '才剛認識你，期待聽更多！', color: 'gray', borderClass: 'border-gray-300 dark:border-gray-600' };
    if (chars < 500) return { emoji: '🗣️', message: '話匣子慢慢打開了～', color: 'green', borderClass: 'border-green-400 dark:border-green-500' };
    if (chars < 1000) return { emoji: '💬', message: '看來你蠻有話說的嘛！', color: 'green', borderClass: 'border-green-400 dark:border-green-500' };
    if (chars < 2000) return { emoji: '📢', message: '你說的比寫的多，手指感謝你', color: 'blue', borderClass: 'border-blue-400 dark:border-blue-500' };
    if (chars < 5000) return { emoji: '🎙️', message: '話很多欸！但我喜歡聽', color: 'blue', borderClass: 'border-blue-400 dark:border-blue-500' };
    if (chars < 10000) return { emoji: '📚', message: '這些字夠寫一篇論文了', color: 'purple', borderClass: 'border-purple-400 dark:border-purple-500' };
    if (chars < 30000) return { emoji: '🎓', message: '你是不是哲學大師？思想真多', color: 'purple', borderClass: 'border-purple-400 dark:border-purple-500' };
    if (chars < 50000) return { emoji: '✍️', message: '可以出書了，書名就叫《我說的》', color: 'orange', borderClass: 'border-orange-400 dark:border-orange-500' };
    if (chars < 100000) return { emoji: '🏛️', message: '你的語錄比孔子還多', color: 'orange', borderClass: 'border-orange-400 dark:border-orange-500' };
    return { emoji: '🌟', message: '傳說中的話癆本癆，致敬！', color: 'amber', borderClass: 'border-amber-400 dark:border-amber-500' };
  };

  const getNumberColorClass = (color) => {
    const colorMap = {
      gray: 'text-gray-600 dark:text-gray-400',
      green: 'text-green-600 dark:text-green-400',
      blue: 'text-blue-600 dark:text-blue-400',
      purple: 'text-purple-600 dark:text-purple-400',
      orange: 'text-orange-600 dark:text-orange-400',
      amber: 'text-amber-600 dark:text-amber-400'
    };
    return colorMap[color] || colorMap.gray;
  };

  const { emoji, message, color, borderClass } = getLevelInfo(stats?.totalChars || 0);

  if (!stats || stats.total === 0) {
    return null;
  }

  return (
    <div className={`border-2 ${borderClass} rounded-xl mb-4 bg-white dark:bg-gray-800`}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{emoji}</span>
            <div>
              <div className="flex items-baseline space-x-1 flex-wrap">
                <span className="text-sm text-gray-600 dark:text-gray-400">已經幫你辨識了</span>
                <span className={`text-2xl font-bold ${getNumberColorClass(color)}`}>
                  {(stats.totalChars || 0).toLocaleString()}
                </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">個字</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">{message}</p>
            </div>
          </div>
          <div className="text-right text-sm text-gray-500 dark:text-gray-400">
            <div>{stats.total || 0} 次辨識</div>
            {(stats.totalDuration || 0) > 0 && (
              <div>累計 {Math.round((stats.totalDuration || 0) / 60)} 分鐘</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * 歷史紀錄內容（自帶翻譯與複製），可嵌入任何容器（設定分頁、獨立視窗）。
 */
export const HistoryView = () => {
  const { t } = useTranslation();
  const [transcriptions, setTranscriptions] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [filteredTranscriptions, setFilteredTranscriptions] = React.useState([]);
  const [stats, setStats] = React.useState(null);

  const handleCopy = async (text) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.copyText(text);
        const toast = document.createElement('div');
        toast.textContent = t('notifications.copied');
        toast.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        document.body.appendChild(toast);
        setTimeout(() => { try { document.body.removeChild(toast); } catch (e) {} }, 2000);
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      console.error("複製失敗:", error);
    }
  };

  const loadTranscriptions = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const [result, statsResult] = await Promise.all([
        window.electronAPI.getTranscriptions(100, 0),
        window.electronAPI.getTranscriptionStats()
      ]);
      setTranscriptions(result || []);
      setFilteredTranscriptions(result || []);
      setStats(statsResult);
    } catch (error) {
      console.error("載入歷史紀錄失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTranscriptions(transcriptions);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredTranscriptions(
        transcriptions.filter(item =>
          item.text?.toLowerCase().includes(q) ||
          item.processed_text?.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery, transcriptions]);

  React.useEffect(() => {
    loadTranscriptions();
  }, []);

  const handleDelete = async (id) => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.deleteTranscription(id);
      setTranscriptions(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("刪除紀錄失敗:", error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    const timeStr = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

    if (isToday) return timeStr;
    if (isYesterday) return `昨天 ${timeStr}`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) + ' ' + timeStr;
  };

  return (
    <div className="h-full flex flex-col">
      {/* 搜尋列 */}
      <div className="pb-4 mb-2 border-b border-gray-100 dark:border-gray-700">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={t('history.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent chinese-text"
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {t('history.total')}{filteredTranscriptions.length}{t('history.records')}
          </span>
          <button
            onClick={() => { if (window.electronAPI) window.electronAPI.exportTranscriptions('txt'); }}
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
          >
            {t('app.export')}
          </button>
        </div>
      </div>

      {/* 內容區 */}
      <div className="flex-1 overflow-y-auto">
        {!loading && stats && <StatsBanner stats={stats} />}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">{t('common.loading')}</span>
          </div>
        ) : filteredTranscriptions.length === 0 ? (
          <div className="text-center py-12">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 chinese-text">
              {searchQuery ? t('history.noMatch') : t('history.noRecords')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTranscriptions.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>{formatDate(item.created_at)}</span>
                    {item.confidence && (
                      <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-1 rounded text-xs">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleCopy(item.processed_text || item.text)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title={t('history.copyText')}
                    >
                      <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title={t('history.delete')}
                    >
                      <svg className="w-4 h-4 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="chinese-content leading-relaxed bg-gray-50 dark:bg-gray-700/60 p-4 rounded-lg border dark:border-gray-600/30">
                    {item.text}
                  </p>
                </div>

                {item.processed_text && item.processed_text.trim() !== (item.raw_text || '').trim() && (
                  <div className="mb-3">
                    <h4 className="text-sm font-medium text-emerald-700 dark:text-emerald-400 mb-2">{t('history.aiOptimized')}：</h4>
                    <p className="chinese-content leading-relaxed bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-700">
                      {item.processed_text}
                    </p>
                  </div>
                )}

                {item.raw_text && item.raw_text.trim() !== item.text.trim() && (
                  <div>
                    <p className="text-xs chinese-content leading-relaxed bg-gray-100 dark:bg-gray-700/40 p-3 rounded-lg border dark:border-gray-600/20 text-gray-600 dark:text-gray-200">
                      {item.raw_text}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
