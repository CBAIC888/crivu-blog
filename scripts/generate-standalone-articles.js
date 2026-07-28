#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ARTICLES_ROOT = path.join(ROOT, 'articles');
const POSTS_PATH = path.join(ROOT, 'posts', 'posts.json');
const SITE_PATH = path.join(ROOT, 'posts', 'site.json');
const STYLE_PATH = path.join(ROOT, 'assets', 'css', 'style.css');
const CONTENT_MODULE_PATH = path.join(ROOT, 'shared', 'content.js');
const INLINE_SCRIPT_PATHS = [
  path.join(ROOT, 'assets', 'js', 'mobile-nav.js'),
  path.join(ROOT, 'assets', 'js', 'search.js'),
];
const GENERATED_MARKER = '<!-- generated: standalone-article -->';
const SITE_ORIGIN = 'https://cbc688.com';

const MIME_TYPES = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.webp': 'image/webp',
};

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const readText = (filePath) => fs.readFileSync(filePath, 'utf8');

const loadContentModule = async () => {
  const source = readText(CONTENT_MODULE_PATH);
  const dataUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(dataUrl);
};

const toDataUrl = (buffer, mimeType) =>
  `data:${mimeType || 'application/octet-stream'};base64,${buffer.toString('base64')}`;

const localAssetPath = (urlValue) => {
  const pathname = decodeURIComponent(String(urlValue).split(/[?#]/, 1)[0]);
  const relative = pathname.replace(/^\/+/, '');
  const resolved = path.resolve(ROOT, relative);
  if (resolved !== ROOT && !resolved.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error(`Asset path escapes the project root: ${urlValue}`);
  }
  return resolved;
};

const embedAsset = async (urlValue) => {
  const source = String(urlValue || '').trim();
  if (!source || source.startsWith('data:') || source.startsWith('blob:')) return source;

  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Unable to embed ${source}: HTTP ${response.status}`);
    const mimeType = response.headers.get('content-type')?.split(';', 1)[0] || '';
    return toDataUrl(Buffer.from(await response.arrayBuffer()), mimeType);
  }

  if (source.startsWith('/') || source.startsWith('./') || source.startsWith('../')) {
    const filePath = localAssetPath(source);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error(`Unable to embed missing asset: ${source}`);
    }
    return toDataUrl(fs.readFileSync(filePath), MIME_TYPES[path.extname(filePath).toLowerCase()]);
  }

  return source;
};

const replaceAsync = async (source, pattern, replacer) => {
  const matches = [...source.matchAll(pattern)];
  if (matches.length === 0) return source;
  const replacements = await Promise.all(matches.map((match) => replacer(...match)));
  let output = '';
  let cursor = 0;
  matches.forEach((match, index) => {
    output += source.slice(cursor, match.index);
    output += replacements[index];
    cursor = match.index + match[0].length;
  });
  return output + source.slice(cursor);
};

const embedHtmlMedia = (html) =>
  replaceAsync(
    html,
    /(<(?:img|audio|source)\b[^>]*?\bsrc=["'])([^"']+)(["'])/gi,
    async (_whole, prefix, urlValue, quote) => `${prefix}${await embedAsset(urlValue)}${quote}`
  );

const inlineScript = (source) => source.replace(/<\/script/gi, '<\\/script');
const safeJson = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

const renderComments = (post, escapeHtml) => `
    <section class="comments" data-comments data-comments-slug="${escapeHtml(post.slug)}" aria-labelledby="commentsTitle">
      <div class="comments__inner">
        <header class="comments__head">
          <h2 id="commentsTitle" class="cap">評論</h2>
        </header>
        <div class="comments__list" data-comments-list>
          <p class="comments__empty">評論載入中。</p>
        </div>
        <form class="comments__form" data-comments-form>
          <div class="comments__fields">
            <label>
              <span>稱呼</span>
              <input name="authorName" maxlength="32" autocomplete="name" required />
            </label>
            <label>
              <span>電郵（不公開）</span>
              <input name="email" type="email" maxlength="160" autocomplete="email" />
            </label>
          </div>
          <label class="comments__body-field">
            <span>評論</span>
            <textarea name="body" rows="5" maxlength="1200" required></textarea>
          </label>
          <label class="comments__trap" aria-hidden="true" tabindex="-1">
            <span>Website</span>
            <input name="website" tabindex="-1" autocomplete="off" />
          </label>
          <div class="comments__verification">
            <span>驗證</span>
            <div class="comments__turnstile" data-comments-turnstile></div>
          </div>
          <div class="comments__actions">
            <button type="submit" data-comments-submit disabled>提交</button>
            <p class="comments__status" data-comments-status aria-live="polite"></p>
          </div>
        </form>
      </div>
    </section>`;

const renderArticle = async ({ post, site, content }) => {
  const {
    buildDescription,
    escapeHtml,
    formatDate,
    renderNavItems,
    simpleMarkdown,
  } = content;
  const siteName = String(site.siteName || 'CRIVU').trim() || 'CRIVU';
  const currentPath = `/articles/${post.slug}`;
  const canonicalUrl = `${SITE_ORIGIN}${currentPath}`;
  const description = String(post.excerpt || buildDescription(post) || '').trim();
  const bodyHtml = simpleMarkdown(post.body || '', { baseOrigin: SITE_ORIGIN });
  const navHtml = renderNavItems(site.nav || [], currentPath, { baseOrigin: SITE_ORIGIN });
  const css = readText(STYLE_PATH);
  const faviconPath = site.favicon || '/assets/img/favicon.png';
  const favicon = await embedAsset(faviconPath);
  const cover = post.cover
    ? `<div class="post-cover" id="postCover"><img src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title || '')}" decoding="async" /></div>`
    : '';
  const scripts = INLINE_SCRIPT_PATHS.map(readText).join('\n');
  const commentsScript = readText(path.join(ROOT, 'assets', 'js', 'comments.js'));
  const offlineGuard = `
    (() => {
      const fileMode = window.location.protocol === 'file:';
      const localPreview = ['127.0.0.1', 'localhost'].includes(window.location.hostname);
      window.__CRIVU_STANDALONE_PREVIEW__ = fileMode || localPreview;
      const comments = document.querySelector('[data-comments]');
      if (comments && (fileMode || localPreview)) comments.hidden = true;
      if (fileMode) {
        const search = document.querySelector('.site-header__search');
        if (search) search.hidden = true;
      }
    })();`;
  const themeScript = readText(path.join(ROOT, 'assets', 'js', 'theme.js'));
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description,
    datePublished: post.date,
    mainEntityOfPage: canonicalUrl,
    author: { '@type': 'Person', name: siteName },
  };

  const html = `<!doctype html>
${GENERATED_MARKER}
<html lang="${escapeHtml(post.language || 'zh-Hant')}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="build-version" content="standalone-html" />
  <title>${escapeHtml(post.title)} · ${escapeHtml(siteName)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:title" content="${escapeHtml(post.title)} · ${escapeHtml(siteName)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
  <meta property="og:site_name" content="${escapeHtml(siteName)}" />
  <meta name="twitter:card" content="summary" />
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
  <link rel="icon" href="${favicon}" type="image/png" />
  <script type="application/ld+json">${safeJson(structuredData)}</script>
  <style>
${css}
  </style>
  <script>
${inlineScript(themeScript)}
  </script>
</head>
<body class="page-post">
  <header class="site-header">
    <div class="site-header__inner">
      <a class="site-header__brand" href="/">${escapeHtml(siteName)}</a>
      <nav class="site-header__nav" id="primaryNav">${navHtml}</nav>
      <div class="site-header__actions">
        <form class="site-header__search" onsubmit="return false" role="search">
          <span class="icon" aria-hidden="true"></span>
          <input id="globalSearchInput" type="search" placeholder="${escapeHtml(site.searchPlaceholder || '搜尋文章')}" aria-label="搜尋文章" autocomplete="off" />
          <div id="globalSearchResults" class="search-results" role="listbox"></div>
        </form>
        <button class="mobile-menu-toggle" id="mobileMenuBtn" aria-label="展開選單" aria-expanded="false" aria-controls="primaryNav">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18">
            <line class="mm-line mm-line-top" x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <line class="mm-line mm-line-mid" x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <line class="mm-line mm-line-bot" x1="4" y1="17" x2="20" y2="17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="theme-toggle" data-theme-toggle aria-label="切換背景主題">
          <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
          <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </button>
      </div>
    </div>
  </header>

  <main class="page-post__main post-page">
    <article class="reading post-article" id="post">
      <header class="reading__head post-hero">
        <time class="reading__date" datetime="${escapeHtml(post.date || '')}">${escapeHtml(formatDate(post.date || ''))}</time>
        <h1 class="reading__title" id="postTitle">${escapeHtml(post.title || '')}</h1>
        ${post.excerpt ? `<p class="post-excerpt" id="postExcerpt">${escapeHtml(post.excerpt)}</p>\n        ` : ''}${cover}
      </header>
      <div class="reading__body post-body" id="postBody">${bodyHtml}</div>
    </article>
${renderComments(post, escapeHtml)}
  </main>

  <footer class="site-footer">
    <div class="site-footer__copy">${escapeHtml(site.footerText || `© ${new Date().getFullYear()} ${siteName}`)}</div>
  </footer>

  <script>
${inlineScript(offlineGuard)}
${inlineScript(scripts)}
  </script>
  <script type="module">
    if (!window.__CRIVU_STANDALONE_PREVIEW__) {
${inlineScript(commentsScript)}
    }
  </script>
</body>
</html>`;

  return embedHtmlMedia(html);
};

