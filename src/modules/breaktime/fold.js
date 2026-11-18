// Fold & punch: a 4×4 sheet is folded 2–3 times and punched. Which pattern do you get
// when you unfold it? All maths is in original sheet coordinates: each fold reflects the
// cells on the folding side across the fold line, so after the folds every cell sits on
// one spot of the final (small) sheet, and a hole there goes through all cells stacked on it.
const N = 4;
const CELL = 22;
const SIZE = N * CELL;

const mid = (a, b) => (a + b) / 2;

function after(r, f) {
  const mx = mid(r.x0, r.x1);
  const my = mid(r.y0, r.y1);
  return {
    L: { ...r, x0: mx }, R: { ...r, x1: mx },
    T: { ...r, y0: my }, B: { ...r, y1: my },
  }[f];
}

// Where an original cell ends up after all folds.
function foldPos(x, y, folds) {
  for (const { dir, region: r } of folds) {
    const mx = mid(r.x0, r.x1);
    const my = mid(r.y0, r.y1);
    if (dir === 'L' && x < mx) x = 2 * mx - 1 - x;
    if (dir === 'R' && x >= mx) x = 2 * mx - 1 - x;
    if (dir === 'T' && y < my) y = 2 * my - 1 - y;
    if (dir === 'B' && y >= my) y = 2 * my - 1 - y;
  }
  return `${x},${y}`;
}

const key = (cells) => [...cells].sort().join(' ');
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

function makeRound(rng) {
  let region = { x0: 0, x1: N, y0: 0, y1: N };
  const folds = [];
  const count = rng() < 0.45 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const opts = [];
    if (region.x1 - region.x0 > 1) opts.push('L', 'R');
    if (region.y1 - region.y0 > 1) opts.push('T', 'B');
    const dir = pick(rng, opts);
    folds.push({ dir, region });
    region = after(region, dir);
  }
  const spots = [];
  for (let y = region.y0; y < region.y1; y++) for (let x = region.x0; x < region.x1; x++) spots.push(`${x},${y}`);
  const punched = new Set([pick(rng, spots)]);
  if (spots.length > 1 && rng() < 0.4) punched.add(pick(rng, spots));

  const answer = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (punched.has(foldPos(x, y, folds))) answer.push(`${x},${y}`);

  // Wrong answers: the usual slips (mirrored the wrong way, forgot to unfold, one hole off).
  const tf = (fn) => answer.map((c) => { const [x, y] = c.split(',').map(Number); return fn(x, y).join(','); });
  const candidates = [
    tf((x, y) => [N - 1 - x, y]), tf((x, y) => [x, N - 1 - y]), tf((x, y) => [y, x]),
    tf((x, y) => [N - 1 - y, x]), [...punched], answer.slice(1),
    tf((x, y) => [(x + 1) % N, y]), tf((x, y) => [x, (y + 1) % N]),
  ];
  const seen = new Set([key(answer)]);
  const wrong = [];
  for (const c of candidates.sort(() => rng() - 0.5)) {
    const k = key(c);
    if (c.length && !seen.has(k) && wrong.length < 3) { seen.add(k); wrong.push(c); }
  }
  while (wrong.length < 3) {
    const c = Array.from({ length: answer.length }, () => `${Math.floor(rng() * N)},${Math.floor(rng() * N)}`);
    if (!seen.has(key(c))) { seen.add(key(c)); wrong.push(c); }
  }
  const options = [answer, ...wrong].sort(() => rng() - 0.5);
  return { folds, region, punched, answer: key(answer), options };
}

// ── Drawing (SVG strings; nothing user-written goes in here) ──
const rect = (r, cls) => `<rect class="${cls}" x="${r.x0 * CELL}" y="${r.y0 * CELL}" width="${(r.x1 - r.x0) * CELL}" height="${(r.y1 - r.y0) * CELL}"/>`;
const svg = (inner, label) => `<svg viewBox="-6 -6 ${SIZE + 12} ${SIZE + 12}" role="img" aria-label="${label}">${inner}</svg>`;

