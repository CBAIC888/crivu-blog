const qs = (sel) => document.querySelector(sel);

const setText = (sel, value) => {
  const el = qs(sel);
  if (el && value) el.textContent = value;
};

const init = async () => {
  try {
    const res = await fetch('/posts/site.json');
    if (!res.ok) return;
    const site = await res.json();

    setText('#siteName', site.siteName);
    setText('#siteFooterText', site.footerText);
    setText('#aboutTitle', site.aboutTitle);
    setText('#aboutIntro', site.aboutIntro);
    setText('#aboutStyle', site.aboutStyle);
    setText('#aboutCity', site.city);
    setText('#aboutEmail', site.email);
    setText('#aboutTopics', site.topics);
  } catch {
    // keep default static text when config is unavailable
  }
};

init();
