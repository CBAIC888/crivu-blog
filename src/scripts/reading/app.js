// @ts-check
import { BOOK_STATUSES } from './types.js';
import { ensureSeedData } from './seed.js';
import { deleteBook, getBook, listBooks, saveBook, searchBooks } from './books.js';
import { getProgress, updateProgress } from './reading.js';

const root = document.querySelector('[data-reading-app]');
if (!root) throw new Error('Reading app root is missing.');

ensureSeedData();

const state = { view: 'shelf', query: '', status: 'all' };
const statusOptions = Object.entries(BOOK_STATUSES);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
const formatNumber = (value) => new Intl.NumberFormat('zh-Hant').format(value);
const coverTone = (id) => [...String(id)].reduce((total, character) => total + character.charCodeAt(0), 0) % 7;

const cover = (book, className = '') => `
  <span class="book-cover book-cover--${coverTone(book.id)} ${className}">
    <span class="book-cover__type"><small>${escapeHtml(book.author || '未署名')}</small><strong>${escapeHtml(book.title)}</strong></span>
    ${book.coverUrl ? `<img src="${escapeHtml(book.coverUrl)}" alt="${escapeHtml(book.title)}封面" loading="lazy" data-cover-image>` : ''}
  </span>`;

const progressFor = (book) => getProgress(book.id) || { currentPage:0, totalPages:book.totalPages };
const percentageFor = (book) => {
  const progress = progressFor(book);
  return book.totalPages ? Math.min(100, Math.round(progress.currentPage / book.totalPages * 100)) : 0;
};

const currentBook = (book) => {
  const progress = progressFor(book);
  const percent = percentageFor(book);
  return `<article class="current-book">
    <button class="current-book__cover" type="button" data-progress-book="${escapeHtml(book.id)}" aria-label="更新《${escapeHtml(book.title)}》閱讀進度">${cover(book)}</button>
    <div class="current-book__body">
      <button class="current-book__identity" type="button" data-edit-book="${escapeHtml(book.id)}">
        <strong class="current-book__title">${escapeHtml(book.title)}</strong>
        <span class="current-book__author">${escapeHtml(book.author || '未署名')}</span>
      </button>
      <div class="current-book__progress"><b>${percent}%</b><span>${formatNumber(progress.currentPage)}${book.totalPages ? ` / ${formatNumber(book.totalPages)}` : ''} 頁</span></div>
      <span class="reading-progress reading-progress--fine" aria-hidden="true"><i style="--progress:${percent}%"></i></span>
      <button class="reading-text-button current-book__update" type="button" data-progress-book="${escapeHtml(book.id)}">更新頁數</button>
    </div>
  </article>`;
};

const shelfBook = (book) => `<article class="library-book">
  <button type="button" data-edit-book="${escapeHtml(book.id)}" aria-label="編輯《${escapeHtml(book.title)}》">
    ${cover(book)}
    <strong>${escapeHtml(book.title)}</strong>
    <span>${escapeHtml(book.author || '未署名')}</span>
    <small>${escapeHtml(BOOK_STATUSES[book.status] || '想讀')}</small>
  </button>
</article>`;

const shelfView = () => {
  const books = listBooks();
  const current = books.filter((book) => book.status === 'reading');
  const results = searchBooks(state.query, state.status);
  return `<div data-view-panel="shelf">
    <section class="reading-section reading-section--first" aria-labelledby="current-reading-title">
      <div class="reading-section-head"><h2 id="current-reading-title">正在讀</h2><span>${current.length} 本</span></div>
      <div class="current-books">${current.map(currentBook).join('') || '<p class="reading-empty">目前沒有正在讀的書。</p>'}</div>
    </section>
    <section class="reading-section" aria-labelledby="library-title">
      <div class="reading-section-head"><h2 id="library-title">全部書籍</h2><span>${books.length} 本</span></div>
      <div class="library-tools">
        <label class="library-search"><span>搜尋書名、作者或 ISBN</span><input type="search" value="${escapeHtml(state.query)}" placeholder="搜尋書籍" data-library-search></label>
        <div class="library-filters" role="group" aria-label="篩選閱讀狀態">
          ${[['all','全部'], ...statusOptions].map(([value,label]) => `<button type="button" class="${state.status === value ? 'is-active' : ''}" data-status-filter="${value}" aria-pressed="${state.status === value}">${label}</button>`).join('')}
        </div>
      </div>
      <p class="library-count">顯示 ${results.length} 本</p>
      <div class="library-grid">${results.map(shelfBook).join('') || '<p class="reading-empty">沒有符合條件的書。</p>'}</div>
    </section>
  </div>`;
};

