# CRIVU 學術版後端重構規劃

## 1. 專案定位

- 專案位置：`/Users/cbaic/Desktop/CRIVU博客管理`
- 新版前端目前主要位於 `preview/`。
- 新版沒有傳統首頁；根路徑應導向文章列表。
- 主要公開區域：文章、期刊、紀錄、關於、RSS。
- 文章分為三種：一般、研究、劇本。
- 本次重構沿用新版既有設計、元件、排版和互動，不重新設計前端。

## 2. 當前狀態與重要警告

1. `preview/` 雖被 `.gitignore` 忽略，但其中包含新版正式設計、CSS、JavaScript、研究頁、劇本頁、圖庫和生成結果，現階段不可直接刪除。
2. `scripts/generate-preview-site.mjs`、`scripts/snapshot-preview-comments.mjs`、`scripts/export-world-gallery.sh` 尚未納入 Git 追蹤。
3. 正式根目錄與線上網站仍是舊版；新版尚未正式取代舊版。
4. 目前內容仍來自 `posts/posts.json`、`posts/issues.json`、`posts/records.json`、`posts/site.json`。
5. 現有工作區有使用者修改，不得覆蓋：
   - `articles/bwlq/index.html`
   - `assets/css/style.css`
   - `assets/js/comments.js`
6. 桌面仍有另一份舊工作副本：`/Users/cbaic/Desktop/網站開發/blog`。在確認新版完整遷移以前，不刪除舊副本。

## 3. 重構目標

完成後的資料流：

```text
CRIVU 後台
    ↓
/api/v1/admin/*
    ↓
D1 內容資料庫 + R2 媒體庫
    ↓
公開 API／伺服器渲染
    ↓
CRIVU 學術版前端
```

核心目標：

- 將新版前端提升為正式源碼。
- 移除舊首頁、FSNotes、EdgeOne 和過時前端。
- 將單一 JSON 內容儲存遷移到 D1。
- 將圖片、音訊、PDF 和附件統一到 R2。
- 建立一般文章、研究文章、劇本三套舒適的編輯流程。
- 建立兼容「主題合集」與「正式卷期」的期刊模型。
- 將紀錄改造成可關聯文章、圖庫、展覽和媒體的專題模型。
- 全站取消評論，只保留關於頁留言板。
- 統一公開 API 與後台 API。
- 第一階段保留基本 GitHub OAuth 登入，不開發複雜角色權限。
- 逐步降低 GitHub 依賴，最終可改用 Cloudflare Direct Upload。

## 4. 不在本次範圍內

- 不重新設計新版視覺。
- 不新增與現有設計不一致的元件。
- 暫不開發作者、編輯、主編等多角色權限。
- DOI、ORCID、ISSN 暫作選填能力，不強制使用。
- 不在資料遷移完成前刪除舊 JSON。
- 不在新版正式源碼可重建前刪除 `preview/`。
- 不直接刪除 R2、D1 或正式站資料。

## 5. 第一階段：確認新版源碼並整理工程

### 5.1 分離源碼與生成物

將目前混合在 `preview/` 的內容分成：

- 正式模板源碼
- 共用 CSS／JavaScript
- 研究文章模板
- 劇本模板與解析器
- 期刊／合集模板
- 紀錄／專題模板
- 關於頁模板
- 可重新生成的公開 HTML
- 僅供開發使用的臨時預覽輸出

建議正式目錄：

```text
src/
  templates/
  renderers/
  styles/
  scripts/
  admin/
public/ 或 dist/
```

實際落地時可依現有 Cloudflare Pages Functions 結構調整，不強制建立不必要的資料夾。

### 5.2 新版路由基準

```text
/                         → 重新導向 /articles
/articles                 → 文章列表
/articles/:slug           → 一般／研究／劇本詳情
/issues                   → 期刊與合集列表
/issues/:id               → 期刊或合集詳情
/records                  → 專題紀錄列表
/records/:slug            → 專題詳情
/about                    → 關於與留言板
/rss.xml                  → RSS
/sitemap.xml              → Sitemap
```

移除正式網址中的 `/preview/` 和 `.html`。舊網址需要建立明確重定向，避免已有連結失效。

