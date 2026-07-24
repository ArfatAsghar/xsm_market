<?php
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Ad.php';
require_once __DIR__ . '/../utils/Response.php';

class AdminController {
    
    // Get all users (admin only)
    public function getUsers() {
        $admin = AuthMiddleware::requireViewer();
        
        $page = intval($_GET['page'] ?? 1);
        $limit = intval($_GET['limit'] ?? 50);
        $search = $_GET['search'] ?? '';
        $offset = ($page - 1) * $limit;
        
        try {
            if ($search) {
                $users = User::search($search, $limit);
                $total = count($users); // Approximate
            } else {
                $users = User::getAll($limit, $offset);
                $total = User::count();
            }
            
            // Remove sensitive data
            foreach ($users as &$user) {
                unset($user['password'], $user['emailOTP'], $user['passwordResetToken']);
            }
            
            Response::json([
                'users' => $users,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'totalPages' => ceil($total / $limit)
                ]
            ]);
            
        } catch (Exception $e) {
            error_log('Admin get users error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Get all ads (admin only)
    public function getAds() {
        $admin = AuthMiddleware::requireViewer();
        
        $page = intval($_GET['page'] ?? 1);
        $limit = intval($_GET['limit'] ?? 50);
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';
        $offset = ($page - 1) * $limit;
        
        try {
            $filters = [];
            if ($status) $filters['status'] = $status;
            if ($search) $filters['search'] = $search;
            
            // For admin, we want to see all ads regardless of status and including banned ones
            $filters['includeBanned'] = true;
            $filters['isAdmin'] = true;
            
            $ads = Ad::getAll($limit, $offset, $filters);

            $total = Ad::count($filters);
            
            Response::json([
                'ads' => $ads,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'totalPages' => ceil($total / $limit)
                ]
            ]);
            
        } catch (Exception $e) {
            error_log('Admin get ads error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Ban user
    public function banUser($userId) {
        $admin = AuthMiddleware::requireManager();
        
        $input = json_decode(file_get_contents('php://input'), true);
        $reason = trim($input['reason'] ?? '');
        $duration = trim($input['duration'] ?? 'permanent'); // 'permanent', '7d', '30d'
        
        try {
            $user = User::findById($userId);
            
            if (!$user) {
                Response::error('User not found', 404);
            }
            
            if ($user['isAdmin']) {
                Response::error('Cannot ban admin users', 400);
            }
            
            $banExpires = null;
            if ($duration === '7d') {
                $banExpires = date('Y-m-d H:i:s', strtotime('+7 days'));
            } elseif ($duration === '30d') {
                $banExpires = date('Y-m-d H:i:s', strtotime('+30 days'));
            }
            
            User::update($userId, [
                'isBanned' => true,
                'banReason' => $reason,
                'banExpires' => $banExpires,
                'bannedAt' => date('Y-m-d H:i:s'),
                'bannedBy' => $admin['id']
            ]);
            
            Response::json(['message' => 'User banned successfully']);
            
        } catch (Exception $e) {
            error_log('Ban user error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Unban user
    public function unbanUser($userId) {
        $admin = AuthMiddleware::requireManager();
        
        try {
            $user = User::findById($userId);
            
            if (!$user) {
                Response::error('User not found', 404);
            }
            
            if (!$user['isBanned']) {
                Response::error('User is not banned', 400);
            }
            
            User::update($userId, [
                'isBanned' => false,
                'banReason' => null,
                'banExpires' => null,
                'bannedAt' => null,
                'bannedBy' => null,
                'unbannedAt' => date('Y-m-d H:i:s'),
                'unbannedBy' => $admin['id']
            ]);
            
            Response::json(['message' => 'User unbanned successfully']);
            
        } catch (Exception $e) {
            error_log('Unban user error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // Toggle VIP status (admin/manager)
    public function toggleVip($userId) {
        $admin = AuthMiddleware::requireManager();
        $pdo = Database::getConnection();

        try {
            $stmt = $pdo->prepare("SELECT id, vipUntil FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                Response::error('User not found', 404);
                return;
            }

            $currentVipUntil = $user['vipUntil'] ?? null;
            $isCurrentlyVip = !empty($currentVipUntil) && strtotime($currentVipUntil) > time();

            if ($isCurrentlyVip) {
                // Remove VIP
                $newVipUntil = null;
                $message = 'VIP status removed for user';
            } else {
                // Grant 30 days VIP
                $dt = new DateTime();
                $dt->modify('+30 days');
                $newVipUntil = $dt->format('Y-m-d H:i:s');
                $message = 'VIP status granted (30 days) for user';
            }

            $update = $pdo->prepare("UPDATE users SET vipUntil = ? WHERE id = ?");
            $update->execute([$newVipUntil, $userId]);

            Response::json([
                'success' => true,
                'message' => $message,
                'isVip' => !$isCurrentlyVip,
                'vipUntil' => $newVipUntil
            ]);
        } catch (Exception $e) {
            error_log('Toggle VIP error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Update user role (admin only)
    public function updateUserRole($userId) {
        $admin = AuthMiddleware::requireAdmin();
        
        $input = json_decode(file_get_contents('php://input'), true);
        $role = trim($input['role'] ?? '');
        
        if (!in_array($role, ['admin', 'manager', 'viewer', 'user'])) {
            Response::error('Invalid role specified', 400);
            return;
        }
        
        try {
            $user = User::findById($userId);
            
            if (!$user) {
                Response::error('User not found', 404);
                return;
            }
            
            // Sync isAdmin column for backward compatibility
            $isAdminVal = ($role === 'admin') ? 1 : 0;
            
            User::update($userId, [
                'role' => $role,
                'isAdmin' => $isAdminVal
            ]);
            
            Response::json(['success' => true, 'message' => 'User role updated successfully']);
            
        } catch (Exception $e) {
            error_log('Update user role error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Ban a listing (admin/manager)
    public function banListing($adId) {
        $admin = AuthMiddleware::requireManager();

        $input = json_decode(file_get_contents('php://input'), true);
        $reason = trim($input['reason'] ?? '');

        if (!$reason) {
            Response::error('A ban reason is required', 400);
            return;
        }

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT id, userId, title FROM ads WHERE id = ?");
            $stmt->execute([$adId]);
            $ad = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$ad) {
                Response::error('Listing not found', 404);
                return;
            }

            $stmt = $pdo->prepare(
                "UPDATE ads SET isBanned = 1, banReason = ?, bannedAt = NOW(), bannedBy = ? WHERE id = ?"
            );
            $stmt->execute([$reason, $admin['id'], $adId]);

            Response::json([
                'success' => true,
                'message' => 'Listing banned successfully',
                'sellerId' => $ad['userId'],
                'listingTitle' => $ad['title']
            ]);

        } catch (Exception $e) {
            error_log('Ban listing error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // Unban a listing (admin/manager)
    public function unbanListing($adId) {
        $admin = AuthMiddleware::requireManager();

        try {
            $pdo = Database::getConnection();
            $stmt = $pdo->prepare("SELECT id FROM ads WHERE id = ?");
            $stmt->execute([$adId]);
            $ad = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$ad) {
                Response::error('Listing not found', 404);
                return;
            }

            $stmt = $pdo->prepare(
                "UPDATE ads SET isBanned = 0, banReason = NULL, bannedAt = NULL, bannedBy = NULL WHERE id = ?"
            );
            $stmt->execute([$adId]);

            Response::json(['success' => true, 'message' => 'Listing unbanned successfully']);

        } catch (Exception $e) {
            error_log('Unban listing error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // Delete ad (admin)
    public function deleteAd($adId) {
        $admin = AuthMiddleware::requireManager();
        try {
            $ad = Ad::findById($adId);
            
            if (!$ad) {
                Response::error('Ad not found', 404);
                return;
            }
            
            $result = Ad::delete($adId);
            
            if ($result) {
                Response::json(['success' => true, 'message' => 'Ad deleted successfully']);
            } else {
                Response::error('Failed to delete ad', 500);
            }
            
        } catch (Exception $e) {
            error_log('Admin delete ad error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Approve ad
    public function approveAd($adId) {
        $admin = AuthMiddleware::requireManager();
        
        try {
            $ad = Ad::findById($adId);
            
            if (!$ad) {
                Response::error('Ad not found', 404);
            }
            
            Ad::update($adId, [
                'status' => 'active',
                'approvedAt' => date('Y-m-d H:i:s'),
                'approvedBy' => $admin['id']
            ]);
            
            Response::json(['message' => 'Ad approved successfully']);
            
        } catch (Exception $e) {
            error_log('Approve ad error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Reject ad
    public function rejectAd($adId) {
        $admin = AuthMiddleware::requireManager();
        
        $input = json_decode(file_get_contents('php://input'), true);
        $reason = trim($input['reason'] ?? '');
        
        try {
            $ad = Ad::findById($adId);
            
            if (!$ad) {
                Response::error('Ad not found', 404);
            }
            
            Ad::update($adId, [
                'status' => 'rejected',
                'rejectionReason' => $reason,
                'rejectedAt' => date('Y-m-d H:i:s'),
                'rejectedBy' => $admin['id']
            ]);
            
            Response::json(['message' => 'Ad rejected successfully']);
            
        } catch (Exception $e) {
            error_log('Reject ad error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Get admin dashboard stats
    public function getDashboardStats() {
        $admin = AuthMiddleware::requireViewer();
        
        try {
            $database = new Database();
            $pdo = $database->getConnection();
            
            // Get user stats
            $userStats = $pdo->query("
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN isEmailVerified = 1 THEN 1 ELSE 0 END) as verified,
                    SUM(CASE WHEN isBanned = 1 THEN 1 ELSE 0 END) as banned,
                    SUM(CASE WHEN DATE(createdAt) = CURDATE() THEN 1 ELSE 0 END) as today
                FROM users
            ")->fetch();
            
            // Get ad stats
            $adStats = $pdo->query("
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'sold' THEN 1 ELSE 0 END) as sold,
                    SUM(CASE WHEN DATE(createdAt) = CURDATE() THEN 1 ELSE 0 END) as today
                FROM ads
            ")->fetch();
            
            // Get chat stats
            $chatStats = $pdo->query("
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN DATE(createdAt) = CURDATE() THEN 1 ELSE 0 END) as today
                FROM chats
            ")->fetch();
            
            // Get deal stats
            $dealStats = $pdo->query("
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN deal_status = 'completed' THEN 1 ELSE 0 END) as completed,
                    SUM(CASE WHEN deal_status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as today
                FROM deals
            ")->fetch();
            
            Response::json([
                'totalUsers' => (int)$userStats['total'],
                'verifiedUsers' => (int)$userStats['verified'],
                'bannedUsers' => (int)$userStats['banned'],
                'newUsersToday' => (int)$userStats['today'],
                'totalListings' => (int)$adStats['total'],
                'activeListings' => (int)$adStats['active'],
                'pendingListings' => (int)$adStats['pending'],
                'soldListings' => (int)$adStats['sold'],
                'newListingsToday' => (int)$adStats['today'],
                'totalChats' => (int)$chatStats['total'],
                'newChatsToday' => (int)$chatStats['today'],
                'totalDeals' => (int)$dealStats['total'],
                'completedDeals' => (int)$dealStats['completed'],
                'pendingDeals' => (int)$dealStats['pending'],
                'newDealsToday' => (int)$dealStats['today']
            ]);
            
        } catch (Exception $e) {
            error_log('Dashboard stats error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Get recent activities (admin only)
    public function getRecentActivities() {
        $admin = AuthMiddleware::requireViewer();
        
        try {
            $database = new Database();
            $pdo = $database->getConnection();
            
            $activities = [];
            
            // Recent user registrations
            $recentUsers = $pdo->query("
                SELECT 'user_registered' as type, CONCAT('User registered: ', username) as description, createdAt as timestamp
                FROM users 
                WHERE DATE(createdAt) >= DATE_SUB(CURDATE(), INTERVAL 7 DAYS)
                ORDER BY createdAt DESC 
                LIMIT 5
            ")->fetchAll();
            
            // Recent ads
            $recentAds = $pdo->query("
                SELECT 'ad_created' as type, CONCAT('New listing: ', title) as description, createdAt as timestamp
                FROM ads 
                WHERE DATE(createdAt) >= DATE_SUB(CURDATE(), INTERVAL 7 DAYS)
                ORDER BY createdAt DESC 
                LIMIT 5
            ")->fetchAll();
            
            // Recent deals
            $recentDeals = $pdo->query("
                SELECT 'deal_created' as type, CONCAT('Deal created: ', transaction_id) as description, created_at as timestamp
                FROM deals 
                WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 7 DAYS)
                ORDER BY created_at DESC 
                LIMIT 5
            ")->fetchAll();
            
            // Merge and sort all activities
            $activities = array_merge($recentUsers, $recentAds, $recentDeals);
            
            // Sort by timestamp
            usort($activities, function($a, $b) {
                return strtotime($b['timestamp']) - strtotime($a['timestamp']);
            });
            
            // Limit to 10 most recent
            $activities = array_slice($activities, 0, 10);
            
            Response::json($activities);
            
        } catch (Exception $e) {
            error_log('Recent activities error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Get all chats (admin only)
    public function getChats() {
        $admin = AuthMiddleware::requireViewer();
        
        $page = intval($_GET['page'] ?? 1);
        $limit = intval($_GET['limit'] ?? 50);
        $offset = ($page - 1) * $limit;
        
        try {
            $database = new Database();
            $pdo = $database->getConnection();
            
            // Get chats with participant info
            $stmt = $pdo->prepare("
                SELECT c.*, 
                       (SELECT GROUP_CONCAT(u.username SEPARATOR ', ') 
                        FROM chat_participants cp 
                        INNER JOIN users u ON cp.userId = u.id 
                        WHERE cp.chatId = c.id AND cp.isActive = 1) as participants,
                       (SELECT COUNT(*) FROM messages m WHERE m.chatId = c.id) as messageCount
                FROM chats c
                ORDER BY c.lastMessageTime DESC, c.createdAt DESC
                LIMIT ? OFFSET ?
            ");
            $stmt->execute([$limit, $offset]);
            $chats = $stmt->fetchAll();
            
            $total = $pdo->query("SELECT COUNT(*) FROM chats")->fetchColumn();
            
            Response::json([
                'chats' => $chats,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'totalPages' => ceil($total / $limit)
                ]
            ]);
            
        } catch (Exception $e) {
            error_log('Admin get chats error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Get all deals (admin only)
    public function getDeals() {
        $admin = AuthMiddleware::requireViewer();
        
        $page = intval($_GET['page'] ?? 1);
        $limit = intval($_GET['limit'] ?? 50);
        $status = $_GET['status'] ?? '';
        $offset = ($page - 1) * $limit;
        
        try {
            $database = new Database();
            $pdo = $database->getConnection();
            
            $whereClause = '';
            $params = [$limit, $offset];
            
            if ($status) {
                $whereClause = 'WHERE d.deal_status = ?';
                array_unshift($params, $status);
            }
            
            // Get deals with user info
            $stmt = $pdo->prepare("
                SELECT d.*, 
                       buyer.username as buyer_username,
                       seller.username as seller_username,
                       buyer.email as buyer_email,
                       seller.email as seller_email
                FROM deals d
                LEFT JOIN users buyer ON d.buyer_id = buyer.id
                LEFT JOIN users seller ON d.seller_id = seller.id
                $whereClause
                ORDER BY d.created_at DESC
                LIMIT ? OFFSET ?
            ");
            $stmt->execute($params);
            $deals = $stmt->fetchAll();
            
            // Get total count
            $countQuery = "SELECT COUNT(*) FROM deals d";
            if ($status) {
                $countQuery .= " WHERE d.deal_status = ?";
                $total = $pdo->prepare($countQuery)->execute([$status]) ? $pdo->prepare($countQuery)->fetchColumn() : 0;
            } else {
                $total = $pdo->query($countQuery)->fetchColumn();
            }
            
            Response::json([
                'deals' => $deals,
                'pagination' => [
                    'page' => $page,
                    'limit' => $limit,
                    'total' => $total,
                    'totalPages' => ceil($total / $limit)
                ]
            ]);
            
        } catch (Exception $e) {
            error_log('Admin get deals error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Update ad status (admin only)
    public function updateAdStatus($adId) {
        $admin = AuthMiddleware::requireAdmin();
        
        $input = json_decode(file_get_contents('php://input'), true);
        $status = trim($input['status'] ?? '');
        $rejectionReason = trim($input['rejectionReason'] ?? '');
        
        try {
            $validStatuses = ['active', 'suspended', 'rejected', 'pending'];
            if (!in_array($status, $validStatuses)) {
                Response::error('Invalid status. Must be one of: ' . implode(', ', $validStatuses), 400);
                return;
            }
            
            $database = new Database();
            $pdo = $database->getConnection();
            
            $stmt = $pdo->prepare("SELECT * FROM ads WHERE id = ?");
            $stmt->execute([$adId]);
            $ad = $stmt->fetch();
            
            if (!$ad) {
                Response::error('Ad not found', 404);
                return;
            }
            
            $updateData = [
                'status' => $status,
                'updatedAt' => date('Y-m-d H:i:s')
            ];
            
            if ($status === 'active') {
                $updateData['approvedAt'] = date('Y-m-d H:i:s');
                $updateData['approvedBy'] = $admin['id'];
                $updateData['rejectedAt'] = null;
                $updateData['rejectedBy'] = null;
                $updateData['rejectionReason'] = null;
            } elseif ($status === 'rejected') {
                $updateData['rejectedAt'] = date('Y-m-d H:i:s');
                $updateData['rejectedBy'] = $admin['id'];
                $updateData['rejectionReason'] = $rejectionReason;
                $updateData['approvedAt'] = null;
                $updateData['approvedBy'] = null;
            }
            
            $setClause = implode(', ', array_map(function($key) {
                return "$key = :$key";
            }, array_keys($updateData)));
            
            $stmt = $pdo->prepare("UPDATE ads SET $setClause WHERE id = :id");
            $updateData['id'] = $adId;
            $stmt->execute($updateData);
            
            Response::success(['message' => 'Ad status updated successfully']);
            
        } catch (Exception $e) {
            error_log('Update ad status error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Get admin email from .env file (public endpoint)
    public function getAdminEmail() {
        try {
            // Load environment variables
            $envFile = __DIR__ . '/../.env';
            $adminEmail = null;
            $adminUsername = null;
            
            if (file_exists($envFile)) {
                $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
                foreach ($lines as $line) {
                    $line = trim($line);
                    if (strpos($line, 'admin_email') === 0) {
                        $parts = explode('=', $line, 2);
                        if (count($parts) === 2) {
                            $adminEmail = trim(trim($parts[1]), ' "\'');
                        }
                    }
                    if (strpos($line, 'admin_username') === 0) {
                        $parts = explode('=', $line, 2);
                        if (count($parts) === 2) {
                            $adminUsername = trim(trim($parts[1]), ' "\'');
                        }
                    }
                }
            }
            
            Response::success([
                'adminEmail' => $adminEmail,
                'adminUsername' => $adminUsername
            ]);
            
        } catch (Exception $e) {
            error_log('Get admin email error: ' . $e->getMessage());
            Response::error('Server error', 500);
        }
    }

    public function getSupportRequests() {
        try {
            $user = AuthMiddleware::requireViewer();

            $pdo = Database::getConnection();

            // Try querying support_requested column — graceful fallback if it doesn't exist
            try {
                $stmt = $pdo->prepare("
                    SELECT c.id, c.type, c.support_requested_at,
                           u1.username as user1, u2.username as user2
                    FROM chats c
                    LEFT JOIN chat_participants cp1 ON cp1.chatId = c.id AND cp1.isActive = 1
                    LEFT JOIN users u1 ON cp1.userId = u1.id
                    LEFT JOIN chat_participants cp2 ON cp2.chatId = c.id AND cp2.isActive = 1 AND cp2.userId != u1.id
                    LEFT JOIN users u2 ON cp2.userId = u2.id
                    WHERE c.support_requested = 1
                    GROUP BY c.id
                    ORDER BY c.support_requested_at DESC
                    LIMIT 100
                ");
                $stmt->execute();
                $chats = $stmt->fetchAll(PDO::FETCH_ASSOC);

                Response::json([
                    'success' => true,
                    'count' => count($chats),
                    'data' => $chats
                ]);
            } catch (Exception $e) {
                // Column doesn't exist yet — return empty
                Response::json([
                    'success' => true,
                    'count' => 0,
                    'data' => [],
                    'note' => 'support_requested column not yet created in DB'
                ]);
            }

        } catch (Exception $e) {
            error_log('getSupportRequests error: ' . $e->getMessage());
            Response::error('Server error', 500);
        }
    }
    // Delete a user entirely (admin only)
    public function deleteUser($userId) {
        $admin = AuthMiddleware::requireAdmin();

        $db = Database::getConnection();
        try {
            // Verify user exists
            $stmt = $db->prepare("SELECT id, username FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$user) {
                Response::error('User not found', 404);
                return;
            }

            // Prevent deleting yourself
            if ($user['id'] == $admin['id']) {
                Response::error('You cannot delete your own account', 403);
                return;
            }

            $db->beginTransaction();

            // 1. Clear messages dependencies (replyToId reference)
            $stmt = $db->prepare("SELECT id FROM messages WHERE senderId = ?");
            $stmt->execute([$userId]);
            $messageIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($messageIds)) {
                $inClause = implode(',', array_fill(0, count($messageIds), '?'));
                $db->prepare("UPDATE messages SET replyToId = NULL WHERE replyToId IN ($inClause)")->execute($messageIds);
            }

            $db->prepare("UPDATE messages SET replyToId = NULL WHERE senderId = ?")->execute([$userId]);
            $db->prepare("DELETE FROM messages WHERE senderId = ?")->execute([$userId]);

            // 2. Clear deals dependencies
            $stmt = $db->prepare("SELECT id FROM deals WHERE buyer_id = ? OR seller_id = ?");
            $stmt->execute([$userId, $userId]);
            $dealIds = $stmt->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($dealIds)) {
                $inClause = implode(',', array_fill(0, count($dealIds), '?'));
                $db->prepare("DELETE FROM crypto_payments WHERE deal_id IN ($inClause)")->execute($dealIds);
                $db->prepare("DELETE FROM deal_history WHERE deal_id IN ($inClause)")->execute($dealIds);
                $db->prepare("DELETE FROM deal_payment_methods WHERE deal_id IN ($inClause)")->execute($dealIds);
                $db->prepare("DELETE FROM deals WHERE id IN ($inClause)")->execute($dealIds);
            }

            // 3. Clear ad references in chats
            $db->prepare("UPDATE chats SET adId = NULL WHERE adId IN (SELECT id FROM ads WHERE userId = ?)")->execute([$userId]);

            // 4. Delete ads
            $db->prepare("DELETE FROM ads WHERE userId = ?")->execute([$userId]);

            // 5. Delete chat participants
            $db->prepare("DELETE FROM chat_participants WHERE userId = ?")->execute([$userId]);

            // 6. Delete user
            $db->prepare("DELETE FROM users WHERE id = ?")->execute([$userId]);

            $db->commit();

            Response::json(['success' => true, 'message' => 'User deleted successfully']);
        } catch (Exception $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            error_log('deleteUser error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // Update deal status (admin only)
    public function updateDealStatus($dealId) {
        $admin = AuthMiddleware::requireViewer();
        $data = json_decode(file_get_contents('php://input'), true);
        $status = strtolower(trim($data['status'] ?? ''));

        $validStatuses = ['pending', 'accepted', 'rejected', 'cancelled', 'canceled', 'failed', 'completed', 'terms_agreed', 'fee_paid'];
        if (!in_array($status, $validStatuses)) {
            Response::error('Invalid deal status. Allowed: Pending, Accepted, Rejected, Cancelled, Failed, Completed', 400);
            return;
        }

        try {
            $database = new Database();
            $pdo = $database->getConnection();

            $stmt = $pdo->prepare("UPDATE deals SET deal_status = ?, updated_at = NOW() WHERE id = ?");
            $stmt->execute([$status, $dealId]);

            // Add history entry
            $historyStmt = $pdo->prepare("
                INSERT INTO deal_history (deal_id, action_type, action_by, action_description)
                VALUES (?, 'admin_status_change', ?, ?)
            ");
            $historyStmt->execute([$dealId, $admin['userId'], "Status updated to " . ucfirst($status) . " by admin"]);

            Response::json([
                'success' => true,
                'message' => "Deal status updated to " . ucfirst($status),
                'deal_status' => $status
            ]);
        } catch (Exception $e) {
            error_log('updateDealStatus error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
}
?>
