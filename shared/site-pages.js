import {
  articlePath,
  buildDescription,
  escapeHtml,
  isValidEmail,
  normalizeText,
  renderNavItems,
  safeCoverUrl,
  sanitizeUrl,
} from './content.js';

const BUILD_VERSION = '__BUILD_VERSION__';

export const PAGE_HEADERS = {
  'Content-Type': 'text/html; charset=UTF-8',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
  'Content-Security-Policy':
    "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: https:; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; connect-src 'self' https://cloudflareinsights.com",
};

const DEFAULT_NAV = [
  { label: '首頁', href: '/' },
  { label: '期刊', href: '/issues.html' },
  { label: '文章', href: '/articles.html' },
  { label: '關於', href: '/about.html' },
];

const fetchStaticJson = async (context, pathname) => {
  const assetUrl = new URL(pathname, context.request.url);
  const res = context.env?.ASSETS?.fetch
    ? await context.env.ASSETS.fetch(new Request(assetUrl.toString(), { method: 'GET' }))
    : await fetch(assetUrl.toString());
  if (!res.ok) throw new Error(`Failed to load ${pathname}: ${res.status}`);
  return res.json();
};

export const loadSiteBundle = async (context) => {
  const [postsData, issuesData, siteData] = await Promise.all([
    fetchStaticJson(context, '/posts/posts.json'),
    fetchStaticJson(context, '/posts/issues.json').catch(() => ({ issues: [] })),
    fetchStaticJson(context, '/posts/site.json').catch(() => ({})),
  ]);

  const posts = (postsData.items || postsData || []).slice();
  posts.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  return {
    posts,
    issues: Array.isArray(issuesData.issues) ? issuesData.issues.slice() : [],
    site: siteData || {},
  };
};

const fallbackSiteName = (site) =>
  normalizeText(site.siteName, { allowPlaceholder: true }) || 'CRIVU';

const fallbackFooter = (site) =>
  normalizeText(site.footerText, { allowPlaceholder: true }) ||
  `© ${new Date().getFullYear()} ${fallbackSiteName(site)}`;

const navList = (site, currentPath) =>
  renderNavItems(
    Array.isArray(site.nav) && site.nav.length > 0 ? site.nav : DEFAULT_NAV,
    currentPath,
    {}
  );

const scriptTag = (src) =>
  src ? `\n  <script src="${escapeHtml(src)}?v=${BUILD_VERSION}" type="module"></script>` : '';

const sanitizeExternalUrl = (value) => {
  const raw = normalizeText(value, { allowPlaceholder: true });
  if (!raw) return '';
  if (raw.startsWith('/') || raw.startsWith('./') || raw.startsWith('../')) return raw;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:' || parsed.protocol === 'mailto:') {
      return parsed.href;
    }
  } catch {
    return '';
  }
  return '';
};

