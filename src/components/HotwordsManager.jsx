import React, { useState, useEffect, useCallback } from "react";
import { Target, Plus, X, AlertTriangle, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

/**
 * 熱詞管理組件
 * 用於管理熱詞列表，提升特定詞彙的辨識準確度
 */
const HotwordsManager = ({ t }) => {
  const [hotwordsEnabled, setHotwordsEnabled] = useState(true);
  const [hotwords, setHotwords] = useState([]);
  const [hotwordsScore, setHotwordsScore] = useState(1.5);
  const [newWord, setNewWord] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 載入熱詞設定
  const loadHotwords = useCallback(async () => {
    if (!window.electronAPI) return;

    setLoading(true);
    try {
      const result = await window.electronAPI.getHotwords();
      if (result.success) {
        setHotwordsEnabled(result.enabled !== false);
        setHotwords(result.words || []);
        setHotwordsScore(result.score || 1.5);
      }
    } catch (error) {
      console.error("載入熱詞設定失敗:", error);
      toast.error(t?.("settings.hotwords.loadFailed") || "載入熱詞設定失敗");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadHotwords();
  }, [loadHotwords]);

  // 切換啟用狀態
  const handleToggleEnabled = async () => {
    const newEnabled = !hotwordsEnabled;
    setHotwordsEnabled(newEnabled);

    try {
      if (window.electronAPI) {
        await window.electronAPI.setHotwords({
          enabled: newEnabled,
          score: hotwordsScore,
          words: hotwords,
        });
        toast.success(
          newEnabled
            ? t?.("settings.hotwords.enabled") || "熱詞功能已啟用"
            : t?.("settings.hotwords.disabled") || "熱詞功能已停用"
        );
      }
    } catch (error) {
      console.error("更新熱詞設定失敗:", error);
      setHotwordsEnabled(!newEnabled); // 還原狀態
    }
  };

  // 新增熱詞
  const addHotword = async () => {
    const word = newWord.trim();
    if (!word) return;

    // 檢查重複
    if (hotwords.includes(word)) {
      toast.error(t?.("settings.hotwords.duplicate") || "此熱詞已存在");
      return;
    }

    // 檢查長度
    if (word.length < 2) {
      toast.error(t?.("settings.hotwords.tooShort") || "熱詞至少需要 2 個字元");
      return;
    }

    if (word.length > 10) {
      toast.error(t?.("settings.hotwords.tooLong") || "熱詞不應超過 10 個字元");
      return;
    }

    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.addHotword(word);
        if (result.success) {
          setHotwords(result.words || [...hotwords, word]);
          setNewWord("");
          toast.success(t?.("settings.hotwords.added") || `已新增熱詞：${word}`);
        } else {
          toast.error(result.error || t?.("settings.hotwords.addFailed") || "新增失敗");
        }
      } else {
        // 本地模式（無 Electron API）
        setHotwords([...hotwords, word]);
        setNewWord("");
      }
    } catch (error) {
      console.error("新增熱詞失敗:", error);
      toast.error(t?.("settings.hotwords.addFailed") || "新增熱詞失敗");
    }
  };

  // 刪除熱詞
  const removeHotword = async (word) => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.removeHotword(word);
        if (result.success) {
          setHotwords(result.words || hotwords.filter((w) => w !== word));
          toast.success(t?.("settings.hotwords.removed") || `已移除熱詞：${word}`);
        } else {
          toast.error(result.error || t?.("settings.hotwords.removeFailed") || "刪除失敗");
        }
      } else {
        // 本地模式
        setHotwords(hotwords.filter((w) => w !== word));
      }
    } catch (error) {
      console.error("刪除熱詞失敗:", error);
      toast.error(t?.("settings.hotwords.removeFailed") || "刪除熱詞失敗");
    }
  };

  // 更新熱詞強度
  const handleScoreChange = async (newScore) => {
    const score = parseFloat(newScore);
    setHotwordsScore(score);

    // 延遲儲存，避免頻繁更新
    if (window.scoreUpdateTimeout) {
      clearTimeout(window.scoreUpdateTimeout);
    }

    window.scoreUpdateTimeout = setTimeout(async () => {
      try {
        if (window.electronAPI) {
          await window.electronAPI.setHotwords({
            enabled: hotwordsEnabled,
            score: score,
            words: hotwords,
          });
        }
      } catch (error) {
        console.error("更新熱詞強度失敗:", error);
      }
    }, 500);
  };

  // 取得強度描述
  const getScoreLabel = (score) => {
    if (score <= 1.3) return t?.("settings.hotwords.scoreMild") || "輕微";
    if (score <= 1.7) return t?.("settings.hotwords.scoreLow") || "偏低";
    if (score <= 2.3) return t?.("settings.hotwords.scoreMedium") || "中等";
    if (score <= 2.7) return t?.("settings.hotwords.scoreHigh") || "偏高";
    return t?.("settings.hotwords.scoreStrong") || "強烈";
  };

  // Enter 鍵新增
  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      addHotword();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="hotwords-manager">
      {/* 標題與說明 */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 chinese-title">
            {t?.("settings.hotwords.title") || "熱詞設定"}
          </h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t?.("settings.hotwords.description") ||
            "提升特定詞彙的辨識準確度，適用於專有名詞、人名、公司名稱等"}
        </p>
      </div>

      {/* 啟用開關 */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {t?.("settings.hotwords.enable") || "啟用熱詞"}
          </span>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {t?.("settings.hotwords.enableDesc") || "開啟後熱詞會在辨識時生效"}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={hotwordsEnabled}
          onClick={handleToggleEnabled}
          className={`${
            hotwordsEnabled ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-600"
          } relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2`}
        >
          <span
            aria-hidden="true"
            className={`${
              hotwordsEnabled ? "translate-x-4" : "translate-x-0"
            } inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
          />
        </button>
      </div>

      {/* 熱詞列表 */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t?.("settings.hotwords.list") || "熱詞列表"} ({hotwords.length}/50)
        </label>

        {hotwords.length === 0 ? (
          <div className="text-center py-6 px-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
            <Target className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t?.("settings.hotwords.empty") || "尚未新增任何熱詞"}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {t?.("settings.hotwords.emptyHint") ||
                "在下方輸入框新增常用的專有名詞"}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 max-h-40 overflow-y-auto">
            {hotwords.map((word) => (
              <div
                key={word}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm group hover:bg-orange-200 dark:hover:bg-orange-900/50 transition-colors"
              >
                <span>{word}</span>
                <button
                  onClick={() => removeHotword(word)}
                  className="ml-0.5 p-0.5 rounded-full hover:bg-orange-300 dark:hover:bg-orange-800 transition-colors"
                  title={t?.("settings.hotwords.remove") || "移除"}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新增熱詞 */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t?.("settings.hotwords.placeholder") || "輸入新詞彙..."}
            maxLength={10}
            disabled={hotwords.length >= 50}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          onClick={addHotword}
          disabled={!newWord.trim() || hotwords.length >= 50}
          className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          {t?.("settings.hotwords.add") || "新增"}
        </button>
      </div>

      {/* 熱詞強度 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            {t?.("settings.hotwords.score") || "熱詞強度"}
          </label>
          <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
            {hotwordsScore.toFixed(1)} - {getScoreLabel(hotwordsScore)}
          </span>
        </div>
        <input
          type="range"
          min="1.0"
          max="3.0"
          step="0.1"
          value={hotwordsScore}
          onChange={(e) => handleScoreChange(e.target.value)}
          className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
          <span>1.0 {t?.("settings.hotwords.scoreMild") || "輕微"}</span>
          <span>2.0 {t?.("settings.hotwords.scoreMedium") || "中等"}</span>
          <span>3.0 {t?.("settings.hotwords.scoreStrong") || "強烈"}</span>
        </div>
      </div>

      {/* 警告提示 */}
      {hotwords.length > 30 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {t?.("settings.hotwords.warning") ||
              "熱詞過多可能影響辨識速度，建議不超過 50 個"}
          </p>
        </div>
      )}

      {/* 使用說明 */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>{t?.("settings.hotwords.tipTitle") || "使用提示"}：</strong>
          {t?.("settings.hotwords.tipContent") ||
            "熱詞適合 2-10 個字的專有名詞。強度越高辨識優先度越高，但可能導致誤判。建議從中等強度開始調整。"}
        </p>
      </div>
    </div>
  );
};

export default HotwordsManager;
