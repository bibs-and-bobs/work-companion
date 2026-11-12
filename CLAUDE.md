# Working on Work Companion

The README is the source of truth for this project: features, architecture, data model, design rules and checklist.

@README.md

Rules for every change:
- Fit changes into the whole app, not only the file asked about. Follow the README "Adding or changing a feature" checklist.
- Modules use `ctx` only. Day data goes through `core/worklog.js`. Hour maths only in `dayStats`/`weekStats`.
- Changing saved data shape → bump `VERSION` and add a migration in `core/store.js`.
- Use riso tokens and rules from the README. Check narrow (~420px) and every day state.
- Update README.md (features, architecture, changelog) in the same change.
- The web app (`src/`, published to GitHub Pages) is the main target. Keep it working offline: no external URLs, everything inside `src/`.
