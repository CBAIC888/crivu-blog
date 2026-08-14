let pages = [];
fetch('/preview/search-index.json')
  .then((response) => response.ok ? response.json() : [])
  .then((items) => { if (Array.isArray(items)) pages = items; })
  .catch(() => {});

const current = document.body.dataset.current || '';
const pageLanguage = document.body.dataset.language || 'zh';
const nav = [
  ['articles', pageLanguage === 'en' ? 'Articles' : '文章', '/preview/articles.html'],
  ['issues', pageLanguage === 'en' ? 'Journals' : '期刊', '/preview/issues.html'],
  ['records', pageLanguage === 'en' ? 'Records' : '紀錄', '/preview/records.html'],
  ['about', pageLanguage === 'en' ? 'About' : '關於', '/preview/about.html'],
  ['rss', 'RSS', '/rss.xml'],
];

const icon = (name) => name === 'search'
  ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>'
  : name === 'theme'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20 15.2A8.2 8.2 0 1 1 8.8 4a7 7 0 0 0 11.2 11.2Z"/></svg>'
    : '';

document.body.insertAdjacentHTML('afterbegin', `
  <header class="site-header">
    <div class="site-header__inner">
      <nav class="site-nav" id="siteNav">${nav.map(([id, label, href]) => `<a class="${current === id ? 'active' : ''} ${id === 'rss' ? 'nav-rss' : ''}" href="${href}">${label}</a>`).join('')}</nav>
      <div class="header-tools">
        <button class="icon-button" data-search-open aria-label="${pageLanguage === 'en' ? 'Search' : '搜尋'}">${icon('search')}</button>
        <button class="icon-button" data-theme-toggle aria-label="${pageLanguage === 'en' ? 'Change background' : '切換背景'}">${icon('theme')}</button>
      </div>
    </div>
  </header>`);

document.body.insertAdjacentHTML('beforeend', `
  <footer class="site-footer">© 2026 CRIVU</footer>
  <div class="search-layer" id="searchLayer" aria-hidden="true">
    <div class="search-panel">
      <div class="search-top">
        <input id="siteSearch" type="search" placeholder="${pageLanguage === 'en' ? 'Search' : '搜尋'}" autocomplete="off" aria-label="${pageLanguage === 'en' ? 'Search articles' : '搜尋文章'}" />
        <button class="icon-button" data-search-close aria-label="${pageLanguage === 'en' ? 'Close' : '關閉'}">×</button>
      </div>
      <div class="search-results" id="searchResults"></div>
    </div>
  </div>`);

const root = document.documentElement;
const themes = ['paper', 'white', 'dark'];
document.querySelector('[data-theme-toggle]').addEventListener('click', () => {
  const currentTheme = themes.includes(root.dataset.theme) ? root.dataset.theme : 'paper';
  const next = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
  root.dataset.theme = next;
  localStorage.setItem('crivu-preview-theme', next);
});
const storedTheme = localStorage.getItem('crivu-preview-theme');
root.dataset.theme = themes.includes(storedTheme) ? storedTheme : 'paper';

const layer = document.getElementById('searchLayer');
const searchInput = document.getElementById('siteSearch');
const results = document.getElementById('searchResults');
const closeSearch = () => {
  layer.classList.remove('is-open');
  layer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('is-locked');
};
document.querySelector('[data-search-open]').addEventListener('click', () => {
  layer.classList.add('is-open');
  layer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('is-locked');
  requestAnimationFrame(() => searchInput.focus());
});
document.querySelector('[data-search-close]').addEventListener('click', closeSearch);
layer.addEventListener('click', (event) => { if (event.target === layer) closeSearch(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeSearch(); });
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase();
  const matches = query ? pages.filter((page) => `${page.kind}${page.title}${page.excerpt}${page.searchText || ''}`.toLowerCase().includes(query)).slice(0, 12) : [];
  results.innerHTML = matches.map((page) => `<a class="search-result" href="${page.href}"><small>${page.kind} · ${page.date}</small><br>${page.title}</a>`).join('') || (query ? `<p class="muted">${pageLanguage === 'en' ? 'No matching results.' : '沒有找到相符內容。'}</p>` : '');
});

document.querySelectorAll('[data-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-filter]').forEach((item) => item.classList.toggle('is-active', item === button));
    const value = button.dataset.filter;
    document.querySelectorAll('[data-kind]').forEach((entry) => { entry.hidden = value !== '全部' && entry.dataset.kind !== value; });
    document.querySelectorAll('.year-group').forEach((group) => {
      group.hidden = !Array.from(group.querySelectorAll('[data-kind]')).some((entry) => !entry.hidden);
    });
  });
});

