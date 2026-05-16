<?php
/**
 * Normalizes participant payment rows.
 * The treasurer is also a group participant, so every contribution should have
 * one payment record for every group member, including the treasurer.
 */

function ensureTreasurerMembership(mysqli $conn, int $groupId): void
{
    $role = "Treasurer";
    $stmt = $conn->prepare(
        "INSERT INTO group_members (user_id, group_id, role)
         SELECT g.treasurer_id, g.group_id, ?
         FROM `groups` g
         WHERE g.group_id = ?
           AND g.treasurer_id IS NOT NULL
           AND NOT EXISTS (
             SELECT 1
             FROM group_members gm
             WHERE gm.group_id = g.group_id
               AND gm.user_id = g.treasurer_id
           )"
    );
    $stmt->bind_param("si", $role, $groupId);
    $stmt->execute();
    $stmt->close();
}

function ensurePaymentRecordsForGroup(mysqli $conn, int $groupId, ?int $contributionId = null): void
{
    ensureTreasurerMembership($conn, $groupId);

    if ($contributionId !== null && $contributionId > 0) {
        $stmt = $conn->prepare(
            "INSERT INTO payment_records (user_id, contribution_id, status, confirmed_at, confirmed_by)
             SELECT gm.user_id,
                    c.contribution_id,
                    CASE
                        WHEN gm.user_id = g.treasurer_id OR LOWER(gm.role) = 'treasurer' THEN 'Paid'
                        ELSE 'Not Paid'
                    END,
                    CASE
                        WHEN gm.user_id = g.treasurer_id OR LOWER(gm.role) = 'treasurer' THEN NOW()
                        ELSE NULL
                    END,
                    CASE
                        WHEN gm.user_id = g.treasurer_id OR LOWER(gm.role) = 'treasurer' THEN gm.user_id
                        ELSE NULL
                    END
             FROM group_members gm
             INNER JOIN contributions c ON c.group_id = gm.group_id
             INNER JOIN `groups` g ON g.group_id = gm.group_id
             WHERE gm.group_id = ?
               AND c.contribution_id = ?
               AND NOT EXISTS (
                 SELECT 1
                 FROM payment_records pr
                 WHERE pr.user_id = gm.user_id
                   AND pr.contribution_id = c.contribution_id
               )"
        );
        $stmt->bind_param("ii", $groupId, $contributionId);
        $stmt->execute();
        $stmt->close();
        normalizeTreasurerPaymentRecords($conn, $groupId, $contributionId);
        return;
    }

    $stmt = $conn->prepare(
        "INSERT INTO payment_records (user_id, contribution_id, status, confirmed_at, confirmed_by)
         SELECT gm.user_id,
                c.contribution_id,
                CASE
                    WHEN gm.user_id = g.treasurer_id OR LOWER(gm.role) = 'treasurer' THEN 'Paid'
                    ELSE 'Not Paid'
                END,
                CASE
                    WHEN gm.user_id = g.treasurer_id OR LOWER(gm.role) = 'treasurer' THEN NOW()
                    ELSE NULL
                END,
                CASE
                    WHEN gm.user_id = g.treasurer_id OR LOWER(gm.role) = 'treasurer' THEN gm.user_id
                    ELSE NULL
                END
         FROM group_members gm
         INNER JOIN contributions c ON c.group_id = gm.group_id
         INNER JOIN `groups` g ON g.group_id = gm.group_id
         WHERE gm.group_id = ?
           AND NOT EXISTS (
             SELECT 1
             FROM payment_records pr
             WHERE pr.user_id = gm.user_id
               AND pr.contribution_id = c.contribution_id
           )"
    );
    $stmt->bind_param("i", $groupId);
    $stmt->execute();
    $stmt->close();

    normalizeTreasurerPaymentRecords($conn, $groupId);
}

function normalizeTreasurerPaymentRecords(mysqli $conn, int $groupId, ?int $contributionId = null): void
{
    if ($contributionId !== null && $contributionId > 0) {
        $stmt = $conn->prepare(
            "UPDATE payment_records pr
             INNER JOIN contributions c ON c.contribution_id = pr.contribution_id
             INNER JOIN `groups` g ON g.group_id = c.group_id
             INNER JOIN group_members gm ON gm.group_id = c.group_id AND gm.user_id = pr.user_id
             SET pr.status = 'Paid',
                 pr.confirmed_at = COALESCE(pr.confirmed_at, NOW()),
                 pr.confirmed_by = COALESCE(pr.confirmed_by, pr.user_id)
             WHERE c.group_id = ?
               AND c.contribution_id = ?
               AND (pr.user_id = g.treasurer_id OR LOWER(gm.role) = 'treasurer')"
        );
        $stmt->bind_param("ii", $groupId, $contributionId);
        $stmt->execute();
        $stmt->close();
        return;
    }

    $stmt = $conn->prepare(
        "UPDATE payment_records pr
         INNER JOIN contributions c ON c.contribution_id = pr.contribution_id
         INNER JOIN `groups` g ON g.group_id = c.group_id
         INNER JOIN group_members gm ON gm.group_id = c.group_id AND gm.user_id = pr.user_id
         SET pr.status = 'Paid',
             pr.confirmed_at = COALESCE(pr.confirmed_at, NOW()),
             pr.confirmed_by = COALESCE(pr.confirmed_by, pr.user_id)
         WHERE c.group_id = ?
           AND (pr.user_id = g.treasurer_id OR LOWER(gm.role) = 'treasurer')"
    );
    $stmt->bind_param("i", $groupId);
    $stmt->execute();
    $stmt->close();
}

function findOwnPaymentRecord(mysqli $conn, int $userId, int $contributionId): ?array
{
    $stmt = $conn->prepare(
        "SELECT pr.payment_id, pr.user_id, pr.contribution_id, c.group_id
         FROM payment_records pr
         INNER JOIN contributions c ON c.contribution_id = pr.contribution_id
         WHERE pr.user_id = ?
           AND pr.contribution_id = ?
         ORDER BY pr.payment_id ASC
         LIMIT 1"
    );
    $stmt->bind_param("ii", $userId, $contributionId);
    $stmt->execute();
    $payment = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return $payment ?: null;
}
