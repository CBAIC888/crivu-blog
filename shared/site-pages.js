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
  const footerText = fallbackFooter(site);
  const searchPlaceholder = normalizeText(site.searchPlaceholder) || '搜尋文章';
  const siteDesc = normalizeText(site.siteDescription) || '';
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

  <footer class="site-footer">
    <div class="site-footer__inner">
      <div>
        <p class="cap">${escapeHtml(siteName)}</p>
        ${siteDesc ? `<p>${escapeHtml(siteDesc)}</p>` : ''}
      </div>
      <div>
        <p class="cap">Subscribe</p>
        <p><a href="/rss.xml">RSS</a></p>
      </div>
      <div class="site-footer__copy" id="siteFooterText">${escapeHtml(footerText)}</div>
    </div>
  </footer>

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

export const renderAboutPage = ({ site }) => {
  const aboutKicker = normalizeText(site.aboutKicker) || 'About';
  const aboutTitle = normalizeText(site.aboutTitle) || '關於';
  const aboutIntro =
    normalizeText(site.aboutIntro) ||
    '我是 CRIVU。這個網站是我的個人博客：把日常裡的靈感、技術實作、旅途見聞與閱讀思考等，整理成一期一期的內容。';
  const aboutStyle = normalizeText(site.aboutStyle);
  const aboutInfoTitle = normalizeText(site.aboutInfoTitle) || '資訊';
  const aboutCity = normalizeText(site.city);
  const aboutEmail = normalizeText(site.email, { allowPlaceholder: true });
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
        <h2>${escapeHtml(aboutInfoTitle)}</h2>
        ${facts.length > 0 ? `<dl class="about-facts">${facts.join('')}</dl>` : ''}
        ${mailLink}
      </aside>`
      : '';

  const mainHtml = `<main class="page-about about">
    <section class="about-shell">
      <div class="about-main">
        <p class="about-kicker">${escapeHtml(aboutKicker)}</p>
        <h1>${escapeHtml(aboutTitle)}</h1>
        <p class="about-lead">${escapeHtml(aboutIntro)}</p>
        ${aboutStyle ? `<p class="about-detail">${escapeHtml(aboutStyle)}</p>` : ''}
      </div>${asideHtml}
    </section>
  </main>`;

  return shell({
    currentPath: '/about.html',
    description: aboutIntro,
    mainHtml,
    scriptSrc: '/assets/js/app.js',
    site,
    title: `關於 · ${fallbackSiteName(site)}`,
  });
};
