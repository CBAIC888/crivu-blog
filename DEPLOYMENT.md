# CRIVU 學術版運行手冊

目前只保留 Cloudflare Pages。EdgeOne、FSNotes、Decap CMS 與 GitHub Content API 已移除；GitHub 僅用於第一階段管理員登入。

## 本機檢查

```sh
npm run build
node scripts/build-content-seed.mjs --output /tmp/crivu-content-seed.sql
sqlite3 /tmp/crivu.db <<'SQL'
PRAGMA foreign_keys = ON;
.read migrations/0001_comments.sql
.read migrations/0002_comments_source.sql
.read migrations/0003_content_platform.sql
.read /tmp/crivu-content-seed.sql
PRAGMA foreign_key_check;
SQL
```

正式部署前，將 `wrangler.jsonc.example` 複製為 `wrangler.jsonc`，只替換真實 D1 database ID。不要提交密鑰。

## Cloudflare 綁定

- D1 binding：`CRIVU_DB`
- D1 database：`crivu-content`
- R2 binding：`MEDIA_BUCKET`
- R2 bucket：`crivu-media`
- Pages project：`crivu-blog`
- Pages build command：`npm run build`
- Pages output directory：`dist`

必要 Secrets／Variables：

- `GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`：管理員 OAuth。
- `ADMIN_GITHUB_LOGINS`：獲准登入的 GitHub 帳號，逗號分隔。
- `SESSION_SECRET`：長隨機值，用於簽署管理員工作階段。
- `TURNSTILE_SITE_KEY`、`TURNSTILE_SECRET_KEY`：留言板驗證。
- `GUESTBOOK_HASH_SALT`：留言私隱雜湊鹽值。
- `TELEGRAM_BOT_TOKEN`、`TELEGRAM_CHAT_ID`：可選，待審核通知。

GitHub OAuth callback 必須保持為 `https://cbc688.com/api/callback`。

本機可用 `GUESTBOOK_ALLOW_UNVERIFIED=true` 跳過 Turnstile；正式環境不可啟用。

## 資料遷移

1. 備份 D1、R2 與 `posts/*.json`。
2. 明確核對目標資料庫名稱後執行 migrations。
3. 以 `scripts/build-content-seed.mjs` 生成可重複執行的 SQL，匯入後用 `scripts/audit-content-migration.mjs <origin>` 核對數量。
4. `0003_content_platform.sql` 只複製舊 `slug=about` 留言到 `guestbook_entries`，不會刪除舊評論。
5. `node scripts/migrate-media-to-r2.mjs` 只列出媒體；人工核對 bucket 後才可加 `--execute --bucket <name>`。
6. 確認 R2 文件與 D1 媒體資料完整後，才可另行刪除舊 Git 媒體或舊評論。這些刪除不得與首次遷移同批執行。

## 正式發布

1. 先以 `npx wrangler whoami` 確認 Cloudflare 帳號。
2. 核對 `crivu-content` 與 `crivu-media`，匯出舊 D1；舊 D1、舊評論、舊 preview 與舊媒體在首次發布不刪除。
3. 在空資料庫依序執行 `0001`、`0002`，匯入舊 comments 後再執行 `0003`與 seed。
4. 以 `PRAGMA foreign_key_check`、資料數量與 `node scripts/audit-content-migration.mjs <origin>` 核對遷移。
5. 檢查 production 環境的 `CRIVU_DB`、`MEDIA_BUCKET`、Secrets／Variables 與 output directory 皆正確。
6. 建置後執行 `npx wrangler pages deploy dist --project-name=crivu-blog --branch=main`。Git 整合的 production branch 仍為 `main`。
7. 驗收 `https://cbc688.com`、`https://cbc688.com/rss.xml`、公開 API、舊網址重定向與後台登入入口。

## 發布前驗收

- `/` 以 308 導向 `/articles`。
- `/articles`、`/issues`、`/records`、`/about`、RSS 與 Sitemap 均由 D1 內容生成。
- 一般、研究、劇本的正文、研究邊注、中英文關聯、圖庫與展覽入口正常。
- 非關於頁沒有評論 UI、評論腳本或評論 API。
- 後台可建立、預覽、自動保存、發布、封存與恢復文章修訂。
- R2 上傳與媒體庫正常，且後台不向 GitHub 寫內容。

部署後先保留舊 `COMMENTS_DB`、FSNotes Secrets 與舊資料作為回滾保護；穩定運行後再另行審議退役，不與首次遷移同批刪除。
