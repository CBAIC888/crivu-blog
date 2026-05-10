// 深淺主題切換：localStorage 記住使用者選擇；預設跟隨系統
// 使用前綴 crivu-theme，避免跟其他站/工具衝突
(() => {
  const KEY = 'crivu-theme';
  const root = document.documentElement;

  const systemPrefersDark = () =>
    !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const readStored = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  };

  const writeStored = (value) => {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* private mode or disabled — silently ignore */
    }
  };

  const resolve = () => {
    const stored = readStored();
    if (stored === 'light' || stored === 'dark') return stored;
    return systemPrefersDark() ? 'dark' : 'light';
  };

  const apply = (theme) => {
    root.setAttribute('data-theme', theme);
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      btn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
      btn.setAttribute(
        'aria-label',
        theme === 'dark' ? '切換到淺色模式' : '切換到深色模式'
      );
    });
  };

  // 立即套用，避免進站閃爍
  apply(resolve());

  const bind = () => {
    document.querySelectorAll('[data-theme-toggle]').forEach((btn) => {
      if (btn.dataset.themeBound) return;
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', () => {
        const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        writeStored(next);
        apply(next);
      });
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  // 若使用者沒手動選過，跟隨系統變化
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e) => {
      if (!readStored()) apply(e.matches ? 'dark' : 'light');
    };
    if (mq.addEventListener) mq.addEventListener('change', listener);
    else mq.addListener(listener);
  }
})();
