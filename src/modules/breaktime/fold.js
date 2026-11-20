// Fold & punch: a sheet is folded a few times and punched. Which pattern do you get
// when you unfold it? All maths is in original sheet coordinates: each fold reflects the
// cells on the folding side across the fold line, so after the folds every cell sits on
// one spot of the final (small) sheet, and a hole there goes through all cells stacked on it.
//
// It gets harder as you go: two right in a row moves you up a level, a miss moves you down.
// Up to level 15: bigger sheets (8×8, then 10×10), up to 7 folds, over folds (off-centre: a
// narrow strip folded over the rest, not in half), one or two diagonal folds at the end,
// hole shapes (circle / square / diamond), up to eight answers that are all near misses, and
// sometimes the question the other way round: here is the unfolded sheet, which punch made it?
const SIZE = 88;   // drawing size of the whole sheet, whatever its grid

// diag: chance of diagonal folds at the end; diag2: of those, chance of two (corner to corner, then
// the other diagonal). offc: chance a straight fold is an over fold (off-centre). near: only near misses.
const LEVELS = [
  null,
  { n: 4, folds: [2, 2], holes: [1, 1], shapes: 1, options: 4, diag: 0, reverse: 0 },
  { n: 4, folds: [2, 3], holes: [1, 2], shapes: 1, options: 4, diag: 0, reverse: 0 },
  { n: 4, folds: [3, 3], holes: [2, 2], shapes: 2, options: 4, diag: 0.3, reverse: 0.25 },
  { n: 8, folds: [3, 3], holes: [2, 3], shapes: 2, options: 6, diag: 0.35, reverse: 0.3 },
  { n: 8, folds: [3, 4], holes: [2, 2], shapes: 3, options: 6, diag: 0.45, reverse: 0.35 },
  { n: 8, folds: [4, 4], holes: [2, 3], shapes: 3, options: 6, diag: 0.5, reverse: 0.45 },
  { n: 8, folds: [4, 5], holes: [3, 4], shapes: 3, options: 8, diag: 0.6, reverse: 0.5, near: true },
  { n: 8, folds: [5, 5], holes: [3, 5], shapes: 3, options: 8, diag: 0.7, reverse: 0.55, near: true },
  { n: 8, folds: [4, 5], holes: [3, 4], shapes: 3, options: 8, diag: 0.7, diag2: 0.2, offc: 0.3, reverse: 0.5, near: true },
  { n: 8, folds: [5, 5], holes: [3, 5], shapes: 3, options: 8, diag: 0.75, diag2: 0.35, offc: 0.4, reverse: 0.5, near: true },
  { n: 8, folds: [5, 6], holes: [4, 5], shapes: 3, options: 8, diag: 0.8, diag2: 0.45, offc: 0.5, reverse: 0.55, near: true },
  { n: 10, folds: [5, 6], holes: [4, 5], shapes: 3, options: 8, diag: 0.8, diag2: 0.5, offc: 0.55, reverse: 0.55, near: true },
  { n: 10, folds: [6, 6], holes: [4, 6], shapes: 3, options: 8, diag: 0.85, diag2: 0.6, offc: 0.6, reverse: 0.6, near: true },
  { n: 10, folds: [6, 7], holes: [5, 6], shapes: 3, options: 8, diag: 0.9, diag2: 0.7, offc: 0.7, reverse: 0.6, near: true },
  { n: 10, folds: [7, 7], holes: [5, 7], shapes: 3, options: 8, diag: 1, diag2: 0.8, offc: 0.8, reverse: 0.65, near: true },
];
export const MAX_LEVEL = LEVELS.length - 1;
const SHAPES = ['o', 's', 'd'];   // circle, square, diamond: all the same mirrored, so only position matters

