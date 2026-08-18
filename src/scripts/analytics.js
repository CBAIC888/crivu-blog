(() => {
  const endpoint = 'https://cbc688.goatcounter.com/count';
  const params = new URLSearchParams();

  params.set('p', window.location.pathname || '/');
  params.set('t', document.title || '');
  params.set('r', document.referrer || '');
  params.set('s', [
    window.screen?.width || 0,
    window.screen?.height || 0,
    window.devicePixelRatio || 1,
  ].join(','));

  const query = window.location.search.replace(/^\?/, '');
  if (query) params.set('q', query);
  params.set('rnd', String(Date.now()));

  const image = new Image(1, 1);
  image.decoding = 'async';
  image.referrerPolicy = 'strict-origin-when-cross-origin';
  image.src = `${endpoint}?${params.toString()}`;
})();