const researchContent = document.querySelector('[data-research-content]');
if (researchContent) {
  const researchSource = researchContent.dataset.researchContentSrc || '/preview/research-content.html';
  fetch(researchSource)
    .then((response) => {
      if (!response.ok) throw new Error('Research article unavailable');
      return response.text();
    })
    .then((html) => {
      researchContent.innerHTML = researchSource.endsWith('.md') ? renderResearchMarkdown(html) : html;
      enhanceResearchArticle(researchContent);
    })
    .catch(() => { researchContent.innerHTML = '<p class="muted">文章暫時無法載入。</p>'; });
}

function renderResearchMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const sections = [];
  let section = { id: 'article-intro', index: '00', title: '', blocks: [] };
  let documentTitleSkipped = false;
  let paragraph = [];
  let quote = [];
  const flushParagraph = () => {
    if (!paragraph.length) return;
    section.blocks.push(`<p>${inlineResearchMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };
  const flushQuote = () => {
    if (!quote.length) return;
    section.blocks.push(`<blockquote><p>${inlineResearchMarkdown(quote.join(' '))}</p></blockquote>`);
    quote = [];
  };
  const flushSection = () => {
    flushParagraph();
    flushQuote();
    if (section.title || section.blocks.length) sections.push(section);
  };

  lines.forEach((line) => {
    if (!sections.length && !section.title && !section.blocks.length && !paragraph.length && /^An Exploration of /.test(line.trim())) {
      documentTitleSkipped = true;
      return;
    }
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    if (heading) {
      const title = heading[1].trim();
      if (/^An Exploration of /.test(title)) { documentTitleSkipped = true; return; }
      flushSection();
      if (/^References and Notes$/i.test(title)) {
        section = { id: 'article-notes', index: 'Notes', title: 'References and Notes', blocks: [] };
      } else if (/^Introduction$/i.test(title)) {
        section = { id: 'article-intro', index: '00', title: 'Introduction', blocks: [] };
      } else {
        const roman = title.match(/^([IVX]+)\.\s*(.*)$/);
        const number = roman ? romanToNumber(roman[1]) : sections.length;
        section = { id: `article-${String(number).padStart(2, '0')}`, index: String(number).padStart(2, '0'), title: roman ? `${roman[1]}. ${roman[2]}` : title, blocks: [] };
      }
      return;
    }
    if (documentTitleSkipped && !section.title && !section.blocks.length && line.trim() === '') return;
    if (/^---\s*$/.test(line)) { flushParagraph(); flushQuote(); return; }
    if (/^>\s?/.test(line)) { flushParagraph(); quote.push(line.replace(/^>\s?/, '')); return; }
    if (quote.length && line.trim()) { quote.push(line.trim()); return; }
    if (!line.trim()) { flushParagraph(); flushQuote(); return; }
    const note = line.match(/^\[(\d+)\]\s+(.+)$/);
    if (section.id === 'article-notes' && note) {
      flushParagraph();
      section.blocks.push(`<p class="note" id="note-${note[1]}"><a class="note-number" href="#note-ref-${note[1]}">[${note[1]}]</a>${inlineResearchMarkdown(note[2])}</p>`);
      return;
    }
    paragraph.push(line.trim());
  });
  flushSection();
  return `<article class="article">${sections.map((item) => `<section class="article-section${item.id === 'article-notes' ? ' article-notes' : ''}" id="${item.id}"><p class="section-index">${item.index}</p><h2>${inlineResearchMarkdown(item.title)}</h2>${item.blocks.join('')}</section>`).join('')}</article>`;
}

function inlineResearchMarkdown(value) {
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/_([^_]+)_/g, '<i>$1</i>')
    .replace(/\[(\d+)\](?:–\[(\d+)\])?/g, (_, start, end) => {
      const first = `<a class="note-ref" href="#note-${start}" aria-label="Read note ${start}">[${start}]</a>`;
      return end ? `${first}–<a class="note-ref" href="#note-${end}" aria-label="Read note ${end}">[${end}]</a>` : first;
    });
}

function romanToNumber(roman) {
  const values = { I: 1, V: 5, X: 10 };
  return [...roman].reduce((sum, char, index, all) => sum + (values[char] < (values[all[index + 1]] || 0) ? -values[char] : values[char]), 0);
}

function enhanceResearchArticle(container) {
  const noteSection = container.querySelector('#article-notes');
  if (noteSection) noteSection.hidden = true;

  const noteOccurrences = new Map();
  const references = [...container.querySelectorAll('.note-ref')];
  const referenceIds = new Set(references.map((reference) => reference.getAttribute('href')?.slice(1)).filter(Boolean));
  references.forEach((reference) => {
    const target = container.querySelector(reference.getAttribute('href'));
    if (!target) return;
    const occurrence = (noteOccurrences.get(target.id) || 0) + 1;
    noteOccurrences.set(target.id, occurrence);
    const occurrenceSuffix = occurrence === 1 ? '' : `-${occurrence}`;
    const note = document.createElement('span');
    note.className = 'marginnote';
    note.id = `${target.id}-margin${occurrenceSuffix}`;
    note.innerHTML = target.innerHTML;
    note.querySelector('.note-number')?.remove();
    reference.id = `note-ref-${target.id.replace('note-', '')}${occurrenceSuffix}`;
    const noteBody = document.createElement('span');
    noteBody.className = 'marginnote-body';
    while (note.firstChild) noteBody.appendChild(note.firstChild);
    note.appendChild(noteBody);
    note.insertAdjacentHTML('afterbegin', `<a class="marginnote-mark" href="#${reference.id}" aria-label="${pageLanguage === 'en' ? 'Return to text' : '返回正文'}">${reference.textContent.trim()}</a>`);
    reference.insertAdjacentElement('afterend', note);
    reference.setAttribute('role', 'button');
    reference.setAttribute('aria-controls', note.id);
    reference.setAttribute('aria-expanded', 'false');
    let isPinned = false;
    const setPairActive = (active) => {
      const highlighted = active || isPinned;
      reference.classList.toggle('is-highlighted', highlighted);
      note.classList.toggle('is-highlighted', highlighted);
    };
    reference.addEventListener('mouseenter', () => setPairActive(true));
    reference.addEventListener('mouseleave', () => setPairActive(false));
    reference.addEventListener('focus', () => setPairActive(true));
    reference.addEventListener('blur', () => setPairActive(false));
    note.addEventListener('mouseenter', () => setPairActive(true));
    note.addEventListener('mouseleave', () => setPairActive(false));
    note.addEventListener('focusin', () => setPairActive(true));
    note.addEventListener('focusout', () => setPairActive(false));
    reference.addEventListener('click', (event) => {
      event.preventDefault();
      if (window.matchMedia('(max-width: 760px)').matches) {
        note.classList.toggle('is-expanded');
        reference.setAttribute('aria-expanded', String(note.classList.contains('is-expanded')));
      }
      isPinned = !isPinned;
      setPairActive(false);
      note.scrollIntoView({ block: 'center', behavior: 'smooth' });
      history.replaceState(null, '', `#${note.id}`);
    });
    note.querySelector('.marginnote-mark')?.addEventListener('click', (event) => {
      event.preventDefault();
      isPinned = !isPinned;
      setPairActive(false);
      reference.scrollIntoView({ block: 'center', behavior: 'smooth' });
      reference.focus({ preventScroll: true });
      history.replaceState(null, '', `#${reference.id}`);
    });
  });
  container.querySelectorAll('#article-notes .note').forEach((note) => {
    if (!referenceIds.has(note.id)) {
      note.hidden = false;
      container.querySelector('#article-notes').hidden = false;
    }
  });

  container.querySelectorAll('.research-figure').forEach((figure) => figure.remove());
  /* Research articles remain text-first. The image archive lives on its own dark gallery page. */
}