### 5.3 新版上線前必須處理

- 移除所有 `noindex`。
- 將 meta refresh 改為伺服器端重定向。
- 修正 `/preview/*` 路徑。
- 保留新版導覽、搜尋、主題切換和排版。
- 生成正確的 title、description、canonical、Open Graph、RSS 與 Sitemap。
- 根路徑不再渲染舊首頁。

## 6. 第二階段：D1 資料模型

### 6.1 通用文章

`articles`

- `id`
- `type`：`general`、`research`、`script`
- `status`：`draft`、`review`、`scheduled`、`published`、`archived`
- `slug`
- `title`
- `subtitle`
- `summary`
- `body_markdown`
- `language`
- `cover_media_id`
- `published_at`
- `updated_at`
- `seo_title`
- `seo_description`
- `canonical_url`
- `license`

### 6.2 翻譯版本

`article_translations`

- 原文章 ID
- 語言
- 翻譯文章 ID
- hreflang

研究文章的中英文版本使用關聯，不重複寫死網址。

### 6.3 研究內容

`research_sections`

- 文章 ID
- 章節 ID
- 標題
- 正文
- 顯示順序

`research_notes`

- 文章 ID
- 注釋編號
- 注釋內容
- 引用資料
- 顯示順序

研究圖像使用通用媒體表與關聯表，不在 JavaScript 中硬編碼。

### 6.4 劇本內容

第一版可以保留 Markdown／純文字作為編輯來源，再由現有解析器產生結構化場次。資料結構至少包含：

- 劇種
- 載體
- 整理者
- 來源
- 編校說明
- 場次
- 人物
- 唸白／唱詞
- 板式
- 舞台提示
- 伴奏與音訊

若後續需要逐段編輯，再增加 `script_scenes`、`script_entries`，不要第一階段就把長劇本拆得過細。

### 6.5 作者與標籤

```text
authors
article_authors
tags
article_tags
```

ORCID、機構、通訊作者標記均為選填。

### 6.6 期刊與合集

使用統一的 `collections`：

- `type=collection`：二十四節氣、雜記、京劇等主題合集
- `type=journal_issue`：正式年份／卷號／期號

核心資料：

- 標題
- 主題
- 封面
- 編者語
- 年份
- 卷號，可選
- 期號，可選
- 出版日期
- 出版狀態
- 整期 PDF，可選

`collection_articles` 保存文章 ID 與顯示順序，不再使用 Slug 列表。

### 6.7 專題紀錄

`projects`

- 專題名稱
- Slug
- 類型
- 摘要
- 正文
- 日期／日期範圍
- 地點
- 參與者
- 整理者
- 封面
- 狀態

`project_relations`

- 關聯研究文章
- 關聯英文版本
- 關聯圖庫
- 關聯互動展覽
- 關聯期刊／合集

「世界」專題只保留一份核心資料，研究文章、圖片展示和展覽都是它的關聯內容。

### 6.8 頁面與設定

```text
pages
site_settings
```

站點設定分成：

- 基本設定
- 導航設定
- 文章分類與頁面文案
- SEO 設定
- 關於與留言板設定

不建立首頁設定。

### 6.9 修訂記錄

`article_revisions`

- 文章 ID
- 完整內容快照或差異
- 修改時間
- 修改來源
- 發布狀態

第一階段不需要複雜多人審批，但必須能恢復上一版本。

## 7. 第三階段：統一 API

### 7.1 公開 API

```text
GET  /api/v1/articles
GET  /api/v1/articles/:slug
GET  /api/v1/issues
GET  /api/v1/issues/:id
GET  /api/v1/projects
GET  /api/v1/projects/:slug
GET  /api/v1/pages/about
GET  /api/v1/settings/public
GET  /api/v1/guestbook
POST /api/v1/guestbook
```

### 7.2 後台 API

```text
/api/v1/admin/articles/*
/api/v1/admin/collections/*
/api/v1/admin/projects/*
/api/v1/admin/pages/*
/api/v1/admin/settings/*
/api/v1/admin/media/*
/api/v1/admin/guestbook/*
```

### 7.3 API 原則

