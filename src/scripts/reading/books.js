// @ts-check
import { STORAGE_KEYS, createId } from './types.js';
import { readStore, writeStore } from './storage.js';

const visibleStatuses = new Set(['want_to_read', 'reading', 'finished']);

/** @returns {import('./types.js').Book[]} */
export const listBooks = () => readStore(STORAGE_KEYS.books, []).map((book) => ({ ...book, status:visibleStatuses.has(book.status) ? book.status : 'want_to_read' })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

/** @param {string} id */
export const getBook = (id) => listBooks().find((book) => book.id === id) || null;

/** @param {string} query @param {import('./types.js').BookStatus|'all'} status */
export const searchBooks = (query, status = 'all') => {
  const needle = query.trim().normalize('NFKC').toLocaleLowerCase('zh-Hant');
  return listBooks().filter((book) => (status === 'all' || book.status === status) && (!needle || `${book.title} ${book.author} ${book.isbn10} ${book.isbn13}`.normalize('NFKC').toLocaleLowerCase('zh-Hant').includes(needle)));
};

/** @param {Partial<import('./types.js').Book> & Pick<import('./types.js').Book,'title'|'author'|'status'|'totalPages'>} input */
export const saveBook = (input) => {
  const books = listBooks();
  const existing = input.id ? books.find((book) => book.id === input.id) : null;
  const now = new Date().toISOString();
  /** @type {import('./types.js').Book} */
  const book = {
    id: existing?.id || createId('book'), title: input.title.trim(), author: input.author.trim(), publisher: input.publisher?.trim() ?? existing?.publisher ?? '',
    publishedDate: input.publishedDate ?? existing?.publishedDate ?? '', isbn10:input.isbn10 === undefined ? (existing?.isbn10 || '') : input.isbn10.replace(/[^0-9X]/gi, ''), isbn13:input.isbn13 === undefined ? (existing?.isbn13 || '') : input.isbn13.replace(/\D/g, ''),
    coverUrl: input.coverUrl?.trim() || '', coverSource: input.coverSource || (input.coverUrl ? 'url' : 'placeholder'), googleBooksId:input.googleBooksId ?? existing?.googleBooksId ?? '',
    openLibraryId:input.openLibraryId ?? existing?.openLibraryId ?? '', totalPages: Math.max(0, Number(input.totalPages) || 0), status: input.status,
    rating: input.rating ?? null, createdAt: existing?.createdAt || now, updatedAt: now,
  };
  writeStore(STORAGE_KEYS.books, [book, ...books.filter((item) => item.id !== book.id)]);
  const progress = readStore(STORAGE_KEYS.progress, /** @type {import('./types.js').ReadingProgress[]} */ ([]));
  const current = progress.find((item) => item.bookId === book.id);
  if (!current) {
    const hasStarted = ['reading','finished'].includes(book.status);
    writeStore(STORAGE_KEYS.progress, [{ bookId:book.id, currentPage:book.status === 'finished' ? book.totalPages : 0, totalPages:book.totalPages, startedAt:hasStarted ? now : null, finishedAt:book.status === 'finished' ? now : null, lastReadAt:book.status === 'finished' ? now : null }, ...progress]);
  } else {
    const hasStarted = ['reading','finished'].includes(book.status);
    const next = {
      ...current,
      totalPages:book.totalPages,
      currentPage:book.status === 'finished' ? book.totalPages : Math.min(current.currentPage, book.totalPages || current.currentPage),
      startedAt:hasStarted ? (current.startedAt || now) : current.startedAt,
      finishedAt:book.status === 'finished' ? (current.finishedAt || now) : (existing?.status === 'finished' ? null : current.finishedAt),
      lastReadAt:book.status === 'finished' ? now : current.lastReadAt,
    };
    writeStore(STORAGE_KEYS.progress, [next, ...progress.filter((item) => item.bookId !== book.id)]);
  }
  return book;
};

/** @param {string} id */
export const deleteBook = (id) => {
  writeStore(STORAGE_KEYS.books, listBooks().filter((book) => book.id !== id));
  writeStore(STORAGE_KEYS.progress, readStore(STORAGE_KEYS.progress, /** @type {import('./types.js').ReadingProgress[]} */ ([])).filter((item) => item.bookId !== id));
};

/** @param {string} id @param {import('./types.js').BookStatus} status */
export const setBookStatus = (id, status) => {
  const books = listBooks();
  const book = books.find((item) => item.id === id);
  if (!book) return null;
  const now = new Date().toISOString();
  const saved = saveBook({ ...book, status });
  const progress = readStore(STORAGE_KEYS.progress, /** @type {import('./types.js').ReadingProgress[]} */ ([]));
  const current = progress.find((item) => item.bookId === id) || { bookId:id, currentPage:0, totalPages:book.totalPages, startedAt:null, finishedAt:null, lastReadAt:null };
  const next = {
    ...current,
    currentPage: status === 'finished' && book.totalPages ? book.totalPages : current.currentPage,
    startedAt: ['reading','finished'].includes(status) ? (current.startedAt || now) : current.startedAt,
    finishedAt: status === 'finished' ? (current.finishedAt || now) : null,
    lastReadAt: status === 'finished' ? now : current.lastReadAt,
  };
  writeStore(STORAGE_KEYS.progress, [next, ...progress.filter((item) => item.bookId !== id)]);
  return saved;
};
