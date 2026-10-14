(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 800px)');
  const shell = document.querySelector('.shell');
  const hero = document.querySelector('.hero-copy');
  if (!shell || !hero) return;

  const controls = document.createElement('nav');
  controls.className = 'universe-controls';
  controls.setAttribute('aria-label', 'Error Diffusion');
  controls.innerHTML = '<a href="https://alliance.errordiffusion.net/">Enter Alliance</a><a href="/pub/">public /pub</a><span>ADAY / LYSDEXIC</span><button type="button" aria-pressed="true">Glitch: on</button>';
  shell.prepend(controls);

  if (!narrow.matches) {
    const strip = document.createElement('div');
    strip.className = 'universe-glyph-strip';
    strip.setAttribute('aria-hidden', 'true');
    strip.innerHTML = ['INPUT', 'PATCH', 'STEMS', 'SCOPE', 'PRINT', 'LOCK']
      .map((label, i) => `<span class="universe-channel"><small>0${i + 1}</small><i class="universe-glyph"></i><b>${label}</b></span>`)
      .join('');
    hero.prepend(strip);

    const meter = document.createElement('div');
    meter.className = 'universe-meter';
    meter.setAttribute('aria-hidden', 'true');
    meter.innerHTML = '<span>FEEDBACK</span><div>' +
      Array.from({ length: 24 }, (_, i) => `<i style="--level:${0.22 + ((i * 17 + 5) % 29) / 40}"></i>`).join('') +
      '</div><span>LIVE</span>';
    hero.append(meter);
  }

  const transmission = document.createElement('p');
  transmission.className = 'universe-transmission';
  transmission.textContent = 'shared archive / still recording';
  hero.querySelector('h1')?.after(transmission);

  const lines = [
    'shared archive / still recording',
    'stems, patches, posters, debris',
    'aday x lysdexic',
    'leave the machine on',
    'find it before it leaks'
  ];
  let index = 0;
  const motionKey = 'ed-universe-motion-v3';
  let preference = null;
  try { preference = localStorage.getItem(motionKey); } catch (_) {}

  // Atmospheric glitch on by default (background shaders). Toggle still kills via universe-still.
  if (preference == null) preference = 'on';

  const button = controls.querySelector('button');
  function sync() {
    const active = !reduce.matches && preference !== 'off';
    root.classList.toggle('universe-still', !active);
    button.textContent = reduce.matches ? 'Reduced motion' : `Glitch: ${active ? 'on' : 'off'}`;
    button.setAttribute('aria-pressed', String(active));
    button.disabled = reduce.matches;
  }
  button.addEventListener('click', () => {
    preference = root.classList.contains('universe-still') ? 'on' : 'off';
    try { localStorage.setItem(motionKey, preference); } catch (_) {}
    sync();
  });
  reduce.addEventListener('change', sync);
  narrow.addEventListener('change', sync);
  sync();
  document.addEventListener('visibilitychange', () => root.classList.toggle('universe-background', document.hidden));

  const screen = document.getElementById('crtScreen');
  if (screen) {
    const debris = document.createElement('div');
    debris.className = 'universe-frame-debris';
    debris.setAttribute('aria-hidden', 'true');
    screen.append(debris);
    let previousFrame = '';
    const debrisGap = narrow.matches ? 14000 : 7200;
    const debrisPieces = narrow.matches ? 2 : 3;
    setInterval(() => {
      if (document.hidden || reduce.matches || root.classList.contains('universe-still')) return;
      const bounds = screen.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > innerHeight) return;
      const source = screen.querySelector('.media-plane.active img');
      if (!source?.complete || !source.naturalWidth) return;
      const frame = source.currentSrc || source.src;
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < debrisPieces; i++) {
        const block = document.createElement('img');
        block.src = i % 2 === 0 && previousFrame ? previousFrame : frame;
        block.alt = '';
        block.draggable = false;
        const top = 10 + Math.random() * 70;
        const height = 5 + Math.random() * 10;
        block.style.clipPath = `inset(${top}% ${i % 2 ? 0 : 10}% ${100 - top - height}% ${i % 2 ? 6 : 0}%)`;
        block.style.setProperty('--slip', `${(Math.random() - 0.5) * (narrow.matches ? 8 : 14)}%`);
        block.style.setProperty('--drop', `${Math.random() * 3 - 1}%`);
        block.style.setProperty('--echo-delay', `${i * 40}ms`);
        if (narrow.matches) block.style.opacity = '0.55';
        fragment.append(block);
      }
      debris.replaceChildren(fragment);
      previousFrame = frame;
      setTimeout(() => debris.replaceChildren(), narrow.matches ? 1100 : 1400);
    }, debrisGap);
  }

  setInterval(() => {
    if (document.hidden || root.classList.contains('universe-still')) return;
    transmission.classList.add('is-tearing');
    setTimeout(() => {
      transmission.textContent = lines[++index % lines.length];
      transmission.classList.remove('is-tearing');
    }, narrow.matches ? 220 : 280);
  }, narrow.matches ? 11000 : 7000);
})();
