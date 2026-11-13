# Work Companion

A small companion for the work day, in a risograph print style.
It runs as a **web app you install from the browser** (works offline, no installer).
It is meant to grow one feature at a time and look finished at every stage.

![Today tab](docs/today.png)

> **For future work on this project (people or AI):** read this whole file first.
> It describes how the app is put together and the rules that keep it consistent.
> When you change the app, update this file in the same change (see *Keeping this file current*).

---

## What it does today (v0.5)

| Tab | Card | What it shows |
|---|---|---|
| **Today** | **Today** | Press **Begin day** to start the countdown to **home time** (default 9h at work). Shows time to go, % done, a progress bar, and Worked / Home in / Home at. **Worked** counts 8h for a full day (9h minus the unpaid break). **End day** logs the finish. **Resume** undoes it. |
| | **To-do** | Today's tasks. Tick to finish, pencil to edit, × to delete. **Unfinished tasks move to the next day by themselves** (labelled "from Mon…"); finished ones stay on the day they were done. |
| | **Notes** | Type a note and press Enter (or `Ctrl+N` from anywhere). It is timestamped and saved to today's record. Notes stay hidden, with a "Show" toggle. Each note can be **edited** (pencil) or deleted (×). Write `#tags` in a note; click a tag to open the Notes tab filtered by it. |
| | **This week** | Week % done, hours worked/left, a bar per day. Click a day to open it in the Calendar. A green dot means that day has notes. |
| **Calendar** | **Calendar** | Month grid with hours worked, note counts and day-type tags. Select a day to fix its start/end times (for example if you forgot to press Begin day), set its **day type** (public holiday, vacation, sick day, half day), optionally through a later date to mark a whole vacation week, and manage its tasks and notes. Tasks can be planned on future days. |
| | **Timesheet** | Hours for this week / last week / this month / last month as a table, with a total. **Copy summary** (plain text) and **Download CSV**, each optionally with notes. |
| **Notes** | **Search notes** | Search all notes (matches are highlighted), filter by `#tag` chips, edit or delete in place, click a day to open it in the Calendar. |
| *(drawer)* | **Settings** | Time at work (default 9h), unpaid break (default 1h), workdays, and **Your data**: save to a file on this PC (automatic), plus manual backup / restore. |
| *(masthead)* | **Reconnect file** | Appears after a browser restart when a linked file needs the browser's permission again (one click). |
| *(masthead)* | **Install app** | Appears when the browser can install it as a desktop app (Chrome / Edge). |

Keyboard: `Ctrl+1` Today, `Ctrl+2` Calendar, `Ctrl+3` Notes, `Ctrl+N` new note, `Esc` close Settings.

## Run it

### Main way: web app (GitHub Pages)

Why: Windows **Smart App Control** on the work laptop blocks unsigned desktop apps, and code signing
costs money. A web app needs no installing, so nothing gets blocked.

- Every push to `main` publishes the `src/` folder to GitHub Pages (`.github/workflows/pages.yml`).
- One-time setup: repo **Settings → Pages → Source: GitHub Actions**. Free GitHub Pages needs a **public** repo.
  That's fine: only the code is public. Your log never leaves your browser.
