# Integration Notes

## Current Architecture

- Frontend pages are static HTML/CSS with JavaScript used for UI behavior and PHP endpoint calls.
- JavaScript service files in `js/services/` are thin adapters for JSON endpoints.
- Authentication comes from PHP sessions, not browser storage.
- Theme preference may remain client-side because `barkada_db.sql` has no preference column.

## Schema Source Of Truth

Use `../barkada_db.sql` as the required database contract:

- `users`: account identity with `user_id`, `name`, `email`, `password`, `created_at`.
- `groups`: group metadata with `group_id`, `group_name`, `description`, `treasurer_id`, `target_amount`, `deadline`, `join_code`, `created_at`.
- `group_members`: membership and per-group role with `member_id`, `user_id`, `group_id`, `role`, `joined_at`.
- `contributions`: contribution definitions with `contribution_id`, `group_id`, `title`, `amount`, `type`, `frequency`, `due_date`, `notes`.
- `payment_records`: member payment status with `payment_id`, `user_id`, `contribution_id`, `status`, `marked_at`, `confirmed_at`, `confirmed_by`.

## Endpoint Map

- `php/auth/login.php`: validate credentials, call `password_verify`, regenerate PHP session.
- `php/auth/register.php`: validate fields, check duplicate `users.email`, hash password, insert `users`.
- `php/auth/logout.php`: clear session variables, destroy the session, redirect or return JSON.
- `php/auth/session.php`: return safe current-user data and active group context.
- `php/groups/list.php`: current user's groups from `group_members` joined with `groups`.
- `php/groups/detail.php`: one group after membership verification.
- `php/groups/create.php`: insert `groups`, then creator membership as Treasurer in one transaction.
- `php/groups/update.php`: treasurer-only group update.
- `php/groups/join.php`: lookup `groups.join_code`, prevent duplicate `group_members`, insert Member role.
- `php/groups/members.php`: group roster from `group_members` joined with `users`, plus optional SQL status aggregates.
- `php/contributions/list.php`: SQL-backed contribution list and filters.
- `php/contributions/create.php`: treasurer-only insert into `contributions`.
- `php/payments/mark-paid.php`: member-only own-row update to pending status.
- `php/payments/confirm.php`: treasurer-only update to confirmed/paid.
- `php/payments/reject.php`: treasurer-only update to rejected status.
- `php/payments/history.php`: payment history from `payment_records` joined with `contributions` and `groups`.
- `php/users/profile.php` and `php/users/update-profile.php`: current user profile read/update.

## Security Plan

- Use mysqli prepared statements for every SQL query with user input.
- Escape rendered HTML with `htmlspecialchars`.
- Regenerate session ID after login.
- Add CSRF tokens to all POST forms.
- Enforce authorization in PHP for every read/write:
  - logged-in session required,
  - user belongs to requested group,
  - treasurer-only actions check `group_members.role`,
  - members can view or update only their own `payment_records`,
  - frontend role display is UX only.
- Prevent IDOR by checking membership before returning or updating any `group_id`, `contribution_id`, or `payment_id`.

## Error Handling Plan

Return consistent errors for database connection failure, missing session, unauthorized access, invalid group code, duplicate membership, missing contribution, invalid payment record, already-confirmed payment, rejected update, validation failures, empty result sets, and unexpected server errors.

## Sorting And Filtering Plan

Move filters into GET parameters handled by SQL:

- contributions: group, type/frequency, status, amount, title search, latest update.
- members: name, role, payment status.
- history: group, member, contribution, status, latest update.
- dashboard: aggregate by active group and `payment_records.status`.

## Current Notes

Core auth, groups, contributions, payments, profile, and dashboard data are connected. Future improvements can add CSRF tokens, pagination, and richer report filters if the project scope requires them.
