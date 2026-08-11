<?php
require_once __DIR__ . '/../config/database.php';

class Ad {
    private static $table = 'ads';
    
    public static function create($data) {
        $pdo = Database::getConnection();
        
        $fields = [
            'userId', 'title', 'description', 'channelUrl', 'platform', 'category', 
            'contentType', 'contentCategory', 'price', 'subscribers', 'monthlyIncome', 
            'isMonetized', 'incomeDetails', 'promotionDetails', 'preferredPaymentMethods', 'status', 'verified', 
            'premium', 'views', 'totalViews', 'rating', 'thumbnail', 'primary_image',
            'additional_images', 'screenshots', 'tags', 'socialBladeUrl', 'location', 
            'sellCondition', 'soldTo', 'soldAt', 'verificationCode'
        ];
        
        $insertFields = [];
        $insertValues = [];
        $params = [];
        
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $insertFields[] = $field;
                $insertValues[] = ':' . $field;
                
                // Handle JSON fields
                if (in_array($field, ['screenshots', 'tags', 'additional_images', 'preferredPaymentMethods']) && is_array($data[$field])) {
                    $params[':' . $field] = json_encode($data[$field]);
                } 
                // Handle boolean fields - convert to integer for MySQL
                elseif (in_array($field, ['isMonetized', 'verified', 'premium']) && isset($data[$field])) {
                    $params[':' . $field] = $data[$field] ? 1 : 0;
                } 
                else {
                    $params[':' . $field] = $data[$field];
                }
            }
        }
        
        // Set defaults
        if (!isset($data['status'])) {
            $insertFields[] = 'status';
            $insertValues[] = ':status';
            $params[':status'] = 'active';
        }
        
        if (!isset($data['verified'])) {
            $insertFields[] = 'verified';
            $insertValues[] = ':verified';
            $params[':verified'] = 0;
        }
        
        if (!isset($data['premium'])) {
            $insertFields[] = 'premium';
            $insertValues[] = ':premium';
            $params[':premium'] = 0;
        }
        
        if (!isset($data['views'])) {
            $insertFields[] = 'views';
            $insertValues[] = ':views';
            $params[':views'] = 0;
        }
        
        // Add timestamps
        $insertFields[] = 'createdAt';
        $insertValues[] = ':createdAt';
        $params[':createdAt'] = date('Y-m-d H:i:s');
        
        $insertFields[] = 'updatedAt';
        $insertValues[] = ':updatedAt';
        $params[':updatedAt'] = date('Y-m-d H:i:s');
        
        if (!isset($data['isMonetized'])) {
            $insertFields[] = 'isMonetized';
            $insertValues[] = ':isMonetized';
            $params[':isMonetized'] = 0;
        }
        
        $sql = "INSERT INTO " . self::$table . " (" . implode(', ', $insertFields) . ") VALUES (" . implode(', ', $insertValues) . ")";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        return $pdo->lastInsertId();
    }
    
    public static function findById($id) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("SELECT * FROM " . self::$table . " WHERE id = :id");
        $stmt->execute([':id' => $id]);
        $ad = $stmt->fetch();
        
        if ($ad) {
            self::formatJsonFields($ad);
        }
        
        return $ad;
    }
    
    public static function findByIdWithSeller($id) {
        $pdo = Database::getConnection();
        
        $sql = "
            SELECT a.*, 
                   u.id as seller_id, 
                   u.username as seller_username, 
                   u.email as seller_email,
                   u.profilePicture as seller_profilePicture,
                   u.lastSeenAt as seller_lastSeenAt,
                   u.vipUntil as seller_vipUntil
            FROM " . self::$table . " a
            INNER JOIN users u ON a.userId = u.id
            WHERE a.id = :id
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
        $ad = $stmt->fetch();
        
        if ($ad) {
            self::formatJsonFields($ad);
            
            // Compute seller isVip and averageResponseTime
            $sellerVipUntil = $ad['seller_vipUntil'];
            $sellerIsVip = !empty($sellerVipUntil) && strtotime($sellerVipUntil) > time();
            $sellerAvgResponseTime = UserController::calculateAverageResponseTime($ad['seller_id']);

            // Format seller data
            $ad['seller'] = [
                'id' => $ad['seller_id'],
                'username' => $ad['seller_username'],
                'email' => $ad['seller_email'],
                'profilePicture' => $ad['seller_profilePicture'],
                'lastSeenAt' => $ad['seller_lastSeenAt'],
                'isVip' => $sellerIsVip,
                'vipUntil' => $sellerVipUntil,
                'averageResponseTime' => $sellerAvgResponseTime
            ];
            $ad['seller_isVip'] = $sellerIsVip;
            $ad['isVip'] = $sellerIsVip;
            
            // Clean up
            unset($ad['seller_id'], $ad['seller_username'], $ad['seller_email'], 
                  $ad['seller_profilePicture'], $ad['seller_lastSeenAt'], $ad['seller_vipUntil']);
        }
        
        return $ad;
    }
    
    public static function getAll($limit = 50, $offset = 0, $filters = []) {
        $pdo = Database::getConnection();
        
        $includeBanned = !empty($filters['includeBanned']);
        $isAdmin = !empty($filters['isAdmin']);
        
        try {
            $sql = "
                SELECT a.*, 
                       u.id as seller_id, 
                       u.username as seller_username, 
                       u.profilePicture as seller_profilePicture,
                       u.vipUntil as seller_vipUntil
                FROM " . self::$table . " a
                LEFT JOIN users u ON a.userId = u.id
                WHERE 1=1
            ";
            
            $params = [];
            
            if ($isAdmin) {
                if (!empty($filters['status']) && $filters['status'] !== 'all') {
                    $sql .= " AND a.status = :status";
                    $params[':status'] = $filters['status'];
                }
            } else {
                $sql .= " AND a.status = 'active'";
            }
            
            // Apply filters
            if (!empty($filters['platform']) && $filters['platform'] !== 'all') {
                $sql .= " AND a.platform = :platform";
                $params[':platform'] = $filters['platform'];
            }
            
            if (!empty($filters['category']) && $filters['category'] !== 'all') {
                $sql .= " AND a.category = :category";
                $params[':category'] = $filters['category'];
            }
            
            if (!empty($filters['minPrice'])) {
                $sql .= " AND a.price >= :minPrice";
                $params[':minPrice'] = floatval($filters['minPrice']);
            }
            
            if (!empty($filters['maxPrice'])) {
                $sql .= " AND a.price <= :maxPrice";
                $params[':maxPrice'] = floatval($filters['maxPrice']);
            }
            
            if (!empty($filters['search'])) {
                $sql .= " AND (a.title LIKE :search OR a.description LIKE :search OR a.contentCategory LIKE :search)";
                $params[':search'] = '%' . $filters['search'] . '%';
            }
            
            // Sort order
            $sortBy = $filters['sortBy'] ?? 'createdAt';
            $sortOrder = strtoupper($filters['sortOrder'] ?? 'DESC');
            if ($sortOrder !== 'ASC' && $sortOrder !== 'DESC') $sortOrder = 'DESC';
            $validSortFields = ['createdAt', 'price', 'subscribers', 'views'];
            $sortField = in_array($sortBy, $validSortFields) ? $sortBy : 'createdAt';
            
            $sql .= " ORDER BY a.{$sortField} {$sortOrder} LIMIT :limit OFFSET :offset";
            
            $stmt = $pdo->prepare($sql);
            $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
            $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
            
            foreach ($params as $key => $value) {
                $stmt->bindValue($key, $value);
            }
            
            $stmt->execute();
            $ads = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Throwable $e) {
            error_log("Ad::getAll main query failed: " . $e->getMessage() . ". Trying simple fallback.");
            try {
                $fallbackSql = "SELECT * FROM " . self::$table . " WHERE status = 'active' ORDER BY createdAt DESC LIMIT :limit OFFSET :offset";
                $stmt = $pdo->prepare($fallbackSql);
                $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
                $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
                $stmt->execute();
                $ads = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (Throwable $e2) {
                error_log("Ad::getAll fallback query failed: " . $e2->getMessage());
                return [];
            }
        }
        
        // Format response safely
        foreach ($ads as &$ad) {
            self::formatJsonFields($ad);
            
            // Compute seller isVip
            $sellerVipUntil = $ad['seller_vipUntil'] ?? null;
            $sellerIsVip = !empty($sellerVipUntil) && strtotime($sellerVipUntil) > time();

            // Format seller info
            $ad['seller'] = [
                'id' => (int)($ad['seller_id'] ?? $ad['userId'] ?? 0),
                'username' => $ad['seller_username'] ?? 'Seller',
                'profilePicture' => $ad['seller_profilePicture'] ?? '',
                'isVip' => $sellerIsVip,
                'vipUntil' => $sellerVipUntil
            ];
            $ad['seller_isVip'] = $sellerIsVip;
            $ad['isVip'] = $sellerIsVip;
            
            // Convert numeric fields to proper types with null coalescing
            $ad['id'] = (int)($ad['id'] ?? 0);
            $ad['userId'] = (int)($ad['userId'] ?? 0);
            $ad['price'] = (float)($ad['price'] ?? 0);
            $ad['subscribers'] = (int)($ad['subscribers'] ?? 0);
            $ad['monthlyIncome'] = (float)($ad['monthlyIncome'] ?? 0);
            $ad['views'] = (int)($ad['views'] ?? 0);
            $ad['totalViews'] = (int)($ad['totalViews'] ?? $ad['views'] ?? 0);
            $ad['isMonetized'] = !empty($ad['isMonetized']);
            $ad['verified'] = !empty($ad['verified']);
            $ad['premium'] = !empty($ad['premium']);
            $ad['rating'] = !empty($ad['rating']) ? (float)$ad['rating'] : 0;
            
            // Clean up temporary seller_ prefix fields
            unset($ad['seller_id'], $ad['seller_username'], $ad['seller_profilePicture'], $ad['seller_vipUntil']);
        }
        
        return $ads;
    }
    
    public static function getUserAds($userId, $limit = 50, $offset = 0) {
        $pdo = Database::getConnection();
        
        $sql = "SELECT * FROM " . self::$table . " WHERE userId = :userId ORDER BY createdAt DESC LIMIT :limit OFFSET :offset";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':userId', (int)$userId, PDO::PARAM_INT);
        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $ads = $stmt->fetchAll();
        
        foreach ($ads as &$ad) {
            self::formatJsonFields($ad);
        }
        
        return $ads;
    }
    
    public static function getUserAdsWithPagination($userId, $limit = 10, $offset = 0, $status = null) {
        $pdo = Database::getConnection();
        
        // Build WHERE clause
        $whereClause = "WHERE userId = :userId";
        $params = [':userId' => (int)$userId];
        
        if ($status && $status !== 'all') {
            $whereClause .= " AND status = :status";
            $params[':status'] = $status;
        }
        
        // Get total count
        $countSql = "SELECT COUNT(*) as total FROM " . self::$table . " " . $whereClause;
        $countStmt = $pdo->prepare($countSql);
        foreach ($params as $key => $value) {
            $countStmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $countStmt->execute();
        $totalItems = $countStmt->fetch()['total'];
        
        // Get ads - pinned ads first, then by creation date
        $sql = "SELECT * FROM " . self::$table . " " . $whereClause . " ORDER BY pinned DESC, createdAt DESC LIMIT :limit OFFSET :offset";
        $stmt = $pdo->prepare($sql);
        
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        $stmt->execute();
        
        $ads = $stmt->fetchAll();
        
        foreach ($ads as &$ad) {
            self::formatJsonFields($ad);
        }
        
        return [
            'ads' => $ads,
            'totalItems' => (int)$totalItems,
            'totalPages' => ceil($totalItems / $limit)
        ];
    }
    
    public static function search($searchTerm, $limit = 50) {
        $pdo = Database::getConnection();
        
        $sql = "
            SELECT a.*, 
                   u.username as seller_username
            FROM " . self::$table . " a
            INNER JOIN users u ON a.userId = u.id
            WHERE a.status = 'active'
            AND (u.isBanned = 0 OR u.isBanned IS NULL)
            AND (a.title LIKE :search OR a.description LIKE :search OR a.category LIKE :search)
            ORDER BY a.createdAt DESC
            LIMIT :limit
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':search', '%' . $searchTerm . '%', PDO::PARAM_STR);
        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $stmt->execute();
        
        $ads = $stmt->fetchAll();
        
        foreach ($ads as &$ad) {
            self::formatJsonFields($ad);
        }
        
        return $ads;
    }
    
    public static function update($id, $data) {
        $pdo = Database::getConnection();
        
        $fields = [];
        $params = [':id' => $id];
        
        foreach ($data as $key => $value) {
            if ($key !== 'id') {
                $fields[] = "$key = :$key";
                
                // Handle JSON fields
                if (in_array($key, ['screenshots', 'additional_images', 'tags', 'preferredPaymentMethods']) && is_array($value)) {
                    $params[":$key"] = json_encode($value);
                }
                // Sanitize thumbnail/primary_image — never store '0' or empty
                elseif (in_array($key, ['thumbnail', 'primary_image']) && ($value === '0' || $value === 0 || $value === 'null' || $value === 'NULL' || trim((string)$value) === '')) {
                    $params[":$key"] = null;
                } else {
                    $params[":$key"] = $value;
                }
            }
        }
        
        if (empty($fields)) {
            return false;
        }
        
        $sql = "UPDATE " . self::$table . " SET " . implode(', ', $fields) . " WHERE id = :id";
        $stmt = $pdo->prepare($sql);
        return $stmt->execute($params);
    }
    
    public static function markAsSold($id, $buyerId) {
        return self::update($id, [
            'status' => 'sold',
            'soldTo' => $buyerId,
            'soldAt' => date('Y-m-d H:i:s')
        ]);
    }
    
    public static function incrementViews($id) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("UPDATE " . self::$table . " SET views = views + 1 WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
    
    public static function delete($id) {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare("DELETE FROM " . self::$table . " WHERE id = :id");
        return $stmt->execute([':id' => $id]);
    }
    
    public static function count($filters = []) {
        $pdo = Database::getConnection();
        
        $includeBanned = !empty($filters['includeBanned']);
        $isAdmin = !empty($filters['isAdmin']);
        
        $sql = "SELECT COUNT(*) as count FROM " . self::$table . " a INNER JOIN users u ON a.userId = u.id WHERE 1=1";
        $params = [];
        
        if ($isAdmin) {
            if (!empty($filters['status']) && $filters['status'] !== 'all') {
                $sql .= " AND a.status = :status";
                $params[':status'] = $filters['status'];
            }
        } else {
            $sql .= " AND a.status = 'active'";
        }
        
        if (!$includeBanned) {
            $sql .= " AND (a.isBanned = 0 OR a.isBanned IS NULL)";
        }
        
        // Apply filters
        if (!empty($filters['platform']) && $filters['platform'] !== 'all') {
            $sql .= " AND a.platform = :platform";
            $params[':platform'] = $filters['platform'];
        }
        
        if (!empty($filters['category']) && $filters['category'] !== 'all') {
            $sql .= " AND a.category = :category";
            $params[':category'] = $filters['category'];
        }
        
        if (!empty($filters['search'])) {
            $sql .= " AND (a.title LIKE :search OR a.description LIKE :search OR a.contentCategory LIKE :search)";
            $params[':search'] = '%' . $filters['search'] . '%';
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();
        return $result ? (int)($result['count'] ?? 0) : 0;
    }

    
    private static function formatJsonFields(&$ad) {
        // Decode JSON fields
        if (isset($ad['screenshots']) && $ad['screenshots'] !== null && $ad['screenshots'] !== '' && $ad['screenshots'] !== '0' && $ad['screenshots'] !== 'NULL') {
            $decoded = json_decode($ad['screenshots'], true);
            $ad['screenshots'] = is_array($decoded) ? $decoded : [];
        } else {
            $ad['screenshots'] = [];
        }
        
        if (isset($ad['additional_images']) && $ad['additional_images'] !== null && $ad['additional_images'] !== '' && $ad['additional_images'] !== '0' && $ad['additional_images'] !== 'NULL') {
            $decoded = json_decode($ad['additional_images'], true);
            $ad['additional_images'] = is_array($decoded) ? $decoded : [];
        } else {
            $ad['additional_images'] = [];
        }
        
        if (isset($ad['tags']) && $ad['tags'] !== null && $ad['tags'] !== '' && $ad['tags'] !== '0' && $ad['tags'] !== 'NULL') {
            $decoded = json_decode($ad['tags'], true);
            $ad['tags'] = is_array($decoded) ? $decoded : [];
        } else {
            $ad['tags'] = [];
        }

        if (isset($ad['preferredPaymentMethods']) && $ad['preferredPaymentMethods'] !== null && $ad['preferredPaymentMethods'] !== '' && $ad['preferredPaymentMethods'] !== '0' && $ad['preferredPaymentMethods'] !== 'NULL') {
            $decoded = json_decode($ad['preferredPaymentMethods'], true);
            $ad['preferredPaymentMethods'] = is_array($decoded) ? $decoded : [];
        } else {
            $ad['preferredPaymentMethods'] = [];
        }
    }
    
    public static function updatePin($id, $pinned, $pinnedAt = null) {
        $pdo = Database::getConnection();
        
        $sql = "UPDATE " . self::$table . " SET pinned = :pinned, pinnedAt = :pinnedAt WHERE id = :id";
        
        $stmt = $pdo->prepare($sql);
        return $stmt->execute([
            ':id' => $id,
            ':pinned' => $pinned ? 1 : 0,
            ':pinnedAt' => $pinnedAt
        ]);
    }
    
    public static function pullUpAd($id, $pulledAt) {
        $pdo = Database::getConnection();
        
        // Update lastPulledAt and also update createdAt to make it appear at top of listings
        $sql = "UPDATE " . self::$table . " SET lastPulledAt = :pulledAt, createdAt = :createdAt WHERE id = :id";
        
        $stmt = $pdo->prepare($sql);
        return $stmt->execute([
            ':id' => $id,
            ':pulledAt' => $pulledAt,
            ':createdAt' => $pulledAt
        ]);
    }

    public static function findActiveByChannelUrl($channelUrl) {
        $pdo = Database::getConnection();
        $cleanUrl = strtolower(trim(preg_replace('/^https?:\/\/(www\.)?/', '', rtrim($channelUrl, '/'))));
        
        $sql = "SELECT * FROM " . self::$table . " 
                WHERE status = 'active' 
                AND (
                    LOWER(channelUrl) LIKE :exactUrl
                    OR LOWER(channelUrl) LIKE :cleanUrl
                )
                ORDER BY createdAt DESC LIMIT 1";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            ':exactUrl' => '%' . strtolower(trim($channelUrl)) . '%',
            ':cleanUrl' => '%' . $cleanUrl . '%'
        ]);
        
        $ad = $stmt->fetch();
        if ($ad) {
            self::formatJsonFields($ad);
        }
        return $ad;
    }

    public static function deactivateByChannelUrl($channelUrl) {
        $pdo = Database::getConnection();
        $cleanUrl = strtolower(trim(preg_replace('/^https?:\/\/(www\.)?/', '', rtrim($channelUrl, '/'))));
        
        $sql = "UPDATE " . self::$table . " 
                SET status = 'cancelled' 
                WHERE status = 'active'
                AND (
                    LOWER(channelUrl) LIKE :exactUrl
                    OR LOWER(channelUrl) LIKE :cleanUrl
                )";
        
        $stmt = $pdo->prepare($sql);
        return $stmt->execute([
            ':exactUrl' => '%' . strtolower(trim($channelUrl)) . '%',
            ':cleanUrl' => '%' . $cleanUrl . '%'
        ]);
    }
}
?>
