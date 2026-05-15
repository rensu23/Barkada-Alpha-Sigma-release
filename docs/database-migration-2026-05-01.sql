-- Run this only if barkada_db was already imported before due_date/notes were added.
-- It updates the existing database without deleting current records.

ALTER TABLE `contributions`
  ADD COLUMN `due_date` date DEFAULT NULL AFTER `frequency`,
  ADD COLUMN `notes` text DEFAULT NULL AFTER `due_date`;

ALTER TABLE `group_members`
  ADD UNIQUE KEY `unique_user_group` (`user_id`, `group_id`);

ALTER TABLE `users`
  ADD UNIQUE KEY `unique_email` (`email`);
