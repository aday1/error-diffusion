(() => {
  'use strict';
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const shell = document.querySelector('.shell');
  const hero = document.querySelector('.hero-copy');
  if (!shell || !hero) return;
  const controls = document.createElement('nav'); controls.className = 'universe-controls'; controls.setAttribute('aria-label', 'Error Diffusion');
  controls.innerHTML = '<a href="https://alliance.errordiffusion.net/">Enter Alliance</a><span>ADAY / LYSDEXIC / SIGNAL DAMAGE</span><button type="button" aria-pressed="true">Glitch: on</button>';
  shell.prepend(controls);
  const strip = document.createElement('div'); strip.className = 'universe-glyph-strip'; strip.setAttribute('aria-hidden', 'true');
  strip.innerHTML = '<i class="universe-glyph"></i>'.repeat(6); hero.prepend(strip);
  const transmission = document.createElement('p'); transmission.className = 'universe-transmission';
  transmission.textContent = 'BREAKCORE / SIGNAL COLLISION'; hero.querySelector('h1')?.after(transmission);
  const lines = ['BREAKCORE / SIGNAL COLLISION', 'DSP / FEEDBACK / REVERBERATION', 'DATAMOSH / PACKET LOSS / DOOM', 'TWO HEADS / SAME FREQUENCY', 'KEYBOARD / PHASE / FRACTURE'];
  let index = 0, preference = null;
  try { preference = localStorage.getItem('ed-universe-motion'); } catch (_) {}
  const button = controls.querySelector('button');
  function sync() {
    const active = !reduce.matches && preference !== 'off';
    root.classList.toggle('universe-still', !active);
    button.textContent = reduce.matches ? 'Reduced motion' : `Glitch: ${active ? 'on' : 'off'}`;
    button.setAttribute('aria-pressed', String(active)); button.disabled = reduce.matches;
  }
  button.addEventListener('click', () => { preference = root.classList.contains('universe-still') ? 'on' : 'off'; try { localStorage.setItem('ed-universe-motion', preference); } catch (_) {} sync(); });
  reduce.addEventListener('change', sync); sync();
  setInterval(() => {
    if (document.hidden || root.classList.contains('universe-still')) return;
    transmission.classList.add('is-tearing');
    setTimeout(() => { transmission.textContent = lines[++index % lines.length]; transmission.classList.remove('is-tearing'); }, 180);
  }, 4800);
})();
