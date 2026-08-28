# CRIVU 前端源碼

正式網站由 Cloudflare Pages Functions 從 D1 讀取內容並生成頁面，媒體由 R2 與 `assets/img/` 提供。`npm run build` 將可部署的靜態檔案寫入 `dist/`。

## 目錄

- `content/`：「世界」專題的中英文正文。
- `styles/`：公開網站與專題圖庫樣式。
- `scripts/`：導覽、搜尋、主題、分析、圖庫與留言板互動。
- `assets/world-gallery/`：「世界」專題圖庫。
- `templates/research-gallery.html`：專題圖庫頁面。
- `renderers/public-site.js`：公開頁面的伺服器端組版。

專案根目錄中的 `functions/` 負責 Pages 路由與 API，`migrations/` 保存 D1 結構，`posts/` 是遷移用內容來源，`scripts/` 保存構建、遷移及本機檢查工具。
