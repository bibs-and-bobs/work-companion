// The one place that decides which tabs and modules exist, and their order.
import { registerView, register } from '../core/registry.js';
import today from './today/index.js';
import notes from './notes/index.js';
import week from './week/index.js';
import calendar from './calendar/index.js';

registerView({ id: 'today', title: 'Today' });
registerView({ id: 'calendar', title: 'Calendar' });

[today, notes, week, calendar].forEach(register);
