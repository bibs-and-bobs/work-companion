// The one place that decides which tabs and modules exist, and their order.
import { registerView, register } from '../core/registry.js';
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
