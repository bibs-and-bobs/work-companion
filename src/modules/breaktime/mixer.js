// Overprint: match a printed colour by stacking pink, blue and yellow ink at 0–100%.
// Swatches are real overprints: three flat token-ink layers with multiply blending.
const INKS = ['pink', 'blue', 'yellow'];
const LEVELS = 4;   // 0, 25, 50, 75, 100 %

function swatch(h, levels) {
  const layers = INKS.map((ink) => h(`span.mix-layer.ink-${ink}`));
  const el = h('div.mix-swatch', layers);
  const set = (lv) => lv.forEach((v, i) => { layers[i].style.opacity = String(v / LEVELS); });
  set(levels);
  return { el, set };
}

export default {
  id: 'mixer',
  name: 'Overprint',
  blurb: 'Mix inks to match the colour',
  scored: true,
  start(el, { h, rng, score }) {
    let target;
    let locked = false;
    let timer = 0;
    const mine = [0, 0, 0];
    const goal = swatch(h, [0, 0, 0]);
    const yours = swatch(h, mine);
    const result = h('p.mix-result');
    const sliders = INKS.map((ink, i) => {
      const out = h('output.mix-pct', '0%');
      const input = h(`input.mix-range.ink-${ink}`, {
        type: 'range', min: 0, max: LEVELS, step: 1, value: 0, 'aria-label': `${ink} ink`,
        oninput: (e) => { mine[i] = Number(e.target.value); out.textContent = `${mine[i] * 25}%`; yours.set(mine); },
      });
      return { row: h('label.mix-row', h(`span.mix-ink.ink-${ink}`, ink), input, out), input, out };
    });
    const printBtn = h('button.btn.btn-primary-sm', { onclick: print }, 'Print');
    el.append(
      h('p.game-prompt', 'Stack the three inks until your print matches the target.'),
      h('div.mix-pair', h('figure.mix-fig', goal.el, h('figcaption', 'Target')), h('figure.mix-fig', yours.el, h('figcaption', 'Your print'))),
      h('div.mix-controls', sliders.map((s) => s.row)),
      h('div.btn-row', printBtn, result));

    function next() {
      locked = false;
      do target = INKS.map(() => Math.floor(rng() * (LEVELS + 1)));
      while (target.filter(Boolean).length < 2);
      goal.set(target);
      mine.fill(0);
      sliders.forEach((s) => { s.input.value = 0; s.out.textContent = '0%'; s.input.disabled = false; });
      yours.set(mine);
      result.textContent = '';
      printBtn.disabled = false;
    }
    function print() {
      if (locked) return;
      locked = true;
      const off = target.reduce((sum, v, i) => sum + Math.abs(v - mine[i]), 0);
      const pts = Math.max(0, 3 - off);
      score(pts, off === 0);
      result.textContent = off === 0 ? 'Perfect print! +3'
        : `${pts ? `Close: +${pts}.` : 'Off.'} It was ${target.map((v, i) => `${INKS[i]} ${v * 25}%`).join(', ')}.`;
      sliders.forEach((s) => { s.input.disabled = true; });
      printBtn.disabled = true;
      timer = setTimeout(next, off === 0 ? 900 : 2200);
    }
    next();
    return () => clearTimeout(timer);
  },
};