const yearlyStats = () => {
  const year = new Date().getFullYear();
  const months = Array.from({ length:12 }, () => 0);
  let pages = 0;
  let count = 0;
  listBooks().filter((book) => book.status === 'finished').forEach((book) => {
    const progress = getProgress(book.id);
    const date = new Date(progress?.finishedAt || book.updatedAt);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== year) return;
    count += 1;
    pages += progress?.totalPages || book.totalPages || 0;
    months[date.getMonth()] += 1;
  });
  return { year, count, pages, months };
};

const statsView = () => {
  const stats = yearlyStats();
  const max = Math.max(1, ...stats.months);
  return `<div data-view-panel="stats">
    <section class="reading-stats" aria-labelledby="year-stats-title">
      <div class="reading-section-head"><h2 id="year-stats-title">${stats.year} 閱讀統計</h2><span>截至今日</span></div>
      <dl class="reading-facts">
        <div><dt>讀完</dt><dd>${formatNumber(stats.count)} <span>本</span></dd></div>
        <div><dt>閱讀</dt><dd>${formatNumber(stats.pages)} <span>頁</span></dd></div>
      </dl>
      <div class="reading-chart" role="img" aria-label="${stats.year} 年每月讀完本數">
        ${stats.months.map((value,index) => `<div class="reading-chart__month"><div class="reading-chart__bar"><i style="--bar:${value ? Math.max(10, value / max * 100) : 2}%"></i></div><small>${index + 1}月</small>${value ? `<b>${value}</b>` : ''}</div>`).join('')}
      </div>
    </section>
  </div>`;
};

const bookDialog = () => `<dialog class="reading-dialog" data-book-dialog>
  <form method="dialog" data-book-form>
    <header><h2 data-book-dialog-title>加入書籍</h2><button type="button" data-close-dialog aria-label="關閉">×</button></header>
    <input type="hidden" name="id">
    <div class="book-form__grid">
      <label class="book-form__wide">書名<input name="title" required autocomplete="off"></label>
      <label>作者<input name="author" required autocomplete="off"></label>
      <label>閱讀狀態<select name="status">${statusOptions.map(([value,label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
      <label>總頁數<input name="totalPages" type="number" min="0" inputmode="numeric"></label>
      <label>評分<input name="rating" type="number" min="0" max="5" step="0.5" placeholder="0–5"></label>
      <label class="book-form__wide">封面圖片網址<input name="coverUrl" type="url" inputmode="url" placeholder="https://"></label>
    </div>
    <div class="book-form__actions"><button class="reading-button" type="submit">儲存</button><button class="reading-text-button reading-text-button--danger" type="button" data-delete-book hidden>刪除</button></div>
  </form>
</dialog>`;

const progressDialog = () => `<dialog class="reading-dialog reading-dialog--progress" data-progress-dialog>
  <form method="dialog" data-progress-form>
    <header><div><p>更新閱讀進度</p><h2 data-progress-title></h2></div><button type="button" data-close-dialog aria-label="關閉">×</button></header>
    <input type="hidden" name="bookId">
    <label>目前讀到<input name="currentPage" type="number" min="0" required inputmode="numeric"><span data-progress-limit></span></label>
    <button class="reading-button" type="submit">更新</button>
  </form>
</dialog>`;

const render = () => {
  root.innerHTML = `<main class="reading-main">
    <header class="reading-page-head">
      <div><h1>書房</h1><p>記錄看了什麼書，也看看一年讀了多少。</p></div>
      <div class="reading-page-actions">
        <nav class="reading-view-switch" aria-label="書房頁面">
          <button type="button" class="${state.view === 'shelf' ? 'is-active' : ''}" data-view="shelf" aria-pressed="${state.view === 'shelf'}">書架</button>
          <button type="button" class="${state.view === 'stats' ? 'is-active' : ''}" data-view="stats" aria-pressed="${state.view === 'stats'}">統計</button>
        </nav>
        <button class="reading-button" type="button" data-add-book>加入書籍</button>
      </div>
    </header>
    ${state.view === 'shelf' ? shelfView() : statsView()}
  </main>${bookDialog()}${progressDialog()}`;
  bindEvents();
};

