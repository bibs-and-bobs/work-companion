// Eye break (20-20-20): every 20 minutes while you're working, look at something about
// 6 m / 20 ft away for 20 seconds. The app shows a full-screen reminder that closes itself.
// If the app isn't the window you're looking at, it sends a system notification instead
// (when notifications are allowed in the To-do tab). Runs only while the day is begun.
// Private data (ctx.ns): { on: true, every: 20, date: 'YYYY-MM-DD', count }
const LOOK_SECONDS = 20;
const WORKING = new Set(['working', 'overtime']);

export default {
  id: 'eyes',
  title: 'Eye break',
  view: 'break',
  ink: 'green',

  mount(el, { h, worklog, widgets, reminders, time, onTick, onData, ns }) {
    const load = () => ({ on: true, every: 20, date: null, count: 0, ...ns.get({}) });
    const big = h('div.eyes-big');
    const sub = h('p.eyes-sub');
    const countEl = h('span.eyes-count');
    const nowBtn = h('button.btn', { onclick: () => run() }, 'Now');
    const pauseBtn = h('button.btn', { onclick: () => { ns.set({ ...load(), on: !load().on }); nextAt = null; tick(); } });
    el.append(big, sub, h('div.btn-row', nowBtn, pauseBtn, countEl));

    let nextAt = null;

    function done() {
      const d = load();
      const key = time.dateKey(new Date());
      ns.set({ ...d, date: key, count: d.date === key ? d.count + 1 : 1 });
    }

    function run() {
      nextAt = Date.now() + load().every * 60_000;
      if (document.hidden || !document.hasFocus()) {
        if (reminders.notifyState() === 'granted') {
          try { new Notification('Eye break', { body: 'Look at something far away for 20 seconds.', tag: 'wc-eyes', icon: 'icons/icon-192.png' }); } catch {}
        }
        if (document.hidden) return;
      }
      let left = LOOK_SECONDS;
      const num = h('div.eyes-num', String(left));
      const ring = h('div.eyes-ring', num);
      const ov = widgets.overlay({ label: 'Eye break', ink: 'green', onClose: () => clearInterval(id) });
      ov.body.append(h('div.eyes-look',
        h('h2.eyes-title.reg-text', 'Look far away'),
        h('p.eyes-hint', 'Find something at least 6 m / 20 ft away and rest your eyes on it. Blink a few times.'),
        ring,
        h('button.link', { onclick: () => ov.close() }, 'Skip')));
      ring.style.setProperty('--left', '1');
      const id = setInterval(() => {
        left -= 1;
        num.textContent = String(left);
        ring.style.setProperty('--left', String(left / LOOK_SECONDS));
        if (left <= 0) { done(); ov.close(); }
      }, 1000);
    }

    function tick(now = new Date()) {
      const d = load();
      const state = worklog.dayStats(now, now).state;
      const n = d.date === time.dateKey(now) ? d.count : 0;
      countEl.textContent = n ? `${n} today` : '';
      pauseBtn.textContent = d.on ? 'Pause' : 'Turn on';
      el.dataset.state = !d.on ? 'paused' : WORKING.has(state) ? 'running' : 'waiting';
      if (!d.on) {
        nextAt = null;
        big.textContent = 'Paused';
        sub.textContent = `Every ${d.every} min: look 6 m away for 20 s. Turn on when you want reminders.`;
        return;
      }
      if (!WORKING.has(state)) {
        nextAt = null;
        big.textContent = `${d.every}:00`;
        sub.textContent = `Every ${d.every} min while you're working: look 6 m away for 20 s. Starts when you begin the day.`;
        return;
      }
      nextAt ??= now.getTime() + d.every * 60_000;
      const ms = nextAt - now.getTime();
      if (ms <= 0) {
        if (widgets.overlayOpen()) nextAt = now.getTime() + 60_000;   // you're on another break: try again in a minute
        else run();
        return;
      }
      const s = Math.ceil(ms / 1000);
      big.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      sub.textContent = `Until your next eye break. Look 6 m / 20 ft away for 20 s.`;
    }

    tick();
    const offTick = onTick(tick);
    const offData = onData((n) => { if (n === 'mod:eyes' || n === 'worklog') tick(); });
    return () => { offTick(); offData(); };
  },

  settings(el, { h, ns }) {
    const d = { on: true, every: 20, ...ns.get({}) };
    el.append(h('div.form',
      h('label.field', h('span.field-label', 'Eye break every (minutes)'),
        h('input.input', { type: 'number', min: 5, max: 90, step: 5, value: d.every, onchange: (e) => {
          const v = Math.min(90, Math.max(5, Number(e.target.value) || 20));
          e.target.value = v;
          ns.set({ ...d, ...ns.get({}), every: v });
        } }),
        h('span.field-hint', 'Only while your day is running. 20 is the classic 20-20-20 rule.'))));
  },
};
