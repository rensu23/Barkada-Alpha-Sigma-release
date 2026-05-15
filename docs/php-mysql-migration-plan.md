# PHP/MySQL Migration Plan

## Cleanup Completed

- Removed frontend-only users, groups, members, contributions, payments, and activity files.
- Removed browser-database behavior from `js/utils/storage.js`.
- Removed account autofill, role-preview, payment mutation, and group mutation flows that previously acted as the application data source.
- Removed obsolete credential and walkthrough documentation.
- Preserved UI-only JavaScript for navigation, theme switching, forms, modals, drawers, filters, and empty-state rendering.

## Schema Mapping

- Login/register/profile: `users`.
- Group listing/detail/create/update/join: `groups` and `group_members`.
- Member roster: `group_members` joined to `users`, with optional payment aggregates through `contributions` and `payment_records`.
- Contributions: `contributions`, scoped by `groups.group_id` and current user's `group_members` row.
- Payment status, confirmations, and history: `payment_records` joined to `users`, `contributions`, and `groups`.
- Dashboard: SQL aggregates from `groups`, `group_members`, `contributions`, and `payment_records`.

## Authentication And Sessions

Implement `php/auth/login.php` first:

- Read `email` and `password`.
- Query `users.email` with a prepared statement.
- Verify `users.password` using `password_verify`.
- Regenerate the PHP session ID on success.
- Store only safe identifiers such as `user_id` and active group context in `$_SESSION`.
- Return generic errors for wrong credentials, missing accounts, and inactive states if an active flag is added later.

Implement `php/auth/logout.php`:

- Start the session.
- Clear session values.
- Destroy the session.
- Redirect to login or return JSON.

## Groups And Join Codes

- `php/groups/list.php`: return groups for the session user through `group_members`.
- `php/groups/create.php`: insert `groups`, then insert `group_members.role = Treasurer` in one transaction.
- `php/groups/join.php`: look up `groups.join_code`, prevent duplicate membership, insert `role = Member`, handle invalid code and duplicate membership errors.
- `php/groups/detail.php`: verify membership before returning the group, members, or contributions.

## Contributions And Payments

- `php/contributions/list.php`: return SQL-scoped rows for the active group and role.
- `php/contributions/create.php`: treasurer-only insert using `group_id`, `title`, `amount`, `type`, `frequency`, `due_date`, and `notes`.
- `php/payments/mark-paid.php`: member updates only their own payment row to pending.
- `php/payments/confirm.php`: treasurer confirms pending rows and sets `confirmed_at`, `confirmed_by`.
- `php/payments/reject.php`: treasurer rejects a row.

## Error Handling

Handle and surface:

- database connection failure,
- missing session,
- unauthorized group access,
- invalid group code,
- duplicate membership,
- missing contribution,
- invalid or missing payment record,
- already confirmed payment,
- rejected payment update,
- validation errors,
- empty result sets,
- unexpected server errors,
- frontend network/request failure.

## Sorting And Filtering

Use SQL parameters rather than client-side arrays:

- contributions: `group_id`, `type`, `frequency`, status through joined `payment_records`, amount ordering, title search.
- confirmations: pending status by active group.
- members: name search, role, payment status aggregate.
- history: group, member, contribution, status, latest update ordering, pagination.

## Authorization

Frontend role-aware UI is display only. PHP must enforce:

- logged-in session,
- membership in requested group,
- treasurer-only create/edit/confirm/reject/member-management actions,
- members can view and update only their own payment records,
- group code visibility is controlled,
- hidden inputs and client role values are not trusted.

## Remaining Improvements

1. Add CSRF token generation and validation for POST forms if required by the instructor.
2. Add pagination for long history/member reports.
3. Add automated browser tests for authorization and validation failures.
