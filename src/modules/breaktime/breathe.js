// Breathe: box breathing. A halftone square grows (in, 4 s), holds, shrinks (out, 4 s), holds.
const PHASES = [
  { text: 'Breathe in', scale: 1 },
  { text: 'Hold', scale: 1 },
  { text: 'Breathe out', scale: 0.35 },
  { text: 'Hold', scale: 0.35 },
];
const SECONDS = 4;

export default {
  id: 'breathe',
  name: 'Breathe',
  blurb: 'Box breathing, 4 · 4 · 4 · 4',
  scored: false,
  start(el, { h }) {
    const fill = h('div.breathe-fill');
    const word = h('div.breathe-word');
    const count = h('div.breathe-count');
    el.append(
      h('p.game-prompt', 'Follow the square. In through the nose, out slowly.'),
      h('div.breathe', h('div.breathe-box', fill), h('div.breathe-text', word, count)));
    let phase = -1;
    let left = 0;
    const step = () => {
      if (left <= 0) {
        phase = (phase + 1) % PHASES.length;
        left = SECONDS;
        word.textContent = PHASES[phase].text;
        fill.style.transform = `scale(${PHASES[phase].scale})`;
      }
      count.textContent = String(left);
      left -= 1;
    };
    fill.style.transform = 'scale(.35)';
    requestAnimationFrame(step);
    const id = setInterval(step, 1000);
    return () => clearInterval(id);
  },
};
