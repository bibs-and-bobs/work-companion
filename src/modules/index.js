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
// 12 columns; y / h in rows. Hidden ones can be added from Edit layout → Add widget.
setBoardDefaults({
  today:     { x: 0, y: 0,  w: 7, h: 9 },
  tasks:     { x: 7, y: 0,  w: 5, h: 9 },
  week:      { x: 0, y: 9,  w: 5, h: 8 },
  notes:     { x: 5, y: 9,  w: 7, h: 4 },
  search:    { x: 5, y: 13, w: 7, h: 4, hidden: true },
  calendar:  { x: 0, y: 17, w: 12, h: 12 },
  timesheet: { x: 0, y: 29, w: 12, h: 10, hidden: true },
  tasklist:  { x: 0, y: 39, w: 6, h: 10, hidden: true },
});
