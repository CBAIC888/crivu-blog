const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const rgbToCss = (rgb, alpha = 1) => {
  const [r, g, b] = rgb.map((value) => Math.round(clamp(value, 0, 255)));
  return alpha >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const mix = (a, b, amount) => a.map((value, index) => value + (b[index] - value) * amount);

const luminance = ([r, g, b]) => {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const rgbToHsl = ([r, g, b]) => {
  const nr = r / 255;
  const ng = g / 255;
  const nb = b / 255;
  const max = Math.max(nr, ng, nb);
  const min = Math.min(nr, ng, nb);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const diff = max - min;
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);

    switch (max) {
      case nr:
        h = (ng - nb) / diff + (ng < nb ? 6 : 0);
        break;
      case ng:
        h = (nb - nr) / diff + 2;
        break;
      default:
        h = (nr - ng) / diff + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s * 100, l * 100];
};

const hslToRgb = (h, s, l) => {
  const hue = ((h % 360) + 360) % 360 / 360;
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;

  if (sat === 0) {
    const gray = light * 255;
    return [gray, gray, gray];
  }

  const hueToRgb = (p, q, t) => {
    let next = t;
    if (next < 0) next += 1;
    if (next > 1) next -= 1;
    if (next < 1 / 6) return p + (q - p) * 6 * next;
    if (next < 1 / 2) return q;
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
    return p;
  };

  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;

  return [
    hueToRgb(p, q, hue + 1 / 3) * 255,
    hueToRgb(p, q, hue) * 255,
    hueToRgb(p, q, hue - 1 / 3) * 255,
  ];
};

const loadImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });

const sampleImage = async (url) => {
  const image = await loadImage(url);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context unavailable');

  const width = 56;
  const height = Math.max(56, Math.round((image.naturalHeight / image.naturalWidth) * width));
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);

  const { data } = ctx.getImageData(0, 0, width, height);
  let count = 0;
  let total = [0, 0, 0];
  let accent = [96, 128, 164];
  let accentScore = -1;
  let dark = [32, 45, 58];
  let darkScore = -1;

  for (let i = 0; i < data.length; i += 16) {
    const alpha = data[i + 3];
    if (alpha < 180) continue;

    const rgb = [data[i], data[i + 1], data[i + 2]];
    total = total.map((value, index) => value + rgb[index]);
    count += 1;

    const [h, s, l] = rgbToHsl(rgb);
    const satScore = s * 1.2 + clamp(60 - Math.abs(l - 52), 0, 60);
    if (l > 14 && l < 82 && satScore > accentScore) {
      accent = hslToRgb(h, clamp(Math.max(s, 28), 18, 52), clamp(l, 34, 58));
      accentScore = satScore;
    }

    const shadowScore = clamp(100 - l, 0, 100) + s * 0.25;
    if (l < 42 && shadowScore > darkScore) {
      dark = hslToRgb(h, clamp(s * 0.55 + 8, 10, 30), clamp(l * 0.42, 14, 24));
      darkScore = shadowScore;
    }
  }

  const average = count > 0 ? total.map((value) => value / count) : [196, 210, 226];
  return { average, accent, dark };
};