- 統一錯誤格式。
- 統一輸入驗證。
- Slug 唯一。
- 修改使用 revision／If-Match 防止覆蓋。
- 公開 API 只返回已發布內容。
- 後台 API 返回草稿和修訂資料。
- 發布後清理或更新相關快取。
- 不再通過 GitHub API 寫入內容。

## 8. 第四階段：後台編輯體驗

### 8.1 共用能力

- 新建時先選一般、研究或劇本。
- 自動保存草稿。
- 未保存離開提示。
- 左側編輯、右側預覽。
- 圖片拖放上傳。
- 從媒體庫插入。
- Slug 自動生成且可修改。
- 摘要可自動提取。
- 發布前欄位檢查。
- SEO 與進階資料預設收起。
- 長文目錄導航。
- 修訂比較與恢復。

### 8.2 一般文章編輯器

保持簡潔，只顯示正文、摘要、封面、標籤、合集和發布設定。

### 8.3 研究編輯器

- 章節管理與排序
- 注釋編號與文內引用
- 參考資料逐條編輯
- 中英文版本關聯
- 圖庫管理
- 來源與授權
- 展覽／專題關聯
- 研究頁即時預覽

### 8.4 劇本編輯器

- 大面積正文
- 場次快速導航
- 人物／板式／舞台提示語法提示
- 搜尋替換
- 全螢幕模式
- 劇本模板即時預覽
- 音訊與伴奏快速插入

沿用目前 `opera-v1` 劇本模板與解析方式，不另做不一致的設計。

## 9. 第五階段：留言板

全站取消評論，只保留關於頁留言。

### 9.1 前端移除

- 一般文章評論
- 研究文章評論與評論按鈕
- 英文研究評論
- 劇本評論
- 期刊評論
- 紀錄評論
- 獨立專題評論

### 9.2 後端改造

- `comments` 概念改為 `guestbook_entries`。
- API 只服務關於頁。
- 即使繞過前端直接請求，後端也拒絕其他內容留言。
- 保留 Turnstile、頻率限制、隱私雜湊和人工審核。
- 支援管理員回覆。
- 資料庫結構只通過 migration 建立，不在每次請求中建表或修改欄位。

### 9.3 舊評論處理

1. 先匯出舊評論備份。
2. 確認是否保留既有 `about` 留言。
3. 刪除所有非關於頁評論。
4. 移除 `comments-cache.json` 與評論快照腳本。

涉及正式 D1 刪除時必須再次確認目標資料庫和刪除範圍。

## 10. 第六階段：媒體管理

### 10.1 儲存規則

- R2：圖片、音訊、影片文件、PDF、附件。
- D1：媒體元資料與內容關聯。
- GitHub：不再新增大型媒體。

### 10.2 媒體元資料

- ID
- 文件名
- MIME type
- 大小
- 寬高／時長
- 標題
- 替代文字
- 圖說
- 作者／攝影者
- 年代
- 來源
- 授權
- R2 key
- 建立時間

### 10.3 現有研究圖庫

- 將 `gallery.js` 中硬編碼的 17 張圖片資料遷移到 D1。
- 將圖片移入正式 R2 路徑。
- 移除導出腳本中的本機絕對路徑。
- 圖庫頁從專題與媒體關聯生成。

## 11. 第七階段：清理舊系統

只有在新版可完整運行、內容已遷移並完成回歸檢查後執行。

### 11.1 移除 FSNotes

- `functions/api/fsnotes/`
- `_headers` 中的 FSNotes 路徑
- `FSNOTES_*` 環境變數依賴
- `_fsnotes` 文章欄位
- FSNotes 專用媒體上傳和 GitHub commit 邏輯
- 相關文檔

### 11.2 移除 EdgeOne

- `edgeone.json`
- `scripts/build-edgeone.js`
- `package.json` 中 EdgeOne scripts
- middleware 中 EdgeOne 特例
- 部署文檔中的退休流程
- EdgeOne 評論與媒體說明

### 11.3 移除舊首頁

- 舊首頁模板
- 舊首頁 Functions
- `home.js`
- `renderHomePage`
- 首頁專用樣式
- 首頁後台欄位

根路徑保留為文章列表的伺服器端重定向。

### 11.4 清理生成物與快取

