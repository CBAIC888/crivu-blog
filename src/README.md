# CRIVU 學術版源碼

`src/` 保存可追蹤的正式前端源碼。正式網站由 Cloudflare Pages Functions 從 D1 取得內容後在伺服器端生成，R2 保存媒體；`dist/` 是 `npm run build` 產生的可部署靜態資源。

`preview/` 只是保留舊設計基準與回歸比對的本機開發輸出，不是正式站、不會部署，也不得當作內容資料庫。它繼續由 `.gitignore` 忽略。

## 源碼與生成物

- `templates/`：研究文章中英文頁面與研究圖庫頁模板。
- `content/`：「世界」研究文章的中英文正文源碼。
- `styles/`：新版共用排版、頁面與研究圖庫樣式。
- `scripts/`：正式站的導覽、搜尋、主題、研究文章、圖庫與關於頁留言板互動。
- `assets/world-gallery/`：「世界」研究圖庫的正式 WebP 媒體。
- `renderers/public-site.js`：公開文章、期刊、紀錄與關於頁的 SSR 組版。

專案根目錄的主要資料流：

- `migrations/`：建立 D1 資料表與關聯。
- `functions/api/v1/`：公開 API、留言板與需登入的後台 API。
- `functions/`：正式 clean URL 與 SSR 頁面路由。
- `scripts/build-content-seed.mjs`：將保留的舊 JSON 轉成可重複測試的 D1 seed。
- `scripts/build-site.mjs`：重建忽略的 `dist/` 部署輸出。
- `scripts/local-preview-server.mjs`：用記憶體 D1 測試正式路由與後台核心儲存流程。
- `scripts/generate-preview-site.mjs`：只用於精確重建舊 `preview/` 開發基準。

`preview/comments-cache.json` 是舊預覽可選快照，不屬於正式源碼，正式站也不讀取它。`preview/` 內其餘檔案均可由下列命令重建：

```sh
npm run generate:preview
```

若需在不改動現有 `preview/` 的情況下核對輸出：

```sh
node scripts/generate-preview-site.mjs --output /absolute/path/to/check-directory
```

## 新版路由基準

| 正式路由 | 內容 |
| --- | --- |
| `/` | 伺服器端重新導向 `/articles` |
| `/articles` | 文章列表 |
| `/articles/:slug` | 一般、研究或劇本詳情 |
| `/issues` | 期刊與合集列表 |
| `/issues/:id` | 期刊或合集詳情 |
| `/records` | 專題紀錄列表 |
| `/records/:slug` | 專題詳情 |
| `/about` | 關於與留言板 |
| `/rss.xml` | RSS |
| `/sitemap.xml` | Sitemap |

舊預覽輸出仍使用 `/preview/*.html`、`noindex` 與 meta refresh；這些只為了維持可比對的開發基準。正式 `dist/` 使用 clean URL、伺服器端重定向、canonical、RSS 與 Sitemap，公開頁不含 `noindex`。