/* 社群平台 icon：單色 SVG，跟隨 currentColor */
const SOCIAL_ICONS = {
  github: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M12 0.5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.28-1.67-1.28-1.67-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.72 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.04 11.04 0 0 1 5.78 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.77.11 3.06.74.81 1.19 1.84 1.19 3.1 0 4.45-2.7 5.42-5.27 5.71.41.35.77 1.04.77 2.11v3.12c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 0.5z"/></svg>',
  twitter: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M18.244 2H21.5l-7.4 8.46L22.8 22h-6.76l-5.3-6.92L4.6 22H1.34l7.9-9.03L1.3 2h6.9l4.8 6.34L18.244 2Zm-1.18 18h1.87L7.02 4H5.05l12.02 16Z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  xiaohongshu: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M4 5h16v14H4z" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="12" y="16" text-anchor="middle" font-family="serif" font-size="11" font-weight="700" fill="currentColor">小</text></svg>',
  weibo: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M10.1 18.6c-3.7.3-6.9-1.3-7.1-3.6-.2-2.3 2.6-4.4 6.3-4.7 3.7-.3 6.9 1.3 7.1 3.6.2 2.3-2.6 4.4-6.3 4.7Zm.7-6.7c-2.9.3-5.2 2-5 3.8.1 1.8 2.6 3 5.5 2.7 2.9-.3 5.2-2 5-3.8-.1-1.8-2.6-3-5.5-2.7Zm-.2 1.5c-.8.1-1.4.7-1.3 1.4.1.7.8 1.1 1.6 1.1.8-.1 1.4-.7 1.3-1.4-.1-.7-.8-1.1-1.6-1.1Zm6.6-7.1a4.5 4.5 0 0 1 4.5 5c-.1 1-.8 1-1.4.8.5-2-.9-3.9-3-4-.9-.1-1 .4-.7.9.2.4-.3.9-.8.7-.9-.5-.3-3.4 1.4-3.4Zm.6 2.7c1 0 1.9.9 1.7 1.9-.1.6-.8.6-1.1.3.2-.8-.5-1.5-1.3-1.3-.4.1-.7-.2-.6-.5 0-.2.6-.5 1.3-.4Z"/></svg>',
  mastodon: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d="M21.3 8.1c0-4-2.7-5.1-2.7-5.1-1.3-.6-3.6-.9-6-.9h-.1c-2.4 0-4.7.3-6 .9 0 0-2.7 1.1-2.7 5.1 0 .9 0 1.9.1 2.8.2 3.2.7 6.3 3.7 7.2 1.4.4 2.5.5 3.5.5 1.6 0 2.5-.2 2.5-.2v-1.5s-1.1.4-2.3.3c-1.2 0-2.5-.1-2.7-1.6 0-.1 0-.3-.1-.4 0 0 1.1.3 2.6.4.9 0 1.7-.1 2.5-.2 2.4-.3 3.7-1.8 3.9-3.3.3-2.4.3-4 .3-4Zm-2.9 4.9h-1.8v-4.5c0-.9-.4-1.4-1.2-1.4-.9 0-1.3.5-1.3 1.6v2.4h-1.8V8.7c0-1.1-.4-1.6-1.3-1.6-.8 0-1.2.5-1.2 1.4V13H8V8.6c0-.9.2-1.6.7-2.1.5-.5 1.1-.8 2-.8.9 0 1.7.4 2.1 1.1l.4.8.4-.8c.5-.7 1.2-1.1 2.1-1.1.9 0 1.5.3 2 .8.4.5.7 1.2.7 2.1V13Z"/></svg>',
  link: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 5"/><path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19"/></svg>',
};

const renderSocialLinks = (site) => {
  const entries = [
    { key: 'github', label: 'GitHub', href: site.socialGithub },
    { key: 'twitter', label: 'Twitter', href: site.socialTwitter },
    { key: 'instagram', label: 'Instagram', href: site.socialInstagram },
    { key: 'xiaohongshu', label: '小紅書', href: site.socialXiaohongshu },
    { key: 'weibo', label: '微博', href: site.socialWeibo },
    { key: 'mastodon', label: 'Mastodon', href: site.socialMastodon },
  ];
  const customs = [site.socialCustom1, site.socialCustom2]
    .map((c) => {
      if (!c || typeof c !== 'object') return null;
      const href = sanitizeExternalUrl(c.href);
      const label = normalizeText(c.label) || href;
      return href ? { key: 'link', label, href } : null;
    })
    .filter(Boolean);

  const items = [...entries, ...customs]
    .map((item) => {
      if (!item) return '';
      const href = sanitizeExternalUrl(item.href);
      if (!href) return '';
      const icon = SOCIAL_ICONS[item.key] || SOCIAL_ICONS.link;
      const label = normalizeText(item.label) || item.key;
      return `<a class="social-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">${icon}</a>`;
    })
    .filter(Boolean)
    .join('');
  return items;
};

const renderFooter = (site, currentPath) => {
  const siteName = fallbackSiteName(site);
  const footerText = fallbackFooter(site);
  const siteDesc = normalizeText(site.siteDescription);
  const rawEmail = normalizeText(site.email, { allowPlaceholder: true });
  const email = rawEmail
    .replace(/\s*\(at\)\s*/gi, '@')
    .replace(/\s+at\s+/gi, '@')
    .replace(/ /g, '');
  const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
  const socialHtml = renderSocialLinks(site);

  const brandCol = `
    <div class="site-footer__col site-footer__col--brand">
      <p class="site-footer__brand">${escapeHtml(siteName)}</p>
      ${siteDesc ? `<p class="site-footer__desc">${escapeHtml(siteDesc)}</p>` : ''}
    </div>`;

  const contactCol =
    validEmail || socialHtml
      ? `
    <div class="site-footer__col site-footer__col--contact">
      <p class="cap">Contact</p>
      ${validEmail ? `<p><a href="mailto:${escapeHtml(validEmail)}">${escapeHtml(validEmail)}</a></p>` : ''}
      ${socialHtml ? `<div class="social-links" aria-label="社群連結">${socialHtml}</div>` : ''}
    </div>`
      : '';

  const subscribeCol = `
    <div class="site-footer__col site-footer__col--subscribe">
      <p class="cap">Subscribe</p>
      <p><a href="/rss.xml">RSS</a></p>
    </div>`;

  return `
  <footer class="site-footer">
    <div class="site-footer__inner">
      ${brandCol}
      ${contactCol}
      ${subscribeCol}
    </div>
    <div class="site-footer__copy" id="siteFooterText">${escapeHtml(footerText)}</div>
  </footer>`;
};

