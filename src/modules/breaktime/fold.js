// Fold & punch: a sheet is folded a few times and punched. Which pattern do you get
// when you unfold it? All maths is in original sheet coordinates: each fold reflects the
// cells on the folding side across the fold line, so after the folds every cell sits on
// one spot of the final (small) sheet, and a hole there goes through all cells stacked on it.
//
// It gets harder as you go: two right in a row moves you up a level, a miss moves you down.
// Higher levels use a bigger sheet (8×8), more folds, a diagonal last fold, several hole
// shapes (circle / square / diamond), six answers, near-miss wrong answers, and sometimes the
// question the other way round: here is the unfolded sheet, which punch made it?
const SIZE = 88;   // drawing size of the whole sheet, whatever its grid

const LEVELS = [
  null,
  { n: 4, folds: [2, 2], holes: [1, 1], shapes: 1, options: 4, diag: 0, reverse: 0 },
  { n: 4, folds: [2, 3], holes: [1, 2], shapes: 1, options: 4, diag: 0, reverse: 0 },
  { n: 4, folds: [3, 3], holes: [2, 2], shapes: 2, options: 4, diag: 0.3, reverse: 0.25 },
  { n: 8, folds: [3, 3], holes: [2, 3], shapes: 2, options: 6, diag: 0.35, reverse: 0.3 },
  { n: 8, folds: [3, 4], holes: [2, 2], shapes: 3, options: 6, diag: 0.45, reverse: 0.35 },
  { n: 8, folds: [4, 4], holes: [2, 3], shapes: 3, options: 6, diag: 0.5, reverse: 0.45 },
];
export const MAX_LEVEL = LEVELS.length - 1;
const SHAPES = ['o', 's', 'd'];   // circle, square, diamond: all the same mirrored, so only position matters

