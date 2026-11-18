// Stretch: draw a card, do it for 30 s, stamp it done, next card. About four per break.
export const STRETCHES = [
  { name: 'Neck tilt', how: 'Ear towards shoulder, hold. Slowly switch sides halfway.' },
  { name: 'Shoulder rolls', how: 'Roll both shoulders up, back and down. Big slow circles.' },
  { name: 'Chest opener', how: 'Hands behind your back, fingers laced. Squeeze shoulder blades, lift your chest.' },
  { name: 'Seated twist', how: 'Sit tall, turn to hold the back of the chair. Breathe. Switch sides halfway.' },
  { name: 'Wrist circles', how: 'Arms out, make slow circles with both wrists. Change direction halfway.' },
  { name: 'Finger spread', how: 'Spread your fingers wide, hold 3 s, make a fist. Repeat.' },
  { name: 'Prayer stretch', how: 'Palms together in front of your chest, lower them until you feel your wrists.' },
  { name: 'Overhead reach', how: 'Lace fingers, push palms up to the ceiling. Lean gently left, then right.' },
  { name: 'Standing calf raise', how: 'Stand up, rise onto your toes, lower slowly. Keep going.' },
  { name: 'Hip flexor', how: 'Stand, step one foot back, tuck your hips. Switch legs halfway.' },
  { name: 'Forward fold', how: 'Stand, soft knees, let your upper body hang. Nod yes and no.' },
  { name: 'Chin tucks', how: 'Pull your chin straight back (double chin!), hold 2 s, release. Repeat.' },
  { name: 'Eye palming', how: 'Rub your palms warm, cup them over closed eyes. Just rest.' },
  { name: 'Ankle circles', how: 'Lift one foot, circle the ankle. Switch feet halfway.' },
  { name: 'Side bend', how: 'One arm overhead, lean to the other side. Switch halfway.' },
  { name: 'Desk push-ups', how: 'Hands on the desk edge, step back, lower your chest to the desk and push back.' },
  { name: 'Upper back stretch', how: 'Arms out in front, round your back, push your hands away.' },
  { name: 'Walk it off', how: 'Walk to a window or the kitchen and back. Look around.' },
];
const CARD_SECONDS = 30;

export default {
  id: 'stretch',
  name: 'Stretch',
  blurb: 'Four quick stretch cards',
  scored: false,
  start(el, { h, rng }) {
    const deck = [...STRETCHES].sort(() => rng() - 0.5);
    let i = -1;
    let left = 0;
    const num = h('div.stretch-num');
    const name = h('h3.stretch-name');
    const how = h('p.stretch-how');
    const bar = h('div.stretch-bar-fill');
    const stamp = h('div.stamp.stretch-stamp', { hidden: true, 'data-ink': 'pink', 'aria-hidden': 'true' }, h('span.stamp-big', 'Done'));
    const card = h('div.stretch-card', num, name, how, h('div.stretch-bar', bar), stamp);
    const nextBtn = h('button.btn', { onclick: () => draw() }, 'Next card');
    el.append(h('p.game-prompt', '30 seconds each. Gentle, no pain.'), card, h('div.btn-row', nextBtn));

    function draw() {
      i = (i + 1) % deck.length;
      left = CARD_SECONDS;
      num.textContent = `Card ${i + 1}`;
      name.textContent = deck[i].name;
      how.textContent = deck[i].how;
      stamp.hidden = true;
      stamp.classList.remove('is-new');
      bar.style.width = '100%';
    }
    const tick = () => {
      left -= 1;
      bar.style.width = `${Math.max(0, left / CARD_SECONDS) * 100}%`;
      if (left === 0) { stamp.hidden = false; stamp.classList.add('is-new'); }
      if (left <= -2) draw();
    };
    draw();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  },
};
