<?php

if (!class_exists('Database')) {
    require_once __DIR__ . '/../config/database.php';
}
if (!class_exists('AuthMiddleware')) {
    require_once __DIR__ . '/../middleware/auth.php';
}
if (!class_exists('Response')) {
    require_once __DIR__ . '/../utils/response.php';
}
if (!class_exists('EmailAllocationService')) {
    require_once __DIR__ . '/../services/EmailAllocationService.php';
}

class EmailPoolController {

    /**
     * Permission verification:
     * - Admin always allowed
     * - Manager allowed only if allow_manager_access setting is '1'
     * - Others denied
     */
    private function requireAccess() {
        $user = AuthMiddleware::authenticate();
        $isAdmin = !empty($user['isAdmin']) || ($user['role'] ?? '') === 'admin';
        $isManager = ($user['role'] ?? '') === 'manager';

        if ($isAdmin) {
            return $user;
        }

        if ($isManager) {
            $allowManager = EmailAllocationService::getSetting('allow_manager_access', '0');
            if ($allowManager === '1') {
                return $user;
            }
        }

        Response::error('Access denied. Administrator privileges required for Email Pool Manager.', 403);
        exit;
    }

    /**
     * GET /admin/email-pool/stats
     * Return high-level dashboard KPI statistics calculated dynamically.
     */
    public function getStats() {
        $this->requireAccess();
        $pdo = Database::getConnection();

        try {
            // 1. Emails breakdown
            $emails = $pdo->query("
                SELECT 
                    e.id,
                    e.status,
                    e.max_active_deals,
                    COUNT(a.id) as active_deals
                FROM email_pool e
                LEFT JOIN email_pool_allocations a ON e.id = a.email_id AND a.status = 'active'
                GROUP BY e.id
            ")->fetchAll(PDO::FETCH_ASSOC);

            $totalEmails = count($emails);
            $available = 0;
            $partial = 0;
            $full = 0;
            $disabled = 0;
            $totalSlots = 0;

            foreach ($emails as $e) {
                $max = (int)$e['max_active_deals'];
                $used = (int)$e['active_deals'];
                $openSlots = max(0, $max - $used);

                if ($e['status'] === 'disabled') {
                    $disabled++;
                } else {
                    $totalSlots += $openSlots;
                    if ($used === 0) {
                        $available++;
                    } elseif ($used >= $max) {
                        $full++;
                    } else {
                        $partial++;
                    }
                }
            }

            // 2. Active deals total
            $activeDeals = (int)$pdo->query("SELECT COUNT(*) FROM email_pool_allocations WHERE status = 'active'")->fetchColumn();

            // 3. Platform breakdown
            $youtubeBrands = (int)$pdo->query("SELECT COUNT(*) FROM email_pool_brand_accounts WHERE status = 'active'")->fetchColumn();
            $tiktokAccounts = (int)$pdo->query("SELECT COUNT(*) FROM email_pool_allocations WHERE status = 'active' AND platform = 'tiktok'")->fetchColumn();

            Response::json([
                'success' => true,
                'stats' => [
                    'total_emails' => $totalEmails,
                    'available' => $available,
                    'partially_used' => $partial,
                    'full' => $full,
                    'disabled' => $disabled,
                    'active_deals' => $activeDeals,
                    'youtube_brands' => $youtubeBrands,
                    'tiktok_accounts' => $tiktokAccounts,
                    'total_available_slots' => $totalSlots
                ]
            ]);

        } catch (Throwable $e) {
            error_log("EmailPoolController::getStats error: " . $e->getMessage());
            Response::error('Failed to load email pool statistics: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /admin/email-pool
     * List Gmail accounts with real-time calculated counts, search, filtering & sorting.
     */
    public function getEmails() {
        $this->requireAccess();
        $pdo = Database::getConnection();

        $search = trim($_GET['search'] ?? '');
        $statusFilter = trim($_GET['status'] ?? 'all'); // 'all', 'available', 'partial', 'full', 'disabled'
        $platformFilter = trim($_GET['platform'] ?? 'all'); // 'all', 'both', 'youtube', 'tiktok'
        $sortBy = trim($_GET['sort'] ?? 'newest'); // 'newest', 'oldest', 'most_available', 'least_used', 'most_used'

        try {
            $sql = "
                SELECT 
                    e.id,
                    e.email_address,
                    e.status,
                    e.platform,
                    e.max_active_deals,
                    e.max_brand_accounts,
                    e.notes,
                    e.created_at,
                    e.updated_at,
                    COUNT(DISTINCT a.id) as active_deals_count,
                    COUNT(DISTINCT b.id) as active_brands_count,
                    COUNT(DISTINCT CASE WHEN a.platform = 'tiktok' AND a.status = 'active' THEN a.id END) as active_tiktok_count
                FROM email_pool e
                LEFT JOIN email_pool_allocations a ON e.id = a.email_id AND a.status = 'active'
                LEFT JOIN email_pool_brand_accounts b ON e.id = b.email_id AND b.status = 'active'
                WHERE 1=1
            ";

            $params = [];

            if ($search !== '') {
                $sql .= " AND (e.email_address LIKE ? OR e.notes LIKE ?)";
                $params[] = '%' . $search . '%';
                $params[] = '%' . $search . '%';
            }

            if ($platformFilter !== 'all') {
                $sql .= " AND (e.platform = ? OR e.platform = 'both')";
                $params[] = $platformFilter;
            }

            $sql .= " GROUP BY e.id";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Compute dynamic status & slots in PHP
            $list = [];
            foreach ($rows as $r) {
                $maxDeals = (int)$r['max_active_deals'];
                $usedDeals = (int)$r['active_deals_count'];
                $availableSlots = max(0, $maxDeals - $usedDeals);

                $maxBrands = (int)$r['max_brand_accounts'];
                $usedBrands = (int)$r['active_brands_count'];
                $availableBrandSlots = max(0, $maxBrands - $usedBrands);

                if ($r['status'] === 'disabled') {
                    $calculatedStatus = 'disabled';
                } elseif ($usedDeals === 0) {
                    $calculatedStatus = 'available';
                } elseif ($usedDeals >= $maxDeals) {
                    $calculatedStatus = 'full';
                } else {
                    $calculatedStatus = 'partial';
                }

                $r['available_slots'] = $availableSlots;
                $r['available_brand_slots'] = $availableBrandSlots;
                $r['calculated_status'] = $calculatedStatus;

                // Status filter in PHP
                if ($statusFilter !== 'all' && $calculatedStatus !== $statusFilter) {
                    continue;
                }

                $list[] = $r;
            }

            // Sorting
            usort($list, function($a, $b) use ($sortBy) {
                switch ($sortBy) {
                    case 'most_available':
                        return $b['available_slots'] <=> $a['available_slots'];
                    case 'least_used':
                        return $a['active_deals_count'] <=> $b['active_deals_count'];
                    case 'most_used':
                        return $b['active_deals_count'] <=> $a['active_deals_count'];
                    case 'oldest':
                        return $a['id'] <=> $b['id'];
                    case 'newest':
                    default:
                        return $b['id'] <=> $a['id'];
                }
            });

            Response::json([
                'success' => true,
                'total' => count($list),
                'emails' => $list
            ]);

        } catch (Throwable $e) {
            error_log("EmailPoolController::getEmails error: " . $e->getMessage());
            Response::error('Failed to load emails: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /admin/email-pool/{id}
     * Get single Gmail detail with active allocations, brand accounts, and audit log.
     */
    public function getEmailDetails($id) {
        $this->requireAccess();
        $pdo = Database::getConnection();

        try {
            $stmt = $pdo->prepare("SELECT * FROM email_pool WHERE id = ?");
            $stmt->execute([$id]);
            $email = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$email) {
                Response::error('Gmail record not found', 404);
                return;
            }

            // Active & historical allocations
            $allocStmt = $pdo->prepare("
                SELECT 
                    a.*,
                    d.transaction_id,
                    d.channel_title,
                    d.channel_price,
                    u.username as buyer_username
                FROM email_pool_allocations a
                LEFT JOIN deals d ON a.deal_id = d.id
                LEFT JOIN users u ON a.buyer_id = u.id
                WHERE a.email_id = ?
                ORDER BY a.id DESC
            ");
            $allocStmt->execute([$id]);
            $allAllocations = $allocStmt->fetchAll(PDO::FETCH_ASSOC);

            $activeAllocations = [];
            $historicalAllocations = [];
            foreach ($allAllocations as $alloc) {
                if ($alloc['status'] === 'active') {
                    $activeAllocations[] = $alloc;
                } else {
                    $historicalAllocations[] = $alloc;
                }
            }

            // Brand accounts
            $brandStmt = $pdo->prepare("
                SELECT b.*, d.transaction_id, u.username as buyer_username
                FROM email_pool_brand_accounts b
                LEFT JOIN deals d ON b.deal_id = d.id
                LEFT JOIN users u ON b.buyer_id = u.id
                WHERE b.email_id = ?
                ORDER BY b.id DESC
            ");
            $brandStmt->execute([$id]);
            $brandAccounts = $brandStmt->fetchAll(PDO::FETCH_ASSOC);

            // Audit history
            $histStmt = $pdo->prepare("
                SELECT h.*, u.username as admin_username
                FROM email_pool_history h
                LEFT JOIN users u ON h.admin_id = u.id
                WHERE h.email_id = ?
                ORDER BY h.id DESC
                LIMIT 100
            ");
            $histStmt->execute([$id]);
            $history = $histStmt->fetchAll(PDO::FETCH_ASSOC);

            // Dynamic counts
            $maxDeals = (int)$email['max_active_deals'];
            $usedDeals = count($activeAllocations);
            $email['active_deals_count'] = $usedDeals;
            $email['available_slots'] = max(0, $maxDeals - $usedDeals);

            $maxBrands = (int)$email['max_brand_accounts'];
            $activeBrands = 0;
            foreach ($brandAccounts as $b) {
                if ($b['status'] === 'active') $activeBrands++;
            }
            $email['active_brands_count'] = $activeBrands;
            $email['available_brand_slots'] = max(0, $maxBrands - $activeBrands);

            Response::json([
                'success' => true,
                'email' => $email,
                'active_allocations' => $activeAllocations,
                'historical_allocations' => $historicalAllocations,
                'brand_accounts' => $brandAccounts,
                'history' => $history
            ]);

        } catch (Throwable $e) {
            error_log("EmailPoolController::getEmailDetails error: " . $e->getMessage());
            Response::error('Failed to load email details: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /admin/email-pool
     * Add a new Gmail to pool.
     */
    public function addEmail() {
        $admin = $this->requireAccess();
        $pdo = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true);
        $emailAddress = strtolower(trim($input['email_address'] ?? ''));
        $platform = strtolower(trim($input['platform'] ?? 'both'));
        $maxActiveDeals = (int)($input['max_active_deals'] ?? EmailAllocationService::getSetting('default_max_capacity', 5));
        $maxBrandAccounts = (int)($input['max_brand_accounts'] ?? EmailAllocationService::getSetting('default_max_brand_accounts', 5));
        $status = strtolower(trim($input['status'] ?? 'enabled'));
        $notes = trim($input['notes'] ?? '');

        // Validation
        if (!filter_var($emailAddress, FILTER_VALIDATE_EMAIL)) {
            Response::error('Please provide a valid Gmail or email address', 400);
            return;
        }

        if (!in_array($platform, ['both', 'youtube', 'tiktok'])) {
            $platform = 'both';
        }

        if ($maxActiveDeals < 1) $maxActiveDeals = 1;
        if ($maxBrandAccounts < 1) $maxBrandAccounts = 1;
        if (!in_array($status, ['enabled', 'disabled'])) $status = 'enabled';

        try {
            // Check unique
            $checkStmt = $pdo->prepare("SELECT id FROM email_pool WHERE email_address = ?");
            $checkStmt->execute([$emailAddress]);
            if ($checkStmt->fetch()) {
                Response::error('This email address is already registered in the pool', 400);
                return;
            }

            $stmt = $pdo->prepare("
                INSERT INTO email_pool (email_address, status, platform, max_active_deals, max_brand_accounts, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, NOW())
            ");
            $stmt->execute([$emailAddress, $status, $platform, $maxActiveDeals, $maxBrandAccounts, $notes]);
            $emailId = $pdo->lastInsertId();

            // History
            $pdo->prepare("
                INSERT INTO email_pool_history (email_id, admin_id, action, new_value, details, created_at)
                VALUES (?, ?, 'email_added', ?, ?, NOW())
            ")->execute([
                $emailId,
                $admin['id'] ?? null,
                $emailAddress,
                "Capacity: Deals={$maxActiveDeals}, Brands={$maxBrandAccounts}, Platform={$platform}"
            ]);

            Response::json([
                'success' => true,
                'message' => 'Gmail account added successfully to pool',
                'id' => $emailId
            ]);

        } catch (Throwable $e) {
            error_log("EmailPoolController::addEmail error: " . $e->getMessage());
            Response::error('Failed to add email: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PUT /admin/email-pool/{id}
     * Edit Gmail information (email address, platform, notes).
     */
    public function updateEmail($id) {
        $admin = $this->requireAccess();
        $pdo = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true);
        $emailAddress = strtolower(trim($input['email_address'] ?? ''));
        $platform = strtolower(trim($input['platform'] ?? 'both'));
        $notes = trim($input['notes'] ?? '');

        $status = isset($input['status']) && in_array(strtolower(trim($input['status'])), ['enabled', 'disabled']) 
            ? strtolower(trim($input['status'])) 
            : null;

        if (!filter_var($emailAddress, FILTER_VALIDATE_EMAIL)) {
            Response::error('Invalid email address format', 400);
            return;
        }

        if (!in_array($platform, ['both', 'youtube', 'tiktok'])) {
            $platform = 'both';
        }

        try {
            $existing = $pdo->prepare("SELECT * FROM email_pool WHERE id = ?");
            $existing->execute([$id]);
            $row = $existing->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                Response::error('Email record not found', 404);
                return;
            }

            // Check duplicate email if changed
            if ($row['email_address'] !== $emailAddress) {
                $dup = $pdo->prepare("SELECT id FROM email_pool WHERE email_address = ? AND id != ?");
                $dup->execute([$emailAddress, $id]);
                if ($dup->fetch()) {
                    Response::error('Another record is already using this email address', 400);
                    return;
                }
            }

            $targetStatus = $status !== null ? $status : $row['status'];
            $update = $pdo->prepare("UPDATE email_pool SET email_address = ?, platform = ?, status = ?, notes = ?, updated_at = NOW() WHERE id = ?");
            $update->execute([$emailAddress, $platform, $targetStatus, $notes, $id]);

            // History
            $statusChangeNote = ($targetStatus !== $row['status']) ? " Status changed: {$row['status']} -> {$targetStatus}." : "";
            $pdo->prepare("
                INSERT INTO email_pool_history (email_id, admin_id, action, old_value, new_value, details, created_at)
                VALUES (?, ?, 'email_edited', ?, ?, ?, NOW())
            ")->execute([
                $id,
                $admin['id'] ?? null,
                $row['email_address'] . " ({$row['platform']}) [{$row['status']}]",
                $emailAddress . " ({$platform}) [{$targetStatus}]",
                "Updated details.{$statusChangeNote} Notes: " . ($notes ?: 'none')
            ]);

            Response::json(['success' => true, 'message' => 'Email updated successfully']);

        } catch (Throwable $e) {
            error_log("EmailPoolController::updateEmail error: " . $e->getMessage());
            Response::error('Failed to update email: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST/PUT/PATCH /admin/email-pool/{id}/status
     * Enable or disable Gmail.
     */
    public function toggleStatus($id) {
        $admin = $this->requireAccess();
        $pdo = Database::getConnection();

        try {
            $stmt = $pdo->prepare("SELECT * FROM email_pool WHERE id = ?");
            $stmt->execute([$id]);
            $email = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$email) {
                Response::error('Email not found', 404);
                return;
            }

            $input = json_decode(file_get_contents('php://input'), true) ?? [];
            $requestedStatus = isset($input['status']) && in_array(strtolower(trim($input['status'])), ['enabled', 'disabled'])
                ? strtolower(trim($input['status']))
                : null;

            $newStatus = $requestedStatus !== null 
                ? $requestedStatus 
                : (($email['status'] === 'enabled') ? 'disabled' : 'enabled');

            $pdo->prepare("UPDATE email_pool SET status = ?, updated_at = NOW() WHERE id = ?")->execute([$newStatus, $id]);

            // History
            $action = ($newStatus === 'enabled') ? 'email_enabled' : 'email_disabled';
            $pdo->prepare("
                INSERT INTO email_pool_history (email_id, admin_id, action, old_value, new_value, details, created_at)
                VALUES (?, ?, ?, ?, ?, 'Status toggled by staff', NOW())
            ")->execute([
                $id,
                $admin['id'] ?? null,
                $action,
                $email['status'],
                $newStatus
            ]);

            Response::json([
                'success' => true,
                'message' => "Gmail account is now " . ucfirst($newStatus),
                'status' => $newStatus
            ]);

        } catch (Throwable $e) {
            error_log("EmailPoolController::toggleStatus error: " . $e->getMessage());
            Response::error('Failed to toggle status: ' . $e->getMessage(), 500);
        }
    }

    /**
     * PUT /admin/email-pool/{id}/capacity
     * Adjust deal or brand account maximum capacity.
     */
    public function updateCapacity($id) {
        $admin = $this->requireAccess();
        $pdo = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true);
        $maxDeals = isset($input['max_active_deals']) ? (int)$input['max_active_deals'] : null;
        $maxBrands = isset($input['max_brand_accounts']) ? (int)$input['max_brand_accounts'] : null;

        if ($maxDeals !== null && $maxDeals < 1) {
            Response::error('Max active deals must be at least 1', 400);
            return;
        }
        if ($maxBrands !== null && $maxBrands < 1) {
            Response::error('Max brand accounts must be at least 1', 400);
            return;
        }

        try {
            $stmt = $pdo->prepare("SELECT * FROM email_pool WHERE id = ?");
            $stmt->execute([$id]);
            $email = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$email) {
                Response::error('Email not found', 404);
                return;
            }

            $newMaxDeals = $maxDeals !== null ? $maxDeals : (int)$email['max_active_deals'];
            $newMaxBrands = $maxBrands !== null ? $maxBrands : (int)$email['max_brand_accounts'];

            $update = $pdo->prepare("UPDATE email_pool SET max_active_deals = ?, max_brand_accounts = ?, updated_at = NOW() WHERE id = ?");
            $update->execute([$newMaxDeals, $newMaxBrands, $id]);

            // History
            $pdo->prepare("
                INSERT INTO email_pool_history (email_id, admin_id, action, old_value, new_value, details, created_at)
                VALUES (?, ?, 'capacity_changed', ?, ?, 'Admin adjusted limits', NOW())
            ")->execute([
                $id,
                $admin['id'] ?? null,
                "Deals: {$email['max_active_deals']}, Brands: {$email['max_brand_accounts']}",
                "Deals: {$newMaxDeals}, Brands: {$newMaxBrands}"
            ]);

            Response::json([
                'success' => true,
                'message' => 'Capacity updated successfully',
                'max_active_deals' => $newMaxDeals,
                'max_brand_accounts' => $newMaxBrands
            ]);

        } catch (Throwable $e) {
            error_log("EmailPoolController::updateCapacity error: " . $e->getMessage());
            Response::error('Failed to update capacity: ' . $e->getMessage(), 500);
        }
    }


    /**
     * DELETE /admin/email-pool/{id}
     * Delete email with protection against active allocations.
     */
    public function deleteEmail($id) {
        $admin = $this->requireAccess();
        $pdo = Database::getConnection();

        try {
            $stmt = $pdo->prepare("SELECT * FROM email_pool WHERE id = ?");
            $stmt->execute([$id]);
            $email = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$email) {
                Response::error('Email record not found', 404);
                return;
            }

            // CRITICAL CHECK: Restrict deletion if active allocations exist
            $cStmt = $pdo->prepare("SELECT COUNT(*) FROM email_pool_allocations WHERE email_id = ? AND status = 'active'");
            $cStmt->execute([$id]);
            $activeCount = (int)$cStmt->fetchColumn();

            if ($activeCount > 0) {
                Response::error("This email currently has {$activeCount} active allocation(s). You cannot permanently delete it. Please complete or reassign the active deals first, or disable the email.", 400);
                return;
            }

            // Safe delete
            $pdo->beginTransaction();

            $pdo->prepare("DELETE FROM email_pool_brand_accounts WHERE email_id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM email_pool_allocations WHERE email_id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM email_pool_history WHERE email_id = ?")->execute([$id]);
            $pdo->prepare("DELETE FROM email_pool WHERE id = ?")->execute([$id]);

            $pdo->commit();

            Response::json([
                'success' => true,
                'message' => "Gmail {$email['email_address']} permanently removed"
            ]);

        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log("EmailPoolController::deleteEmail error: " . $e->getMessage());
            Response::error('Failed to delete email: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /admin/email-pool/reassign
     * Reassign an active deal from one Gmail to another.
     */
    public function reassignDeal() {
        $admin = $this->requireAccess();
        $input = json_decode(file_get_contents('php://input'), true);

        $dealId = (int)($input['deal_id'] ?? 0);
        $newEmailId = (int)($input['new_email_id'] ?? 0);
        $reason = trim($input['reason'] ?? 'Admin manual reassignment');
        $allowOverride = !empty($input['allow_override']);

        if (!$dealId || !$newEmailId) {
            Response::error('Missing deal ID or new email ID', 400);
            return;
        }

        $res = EmailAllocationService::reassignDeal($dealId, $newEmailId, $admin['id'] ?? null, $reason, $allowOverride);

        if ($res['success']) {
            Response::json($res);
        } else {
            Response::error($res['error'] ?? 'Reassignment failed', 400, $res);
        }
    }

    /**
     * POST /admin/email-pool/assign
     * Manually assign a Gmail to a deal with optional capacity override.
     */
    public function manualAssign() {
        $admin = $this->requireAccess();
        $input = json_decode(file_get_contents('php://input'), true);

        $dealId = (int)($input['deal_id'] ?? 0);
        $emailId = (int)($input['email_id'] ?? 0);
        $allowOverride = !empty($input['allow_override']);

        if (!$dealId || !$emailId) {
            Response::error('Missing deal ID or email ID', 400);
            return;
        }

        $pdo = Database::getConnection();
        $dealStmt = $pdo->prepare("SELECT id, platform_type, channel_title, buyer_id FROM deals WHERE id = ?");
        $dealStmt->execute([$dealId]);
        $deal = $dealStmt->fetch(PDO::FETCH_ASSOC);

        if (!$deal) {
            Response::error('Deal not found', 404);
            return;
        }

        $res = EmailAllocationService::assignEmailToDeal(
            $dealId,
            $deal['platform_type'] ?? 'youtube',
            $deal['channel_title'] ?? '',
            $deal['buyer_id'] ?? 0,
            $emailId,
            $allowOverride,
            $admin['id'] ?? null
        );

        if ($res['success']) {
            Response::json($res);
        } else {
            Response::error($res['error'] ?? 'Manual assignment failed', 400, $res);
        }
    }

    /**
     * GET /admin/email-pool/settings
     */
    public function getSettings() {
        $this->requireAccess();

        $settings = [
            'default_max_capacity' => (int)EmailAllocationService::getSetting('default_max_capacity', 5),
            'default_max_brand_accounts' => (int)EmailAllocationService::getSetting('default_max_brand_accounts', 5),
            'allocation_method' => EmailAllocationService::getSetting('allocation_method', 'least_used'),
            'auto_assignment_enabled' => EmailAllocationService::getSetting('auto_assignment_enabled', '1') === '1',
            'allow_manager_access' => EmailAllocationService::getSetting('allow_manager_access', '0') === '1',
            'low_capacity_threshold' => (int)EmailAllocationService::getSetting('low_capacity_threshold', 1),
            'no_available_email_alert' => EmailAllocationService::getSetting('no_available_email_alert', '1') === '1'
        ];

        Response::json(['success' => true, 'settings' => $settings]);
    }

    /**
     * PUT /admin/email-pool/settings
     */
    public function updateSettings() {
        $this->requireAccess();
        $input = json_decode(file_get_contents('php://input'), true);

        if (isset($input['default_max_capacity'])) {
            EmailAllocationService::setSetting('default_max_capacity', max(1, (int)$input['default_max_capacity']));
        }
        if (isset($input['default_max_brand_accounts'])) {
            EmailAllocationService::setSetting('default_max_brand_accounts', max(1, (int)$input['default_max_brand_accounts']));
        }
        if (isset($input['allocation_method']) && in_array($input['allocation_method'], ['least_used', 'first_available', 'round_robin'])) {
            EmailAllocationService::setSetting('allocation_method', $input['allocation_method']);
        }
        if (isset($input['auto_assignment_enabled'])) {
            EmailAllocationService::setSetting('auto_assignment_enabled', $input['auto_assignment_enabled'] ? '1' : '0');
        }
        if (isset($input['allow_manager_access'])) {
            EmailAllocationService::setSetting('allow_manager_access', $input['allow_manager_access'] ? '1' : '0');
        }
        if (isset($input['low_capacity_threshold'])) {
            EmailAllocationService::setSetting('low_capacity_threshold', max(0, (int)$input['low_capacity_threshold']));
        }
        if (isset($input['no_available_email_alert'])) {
            EmailAllocationService::setSetting('no_available_email_alert', $input['no_available_email_alert'] ? '1' : '0');
        }

        Response::json(['success' => true, 'message' => 'Settings updated successfully']);
    }
}