const mid = (a, b) => (a + b) / 2;
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
const between = (rng, [lo, hi]) => lo + Math.floor(rng() * (hi - lo + 1));
const shuffle = (rng, arr) => arr.map((v) => [rng(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v);

// Half folds keep the half on the far side of the arrow; D / A fold a square along a diagonal.
// D: top-right triangle onto bottom-left. A: top-left triangle onto bottom-right.
function after(r, f) {
  const mx = mid(r.x0, r.x1);
  const my = mid(r.y0, r.y1);
  return {
    L: { ...r, x0: mx }, R: { ...r, x1: mx },
    T: { ...r, y0: my }, B: { ...r, y1: my },
    D: { ...r, tri: 'D' }, A: { ...r, tri: 'A' },
  }[f];
}

function reflect(x, y, { dir, region: r }) {
  const mx = mid(r.x0, r.x1);
  const my = mid(r.y0, r.y1);
  const s = r.x1 - r.x0;
  const u = x - r.x0;
  const v = y - r.y0;
  if (dir === 'L' && x < mx) x = 2 * mx - 1 - x;
  if (dir === 'R' && x >= mx) x = 2 * mx - 1 - x;
  if (dir === 'T' && y < my) y = 2 * my - 1 - y;
  if (dir === 'B' && y >= my) y = 2 * my - 1 - y;
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
  for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) {
    const u = x - r.x0;
    const v = y - r.y0;
    const s = r.x1 - r.x0;
    // after a diagonal fold only the kept triangle is paper (holes on the crease would look odd)
    if (r.tri === 'D' && !(u < v)) continue;
    if (r.tri === 'A' && !(u + v > s - 1)) continue;
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

export function makeRound(rng, level) {
  const L = LEVELS[Math.min(MAX_LEVEL, Math.max(1, level))];
  const n = L.n;
  let region = { x0: 0, x1: n, y0: 0, y1: n };
  const folds = [];
  const count = between(rng, L.folds);
  for (let i = 0; i < count; i++) {
    const w = region.x1 - region.x0;
    const hgt = region.y1 - region.y0;
    const last = i === count - 1;
    if (last && w === hgt && w > 1 && rng() < L.diag) {
      const dir = pick(rng, ['D', 'A']);
      folds.push({ dir, region });
      region = after(region, dir);
      break;
    }
    const opts = [];
    if (w > 1 && w % 2 === 0) opts.push('L', 'R');
    if (hgt > 1 && hgt % 2 === 0) opts.push('T', 'B');
    if (!opts.length) break;
    const dir = pick(rng, opts);
    folds.push({ dir, region });
    region = after(region, dir);
  }

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
    options = [answer, ...wrongUnfolds(rng, { answer, punched, folds, n, shapes, count: wrongCount })];
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
function wrongUnfolds(rng, { answer, punched, folds, n, shapes, count }) {
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
  const nearShare = Math.max(1, count - 2);
  shuffle(rng, near).slice(0, nearShare).forEach(add);
  shuffle(rng, [...forgot, ...far]).forEach(add);
  shuffle(rng, near).forEach(add);
  while (wrong.length < count) {
    add(answer.map((c) => { const [, , s] = parse(c); return `${Math.floor(rng() * n)},${Math.floor(rng() * n)},${s}`; }));
  }
  return wrong;
}

// ── Drawing (SVG strings; nothing user-written goes in here) ──
function draw(n) {
  const CELL = SIZE / n;
  const rect = (r, cls) => `<rect class="${cls}" x="${r.x0 * CELL}" y="${r.y0 * CELL}" width="${(r.x1 - r.x0) * CELL}" height="${(r.y1 - r.y0) * CELL}"/>`;
  const poly = (pts, cls) => `<polygon class="${cls}" points="${pts.map(([x, y]) => `${x * CELL},${y * CELL}`).join(' ')}"/>`;
  const tri = (r, which) => poly({
    D: [[r.x0, r.y0], [r.x0, r.y1], [r.x1, r.y1]], Dflap: [[r.x0, r.y0], [r.x1, r.y0], [r.x1, r.y1]],
    A: [[r.x1, r.y0], [r.x1, r.y1], [r.x0, r.y1]], Aflap: [[r.x0, r.y0], [r.x1, r.y0], [r.x0, r.y1]],
  }[which], which.endsWith('flap') ? 'fp-flap' : 'fp-paper');
  const paper = (r) => (r.tri ? tri(r, r.tri) : rect(r, 'fp-paper'));
  const full = { x0: 0, x1: n, y0: 0, y1: n };
  const svg = (inner, label) => `<svg viewBox="-6 -6 ${SIZE + 12} ${SIZE + 12}" role="img" aria-label="${label}">${inner}</svg>`;

  function step({ dir, region: r }) {
    const mx = mid(r.x0, r.x1) * CELL;
    const my = mid(r.y0, r.y1) * CELL;
    const [X0, X1, Y0, Y1] = [r.x0 * CELL, r.x1 * CELL, r.y0 * CELL, r.y1 * CELL];
    const q = Math.min(X1 - X0, Y1 - Y0) * 0.22 + 6;
    let line; let flap; let arrow;
    if (dir === 'D' || dir === 'A') {
      line = dir === 'D' ? [X0, Y0, X1, Y1] : [X1, Y0, X0, Y1];
      flap = tri(r, `${dir}flap`);
      const d = q * 0.7;
      arrow = dir === 'D' ? [mx + d, my - d, mx - d, my + d] : [mx - d, my - d, mx + d, my + d];
    } else {
      line = dir === 'L' || dir === 'R' ? [mx, Y0, mx, Y1] : [X0, my, X1, my];
      flap = rect({ L: { ...r, x1: mid(r.x0, r.x1) }, R: { ...r, x0: mid(r.x0, r.x1) }, T: { ...r, y1: mid(r.y0, r.y1) }, B: { ...r, y0: mid(r.y0, r.y1) } }[dir], 'fp-flap');
      arrow = { L: [mx - q, my, mx + q, my], R: [mx + q, my, mx - q, my], T: [mx, my - q, mx, my + q], B: [mx, my + q, mx, my - q] }[dir];
    }
    const [x1, y1, x2, y2] = arrow;
    const bend = dir === 'L' || dir === 'R' ? `${(x1 + x2) / 2} ${y1 - q}` : dir === 'T' || dir === 'B' ? `${x1 - q} ${(y1 + y2) / 2}` : `${mid(x1, x2) - q * 0.5} ${mid(y1, y2) - q * 0.5}`;
    return svg(`${rect(full, 'fp-ghost')}${rect(r, 'fp-paper')}${flap}<line class="fp-fold" x1="${line[0]}" y1="${line[1]}" x2="${line[2]}" y2="${line[3]}"/>`
      + `<path class="fp-arrow" d="M${x1} ${y1} Q${bend} ${x2} ${y2}"/><circle class="fp-arrow-head" cx="${x2}" cy="${y2}" r="3.5"/>`,
    `Fold ${{ L: 'left over right', R: 'right over left', T: 'top down', B: 'bottom up', D: 'top-right corner down to bottom-left', A: 'top-left corner down to bottom-right' }[dir]}`);
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
    const sheet = region ? rect(full, 'fp-ghost') + paper(region) : rect(full, 'fp-paper');
    const grid = region ? '' : Array.from({ length: n - 1 }, (_, i) =>
      `<line class="fp-grid" x1="${(i + 1) * CELL}" y1="0" x2="${(i + 1) * CELL}" y2="${SIZE}"/><line class="fp-grid" x1="0" y1="${(i + 1) * CELL}" x2="${SIZE}" y2="${(i + 1) * CELL}"/>`).join('');
    return svg(sheet + grid + cells.map(hole).join(''), `${cells.length} hole${cells.length === 1 ? '' : 's'}`);
  }
  return { step, holes };
}

const html = (h, cls, markup) => { const el = h(cls); el.innerHTML = markup; return el; };
const LETTERS = 'ABCDEF';

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
    let lvl = 2;      // level 1 is the warm-up you drop back to after misses
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
      opts.classList.toggle('is-six', round.options.length > 4);
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
