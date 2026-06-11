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
    <div className={`border-2 ${borderClass} rounded-xl mb-3 bg-white dark:bg-gray-800`}>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl">{emoji}</span>
            <div>
              <div className="flex items-baseline space-x-1 flex-wrap">
                <span className="text-xs text-gray-600 dark:text-gray-400">已經幫你辨識了</span>
                <span className={`text-lg font-bold ${getNumberColorClass(color)}`}>
                  {(stats.totalChars || 0).toLocaleString()}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-400">個字</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">{message}</p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-500 dark:text-gray-400">
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

// 可分享的數據儀表板（讓使用者想截圖炫耀）
const ShareStats = ({ stats }) => {
  const totalChars = stats?.totalChars || 0;
  const totalSec = stats?.totalDuration || 0;
  const dictMin = totalSec / 60;
  const TYPING_SPEED = 30; // 一般人打中文（含思考）約 30 字/分
  const savedMin = Math.max(0, totalChars / TYPING_SPEED - dictMin);
  const wpm = dictMin > 0 ? Math.round(totalChars / dictMin) : 0;

  const fmtDur = (min) => {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return h > 0 ? `${h}<span class="text-base font-normal"> 時 </span>${m}` : `${m}`;
  };
  const fmtChars = totalChars >= 1000 ? (totalChars / 1000).toFixed(1) + 'K' : String(totalChars);

  const cards = [
    { icon: '⏱️', valueHtml: fmtDur(dictMin), unit: dictMin >= 60 ? '分' : '分鐘', label: '總口述時間' },
    { icon: '🎙️', valueHtml: fmtChars, unit: '字', label: '口述字數' },
    { icon: '⏳', valueHtml: fmtDur(savedMin), unit: savedMin >= 60 ? '分' : '分鐘', label: '節省時間' },
    { icon: '⚡', valueHtml: String(wpm), unit: '字/分', label: '平均口述速度' },
  ];

  return (
    <div className="bg-gradient-to-br from-sky-50 to-indigo-50 dark:from-gray-800 dark:to-gray-800/60 rounded-2xl p-4 border border-sky-100 dark:border-gray-700 mb-3 shadow-sm">
      <div className="grid grid-cols-2 gap-2.5">
        {cards.map((c, i) => (
          <div key={i} className="bg-white/80 dark:bg-gray-700/40 rounded-xl p-3.5">
            <div className="text-lg mb-1">{c.icon}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white leading-none">
              <span dangerouslySetInnerHTML={{ __html: c.valueHtml }} />
              <span className="text-sm font-normal text-gray-400 ml-1">{c.unit}</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-gray-400 dark:text-gray-500 text-center mt-3 select-none">
        🔒 資料只存在本機 · 聲聲慢 SpeakSlow
      </div>
    </div>
  );
};

// 每日字數趨勢圖（近 14 天）
const DailyChart = ({ data }) => {
  const today = new Date();
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const found = (data || []).find((x) => x.day === key);
    days.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, chars: found?.chars || 0 });
  }
  const max = Math.max(...days.map((d) => d.chars), 1);
  const totalRange = days.reduce((s, d) => s + d.chars, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-3.5 shadow-sm border border-gray-200 dark:border-gray-700 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">每日字數・近 14 天</span>
        <span className="text-[11px] text-gray-400">合計 {totalRange.toLocaleString()} 字</span>
      </div>
      <div className="flex items-end gap-[3px] h-20">
        {days.map((d, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col justify-end h-full group relative"
            title={`${d.label}：${d.chars.toLocaleString()} 字`}
          >
            <div
              className="w-full rounded-t bg-sky-400/80 dark:bg-sky-500/70 group-hover:bg-sky-500 transition-colors"
              style={{ height: `${(d.chars / max) * 100}%`, minHeight: d.chars > 0 ? '3px' : '0' }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-[3px] mt-1">
        {days.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-gray-400 dark:text-gray-500">
            {i % 2 === 1 ? d.label : ''}
          </div>
        ))}
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
  const [dailyStats, setDailyStats] = React.useState([]);

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
      const [result, statsResult, dailyResult] = await Promise.all([
        window.electronAPI.getTranscriptions(100, 0),
        window.electronAPI.getTranscriptionStats(),
        window.electronAPI.getDailyStats?.(14) ?? Promise.resolve([])
      ]);
      setTranscriptions(result || []);
      setFilteredTranscriptions(result || []);
      setStats(statsResult);
      setDailyStats(dailyResult || []);
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

  const [retranscribingId, setRetranscribingId] = React.useState(null);
  const [retranscribingModel, setRetranscribingModel] = React.useState(null);

  const handleRetranscribe = async (id, model) => {
    if (!window.electronAPI?.retranscribeTranscription || retranscribingId) return;
    setRetranscribingId(id);
    setRetranscribingModel(model || 'paraformer');
    try {
      const opts = model === 'whisper' ? { model: 'whisper' } : {};
      const res = await window.electronAPI.retranscribeTranscription(id, opts);
      if (res?.success) {
        const prevText = transcriptions.find(it => it.id === id)?.text || '';
        setTranscriptions(prev =>
          prev.map(it => (it.id === id ? { ...it, text: res.text, processed_text: null } : it))
        );
        const same = (res.text || '').trim() === prevText.trim();
        const prefix = model === 'whisper' ? 'Whisper ' : '';
        const tip = document.createElement('div');
        tip.textContent = prefix + (same ? '已重新辨識（結果相同）' : '已重新辨識並更新');
        tip.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#10b981;color:#fff;padding:8px 16px;border-radius:9999px;font-size:13px;z-index:9999';
        document.body.appendChild(tip);
        setTimeout(() => tip.remove(), 2200);
      } else {
        console.warn("重新辨識失敗:", res?.error);
        const tip = document.createElement('div');
        tip.textContent = res?.error || '重新辨識失敗';
        tip.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#ef4444;color:#fff;padding:8px 16px;border-radius:9999px;font-size:13px;z-index:9999';
        document.body.appendChild(tip);
        setTimeout(() => tip.remove(), 2500);
      }
    } catch (e) {
      console.error("重新辨識錯誤:", e);
    } finally {
      setRetranscribingId(null);
      setRetranscribingModel(null);
    }
  };

  const formatDate = (dateString) => {
    // SQLite CURRENT_TIMESTAMP 是 UTC 的 "YYYY-MM-DD HH:MM:SS"，要當 UTC 解析再轉本地
    const date = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateString || '')
      ? new Date(dateString.replace(' ', 'T') + 'Z')
      : new Date(dateString);
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
        {!loading && stats && <ShareStats stats={stats} />}
        {!loading && stats && <StatsBanner stats={stats} />}
        {!loading && dailyStats.length > 0 && <DailyChart data={dailyStats} />}

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
          <div className="space-y-2.5">
            {filteredTranscriptions.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-lg p-3.5 shadow-sm hover:shadow-md transition-shadow border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between mb-2">
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
                    {item.audio_path && (
                      <>
                        <button
                          onClick={() => handleRetranscribe(item.id, 'paraformer')}
                          disabled={retranscribingId === item.id}
                          className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors disabled:opacity-50"
                          title="快速重辨（Paraformer）"
                        >
                          <svg
                            className={`w-4 h-4 text-blue-500 dark:text-blue-400 ${retranscribingId === item.id && retranscribingModel === 'paraformer' ? 'animate-spin' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRetranscribe(item.id, 'whisper')}
                          disabled={retranscribingId === item.id}
                          className="p-2 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors disabled:opacity-50"
                          title="精準重辨（Whisper，較慢，對英文/難句更好）"
                        >
                          <svg
                            className={`w-4 h-4 text-purple-500 dark:text-purple-400 ${retranscribingId === item.id && retranscribingModel === 'whisper' ? 'animate-spin' : ''}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                          </svg>
                        </button>
                      </>
                    )}
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

                <div>
                  <p
                    className="chinese-content bg-gray-50 dark:bg-gray-700/60 p-2.5 rounded-lg border dark:border-gray-600/30"
                    style={{ fontSize: '13px', lineHeight: 1.6, letterSpacing: '0.02em', whiteSpace: 'pre-wrap' }}
                  >
                    {item.text}
                  </p>
                </div>

                {item.processed_text && item.processed_text.trim() !== (item.raw_text || '').trim() && (
                  <div className="mt-2">
                    <h4 className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">{t('history.aiOptimized')}：</h4>
                    <p
                      className="chinese-content bg-emerald-50 dark:bg-emerald-900/20 p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-700"
                      style={{ fontSize: '13px', lineHeight: 1.6, letterSpacing: '0.02em', whiteSpace: 'pre-wrap' }}
                    >
                      {item.processed_text}
                    </p>
                  </div>
                )}

                {item.raw_text && item.raw_text.trim() !== item.text.trim() && (
                  <div className="mt-2">
                    <p
                      className="chinese-content bg-gray-100 dark:bg-gray-700/40 p-2.5 rounded-lg border dark:border-gray-600/20 text-gray-600 dark:text-gray-200"
                      style={{ fontSize: '12px', lineHeight: 1.55, letterSpacing: '0.02em' }}
                    >
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
