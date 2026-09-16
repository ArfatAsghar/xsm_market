<?php
require_once __DIR__ . '/../config/database.php';

class ReferralService {

    /**
     * Get a referral setting value
     */
    public static function getSetting($key, $default = null) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT setting_value FROM referral_settings WHERE setting_key = ?");
        $stmt->execute([$key]);
        $val = $stmt->fetchColumn();
        return $val !== false ? $val : $default;
    }

    /**
     * Get all referral settings
     */
    public static function getAllSettings() {
        $pdo = Database::getConnection();
        $stmt = $pdo->query("SELECT setting_key, setting_value, description FROM referral_settings");
        $settings = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $settings[$row['setting_key']] = $row['setting_value'];
        }
        return $settings;
    }

    /**
     * Update referral settings (Admin)
     */
    public static function updateSettings($settings) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            INSERT INTO referral_settings (setting_key, setting_value) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
        ");
        foreach ($settings as $key => $val) {
            $stmt->execute([$key, (string)$val]);
        }
        return true;
    }

    /**
     * Record a new referral when User B registers with User A's referral code / username
     */
    public static function recordReferral($referredUserId, $referralCode, $ip = null) {
        if (empty($referralCode) || empty($referredUserId)) {
            return false;
        }

        $pdo = Database::getConnection();
        $cleanCode = trim($referralCode);

        // Find referrer by username or referral_code
        $stmt = $pdo->prepare("SELECT id, username, email FROM users WHERE (username = ? OR referral_code = ?) LIMIT 1");
        $stmt->execute([$cleanCode, $cleanCode]);
        $referrer = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$referrer) {
            return false;
        }

        $referrerId = (int)$referrer['id'];

        // Anti-fraud: prevent self-referral
        if ($referrerId === (int)$referredUserId) {
            return false;
        }

        // Check if referred user already has a referral record
        $checkStmt = $pdo->prepare("SELECT id FROM referrals WHERE referred_user_id = ?");
        $checkStmt->execute([$referredUserId]);
        if ($checkStmt->fetch()) {
            return false; // Already referred
        }

        // Check for suspicious signs (same IP address)
        // Wrapped in try-catch: columns lastLoginIp/registrationIp may not exist yet.
        $isSuspicious = 0;
        $suspiciousReason = null;
        if (!empty($ip)) {
            try {
                $ipStmt = $pdo->prepare("SELECT id FROM users WHERE id = ? AND (lastLoginIp = ? OR registrationIp = ?)");
                $ipStmt->execute([$referrerId, $ip, $ip]);
                if ($ipStmt->fetch()) {
                    $isSuspicious = 1;
                    $suspiciousReason = "Same IP address detected as referrer ($ip)";
                }
            } catch (Throwable $ipErr) {
                // Column may not exist — non-fatal, continue without IP fraud check
                error_log('Referral IP fraud check skipped (column may be missing): ' . $ipErr->getMessage());
            }
        }

        // Update referred_by in users table
        $pdo->prepare("UPDATE users SET referred_by = ? WHERE id = ?")->execute([$referrerId, $referredUserId]);

        // Insert referral record
        $insertStmt = $pdo->prepare("
            INSERT INTO referrals (
                referrer_id, referred_user_id, referral_code, status, 
                is_suspicious, suspicious_reason, ip_address, created_at, updated_at
            ) VALUES (?, ?, ?, 'registered', ?, ?, ?, NOW(), NOW())
        ");
        $insertStmt->execute([
            $referrerId,
            $referredUserId,
            $cleanCode,
            $isSuspicious,
            $suspiciousReason,
            $ip
        ]);

        $referralId = $pdo->lastInsertId();

        // In-app notification for referrer: New referral joined!
        try {
            $pdo->prepare("
                INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                VALUES (?, 'referral', 'New Referral Joined! 👥', 'A new user registered using your referral link. Once they complete KYC verification, both of you will receive 1 Free Pin (72h)!', '/referral', 0, NOW())
            ")->execute([$referrerId]);
        } catch (Throwable $e) {
            error_log('Referral notification error: ' . $e->getMessage());
        }

        return $referralId;
    }

    /**
     * Qualify referral on KYC approval
     * User A (referrer) and User B (referred) both receive 1 Free Pin (valid for 72 hours)
     */
    public static function qualifyReferral($userId) {
        $pdo = Database::getConnection();

        // Find referral record where this user is the referred user
        $stmt = $pdo->prepare("SELECT * FROM referrals WHERE referred_user_id = ? LIMIT 1");
        $stmt->execute([$userId]);
        $referral = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$referral) {
            return false; // User was not referred by anyone
        }

        if ($referral['status'] === 'qualified' || $referral['kyc_reward_granted']) {
            return false; // Already qualified and rewarded
        }

        $referrerId = (int)$referral['referrer_id'];
        $referralId = (int)$referral['id'];
        $pinHours = (int)self::getSetting('pin_duration_hours', 72);
        $pinRewardCount = (int)self::getSetting('kyc_pin_reward', 1);
        $expiresAt = date('Y-m-d H:i:s', strtotime("+{$pinHours} hours"));

        // Get usernames for descriptions
        $refUserStmt = $pdo->prepare("SELECT username FROM users WHERE id = ?");
        $refUserStmt->execute([$userId]);
        $bUsername = $refUserStmt->fetchColumn() ?: 'User';

        $refAStmt = $pdo->prepare("SELECT username FROM users WHERE id = ?");
        $refAStmt->execute([$referrerId]);
        $aUsername = $refAStmt->fetchColumn() ?: 'User';

        // 1. Grant Free Pin to Referrer (User A)
        $pdo->prepare("
            INSERT INTO user_rewards (user_id, reward_type, quantity, expires_at, source_referral_id, source_description, status, created_at)
            VALUES (?, 'free_pin', ?, ?, ?, ?, 'active', NOW())
        ")->execute([$referrerId, $pinRewardCount, $expiresAt, $referralId, "KYC Referral Reward (Referrer bonus for @{$bUsername})"]);

        // 2. Grant Free Pin to Referred User (User B)
        $pdo->prepare("
            INSERT INTO user_rewards (user_id, reward_type, quantity, expires_at, source_referral_id, source_description, status, created_at)
            VALUES (?, 'free_pin', ?, ?, ?, ?, 'active', NOW())
        ")->execute([$userId, $pinRewardCount, $expiresAt, $referralId, "KYC Welcome Reward (Referred by @{$aUsername})"]);

        // 3. Mark referral as qualified
        $newStatus = ($referral['status'] === 'vip_active') ? 'vip_active' : 'qualified';
        $pdo->prepare("
            UPDATE referrals 
            SET status = ?, kyc_reward_granted = 1, kyc_reward_granted_at = NOW(), updated_at = NOW() 
            WHERE id = ?
        ")->execute([$newStatus, $referralId]);

        // 4. Send In-App Notifications to both users
        try {
            // Referrer
            $pdo->prepare("
                INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                VALUES (?, 'referral', 'Referral Qualified! 📌 1 Free Pin Earned', 'Your referral has completed KYC verification! You have been awarded 1 Free Pin valid for {$pinHours} hours.', '/referral', 0, NOW())
            ")->execute([$referrerId]);

            // Referred user
            $pdo->prepare("
                INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                VALUES (?, 'referral', 'KYC Welcome Bonus! 📌 1 Free Pin Earned', 'Congratulations on passing KYC! As a welcome referral bonus, you have received 1 Free Pin valid for {$pinHours} hours.', '/referral', 0, NOW())
            ")->execute([$userId]);
        } catch (Throwable $e) {
            error_log('KYC Reward notification error: ' . $e->getMessage());
        }

        // 5. Check Milestones for Referrer
        self::checkAndAwardMilestones($referrerId);

        return true;
    }

    /**
     * Reward Referrer when referred user purchases VIP
     * Direct single-level only: User A receives:
     * - $1.00 Lifetime VIP Referral Credit
     * - 1 VIP Discount Coupon ($2.00 value)
     * - 5 Free Bumps
     * - Reduced Transaction Fee for the next 3 successful deals
     */
    public static function rewardVipPurchase($vipUserId, $months = 1, $amount = 10.00) {
        $pdo = Database::getConnection();

        // Check if this VIP user was referred
        $stmt = $pdo->prepare("SELECT * FROM referrals WHERE referred_user_id = ? LIMIT 1");
        $stmt->execute([$vipUserId]);
        $referral = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$referral) {
            return false; // User has no referrer
        }

        $referrerId = (int)$referral['referrer_id'];
        $referralId = (int)$referral['id'];

        // Get VIP user's username for transaction description
        $vipUserStmt = $pdo->prepare("SELECT username FROM users WHERE id = ?");
        $vipUserStmt->execute([$vipUserId]);
        $vipUsername = $vipUserStmt->fetchColumn() ?: 'User';

        $creditAmount = floatval(self::getSetting('vip_credit_amount', '1.00'));
        $freeBumps = intval(self::getSetting('vip_free_bumps', 5));
        $couponAmount = floatval(self::getSetting('vip_coupon_amount', '2.00'));
        $reducedDeals = intval(self::getSetting('reduced_fee_deals_count', 3));

        // 1. Add $1.00 VIP Referral Credit to Referrer
        $creditStmt = $pdo->prepare("SELECT referral_credit_balance FROM users WHERE id = ?");
        $creditStmt->execute([$referrerId]);
        $currentBal = floatval($creditStmt->fetchColumn() ?: 0);
        $newBal = $currentBal + $creditAmount;

        $pdo->prepare("UPDATE users SET referral_credit_balance = ? WHERE id = ?")->execute([$newBal, $referrerId]);

        // Record credit ledger transaction
        $pdo->prepare("
            INSERT INTO referral_credit_transactions (user_id, amount, balance_after, type, description, related_referral_id, created_at)
            VALUES (?, ?, ?, 'vip_referral_credit', ?, ?, NOW())
        ")->execute([
            $referrerId, 
            $creditAmount, 
            $newBal, 
            "Referred user @{$vipUsername} purchased VIP membership", 
            $referralId
        ]);

        // 2. Award 1 VIP Coupon ($2.00 value) in user_rewards
        $pdo->prepare("
            INSERT INTO user_rewards (user_id, reward_type, quantity, source_referral_id, source_description, status, created_at)
            VALUES (?, 'vip_coupon', 1, ?, 'VIP Referral Coupon ($2.00 credit for VIP or Pins)', 'active', NOW())
        ")->execute([$referrerId, $referralId]);

        // 3. Award 5 Free Bumps
        $pdo->prepare("
            INSERT INTO user_rewards (user_id, reward_type, quantity, source_referral_id, source_description, status, created_at)
            VALUES (?, 'free_bump', ?, ?, 'VIP Referral Reward (5 Free Bumps)', 'active', NOW())
        ")->execute([$referrerId, $freeBumps, $referralId]);

        // 4. Award Reduced Transaction Fee deals (3 deals)
        $pdo->prepare("
            INSERT INTO user_rewards (user_id, reward_type, quantity, source_referral_id, source_description, status, created_at)
            VALUES (?, 'reduced_fee_deal', ?, ?, 'VIP Referral Reward (Reduced Escrow Fee for 3 deals)', 'active', NOW())
        ")->execute([$referrerId, $reducedDeals, $referralId]);

        // 5. Update referral status
        $pdo->prepare("
            UPDATE referrals 
            SET status = 'vip_active', vip_reward_granted = 1, vip_reward_granted_at = NOW(), updated_at = NOW() 
            WHERE id = ?
        ")->execute([$referralId]);

        // 6. In-App Notification to Referrer
        try {
            $pdo->prepare("
                INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                VALUES (?, 'referral', 'VIP Referral Reward! 👑 +$1.00 Credit & Perks', 'Your referral @{$vipUsername} upgraded to VIP! You earned $1.00 Referral Credit, 1 VIP Coupon ($2), 5 Free Bumps, and Reduced Escrow Fees for 3 deals!', '/referral', 0, NOW())
            ")->execute([$referrerId]);
        } catch (Throwable $e) {
            error_log('VIP reward notification error: ' . $e->getMessage());
        }

        return true;
    }

    /**
     * Check and award milestone rewards for a user
     * Milestones:
     * - 5 Qualified Referrals: 2 Free Pins
     * - 10 Qualified Referrals: 5 Free Bumps
     * - 25 Qualified Referrals: 1 Month VIP
     * - 50 Qualified Referrals: Special Referral Champion Badge
     */
    public static function checkAndAwardMilestones($userId) {
        $pdo = Database::getConnection();

        // Count qualified referrals for this user
        $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM referrals 
            WHERE referrer_id = ? AND status IN ('qualified', 'vip_active') AND is_suspicious = 0
        ");
        $stmt->execute([$userId]);
        $qualifiedCount = (int)$stmt->fetchColumn();

        $milestones = [
            5 => ['type' => 'free_pin', 'qty' => 2, 'desc' => '5 Qualified Referrals Milestone (2 Free Pins)'],
            10 => ['type' => 'free_bump', 'qty' => 5, 'desc' => '10 Qualified Referrals Milestone (5 Free Bumps)'],
            25 => ['type' => 'vip_month', 'qty' => 1, 'desc' => '25 Qualified Referrals Milestone (1 Month VIP)'],
            50 => ['type' => 'special_badge', 'qty' => 1, 'desc' => '50 Qualified Referrals Milestone (Referral Champion Badge)']
        ];

        foreach ($milestones as $req => $m) {
            if ($qualifiedCount >= $req) {
                // Check if already awarded
                $chk = $pdo->prepare("
                    SELECT id FROM user_rewards 
                    WHERE user_id = ? AND source_description = ?
                ");
                $chk->execute([$userId, $m['desc']]);
                if (!$chk->fetch()) {
                    // Award milestone
                    if ($m['type'] === 'vip_month') {
                        // Directly activate 1 month VIP
                        $uStmt = $pdo->prepare("SELECT vipUntil FROM users WHERE id = ?");
                        $uStmt->execute([$userId]);
                        $vRow = $uStmt->fetch(PDO::FETCH_ASSOC);
                        $currentVip = $vRow['vipUntil'] ?? null;
                        $base = (!empty($currentVip) && strtotime($currentVip) > time()) ? new DateTime($currentVip) : new DateTime();
                        $base->modify('+1 month');
                        $newVipUntil = $base->format('Y-m-d H:i:s');
                        $pdo->prepare("UPDATE users SET vipUntil = ? WHERE id = ?")->execute([$newVipUntil, $userId]);
                    }

                    $expiresAt = ($m['type'] === 'free_pin') ? date('Y-m-d H:i:s', strtotime('+72 hours')) : null;

                    $pdo->prepare("
                        INSERT INTO user_rewards (user_id, reward_type, quantity, expires_at, source_description, status, created_at)
                        VALUES (?, ?, ?, ?, ?, 'active', NOW())
                    ")->execute([$userId, $m['type'], $m['qty'], $expiresAt, $m['desc']]);

                    // Send notification
                    try {
                        $pdo->prepare("
                            INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                            VALUES (?, 'referral', 'Milestone Unlocked! 🏆 {$req} Qualified Referrals', 'Congratulations on reaching {$req} qualified referrals! You have unlocked your milestone reward: {$m['desc']}.', '/referral', 0, NOW())
                        ")->execute([$userId]);
                    } catch (Throwable $e) {}
                }
            }
        }
    }

    /**
     * Safely apply referral credit towards a service (VIP, pin, ad promotion)
     */
    public static function applyCredit($userId, $amount, $description) {
        $pdo = Database::getConnection();
        $amount = floatval($amount);
        if ($amount <= 0) return false;

        $stmt = $pdo->prepare("SELECT referral_credit_balance FROM users WHERE id = ? FOR UPDATE");
        $stmt->execute([$userId]);
        $currentBal = floatval($stmt->fetchColumn() ?: 0);

        if ($currentBal < $amount) {
            return false; // Insufficient credit
        }

        $newBal = $currentBal - $amount;
        $pdo->prepare("UPDATE users SET referral_credit_balance = ? WHERE id = ?")->execute([$newBal, $userId]);

        $pdo->prepare("
            INSERT INTO referral_credit_transactions (user_id, amount, balance_after, type, description, created_at)
            VALUES (?, ?, ?, 'debit', ?, NOW())
        ")->execute([$userId, -$amount, $newBal, $description]);

        return true;
    }

    /**
     * Get user dashboard data
     */
    public static function getDashboardData($userId) {
        $pdo = Database::getConnection();

        // 1. Fetch user referral info
        $userStmt = $pdo->prepare("SELECT id, username, referral_code, referral_credit_balance, kyc_status FROM users WHERE id = ?");
        $userStmt->execute([$userId]);
        $user = $userStmt->fetch(PDO::FETCH_ASSOC);
        if (!$user) return null;

        $username = $user['username'];
        $referralCode = $user['referral_code'] ?: $username;
        $creditBalance = floatval($user['referral_credit_balance'] ?: 0);

        // 2. Metrics counters
        $statsStmt = $pdo->prepare("
            SELECT 
                COUNT(*) as total_referrals,
                SUM(CASE WHEN status = 'registered' THEN 1 ELSE 0 END) as registered_count,
                SUM(CASE WHEN status = 'kyc_pending' THEN 1 ELSE 0 END) as kyc_pending_count,
                SUM(CASE WHEN status IN ('qualified', 'vip_active') THEN 1 ELSE 0 END) as qualified_count,
                SUM(CASE WHEN status = 'vip_active' THEN 1 ELSE 0 END) as vip_referrals_count
            FROM referrals 
            WHERE referrer_id = ?
        ");
        $statsStmt->execute([$userId]);
        $stats = $statsStmt->fetch(PDO::FETCH_ASSOC);

        // 3. User rewards summary
        $rewardsStmt = $pdo->prepare("
            SELECT 
                reward_type,
                SUM(quantity) as total_earned,
                SUM(used_quantity) as total_used,
                SUM(CASE WHEN status = 'active' AND (expires_at IS NULL OR expires_at > NOW()) THEN (quantity - used_quantity) ELSE 0 END) as available
            FROM user_rewards
            WHERE user_id = ?
            GROUP BY reward_type
        ");
        $rewardsStmt->execute([$userId]);
        $rewardBalances = [
            'free_pins_earned' => 0,
            'free_pins_available' => 0,
            'free_pins_used' => 0,
            'free_bumps_earned' => 0,
            'free_bumps_available' => 0,
            'free_bumps_used' => 0,
            'vip_coupons_earned' => 0,
            'vip_coupons_available' => 0,
            'reduced_fee_deals_available' => 0
        ];
        while ($r = $rewardsStmt->fetch(PDO::FETCH_ASSOC)) {
            if ($r['reward_type'] === 'free_pin') {
                $rewardBalances['free_pins_earned'] = (int)$r['total_earned'];
                $rewardBalances['free_pins_available'] = (int)$r['available'];
                $rewardBalances['free_pins_used'] = (int)$r['total_used'];
            } elseif ($r['reward_type'] === 'free_bump') {
                $rewardBalances['free_bumps_earned'] = (int)$r['total_earned'];
                $rewardBalances['free_bumps_available'] = (int)$r['available'];
                $rewardBalances['free_bumps_used'] = (int)$r['total_used'];
            } elseif ($r['reward_type'] === 'vip_coupon') {
                $rewardBalances['vip_coupons_earned'] = (int)$r['total_earned'];
                $rewardBalances['vip_coupons_available'] = (int)$r['available'];
            } elseif ($r['reward_type'] === 'reduced_fee_deal') {
                $rewardBalances['reduced_fee_deals_available'] = (int)$r['available'];
            }
        }

        // 4. Referral History
        $historyStmt = $pdo->prepare("
            SELECT 
                r.id,
                r.referred_user_id,
                u.username as referred_username,
                u.profilePicture as referred_avatar,
                u.kyc_status as user_kyc_status,
                u.vipUntil as referred_vip_until,
                r.status as referral_status,
                r.created_at as registered_at,
                r.kyc_reward_granted,
                r.vip_reward_granted,
                r.is_suspicious
            FROM referrals r
            INNER JOIN users u ON r.referred_user_id = u.id
            WHERE r.referrer_id = ?
            ORDER BY r.created_at DESC
            LIMIT 50
        ");
        $historyStmt->execute([$userId]);
        $history = [];
        while ($row = $historyStmt->fetch(PDO::FETCH_ASSOC)) {
            $isVip = !empty($row['referred_vip_until']) && strtotime($row['referred_vip_until']) > time();
            $history[] = [
                'id' => (int)$row['id'],
                'username' => $row['referred_username'],
                'avatar' => $row['referred_avatar'] ?: '',
                'registeredAt' => $row['registered_at'],
                'kycStatus' => $row['user_kyc_status'] ?: 'unverified',
                'vipStatus' => $isVip ? 'Purchased' : 'Not Purchased',
                'rewardStatus' => $row['vip_reward_granted'] ? 'VIP Unlocked' : ($row['kyc_reward_granted'] ? 'KYC Unlocked' : 'Pending')
            ];
        }

        // 5. VIP Referral Credit History Ledger
        $ledgerStmt = $pdo->prepare("
            SELECT id, amount, balance_after, type, description, created_at
            FROM referral_credit_transactions
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        ");
        $ledgerStmt->execute([$userId]);
        $creditHistory = $ledgerStmt->fetchAll(PDO::FETCH_ASSOC);

        // 6. Milestones calculation with accurate claimed tracking
        $qualifiedCount = (int)($stats['qualified_count'] ?? 0);

        $claimedRows = $pdo->prepare("SELECT source_description FROM user_rewards WHERE user_id = ? AND source_description LIKE '%Milestone%'");
        $claimedRows->execute([$userId]);
        $claimedDescs = $claimedRows->fetchAll(PDO::FETCH_COLUMN) ?: [];

        $is5Claimed = false;
        $is10Claimed = false;
        $is25Claimed = false;
        $is50Claimed = false;
        foreach ($claimedDescs as $cd) {
            if (strpos($cd, '5 Qualified') !== false || strpos($cd, '5 Referrals') !== false) $is5Claimed = true;
            if (strpos($cd, '10 Qualified') !== false || strpos($cd, '10 Referrals') !== false) $is10Claimed = true;
            if (strpos($cd, '25 Qualified') !== false || strpos($cd, '25 Referrals') !== false) $is25Claimed = true;
            if (strpos($cd, '50 Qualified') !== false || strpos($cd, '50 Referrals') !== false) $is50Claimed = true;
        }

        $milestoneTiers = [
            ['target' => 5, 'label' => '5 Referrals', 'reward_description' => '2 Free Pins (72h duration)', 'reward' => '2 Free Pins', 'reached' => $qualifiedCount >= 5, 'claimed' => $is5Claimed],
            ['target' => 10, 'label' => '10 Referrals', 'reward_description' => '5 Free Bumps to Position #1', 'reward' => '5 Free Bumps', 'reached' => $qualifiedCount >= 10, 'claimed' => $is10Claimed],
            ['target' => 25, 'label' => '25 Referrals', 'reward_description' => '1 Month Free VIP Membership', 'reward' => '1 Month VIP', 'reached' => $qualifiedCount >= 25, 'claimed' => $is25Claimed],
            ['target' => 50, 'label' => '50 Referrals', 'reward_description' => 'Referral Champion Badge & Lifetime Status', 'reward' => 'Champion Badge', 'reached' => $qualifiedCount >= 50, 'claimed' => $is50Claimed]
        ];

        $referralsList = [];
        foreach ($history as $h) {
            $referralsList[] = [
                'id' => (int)$h['id'],
                'referred_username' => $h['username'],
                'referred_avatar' => $h['avatar'],
                'status' => 'active',
                'created_at' => $h['registeredAt'],
                'kyc_status' => $h['kycStatus'],
                'vip_status' => $h['vipStatus'] === 'Purchased',
                'vip_reward_earned' => strpos($h['rewardStatus'], 'VIP') !== false,
                'free_pin_earned' => strpos($h['rewardStatus'], 'KYC') !== false || strpos($h['rewardStatus'], 'VIP') !== false
            ];
        }

        $leaderboard = self::getLeaderboard(10);

        return [
            'user' => [
                'id' => (int)$userId,
                'username' => $username,
                'referral_code' => $referralCode,
                'referral_credit_balance' => (float)$creditBalance,
                'kyc_status' => $user['kyc_status'] ?? 'none',
                'free_pins_available' => (int)($rewardBalances['free_pins_available'] ?? 0),
                'free_bumps_available' => (int)($rewardBalances['free_bumps_available'] ?? 0),
                'vip_coupons_available' => (int)($rewardBalances['vip_coupons_available'] ?? 0),
                'reduced_escrow_deals_remaining' => (int)($rewardBalances['reduced_fee_deals_available'] ?? 0),
            ],
            'username' => $username,
            'referralCode' => $referralCode,
            'referral_code' => $referralCode,
            'referralLink' => "/ref/{$username}",
            'referral_link' => "/ref/{$username}",
            'creditBalance' => (float)$creditBalance,
            'stats' => [
                'total_referrals' => (int)($stats['total_referrals'] ?? 0),
                'qualified_referrals' => $qualifiedCount,
                'vip_conversions' => (int)($stats['vip_referrals_count'] ?? 0),
                'pending_kyc' => (int)($stats['kyc_pending_count'] ?? 0),
                'total_credits_earned' => (float)$creditBalance,
                'totalReferrals' => (int)($stats['total_referrals'] ?? 0),
                'registered' => (int)($stats['registered_count'] ?? 0),
                'kycPending' => (int)($stats['kyc_pending_count'] ?? 0),
                'kycApproved' => $qualifiedCount,
                'vipReferrals' => (int)($stats['vip_referrals_count'] ?? 0)
            ],
            'rewards' => $rewardBalances,
            'referrals' => $referralsList,
            'history' => $history,
            'transactions' => $creditHistory,
            'creditHistory' => $creditHistory,
            'milestones' => $milestoneTiers,
            'leaderboard' => $leaderboard
        ];
    }

    /**
     * Get Leaderboard of Top Referrers
     */
    public static function getLeaderboard($limit = 10) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            SELECT 
                u.id,
                u.username,
                u.profilePicture,
                COUNT(r.id) as qualified_count,
                SUM(CASE WHEN r.status = 'vip_active' THEN 1 ELSE 0 END) as vip_conversions
            FROM referrals r
            INNER JOIN users u ON r.referrer_id = u.id
            WHERE r.status IN ('qualified', 'vip_active') AND r.is_suspicious = 0
            GROUP BY u.id, u.username, u.profilePicture
            ORDER BY qualified_count DESC, vip_conversions DESC
            LIMIT ?
        ");
        $stmt->bindValue(1, (int)$limit, PDO::PARAM_INT);
        $stmt->execute();
        
        $leaderboard = [];
        $rank = 1;
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $leaderboard[] = [
                'rank' => $rank++,
                'username' => $row['username'],
                'avatar' => $row['profilePicture'] ?: '',
                'qualifiedReferrals' => (int)$row['qualified_count'],
                'vipConversions' => (int)$row['vip_conversions']
            ];
        }
        return $leaderboard;
    }

    /**
     * Consume 1 active Free Pin on an ad
     */
    public static function useFreePin($userId, $adId) {
        $pdo = Database::getConnection();

        // Check active available free pin
        $stmt = $pdo->prepare("
            SELECT id, quantity, used_quantity FROM user_rewards 
            WHERE user_id = ? AND reward_type = 'free_pin' AND status = 'active' 
              AND (expires_at IS NULL OR expires_at > NOW()) AND (quantity - used_quantity) > 0
            ORDER BY expires_at ASC LIMIT 1
            FOR UPDATE
        ");
        $stmt->execute([$userId]);
        $reward = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$reward) {
            return false;
        }

        // Verify ad ownership
        $adStmt = $pdo->prepare("SELECT id FROM ads WHERE id = ? AND userId = ? AND status = 'active'");
        $adStmt->execute([$adId, $userId]);
        if (!$adStmt->fetch()) {
            return false;
        }

        // Pin the ad for 72 hours
        $now = date('Y-m-d H:i:s');
        $pdo->prepare("UPDATE ads SET pinned = 1, pinnedAt = ? WHERE id = ?")->execute([$now, $adId]);

        // Increment used quantity
        $newUsed = $reward['used_quantity'] + 1;
        $newStatus = ($newUsed >= $reward['quantity']) ? 'used' : 'active';
        $pdo->prepare("UPDATE user_rewards SET used_quantity = ?, status = ? WHERE id = ?")->execute([$newUsed, $newStatus, $reward['id']]);

        return true;
    }

    /**
     * Consume 1 active Free Bump on an ad
     */
    public static function useFreeBump($userId, $adId) {
        $pdo = Database::getConnection();

        // Check active free bump
        $stmt = $pdo->prepare("
            SELECT id, quantity, used_quantity FROM user_rewards 
            WHERE user_id = ? AND reward_type = 'free_bump' AND status = 'active' 
              AND (quantity - used_quantity) > 0
            LIMIT 1 FOR UPDATE
        ");
        $stmt->execute([$userId]);
        $reward = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$reward) {
            return false;
        }

        // Verify ad ownership
        $adStmt = $pdo->prepare("SELECT id FROM ads WHERE id = ? AND userId = ? AND status = 'active'");
        $adStmt->execute([$adId, $userId]);
        if (!$adStmt->fetch()) {
            return false;
        }

        // Bump the ad immediately
        $now = date('Y-m-d H:i:s');
        $pdo->prepare("UPDATE ads SET lastPulledAt = ? WHERE id = ?")->execute([$now, $adId]);

        // Increment used bump
        $newUsed = $reward['used_quantity'] + 1;
        $newStatus = ($newUsed >= $reward['quantity']) ? 'used' : 'active';
        $pdo->prepare("UPDATE user_rewards SET used_quantity = ?, status = ? WHERE id = ?")->execute([$newUsed, $newStatus, $reward['id']]);

        return true;
    }

    /**
     * Check if user has an active reduced escrow fee perk
     */
    public static function hasReducedFeeDeal($userId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            SELECT id FROM user_rewards 
            WHERE user_id = ? AND reward_type = 'reduced_fee_deal' AND status = 'active' 
              AND (expires_at IS NULL OR expires_at > NOW()) AND (quantity - used_quantity) > 0
            LIMIT 1
        ");
        $stmt->execute([$userId]);
        return (bool)$stmt->fetchColumn();
    }

    /**
     * Consume 1 reduced escrow fee perk on a deal
     */
    public static function useReducedFeeDeal($userId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            SELECT id, quantity, used_quantity FROM user_rewards 
            WHERE user_id = ? AND reward_type = 'reduced_fee_deal' AND status = 'active' 
              AND (expires_at IS NULL OR expires_at > NOW()) AND (quantity - used_quantity) > 0
            ORDER BY id ASC LIMIT 1 FOR UPDATE
        ");
        $stmt->execute([$userId]);
        $reward = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$reward) return false;

        $newUsed = $reward['used_quantity'] + 1;
        $newStatus = ($newUsed >= $reward['quantity']) ? 'used' : 'active';
        $pdo->prepare("UPDATE user_rewards SET used_quantity = ?, status = ? WHERE id = ?")->execute([$newUsed, $newStatus, $reward['id']]);
        return true;
    }

    /**
     * Check available VIP discount coupon count
     */
    public static function getVipCouponCount($userId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            SELECT SUM(quantity - used_quantity) FROM user_rewards 
            WHERE user_id = ? AND reward_type = 'vip_coupon' AND status = 'active' 
              AND (expires_at IS NULL OR expires_at > NOW()) AND (quantity - used_quantity) > 0
        ");
        $stmt->execute([$userId]);
        return (int)$stmt->fetchColumn();
    }

    /**
     * Consume 1 VIP discount coupon ($2 value)
     */
    public static function useVipCoupon($userId) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("
            SELECT id, quantity, used_quantity FROM user_rewards 
            WHERE user_id = ? AND reward_type = 'vip_coupon' AND status = 'active' 
              AND (expires_at IS NULL OR expires_at > NOW()) AND (quantity - used_quantity) > 0
            ORDER BY id ASC LIMIT 1 FOR UPDATE
        ");
        $stmt->execute([$userId]);
        $reward = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$reward) return false;

        $newUsed = $reward['used_quantity'] + 1;
        $newStatus = ($newUsed >= $reward['quantity']) ? 'used' : 'active';
        $pdo->prepare("UPDATE user_rewards SET used_quantity = ?, status = ? WHERE id = ?")->execute([$newUsed, $newStatus, $reward['id']]);
        return true;
    }
}
