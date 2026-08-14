# CRIVU 學術版運行手冊

目前只保留 Cloudflare Pages。EdgeOne、FSNotes、Decap CMS 與 GitHub Content API 已移除；GitHub 用於源碼、部署觸發與第一階段管理員登入，文章與媒體不再寫入 GitHub。

## 本機檢查

```sh
npm run build
node scripts/build-content-seed.mjs --output /tmp/crivu-content-seed.sql
sqlite3 /tmp/crivu.db < migrations/0001_comments.sql
sqlite3 /tmp/crivu.db < migrations/0002_comments_source.sql
sqlite3 /tmp/crivu.db < migrations/0003_content_platform.sql
sqlite3 /tmp/crivu.db < /tmp/crivu-content-seed.sql
```

正式部署前，將 `wrangler.jsonc.example` 複製為 `wrangler.jsonc`，只替換真實 D1 database ID。不要提交密鑰。

## Cloudflare 綁定

- D1 binding：`CRIVU_DB`
- R2 binding：`MEDIA_BUCKET`
- Pages build command：`npm run build`
- Pages output directory：`dist`

必要 Secrets／Variables：

- `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`：管理員 OAuth。
- `ADMIN_GITHUB_LOGINS`：獲准登入的 GitHub 帳號，逗號分隔。
- `SESSION_SECRET`：長隨機值，用於簽署管理員工作階段。
- `TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET_KEY`：留言板驗證。
- `GUESTBOOK_HASH_SALT`：留言私隱雜湊鹽值。
- `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`：可選，待審核通知。

本機可用 `GUESTBOOK_ALLOW_UNVERIFIED=true` 跳過 Turnstile；正式環境不可啟用。

## 資料遷移

1. 備份 D1、R2 與 `posts/*.json`。
2. 明確核對目標資料庫名稱後執行 migrations。
3. 以 `scripts/build-content-seed.mjs` 生成可重複執行的 SQL，匯入後用 `scripts/audit-content-migration.mjs <origin>` 核對數量。
4. `0003_content_platform.sql` 只複製舊 `slug=about` 留言到 `guestbook_entries`，不會刪除舊評論。
5. `node scripts/migrate-media-to-r2.mjs` 只列出媒體；人工核對 bucket 後才可加 `--execute --bucket <name>`。
6. 確認 R2 文件與 D1 媒體資料完整後，才可另行刪除舊 Git 媒體或舊評論。這些刪除不得與首次遷移同批執行。

## 發布前驗收

- `/` 以 308 導向 `/articles`。
- `/articles`、`/issues`、`/records`、`/about`、RSS 與 Sitemap 均由 D1 內容生成。
- 一般、研究、劇本的正文、研究邊注、中英文關聯、圖庫與展覽入口正常。
- 非關於頁沒有評論 UI、評論腳本或評論 API。
- 後台可建立、預覽、自動保存、發布、封存與恢復文章修訂。
- R2 上傳與媒體庫正常，且後台不向 GitHub 寫內容。

## 標準推送與部署規則

每批改動只建立一個提交、只推送一次，避免用重複推送試探部署狀態。

1. 僅檢查一次 `git status -sb`，確認本批改動範圍；有無關修改時先分離。
2. 需要本機驗收時只執行一次 `npm run build`。Cloudflare Pages 的正式構建命令同樣是 `npm run build`，輸出目錄為 `dist`。
3. 將本批檔案建立一個語義清楚的提交。
4. 推送前執行一次 `git fetch origin main`；若本機落後，僅 rebase 一次並處理衝突。
5. 直接推送生產分支：`git push origin main`。
6. GitHub 接受推送後立即停止並回報提交 SHA。除非站主明確要求診斷，不等待、不輪詢 Cloudflare 構建或正式網站。

如果一次成功推送後網站仍是舊版本，不要再次推送。依序核對 Cloudflare Pages 的生產分支是否為 `main`、部署提交 SHA、專案根目錄、構建輸出 `dist`、Pages Functions、`cbc688.com` 綁定；確認部署正確後才按需清除快取。

## 快取與版本規則

- Functions 生成的 HTML 使用 Cloudflare `CF_PAGES_COMMIT_SHA` 前 12 位作為 `?v=` 資源版本；每次部署自動產生新 CSS／JS URL，無需人工修改版本號。
- 靜態研究圖庫在構建時使用同一部署 SHA；本機構建則使用相關 CSS／JS 內容雜湊。
- `/assets/*` 可保持 `public, max-age=31536000, immutable`，但 Cloudflare Cache Rules 必須尊重查詢字串，不得啟用忽略 query string。
- R2 媒體使用帶 UUID 的唯一地址，可保持一年 immutable；替換圖片必須產生新地址，不覆蓋舊 key。
- HTML、`/api/*` 與 `/admin/*` 保持 `no-store`；RSS 與 Sitemap 最多快取一小時。
- `dist/`、`.wrangler/` 與 `node_modules/` 都是本機生成物或依賴，不得提交。

## 發布邊界

- 正常發布只推送 GitHub `main`，由 Cloudflare Pages 自動構建；不再發布 EdgeOne。
- 不提交 `.env`、Cloudflare 密鑰、OAuth Secret、Session Secret 或真實 Wrangler 私密配置。
- GitHub 只保存程式、遷移與部署配置；後台文章存入 D1，圖片與附件存入 R2。
