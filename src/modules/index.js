// The one place that decides which tabs and modules exist, and their order.
import { registerView, register, setBoardDefaults } from '../core/registry.js';
import today from './today/index.js';
import notes from './notes/index.js';
import week from './week/index.js';
import calendar from './calendar/index.js';
import tasks from './tasks/index.js';
import search from './search/index.js';
import tasklist from './tasklist/index.js';
import timesheet from './timesheet/index.js';
import water from './water/index.js';
import breaktime from './breaktime/index.js';
import daily from './daily/index.js';
import eyes from './eyes/index.js';

registerView({ id: 'today', title: 'Today' });
registerView({ id: 'calendar', title: 'Calendar' });
registerView({ id: 'notes', title: 'Notes' });
registerView({ id: 'todo', title: 'To-do' });
registerView({ id: 'break', title: 'Break' });

[today, tasks, notes, water, week, calendar, timesheet, search, tasklist, breaktime, daily, eyes].forEach(register);

// Where each module starts on the widget board (Settings → Layout → Widget board).
// 12 columns; y / h in rows. The board scales its rows so the lowest card ends at the bottom
// of the window, so this default is one screen. Hidden ones are in Edit layout → Add widget.
setBoardDefaults({
  today:     { x: 0, y: 0, w: 6, h: 7 },
  tasks:     { x: 6, y: 0, w: 3, h: 7 },
  water:     { x: 9, y: 0, w: 3, h: 7 },
  week:      { x: 0, y: 7, w: 6, h: 7 },
  notes:     { x: 6, y: 7, w: 3, h: 7 },
  breaktime: { x: 9, y: 7, w: 3, h: 7 },
  daily:     { x: 0, y: 14, w: 4, h: 8, hidden: true },
  eyes:      { x: 4, y: 14, w: 4, h: 4, hidden: true },
  calendar:  { x: 0, y: 22, w: 7, h: 11, hidden: true },
  search:    { x: 7, y: 14, w: 5, h: 6, hidden: true },
  timesheet: { x: 0, y: 34, w: 12, h: 10, hidden: true },
  tasklist:  { x: 0, y: 44, w: 6, h: 10, hidden: true },
});
