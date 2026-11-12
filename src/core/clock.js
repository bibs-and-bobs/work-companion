// One shared ticker so every module redraws in sync.
const subs = new Set();
let timer = null;

export function onTick(fn) {
  subs.add(fn);
  if (!timer) timer = setInterval(() => { const now = new Date(); subs.forEach((f) => f(now)); }, 1000);
  return () => subs.delete(fn);
}
