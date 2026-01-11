import React, { useState, useEffect, useRef } from "react";
import { X, Copy, Trash2, ChevronRight, Search, Play, Square, Download } from "lucide-react";

// 側邊欄歷史記錄組件
const HistorySidebar = ({ isOpen, onClose, t }) => {
  const [transcriptions, setTranscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTranscriptions, setFilteredTranscriptions] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  // 載入轉錄歷史
  const loadTranscriptions = async () => {
    if (!window.electronAPI) return;

    setLoading(true);
    try {
      const result = await window.electronAPI.getTranscriptions(50, 0);
      setTranscriptions(result || []);
      setFilteredTranscriptions(result || []);
    } catch (error) {
      console.error("載入歷史記錄失敗:", error);
    } finally {
      setLoading(false);
    }
  };

  // 搜尋功能
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTranscriptions(transcriptions);
    } else {
      const filtered = transcriptions.filter(item =>
        item.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.processed_text?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTranscriptions(filtered);
    }
  }, [searchQuery, transcriptions]);

  // 開啟時載入資料
  useEffect(() => {
    if (isOpen) {
      loadTranscriptions();
    } else {
      // 關閉時停止播放
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingId(null);
      }
    }
  }, [isOpen]);

  // 複製文字
  const handleCopy = async (text) => {
    try {
      if (window.electronAPI) {
        await window.electronAPI.copyText(text);
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      console.error("複製失敗:", error);
    }
  };

  // 刪除記錄
  const handleDelete = async (id) => {
    if (!window.electronAPI) return;

    try {
      await window.electronAPI.deleteTranscription(id);
      setTranscriptions(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("刪除記錄失敗:", error);
    }
  };

  // 播放音訊
  const handlePlayAudio = async (audioPath, id) => {
    if (!audioPath || !window.electronAPI) return;

    try {
      // 如果正在播放同一個，停止播放
      if (playingId === id && audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingId(null);
        return;
      }

      // 停止之前的播放
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      // 取得音訊檔案
      const result = await window.electronAPI.getAudioFile(audioPath);
      if (!result.success) {
        console.error("無法載入音訊:", result.error);
        return;
      }

      // 建立 Audio 物件並播放
      const audio = new Audio(`data:${result.mimeType};base64,${result.data}`);
      audioRef.current = audio;
      setPlayingId(id);

      audio.onended = () => {
        setPlayingId(null);
        audioRef.current = null;
      };

      audio.play();
    } catch (err) {
      console.error("播放音訊失敗:", err);
    }
  };

  // 下載音訊
  const handleDownloadAudio = async (audioPath, id) => {
    if (!audioPath || !window.electronAPI) return;

    try {
      // 顯示儲存對話框
      const result = await window.electronAPI.showSaveDialog({
        title: '儲存音訊檔案',
        defaultPath: `recording_${id}.wav`,
        filters: [{ name: '音訊檔案', extensions: ['wav'] }]
      });

      if (result.canceled || !result.filePath) return;

      // 複製檔案
      const saveResult = await window.electronAPI.saveAudioFile(audioPath, result.filePath);
      if (!saveResult.success) {
        console.error("儲存音訊失敗:", saveResult.error);
      }
    } catch (err) {
      console.error("下載音訊失敗:", err);
    }
  };

  // 格式化日期
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();

    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return timeStr;
    } else if (isYesterday) {
      return `昨天 ${timeStr}`;
    } else {
      return date.toLocaleDateString('zh-TW', {
        month: 'numeric',
        day: 'numeric'
      });
    }
  };

  return (
    <>
      {/* 遮罩層 */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* 側邊欄 */}
      <div
        className={`fixed top-0 right-0 h-full w-80 bg-white dark:bg-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out rounded-l-2xl ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* 標題列 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 chinese-title">
            {t?.('history.title') || '歷史記錄'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* 搜尋框 */}
        <div className="p-3 border-b border-gray-100 dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t?.('history.search') || '搜尋...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* 記錄列表 */}
        <div className="flex-1 overflow-y-auto h-[calc(100vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredTranscriptions.length === 0 ? (
            <div className="text-center py-8 px-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {searchQuery ? (t?.('history.noMatch') || '沒有符合的記錄') : (t?.('history.noRecords') || '還沒有歷史記錄')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredTranscriptions.map((item) => (
                <div
                  key={item.id}
                  className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  {/* 時間和操作 */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDate(item.created_at)}
                    </span>
                    <div className="flex items-center space-x-1">
                      {/* 音訊按鈕 - 如果有音訊檔案 */}
                      {item.audio_path && (
                        <>
                          <button
                            onClick={() => handlePlayAudio(item.audio_path, item.id)}
                            className={`p-1.5 rounded transition-colors ${
                              playingId === item.id
                                ? 'bg-blue-100 dark:bg-blue-900/50'
                                : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                            title={playingId === item.id ? "停止播放" : "播放音訊"}
                          >
                            {playingId === item.id ? (
                              <Square className="w-3.5 h-3.5 text-blue-500" />
                            ) : (
                              <Play className="w-3.5 h-3.5 text-blue-500" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDownloadAudio(item.audio_path, item.id)}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                            title="下載音訊"
                          >
                            <Download className="w-3.5 h-3.5 text-green-500" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleCopy(item.processed_text || item.text)}
                        className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                        title={t?.('history.copyText') || '複製'}
                      >
                        <Copy className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title={t?.('history.delete') || '刪除'}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </button>
                    </div>
                  </div>

                  {/* 文字內容 */}
                  <p className="text-sm text-gray-800 dark:text-gray-200 line-clamp-3 chinese-text">
                    {item.processed_text || item.text}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 底部：打開完整歷史視窗 */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.openHistoryWindow();
              }
              onClose();
            }}
            className="w-full flex items-center justify-center space-x-2 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
          >
            <span>{t?.('history.viewAll') || '查看完整歷史'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );
};

export default HistorySidebar;
