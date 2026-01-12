# 聲聲慢官網首頁規格文檔

## 1. 概述

本文檔定義聲聲慢官網首頁的設計規格與技術實作方案。

### 1.1 設計目標
- 傳達品牌核心概念：「聲聲慢，轉錄快」
- 簡潔現代的視覺風格（參考 typeless.ch）
- 響應式設計，支援桌面與行動裝置
- 符合 WCAG 2.1 AA 無障礙標準

### 1.2 目標用戶
- 聽力障礙者及其家人
- 需要語音轉文字工具的專業人士
- 對無障礙技術有興趣的開發者

---

## 2. 首頁結構設計

### 2.1 頁面區塊

```
┌─────────────────────────────────────────┐
│              Header / Navigation         │
├─────────────────────────────────────────┤
│                                         │
│              Hero Section               │
│   「聲聲慢，轉錄快」                      │
│   副標題 + CTA 按鈕                      │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│           Features Section              │
│   三大核心功能卡片                        │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│           Story Preview                 │
│   品牌故事預覽（簡短版）                  │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│              CTA Section                │
│   下載行動呼籲                           │
│                                         │
├─────────────────────────────────────────┤
│                 Footer                  │
└─────────────────────────────────────────┘
```

### 2.2 各區塊詳細規格

#### Header / Navigation
- Logo：「聲聲慢」使用 GenWan 源雲明體
- 導航連結：品牌故事、功能介紹、下載、GitHub
- 響應式：行動裝置顯示漢堡選單

#### Hero Section
- **主標題**：聲聲慢，轉錄快
- **副標題**：專為聽力障礙者設計的即時語音轉文字工具
- **說明文字**：讓每一次對話，都值得被聽見
- **CTA 按鈕**：
  - 主要：免費下載（連結到下載頁）
  - 次要：了解更多（連結到品牌故事頁）
- **背景**：漸層色彩，由淺藍過渡到白色

#### Features Section
三張功能卡片，各包含：
- 圖示（SVG icon）
- 功能標題
- 簡短說明（1-2 句）

**功能一：即時轉錄**
- 圖示：波形 + 文字
- 說明：邊說邊轉，即時顯示語音內容

**功能二：離線使用**
- 圖示：盾牌 / 斷線
- 說明：完全本地運行，無需網路，保護隱私

**功能三：智慧標點**
- 圖示：逗號句號
- 說明：自動添加標點符號，閱讀更流暢

#### Story Preview
- 標題：為什麼是聲聲慢？
- 簡短故事摘要（3-4 句）
- 「閱讀完整故事」連結

#### CTA Section
- 背景：深藍色
- 標題：開始你的聲聲慢之旅
- 下載按鈕

#### Footer
- 品牌標語
- 導航連結
- 版權資訊
- GitHub 連結

---

## 3. 視覺設計規範

### 3.1 色彩系統

```css
:root {
  /* 主色調 */
  --primary: #5B8FB9;           /* 寧靜藍 */
  --primary-dark: #3A6B8C;      /* 深藍 */
  --primary-light: #B6D0E2;     /* 淺藍 */

  /* 強調色 */
  --accent: #F9A826;            /* 暖橙 - 溫暖、希望 */

  /* 中性色 */
  --background: #FAFBFC;        /* 背景白 */
  --surface: #FFFFFF;           /* 卡片白 */
  --text-primary: #1F2937;      /* 主要文字 */
  --text-secondary: #6B7280;    /* 次要文字 */
  --border: #E5E7EB;            /* 邊框 */

  /* 深色區塊 */
  --dark-bg: #1E3A5F;           /* 深藍背景 */
  --dark-text: #FFFFFF;         /* 深色背景文字 */
}
```

### 3.2 字體系統

```css
/* 品牌標題 - 源雲明體 */
.brand-title {
  font-family: 'GenWan', 'Noto Serif TC', serif;
  font-weight: 500;
  letter-spacing: 0.15em;
}

/* 內容文字 - jf open 粉圓 */
body {
  font-family: 'OpenHuninn', 'Noto Sans TC',
               'PingFang SC', 'Microsoft YaHei',
               system-ui, sans-serif;
}

/* 字體大小 */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */
--text-4xl: 2.25rem;   /* 36px */
--text-5xl: 3rem;      /* 48px */
--text-6xl: 3.75rem;   /* 60px */
```

### 3.3 間距系統

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

