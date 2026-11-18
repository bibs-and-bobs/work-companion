// Daily puzzle: a 5×5 picture grid. The numbers say how many filled squares run together in
// each row and column (e.g. "2 1" = two filled, a gap, then one). A new grid every day, made
// from the date, so it's the same for anyone using the app that day. Solve days in a row for a streak.
// Any grid that matches all the clues counts as solved.
// Private data (ctx.ns): { date, cells: '.#x…' (25 chars), started: ISO | null, solved: { 'YYYY-MM-DD': seconds } }
const N = 5;

function seeded(text) {
  let a = 2166136261;
  for (const c of text) a = Math.imul(a ^ c.charCodeAt(0), 16777619);
  return () => {   // mulberry32
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function puzzleFor(key) {
  const rng = seeded(`work-companion:${key}`);
  let cells;
  do cells = Array.from({ length: N * N }, () => rng() < 0.58);
  while (cells.filter(Boolean).length < 11 || cells.filter(Boolean).length > 18);
  return cells;
}

const runs = (line) => {
  const out = [];
  let n = 0;
  for (const on of line) { if (on) n += 1; else if (n) { out.push(n); n = 0; } }
  if (n) out.push(n);
  return out.length ? out : [0];
};
const row = (cells, r) => cells.slice(r * N, r * N + N);
const col = (cells, c) => Array.from({ length: N }, (_, r) => cells[r * N + c]);
const same = (a, b) => a.join() === b.join();

export default {
  id: 'daily',
  title: 'Daily puzzle',
  view: 'break',
  ink: 'pink',

  mount(el, { h, time, onTick, ns }) {
    const status = h('p.daily-status');
    const streakEl = h('span.daily-streak');
    const grid = h('div.daily-grid', { role: 'grid', 'aria-label': 'Puzzle grid' });
    const markBtn = h('button.btn.btn-icon', { 'aria-pressed': 'false', title: 'Mark squares you know are empty', onclick: () => {
      marking = !marking;
      markBtn.setAttribute('aria-pressed', String(marking));
      markBtn.classList.toggle('btn-primary-sm', marking);
    } }, '✕ mode');
    const clearBtn = h('button.link', { onclick: () => { if (!isSolved()) save(cellsOf('.'.repeat(N * N))); } }, 'Clear');
    const stamp = h('div.stamp.daily-stamp', { hidden: true, 'data-ink': 'blue', 'aria-hidden': 'true' },
      h('span.stamp-big', 'Solved'), h('span.stamp-small'));
    el.append(h('div.daily-top', status, streakEl), h('div.daily-wrap', grid, stamp),
      h('div.btn-row.daily-tools', markBtn, clearBtn, h('span.muted.daily-help', 'Click to fill · right-click or ✕ mode to mark empty')));

    let marking = false;
    let key = '';
    let answer = [];
    let rowClues = [];
    let colClues = [];
    let buttons = [];

    const load = () => ({ solved: {}, ...ns.get({}) });
    const cellsOf = (s) => [...s];
    const current = () => { const d = load(); return d.date === key && d.cells ? cellsOf(d.cells) : cellsOf('.'.repeat(N * N)); };
    const isSolved = () => load().solved[key] != null;

    function save(cells) {
      const d = load();
      const filled = cells.map((c) => c === '#');
      const started = d.date === key && d.started ? d.started : new Date().toISOString();
      const next = { ...d, date: key, cells: cells.join(''), started };
      const ok = rowClues.every((cl, r) => same(runs(row(filled, r)), cl)) && colClues.every((cl, c) => same(runs(col(filled, c)), cl));
      if (ok) {
        next.solved = Object.fromEntries(Object.entries(next.solved).sort().slice(-60));
        next.solved[key] = Math.round((Date.now() - new Date(started)) / 1000);
        stamp.classList.add('is-new');
      }
      ns.set(next);
      draw();
    }

    function streak() {
      const solved = load().solved;
      let d = new Date();
      if (solved[time.dateKey(d)] == null) d = time.addDays(d, -1);
      let n = 0;
      while (solved[time.dateKey(d)] != null) { n += 1; d = time.addDays(d, -1); }
      return n;
    }

    function build() {
      key = time.dateKey(new Date());
      answer = puzzleFor(key);
      rowClues = Array.from({ length: N }, (_, r) => runs(row(answer, r)));
      colClues = Array.from({ length: N }, (_, c) => runs(col(answer, c)));
      buttons = [];
      const kids = [h('span.daily-corner')];
      colClues.forEach((cl, c) => kids.push(h('span.daily-clue.is-col', { 'data-col': c }, cl.map((n) => h('b', String(n))))));
      for (let r = 0; r < N; r++) {
        kids.push(h('span.daily-clue.is-row', { 'data-row': r }, rowClues[r].map((n) => h('b', String(n)))));
        for (let c = 0; c < N; c++) {
          const i = r * N + c;
          const b = h('button.daily-cell', {
            'aria-label': `Row ${r + 1}, column ${c + 1}`,
            onclick: () => toggle(i, marking ? 'x' : '#'),
            oncontextmenu: (e) => { e.preventDefault(); toggle(i, 'x'); },
          });
          buttons.push(b);
          kids.push(b);
        }
      }
      grid.replaceChildren(...kids);
      draw();
    }

    function toggle(i, mark) {
      if (isSolved()) return;
      const cells = current();
      cells[i] = cells[i] === mark ? '.' : mark;
      save(cells);
    }

    function draw() {
      const cells = current();
      const filled = cells.map((c) => c === '#');
      const solved = load().solved[key];
      buttons.forEach((b, i) => {
        b.dataset.mark = cells[i];
        b.setAttribute('aria-pressed', String(cells[i] === '#'));
        b.disabled = solved != null;
      });
      grid.querySelectorAll('.is-row').forEach((c, r) => c.classList.toggle('is-met', same(runs(row(filled, r)), rowClues[r])));
      grid.querySelectorAll('.is-col').forEach((c, i) => c.classList.toggle('is-met', same(runs(col(filled, i)), colClues[i])));
      stamp.hidden = solved == null;
      if (solved != null) stamp.lastChild.textContent = `in ${Math.floor(solved / 60)}:${String(solved % 60).padStart(2, '0')}`;
      status.textContent = solved != null ? 'Done for today. New grid tomorrow.' : 'Fill the squares so every row and column matches its numbers.';
      const s = streak();
      streakEl.textContent = s ? `Streak ${s} day${s > 1 ? 's' : ''}` : 'No streak yet';
      streakEl.classList.toggle('is-hot', s >= 3);
    }

    stamp.addEventListener('animationend', () => stamp.classList.remove('is-new'));
    build();
    return onTick((now) => { if (time.dateKey(now) !== key) build(); });
  },
};