const researchActionStatus = document.querySelector('[data-research-action-status]');
document.querySelector('[data-research-comments]')?.addEventListener('click', () => {
  document.querySelector('#researchComments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
document.querySelector('[data-research-share]')?.addEventListener('click', async () => {
  const shareData = {
    title: pageLanguage === 'en' ? 'An Exploration of Shijie 世界 (“World”)' : '對『世界』的探索',
    text: pageLanguage === 'en'
      ? 'Tracing the formation and transformation of the Chinese word shijie through early texts and Buddhist translation.'
      : '從先秦兩漢的舊字與東漢譯經出發，追索「世界」一詞的形成與變化。',
    url: 'https://cbc688.com/records/world-word-history/',
  };
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(shareData.url);
      if (researchActionStatus) researchActionStatus.textContent = pageLanguage === 'en' ? 'Link copied' : '連結已複製';
    }
  } catch (error) {
    if (error?.name !== 'AbortError' && researchActionStatus) researchActionStatus.textContent = pageLanguage === 'en' ? 'Unable to share' : '暫時無法分享';
  }
});

const previewCommentForm = document.querySelector('[data-preview-comment-form]');
if (previewCommentForm) {
  previewCommentForm.addEventListener('submit', (event) => {
    event.preventDefault();
    previewCommentForm.reset();
    const status = document.querySelector('[data-preview-comment-status]');
    if (status) status.textContent = '本地預覽已保留評論介面，正式環境接入後送出。';
  });
}