### 3.4 陰影效果

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
```

### 3.5 圓角

```css
--radius-sm: 0.25rem;  /* 4px */
--radius-md: 0.5rem;   /* 8px */
--radius-lg: 1rem;     /* 16px */
--radius-xl: 1.5rem;   /* 24px */
--radius-full: 9999px; /* 圓形 */
```

---

## 4. 響應式設計

### 4.1 斷點定義

```css
/* Mobile First */
/* 基礎：< 640px (手機) */

@media (min-width: 640px) {
  /* sm: 小平板 */
}

@media (min-width: 768px) {
  /* md: 平板 */
}

@media (min-width: 1024px) {
  /* lg: 桌面 */
}

@media (min-width: 1280px) {
  /* xl: 大螢幕 */
}
```

### 4.2 各斷點佈局

| 區塊 | 手機 | 平板 | 桌面 |
|------|------|------|------|
| Hero | 垂直置中 | 垂直置中 | 左右分欄 |
| Features | 單欄 | 雙欄 | 三欄 |
| CTA 按鈕 | 垂直堆疊 | 水平並排 | 水平並排 |

---

## 5. 動畫效果

### 5.1 入場動畫

```css
/* 淡入上移 */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s ease-out forwards;
}
```

### 5.2 互動動畫

```css
/* 按鈕 hover */
.btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* 卡片 hover */
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}
```

### 5.3 減少動畫偏好

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 6. 無障礙設計

### 6.1 色彩對比
- 主要文字與背景對比度 >= 4.5:1
- 大標題與背景對比度 >= 3:1
- 互動元素 focus 狀態清晰可見

### 6.2 鍵盤導航
- 所有互動元素可用 Tab 鍵到達
- 使用 Enter/Space 觸發按鈕
- 提供 Skip to content 連結

### 6.3 螢幕閱讀器
- 適當的 heading 層級結構
- 圖片提供 alt 描述
- 使用 ARIA 標籤增強語意

### 6.4 字體大小
- 基礎字體 16px
- 支援瀏覽器字體縮放
- 使用 rem 單位

---

## 7. 技術選型

### 7.1 技術堆疊
- **HTML5**：語意化標籤
- **CSS3**：原生 CSS（不使用框架）
- **JavaScript**：Vanilla JS（僅用於互動）
- **字體**：GenWan、OpenHuninn（從 Electron app 共用）

### 7.2 目錄結構

```
website/
├── index.html          # 首頁
├── story.html          # 品牌故事頁
├── features.html       # 功能介紹頁
├── download.html       # 下載頁
├── css/
│   └── style.css       # 主樣式表
├── js/
│   └── main.js         # 主腳本
├── fonts/              # 字體檔案（符號連結或複製）
│   ├── GenWanMin2TC-M.otf
│   └── jf-openhuninn-2.1.ttf
└── assets/
    ├── images/         # 圖片資源
    └── icons/          # SVG 圖示
```

### 7.3 瀏覽器支援
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 8. SEO 規格

### 8.1 Meta Tags

```html
<title>聲聲慢 - 即時語音轉文字，讓每一次對話都被聽見</title>
<meta name="description" content="聲聲慢是專為聽力障礙者設計的語音轉文字軟體。即時轉錄、離線使用、智慧標點，讓溝通無障礙。">
<meta name="keywords" content="語音轉文字, 聽力障礙, 即時轉錄, 無障礙溝通, ASR">
```

### 8.2 Open Graph

```html
<meta property="og:title" content="聲聲慢 - 讓每一次對話都被聽見">
<meta property="og:description" content="專為聽力障礙者設計的即時語音轉文字工具">
<meta property="og:type" content="website">
<meta property="og:image" content="https://example.com/og-image.png">
```

---

## 9. 驗收標準

### 9.1 功能驗收
- [ ] 首頁正確顯示所有區塊
- [ ] 導航連結正常運作
- [ ] CTA 按鈕連結正確
- [ ] 響應式設計在各裝置正確顯示

### 9.2 效能驗收
- [ ] 首次內容繪製 (FCP) < 1.5s
- [ ] 最大內容繪製 (LCP) < 2.5s
- [ ] 無明顯版面位移 (CLS < 0.1)

### 9.3 無障礙驗收
- [ ] Lighthouse 無障礙分數 >= 90
- [ ] 鍵盤可完整操作頁面
- [ ] 螢幕閱讀器可正確讀取內容

---

## 10. 實作優先順序

1. **Phase 1**：首頁基本結構與樣式
2. **Phase 2**：響應式設計
3. **Phase 3**：動畫效果
4. **Phase 4**：無障礙優化
5. **Phase 5**：SEO 優化
