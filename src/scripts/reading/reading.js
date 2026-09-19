// @ts-check
import { STORAGE_KEYS } from './types.js';
import { readStore, writeStore } from './storage.js';
import { getBook, saveBook } from './books.js';

/** @param {string} bookId */
export const getProgress = (bookId) => readStore(STORAGE_KEYS.progress, /** @type {import('./types.js').ReadingProgress[]} */ ([])).find((item) => item.bookId === bookId) || null;

/** @param {string} bookId @param {number} currentPage */
export const updateProgress = (bookId, currentPage) => {
  const book = getBook(bookId);
  if (!book) throw new Error('找不到這本書。');
  const now = new Date().toISOString();
  const progress = readStore(STORAGE_KEYS.progress, /** @type {import('./types.js').ReadingProgress[]} */ ([]));
  const current = progress.find((item) => item.bookId === bookId) || { bookId, currentPage:0, totalPages:book.totalPages, startedAt:null, finishedAt:null, lastReadAt:null };
  const page = Math.max(0, Math.min(Number(currentPage) || 0, book.totalPages || Number(currentPage) || 0));
  const finished = Boolean(book.totalPages && page >= book.totalPages);
  const next = { ...current, currentPage:page, totalPages:book.totalPages, startedAt:current.startedAt || now, finishedAt:finished ? (current.finishedAt || now) : null, lastReadAt:now };
  writeStore(STORAGE_KEYS.progress, [next, ...progress.filter((item) => item.bookId !== bookId)]);
  saveBook({ ...book, status:finished ? 'finished' : 'reading' });
  return next;
};

/** @param {string} bookId @param {number|null} rating */
export const setRating = (bookId, rating) => {
  const book = getBook(bookId);
  return book ? saveBook({ ...book, rating }) : null;
};
