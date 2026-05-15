-- Barkada activity/history migration
-- Run this on an older barkada_db import before testing dashboard activity and history.

ALTER TABLE `groups`
  MODIFY `created_at` timestamp NOT NULL DEFAULT current_timestamp();

ALTER TABLE `payment_records`
  MODIFY `confirmed_at` timestamp NULL DEFAULT NULL,
  MODIFY `confirmed_by` int(11) DEFAULT NULL;

UPDATE `payment_records`
SET `confirmed_at` = NULL,
    `confirmed_by` = NULL
WHERE `status` IN ('Not Paid', 'Pending');

CREATE TABLE IF NOT EXISTS `activity_logs` (
  `activity_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `group_id` int(11) DEFAULT NULL,
  `contribution_id` int(11) DEFAULT NULL,
  `payment_id` int(11) DEFAULT NULL,
  `action` varchar(60) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`activity_id`),
  KEY `activity_user_idx` (`user_id`),
  KEY `activity_group_idx` (`group_id`),
  KEY `activity_contribution_idx` (`contribution_id`),
  KEY `activity_payment_idx` (`payment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO `activity_logs` (`user_id`, `group_id`, `action`, `created_at`)
SELECT `treasurer_id`, `group_id`, 'group_created', `created_at`
FROM `groups` g
WHERE NOT EXISTS (
  SELECT 1 FROM `activity_logs` al
  WHERE al.`group_id` = g.`group_id` AND al.`action` = 'group_created'
);

INSERT INTO `activity_logs` (`user_id`, `group_id`, `contribution_id`, `action`, `created_at`)
SELECT g.`treasurer_id`, c.`group_id`, c.`contribution_id`, 'contribution_created', g.`created_at`
FROM `contributions` c
INNER JOIN `groups` g ON g.`group_id` = c.`group_id`
WHERE NOT EXISTS (
  SELECT 1 FROM `activity_logs` al
  WHERE al.`contribution_id` = c.`contribution_id` AND al.`action` = 'contribution_created'
);

INSERT INTO `activity_logs` (`user_id`, `group_id`, `contribution_id`, `payment_id`, `action`, `created_at`)
SELECT pr.`user_id`, c.`group_id`, pr.`contribution_id`, pr.`payment_id`, 'payment_marked_paid', pr.`marked_at`
FROM `payment_records` pr
INNER JOIN `contributions` c ON c.`contribution_id` = pr.`contribution_id`
WHERE pr.`status` IN ('Pending', 'Paid')
  AND NOT EXISTS (
    SELECT 1 FROM `activity_logs` al
    WHERE al.`payment_id` = pr.`payment_id` AND al.`action` = 'payment_marked_paid'
  );

INSERT INTO `activity_logs` (`user_id`, `group_id`, `contribution_id`, `payment_id`, `action`, `created_at`)
SELECT confirmer.`user_id`, c.`group_id`, pr.`contribution_id`, pr.`payment_id`, 'payment_confirmed', pr.`confirmed_at`
FROM `payment_records` pr
INNER JOIN `contributions` c ON c.`contribution_id` = pr.`contribution_id`
LEFT JOIN `users` confirmer ON confirmer.`user_id` = pr.`confirmed_by`
WHERE pr.`status` = 'Paid'
  AND pr.`confirmed_at` IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM `activity_logs` al
    WHERE al.`payment_id` = pr.`payment_id` AND al.`action` = 'payment_confirmed'
  );

ALTER TABLE `activity_logs`
  ADD CONSTRAINT `activity_logs_user_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `activity_logs_group_fk`
    FOREIGN KEY (`group_id`) REFERENCES `groups` (`group_id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `activity_logs_contribution_fk`
    FOREIGN KEY (`contribution_id`) REFERENCES `contributions` (`contribution_id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `activity_logs_payment_fk`
    FOREIGN KEY (`payment_id`) REFERENCES `payment_records` (`payment_id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
