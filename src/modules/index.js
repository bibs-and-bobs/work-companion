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

registerView({ id: 'today', title: 'Today' });
registerView({ id: 'calendar', title: 'Calendar' });
registerView({ id: 'notes', title: 'Notes' });
registerView({ id: 'todo', title: 'To-do' });

[today, tasks, notes, week, calendar, timesheet, search, tasklist].forEach(register);

// Where each module starts on the widget board (Settings → Layout → Widget board).
// 12 columns; y / h in rows. The board scales its rows so the lowest card ends at the bottom
// of the window, so this default is one screen. Hidden ones are in Edit layout → Add widget.
setBoardDefaults({
  today:     { x: 0, y: 0, w: 7, h: 7 },
  tasks:     { x: 7, y: 0, w: 5, h: 7 },
  week:      { x: 0, y: 7, w: 7, h: 7 },
  notes:     { x: 7, y: 7, w: 5, h: 7 },
  calendar:  { x: 0, y: 14, w: 12, h: 12, hidden: true },
  search:    { x: 7, y: 14, w: 5, h: 6, hidden: true },
  timesheet: { x: 0, y: 26, w: 12, h: 10, hidden: true },
  tasklist:  { x: 0, y: 36, w: 6, h: 10, hidden: true },
});
