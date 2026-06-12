import React, { useState, useEffect, useCallback } from "react";
import { Search, Plus, Trash2, Edit2, Check, X, ToggleLeft, ToggleRight, Download, Upload } from "lucide-react";

/**
 * 字典管理組件
 * 用於管理詞彙替換規則，校正語音辨識結果中的專有名詞
 */
const DictionaryManager = ({ t }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  // 表單狀態
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [formData, setFormData] = useState({
    original: "",
    replacement: "",
    category: "",
  });

  // 載入字典項目
  const loadEntries = useCallback(async () => {
    if (!window.electronAPI) return;

    setLoading(true);
    try {
      let data;
      if (searchQuery) {
        data = await window.electronAPI.searchDictionary(searchQuery);
      } else {
        data = await window.electronAPI.getDictionaryEntries(100, 0);
      }

      // 根據分類篩選
      if (selectedCategory) {
        data = data.filter(e => e.category === selectedCategory);
      }

      setEntries(data || []);
    } catch (error) {
      console.error("載入字典失敗:", error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  // 載入分類
  const loadCategories = async () => {
    if (!window.electronAPI) return;
    try {
      const cats = await window.electronAPI.getDictionaryCategories();
      setCategories(cats || []);
    } catch (error) {
      console.error("載入分類失敗:", error);
    }
  };

  useEffect(() => {
    loadEntries();
    loadCategories();
  }, [loadEntries]);

  // 新增項目
  const handleAdd = async () => {
    if (!formData.original.trim() || !formData.replacement.trim()) {
      alert(t?.("settings.dictionary.fillBoth") || "請填寫原始詞彙和替換詞彙");
      return;
    }

    try {
      await window.electronAPI.addDictionaryEntry(
        formData.original.trim(),
        formData.replacement.trim(),
        formData.category.trim()
      );
      setFormData({ original: "", replacement: "", category: "" });
      setIsFormOpen(false);
      await loadEntries();
      await loadCategories();
    } catch (error) {
      console.error("新增字典項目失敗:", error);
      alert(t?.("settings.dictionary.addFailed", { error: error.message }) || "新增失敗: " + error.message);
    }
  };

  // 更新項目
  const handleUpdate = async () => {
    if (!editingEntry) return;

    try {
      await window.electronAPI.updateDictionaryEntry(editingEntry.id, {
        original: formData.original.trim(),
        replacement: formData.replacement.trim(),
        category: formData.category.trim(),
      });
      setEditingEntry(null);
      setFormData({ original: "", replacement: "", category: "" });
      await loadEntries();
      await loadCategories();
    } catch (error) {
      console.error("更新字典項目失敗:", error);
      alert(t?.("settings.dictionary.updateFailed", { error: error.message }) || "更新失敗: " + error.message);
    }
  };

  // 刪除項目
  const handleDelete = async (id) => {
    if (!confirm(t?.("settings.dictionary.confirmDelete") || "確定要刪除此項目嗎？")) return;

    try {
      await window.electronAPI.deleteDictionaryEntry(id);
      await loadEntries();
    } catch (error) {
      console.error("刪除字典項目失敗:", error);
    }
  };

  // 切換啟用狀態
  const handleToggle = async (id) => {
    try {
      await window.electronAPI.toggleDictionaryEntry(id);
      await loadEntries();
    } catch (error) {
      console.error("切換狀態失敗:", error);
    }
  };

  // 開始編輯
  const startEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      original: entry.original,
      replacement: entry.replacement,
      category: entry.category || "",
    });
    setIsFormOpen(true);
  };

  // 取消編輯
  const cancelEdit = () => {
    setEditingEntry(null);
    setFormData({ original: "", replacement: "", category: "" });
    setIsFormOpen(false);
  };

  // 匯出字典
  const handleExport = async () => {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.exportDictionary();
      if (result.success) {
        alert(t?.("settings.dictionary.exportSuccess", { count: result.count }) || `成功匯出 ${result.count} 個項目`);
      } else if (!result.canceled) {
        alert(t?.("settings.dictionary.exportFailed", { error: result.error }) || "匯出失敗: " + result.error);
      }
    } catch (error) {
      console.error("匯出字典失敗:", error);
      alert(t?.("settings.dictionary.exportFailed", { error: error.message }) || "匯出失敗: " + error.message);
    }
  };

  // 匯入字典
  const handleImport = async (mode = 'merge') => {
    if (!window.electronAPI) return;
    try {
      const result = await window.electronAPI.importDictionary(mode);
      if (result.success) {
        let message = t?.("settings.dictionary.importSuccess", { count: result.imported }) || `成功匯入 ${result.imported} 個項目`;
        if (result.skipped > 0) {
          message += t?.("settings.dictionary.importSkipped", { count: result.skipped }) || `，跳過 ${result.skipped} 個`;
        }
        alert(message);
        await loadEntries();
        await loadCategories();
      } else if (!result.canceled) {
        alert(t?.("settings.dictionary.importFailed", { error: result.error }) || "匯入失敗: " + result.error);
      }
    } catch (error) {
      console.error("匯入字典失敗:", error);
      alert(t?.("settings.dictionary.importFailed", { error: error.message }) || "匯入失敗: " + error.message);
    }
  };

  return (
    <div className="dictionary-manager">
      {/* 標題與說明 */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 chinese-title mb-2">
          {t?.("settings.dictionary.title") || "字典管理"}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {t?.("settings.dictionary.description") || "設定詞彙替換規則，自動校正語音辨識結果中的專有名詞（人名、地名、術語等）"}
        </p>
      </div>

      {/* 搜尋與新增 */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t?.("settings.dictionary.search") || "搜尋..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {categories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
          >
            <option value="">{t?.("settings.dictionary.allCategories") || "所有分類"}</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}

        <button
          onClick={() => {
            setEditingEntry(null);
            setFormData({ original: "", replacement: "", category: "" });
            setIsFormOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t?.("settings.dictionary.add") || "新增"}
        </button>

        {/* 匯入/匯出按鈕 */}
        <div className="flex gap-2">
          <button
            onClick={() => handleImport('merge')}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
            title={t?.("settings.dictionary.importHint") || "匯入時會跳過已存在的項目"}
          >
            <Upload className="w-4 h-4" />
            {t?.("settings.dictionary.import") || "匯入"}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            {t?.("settings.dictionary.export") || "匯出"}
          </button>
        </div>
      </div>

      {/* 新增/編輯表單 */}
      {isFormOpen && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            {editingEntry ? (t?.("settings.dictionary.edit") || "編輯項目") : (t?.("settings.dictionary.addNew") || "新增項目")}
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                {t?.("settings.dictionary.original") || "原始詞彙"}
              </label>
              <input
                type="text"
                value={formData.original}
                onChange={(e) => setFormData({ ...formData, original: e.target.value })}
                placeholder={t?.("settings.dictionary.originalPlaceholder") || "例：郭太明"}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                {t?.("settings.dictionary.replacement") || "替換為"}
              </label>
              <input
                type="text"
                value={formData.replacement}
                onChange={(e) => setFormData({ ...formData, replacement: e.target.value })}
                placeholder={t?.("settings.dictionary.replacementPlaceholder") || "例：郭台銘"}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                {t?.("settings.dictionary.category") || "分類（選填）"}
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder={t?.("settings.dictionary.categoryPlaceholder") || "例：人名"}
                list="category-list"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg"
              />
              <datalist id="category-list">
                {categories.map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={cancelEdit}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            >
              {t?.("common.cancel") || "取消"}
            </button>
            <button
              onClick={editingEntry ? handleUpdate : handleAdd}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded transition-colors"
            >
              <Check className="w-4 h-4" />
              {editingEntry ? (t?.("common.save") || "儲存") : (t?.("common.add") || "新增")}
            </button>
          </div>
        </div>
      )}

      {/* 字典列表 */}
      <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {searchQuery
                ? (t?.("settings.dictionary.noMatch") || "沒有符合的項目")
                : (t?.("settings.dictionary.empty") || "尚無字典項目，點擊「新增」建立第一個替換規則")
              }
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  {t?.("settings.dictionary.original") || "原始詞彙"}
                </th>
                <th className="px-2 py-2 text-center text-gray-400 w-8">→</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300">
                  {t?.("settings.dictionary.replacement") || "替換為"}
                </th>
                <th className="px-4 py-2 text-left font-medium text-gray-600 dark:text-gray-300 hidden sm:table-cell">
                  {t?.("settings.dictionary.category") || "分類"}
                </th>
                <th className="px-4 py-2 text-center font-medium text-gray-600 dark:text-gray-300 w-24">
                  {t?.("settings.dictionary.actions") || "操作"}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!entry.enabled ? 'opacity-50' : ''}`}
                >
                  <td className="px-4 py-2 text-red-600 dark:text-red-400 font-medium">
                    {entry.original}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-400">→</td>
                  <td className="px-4 py-2 text-blue-600 dark:text-blue-400 font-medium">
                    {entry.replacement}
                  </td>
                  <td className="px-4 py-2 hidden sm:table-cell">
                    {entry.category && (
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded text-xs">
                        {entry.category}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleToggle(entry.id)}
                        className={`p-1.5 rounded transition-colors ${
                          entry.enabled
                            ? 'text-green-500 hover:bg-green-100 dark:hover:bg-green-900/30'
                            : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                        }`}
                        title={entry.enabled ? (t?.("settings.dictionary.disable") || "停用") : (t?.("settings.dictionary.enable") || "啟用")}
                      >
                        {entry.enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => startEdit(entry)}
                        className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded transition-colors"
                        title={t?.("common.edit") || "編輯"}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                        title={t?.("common.delete") || "刪除"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 統計資訊 */}
      {entries.length > 0 && (
        <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          {t?.("settings.dictionary.total") || "共"} {entries.length} {t?.("settings.dictionary.items") || "個項目"}
          {entries.filter(e => e.enabled).length < entries.length && (
            <span>，{entries.filter(e => e.enabled).length} {t?.("settings.dictionary.enabled") || "個啟用"}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default DictionaryManager;
