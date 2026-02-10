const qs = (sel) => document.querySelector(sel);
const FALLBACK_COVER = '/assets/img/cover-01.svg';

const getSlug = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('slug');
};

const formatDate = (iso) => {
  const [y, m, d] = iso.split('-');
  return `${y}/${m}/${d}`;
};

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

const inlineMarkdown = (text) => {
  const escaped = escapeHtml(text);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
      const safeHref = sanitizeUrl(href);
      return `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer nofollow">${label}</a>`;
    });
};

const simpleMarkdown = (raw) => {
  const src = String(raw || '').replace(/\r\n/g, '\n');
  const lines = src.split('\n');
  const out = [];
  let inList = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!inList) return;
    out.push('</ul>');
    inList = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      closeList();
      continue;
    }

    if (/^###\s+/.test(trimmed)) {
      flushParagraph();
      closeList();
      out.push(`<h3>${inlineMarkdown(trimmed.replace(/^###\s+/, ''))}</h3>`);
      continue;
    }
    if (/^##\s+/.test(trimmed)) {
      flushParagraph();
      closeList();
      out.push(`<h2>${inlineMarkdown(trimmed.replace(/^##\s+/, ''))}</h2>`);
      continue;
    }
    if (/^#\s+/.test(trimmed)) {
      flushParagraph();
      closeList();
      out.push(`<h1>${inlineMarkdown(trimmed.replace(/^#\s+/, ''))}</h1>`);
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMarkdown(trimmed.replace(/^([-*]|\d+\.)\s+/, ''))}</li>`);
      continue;
    }

    closeList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  closeList();
  return out.join('\n');
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

const setText = (sel, value) => {
  const el = qs(sel);
  if (el && value) el.textContent = value;
};

const toInt = (value, fallback, min, max) => {
  const num = Number.parseInt(value, 10);
  if (Number.isNaN(num)) return fallback;
  return Math.max(min, Math.min(max, num));
};

const applyTheme = (theme) => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  document.querySelectorAll('.theme-icon').forEach((icon) => {
    icon.textContent = theme === 'dark' ? '☾' : '☀';
  });
};

const renderMoreItem = (post) => {
  const cover = safeCoverUrl(post.cover);
  const issue = post.issue ? `<span class="issue-pill">${escapeHtml(post.issue)}</span>` : '';
  const date = post.date ? `<small>${escapeHtml(post.date)}</small>` : '';
  const safeLink = postUrl(post.slug);
  return `
    <a class="more-item" href="${escapeHtml(safeLink)}">
      <div class="more-thumb lazy-bg" data-bg="${escapeHtml(cover)}"></div>
      <div class="more-info">
        <span class="pill">${escapeHtml(post.category)}</span>${issue}${date}
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.excerpt)}</p>
      </div>
    </a>
  `;
};

const setupSearch = (posts) => {
  const input = qs('#searchInput');
  const results = qs('#searchResults');
  if (!input || !results) return;

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
          <a class="search-item" href="${escapeHtml(postUrl(p.slug))}">
            ${escapeHtml(p.title)}
            <small>${escapeHtml(p.category)} · ${escapeHtml((Array.isArray(p.tags) ? p.tags : []).join(' / '))}</small>
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
      } else {
        const q = encodeURIComponent(input.value.trim());
        window.location.href = q ? `/?q=${q}` : '/';
      }
    }
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.remove('active');
    }
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

const applySite = async () => {
  try {
    const res = await fetch('/posts/site.json');
    if (!res.ok) return {};
    const site = await res.json();
    setText('#siteName', site.siteName);
    setText('#siteFooterText', site.footerText);
    setText('#moreTitle', site.moreReadingTitle);

    const searchInput = qs('#searchInput');
    if (searchInput && site.searchPlaceholder) {
      searchInput.setAttribute('placeholder', site.searchPlaceholder);
    }

    const nav = qs('.nav');
    if (nav && Array.isArray(site.nav) && site.nav.length > 0) {
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
    }
    return site;
  } catch {
    // keep fallback text
    return {};
  }
};

const init = async () => {
  const slug = getSlug();
  const res = await fetch('/posts/posts.json');
  const data = await res.json();
  const posts = data.items || data;
  const post = posts.find((p) => p.slug === slug) || posts[0];
  if (!post) return;

  qs('#postTitle').textContent = post.title;
  qs('#postDate').textContent = formatDate(post.date);
  qs('#postCategory').textContent = post.category;

  const issue = qs('#postIssue');
  if (issue) {
    issue.textContent = post.issue || '';
    issue.style.display = post.issue ? 'inline-block' : 'none';
  }

  qs('#postExcerpt').textContent = post.excerpt;

  const tags = qs('#postTags');
  const tagList = Array.isArray(post.tags) ? post.tags : [];
  tags.innerHTML = tagList.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');

  const cover = qs('#postCover');
  cover.style.backgroundImage = `url('${safeCoverUrl(post.cover)}')`;

  qs('#postBody').innerHTML = simpleMarkdown(post.body || '');

  const site = await applySite();
  const moreLimit = toInt(site.moreReadingLimit, 4, 1, 12);
  const more = posts.filter((p) => p.slug !== post.slug).slice(0, moreLimit);
  const moreList = qs('#moreList');
  if (moreList) {
    moreList.innerHTML = more.map(renderMoreItem).join('');
    initLazyBackgrounds(moreList);
  }

  setupSearch(posts);
  setupTheme();
  setupHeaderOffset();
  setupMobileSearch();
  setupMobileMenu();
  applyProgress();
};

init();
