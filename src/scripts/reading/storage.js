// @ts-check

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {T}
 */
export const readStore = (key, fallback) => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? /** @type {T} */ (JSON.parse(raw)) : fallback;
  } catch {
    return fallback;
  }
};

/**
 * @template T
 * @param {string} key
 * @param {T} value
 */
export const writeStore = (key, value) => window.localStorage.setItem(key, JSON.stringify(value));

/** @param {string} key */
export const removeStore = (key) => window.localStorage.removeItem(key);
