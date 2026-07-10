<?php
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Ad.php';
require_once __DIR__ . '/../utils/Response.php';

class AdminController {
    
    // Get all users (admin only)
    public function getUsers() {
        $admin = AuthMiddleware::requireAdmin();
        
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
        $admin = AuthMiddleware::requireAdmin();
        
        $page = intval($_GET['page'] ?? 1);
        $limit = intval($_GET['limit'] ?? 50);
        $status = $_GET['status'] ?? '';
        $search = $_GET['search'] ?? '';
        $offset = ($page - 1) * $limit;
        
        try {
            $filters = [];
            if ($status) $filters['status'] = $status;
            if ($search) $filters['search'] = $search;
            
            // For admin, we want to see all ads regardless of status
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
        $admin = AuthMiddleware::requireAdmin();
        
        $input = json_decode(file_get_contents('php://input'), true);
        $reason = trim($input['reason'] ?? '');
        
        try {
            $user = User::findById($userId);
            
            if (!$user) {
                Response::error('User not found', 404);
            }
            
            if ($user['isAdmin']) {
                Response::error('Cannot ban admin users', 400);
            }
            
            if ($user['isBanned']) {
                Response::error('User is already banned', 400);
            }
            
            User::update($userId, [
                'isBanned' => true,
                'banReason' => $reason,
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
        $admin = AuthMiddleware::requireAdmin();
        
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
    
    // Delete ad (admin)
    public function deleteAd($adId) {
        // Remove admin authentication - just delete the ad
        try {
            $ad = Ad::findById($adId);
            
            if (!$ad) {
                Response::error('Ad not found', 404);
                return;
            }
            
            $result = Ad::delete($adId);
            
            if ($result) {
                Response::json(['message' => 'Ad deleted successfully']);
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
        $admin = AuthMiddleware::requireAdmin();
        
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
        $admin = AuthMiddleware::requireAdmin();
        
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
        $admin = AuthMiddleware::requireAdmin();
        
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
        $admin = AuthMiddleware::requireAdmin();
        
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
        $admin = AuthMiddleware::requireAdmin();
        
        $page = intval($_GET['page'] ?? 1);
        $limit = intval($_GET['limit'] ?? 50);
        $offset = ($page - 1) * $limit;
        
        try {
            $database = new Database();
            $pdo = $database->getConnection();
            
            // Get chats with participant info
            $stmt = $pdo->prepare("
                SELECT c.*, 
                       GROUP_CONCAT(u.username SEPARATOR ', ') as participants,
                       COUNT(m.id) as messageCount
                FROM chats c
                LEFT JOIN chat_participants cp ON c.id = cp.chatId
                LEFT JOIN users u ON cp.userId = u.id
                LEFT JOIN messages m ON c.id = m.chatId
                GROUP BY c.id
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
        $admin = AuthMiddleware::requireAdmin();
        
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
}
?>
