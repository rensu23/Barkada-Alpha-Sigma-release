# File Structure Guide

- `index.html`: public landing entry.
- `pages/`: static page shells connected to PHP/MySQL through JavaScript services.
- `css/`: interface styles retained for the app shell.
- `js/main.js`: initializes UI behavior and page adapters.
- `js/services/`: backend-facing adapters; no hardcoded application records.
- `js/utils/storage.js`: small session/state adapter populated by PHP session responses.
- `js/theme.js`: client-side theme preference only.
- `php/`: mysqli endpoints aligned to `barkada_db.sql`.
- `docs/integration-notes.md`: endpoint, security, error handling, and sorting notes.
- `docs/php-mysql-migration-plan.md`: backend implementation summary.
