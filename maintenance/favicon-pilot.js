// Opt-in document pilot only. Static icon declarations stay untouched until navigation.
(() => {
  const config = JSON.parse(document.getElementById('favicon-pilot-config').textContent);
  const root = document.documentElement;
  const media = matchMedia('(prefers-color-scheme: dark)');
  function selection() {
    let skin = root.dataset.skin || config.skin;
    let mode = root.dataset.mode || 'auto';
    if (!config.skins.includes(skin)) skin = config.skin;
    return { skin, mode: mode === 'auto' ? (media.matches ? 'dark' : 'light') : mode };
  }
  // Honor preferences saved by the regular site's actual theme picker.
  try {
    const savedSkin = localStorage.getItem('docsteer-skin');
    const savedMode = localStorage.getItem('docsteer-mode');
    root.dataset.skin = config.skins.includes(savedSkin) ? savedSkin : config.skin;
    root.dataset.mode = ['light', 'dark', 'auto'].includes(savedMode) ? savedMode : 'auto';
  } catch (_) { root.dataset.skin = config.skin; root.dataset.mode = config.mode; }
  const target = () => {
    const { skin, mode } = selection();
    return config.routes[`${skin}/${mode}`];
  };
  const initial = target()[config.canonical];
  if (location.pathname !== initial) {
    location.replace(initial + location.search + location.hash);
    return;
  }
  function update() {
    const routes = target();
    // Keep the current URL until a real navigation: replacing history could associate
    // the old static icon with the next profile URL in Safari's icon database.
    // A manual reload enters the initial preference redirect above.
    for (const link of document.querySelectorAll('a[href]')) {
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin) continue;
      const canonical = config.reverse[url.pathname] || url.pathname;
      if (routes[canonical]) link.href = routes[canonical] + url.search + url.hash;
    }
  }
  document.addEventListener('DOMContentLoaded', () => {
    update();
    new MutationObserver(update).observe(root, { attributes: true, attributeFilter: ['data-skin', 'data-mode'] });
    media.addEventListener('change', update);
    window.addEventListener('pageshow', update);
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-pilot-skin]');
      if (!button) return;
      root.dataset.skin = button.dataset.pilotSkin;
      try { localStorage.setItem('docsteer-skin', button.dataset.pilotSkin); } catch (_) {}
    });
  });
})();
