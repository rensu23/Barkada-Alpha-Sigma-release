# Testing Report

This repository is now in backend-preparation mode. Pages should render empty states until PHP/MySQL endpoints return real rows.

Recommended checks after each backend milestone:

- PHP syntax: `php -l` for every file under `php/`.
- JavaScript syntax/import check for every file under `js/`.
- HTML script/link reference check.
- Search for removed frontend data sources and removed code paths.
- `git diff --check`.
- Browser smoke test for landing, login, dashboard, groups, contributions, confirmations, members, history, profile, and settings.

Expected current behavior:

- No frontend account list powers login.
- No browser database powers groups, payments, contributions, members, or history.
- Theme preference is the only intentional browser storage use.
- App data regions render empty states and PHP endpoint guidance.
