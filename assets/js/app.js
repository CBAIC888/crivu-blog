const state = {
  posts: [],
  site: {},
  search: '',
  currentCategory: '',
  currentTag: '',
  applyHome: null,
  applyCategory: null,
  applyTag: null,
};

const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));
const FALLBACK_COVER = '/assets/img/cover-01.svg';

const escapeHtml = (input) =>
  String(input ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const sanitizeUrl = (value, options = {}) => {
  const { allowHash = true } = options;
  const input = String(value ?? '').trim();
  if (!input) return '#';
  if (allowHash && input.startsWith('#')) return '#';
  if (input.startsWith('/') || input.startsWith('./') || input.startsWith('../')) return input;
  try {
    const parsed = new URL(input, window.location.origin);
    const protocol = parsed.protocol.toLowerCase();
    if (protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:') return parsed.href;
  } catch {
    return '#';
  }
  return '#';
};

const safeCoverUrl = (value) => {
  const safe = sanitizeUrl(value, { allowHash: false });
  return safe === '#' ? FALLBACK_COVER : safe;
};

const postUrl = (slug) => `/post.html?slug=${encodeURIComponent(String(slug ?? ''))}`;

const setText = (sel, value) => {
  const el = qs(sel);
  if (el && value !== undefined && value !== null && value !== '') el.textContent = value;
};

const toInt = (value, fallback, min, max) => {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
};

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  qsa('.theme-icon').forEach((icon) => {
    icon.textContent = theme === 'dark' ? '☾' : '☀';
  });
};

const setupTheme = () => {
  const toggle = qs('#themeToggle');
  if (!toggle) return;

  toggle.innerHTML = '<span id="themeIcon" class="theme-icon">☀</span>';
  const nav = qs('.nav');
  if (nav && !qs('#mobileThemeToggle')) {
    const mobileThemeBtn = document.createElement('button');
    mobileThemeBtn.type = 'button';
    mobileThemeBtn.id = 'mobileThemeToggle';
    mobileThemeBtn.className = 'mobile-theme-action';
    mobileThemeBtn.innerHTML = '<span class="theme-icon">☀</span><span>變換主題</span>';
    nav.appendChild(mobileThemeBtn);
  }

  const stored = localStorage.getItem('theme') || 'light';
  applyTheme(stored);

  const switchTheme = () => {
    toggle.classList.remove('spin');
    void toggle.offsetWidth;
    toggle.classList.add('spin');
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  };

  toggle.addEventListener('click', switchTheme);
  const mobileThemeToggle = qs('#mobileThemeToggle');
  if (mobileThemeToggle) mobileThemeToggle.addEventListener('click', switchTheme);
};

const loadPosts = async () => {
  const res = await fetch('/posts/posts.json');
  const data = await res.json();
  state.posts = (data.items || data).slice();
  state.posts.sort((a, b) => b.date.localeCompare(a.date));
};

const loadSite = async () => {
  try {
    const res = await fetch('/posts/site.json');
    if (!res.ok) return;
    state.site = await res.json();
  } catch {
    state.site = {};
  }
};

const applySiteSettings = () => {
  const site = state.site;
  qsa('#siteName').forEach((el) => {
    if (site.siteName) el.textContent = site.siteName;
  });
  qsa('#siteFooterText').forEach((el) => {
    if (site.footerText) el.textContent = site.footerText;
  });

  setText('#homeKicker', site.homeKicker);
  setText('#homeTitle', site.homeTitle);
  setText('#homeSubtitle', site.homeSubtitle);
  setText('#homeLatestButton', site.homeLatestButtonText);
  setText('#latestTitle', site.latestTitle);
  setText('#articlesPageTitle', site.articlesPageTitle);
  setText('#issuesPageTitle', site.issuesPageTitle);
  setText('#aboutKicker', site.aboutKicker);
  setText('#aboutTitle', site.aboutTitle);
  setText('#aboutIntro', site.aboutIntro);
  setText('#aboutStyle', site.aboutStyle);
  setText('#aboutInfoTitle', site.aboutInfoTitle);
  setText('#aboutMailLink', site.aboutMailLabel);
  setText('#aboutCity', site.city);
  setText('#aboutEmail', site.email);
  setText('#aboutTopics', site.topics);

  const mailLink = qs('#aboutMailLink');
  if (mailLink && site.email) {
    mailLink.setAttribute('href', sanitizeUrl(`mailto:${site.email}`));
  }

  qsa('#searchInput').forEach((input) => {
    if (site.searchPlaceholder) input.setAttribute('placeholder', site.searchPlaceholder);
  });

  const root = document.documentElement;
  root.style.setProperty('--home-cols', String(toInt(site.homeCardsDesktop, 3, 1, 4)));
  root.style.setProperty('--list-cols', String(toInt(site.articleCardsDesktop, 3, 1, 4)));
};

const applyNavigation = (site) => {
  const nav = qs('.nav');
  if (!nav || !Array.isArray(site.nav) || site.nav.length === 0) return;

  const currentPath = window.location.pathname.replace(/\/index\.html$/, '/') || '/';
  const items = site.nav
    .filter((item) => item && item.label && item.href)
    .map((item) => {
      const href = item.href;
      const safeHref = sanitizeUrl(href);
      const normalized = new URL(safeHref, window.location.origin).pathname.replace(/\/index\.html$/, '/') || '/';
      const isHome = normalized === '/';
      const isActive = isHome ? currentPath === '/' : currentPath.startsWith(normalized);
      return `<a href="${escapeHtml(safeHref)}"${isActive ? ' class="active"' : ''}>${escapeHtml(item.label)}</a>`;
    });

  if (items.length > 0) nav.innerHTML = items.join('');
};

const setupHeaderOffset = () => {
  const header = qs('.site-header');
  if (!header) return;

  const apply = () => {
    const height = header.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--header-height', `${height}px`);
  };

  apply();
  window.addEventListener('resize', apply);
};

const initLazyBackgrounds = (root = document) => {
  const nodes = Array.from(root.querySelectorAll('[data-bg]'));
  if (nodes.length === 0) return;

  const applyBg = (node) => {
    if (node.dataset.bgLoaded === '1') return;
    const src = node.getAttribute('data-bg');
    if (!src) return;
    node.style.backgroundImage = `url('${safeCoverUrl(src)}')`;
    node.dataset.bgLoaded = '1';
  };

  if (!('IntersectionObserver' in window)) {
    nodes.forEach(applyBg);
    return;
  }

  const io = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        applyBg(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '280px 0px' }
  );

  nodes.forEach((node) => io.observe(node));
};

