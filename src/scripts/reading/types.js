// @ts-check

/** @typedef {'want_to_read'|'reading'|'finished'} BookStatus */
/** @typedef {'url'|'open_library'|'placeholder'} CoverSource */

/**
 * @typedef {Object} Book
 * @property {string} id
 * @property {string} title
 * @property {string} author
 * @property {string} publisher
 * @property {string} publishedDate
 * @property {string} isbn10
 * @property {string} isbn13
 * @property {string} coverUrl
 * @property {CoverSource} coverSource
 * @property {string} googleBooksId
 * @property {string} openLibraryId
 * @property {number} totalPages
 * @property {BookStatus} status
 * @property {number|null} rating
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} ReadingProgress
 * @property {string} bookId
 * @property {number} currentPage
 * @property {number} totalPages
 * @property {string|null} startedAt
 * @property {string|null} finishedAt
 * @property {string|null} lastReadAt
 */

export const BOOK_STATUSES = /** @type {const} */ ({
  want_to_read: '想讀',
  reading: '正在讀',
  finished: '已讀',
});

export const STORAGE_KEYS = /** @type {const} */ ({
  books: 'crivu-reading-books-v1',
  progress: 'crivu-reading-progress-v1',
  seeded: 'crivu-reading-seeded-v1',
});

export const createId = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
