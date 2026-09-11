<?php

if (!class_exists('Database')) {
    require_once __DIR__ . '/../config/database.php';
}

class EmailAllocationService {

    /**
     * Get a setting value with fallback default
     */
    public static function getSetting($key, $default = null) {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT setting_value FROM email_pool_settings WHERE setting_key = ?");
            $stmt->execute([$key]);
            $val = $stmt->fetchColumn();
            return $val !== false ? $val : $default;
        } catch (Throwable $e) {
            error_log("EmailAllocationService::getSetting error: " . $e->getMessage());
            return $default;
        }
    }

    /**
     * Set a setting value
     */
    public static function setSetting($key, $value) {
        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("INSERT INTO email_pool_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
            $stmt->execute([$key, (string)$value]);
            return true;
        } catch (Throwable $e) {
            error_log("EmailAllocationService::setSetting error: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Find an available Gmail account based on platform and configured allocation strategy.
     * 
     * @param string $platform 'youtube' | 'tiktok' | 'other'
     * @param bool $isBrandAccount Whether this allocation represents a YouTube Brand Account
     * @return array|null The selected email record or null if none available
     */
    public static function findAvailableEmail($platform = 'youtube', $isBrandAccount = false) {
        $pdo = Database::getConnection();
        $normalizedPlatform = strtolower(trim($platform));

        // Get enabled emails matching platform
        $sql = "
            SELECT 
                e.id,
                e.email_address,
                e.platform,
                e.max_active_deals,
                e.max_brand_accounts,
                COUNT(DISTINCT a.id) as active_deals_count,
                COUNT(DISTINCT b.id) as active_brands_count
            FROM email_pool e
            LEFT JOIN email_pool_allocations a ON e.id = a.email_id AND a.status = 'active'
            LEFT JOIN email_pool_brand_accounts b ON e.id = b.email_id AND b.status = 'active'
            WHERE e.status = 'enabled'
        ";

        $params = [];
        if (in_array($normalizedPlatform, ['youtube', 'tiktok'])) {
            $sql .= " AND (e.platform = 'both' OR e.platform = ?)";
            $params[] = $normalizedPlatform;
        }

        $sql .= " GROUP BY e.id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($candidates)) {
            return null;
        }

        // Filter by capacity
        $eligible = [];
        foreach ($candidates as $c) {
            $activeDeals = (int)$c['active_deals_count'];
            $maxDeals = (int)$c['max_active_deals'];
            $activeBrands = (int)$c['active_brands_count'];
            $maxBrands = (int)$c['max_brand_accounts'];

            $dealSlots = $maxDeals - $activeDeals;
            $brandSlots = $maxBrands - $activeBrands;

            // Must have available deal slots
            if ($dealSlots <= 0) {
                continue;
            }

            // If it's a YouTube Brand Account, must also have available brand slots
            if ($isBrandAccount && $brandSlots <= 0) {
                continue;
            }

            $c['available_deal_slots'] = $dealSlots;
            $c['available_brand_slots'] = $brandSlots;
            $c['utilization_ratio'] = $maxDeals > 0 ? ($activeDeals / $maxDeals) : 1;

            $eligible[] = $c;
        }

        if (empty($eligible)) {
            return null;
        }

        // Apply strategy
        $strategy = self::getSetting('allocation_method', 'least_used');

        if ($strategy === 'least_used') {
            // Sort by lowest utilization ratio, then by most available slots, then id ASC
            usort($eligible, function($a, $b) {
                if ($a['utilization_ratio'] != $b['utilization_ratio']) {
                    return $a['utilization_ratio'] < $b['utilization_ratio'] ? -1 : 1;
                }
                if ($a['available_deal_slots'] != $b['available_deal_slots']) {
                    return $a['available_deal_slots'] > $b['available_deal_slots'] ? -1 : 1;
                }
                return $a['id'] < $b['id'] ? -1 : 1;
            });
            return $eligible[0];

        } elseif ($strategy === 'round_robin') {
            $lastId = (int)self::getSetting('last_allocated_email_id', 0);
            // Look for first eligible email with id > lastId
            foreach ($eligible as $e) {
                if ($e['id'] > $lastId) {
                    self::setSetting('last_allocated_email_id', $e['id']);
                    return $e;
                }
            }
            // If wrapped around, take the first one
            self::setSetting('last_allocated_email_id', $eligible[0]['id']);
            return $eligible[0];

        } else {
            // 'first_available' (ID ASC)
            usort($eligible, function($a, $b) {
                return $a['id'] < $b['id'] ? -1 : 1;
            });
            return $eligible[0];
        }
    }

    /**
     * Atomically assign a Gmail to a deal with row-level locking concurrency protection.
     */
    public static function assignEmailToDeal(
        $dealId,
        $platform = 'youtube',
        $accountTitle = '',
        $buyerId = 0,
        $manualEmailId = null,
        $allowOverride = false,
        $adminId = null
    ) {
        $pdo = Database::getConnection();
        $isBrandAccount = strtolower(trim($platform)) === 'youtube';

        $pdo->beginTransaction();

        try {
            $selectedEmail = null;

            if ($manualEmailId) {
                // Admin manually specified an email
                $stmt = $pdo->prepare("SELECT * FROM email_pool WHERE id = ? FOR UPDATE");
                $stmt->execute([$manualEmailId]);
                $selectedEmail = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$selectedEmail) {
                    $pdo->rollBack();
                    return ['success' => false, 'error' => 'Selected email not found'];
                }

                // Check active count
                $cStmt = $pdo->prepare("SELECT COUNT(*) FROM email_pool_allocations WHERE email_id = ? AND status = 'active'");
                $cStmt->execute([$manualEmailId]);
                $activeCount = (int)$cStmt->fetchColumn();

                if ($activeCount >= (int)$selectedEmail['max_active_deals'] && !$allowOverride) {
                    $pdo->rollBack();
                    return [
                        'success' => false,
                        'capacity_reached' => true,
                        'error' => 'Email has reached maximum capacity (' . $activeCount . '/' . $selectedEmail['max_active_deals'] . '). Override required.'
                    ];
                }
            } else {
                // Auto-assignment
                $autoEnabled = self::getSetting('auto_assignment_enabled', '1');
                if ($autoEnabled !== '1') {
                    $pdo->rollBack();
                    return ['success' => false, 'error' => 'Automatic email assignment is currently disabled in settings'];
                }

                // Find candidate
                $candidate = self::findAvailableEmail($platform, $isBrandAccount);
                if (!$candidate) {
                    $pdo->rollBack();
                    self::triggerNoAvailableEmailAlert($dealId, $platform);
                    return ['success' => false, 'error' => 'No available Gmail accounts in pool with open capacity'];
                }

                // Lock row
                $stmt = $pdo->prepare("SELECT * FROM email_pool WHERE id = ? FOR UPDATE");
                $stmt->execute([$candidate['id']]);
                $selectedEmail = $stmt->fetch(PDO::FETCH_ASSOC);
            }

            // Verify active deal doesn't already have an active allocation
            $checkExisting = $pdo->prepare("SELECT id, email_id FROM email_pool_allocations WHERE deal_id = ? AND status = 'active'");
            $checkExisting->execute([$dealId]);
            $existing = $checkExisting->fetch(PDO::FETCH_ASSOC);

            if ($existing) {
                // Deal already has an active allocation
                if ($existing['email_id'] == $selectedEmail['id']) {
                    $pdo->commit();
                    return ['success' => true, 'email' => $selectedEmail, 'message' => 'Email already assigned to this deal'];
                }
                // Release previous allocation if different
                $pdo->prepare("UPDATE email_pool_allocations SET status = 'reassigned', reassigned_to_email_id = ?, updated_at = NOW() WHERE id = ?")
                    ->execute([$selectedEmail['id'], $existing['id']]);
            }

            // Determine allocation type
            $allocationType = 'deal_general';
            if ($isBrandAccount) {
                $allocationType = 'brand_account';
            } elseif (strtolower(trim($platform)) === 'tiktok') {
                $allocationType = 'tiktok_account';
            }

            // Insert active allocation
            $allocStmt = $pdo->prepare("
                INSERT INTO email_pool_allocations 
                (email_id, deal_id, buyer_id, platform, account_identifier, allocation_type, status, assigned_at)
                VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())
            ");
            $allocStmt->execute([
                $selectedEmail['id'],
                $dealId,
                $buyerId,
                strtolower(trim($platform)),
                $accountTitle ?: 'Asset Deal #' . $dealId,
                $allocationType
            ]);
            $allocationId = $pdo->lastInsertId();

            // If YouTube Brand Account, insert into brand accounts table
            if ($isBrandAccount) {
                $brandStmt = $pdo->prepare("
                    INSERT INTO email_pool_brand_accounts 
                    (email_id, deal_id, buyer_id, brand_name, platform, status, created_at)
                    VALUES (?, ?, ?, ?, 'youtube', 'active', NOW())
                ");
                $brandStmt->execute([
                    $selectedEmail['id'],
                    $dealId,
                    $buyerId,
                    $accountTitle ?: 'Brand Account #' . $dealId
                ]);
            }

            // Update deals table
            $pdo->prepare("UPDATE deals SET assigned_email_id = ?, assigned_email = ?, agent_email_sent = 1, agent_email_sent_at = NOW() WHERE id = ?")
                ->execute([$selectedEmail['id'], $selectedEmail['email_address'], $dealId]);

            // History Log
            $logStmt = $pdo->prepare("
                INSERT INTO email_pool_history 
                (email_id, admin_id, action, new_value, details, created_at)
                VALUES (?, ?, 'deal_assigned', ?, ?, NOW())
            ");
            $details = "Deal #{$dealId} assigned (" . ucfirst($platform) . ": " . ($accountTitle ?: 'Deal #' . $dealId) . ")";
            if ($manualEmailId) {
                $details .= " [Manual Assignment by Admin]";
            }
            $logStmt->execute([$selectedEmail['id'], $adminId, (string)$dealId, $details]);

            $pdo->commit();

            // Check low capacity threshold and warn if needed
            self::checkLowCapacityAlert($selectedEmail['id']);

            return [
                'success' => true,
                'email' => $selectedEmail,
                'allocation_id' => $allocationId
            ];

        } catch (Throwable $e) {
            $pdo->rollBack();
            error_log("assignEmailToDeal error: " . $e->getMessage());
            return ['success' => false, 'error' => 'Database transaction failed: ' . $e->getMessage()];
        }
    }

    /**
     * Release capacity when a deal completes, cancels, or is refunded.
     */
    public static function releaseDealAllocation($dealId, $reason = 'completed', $adminId = null) {
        $pdo = Database::getConnection();

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("SELECT * FROM email_pool_allocations WHERE deal_id = ? AND status = 'active' FOR UPDATE");
            $stmt->execute([$dealId]);
            $allocations = $stmt->fetchAll(PDO::FETCH_ASSOC);

            if (empty($allocations)) {
                $pdo->rollBack();
                return ['success' => true, 'message' => 'No active allocation found to release'];
            }

            foreach ($allocations as $alloc) {
                // Update allocation status
                $pdo->prepare("UPDATE email_pool_allocations SET status = ?, completed_at = NOW(), updated_at = NOW() WHERE id = ?")
                    ->execute([$reason, $alloc['id']]);

                // Update related brand account if applicable
                $brandStatus = ($reason === 'completed') ? 'transferred' : 'removed';
                $pdo->prepare("UPDATE email_pool_brand_accounts SET status = ?, updated_at = NOW() WHERE email_id = ? AND deal_id = ? AND status = 'active'")
                    ->execute([$brandStatus, $alloc['email_id'], $dealId]);

                // History log
                $logStmt = $pdo->prepare("
                    INSERT INTO email_pool_history 
                    (email_id, admin_id, action, old_value, details, created_at)
                    VALUES (?, ?, 'deal_released', ?, ?, NOW())
                ");
                $details = "Deal #{$dealId} capacity released (Status: {$reason})";
                $logStmt->execute([$alloc['email_id'], $adminId, (string)$dealId, $details]);
            }

            $pdo->commit();
            return ['success' => true, 'released_count' => count($allocations)];

        } catch (Throwable $e) {
            $pdo->rollBack();
            error_log("releaseDealAllocation error: " . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Reassign an active deal from one Gmail to another.
     */
    public static function reassignDeal($dealId, $newEmailId, $adminId, $reason, $allowOverride = false) {
        $pdo = Database::getConnection();

        try {
            $pdo->beginTransaction();

            // 1. Fetch current active allocation
            $stmt = $pdo->prepare("SELECT * FROM email_pool_allocations WHERE deal_id = ? AND status = 'active' FOR UPDATE");
            $stmt->execute([$dealId]);
            $currentAlloc = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$currentAlloc) {
                $pdo->rollBack();
                return ['success' => false, 'error' => 'No active allocation found for Deal #' . $dealId];
            }

            if ($currentAlloc['email_id'] == $newEmailId) {
                $pdo->rollBack();
                return ['success' => false, 'error' => 'Deal is already assigned to this Gmail'];
            }

            // 2. Fetch and lock new email
            $newStmt = $pdo->prepare("SELECT * FROM email_pool WHERE id = ? FOR UPDATE");
            $newStmt->execute([$newEmailId]);
            $newEmail = $newStmt->fetch(PDO::FETCH_ASSOC);

            if (!$newEmail) {
                $pdo->rollBack();
                return ['success' => false, 'error' => 'Target Gmail account not found'];
            }

            if ($newEmail['status'] !== 'enabled') {
                $pdo->rollBack();
                return ['success' => false, 'error' => 'Target Gmail account is currently disabled'];
            }

            // 3. Check capacity on new email
            $countStmt = $pdo->prepare("SELECT COUNT(*) FROM email_pool_allocations WHERE email_id = ? AND status = 'active'");
            $countStmt->execute([$newEmailId]);
            $newActiveCount = (int)$countStmt->fetchColumn();

            if ($newActiveCount >= (int)$newEmail['max_active_deals'] && !$allowOverride) {
                $pdo->rollBack();
                return [
                    'success' => false,
                    'capacity_reached' => true,
                    'error' => "Target email has reached capacity ({$newActiveCount}/{$newEmail['max_active_deals']}). Override confirmation required."
                ];
            }

            // 4. Mark old allocation as reassigned
            $oldEmailId = $currentAlloc['email_id'];
            $pdo->prepare("
                UPDATE email_pool_allocations 
                SET status = 'reassigned', 
                    completed_at = NOW(), 
                    reassigned_to_email_id = ?, 
                    reassignment_reason = ?, 
                    updated_at = NOW() 
                WHERE id = ?
            ")->execute([$newEmailId, $reason, $currentAlloc['id']]);

            // Release old brand account if any
            $pdo->prepare("UPDATE email_pool_brand_accounts SET status = 'transferred', updated_at = NOW() WHERE email_id = ? AND deal_id = ? AND status = 'active'")
                ->execute([$oldEmailId, $dealId]);

            // 5. Create new allocation
            $allocStmt = $pdo->prepare("
                INSERT INTO email_pool_allocations 
                (email_id, deal_id, buyer_id, platform, account_identifier, allocation_type, status, assigned_at)
                VALUES (?, ?, ?, ?, ?, ?, 'active', NOW())
            ");
            $allocStmt->execute([
                $newEmailId,
                $dealId,
                $currentAlloc['buyer_id'],
                $currentAlloc['platform'],
                $currentAlloc['account_identifier'],
                $currentAlloc['allocation_type']
            ]);

            // If brand account, create new brand account entry
            if ($currentAlloc['allocation_type'] === 'brand_account') {
                $pdo->prepare("
                    INSERT INTO email_pool_brand_accounts 
                    (email_id, deal_id, buyer_id, brand_name, platform, status, created_at)
                    VALUES (?, ?, ?, ?, 'youtube', 'active', NOW())
                ")->execute([
                    $newEmailId,
                    $dealId,
                    $currentAlloc['buyer_id'],
                    $currentAlloc['account_identifier']
                ]);
            }

            // 6. Update deals table
            $pdo->prepare("UPDATE deals SET assigned_email_id = ?, assigned_email = ?, updated_at = NOW() WHERE id = ?")
                ->execute([$newEmailId, $newEmail['email_address'], $dealId]);

            // 7. Audit History Logs for both old & new email
            $pdo->prepare("
                INSERT INTO email_pool_history 
                (email_id, admin_id, action, old_value, new_value, details, created_at)
                VALUES (?, ?, 'deal_reassigned', ?, ?, ?, NOW())
            ")->execute([
                $oldEmailId,
                $adminId,
                "Deal #{$dealId} (to {$newEmail['email_address']})",
                "Reassigned",
                "Reason: {$reason}"
            ]);

            $pdo->prepare("
                INSERT INTO email_pool_history 
                (email_id, admin_id, action, old_value, new_value, details, created_at)
                VALUES (?, ?, 'deal_assigned', 'Reassigned from other Gmail', ?, ?, NOW())
            ")->execute([
                $newEmailId,
                $adminId,
                "Deal #{$dealId}",
                "Reassigned from previous email. Reason: {$reason}"
            ]);

            $pdo->commit();

            return [
                'success' => true,
                'message' => "Deal #{$dealId} successfully reassigned to {$newEmail['email_address']}",
                'new_email' => $newEmail
            ];

        } catch (Throwable $e) {
            $pdo->rollBack();
            error_log("reassignDeal error: " . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Check if an email has dropped to or below the low capacity alert threshold.
     */
    private static function checkLowCapacityAlert($emailId) {
        try {
            $threshold = (int)self::getSetting('low_capacity_threshold', 1);
            $pdo = Database::getConnection();

            $stmt = $pdo->prepare("
                SELECT e.email_address, e.max_active_deals, COUNT(a.id) as active_count
                FROM email_pool e
                LEFT JOIN email_pool_allocations a ON e.id = a.email_id AND a.status = 'active'
                WHERE e.id = ?
                GROUP BY e.id
            ");
            $stmt->execute([$emailId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                $available = (int)$row['max_active_deals'] - (int)$row['active_count'];
                if ($available <= $threshold) {
                    // Send admin notification
                    $adminUsers = $pdo->query("SELECT id FROM users WHERE isAdmin = 1 OR role = 'admin'")->fetchAll(PDO::FETCH_COLUMN);
                    $notifStmt = $pdo->prepare("
                        INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                        VALUES (?, 'system', 'Email Pool: Low Capacity Warning ⚠️', ?, '/admin-dashboard', 0, NOW())
                    ");
                    $msg = "Gmail {$row['email_address']} has only {$available} slot(s) remaining ({$row['active_count']}/{$row['max_active_deals']}).";
                    foreach ($adminUsers as $adminId) {
                        $notifStmt->execute([$adminId, $msg]);
                    }
                }
            }
        } catch (Throwable $e) {
            error_log("checkLowCapacityAlert error: " . $e->getMessage());
        }
    }

    /**
     * Trigger alert when all Gmail accounts in pool are full or disabled.
     */
    private static function triggerNoAvailableEmailAlert($dealId, $platform) {
        try {
            $alertEnabled = self::getSetting('no_available_email_alert', '1');
            if ($alertEnabled !== '1') return;

            $pdo = Database::getConnection();
            $adminUsers = $pdo->query("SELECT id FROM users WHERE isAdmin = 1 OR role = 'admin'")->fetchAll(PDO::FETCH_COLUMN);
            $notifStmt = $pdo->prepare("
                INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                VALUES (?, 'system', '⚠️ Email Pool Exhausted — Action Required', ?, '/admin-dashboard', 0, NOW())
            ");
            $msg = "No eligible Gmail accounts available in pool for Deal #{$dealId} (" . ucfirst($platform) . "). All emails are full or disabled. Please add an email or expand capacity.";
            foreach ($adminUsers as $adminId) {
                $notifStmt->execute([$adminId, $msg]);
            }
        } catch (Throwable $e) {
            error_log("triggerNoAvailableEmailAlert error: " . $e->getMessage());
        }
    }
}
