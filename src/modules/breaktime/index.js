// Two-minute break: pick an activity, it opens full screen for 2 minutes, then a
// "Break done" stamp sends you back to work. Puzzles keep a best score.
// Activities live next to this file and share one tiny contract:
//   { id, name, blurb, scored, start(el, { h, rng, score(points, right) }) -> cleanup }
// Private data (ctx.ns): { days: { 'YYYY-MM-DD': breaks }, best: { <activity>: points } }
import fold from './fold.js';
import mixer from './mixer.js';
import breathe from './breathe.js';
import stretch from './stretch.js';

const GAMES = [fold, mixer, breathe, stretch];
const SESSION_MS = 2 * 60_000;
const COUNTS_AFTER_MS = 60_000;   // closing early still counts as a break after a minute

export default {
  id: 'breaktime',
  title: 'Two-minute break',
  view: 'break',
  ink: 'yellow',

  mount(el, { h, widgets, time, onData, ns }) {
    const load = () => ({ days: {}, best: {}, ...ns.get({}) });
    const todayCount = h('span.break-count');
    const bests = new Map();
    const tiles = GAMES.map((g) => {
      const best = h('span.break-best');
      bests.set(g.id, best);
      return h('button.break-tile', { 'data-game': g.id, onclick: () => play(g) },
        h('span.break-name', g.name), h('span.break-blurb', g.blurb), best);
    });
    el.append(
      h('div.break-top', h('div.break-head.reg-text', 'Two minutes off.'), todayCount),
      h('div.break-tiles', tiles),
      h('button.link', { onclick: () => play(GAMES[Math.floor(Math.random() * GAMES.length)]) }, 'Surprise me'));

    function render() {
      const d = load();
      const n = d.days[time.dateKey(new Date())] ?? 0;
      todayCount.textContent = n ? `${n} break${n > 1 ? 's' : ''} today` : 'No breaks yet today';
      for (const g of GAMES) bests.get(g.id).textContent = g.scored && d.best[g.id] ? `Best ${d.best[g.id]}` : '';
    }

    function record(game, points, finished) {
      const d = load();
      const key = time.dateKey(new Date());
      // keep a month of break counts
      const keep = Object.keys(d.days).sort().slice(-30);
      d.days = Object.fromEntries(keep.map((k) => [k, d.days[k]]));
      d.days[key] = (d.days[key] ?? 0) + 1;
      const isBest = finished && game.scored && points > (d.best[game.id] ?? 0);
      if (isBest) d.best[game.id] = points;
      ns.set(d);
      return isBest;
    }

    function play(game) {
      let points = 0;
      let rounds = 0;
      let right = 0;
      let done = false;
      let cleanup = null;
      const started = Date.now();
      const endAt = started + SESSION_MS;

      const fillBar = h('div.session-fill');
      const left = h('span.session-left', '2:00');
      const scoreEl = h('span.session-score');
      const stage = h('div.session-stage');
      const ov = widgets.overlay({ label: `${game.name} · 2-minute break`, ink: 'yellow', onClose: stop });
      ov.body.append(h('div.session-head', h('div.session-bar', fillBar), left, scoreEl), stage);

      const stopGame = () => { cleanup?.(); cleanup = null; };
      cleanup = game.start(stage, {
        h,
        rng: Math.random,
        score(p, ok) {
          points += p; rounds += 1; if (ok) right += 1;
          scoreEl.textContent = `${points} pt${points === 1 ? '' : 's'}`;
        },
      });
      if (game.scored) scoreEl.textContent = '0 pts';

      const tick = () => {
        const ms = endAt - Date.now();
        if (ms <= 0) return finish();
        fillBar.style.width = `${(ms / SESSION_MS) * 100}%`;
        const s = Math.ceil(ms / 1000);
        left.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      };
      const id = setInterval(tick, 250);

      function finish() {
        clearInterval(id);
        stopGame();
        done = true;
        const best = record(game, points, true);
        fillBar.style.width = '0%';
        left.textContent = '0:00';
        const line = game.scored
          ? `${points} point${points === 1 ? '' : 's'} · ${right} of ${rounds} spot on${best ? ' · new best!' : ''}`
          : 'Nice. Shoulders down, back to it.';
        const back = h('button.btn.btn-primary-sm', { onclick: () => ov.close() }, 'Back to work');
        stage.replaceChildren(h('div.session-done',
          h('div.stamp.session-stamp.is-new', { 'data-ink': 'pink', 'aria-hidden': 'true' },
            h('span.stamp-big', 'Break done'), h('span.stamp-small', time.fmtTime(new Date()))),
          h('p.session-line', line),
          h('div.btn-row', back, h('button.btn', { onclick: () => play(game) }, 'Again'))));
        back.focus();
      }
      function stop() {
        clearInterval(id);
        stopGame();
        if (!done && Date.now() - started >= COUNTS_AFTER_MS) record(game, points, false);
      }
    }

    render();
    return onData((nsName) => { if (nsName === 'mod:breaktime') render(); });
  },
};
