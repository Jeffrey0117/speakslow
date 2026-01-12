# 聲聲慢官網規格文檔

## 1. 品牌核心理念

### 1.1 品牌名稱由來
「聲聲慢」取自宋詞詞牌名，蘊含雙重意涵：
- **對人要慢**：對聽力不好的人說話，要放慢語速，耐心溝通
- **轉錄要快**：軟體的語音轉文字速度要快，讓使用者不錯過任何重要訊息

### 1.2 品牌使命
讓每一次對話，都值得被聽見。透過即時語音轉文字技術，為聽力障礙者搭建溝通的橋樑。

### 1.3 品牌故事背景
作者的家人有聽力問題，親身經歷溝通困難的痛點，因此開發這款有溫度的產品。

---

## 2. 網站架構

### 2.1 頁面結構
```
website/
├── index.html      # 首頁（重導向至 story.html 或作為入口）
├── story.html      # 品牌故事頁（主打頁面）
├── features.html   # 功能介紹頁
├── download.html   # 下載頁面
├── contact.html    # 聯繫我們
├── css/
│   └── style.css   # 共用樣式
└── js/
    └── nav.js      # 導航元件腳本
```

### 2.2 導航結構
```
[Logo: 聲聲慢] ─── 品牌故事 ─── 功能介紹 ─── 下載 ─── 聯繫我們
```

---

## 3. 品牌故事頁面規格 (story.html)

### 3.1 頁面結構

#### Section 1: Hero 開場
- **標題**：每一次對話，都值得被聽見
- **副標題**：聲聲慢 - 為聽力障礙者打造的即時語音轉文字工具
- **視覺**：溫暖的漸層背景，柔和的動畫效果

#### Section 2: 故事起源
- **標題**：一個關於傾聽的故事
- **內容**：
  ```
  這一切，始於一通聽不清楚的電話。

  我的家人有聽力障礙。每次打電話，我都要放慢語速、
  提高音量，一句話重複好幾遍。即使如此，誤解還是經常發生。

  「你說什麼？再說一次。」
  「不是啦，我是說......」

  這樣的對話，在我們家是日常。
  ```

#### Section 3: 發現需求
- **標題**：從困擾到靈感
- **內容**：
  ```
  有一天，我看著家人努力想聽清楚電視新聞的樣子，
  突然想到：如果聲音可以即時變成文字，會不會好一些？

  於是，我開始研究語音辨識技術。
  不是為了趕上科技潮流，
  而是想讓家人能更輕鬆地參與每一場對話。
  ```

#### Section 4: 核心理念
- **標題**：聲聲慢，轉錄快
- **內容**：
  ```
  「聲聲慢」這個名字，藏著我們的初心：

  對聽力不好的人說話，要慢 ——
  放慢語速，給予耐心，用愛傾聽。

  但軟體的轉錄，要快 ——
  即時將語音轉為文字，
  讓他們不錯過任何一句重要的話。

  慢，是對人的溫柔。
  快，是對科技的要求。
  ```

#### Section 5: 使命願景
- **標題**：讓溝通無障礙
- **內容**：
  ```
  我們相信，每個人都有被聽見的權利。

  無論是家庭聚餐的閒話家常，
  還是會議室裡的重要討論，
  或是課堂上老師的諄諄教誨 ——

  聲聲慢，都想陪你一起聽見。

  這不只是一個軟體，
  這是一座橋，
  連接聲音與文字，
  連接說話的人與聽的人，
  連接愛與被愛。
  ```

#### Section 6: CTA 行動呼籲
- **標題**：開始你的聲聲慢之旅
- **按鈕**：免費下載 / 了解更多功能

### 3.2 視覺設計規範

#### 色彩系統
```css
/* 主色調 - 溫暖療癒系 */
--primary: #5B8FB9;      /* 寧靜藍 - 信任、專業 */
--primary-dark: #3A6B8C; /* 深藍 */
--secondary: #B6D0E2;    /* 淺藍 - 柔和、親切 */
--accent: #F9A826;       /* 暖橙 - 溫暖、希望 */
--background: #FAFBFC;   /* 米白背景 */
--text: #2C3E50;         /* 深灰文字 */
--text-light: #6B7C8A;   /* 淺灰文字 */
```

#### 字體設計
```css
/* 中文字體優先 */
font-family: 'Noto Sans TC', '微軟正黑體', sans-serif;

/* 標題 */
h1: 2.5rem, font-weight: 700
h2: 2rem, font-weight: 600
h3: 1.5rem, font-weight: 600

/* 內文 */
body: 1.125rem, line-height: 1.8
```

#### 間距系統
```css
--spacing-xs: 0.5rem;   /* 8px */
--spacing-sm: 1rem;     /* 16px */
--spacing-md: 2rem;     /* 32px */
--spacing-lg: 4rem;     /* 64px */
--spacing-xl: 6rem;     /* 96px */
```

