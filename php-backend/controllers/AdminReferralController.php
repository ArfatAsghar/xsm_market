<?php
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../services/ReferralService.php';
require_once __DIR__ . '/../utils/Response.php';

class AdminReferralController {

    private function checkAdmin() {
        $admin = AuthMiddleware::protect();
        if (($admin['role'] ?? '') !== 'admin' && ($admin['role'] ?? '') !== 'manager' && empty($admin['isAdmin'])) {
            Response::error('Access denied', 403);
            exit;
        }
        return $admin;
    }

    /**
     * GET /api/admin/referrals/stats
     */
    public function getStats() {
        $this->checkAdmin();
        $pdo = Database::getConnection();

        try {
            $stmt = $pdo->query("
                SELECT 
                    COUNT(*) as total_referrals,
                    SUM(CASE WHEN status = 'registered' THEN 1 ELSE 0 END) as registered_count,
                    SUM(CASE WHEN status = 'kyc_pending' THEN 1 ELSE 0 END) as kyc_pending_count,
                    SUM(CASE WHEN status IN ('qualified', 'vip_active') THEN 1 ELSE 0 END) as qualified_count,
                    SUM(CASE WHEN status = 'vip_active' THEN 1 ELSE 0 END) as vip_count,
                    SUM(CASE WHEN is_suspicious = 1 THEN 1 ELSE 0 END) as suspicious_count
                FROM referrals
            ");
            $refStats = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : [];

            // Credit stats
            $credStats = [];
            try {
                $credStmt = $pdo->query("
                    SELECT 
                        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits_issued,
                        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_credits_used
                    FROM referral_credit_transactions
                ");
                if ($credStmt) {
                    $credStats = $credStmt->fetch(PDO::FETCH_ASSOC);
                }
            } catch (Throwable $e) {
                // Table may be empty or not yet created
            }

            // Pending KYC Count
            $pendingKycCount = 0;
            try {
                $pendingKycStmt = $pdo->query("SELECT COUNT(*) FROM user_kyc WHERE status = 'pending'");
                if ($pendingKycStmt) {
                    $pendingKycCount = (int)$pendingKycStmt->fetchColumn();
                }
            } catch (Throwable $e) {
                // Ignore
            }

            $totalReferrals = (int)($refStats['total_referrals'] ?? 0);
            $registeredCount = (int)($refStats['registered_count'] ?? 0);
            $kycPendingCount = (int)($refStats['kyc_pending_count'] ?? 0);
            $qualifiedCount = (int)($refStats['qualified_count'] ?? 0);
            $vipCount = (int)($refStats['vip_count'] ?? 0);
            $suspiciousCount = (int)($refStats['suspicious_count'] ?? 0);
            $creditsIssued = floatval($credStats['total_credits_issued'] ?? 0);
            $creditsUsed = floatval($credStats['total_credits_used'] ?? 0);

            Response::json([
                'success' => true,
                'data' => [
                    // snake_case
                    'total_referrals' => $totalReferrals,
                    'registered_count' => $registeredCount,
                    'kyc_pending_count' => $kycPendingCount,
                    'qualified_referrals' => $qualifiedCount,
                    'vip_conversions' => $vipCount,
                    'flagged_referrals' => $suspiciousCount,
                    'total_credits_issued' => $creditsIssued,
                    'total_credits_used' => $creditsUsed,
                    'pending_kyc_count' => $pendingKycCount,

                    // camelCase
                    'totalReferrals' => $totalReferrals,
                    'registered' => $registeredCount,
                    'kycPending' => $kycPendingCount,
                    'qualified' => $qualifiedCount,
                    'vipConversions' => $vipCount,
                    'suspiciousCount' => $suspiciousCount,
                    'creditsIssued' => $creditsIssued,
                    'creditsUsed' => $creditsUsed,
                    'pendingKycCount' => $pendingKycCount
                ]
            ]);
        } catch (Throwable $e) {
            error_log('Admin referral stats error: ' . $e->getMessage());
            Response::error('Failed to load referral stats', 500);
        }
    }

    /**
     * GET /api/admin/referrals/list
     */
    public function getList() {
        $this->checkAdmin();
        $pdo = Database::getConnection();

        $page = max(1, intval($_GET['page'] ?? 1));
        $limit = max(1, min(100, intval($_GET['limit'] ?? 50)));
        $offset = ($page - 1) * $limit;
        $status = trim($_GET['status'] ?? 'all');
        $search = trim($_GET['search'] ?? '');

        try {
            $sql = "
                SELECT 
                    r.*,
                    u_ref.username as referrer_username,
                    u_ref.email as referrer_email,
                    u_rec.username as referred_username,
                    u_rec.email as referred_email,
                    u_rec.kyc_status as referred_kyc_status,
                    u_rec.vipUntil as referred_vip_until
                FROM referrals r
                LEFT JOIN users u_ref ON r.referrer_id = u_ref.id
                LEFT JOIN users u_rec ON r.referred_user_id = u_rec.id
                WHERE 1=1
            ";
            $params = [];

            if ($status !== 'all' && !empty($status)) {
                $sql .= " AND r.status = :status";
                $params[':status'] = $status;
            }

            if (!empty($search)) {
                $sql .= " AND (u_ref.username LIKE :search OR u_rec.username LIKE :search OR u_ref.email LIKE :search OR u_rec.email LIKE :search)";
                $params[':search'] = "%{$search}%";
            }

            // Count total
            $countSql = preg_replace('/SELECT r\.\*.*?FROM/s', 'SELECT COUNT(*) FROM', $sql);
            $countStmt = $pdo->prepare($countSql);
            $countStmt->execute($params);
            $total = (int)$countStmt->fetchColumn();

            // Fetch records
            $sql .= " ORDER BY r.created_at DESC LIMIT :limit OFFSET :offset";
            $stmt = $pdo->prepare($sql);
            foreach ($params as $k => $v) {
                $stmt->bindValue($k, $v);
            }
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
            $stmt->execute();
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $data = [];
            foreach ($rows as $r) {
                $isVip = !empty($r['referred_vip_until']) && strtotime($r['referred_vip_until']) > time();
                $refUsername = !empty($r['referrer_username']) ? $r['referrer_username'] : (!empty($r['referrer_id']) ? ('User #' . $r['referrer_id']) : 'Unknown');
                $recUsername = !empty($r['referred_username']) ? $r['referred_username'] : (!empty($r['referred_user_id']) ? ('User #' . $r['referred_user_id']) : 'Unknown');
                $kycStatus = !empty($r['referred_kyc_status']) ? $r['referred_kyc_status'] : 'none';
                $isFlagged = !empty($r['is_suspicious']);
                $createdAt = $r['created_at'] ?? '';
                $updatedAt = $r['updated_at'] ?? '';

                $data[] = [
                    'id' => (int)$r['id'],
                    // snake_case
                    'referrer_id' => (int)($r['referrer_id'] ?? 0),
                    'referrer_username' => $refUsername,
                    'referrer_email' => $r['referrer_email'] ?? '',
                    'referred_user_id' => (int)($r['referred_user_id'] ?? 0),
                    'referred_username' => $recUsername,
                    'referred_email' => $r['referred_email'] ?? '',
                    'referral_code' => $r['referral_code'] ?? '',
                    'status' => $r['status'] ?? 'registered',
                    'kyc_status' => $kycStatus,
                    'vip_status' => $isVip,
                    'is_flagged' => $isFlagged,
                    'flag_reason' => $r['suspicious_reason'] ?? '',
                    'ip_address' => $r['ip_address'] ?? '',
                    'created_at' => $createdAt,
                    'updated_at' => $updatedAt,

                    // camelCase
                    'referrerId' => (int)($r['referrer_id'] ?? 0),
                    'referrerUsername' => $refUsername,
                    'referrerEmail' => $r['referrer_email'] ?? '',
                    'referredUserId' => (int)($r['referred_user_id'] ?? 0),
                    'referredUsername' => $recUsername,
                    'referredEmail' => $r['referred_email'] ?? '',
                    'referralCode' => $r['referral_code'] ?? '',
                    'kycStatus' => $kycStatus,
                    'isVip' => $isVip,
                    'kycRewardGranted' => (bool)($r['kyc_reward_granted'] ?? false),
                    'vipRewardGranted' => (bool)($r['vip_reward_granted'] ?? false),
                    'isSuspicious' => $isFlagged,
                    'suspiciousReason' => $r['suspicious_reason'] ?? '',
                    'ipAddress' => $r['ip_address'] ?? '',
                    'createdAt' => $createdAt,
                    'updatedAt' => $updatedAt
                ];
            }

            Response::json([
                'success' => true,
                'data' => $data,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'totalPages' => ceil($total / $limit)
                ]
            ]);
        } catch (Throwable $e) {
            error_log('Admin get referrals list error: ' . $e->getMessage());
            Response::error('Failed to load referrals list', 500);
        }
    }

    /**
     * POST /api/admin/referrals/adjust-credit
     * Manually add or deduct user referral credit
     */
    public function adjustCredit() {
        $admin = $this->checkAdmin();
        $pdo = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true);
        $userId = intval($input['userId'] ?? $input['user_id'] ?? 0);
        $amount = floatval($input['amount'] ?? 0);
        $reason = trim($input['reason'] ?? 'Admin adjustment');

        if (!$userId || $amount == 0) {
            Response::error('Valid userId and non-zero amount required', 400);
            return;
        }

        try {
            $stmt = $pdo->prepare("SELECT referral_credit_balance FROM users WHERE id = ? FOR UPDATE");
            $stmt->execute([$userId]);
            $currentBal = floatval($stmt->fetchColumn() ?: 0);

            $newBal = $currentBal + $amount;
            if ($newBal < 0) {
                Response::error("Cannot reduce balance below 0. Current balance is {$currentBal}", 400);
                return;
            }

            $pdo->prepare("UPDATE users SET referral_credit_balance = ? WHERE id = ?")->execute([$newBal, $userId]);

            $pdo->prepare("
                INSERT INTO referral_credit_transactions (user_id, amount, balance_after, type, description, created_at)
                VALUES (?, ?, ?, 'admin_adjustment', ?, NOW())
            ")->execute([
                $userId,
                $amount,
                $newBal,
                "Admin adjustment: {$reason} (by Admin #{$admin['id']})"
            ]);

            Response::json([
                'success' => true,
                'message' => 'Credit balance adjusted successfully',
                'newBalance' => $newBal
            ]);
        } catch (Throwable $e) {
            error_log('Admin adjust credit error: ' . $e->getMessage());
            Response::error('Failed to adjust credit: ' . $e->getMessage(), 500);
        }
    }

    /**
     * POST /api/admin/referrals/toggle-flag
     */
    public function toggleFlag() {
        $this->checkAdmin();
        $pdo = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true);
        $referralId = intval($input['referralId'] ?? $input['id'] ?? 0);
        $reason = trim($input['reason'] ?? 'Flagged by administrator');

        if (!$referralId) {
            Response::error('Valid referralId required', 400);
            return;
        }

        try {
            $stmt = $pdo->prepare("SELECT is_suspicious FROM referrals WHERE id = ?");
            $stmt->execute([$referralId]);
            $current = $stmt->fetchColumn();

            if ($current === false) {
                Response::error('Referral not found', 404);
                return;
            }

            $newStatus = $current ? 0 : 1;
            $pdo->prepare("
                UPDATE referrals 
                SET is_suspicious = ?, suspicious_reason = ?, updated_at = NOW() 
                WHERE id = ?
            ")->execute([$newStatus, $newStatus ? $reason : null, $referralId]);

            Response::json([
                'success' => true,
                'isSuspicious' => (bool)$newStatus,
                'is_flagged' => (bool)$newStatus,
                'message' => $newStatus ? 'Referral flagged as suspicious' : 'Suspicious flag cleared'
            ]);
        } catch (Throwable $e) {
            error_log('Admin toggle flag error: ' . $e->getMessage());
            Response::error('Failed to toggle flag', 500);
        }
    }

    /**
     * POST /api/admin/referrals/revoke
     */
    public function revoke() {
        $this->checkAdmin();
        $pdo = Database::getConnection();

        $input = json_decode(file_get_contents('php://input'), true);
        $referralId = intval($input['referralId'] ?? $input['id'] ?? 0);
        $reason = trim($input['reason'] ?? 'Revoked due to fraud');

        if (!$referralId) {
            Response::error('Valid referralId required', 400);
            return;
        }

        try {
            $pdo->beginTransaction();

            $stmt = $pdo->prepare("SELECT * FROM referrals WHERE id = ? FOR UPDATE");
            $stmt->execute([$referralId]);
            $ref = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$ref) {
                $pdo->rollBack();
                Response::error('Referral not found', 404);
                return;
            }

            // Revoke active user_rewards linked to this referral
            $pdo->prepare("
                UPDATE user_rewards 
                SET status = 'revoked' 
                WHERE source_referral_id = ?
            ")->execute([$referralId]);

            // Update referral status to rejected
            $pdo->prepare("
                UPDATE referrals 
                SET status = 'rejected', is_suspicious = 1, suspicious_reason = ?, updated_at = NOW() 
                WHERE id = ?
            ")->execute(["Revoked: {$reason}", $referralId]);

            $pdo->commit();

            Response::json([
                'success' => true,
                'message' => 'Referral and associated rewards revoked successfully'
            ]);
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Admin revoke referral error: ' . $e->getMessage());
            Response::error('Failed to revoke referral', 500);
        }
    }

    /**
     * GET /api/admin/referrals/settings
     */
    public function getSettings() {
        $this->checkAdmin();
        try {
            $raw = ReferralService::getAllSettings();
            $settings = [
                'free_pin_count' => intval($raw['kyc_pin_reward'] ?? $raw['free_pin_count'] ?? 1),
                'free_pin_duration_hours' => intval($raw['pin_duration_hours'] ?? $raw['free_pin_duration_hours'] ?? 72),
                'vip_credit_amount' => floatval($raw['vip_credit_amount'] ?? 1.00),
                'vip_coupon_amount' => floatval($raw['vip_coupon_amount'] ?? 2.00),
                'vip_free_bumps' => intval($raw['vip_free_bumps'] ?? 5),
                'reduced_escrow_deals_count' => intval($raw['reduced_fee_deals_count'] ?? $raw['reduced_escrow_deals_count'] ?? 3),
                'reduced_escrow_percent' => intval($raw['reduced_escrow_percent'] ?? 20),
                // Raw DB keys
                'kyc_pin_reward' => intval($raw['kyc_pin_reward'] ?? 1),
                'pin_duration_hours' => intval($raw['pin_duration_hours'] ?? 72),
                'reduced_fee_deals_count' => intval($raw['reduced_fee_deals_count'] ?? 3)
            ];
            Response::json([
                'success' => true,
                'data' => $settings
            ]);
        } catch (Throwable $e) {
            error_log('Admin get referral settings error: ' . $e->getMessage());
            Response::error('Failed to load settings', 500);
        }
    }

    /**
     * POST /api/admin/referrals/settings
     */
    public function updateSettings() {
        $this->checkAdmin();
        $input = json_decode(file_get_contents('php://input'), true);
        if (!is_array($input)) {
            Response::error('Settings object required', 400);
            return;
        }

        try {
            // Map frontend key names to DB keys
            if (isset($input['free_pin_count'])) $input['kyc_pin_reward'] = $input['free_pin_count'];
            if (isset($input['free_pin_duration_hours'])) $input['pin_duration_hours'] = $input['free_pin_duration_hours'];
            if (isset($input['reduced_escrow_deals_count'])) $input['reduced_fee_deals_count'] = $input['reduced_escrow_deals_count'];

            ReferralService::updateSettings($input);
            Response::json([
                'success' => true,
                'message' => 'Referral settings updated successfully'
            ]);
        } catch (Throwable $e) {
            error_log('Admin update referral settings error: ' . $e->getMessage());
            Response::error('Failed to update settings', 500);
        }
    }
}
