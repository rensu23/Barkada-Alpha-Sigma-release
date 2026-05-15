# Barkada Final Project

Barkada is a PHP + MySQL contribution tracker for groups. Users can register, log in, create or join groups, add contributions, mark payments, and let the treasurer confirm or reject payment claims.

## Database Setup

1. Open XAMPP and start Apache and MySQL.
2. Open `http://localhost/phpmyadmin`.
3. Create a database named `barkada_db`.
4. Import `../barkada_db.sql`.
5. Check `php/config/database.php` if your MySQL username or password is different.

If you already imported the older database, run these migrations in phpMyAdmin without deleting data:

- `docs/database-migration-2026-05-01.sql`
- `docs/database-migration-2026-05-15.sql`

The app uses these SQL tables only:

- `users`
- `groups`
- `group_members`
- `contributions`
- `payment_records`
- `activity_logs`

## How To Run

Open the project through Apache, not by double-clicking the HTML file.

Example URL:

`http://localhost/Barkada-main/Barkada/Project67/index.html`

If your folder is directly under `htdocs`, the URL may be:

`http://localhost/Project67/index.html`

## Main App Flow

1. Register an account from `pages/signup.html`.
2. Log in from `pages/login.html`.
3. Create a group or join one using a group code.
4. A group creator is saved as `Treasurer` in `group_members`.
5. A member who joins is saved as `Member`.
6. Treasurers create contributions for their groups, including optional due date and notes.
7. The system creates `payment_records` for group members.
8. Members mark payments as `Pending`.
9. Treasurers confirm payments as `Paid` or reject them as `Rejected`.

## Default Accounts

The provided SQL file has the table structure only and does not include default users. Create accounts through the sign-up page after importing the database.

## Important Files

- `php/config/database.php` - shared mysqli database connection
- `php/helpers/auth-guard.php` - session and role checking helpers
- `php/helpers/activity.php` - simple activity logger for dashboard updates
- `php/helpers/response.php` - JSON response and request helpers
- `php/auth/` - login, register, logout, session, and password reset actions
- `php/groups/` - create, join, list, detail, update, members, and active group actions
- `php/contributions/` - create, list, detail, update, and recurring contribution actions
- `php/payments/` - mark paid, pending list, confirm, reject, and history actions
- `php/users/` - profile view and profile update actions
- `js/services/` - frontend API service functions that call the PHP endpoints
- `docs/database-migration-2026-05-01.sql` - migration for existing databases imported before the due date/notes update
- `docs/database-migration-2026-05-15.sql` - migration for activity logs and cleaner payment confirmation timestamps

## Notes For Defense

- The project uses `mysqli` only, not PDO.
- User inputs are handled with prepared statements.
- Passwords created through registration are saved with `password_hash`.
- Login uses `password_verify` and PHP sessions.
- Role checks use both `group_members.role` and `groups.treasurer_id` for treasurer actions.
- Treasurer-only actions are checked again in PHP, not only in JavaScript.
- The system does not invent columns that are not in `barkada_db.sql`.
- Contribution `due_date` and `notes` are stored in the updated `contributions` table.
- Dashboard activity comes from the `activity_logs` table and is written when groups, contributions, and payment statuses change.
- The current SQL has no reset-token or rejection-note table, so those flows are kept simple.

## Troubleshooting

- If pages redirect to login, log in again because PHP sessions are required.
- If database requests fail, make sure MySQL is running and `barkada_db` was imported.
- If login fails for an old manually inserted plain-text password, the login file can still accept it once and then upgrades it to a hash.
- If a member cannot see a group, check the `group_members` table for the correct `user_id` and `group_id`.
- If a treasurer action fails, check that the user's role is exactly `Treasurer` and `groups.treasurer_id` matches their `user_id`.
- If the due date or notes fields cause SQL errors, run the migration file on the existing database.
- If recent activity is empty on an old database, run `docs/database-migration-2026-05-15.sql`.