const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const between = (rng, [lo, hi]) => lo + Math.floor(rng() * (hi - lo + 1));
const shuffle = (rng, arr) => arr.map((v) => [rng(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

// A fold is { dir, at?, region }. Straight folds (L / R / T / B) fold the side before / after the
// line `at` over the other side; the flap is never wider than what stays, so a half fold has `at`
// in the middle and an over fold has it nearer the edge. D / A fold a square along a diagonal:
// D: top-right triangle onto bottom-left. A: top-left triangle onto bottom-right.
// region: { x0, x1, y0, y1, tri?: ['D' | 'A', ...] }: the paper left, a rectangle cut by diagonals.
function after(r, { dir, at }) {
  if (dir === 'D' || dir === 'A') return { ...r, tri: [...(r.tri ?? []), dir] };
  return { L: { ...r, x0: at }, R: { ...r, x1: at }, T: { ...r, y0: at }, B: { ...r, y1: at } }[dir];
}

function reflect(x, y, { dir, at, region: r }) {
  const s = r.x1 - r.x0;
  const u = x - r.x0;
  const v = y - r.y0;
  if (dir === 'L' && x < at) x = 2 * at - 1 - x;
  if (dir === 'R' && x >= at) x = 2 * at - 1 - x;
  if (dir === 'T' && y < at) y = 2 * at - 1 - y;
  if (dir === 'B' && y >= at) y = 2 * at - 1 - y;
  if (dir === 'D' && u > v) { x = r.x0 + v; y = r.y0 + u; }
  if (dir === 'A' && u + v < s - 1) { x = r.x0 + s - 1 - v; y = r.y0 + s - 1 - u; }
  return [x, y];
}

// Where an original cell ends up after the given folds.
function foldPos(x, y, folds) {
  for (const f of folds) [x, y] = reflect(x, y, f);
  return `${x},${y}`;
}

// A pattern is a list of "x,y,shape". key() makes it comparable.
const key = (cells) => [...cells].sort().join(' ');
const parse = (c) => { const [x, y, s] = c.split(','); return [Number(x), Number(y), s]; };

function spotsOf(r) {
  const out = [];
  const s = r.x1 - r.x0;
  for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) {
    const u = x - r.x0;
    const v = y - r.y0;
    // after a diagonal fold only the kept triangle is paper (holes on the crease would look odd)
    if (r.tri?.includes('D') && !(u < v)) continue;
    if (r.tri?.includes('A') && !(u + v > s - 1)) continue;
    out.push(`${x},${y}`);
  }
  return out;
}

const unfold = (punched, folds, n) => {
  const out = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const s = punched.get(foldPos(x, y, folds));
    if (s) out.push(`${x},${y},${s}`);
  }
  return out;
};

// Straight folds possible on a rectangle: half folds when the side is even, over folds
// (a strip of k < half folded over) when the level allows them.
function straightOpts(rng, r, offc) {
  if (r.tri) return [];
  const out = [];
  const axis = (lo, hi, a, b) => {
    const w = hi - lo;
    if (w < 2) return;
    if (offc > 0 && w >= 3 && (rng() < offc || w % 2)) {
      const k = 1 + Math.floor(rng() * Math.floor((w - 1) / 2));
      out.push({ dir: a, at: lo + k }, { dir: b, at: hi - k });
    } else if (w % 2 === 0) out.push({ dir: a, at: lo + w / 2 }, { dir: b, at: lo + w / 2 });
  };
  axis(r.x0, r.x1, 'L', 'R');
  axis(r.y0, r.y1, 'T', 'B');
  return out;
}

// Picks the folds for a level. Diagonals need a square, so it tries a few times, then with one
// or two straight folds fewer, and only then gives up on the diagonal.
function makeFolds(rng, L, n, diags = rng() < L.diag ? (rng() < (L.diag2 ?? 0) ? 2 : 1) : 0) {
  let best = null;
  for (let t = 0; t < 300; t++) {
    let region = { x0: 0, x1: n, y0: 0, y1: n };
    const folds = [];
    const count = between(rng, L.folds);
    const slack = diags ? Math.floor(t / 100) : 0;
    for (let i = 0; i < count - diags - slack; i++) {
      const opts = straightOpts(rng, region, L.offc ?? 0);
      if (!opts.length) break;
      const f = pick(rng, opts);
      folds.push({ ...f, region });
      region = after(region, f);
    }
    const w = region.x1 - region.x0;
    if (diags) {
      if (w !== region.y1 - region.y0 || w < (diags === 2 ? 4 : 2)) continue;
      const first = pick(rng, ['D', 'A']);
      for (const dir of diags === 2 ? [first, first === 'D' ? 'A' : 'D'] : [first]) {
        folds.push({ dir, region });
        region = after(region, { dir });
      }
    }
    const round = { folds, region };
    if (spotsOf(region).length < (diags ? 1 : L.holes[0])) continue;
    if (folds.length >= L.folds[0] - slack) return round;
    if (!best || folds.length > best.folds.length) best = round;
  }
  if (best) return best;
  return diags ? makeFolds(rng, L, n, diags - 1) : { folds: [], region: { x0: 0, x1: n, y0: 0, y1: n } };
}

export function makeRound(rng, level) {
  const L = LEVELS[Math.min(MAX_LEVEL, Math.max(1, level))];
  const n = L.n;
  const { folds, region } = makeFolds(rng, L, n);

  const spots = spotsOf(region);
  const shapes = SHAPES.slice(0, L.shapes);
  const holes = Math.min(spots.length, between(rng, L.holes));
  const punched = new Map(shuffle(rng, spots).slice(0, holes).map((s) => [s, pick(rng, shapes)]));
  const answer = unfold(punched, folds, n);
  const reverse = rng() < L.reverse;
  const wrongCount = L.options - 1;

  let options;
  let right;
  if (!reverse) {
    right = key(answer);
    options = [answer, ...wrongUnfolds(rng, { answer, punched, folds, n, shapes, count: wrongCount, nearOnly: L.near })];
  } else {
    // The other way round: options are punches on the folded sheet.
    const asList = (m) => [...m].map(([s, sh]) => `${s},${sh}`);
    right = key(asList(punched));
    const seen = new Set([right]);
    const wrong = [];
    const tries = [];
    for (let i = 0; i < 40; i++) {
      const m = new Map(punched);
      const [from] = pick(rng, [...m]);
      const kind = rng();
      if (kind < 0.5) {           // one hole in a different spot
        const free = spots.filter((s) => !m.has(s));
        if (!free.length) continue;
        const sh = m.get(from); m.delete(from); m.set(pick(rng, free), sh);
      } else if (kind < 0.75 && shapes.length > 1) {   // one hole a different shape
        m.set(from, pick(rng, shapes.filter((s) => s !== m.get(from))));
      } else {                    // a whole new punch
        const free = shuffle(rng, spots).slice(0, m.size);
        m.clear(); free.forEach((s) => m.set(s, pick(rng, shapes)));
      }
      tries.push(asList(m));
    }
    for (const c of tries) if (wrong.length < wrongCount && !seen.has(key(c))) { seen.add(key(c)); wrong.push(c); }
    options = [asList(punched), ...wrong];
  }
  return { n, level: Math.min(MAX_LEVEL, Math.max(1, level)), folds, region, punched, answer, reverse, right, options: shuffle(rng, options) };
}

// Wrong answers for "which unfolded sheet?": the usual slips, closest first on higher levels:
// one hole off by a cell, one hole the wrong shape, one unfold forgotten, mirrored the wrong way.
function wrongUnfolds(rng, { answer, punched, folds, n, shapes, count, nearOnly = false }) {
  const tf = (fn) => answer.map((c) => { const [x, y, s] = parse(c); return [...fn(x, y), s].join(','); });
  const inside = (c) => c.every((p) => { const [x, y] = parse(p); return x >= 0 && y >= 0 && x < n && y < n; });
  const near = [];
  for (let i = 0; i < answer.length; i++) {
    const [x, y, s] = parse(answer[i]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const moved = [...answer]; moved[i] = `${x + dx},${y + dy},${s}`;
      if (inside(moved) && new Set(moved.map((c) => c.split(',').slice(0, 2).join())).size === moved.length) near.push(moved);
    }
    if (shapes.length > 1) {
      const other = [...answer]; other[i] = `${x},${y},${pick(rng, shapes.filter((t) => t !== s))}`;
      near.push(other);
    }
  }
  // forgot the last unfold(s): the sheet after unfolding all but the first k folds, drawn on the full sheet
  const forgot = [1, 2].filter((k) => k < folds.length).map((k) => {
    const r = folds[k].region;
    return answer.filter((c) => { const [x, y] = parse(c); return x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1; });
  });
  const far = [
    tf((x, y) => [n - 1 - x, y]), tf((x, y) => [x, n - 1 - y]), tf((x, y) => [y, x]), tf((x, y) => [n - 1 - y, n - 1 - x]),
    [...punched].map(([s, sh]) => `${s},${sh}`), answer.slice(1),
    tf((x, y) => [(x + 1) % n, y]), tf((x, y) => [x, (y + 1) % n]),
  ];
  const seen = new Set([key(answer)]);
  const wrong = [];
  const add = (c) => { if (c.length && wrong.length < count && !seen.has(key(c))) { seen.add(key(c)); wrong.push(c); } };
  // mostly near misses, at least one "big" slip so it isn't only spot-the-difference
  // (top levels: nothing but near misses, so every answer looks almost right)
  const nearShare = nearOnly ? count : Math.max(1, count - 2);
  shuffle(rng, near).slice(0, nearShare).forEach(add);
  shuffle(rng, [...forgot, ...far]).forEach(add);
  shuffle(rng, near).forEach(add);
  while (wrong.length < count) {
    add(answer.map((c) => { const [, , s] = parse(c); return `${Math.floor(rng() * n)},${Math.floor(rng() * n)},${s}`; }));
  }
  return wrong;
}

// ── Drawing (SVG strings; nothing user-written goes in here) ──
// Geometry in cell units: each fold has a "kept side" g(p) >= 0, and a mirror across its line.
function plane({ dir, at, region: r }) {
  const s = r.x1 - r.x0;
  return {
    L: ([x]) => x - at, R: ([x]) => at - x, T: ([, y]) => y - at, B: ([, y]) => at - y,
    D: ([x, y]) => (y - r.y0) - (x - r.x0), A: ([x, y]) => (x - r.x0) + (y - r.y0) - s,
  }[dir];
}
function mirror([x, y], { dir, at, region: r }) {
  const s = r.x1 - r.x0;
  if (dir === 'L' || dir === 'R') return [2 * at - x, y];
  if (dir === 'T' || dir === 'B') return [x, 2 * at - y];
  if (dir === 'D') return [r.x0 + (y - r.y0), r.y0 + (x - r.x0)];
  return [r.x0 + s - (y - r.y0), r.y0 + s - (x - r.x0)];
}
// Keeps the part of a convex polygon where g >= 0.
function clip(poly, g) {
  const out = [];
  poly.forEach((a, i) => {
    const b = poly[(i + 1) % poly.length];
    const ga = g(a);
    const gb = g(b);
    if (ga >= 0) out.push(a);
    if ((ga >= 0) !== (gb >= 0)) { const t = ga / (ga - gb); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  });
  return out;
}
function regionPoly(r) {
  let poly = [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]];
  for (const dir of r.tri ?? []) poly = clip(poly, plane({ dir, region: { ...r, tri: null } }));
  return poly;
}
const centre = (poly) => poly.reduce(([a, b], [x, y]) => [a + x / poly.length, b + y / poly.length], [0, 0]);

const NAMES = {
  L: 'left side over to the right', R: 'right side over to the left', T: 'top down', B: 'bottom up',
  D: 'top-right corner down to bottom-left', A: 'top-left corner down to bottom-right',
};

function draw(n) {
  const CELL = SIZE / n;
  const pts = (poly) => poly.map(([x, y]) => `${x * CELL},${y * CELL}`).join(' ');
  const shape = (poly, cls) => `<polygon class="${cls}" points="${pts(poly)}"/>`;
  const paper = (r) => shape(regionPoly(r), 'fp-paper');
  const full = `<rect class="fp-ghost" x="0" y="0" width="${SIZE}" height="${SIZE}"/>`;
  const svg = (inner, label) => `<svg viewBox="-6 -6 ${SIZE + 12} ${SIZE + 12}" role="img" aria-label="${label}">${inner}</svg>`;

  function step(f) {
    const poly = regionPoly(f.region);
    const g = plane(f);
    const flap = clip(poly, (p) => -g(p));
    // the crease: where the paper's edge crosses the fold line
    const cut = clip(poly, g).filter((p) => Math.abs(g(p)) < 1e-6);
    const [l0, l1] = [cut[0], cut[cut.length - 1]];
    const c1 = centre(flap);
    const c2 = mirror(c1, f);
    const at = (t) => [c1[0] + t * (c2[0] - c1[0]), c1[1] + t * (c2[1] - c1[1])];
    const [p1, p2] = [at(0.12), at(0.88)];
    const bend = [(c1[0] + c2[0]) / 2 - (c2[1] - c1[1]) * 0.35, (c1[1] + c2[1]) / 2 + (c2[0] - c1[0]) * 0.35];
    const P = ([x, y]) => `${x * CELL} ${y * CELL}`;
    const over = f.at !== undefined && Math.abs(f.at * 2 - ((f.dir === 'L' || f.dir === 'R') ? f.region.x0 + f.region.x1 : f.region.y0 + f.region.y1)) > 0.01;
    return svg(`${full}${shape(poly, 'fp-paper')}${shape(flap, 'fp-flap')}`
      + `<line class="fp-fold" x1="${l0[0] * CELL}" y1="${l0[1] * CELL}" x2="${l1[0] * CELL}" y2="${l1[1] * CELL}"/>`
      + `<path class="fp-arrow" d="M${P(p1)} Q${P(bend)} ${P(p2)}"/><circle class="fp-arrow-head" cx="${p2[0] * CELL}" cy="${p2[1] * CELL}" r="3.5"/>`,
    `Fold ${over ? 'a strip of the ' : ''}${NAMES[f.dir]}`);
  }

  const hole = (c) => {
    const [x, y, s] = parse(c);
    const cx = (x + 0.5) * CELL;
    const cy = (y + 0.5) * CELL;
    const r = CELL * 0.3;
    if (s === 's') return `<rect class="fp-hole" x="${cx - r * 0.9}" y="${cy - r * 0.9}" width="${r * 1.8}" height="${r * 1.8}"/>`;
    if (s === 'd') return `<polygon class="fp-hole" points="${cx},${cy - r * 1.25} ${cx + r * 1.25},${cy} ${cx},${cy + r * 1.25} ${cx - r * 1.25},${cy}"/>`;
    return `<circle class="fp-hole" cx="${cx}" cy="${cy}" r="${r}"/>`;
  };

  function holes(cells, region = null) {
    const sheet = region ? full + paper(region) : `<rect class="fp-paper" x="0" y="0" width="${SIZE}" height="${SIZE}"/>`;
    const grid = region ? '' : Array.from({ length: n - 1 }, (_, i) =>
      `<line class="fp-grid" x1="${(i + 1) * CELL}" y1="0" x2="${(i + 1) * CELL}" y2="${SIZE}"/><line class="fp-grid" x1="0" y1="${(i + 1) * CELL}" x2="${SIZE}" y2="${(i + 1) * CELL}"/>`).join('');
    return svg(sheet + grid + cells.map(hole).join(''), `${cells.length} hole${cells.length === 1 ? '' : 's'}`);
  }
  return { step, holes };
}

const html = (h, cls, markup) => { const el = h(cls); el.innerHTML = markup; return el; };
const LETTERS = 'ABCDEFGH';

export default {
  id: 'fold',
  name: 'Fold & punch',
  blurb: 'Unfold the paper in your head. Gets harder as you go',
  scored: true,
  start(el, { h, rng, score }) {
    const level = h('span.fp-level');
    const prompt = h('p.game-prompt');
    const steps = h('div.fp-steps');
    const opts = h('div.fp-options');
    el.append(h('div.fp-top', level, prompt), steps, opts);
    let locked = false;
    let timer = 0;
    let lvl = 3;      // levels 1–2 are the warm-ups you drop back to after misses
    let streak = 0;

    function next() {
      locked = false;
      const round = makeRound(rng, lvl);
      const d = draw(round.n);
      const holesCount = round.punched.size;
      level.textContent = `Level ${round.level}`;
      level.dataset.level = String(round.level);
      prompt.textContent = round.reverse
        ? 'The other way round: this is the sheet unfolded. Which punch made it?'
        : `${round.folds.length} folds, ${holesCount} punch${holesCount > 1 ? 'es' : ''}. Which sheet do you get when you unfold it?`;
      const foldSteps = round.folds.map((f, i) => h('div.fp-step', html(h, 'div.fp-pic', d.step(f)), h('span.fp-cap', `${i + 1}. Fold`)));
      const last = round.reverse
        ? h('div.fp-step.is-target', html(h, 'div.fp-pic', d.holes(round.answer)), h('span.fp-cap', 'Unfolded'))
        : h('div.fp-step', html(h, 'div.fp-pic', d.holes([...round.punched].map(([s, sh]) => `${s},${sh}`), round.region)), h('span.fp-cap', `${round.folds.length + 1}. Punch`));
      steps.replaceChildren(...foldSteps, last);
      opts.classList.toggle('is-six', round.options.length === 6);
      opts.classList.toggle('is-eight', round.options.length > 6);
      opts.replaceChildren(...round.options.map((o, i) => {
        const right = key(o) === round.right;
        const btn = h('button.fp-option', { 'aria-label': `Answer ${LETTERS[i]}`, onclick: () => choose(btn, right, round.level) });
        btn.dataset.right = String(right);
        btn.append(html(h, 'span', round.reverse ? d.holes(o, round.region) : d.holes(o)), h('span.fp-letter', LETTERS[i]));
        return btn;
      }));
    }
    function choose(btn, right, pts) {
      if (locked) return;
      locked = true;
      score(right ? pts : 0, right);
      btn.classList.add(right ? 'is-right' : 'is-wrong');
      opts.querySelector('[data-right="true"]').classList.add('is-right');
      if (right) {
        streak += 1;
        if (streak >= 2 && lvl < MAX_LEVEL) { lvl += 1; streak = 0; level.textContent = `Level ${lvl} ↑`; }
      } else {
        streak = 0;
        lvl = Math.max(1, lvl - 1);
      }
      timer = setTimeout(next, right ? 800 : 1800);
    }
    next();
    return () => clearTimeout(timer);
  },
};