- Open the site in Edge or Chrome, then **Install app** (in the app's header, or the install icon in the address bar).
  It then opens in its own window, with its own icon in the Start menu and taskbar.
- Updates: push to `main`. The app picks up new files the next time it's opened while online.

### Locally

Serve `src/` with any static server and open it, e.g. `cd src && python3 -m http.server 8000` → http://localhost:8000.
ES modules don't load from `file://`, so double-clicking `index.html` won't work.

### Optional: Electron desktop build

Still works on machines without Smart App Control: `npm install` then `npm start`.
An installer (`npm install --save-dev electron-builder`, `npm run dist`) would need code signing to pass Smart App Control.

### Where data lives

| Running as | Saved in |
|---|---|
| Web app | The browser's localStorage for the site (per browser profile). Persistent storage is requested. |
| Web app + linked file | The same, **plus** a real `.json` file the user chose (Settings → Your data → Choose file…). Every change is written to it automatically. |
| Electron | `companion.json` in the OS user-data folder |

**Linked file (v0.4)** uses the browser File System Access API, so it needs Edge or Chrome. How it behaves:
- The browser remembers the file (the handle is kept in IndexedDB) but asks for permission again after a restart. The app shows **Reconnect file**; one click and saving resumes. Until then changes are still saved in the browser, and the newer copy is written to the file on reconnect.
- At startup, if the file is linked and permitted, the **most recently saved copy wins**, judged by `_savedAt`. So a file edited or synced (for example by OneDrive) from another PC is picked up.
- Choosing a file that already holds a work log asks before replacing the browser's data. A file that holds something else is never overwritten.
- A file in a OneDrive/Documents folder gives automatic cloud backup with no extra code.

Browser data can be wiped (clearing site data, IT policies, a new laptop). Link a file and/or **Download a backup** in Settings
now and then. A backup is the whole saved JSON object, and restoring runs the normal migrations, so old backups keep working.

---

## Architecture

Plain HTML/CSS/JavaScript ES modules. **No framework and no build step.** That's on purpose: any file can be read and edited directly.
The same `src/` folder runs as a web app (main) and inside Electron (optional). Nothing loads from other servers: fonts are bundled.

```
main.js / preload.js      Optional Electron wrapper: one window + read/write of companion.json
.github/workflows/        pages.yml: publishes src/ to GitHub Pages on push to main
src/index.html            Page shell: manifest, icons, fonts, riso.css, core/app.js
src/manifest.webmanifest  Web-app install info (name, colors, icons)
src/sw.js                 Service worker: offline cache (network first, cache fallback; no file list to maintain)
src/icons/                icon.svg (source) + PNGs rendered from it
src/fonts/                Self-hosted Bricolage Grotesque + Space Mono (OFL) and fonts.css
src/styles/riso.css       Design tokens + every style (sections per module)
src/core/                 Shared framework. Modules never import these directly; they get them via ctx.
  app.js                  Boot: masthead, tabs, Settings drawer, mounts modules. Defines ctx.
  registry.js             registerView() / register() — the view & module contracts
  store.js                Saved state (one JSON object, namespaced) + versioned migrations + backup + which copy wins (browser vs linked file)
  filesync.js             Linked file on the PC: file handle, permission, debounced writes (talks to the file only)
  settings.js             User settings (day length, workdays)
  worklog.js              Day records + ALL hour maths (dayStats, weekStats, rangeStats) + actions (times, day type, notes, to-dos, carry-over)
  time.js                 Date helpers and formatters (pure)
  nav.js                  Hash router: #/<view>/<param>, e.g. #/calendar/2026-11-11
  clock.js                One shared 1-second tick
  dom.js                  h('div.class', {attrs}, ...children) element builder
  settings-panel.js       Settings drawer: Work day section
  data-panel.js           Settings drawer: Your data (linked file, backup / restore)
  widgets.js              Shared UI pieces: noteItem, todoItem (editable rows), richText (#tags + highlight), tagsOf, dayLabel
  pwa.js                  Web-app plumbing: registers sw.js, Install button, persistent storage
src/modules/
  index.js                THE list of tabs and modules, in order. Turn things on/off here.
  today/  tasks/  notes/  week/    (Today tab)
  calendar/  timesheet/              (Calendar tab)
  search/                            (Notes tab)
```

### Layers (top depends on bottom, never the reverse)

```
modules/*          features: draw cards, react to data, call actions
   │  via ctx only
core/app.js        shell + ctx
core/worklog.js  core/settings.js  core/nav.js  core/clock.js
core/store.js      persistence + migrations + backup (export/import)
platform           browser localStorage (web app)  or  main.js file I/O (Electron)
```

### The core idea: one work log

Every feature that is about *a day* reads from and writes to the **work log**.
Nothing keeps its own copy of hours or notes.

```jsonc
// the saved object (localStorage key "work-companion", or companion.json in Electron)
{
  "_version": 2,
  "_lastBackup": "2026-11-11T16:20:00.000Z",  // set when a backup is downloaded
  "_savedAt": "2026-11-11T16:21:00.000Z",     // set on every save; decides which copy is newest
  "settings": { "dayLengthMin": 540, "breakMin": 60, "workdays": [true, true, true, true, true, false, false] },
  "worklog": {
    "2026-11-11": {
      "start": "2026-11-11T07:30:00.000Z",   // Begin day (null = not started)
      "end": null,                            // End day (null = still working)
      "notes": [{ "id": "mh2x9k3a", "t": "2026-11-11T08:05:00.000Z", "text": "Standup #meeting", "e": "2026-11-11T09:00:00.000Z" }],  // e = last edited (optional)
      "todos": [{ "id": "k3j2h1xz", "text": "Send invoice", "done": null, "from": "2026-11-09" }],   // done = ISO time when ticked; from = day first planned (optional)
      "kind": "vacation"                      // optional: holiday | vacation | sick | half
    }
  },
  "mod:<id>": { }                             // a module's private data, if it needs any
}
```

- Days are keyed by local date `YYYY-MM-DD` (`time.dateKey`). Timestamps are ISO strings.
- Optional fields (`todos`, `kind`) are left out when empty. A day with nothing in it (no start, notes, to-dos or kind) is deleted from the log.
- Tags are not stored: they are `#words` inside note text, found with `widgets.tagsOf`.
- To-do carry-over: `worklog.carryOver(now)` moves open to-dos from earlier days to today (finished ones stay as that day's history). It runs at startup and after midnight (see `core/app.js`), and saves only if something moved. Tasks planned on future days stay there until that day passes.
- v0.5 only added optional fields, so no migration was needed (`_version` is still 2).

### Hours: time at work vs counted work

The user is at work **9h** (`settings.dayLengthMin`, Begin day → home) but only **8h** count (9h minus the unpaid break, `settings.breakMin`).
The break is **not** placed in the day. Instead:
- The **countdown, progress bar and % done** use time at work (`presenceMs`, `elapsedMs`, `leftMs`). Home time = start + 9h.
- **Worked hours and the week total** use counted work: `workedMs = elapsed × (8/9)`, so a full day at work counts exactly 8h. Past home time, extra time is added 1:1 (`overMs`).
- `targetMs` = counted work for a full day (8h). `workLeftMs` = counted work still to do. `leftMs` = wall-clock time until home.

### Day states (`worklog.dayStats(date, now)`)

All hour numbers in the UI come from this one function. Change the rules there, not in modules.

| state | meaning | counted in week total? |
|---|---|---|
| `idle` | today, a workday, not begun | yes, as a full day still to do |
| `working` | begun, before home time | yes |
| `overtime` | begun today, past home time, not ended | yes (counted work + time past home) |
| `ended` | ended, **or a past day never ended** (counted as exactly one full day: 8h) | yes |
| `planned` | future workday | yes, as a full day still to do |
| `missed` | past workday with no start | no |
| `off` | non-workday with no start (beginning one makes it count) | no |
| `leave` | holiday / vacation / sick day with no start | no |

`weekStats(now)` sums the counted days Mon–Sun: `workedMs`, `leftMs`, `pct`.
`rangeStats(from, to, now)` does the same for any date range (Timesheet): `days`, `workedMs`, `daysWorked`, `leave` counts.

### Day types (`record.kind`, `worklog.KINDS`)

| kind | effect |
|---|---|
| `holiday`, `vacation`, `sick` | with no start: state `leave`, **not counted** (no hours expected that day). If you actually begin the day, it is worked as normal. |
| `half` | halves that day's time at work, break and counted work (4.5h at work / 4h counted by default). Counts normally. |

`setKind(date, kind)` sets one day. `setKindRange(from, to, kind)` marks a run in one save: setting skips non-workdays and days already worked, clearing clears every day in range.

### Views and modules

A **view** is a tab: `registerView({ id, title })`.
A **module** is a card on a view:

```js
export default {
  id: 'focus',               // unique; also its private store namespace
  title: 'Focus',            // card label
  view: 'today',             // which tab (defaults to the first)
  ink: 'green',              // pink | blue | yellow | green | orange  (card accent)
  span: 'full',              // optional: 'wide' | 'full'
  mount(el, ctx) {           // draw into el; return a cleanup function
    const off = ctx.onTick((now) => { /* every second */ });
    return off;
  },
  settings(el, ctx) {},      // optional: own section in the Settings drawer
};
```

`ctx` (built in `core/app.js`):

| key | what |
|---|---|
| `h` | element builder: `h('button.btn', { onclick }, 'Label')` |
| `worklog` | `KINDS`, `getDay`, `dayStats`, `weekStats`, `rangeStats`, `beginDay`, `endDay`, `resumeDay`, `setTimes`, `clearTimes`, `setKind`, `setKindRange`, `addNote`, `editNote`, `deleteNote`, `allNotes`, `addTodo`, `toggleTodo`, `editTodo`, `deleteTodo`, `carryOver` |
| `settings` | `get()`, `set(patch)`, `dayLengthMs()` (time at work), `workLengthMs()` (counted work) |
| `widgets` | `noteItem(date, note, {query})` and `todoItem(date, todo)`: editable rows (pencil to edit, × to delete). Use them wherever notes / to-dos are listed. `richText(text, {query})` renders `#tags` as links and highlights a search; `tagsOf(text)`; `dayLabel(key)`. |
| `time` | `dateKey`, `fromKey`, `addDays`, `startOfWeek`, `atTime`, `toHHMM`, `fmtDuration`, `fmtTime`, `fmtDate`, `DAY_NAMES`, … |
| `nav` | `go(view, param)`, `current()`, `onChange(fn)` |
| `onTick(fn)` | called every second with `now`; returns unsubscribe |
| `onData(fn)` | called after any saved change; returns unsubscribe |
| `ns` | `get(fallback)` / `set(value)` for the module's private saved data |

A module that throws while mounting only breaks its own card.

### Module conventions

- **Build once, update in place.** Create elements in `mount`, then update text/styles on tick. Rebuild a list only when its shape changes (see the `lastKey` pattern in `week/`). Never recreate buttons or inputs every second: clicks and focus get lost.
- **Don't redraw under the user's cursor.** If a re-render would replace an input that has focus, skip it (see `calendar/`).
- **Talk to other features through data or navigation**, not by importing each other. Week opens a day with `nav.go('calendar', key)`. Notes write to the work log and the Calendar picks them up.
- **Day data goes in the work log.** A module's own preferences or state go in `ctx.ns`. Anything several modules need goes in `core/`.
- Every state needs a designed look: empty, not started, in progress, done, off, day type (leave / half day).
- **`replaceChildren(null)` writes the word "null".** When a child may be absent, build an array and `.filter(Boolean)` before spreading.
- Tests that match by CSS class can clash: several cards reuse `.note-status`, `.note-list`, `.todo-list`. Scope selectors with `.card[data-module="…"]`.

### Changing saved data safely

If the shape of saved data changes, bump `VERSION` in `core/store.js` and add a migration function. Never break someone's existing log.
History: v1 had fixed per-weekday start/end times. v2 replaced them with Begin day + day length, and kept the workday on/off flags.

---

## Design system: Riso

Inspired by risograph printing: flat fluorescent inks on off-white paper, overprinting where inks overlap, halftone dots, slightly misaligned layers.
(Reference requested: typeui.sh/design-skills/riso. It couldn't be fetched when this was built, so this is the classic riso look. Align it if the reference differs.)

**Tokens** (`:root` in `riso.css`): `--paper #f3eee3`, `--ink #1f2a44`, `--pink #ff48b0`, `--blue #0078bf`, `--yellow #ffe800`, `--green #00a95c`, `--orange #ff6c2f`, `--muted`.
Fonts: **Bricolage Grotesque 800** (display, uppercase headings, numbers) + **Space Mono** (body, labels). Self-hosted in `src/fonts/`, with system fallbacks.
App icon: `src/icons/icon.svg` (pink + blue overprint with a yellow off-register ring and clock hands). Re-render the PNGs from it if it changes.

**Rules**
1. Only token colors. Inks are flat: no gradients except halftone dots.
2. Overlapping ink areas use `mix-blend-mode: multiply` so they overprint like real riso.
3. Offset shadows (`box-shadow: 6px 6px 0 <ink>`) instead of blurred shadows. Each card has one accent ink.
4. Misregistration (`--mis`, 3px) on big headlines (`.reg-text`, `.reg`) and highlight layers. Use it sparingly.
5. Halftone (`--halftone`) for empty or remaining space. Solid ink for done or filled.
6. 2px ink borders, 4px radius, dashed borders for "off/none".
7. Dark ink text on pink, yellow and green. Paper text only on blue and ink.
8. Paper grain overlays everything (`body::after`). Don't remove it.
9. Must work from ~420px wide up. Check narrow layouts.
10. Visible keyboard focus (blue outline) on everything clickable.

Meaning of inks so far: **pink** = today / now, **blue** = done / week / timesheet, **yellow** = calendar / highlight / days off, **green** = notes and tags, **orange** = to-do.

---

## Adding or changing a feature: checklist

1. **Where does the data live?** About a day → `worklog`. A user preference → `settings`. Private to one feature → `ctx.ns`. Changing an existing shape → add a migration.
2. **Where does it show?** A card on an existing tab, a new tab (`registerView`), or a section in Settings (`settings(el, ctx)`).
3. **What else is affected?** Check every module that reads the same data (Today, Week and Calendar all use `dayStats`), keyboard shortcuts, the narrow layout, and every day state.
4. Register it in `src/modules/index.js`. Add its styles as a new section in `riso.css`, using tokens.
   Keep everything inside `src/` and same-origin (no CDNs) so it works offline and passes work-laptop policies.
   If you change `sw.js` itself, bump its `CACHE` name.
5. Update this README: the feature table, data model, ctx, changelog.

## Keeping this file current

Each change should update: *What it does today*, any architecture or data-model section it touches, and the *Changelog*.

## License

Code: MIT (`LICENSE`). Bundled fonts: SIL Open Font License, see `NOTICE.md`.

## Changelog

- **v0.5**: Day types (public holiday, vacation, sick, half day), including marking a run of days; they change the week total correctly. Daily to-do list with automatic carry-over, plus planning on future days from the Calendar. Notes tab with search and `#tag` filtering. Timesheet (week/month) with copy-as-text and CSV download. Fixed: the Calendar's day header printed "null" on days with no start time.
- **v0.4**: Notes can be edited (Today and Calendar, shared `widgets.noteItem`). Day is now "time at work" (9h, the countdown to home) with an unpaid break (1h) so a full day counts 8h worked. Optional automatic saving to a real file on the PC (File System Access API) with Reconnect, newest-copy-wins and safe handling of foreign files. Settings fields: time at work, unpaid break.
- **v0.3**: Web app is now the main way to run it, because Smart App Control blocks the unsigned Electron build. Added an install manifest, an app icon, an offline service worker, an Install app button, self-hosted fonts (no outside requests), backup download/restore in Settings, and auto-publishing to GitHub Pages.
- **v0.2**: Begin day / End day / Resume with a 9h countdown (day length is configurable). Timestamped notes saved to the day. Calendar tab with day details (notes, editable times). Tabs + hash routing. Work log replaces fixed schedule (data migration v1→v2). README is now the project reference.
- **v0.1**: Today progress (fixed hours per weekday), week overview, schedule settings, riso design system, module registry.

## Ideas / roadmap

- Breaks / lunch inside the day bar
- Focus timer (pomodoro) that logs sessions to the day
- Flex-time balance (running +/- against the 8h target)
- Countdown in the window title and taskbar badge; notification at home time
- Floating mini countdown window (Document Picture-in-Picture)
- Riso stamps at milestones, on-time streak, night-print theme
- Google Calendar meetings on the day bar
- Tray icon / always-on-top mini mode showing time left
- Edit a note's time; undo for deleted notes
- Warn when the last backup / file save is old
- End-of-day notification