const setupMobileSearch = () => {
  const btn = qs('#mobileSearchBtn');
  const header = qs('.site-header');
  const input = qs('#searchInput');
  if (!btn || !header || !input) return;

  btn.addEventListener('click', () => {
    header.classList.remove('mobile-menu-open');
    header.classList.toggle('mobile-search-open');
    if (header.classList.contains('mobile-search-open')) input.focus();
  });
};

const setupMobileMenu = () => {
  const btn = qs('#mobileMenuBtn');
  const header = qs('.site-header');
  const nav = qs('.nav');
  if (!btn || !header || !nav) return;

  btn.addEventListener('click', () => {
    header.classList.remove('mobile-search-open');
    header.classList.toggle('mobile-menu-open');
  });

  nav.addEventListener('click', (e) => {
    const target = e.target;
    if (target instanceof HTMLElement && target.closest('a')) {
      header.classList.remove('mobile-menu-open');
    }
  });

  document.addEventListener('click', (e) => {
    if (!header.contains(e.target)) {
      header.classList.remove('mobile-menu-open');
      header.classList.remove('mobile-search-open');
    }
  });
};

const renderCard = (post) => {
  const cover = safeCoverUrl(post.cover);
  const issue = post.issue ? `<span class="issue-pill">${escapeHtml(post.issue)}</span>` : '';
  const date = post.date ? `<small>${escapeHtml(post.date)}</small>` : '';
  const maxTags = toInt(state.site.maxTagsPerCard, 3, 1, 10);
  const safeTags = Array.isArray(post.tags) ? post.tags.slice(0, maxTags).map((tag) => escapeHtml(tag)) : [];
  const safeLink = postUrl(post.slug);
  return `
    <article class="post-card">
      <a class="image lazy-bg" href="${escapeHtml(safeLink)}" data-bg="${escapeHtml(cover)}"></a>
      <div class="content">
        <div class="card-meta"><span class="pill">${escapeHtml(post.category)}</span>${issue}${date}</div>
        <h3><a href="${escapeHtml(safeLink)}">${escapeHtml(post.title)}</a></h3>
        <p>${escapeHtml(post.excerpt)}</p>
        <div class="tag-row">${safeTags.map((t) => `<span class="tag">${t}</span>`).join('')}</div>
      </div>
    </article>
  `;
};

const renderGrid = (el, posts) => {
  if (!el) return;
  el.innerHTML = posts.map(renderCard).join('');
  initLazyBackgrounds(el);
};

const matchesSearch = (post, query) => {
  if (!query) return true;
  const q = query.toLowerCase();
  const tags = Array.isArray(post.tags) ? post.tags : [];
  return (
    String(post.title || '').toLowerCase().includes(q) ||
    String(post.excerpt || '').toLowerCase().includes(q) ||
    String(post.category || '').toLowerCase().includes(q) ||
    tags.some((t) => String(t).toLowerCase().includes(q))
  );
};