const openBookDialog = (book = null) => {
  const dialog = /** @type {HTMLDialogElement} */ (document.querySelector('[data-book-dialog]'));
  const form = /** @type {HTMLFormElement} */ (dialog.querySelector('[data-book-form]'));
  form.reset();
  const field = (name) => /** @type {HTMLInputElement|HTMLSelectElement} */ (form.elements.namedItem(name));
  field('id').value = book?.id || '';
  field('title').value = book?.title || '';
  field('author').value = book?.author || '';
  field('status').value = book?.status && BOOK_STATUSES[book.status] ? book.status : 'want_to_read';
  field('totalPages').value = book?.totalPages ? String(book.totalPages) : '';
  field('rating').value = book?.rating != null ? String(book.rating) : '';
  field('coverUrl').value = book?.coverUrl || '';
  dialog.querySelector('[data-book-dialog-title]').textContent = book ? '編輯書籍' : '加入書籍';
  dialog.querySelector('[data-delete-book]').hidden = !book;
  dialog.showModal();
  requestAnimationFrame(() => field('title').focus());
};

const openProgressDialog = (book) => {
  const dialog = /** @type {HTMLDialogElement} */ (document.querySelector('[data-progress-dialog]'));
  const form = /** @type {HTMLFormElement} */ (dialog.querySelector('[data-progress-form]'));
  const progress = progressFor(book);
  /** @type {HTMLInputElement} */ (form.elements.namedItem('bookId')).value = book.id;
  const page = /** @type {HTMLInputElement} */ (form.elements.namedItem('currentPage'));
  page.value = String(progress.currentPage);
  page.max = book.totalPages ? String(book.totalPages) : '';
  dialog.querySelector('[data-progress-title]').textContent = book.title;
  dialog.querySelector('[data-progress-limit]').textContent = book.totalPages ? `共 ${formatNumber(book.totalPages)} 頁` : '尚未填寫總頁數';
  dialog.showModal();
  requestAnimationFrame(() => { page.focus(); page.select(); });
};

function bindEvents() {
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => { state.view = button.dataset.view; render(); }));
  document.querySelector('[data-add-book]')?.addEventListener('click', () => openBookDialog());
  document.querySelectorAll('[data-edit-book]').forEach((button) => button.addEventListener('click', () => { const book = getBook(button.dataset.editBook); if (book) openBookDialog(book); }));
  document.querySelectorAll('[data-progress-book]').forEach((button) => button.addEventListener('click', () => { const book = getBook(button.dataset.progressBook); if (book) openProgressDialog(book); }));
  document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog')?.close()));
  document.querySelectorAll('[data-cover-image]').forEach((image) => image.addEventListener('error', () => image.remove()));
  document.querySelector('[data-library-search]')?.addEventListener('input', (event) => { state.query = event.currentTarget.value; render(); document.querySelector('[data-library-search]')?.focus(); });
  document.querySelectorAll('[data-status-filter]').forEach((button) => button.addEventListener('click', () => { state.status = button.dataset.statusFilter; render(); }));

  document.querySelector('[data-book-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = /** @type {HTMLFormElement} */ (event.currentTarget);
    const data = new FormData(form);
    const rating = String(data.get('rating') || '').trim();
    saveBook({
      id:String(data.get('id') || '') || undefined,
      title:String(data.get('title') || ''), author:String(data.get('author') || ''),
      status:/** @type {import('./types.js').BookStatus} */ (String(data.get('status'))),
      totalPages:Number(data.get('totalPages')) || 0, rating:rating ? Number(rating) : null,
      coverUrl:String(data.get('coverUrl') || ''), coverSource:data.get('coverUrl') ? 'url' : 'placeholder',
    });
    form.closest('dialog')?.close();
    render();
  });
  document.querySelector('[data-delete-book]')?.addEventListener('click', (event) => {
    const form = /** @type {HTMLFormElement} */ (event.currentTarget.closest('form'));
    const id = /** @type {HTMLInputElement} */ (form.elements.namedItem('id')).value;
    const book = getBook(id);
    if (book && window.confirm(`確定刪除《${book.title}》？`)) { deleteBook(id); form.closest('dialog')?.close(); render(); }
  });
  document.querySelector('[data-progress-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = /** @type {HTMLFormElement} */ (event.currentTarget);
    updateProgress(/** @type {HTMLInputElement} */ (form.elements.namedItem('bookId')).value, Number(/** @type {HTMLInputElement} */ (form.elements.namedItem('currentPage')).value));
    form.closest('dialog')?.close();
    render();
  });
}

render();

const legacyPath = decodeURIComponent(window.location.pathname).match(/^\/books\/([^/]+)$/)?.[1];
if (legacyPath === 'new') openBookDialog();
else if (legacyPath) { const book = getBook(legacyPath); if (book) openBookDialog(book); }