const removeStaleGeneratedArticles = (activeSlugs) => {
  if (!fs.existsSync(ARTICLES_ROOT)) return;
  for (const entry of fs.readdirSync(ARTICLES_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || activeSlugs.has(entry.name)) continue;
    const directory = path.join(ARTICLES_ROOT, entry.name);
    const indexPath = path.join(directory, 'index.html');
    if (!fs.existsSync(indexPath)) continue;
    const prefix = fs.readFileSync(indexPath, 'utf8').slice(0, 160);
    if (prefix.includes(GENERATED_MARKER)) fs.rmSync(directory, { recursive: true });
  }
};

const main = async () => {
  const postsData = readJson(POSTS_PATH);
  const site = readJson(SITE_PATH);
  const content = await loadContentModule();
  const posts = (postsData.items || postsData || []).filter(
    (post) => post && post.published !== false && post.standaloneHtml === true
  );
  const activeSlugs = new Set();

  fs.mkdirSync(ARTICLES_ROOT, { recursive: true });
  for (const post of posts) {
    const slug = String(post.slug || '').trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new Error(`Standalone article has an invalid slug: ${slug || '(empty)'}`);
    }
    activeSlugs.add(slug);
    const outputDirectory = path.join(ARTICLES_ROOT, slug);
    fs.mkdirSync(outputDirectory, { recursive: true });
    const html = await renderArticle({ post, site, content });
    fs.writeFileSync(path.join(outputDirectory, 'index.html'), html);
    process.stdout.write(`Generated standalone article: articles/${slug}/index.html\n`);
  }

  removeStaleGeneratedArticles(activeSlugs);
};

main().catch((error) => {
  process.stderr.write(`[generate-standalone-articles] ${error?.stack || error}\n`);
  process.exit(1);
});
