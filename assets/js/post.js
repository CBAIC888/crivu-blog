import { articlePath, buildSearchSnippet, buildSearchText, escapeHtml, renderNavItems } from '../../shared/content.js';

const qs = (sel) => document.querySelector(sel);

const setupSearch = (posts) => {
  const input = qs('#searchInput');
  const results = qs('#searchResults');
  if (!input || !results) return;

  const matchesSearch = (post, query) => {
    if (!query) return true;
    return buildSearchText(post).toLowerCase().includes(query.toLowerCase());
  };

  const renderResults = () => {
    const query = input.value.trim();
    if (!query) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }

    const matches = posts.filter((post) => matchesSearch(post, query)).slice(0, 6);
    if (matches.length === 0) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }

    results.innerHTML = matches
      .map(
        (post) => `
          <a class="search-item" href="${escapeHtml(articlePath(post.slug))}">
            <span class="search-item-title">${escapeHtml(post.title)}</span>
            <small>${escapeHtml(buildSearchSnippet(post, query, 92))}</small>
          </a>
        `
      )
      .join('');
    results.classList.add('active');
  };

  input.addEventListener('input', renderResults);
  input.addEventListener('focus', renderResults);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const first = results.querySelector('.search-item');
      if (first) {
        window.location.href = first.getAttribute('href');
      }
    }
  });

  document.addEventListener('click', (event) => {
    if (!results.contains(event.target) && event.target !== input) {
      results.classList.remove('active');
    }
  });
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

const setupMobileSearch = () => {
  const btn = qs('#mobileSearchBtn');
  const header = qs('.site-header');
  const input = qs('#searchInput');
  if (!btn || !header || !input) return;

  btn.addEventListener('click', () => {
    header.classList.remove('mobile-menu-open');
    header.classList.toggle('mobile-search-open');
    if (header.classList.contains('mobile-search-open')) {
      input.focus();
    }
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

  nav.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLElement && target.closest('a')) {
      header.classList.remove('mobile-menu-open');
    }
  });

  document.addEventListener('click', (event) => {
    if (!header.contains(event.target)) {
      header.classList.remove('mobile-menu-open');
      header.classList.remove('mobile-search-open');
    }
  });
};

const applyProgress = () => {
  const progress = qs('#readProgress');
  if (!progress) return;

  const onScroll = () => {
    const doc = document.documentElement;
    const total = doc.scrollHeight - doc.clientHeight;
    const pct = total > 0 ? (doc.scrollTop / total) * 100 : 0;
    progress.style.width = `${pct}%`;
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
};

const applySite = async () => {
  try {
    const [siteRes, postsRes] = await Promise.all([fetch('/posts/site.json'), fetch('/posts/posts.json')]);
    const site = siteRes.ok ? await siteRes.json() : {};
    const postsData = postsRes.ok ? await postsRes.json() : [];
    const posts = postsData.items || postsData;

    const nav = qs('.nav');
    if (nav && Array.isArray(site.nav) && site.nav.length > 0) {
      const currentPath = window.location.pathname.replace(/\/index\.html$/, '/') || '/';
      const items = renderNavItems(site.nav, currentPath, { baseOrigin: window.location.origin });
      if (items) nav.innerHTML = items;
    }

    const searchInput = qs('#searchInput');
    if (searchInput && site.searchPlaceholder) {
      searchInput.setAttribute('placeholder', site.searchPlaceholder);
    }

    const moreTitle = qs('#moreTitle');
    if (moreTitle && site.moreReadingTitle) {
      moreTitle.textContent = site.moreReadingTitle;
    }

    setupSearch(Array.isArray(posts) ? posts : []);
  } catch {
    // keep server-rendered content as-is
  }
};

const init = async () => {
  setupHeaderOffset();
  setupMobileSearch();
  setupMobileMenu();
  applyProgress();
  await applySite();
};

init();