### 3.3 動畫效果
- 頁面載入：文字淡入效果 (fade-in)
- 滾動時：Section 由下往上滑入 (slide-up)
- 按鈕：hover 時輕微放大與陰影變化

### 3.4 響應式斷點
```css
/* Mobile First */
@media (min-width: 640px)  { /* sm: 平板直向 */ }
@media (min-width: 768px)  { /* md: 平板橫向 */ }
@media (min-width: 1024px) { /* lg: 桌面 */ }
@media (min-width: 1280px) { /* xl: 大螢幕 */ }
```

---

## 4. 功能介紹頁規格 (features.html)

### 4.1 功能列表

#### 核心功能
1. **即時語音轉文字**
   - 說明：邊說邊轉，零延遲顯示
   - 圖示：麥克風 + 文字泡泡

2. **多語言支援**
   - 說明：支援中文、英文、日文等多國語言
   - 圖示：地球 + 語言符號

3. **離線使用**
   - 說明：不需網路，保護隱私
   - 圖示：斷線符號 + 盾牌

4. **智慧標點**
   - 說明：自動加上標點符號，閱讀更流暢
   - 圖示：逗號句號符號

#### 進階功能
5. **熱詞辨識**
   - 說明：自訂專有名詞，提高辨識準確度

6. **降噪處理**
   - 說明：過濾背景雜音，專注人聲

7. **音量正規化**
   - 說明：自動調整音量，聽得更清楚

### 4.2 頁面佈局
- 功能卡片式設計
- 每行 3 個（桌面）/ 2 個（平板）/ 1 個（手機）
- 懸停時卡片微微上浮

---

## 5. 下載頁規格 (download.html)

### 5.1 下載選項
- **Windows 版本**
  - 系統需求：Windows 10/11
  - 檔案大小：約 XXX MB
  - 下載按鈕

- **未來規劃**
  - macOS 版本（開發中）
  - Linux 版本（規劃中）

### 5.2 安裝指南
- 簡易步驟說明
- 常見問題 FAQ

---

## 6. 聯繫我們規格 (contact.html)

### 6.1 聯繫方式
- Email：[待填入]
- GitHub：[專案連結]
- 問題回報：Issue 連結

### 6.2 表單設計（可選）
- 姓名
- Email
- 主旨
- 訊息內容
- 送出按鈕

---

## 7. 共用元件規格

### 7.1 Header / Navigation
```html
<header>
  <nav>
    <logo>聲聲慢</logo>
    <nav-links>
      品牌故事 | 功能介紹 | 下載 | 聯繫我們
    </nav-links>
    <mobile-menu-toggle /> <!-- 手機版漢堡選單 -->
  </nav>
</header>
```

### 7.2 Footer
```html
<footer>
  <brand>聲聲慢 - 讓每一次對話都被聽見</brand>
  <links>品牌故事 | 功能介紹 | 下載 | 聯繫我們</links>
  <copyright>© 2024 聲聲慢. All rights reserved.</copyright>
</footer>
```

### 7.3 共用按鈕樣式
```css
.btn-primary {
  background: var(--primary);
  color: white;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: var(--primary-dark);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

---

## 8. 無障礙設計 (Accessibility)

### 8.1 基本要求
- 符合 WCAG 2.1 AA 標準
- 色彩對比度至少 4.5:1
- 所有互動元素可用鍵盤操作
- 圖片皆有 alt 描述

### 8.2 特殊考量
- 字體大小可調整
- 支援螢幕閱讀器
- 減少動畫選項（respect prefers-reduced-motion）

---

## 9. SEO 規格

### 9.1 Meta Tags
```html
<title>聲聲慢 - 即時語音轉文字，讓每一次對話都被聽見</title>
<meta name="description" content="聲聲慢是專為聽力障礙者設計的語音轉文字軟體，即時轉錄、離線使用、保護隱私。">
<meta name="keywords" content="語音轉文字, 聽力障礙, 即時轉錄, 無障礙溝通">
```

### 9.2 Open Graph
```html
<meta property="og:title" content="聲聲慢 - 讓每一次對話都被聽見">
<meta property="og:description" content="專為聽力障礙者設計的即時語音轉文字工具">
<meta property="og:type" content="website">
```

---

## 10. 技術實作注意事項

### 10.1 Pure HTML/CSS/JS
- 不使用框架，保持輕量
- 使用 CSS Custom Properties 管理主題
- 使用 Vanilla JS 處理互動

### 10.2 效能優化
- 圖片使用 WebP 格式
- CSS/JS 放在適當位置
- 使用 system font stack 備援

### 10.3 瀏覽器支援
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