- `.wrangler/`
- 舊 `dist/`
- 舊 preview 生成物
- `.DS_Store`
- 未再使用的評論快照
- 無引用媒體
- 重複靜態 HTML

刪除媒體前必須掃描 JSON、D1、HTML、CSS、JavaScript、RSS、SEO 和特殊專題中的引用。

## 12. GitHub 依賴拆除路線

### 階段 A

- D1 儲存內容。
- R2 儲存媒體。
- 移除 FSNotes 和 GitHub Content API。
- 暫時保留 GitHub OAuth、原始碼和自動部署。

### 階段 B

- 替換 GitHub OAuth。
- D1 保存修訂。
- GitHub 只剩原始碼和部署。

### 階段 C

- 改用 Cloudflare Direct Upload／Wrangler。
- 原始碼轉移到其他 Git 平台或私有備份。
- 正式網站不再依賴 GitHub 運行。

即使離開 GitHub，也必須保留 Git 版本管理和異地備份。

## 13. 資料遷移順序

1. 備份四個現有 JSON。
2. 建立 D1 migrations。
3. 匯入站點設定與關於頁。
4. 匯入一般文章。
5. 將 `issue=opera` 等舊判斷轉換為正式 `type=script`。
6. 匯入研究文章及中英文關聯。
7. 匯入合集／期刊及文章順序。
8. 匯入紀錄並建立專題關聯。
9. 匯入媒體元資料並核對 R2 文件。
10. 匯出並整理留言資料。
11. 對比 JSON 與 D1 的數量、Slug、發布狀態和正文摘要。
12. 新版穩定後將 JSON 改為只讀備份，最後再移除讀取依賴。

## 14. 驗收標準

### 前端

- 根路徑正確導向文章列表。
- 新版外觀與目前 preview 保持一致。
- 一般、研究、劇本三種內容均正確渲染。
- 研究邊注、中英文切換、圖庫和展覽入口正常。
- 劇本場次、人物、板式、念白與唱詞排版正常。
- 期刊、合集和專題關聯正確。
- 所有非關於頁均無評論 UI、評論腳本和評論 API 請求。
- 關於頁留言可提交、審核和顯示。
- 搜尋、RSS、Sitemap、SEO 和舊網址重定向正常。

### 後台

- 三種文章表單按類型顯示欄位。
- 可保存草稿、預覽、發布、封存和恢復修訂。
- 期刊／合集可拖動文章順序。
- 專題可關聯研究、媒體、圖庫和展覽。
- 媒體可上傳到 R2 並保存來源與授權。
- 不再提交 GitHub 內容文件。
- 不存在 FSNotes 功能。

### 資料

- 現有文章、期刊、紀錄和關於內容無遺失。
- 所有正文、封面、媒體和關聯可追溯。
- D1 migration 可從空資料庫完整執行。
- 資料匯入可重複測試，不產生重複記錄。

## 15. 建議執行批次

### 批次 1：保護新版

- 將新版源碼從 ignored preview 中分離。
- 確認可重建。
- 建立新版路由清單。
- 暫不刪舊站。

### 批次 2：清理明確死代碼

- 清理本機快取。
- 移除 EdgeOne。
- 移除 FSNotes。
- 保留內容 JSON 供遷移。

### 批次 3：建立 D1／R2／API

- migrations
- 匯入工具
- 公開 API
- 後台 API
- 媒體 API

### 批次 4：重做後台編輯

- 一般文章
- 研究
- 劇本
- 期刊／合集
- 專題紀錄
- 設定

### 批次 5：留言板與前端接線

- 移除全站評論
- 關於頁留言板
- 新版 renderer 接 D1
- 搜尋、RSS、Sitemap

### 批次 6：遷移與最終清理

- 全量匯入
- 核對內容
- 舊網址重定向
- 移除舊前端、舊 JSON 讀取與重複輸出
- 更新部署文檔

## 16. 新窗口開始工作時的第一條指令建議

```text
請先閱讀 /Users/cbaic/Desktop/CRIVU博客管理/CRIVU學術版後端重構規劃.md，從「批次 1：保護新版」開始。先核對並分離 preview 中的正式源碼與生成物，不要刪除 preview，不要覆蓋現有未提交修改，也不要部署。
```