function stepSvg({ dir, region: r }) {
  const mx = mid(r.x0, r.x1) * CELL;
  const my = mid(r.y0, r.y1) * CELL;
  const line = dir === 'L' || dir === 'R'
    ? `<line class="fp-fold" x1="${mx}" y1="${r.y0 * CELL}" x2="${mx}" y2="${r.y1 * CELL}"/>`
    : `<line class="fp-fold" x1="${r.x0 * CELL}" y1="${my}" x2="${r.x1 * CELL}" y2="${my}"/>`;
  const q = CELL * 0.9;
  const arrow = {
    L: [mx - q, my, mx + q, my], R: [mx + q, my, mx - q, my],
    T: [mx, my - q, mx, my + q], B: [mx, my + q, mx, my - q],
  }[dir];
  const [x1, y1, x2, y2] = arrow;
  const bend = dir === 'L' || dir === 'R' ? `${(x1 + x2) / 2} ${y1 - CELL}` : `${x1 - CELL} ${(y1 + y2) / 2}`;
  const flap = { L: { ...r, x1: mid(r.x0, r.x1) }, R: { ...r, x0: mid(r.x0, r.x1) }, T: { ...r, y1: mid(r.y0, r.y1) }, B: { ...r, y0: mid(r.y0, r.y1) } }[dir];
  return svg(`${rect({ x0: 0, x1: N, y0: 0, y1: N }, 'fp-ghost')}${rect(r, 'fp-paper')}${rect(flap, 'fp-flap')}${line}`
    + `<path class="fp-arrow" d="M${x1} ${y1} Q${bend} ${x2} ${y2}"/><circle class="fp-arrow-head" cx="${x2}" cy="${y2}" r="3.5"/>`, `Fold ${dir}`);
}

function holesSvg(cells, region = null) {
  const sheet = region ? rect({ x0: 0, x1: N, y0: 0, y1: N }, 'fp-ghost') + rect(region, 'fp-paper') : rect({ x0: 0, x1: N, y0: 0, y1: N }, 'fp-paper');
  const grid = region ? '' : Array.from({ length: N - 1 }, (_, i) =>
    `<line class="fp-grid" x1="${(i + 1) * CELL}" y1="0" x2="${(i + 1) * CELL}" y2="${SIZE}"/><line class="fp-grid" x1="0" y1="${(i + 1) * CELL}" x2="${SIZE}" y2="${(i + 1) * CELL}"/>`).join('');
  const holes = [...cells].map((c) => { const [x, y] = c.split(',').map(Number); return `<circle class="fp-hole" cx="${(x + 0.5) * CELL}" cy="${(y + 0.5) * CELL}" r="6.5"/>`; }).join('');
  return svg(sheet + grid + holes, `${cells.length ?? cells.size} holes`);
}

const html = (h, cls, markup) => { const el = h(cls); el.innerHTML = markup; return el; };

export default {
  id: 'fold',
  name: 'Fold & punch',
  blurb: 'Unfold the paper in your head',
  scored: true,
  start(el, { h, rng, score }) {
    const steps = h('div.fp-steps');
    const prompt = h('p.game-prompt', 'Fold, fold, punch. Which sheet do you get when you unfold it?');
    const opts = h('div.fp-options');
    el.append(prompt, steps, opts);
    let locked = false;
    let timer = 0;

    function next() {
      locked = false;
      const round = makeRound(rng);
      steps.replaceChildren(
        ...round.folds.map((f, i) => h('div.fp-step', html(h, 'div.fp-pic', stepSvg(f)), h('span.fp-cap', `${i + 1}. Fold`))),
        h('div.fp-step', html(h, 'div.fp-pic', holesSvg(round.punched, round.region)), h('span.fp-cap', `${round.folds.length + 1}. Punch`)));
      opts.replaceChildren(...round.options.map((o, i) => {
        const btn = h('button.fp-option', { 'aria-label': `Answer ${'ABCD'[i]}`, onclick: () => choose(btn, key(o) === round.answer) });
        btn.dataset.right = String(key(o) === round.answer);
        btn.append(html(h, 'span', holesSvg(o)), h('span.fp-letter', 'ABCD'[i]));
        return btn;
      }));
    }
    function choose(btn, right) {
      if (locked) return;
      locked = true;
      score(right ? 1 : 0, right);
      btn.classList.add(right ? 'is-right' : 'is-wrong');
      opts.querySelector('[data-right="true"]').classList.add('is-right');
      timer = setTimeout(next, right ? 700 : 1500);
    }
    next();
    return () => clearTimeout(timer);
  },
};
