/*
 * CRIVU 後台補強
 * - 兩個編輯器元件：圖片、音訊
 * - 右下角浮動工具列：音訊上傳、在新分頁預覽正式站
 * - 站點設定頁的浮動說明卡，提醒欄位前綴的分組規則
 * - 當使用者在「品牌強調色」欄位填入 #rrggbb 時，旁邊顯示即時色塊
 */

(function () {
  if (typeof CMS === 'undefined') return;

  /* ============================================================
     1. 兩個 Markdown 自訂元件（圖片、音訊）
     ============================================================ */
  const escapeHtml = (input) =>
    String(input == null ? '' : input)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

  CMS.registerEditorComponent({
    id: 'image-block',
    label: '圖片（含尺寸建議）',
    fields: [
      { name: 'src', label: '圖片', widget: 'image' },
      { name: 'alt', label: '替代文字', widget: 'string', required: false },
      {
        name: 'preset',
        label: '尺寸預設',
        widget: 'select',
        default: 'article-1200x800',
        options: [
          { label: '封面橫圖 1600x1000', value: 'cover-1600x1000' },
          { label: '文內橫圖 1200x800', value: 'article-1200x800' },
          { label: '社群直圖 1080x1350', value: 'portrait-1080x1350' }
        ]
      },
      { name: 'caption', label: '圖片說明', widget: 'string', required: false }
    ],
    pattern: /!\[(.*?)\]\((.*?)\)\n<!--\s*preset:(.*?)\s*-->\n?(?:\*(.*?)\*)?/,
    fromBlock(match) {
      return {
        alt: match[1] || '',
        src: match[2] || '',
        preset: match[3] || 'article-1200x800',
        caption: match[4] || ''
      };
    },
    toBlock(obj) {
      const alt = obj.alt || '';
      const src = obj.src || '';
      const preset = obj.preset || 'article-1200x800';
      const caption = obj.caption ? '\n*' + obj.caption + '*' : '';
      return '![' + alt + '](' + src + ')\n<!-- preset:' + preset + ' -->' + caption;
    },
    toPreview(obj) {
      const caption = obj.caption ? '<figcaption>' + escapeHtml(obj.caption) + '</figcaption>' : '';
      return '<figure><img src="' + escapeHtml(obj.src || '') + '" alt="' + escapeHtml(obj.alt || '') + '"/>' + caption + '</figure>';
    }
  });

  CMS.registerEditorComponent({
    id: 'audio-block',
    label: '音訊（Cloudflare）',
    fields: [
      { name: 'src', label: '音訊 URL', widget: 'string', hint: '可用右下角「上傳音訊」按鈕自動插入' },
      { name: 'title', label: '音訊標題', widget: 'string', required: false },
      { name: 'caption', label: '音訊說明', widget: 'string', required: false }
    ],
    pattern: /\[audio\]\((.*?)\)\n<!--\s*title:(.*?)\s*-->\n?(?:\*(.*?)\*)?/,
    fromBlock(match) {
      return {
        src: match[1] || '',
        title: match[2] || '',
        caption: match[3] || ''
      };
    },
    toBlock(obj) {
      const src = obj.src || '';
      const title = obj.title || '';
      const caption = obj.caption ? '\n*' + obj.caption + '*' : '';
      return '[audio](' + src + ')\n<!-- title:' + title + ' -->' + caption;
    },
    toPreview(obj) {
      const title = obj.title ? '<strong>' + escapeHtml(obj.title) + '</strong>' : '';
      const caption = obj.caption ? '<div>' + escapeHtml(obj.caption) + '</div>' : '';
      return (
        '<figure>' +
        title +
        '<audio controls preload="metadata" src="' +
        escapeHtml(obj.src || '') +
        '"></audio>' +
        caption +
        '</figure>'
      );
    }
  });

  /* ============================================================
     2. 插入到游標位置的工具（音訊上傳用）
     ============================================================ */
  const lastSelection = { textarea: null, start: 0, end: 0 };

  const rememberSelection = (el) => {
    if (!el || el.tagName !== 'TEXTAREA') return;
    lastSelection.textarea = el;
    lastSelection.start = Number.isFinite(el.selectionStart) ? el.selectionStart : el.value.length;
    lastSelection.end = Number.isFinite(el.selectionEnd) ? el.selectionEnd : el.value.length;
  };

  const findEditorTextarea = () => {
    if (lastSelection.textarea && document.contains(lastSelection.textarea)) {
      return lastSelection.textarea;
    }
    const candidates = Array.from(document.querySelectorAll('textarea')).filter((el) => el.offsetParent !== null);
    return candidates[0] || null;
  };

  const insertAtCursor = (markdown) => {
    const el = findEditorTextarea();
    if (!el) throw new Error('找不到文章編輯區（textarea）');
    const value = el.value || '';
    const start = Number.isFinite(lastSelection.start) ? lastSelection.start : value.length;
    const end = Number.isFinite(lastSelection.end) ? lastSelection.end : start;
    const prefix = value.slice(0, start);
    const suffix = value.slice(end);
    const leading = prefix && !prefix.endsWith('\n') ? '\n' : '';
    const trailing = suffix && !suffix.startsWith('\n') ? '\n' : '';
    const block = leading + markdown + trailing;
    const next = prefix + block + suffix;
    el.value = next;
    const caret = prefix.length + block.length;
    el.selectionStart = caret;
    el.selectionEnd = caret;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.focus();
    rememberSelection(el);
  };

  const escapeMd = (input) =>
    String(input == null ? '' : input).replaceAll('\n', ' ').replaceAll('\r', ' ').replaceAll('*', '\\*');

  const fileTitle = (name) => String(name || '未命名音訊').replace(/\.[^.]+$/, '');

  const getCmsToken = () => {
    try {
      const raw =
        window.localStorage.getItem('decap-cms-user') || window.localStorage.getItem('netlify-cms-user');
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return '';
      if (parsed.token) return parsed.token;
      if (parsed.access_token) return parsed.access_token;
      if (parsed.auth && parsed.auth.token) return parsed.auth.token;
    } catch (err) {
      console.warn('讀取 CMS token 失敗', err);
    }
    return '';
  };

  const uploadAudioToCloudflare = async (file) => {
    const token = getCmsToken();
    if (!token) throw new Error('尚未登入 CMS，請先登入後再上傳音訊');

    const signRes = await fetch('/api/r2-upload-sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size
      })
    });
    const signJson = await signRes.json().catch(() => ({}));
    if (!signRes.ok) throw new Error(signJson.error || '取得 Cloudflare 上傳簽名失敗');

    const putRes = await fetch(signJson.uploadUrl, {
      method: signJson.method || 'PUT',
      headers: signJson.headers || { 'Content-Type': file.type || 'application/octet-stream' },
      body: file
    });
    if (!putRes.ok) throw new Error('上傳到 Cloudflare 失敗（' + putRes.status + '）');

    return signJson.publicUrl;
  };

  /* ============================================================
     3. 右下角浮動工具列
     ============================================================ */
  const mountFabCluster = () => {
    if (document.querySelector('.cms-fab-cluster')) return;

    const cluster = document.createElement('div');
    cluster.className = 'cms-fab-cluster';

    // 音訊上傳按鈕（原本就有，保留）
    const audioBtn = document.createElement('button');
    audioBtn.type = 'button';
    audioBtn.id = 'cfAudioUploadButton';
    audioBtn.className = 'fab-primary';
    audioBtn.innerHTML = '🎵 上傳音訊';

    audioBtn.addEventListener('click', () => {
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac';
      fileInput.onchange = async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const originalHtml = audioBtn.innerHTML;
        audioBtn.disabled = true;
        audioBtn.innerHTML = '上傳中…';
        try {
          const publicUrl = await uploadAudioToCloudflare(file);
          const title = escapeMd(fileTitle(file.name));
          const markdown = '[audio](' + publicUrl + ')\n<!-- title:' + title + ' -->';
          insertAtCursor(markdown);
          audioBtn.innerHTML = '✓ 已插入音訊';
          setTimeout(() => {
            audioBtn.innerHTML = originalHtml;
            audioBtn.disabled = false;
          }, 1400);
        } catch (err) {
          console.error(err);
          alert(err && err.message ? err.message : '音訊上傳失敗');
          audioBtn.innerHTML = originalHtml;
          audioBtn.disabled = false;
        }
      };
      fileInput.click();
    });

    // 在新分頁預覽正式站
    const siteLink = document.createElement('a');
    siteLink.target = '_blank';
    siteLink.rel = 'noopener';
    siteLink.href = 'https://cbc688.com/';
    siteLink.innerHTML = '🌐 預覽網站';

    cluster.appendChild(audioBtn);
    cluster.appendChild(siteLink);
    document.body.appendChild(cluster);
  };

  /* ============================================================
     4. 站點設定頁的浮動說明卡
        偵測網址 hash 進入 /collections/site 時才顯示。
     ============================================================ */
  const ensureSiteHintCard = () => {
    const isSitePage =
      location.hash.includes('/collections/site') || location.hash.includes('/edit/site');
    const existing = document.querySelector('.cms-hint-card');
    if (!isSitePage) {
      if (existing) existing.remove();
      return;
    }
    if (existing) return;

    const container =
      document.querySelector("[class*='PreviewPaneContainer']")?.parentElement ||
      document.querySelector("[class*='EditorContainer']") ||
      document.body;

    const card = document.createElement('div');
    card.className = 'cms-hint-card';
    card.innerHTML = `
      <strong>站點設定說明</strong>：
      欄位依 <code>「基本」</code> / <code>「導航」</code> / <code>「主題」</code> /
      <code>「首頁」</code> / <code>「文章頁」</code> / <code>「期刊頁」</code> /
      <code>「關於頁」</code> / <code>「舊版」</code> 前綴分組。
      修改發佈後前端自動套用；帶有「舊版」字樣的欄位代表目前前端不再使用，僅保留避免既有部署失效。
    `;
    container.prepend(card);
  };

  /* ============================================================
     5. 顏色欄位即時色塊
     ============================================================ */
  const attachColorSwatches = () => {
    document.querySelectorAll('input[type="text"]').forEach((input) => {
      if (input.dataset.swatchAttached) return;
      const labelText = input.closest('[class*="EditorControl"]')?.querySelector('[class*="ControlLabel"]')?.textContent || '';
      if (!labelText.includes('強調色') && !labelText.includes('色碼')) return;

      input.dataset.swatchAttached = '1';
      const wrapper = input.parentElement;
      if (!wrapper) return;
      wrapper.classList.add('cms-color-field');
      const swatch = document.createElement('span');
      swatch.className = 'cms-color-swatch';
      wrapper.appendChild(swatch);

      const sync = () => {
        const v = String(input.value || '').trim();
        swatch.style.background = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) ? v : 'transparent';
      };
      sync();
      input.addEventListener('input', sync);
      input.addEventListener('change', sync);
    });
  };

  /* ============================================================
     6. 事件綁定
     ============================================================ */
  ['focusin', 'click', 'keyup', 'select'].forEach((evt) => {
    document.addEventListener(evt, (e) => rememberSelection(e.target), true);
  });

  const onRouteChange = () => {
    ensureSiteHintCard();
    // 色塊會在 CMS 重新渲染輸入框後失效，重綁一次
    attachColorSwatches();
  };
  window.addEventListener('hashchange', onRouteChange);

  // DOM 變動時重跑一次小工具（CMS 會動態換頁）
  let tick = 0;
  const observer = new MutationObserver(() => {
    cancelAnimationFrame(tick);
    tick = requestAnimationFrame(() => {
      ensureSiteHintCard();
      attachColorSwatches();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  /* ============================================================
     7. Boot
     ============================================================ */
  const boot = () => {
    const config = window.DECAP_CMS_CONFIG || window.CMS_CONFIG;
    if (config) {
      if (window.CMS_CONFIG) {
        try { delete window.CMS_CONFIG; } catch { window.CMS_CONFIG = undefined; }
      }
      CMS.init({ config });
    }
    mountFabCluster();
    onRouteChange();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