const toInt = (value, fallback, min, max) => {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const shell = ({
  bodyClass = '',
  currentPath,
  description,
  mainHtml,
  scriptSrc,
  site,
  title,
  ogImage,
}) => {
  const siteName = fallbackSiteName(site);
  const searchPlaceholder = normalizeText(site.searchPlaceholder) || '搜尋文章';
  const keywords = normalizeText(site.siteKeywords);
  const favicon =
    safeCoverUrl(site.favicon) !== '/assets/img/cover-01.svg'
      ? safeCoverUrl(site.favicon)
      : '/assets/img/favicon.png';
  const ogImg = ogImage || safeCoverUrl(site.ogImage);
  const ogImgTag =
    ogImg && ogImg !== '/assets/img/cover-01.svg'
      ? `\n  <meta property="og:image" content="${escapeHtml(ogImg)}" />\n  <meta name="twitter:image" content="${escapeHtml(ogImg)}" />`
      : '';
  const twitterCard = ogImgTag ? 'summary_large_image' : 'summary';

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="build-version" content="${BUILD_VERSION}" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />${keywords ? `\n  <meta name="keywords" content="${escapeHtml(keywords)}" />` : ''}
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(siteName)}" />${ogImgTag}
  <meta name="twitter:card" content="${twitterCard}" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <link rel="alternate" type="application/rss+xml" title="${escapeHtml(siteName)} RSS" href="/rss.xml" />
  <link rel="stylesheet" href="/assets/css/style.css?v=${BUILD_VERSION}" />
  <link rel="icon" href="${escapeHtml(favicon)}" type="image/png" />
  <script src="/assets/js/theme.js?v=${BUILD_VERSION}"></script>
</head>
<body${bodyClass ? ` class="${escapeHtml(bodyClass)}"` : ''}>
  <header class="site-header">
    <div class="site-header__inner">
      <a class="site-header__brand" href="/">${escapeHtml(siteName)}</a>
      <nav class="site-header__nav" id="primaryNav">
        ${navList(site, currentPath)}
      </nav>
      <div class="site-header__actions">
        <form class="site-header__search" onsubmit="return false" role="search">
          <span class="icon" aria-hidden="true"></span>
          <input id="globalSearchInput" type="search" placeholder="${escapeHtml(searchPlaceholder)}" aria-label="搜尋文章" autocomplete="off" />
          <div id="globalSearchResults" class="search-results" role="listbox"></div>
        </form>
        <button class="mobile-search-toggle" id="mobileSearchBtn" aria-label="搜尋">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
            <line x1="16.2" y1="16.2" x2="20" y2="20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="mobile-menu-toggle" id="mobileMenuBtn" aria-label="展開選單" aria-expanded="false" aria-controls="primaryNav">
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" width="18" height="18">
            <line class="mm-line mm-line-top" x1="4" y1="7" x2="20" y2="7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <line class="mm-line mm-line-mid" x1="4" y1="12" x2="20" y2="12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            <line class="mm-line mm-line-bot" x1="4" y1="17" x2="20" y2="17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
        <button class="theme-toggle" data-theme-toggle aria-label="切換深色模式">
          <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"/></svg>
          <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
        </button>
      </div>
    </div>
  </header>

  ${mainHtml}

  ${renderFooter(site, currentPath)}

  <script src="/assets/js/search.js?v=${BUILD_VERSION}"></script>
  <script src="/assets/js/mobile-nav.js?v=${BUILD_VERSION}"></script>${scriptTag(scriptSrc)}
</body>
</html>`;
};

/* ---------- 共用片段 ---------- */

const renderTocRow = (post, index) => {
  const href = articlePath(post.slug);
  const num = String(index + 1).padStart(2, '0');
  const metaBits = [
    post.date ? `<span class="cap">${escapeHtml(post.date)}</span>` : '',
  ]
    .filter(Boolean)
    .join('');
  const excerpt = buildDescription(post, 80);
  const cover = safeCoverUrl(post.cover);
  return `
    <li class="toc__row">
      <span class="toc__num">${num}</span>
      <div class="toc__body">
        <p class="toc__meta">${metaBits}</p>
        <h3 class="toc__title"><a href="${escapeHtml(href)}">${escapeHtml(post.title || '')}</a></h3>
        ${excerpt ? `<p class="toc__excerpt">${escapeHtml(excerpt)}</p>` : ''}
      </div>
      <a class="toc__thumb" href="${escapeHtml(href)}" aria-hidden="true">
        <img src="${escapeHtml(cover)}" alt="" loading="lazy" />
      </a>
    </li>`;
};

const renderBook = (issue, posts, site) => {
  const linkedSlugs = Array.isArray(issue.posts)
    ? issue.posts
        .map((item) => (typeof item === 'string' ? item : item && item.slug))
        .filter(Boolean)
    : [];
  const count = linkedSlugs
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter(Boolean).length;
  const countTemplate = normalizeText(site.issueCountTemplate) || '收錄 {count} 篇文章';
  const countText = countTemplate.replace('{count}', `<strong>${count}</strong>`);
  const href = `/issues/${encodeURIComponent(issue.id || '')}`;
  const cover = safeCoverUrl(issue.cover);

  return `
    <a class="book" href="${escapeHtml(href)}" aria-label="${escapeHtml(issue.title || '')}">
      <div class="book__cover">
        <img src="${escapeHtml(cover)}" alt="" loading="lazy" />
      </div>
      <div class="book__meta">
        <p class="book__id">Issue ${escapeHtml(issue.id || '')}${issue.publishDate ? ` · ${escapeHtml(issue.publishDate)}` : ''}</p>
        <p class="book__title">${escapeHtml(issue.title || '')}</p>
        ${issue.theme ? `<p class="book__theme">${escapeHtml(issue.theme)}</p>` : ''}
        <p class="book__count">${countText}</p>
      </div>
    </a>`;
};

/* ---------- 頁面渲染 ---------- */

export const renderHomePage = ({ posts, site }) => {
  const limit = toInt(site.homeLatestLimit, 4, 1, 30);
  const latest = posts.slice(0, limit);

  const mainHtml = `<main>
    <section class="section section--flush">
      <header class="section__head">
        <div>
          <p class="kicker">Latest</p>
          <h1 class="section__title" id="latestTitle">${escapeHtml(normalizeText(site.latestTitle) || '最新文章')}</h1>
        </div>
        <p class="section__intro" id="latestIntro">${escapeHtml(normalizeText(site.latestIntro) || '按時間展開近期更新。')}</p>
      </header>

      <ol class="toc" id="postGrid">${latest.map(renderTocRow).join('')}</ol>

      <div class="section__more">
        <a href="/articles.html" class="ghost-link">查看全部文章 →</a>
      </div>
    </section>
  </main>`;

  return shell({
    bodyClass: 'home-page',
    currentPath: '/',
    description:
      normalizeText(site.siteDescription) ||
      normalizeText(site.homeSubtitle) ||
      normalizeText(site.latestIntro) ||
      'CRIVU · 隨記 · 節氣 · 戲曲 · 閱讀',
    mainHtml,
    scriptSrc: '/assets/js/app.js',
    site,
    title: fallbackSiteName(site),
  });
};

export const renderArticlesPage = ({ posts, site }) => {
  const mainHtml = `<main class="page-list list-page">
    <header class="page-head">
      <p class="kicker">Articles</p>
      <h1 class="page-title" id="articlesPageTitle">${escapeHtml(normalizeText(site.articlesPageTitle) || '文章')}</h1>
      <p class="page-intro" id="articlesPageIntro">${escapeHtml(normalizeText(site.articlesPageIntro) || '按時間順序閱讀全部文章。')}</p>
    </header>

    <ol class="toc" id="postGrid">${posts.map(renderTocRow).join('')}</ol>
  </main>`;

  return shell({
    currentPath: '/articles.html',
    description:
      normalizeText(site.articlesPageIntro) ||
      '按時間順序閱讀 CRIVU 的全部文章。',
    mainHtml,
    scriptSrc: '/assets/js/app.js',
    site,
    title: `文章 · ${fallbackSiteName(site)}`,
  });
};

export const renderIssuesPage = ({ issues, posts, site }) => {
  const mainHtml = `<main class="page-list issues-page">
    <header class="page-head">
      <p class="kicker">Issues</p>
      <h1 class="page-title" id="issuesPageTitle">${escapeHtml(normalizeText(site.issuesPageTitle) || '期刊')}</h1>
      <p class="page-intro" id="issuesPageIntro">${escapeHtml(normalizeText(site.issuesPageIntro) || '以期刊方式編排主題與收錄文章。點擊書本進入該期目錄。')}</p>
    </header>

    <div class="issue-shelf issues-grid" id="issuesGrid">${issues.map((issue) => renderBook(issue, posts, site)).join('')}</div>
  </main>`;

  return shell({
    bodyClass: 'page-issues',
    currentPath: '/issues.html',
    description:
      normalizeText(site.issuesPageIntro) ||
      '以期刊方式整理主題、編者語與收錄文章。',
    mainHtml,
    scriptSrc: '/assets/js/issues.js',
    site,
    title: `期刊 · ${fallbackSiteName(site)}`,
  });
};

export const renderSiteFooter = (site, currentPath) => renderFooter(site, currentPath);

export const renderAboutPage = ({ site }) => {
  const aboutKicker = normalizeText(site.aboutKicker) || 'About';
  const aboutTitle = normalizeText(site.aboutTitle) || '關於';
  const aboutIntro = normalizeText(site.aboutIntro);
  const aboutStyle = normalizeText(site.aboutStyle);
  const aboutInfoTitle = normalizeText(site.aboutInfoTitle);
  const aboutCity = normalizeText(site.city);
  const rawEmail = normalizeText(site.email, { allowPlaceholder: true });
  // 容錯：處理 Cloudflare Email Obfuscation 可能把 @ 變空格或 (at) 的情況
  const aboutEmail = rawEmail
    .replace(/\s*\(at\)\s*/gi, '@')
    .replace(/\s+at\s+/gi, '@')
    .replace(/ /g, '');
  const aboutTopics = normalizeText(site.topics);
  const validEmail = isValidEmail(aboutEmail);

  const facts = [
    aboutCity
      ? `<div><dt>${escapeHtml(normalizeText(site.aboutCityLabel) || '城市')}</dt><dd>${escapeHtml(aboutCity)}</dd></div>`
      : '',
    validEmail
      ? `<div><dt>${escapeHtml(normalizeText(site.aboutEmailLabel) || 'Email')}</dt><dd>${escapeHtml(aboutEmail)}</dd></div>`
      : '',
    aboutTopics
      ? `<div><dt>${escapeHtml(normalizeText(site.aboutTopicsLabel) || '主題')}</dt><dd>${escapeHtml(aboutTopics)}</dd></div>`
      : '',
  ].filter(Boolean);

  const mailLink = validEmail
    ? `<a class="about-mail" href="${escapeHtml(sanitizeUrl(`mailto:${aboutEmail}`))}">${escapeHtml(normalizeText(site.aboutMailLabel) || '聯絡我')}</a>`
    : '';

  const asideHtml =
    facts.length > 0 || mailLink
      ? `
      <aside class="about-side">
        ${aboutInfoTitle ? `<h2>${escapeHtml(aboutInfoTitle)}</h2>` : ''}
        ${facts.length > 0 ? `<dl class="about-facts">${facts.join('')}</dl>` : ''}
        ${mailLink}
      </aside>`
      : '';

  const mainHtml = `<main class="page-about about">
    <section class="about-shell">
      <div class="about-main">
        <p class="about-kicker">${escapeHtml(aboutKicker)}</p>
        <h1>${escapeHtml(aboutTitle)}</h1>
        ${aboutIntro ? `<p class="about-lead">${escapeHtml(aboutIntro)}</p>` : ''}
        ${aboutStyle ? `<p class="about-detail">${escapeHtml(aboutStyle)}</p>` : ''}
      </div>${asideHtml}
    </section>
  </main>`;

  return shell({
    currentPath: '/about.html',
    description: aboutIntro || `${fallbackSiteName(site)} · 關於`,
    mainHtml,
    scriptSrc: '/assets/js/app.js',
    site,
    title: `關於 · ${fallbackSiteName(site)}`,
  });
};