const buildPalette = ({ average, accent, dark }) => {
  const [h, s, l] = rgbToHsl(average);
  const baseHue = h;
  const toneHue = baseHue + 10;

  const bg = hslToRgb(baseHue, clamp(s * 0.28 + 8, 8, 22), 93);
  const surface = mix(bg, [255, 255, 255], 0.55);
  const surfaceStrong = mix(bg, [255, 255, 255], 0.76);
  const mutedSurface = hslToRgb(baseHue, clamp(s * 0.46 + 8, 10, 32), clamp(l + 2, 54, 74));

  const ink = hslToRgb(toneHue, clamp(s * 0.46 + 12, 18, 32), 14);
  const muted = hslToRgb(toneHue, clamp(s * 0.26 + 10, 12, 22), 37);
  const accent2 = hslToRgb(baseHue + 22, clamp(s * 0.62 + 12, 18, 44), clamp(l * 0.58, 34, 48));

  const heroIsLight = luminance(average) > 0.48;
  const heroInk = heroIsLight ? mix(ink, dark, 0.18) : [244, 247, 251];
  const heroMuted = heroIsLight ? mix(muted, dark, 0.12) : [234, 240, 247];
  const heroBorder = heroIsLight ? rgbToCss(ink, 0.22) : 'rgba(255, 255, 255, 0.36)';
  const heroControlBg = heroIsLight ? 'rgba(248, 251, 255, 0.72)' : 'rgba(255, 255, 255, 0.18)';
  const heroHeaderBg = heroIsLight ? 'rgba(236, 243, 249, 0.72)' : 'rgba(23, 29, 38, 0.38)';
  const heroOverlayLeft = heroIsLight ? 'rgba(230, 238, 246, 0.76)' : 'rgba(24, 31, 41, 0.68)';
  const heroOverlayMid = heroIsLight ? 'rgba(230, 238, 246, 0.18)' : 'rgba(24, 31, 41, 0.24)';
  const heroOverlayRight = heroIsLight ? 'rgba(125, 145, 168, 0.3)' : 'rgba(24, 31, 41, 0.58)';

  return {
    bg: rgbToCss(bg),
    surface: rgbToCss(surface, 0.78),
    surfaceStrong: rgbToCss(surfaceStrong, 0.92),
    surfaceMuted: rgbToCss(mutedSurface, 0.1),
    ink: rgbToCss(ink),
    muted: rgbToCss(muted),
    accent: rgbToCss(accent),
    accent2: rgbToCss(accent2),
    line: rgbToCss(ink, 0.14),
    lineStrong: rgbToCss(ink, 0.24),
    shadow: `0 24px 60px ${rgbToCss(dark, 0.12)}`,
    pageGlow1: rgbToCss(mix(average, [255, 255, 255], 0.18), 0.26),
    pageGlow2: rgbToCss(mix(average, [255, 255, 255], 0.06), 0.22),
    pageWash: rgbToCss([255, 255, 255], 0.42),
    homeStart: rgbToCss(mix(average, [255, 255, 255], 0.38)),
    homeMid: rgbToCss(mix(average, [255, 255, 255], 0.28)),
    homeEnd: rgbToCss(mix(average, dark, 0.18)),
    heroInk: rgbToCss(heroInk),
    heroMuted: rgbToCss(heroMuted, heroIsLight ? 0.94 : 0.94),
    heroBorder,
    heroControlBg,
    heroHeaderBg,
    heroOverlayLeft,
    heroOverlayMid,
    heroOverlayRight,
    heroNavBorder: heroIsLight ? 'rgba(34, 50, 68, 0.62)' : 'rgba(255, 255, 255, 0.72)',
    heroPlaceholder: heroIsLight ? 'rgba(34, 50, 68, 0.78)' : 'rgba(255, 255, 255, 0.78)',
    heroMenuBg: heroIsLight ? 'rgba(245, 249, 253, 0.98)' : 'rgba(24, 31, 41, 0.98)',
    heroMenuBorder: heroIsLight ? 'rgba(34, 50, 68, 0.16)' : 'rgba(255, 255, 255, 0.2)',
  };
};

const applyPalette = (palette) => {
  const root = document.documentElement;
  const pairs = {
    '--bg': palette.bg,
    '--surface': palette.surface,
    '--surface-strong': palette.surfaceStrong,
    '--surface-muted': palette.surfaceMuted,
    '--ink': palette.ink,
    '--muted': palette.muted,
    '--accent': palette.accent,
    '--accent-2': palette.accent2,
    '--line': palette.line,
    '--line-strong': palette.lineStrong,
    '--shadow': palette.shadow,
    '--page-glow-1': palette.pageGlow1,
    '--page-glow-2': palette.pageGlow2,
    '--page-wash': palette.pageWash,
    '--home-bg-start': palette.homeStart,
    '--home-bg-mid': palette.homeMid,
    '--home-bg-end': palette.homeEnd,
    '--hero-ink': palette.heroInk,
    '--hero-muted': palette.heroMuted,
    '--hero-border': palette.heroBorder,
    '--hero-control-bg': palette.heroControlBg,
    '--hero-header-bg': palette.heroHeaderBg,
    '--hero-overlay-left': palette.heroOverlayLeft,
    '--hero-overlay-mid': palette.heroOverlayMid,
    '--hero-overlay-right': palette.heroOverlayRight,
    '--hero-nav-border': palette.heroNavBorder,
    '--hero-placeholder': palette.heroPlaceholder,
    '--hero-menu-bg': palette.heroMenuBg,
    '--hero-menu-border': palette.heroMenuBorder,
  };

  Object.entries(pairs).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
};

export const getFeaturedPaletteSource = (posts = [], issues = [], fallbackUrl = '') => {
  const featuredIssue =
    (Array.isArray(issues) && issues.find((issue) => issue && issue.id === 'jq01')) ||
    (Array.isArray(issues) ? issues[0] : null);
  const featuredPost =
    featuredIssue && Array.isArray(featuredIssue.posts) && Array.isArray(posts)
      ? posts.find((post) => featuredIssue.posts.includes(post.slug))
      : null;

  return (
    (featuredPost && featuredPost.cover) ||
    (featuredIssue && featuredIssue.cover) ||
    fallbackUrl
  );
};

export const applyAdaptivePalette = async (imageUrl) => {
  if (!imageUrl) return null;
  try {
    const sample = await sampleImage(imageUrl);
    const palette = buildPalette(sample);
    applyPalette(palette);
    return palette;
  } catch {
    return null;
  }
};
