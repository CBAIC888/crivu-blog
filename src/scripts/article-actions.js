const button = document.querySelector('[data-article-like]');
const shareButton = document.querySelector('[data-article-share]');

const celebrate = () => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  canvas.className = 'article-confetti';
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  context.scale(window.devicePixelRatio, window.devicePixelRatio);
  document.body.append(canvas);

  const colors = ['#e23d4f', '#175fd0', '#f5b82e', '#45a36b', '#9a5bd4', '#f0783c'];
  const pieces = Array.from({ length: 110 }, (_, index) => ({
    x: Math.random() * window.innerWidth,
    y: -20 - Math.random() * window.innerHeight * .45,
    width: 5 + Math.random() * 7,
    height: 7 + Math.random() * 10,
    color: colors[index % colors.length],
    speed: 2.5 + Math.random() * 4.5,
    drift: -1.6 + Math.random() * 3.2,
    spin: Math.random() * Math.PI,
    spinSpeed: -.15 + Math.random() * .3,
  }));
  const started = performance.now();

  const frame = (now) => {
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    pieces.forEach((piece) => {
      piece.y += piece.speed;
      piece.x += piece.drift;
      piece.spin += piece.spinSpeed;
      context.save();
      context.translate(piece.x, piece.y);
      context.rotate(piece.spin);
      context.fillStyle = piece.color;
      context.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
      context.restore();
    });
    if (now - started < 2600 && pieces.some((piece) => piece.y < window.innerHeight + 24)) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
};

if (button) {
  const slug = button.dataset.articleSlug || window.location.pathname;
  const count = button.querySelector('[data-like-count]');
  const likedKey = `crivu:article-liked:${slug}`;
  const countKey = `crivu:article-like-count:${slug}`;
  let liked = window.localStorage.getItem(likedKey) === '1';
  let total = Math.max(0, Number.parseInt(window.localStorage.getItem(countKey) || '0', 10) || 0);

  const render = () => {
    button.setAttribute('aria-pressed', String(liked));
    if (count) count.textContent = String(total);
  };

  fetch(`/api/v1/articles/${encodeURIComponent(slug)}/like`)
    .then((response) => response.ok ? response.json() : Promise.reject())
    .then((data) => { total = Math.max(0, Number(data.count) || 0); window.localStorage.setItem(countKey, String(total)); render(); })
    .catch(() => {});

  button.addEventListener('click', async () => {
    button.disabled = true;
    liked = !liked;
    const delta = liked ? 1 : -1;
    total = Math.max(0, total + delta);
    window.localStorage.setItem(likedKey, liked ? '1' : '0');
    window.localStorage.setItem(countKey, String(total));
    render();
    if (liked) celebrate();
    try {
      const response = await fetch(`/api/v1/articles/${encodeURIComponent(slug)}/like`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ delta }) });
      if (!response.ok) throw new Error('Like request failed');
      const data = await response.json();
      total = Math.max(0, Number(data.count) || 0);
      window.localStorage.setItem(countKey, String(total));
      render();
    } catch {
      liked = !liked;
      total = Math.max(0, total - delta);
      window.localStorage.setItem(likedKey, liked ? '1' : '0');
      window.localStorage.setItem(countKey, String(total));
      render();
    } finally {
      button.disabled = false;
    }
  });

  render();
}

if (shareButton) {
  const status = document.querySelector('[data-share-status]');
  let statusTimer;
  const showStatus = (message) => {
    if (!status) return;
    status.textContent = message;
    window.clearTimeout(statusTimer);
    statusTimer = window.setTimeout(() => { status.textContent = ''; }, 1800);
  };

  shareButton.addEventListener('click', async () => {
    const shareData = { title: shareButton.dataset.articleTitle || document.title, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(shareData.url);
        showStatus('連結已複製');
      }
    } catch (error) {
      if (error?.name !== 'AbortError') showStatus('暫時無法分享');
    }
  });
}
