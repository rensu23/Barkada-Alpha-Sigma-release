<?php
/**
 * Shared mysqli database connection.
 * All PHP files include this file instead of opening their own connection.
 */

mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

$host = "localhost";
$user = "root";
$pass = "";
$db   = "barkada_db";

try {
    $conn = new mysqli($host, $user, $pass, $db);
    $conn->set_charset("utf8mb4");
    ensureBarkadaSchema($conn);
} catch (mysqli_sql_exception $e) {
    http_response_code(500);
    header("Content-Type: application/json");
    echo json_encode([
        "success" => false,
        "message" => "Database connection failed. Please check XAMPP MySQL and barkada_db."
    ]);
    exit;
}

/**
 * Keeps older imported databases compatible with the current project code.
 * This only adds columns that are already documented in barkada_db.sql.
 */
function ensureBarkadaSchema(mysqli $conn): void
{
    $activityTableCreated = false;

    if (!columnExists($conn, "contributions", "due_date")) {
        $conn->query("ALTER TABLE contributions ADD COLUMN due_date date DEFAULT NULL AFTER frequency");
    }

    if (!columnExists($conn, "contributions", "notes")) {
        $conn->query("ALTER TABLE contributions ADD COLUMN notes text DEFAULT NULL AFTER due_date");
    }

    if (!tableExists($conn, "activity_logs")) {
        $conn->query(
            "CREATE TABLE activity_logs (
                activity_id int(11) NOT NULL AUTO_INCREMENT,
                user_id int(11) DEFAULT NULL,
                group_id int(11) DEFAULT NULL,
                contribution_id int(11) DEFAULT NULL,
                payment_id int(11) DEFAULT NULL,
                action varchar(60) NOT NULL,
                created_at timestamp NOT NULL DEFAULT current_timestamp(),
                PRIMARY KEY (activity_id),
                KEY activity_user_idx (user_id),
                KEY activity_group_idx (group_id),
                KEY activity_contribution_idx (contribution_id),
                KEY activity_payment_idx (payment_id),
                CONSTRAINT activity_logs_user_fk FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE SET NULL ON UPDATE CASCADE,
                CONSTRAINT activity_logs_group_fk FOREIGN KEY (group_id) REFERENCES `groups` (group_id) ON DELETE CASCADE ON UPDATE CASCADE,
                CONSTRAINT activity_logs_contribution_fk FOREIGN KEY (contribution_id) REFERENCES contributions (contribution_id) ON DELETE SET NULL ON UPDATE CASCADE,
                CONSTRAINT activity_logs_payment_fk FOREIGN KEY (payment_id) REFERENCES payment_records (payment_id) ON DELETE SET NULL ON UPDATE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci"
        );
        $activityTableCreated = true;
    }

    // Pending and not-paid records should not look confirmed before a treasurer acts.
    $confirmedAt = columnInfo($conn, "payment_records", "confirmed_at");
    if (($confirmedAt["IS_NULLABLE"] ?? "NO") !== "YES") {
        $conn->query("ALTER TABLE payment_records MODIFY confirmed_at timestamp NULL DEFAULT NULL");
    }

    $confirmedBy = columnInfo($conn, "payment_records", "confirmed_by");
    if (($confirmedBy["IS_NULLABLE"] ?? "NO") !== "YES") {
        $conn->query("ALTER TABLE payment_records MODIFY confirmed_by int(11) DEFAULT NULL");
    }

    $groupCreatedAt = columnInfo($conn, "groups", "created_at");
    if (stripos($groupCreatedAt["EXTRA"] ?? "", "on update") !== false) {
        $conn->query("ALTER TABLE `groups` MODIFY created_at timestamp NOT NULL DEFAULT current_timestamp()");
    }

    $conn->query(
        "UPDATE payment_records
         SET confirmed_at = NULL, confirmed_by = NULL
         WHERE status IN ('Not Paid', 'Pending')
           AND (confirmed_at IS NOT NULL OR confirmed_by IS NOT NULL)"
    );

    if ($activityTableCreated) {
        seedExistingActivityLogs($conn);
    }
}

function columnExists(mysqli $conn, string $table, string $column): bool
{
    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS total
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?"
    );
    $stmt->bind_param("ss", $table, $column);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return (int) ($row["total"] ?? 0) > 0;
}

function tableExists(mysqli $conn, string $table): bool
{
    $stmt = $conn->prepare(
        "SELECT COUNT(*) AS total
         FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?"
    );
    $stmt->bind_param("s", $table);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return (int) ($row["total"] ?? 0) > 0;
}

function columnInfo(mysqli $conn, string $table, string $column): array
{
    $stmt = $conn->prepare(
        "SELECT IS_NULLABLE, COLUMN_DEFAULT, EXTRA
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?
           AND COLUMN_NAME = ?
         LIMIT 1"
    );
    $stmt->bind_param("ss", $table, $column);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return $row ?: [];
}

function seedExistingActivityLogs(mysqli $conn): void
{
    $conn->query(
        "INSERT INTO activity_logs (user_id, group_id, action, created_at)
         SELECT treasurer_id, group_id, 'group_created', created_at
         FROM `groups`"
    );

    $conn->query(
        "INSERT INTO activity_logs (user_id, group_id, contribution_id, action, created_at)
         SELECT g.treasurer_id, c.group_id, c.contribution_id, 'contribution_created', g.created_at
         FROM contributions c
         INNER JOIN `groups` g ON g.group_id = c.group_id"
    );

    $conn->query(
        "INSERT INTO activity_logs (user_id, group_id, contribution_id, payment_id, action, created_at)
         SELECT pr.user_id, c.group_id, pr.contribution_id, pr.payment_id, 'payment_marked_paid', pr.marked_at
         FROM payment_records pr
         INNER JOIN contributions c ON c.contribution_id = pr.contribution_id
         WHERE pr.status IN ('Pending', 'Paid')"
    );

    $conn->query(
        "INSERT INTO activity_logs (user_id, group_id, contribution_id, payment_id, action, created_at)
         SELECT confirmer.user_id, c.group_id, pr.contribution_id, pr.payment_id, 'payment_confirmed', pr.confirmed_at
         FROM payment_records pr
         INNER JOIN contributions c ON c.contribution_id = pr.contribution_id
         LEFT JOIN users confirmer ON confirmer.user_id = pr.confirmed_by
         WHERE pr.status = 'Paid'
           AND pr.confirmed_at IS NOT NULL"
    );
}
?>