const setupSearch = () => {
  const input = qs('#searchInput');
  const results = qs('#searchResults');
  if (!input || !results) return;

  const params = new URLSearchParams(window.location.search);
  const q = params.get('q') || '';
  input.value = q;
  state.search = q;

  const renderResults = () => {
    const query = state.search.trim();
    if (!query) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }

    const matches = state.posts.filter((p) => matchesSearch(p, query)).slice(0, 6);
    if (matches.length === 0) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }

    results.innerHTML = matches
      .map(
        (p) => `
          <a class="search-item" href="${escapeHtml(postUrl(p.slug))}">
            ${escapeHtml(p.title)}
            <small>${escapeHtml(p.category)} · ${escapeHtml((Array.isArray(p.tags) ? p.tags : []).join(' / '))}</small>
          </a>
        `
      )
      .join('');
    results.classList.add('active');
  };

  const applyAll = () => {
    if (state.applyHome) state.applyHome();
    if (state.applyCategory) state.applyCategory();
    if (state.applyTag) state.applyTag();
    renderResults();
  };

  input.addEventListener('input', () => {
    state.search = input.value.trim();
    applyAll();
  });

  input.addEventListener('focus', renderResults);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('.search-item');
      if (first) window.location.href = first.getAttribute('href');
    }
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) results.classList.remove('active');
  });

  renderResults();
};

const setupFilters = () => {
  const categoryFilter = qs('#categoryFilter');
  const tagFilter = qs('#tagFilter');
  const grid = qs('#postGrid');
  if (!categoryFilter || !tagFilter || !grid) return;

  const categories = Array.from(new Set(state.posts.map((p) => p.category).filter(Boolean)));
  const tags = Array.from(new Set(state.posts.flatMap((p) => (Array.isArray(p.tags) ? p.tags : [])).filter(Boolean)));

  const allCategoryLabel = state.site.allCategoryLabel || '全部分類';
  const allTagLabel = state.site.allTagLabel || '全部標籤';
  categoryFilter.innerHTML = [allCategoryLabel, ...categories]
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join('');
  tagFilter.innerHTML = [allTagLabel, ...tags]
    .map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`)
    .join('');

  const apply = () => {
    const cat = categoryFilter.value;
    const tag = tagFilter.value;
    const filtered = state.posts.filter((p) => {
      const okCat = cat === allCategoryLabel || p.category === cat;
      const postTags = Array.isArray(p.tags) ? p.tags : [];
      const okTag = tag === allTagLabel || postTags.includes(tag);
      return okCat && okTag && matchesSearch(p, state.search);
    });
    renderGrid(grid, filtered);
  };

  categoryFilter.addEventListener('change', apply);
  tagFilter.addEventListener('change', apply);
  state.applyHome = apply;
  apply();
};

const setupCategoryPage = () => {
  const list = qs('#categoryList');
  const grid = qs('#categoryPosts');
  if (!list || !grid) return;

  const categories = Array.from(new Set(state.posts.map((p) => p.category).filter(Boolean)));
  list.innerHTML = categories
    .map((c) => `<button class="chip" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
    .join('');

  const renderCategory = (category) => {
    state.currentCategory = category;
    qsa('.chip').forEach((btn) => btn.classList.toggle('active', btn.dataset.cat === category));
    renderGrid(grid, state.posts.filter((p) => p.category === category && matchesSearch(p, state.search)));
  };

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    renderCategory(btn.dataset.cat);
  });

  if (categories.length > 0) renderCategory(categories[0]);
  state.applyCategory = () => {
    if (state.currentCategory) renderCategory(state.currentCategory);
  };
};

const setupTagPage = () => {
  const list = qs('#tagList');
  const grid = qs('#tagPosts');
  if (!list || !grid) return;

  const tags = Array.from(new Set(state.posts.flatMap((p) => (Array.isArray(p.tags) ? p.tags : [])).filter(Boolean)));
  list.innerHTML = tags
    .map((t) => `<button class="chip" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
    .join('');

  const renderTag = (tag) => {
    state.currentTag = tag;
    qsa('.chip').forEach((btn) => btn.classList.toggle('active', btn.dataset.tag === tag));
    renderGrid(
      grid,
      state.posts.filter((p) => {
        const postTags = Array.isArray(p.tags) ? p.tags : [];
        return postTags.includes(tag) && matchesSearch(p, state.search);
      })
    );
  };

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    renderTag(btn.dataset.tag);
  });

  if (tags.length > 0) renderTag(tags[0]);
  state.applyTag = () => {
    if (state.currentTag) renderTag(state.currentTag);
  };
};

const init = async () => {
  setupTheme();
  await Promise.all([loadPosts(), loadSite()]);

  applySiteSettings();
  applyNavigation(state.site);
  setupSearch();
  setupFilters();
  setupCategoryPage();
  setupTagPage();
  setupHeaderOffset();
  setupMobileSearch();
  setupMobileMenu();

  const grid = qs('#postGrid');
  if (grid && grid.childElementCount === 0) {
    renderGrid(grid, state.posts.filter((p) => matchesSearch(p, state.search)));
  }
};

init();
