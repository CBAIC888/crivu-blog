const qs = (sel) => document.querySelector(sel);

const state = {
  site: {},
};

const setText = (sel, value) => {
  const el = qs(sel);
  if (el && value) el.textContent = value;
};

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  document.querySelectorAll('.theme-icon').forEach((icon) => {
    icon.textContent = theme === 'dark' ? '☾' : '☀';
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

const initLazyBackgrounds = (root = document) => {
  const nodes = Array.from(root.querySelectorAll('[data-bg]'));
  if (nodes.length === 0) return;

  const applyBg = (node) => {
    if (node.dataset.bgLoaded === '1') return;
    const src = node.getAttribute('data-bg');
    if (!src) return;
    node.style.backgroundImage = `url('${src}')`;
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

const matchesSearch = (post, query) => {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    post.title.toLowerCase().includes(q) ||
    post.excerpt.toLowerCase().includes(q) ||
    post.category.toLowerCase().includes(q) ||
    post.tags.some((t) => t.toLowerCase().includes(q))
  );
};

const setupSearch = (posts) => {
  const input = qs('#searchInput');
  const results = qs('#searchResults');
  if (!input || !results) return;

  const renderResults = () => {
    const query = input.value.trim();
    if (!query) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }
    const matches = posts.filter((p) => matchesSearch(p, query)).slice(0, 6);
    if (matches.length === 0) {
      results.classList.remove('active');
      results.innerHTML = '';
      return;
    }
    results.innerHTML = matches
      .map(
        (p) => `
          <a class="search-item" href="/post.html?slug=${p.slug}">
            ${p.title}
            <small>${p.category} · ${p.tags.join(' / ')}</small>
          </a>
        `
      )
      .join('');
    results.classList.add('active');
  };

  input.addEventListener('input', renderResults);
  input.addEventListener('focus', renderResults);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('.search-item');
      if (first) {
        window.location.href = first.getAttribute('href');
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.remove('active');
    }
  });
};

const renderIssue = (issue, posts) => {
  const cover = issue.cover || '/assets/img/cover-01.svg';
  const expandLabel = state.site.issueExpandLabel || '展開本期詳情';
  const emptyText = state.site.issueEmptyText || '暫無文章';
  const countTemplate = state.site.issueCountTemplate || '收錄 {count} 篇文章';
  const countText = countTemplate.replace('{count}', String((issue.posts || []).length));
  const detailsOpen = state.site.issueDetailsOpen ? ' open' : '';
  const linkedPosts = Array.isArray(issue.posts)
    ? issue.posts
        .map((item) => {
          if (typeof item === 'string') return item;
          if (item && typeof item.slug === 'string') return item.slug;
          return '';
        })
        .filter(Boolean)
    : [];
  const postCards = linkedPosts
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter(Boolean)
    .map(
      (post) => `
        <a class="issue-post" href="/post.html?slug=${post.slug}">
          <span>${post.title}</span>
          <small>${post.category}</small>
        </a>
      `
    )
    .join('');

  return `
    <article class="issue-card">
      <div class="issue-cover lazy-bg" data-bg="${cover}"></div>
      <div class="issue-body">
        <div class="issue-meta">
          <span class="pill">${issue.id}</span>
          <span class="issue-date">${issue.publishDate}</span>
        </div>
        <h2>${issue.title}</h2>
        <p>${issue.theme}</p>
        <div class="issue-count">${countText}</div>
        <details class="issue-expand"${detailsOpen}>
          <summary>${expandLabel}</summary>
          <div class="issue-note">${issue.editorNote || ''}</div>
          <div class="issue-posts">${postCards || `<div class="issue-post">${emptyText}</div>`}</div>
        </details>
      </div>
    </article>
  `;
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

const loadSite = async () => {
  try {
    const res = await fetch('/posts/site.json');
    if (!res.ok) return;
    state.site = await res.json();
    setText('#siteName', state.site.siteName);
    setText('#siteFooterText', state.site.footerText);
    setText('#issuesPageTitle', state.site.issuesPageTitle);

    const searchInput = qs('#searchInput');
    if (searchInput && state.site.searchPlaceholder) {
      searchInput.setAttribute('placeholder', state.site.searchPlaceholder);
    }

    const nav = qs('.nav');
    if (nav && Array.isArray(state.site.nav) && state.site.nav.length > 0) {
      const currentPath = window.location.pathname.replace(/\/index\.html$/, '/') || '/';
      const items = state.site.nav
        .filter((item) => item && item.label && item.href)
        .map((item) => {
          const href = item.href;
          const normalized = href.replace(/\/index\.html$/, '/') || '/';
          const isHome = normalized === '/';
          const isActive = isHome ? currentPath === '/' : currentPath.startsWith(normalized);
          return `<a href="${href}"${isActive ? ' class="active"' : ''}>${item.label}</a>`;
        });
      if (items.length > 0) nav.innerHTML = items.join('');
    }
  } catch {
    state.site = {};
  }
};

const init = async () => {
  const [issuesRes, postsRes] = await Promise.all([fetch('/posts/issues.json'), fetch('/posts/posts.json'), loadSite()]);
  const issuesData = await issuesRes.json();
  const postsData = await postsRes.json();
  const issues = issuesData.issues || [];
  const posts = postsData.items || postsData;

  const grid = qs('#issuesGrid');
  if (grid) {
    grid.innerHTML = issues.map((issue) => renderIssue(issue, posts)).join('');
    initLazyBackgrounds(grid);
  }

  setupSearch(posts);
  setupTheme();
  setupHeaderOffset();
  setupMobileSearch();
  setupMobileMenu();
};

init();
