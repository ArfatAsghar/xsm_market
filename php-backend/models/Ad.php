<?php
require_once __DIR__ . '/../config/database.php';

class Ad {
    private static $table = 'ads';
    
    public static function create($data) {
        $pdo = Database::getConnection();
        
        $fields = [
            'userId', 'title', 'description', 'channelUrl', 'platform', 'category', 
            'contentType', 'contentCategory', 'price', 'subscribers', 'monthlyIncome', 
            'isMonetized', 'incomeDetails', 'promotionDetails', 'status', 'verified', 
            'premium', 'views', 'totalViews', 'rating', 'thumbnail', 'primary_image',
            'additional_images', 'screenshots', 'tags', 'socialBladeUrl', 'location', 
            'sellCondition', 'soldTo', 'soldAt'
        ];
        
        $insertFields = [];
        $insertValues = [];
        $params = [];
        
        foreach ($fields as $field) {
            if (array_key_exists($field, $data)) {
                $insertFields[] = $field;
                $insertValues[] = ':' . $field;
                
                // Handle JSON fields
                if (in_array($field, ['screenshots', 'tags', 'additional_images']) && is_array($data[$field])) {
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
                   u.lastSeenAt as seller_lastSeenAt
            FROM " . self::$table . " a
            INNER JOIN users u ON a.userId = u.id
            WHERE a.id = :id
        ";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute([':id' => $id]);
        $ad = $stmt->fetch();
        
        if ($ad) {
            self::formatJsonFields($ad);
            
            // Format seller data
            $ad['seller'] = [
                'id' => $ad['seller_id'],
                'username' => $ad['seller_username'],
                'email' => $ad['seller_email'],
                'profilePicture' => $ad['seller_profilePicture'],
                'lastSeenAt' => $ad['seller_lastSeenAt']
            ];
            
            // Clean up
            unset($ad['seller_id'], $ad['seller_username'], $ad['seller_email'], 
                  $ad['seller_profilePicture'], $ad['seller_lastSeenAt']);
        }
        
        return $ad;
    }
    
    public static function getAll($limit = 50, $offset = 0, $filters = []) {
        $pdo = Database::getConnection();
        
        // Match Node.js query structure exactly
        $sql = "
            SELECT a.*, 
                   u.id as seller_id, 
                   u.username as seller_username, 
                   u.profilePicture as seller_profilePicture
            FROM " . self::$table . " a
            INNER JOIN users u ON a.userId = u.id
            WHERE a.status = 'active'
        ";
        
        $params = [];
        
        // Apply filters - exact match to Node.js
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
        
        // Sort order - pinned ads first, then by specified sort order
        $sortBy = $filters['sortBy'] ?? 'createdAt';
        $sortOrder = $filters['sortOrder'] ?? 'DESC';
        $validSortFields = ['createdAt', 'price', 'subscribers', 'views'];
        $sortField = in_array($sortBy, $validSortFields) ? $sortBy : 'createdAt';
        
        $sql .= " ORDER BY a.pinned DESC, a.{$sortField} {$sortOrder} LIMIT :limit OFFSET :offset";
        
        $stmt = $pdo->prepare($sql);
        $stmt->bindValue(':limit', (int)$limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', (int)$offset, PDO::PARAM_INT);
        
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        
        $stmt->execute();
        $ads = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Format response to match Node.js exactly
        foreach ($ads as &$ad) {
            self::formatJsonFields($ad);
            
            // Format seller info to match Node.js structure
            $ad['seller'] = [
                'id' => (int)$ad['seller_id'],
                'username' => $ad['seller_username'],
                'profilePicture' => $ad['seller_profilePicture']
            ];
            
            // Convert numeric fields to proper types
            $ad['id'] = (int)$ad['id'];
            $ad['userId'] = (int)$ad['userId'];
            $ad['price'] = (float)$ad['price'];
            $ad['subscribers'] = (int)$ad['subscribers'];
            $ad['monthlyIncome'] = (float)$ad['monthlyIncome'];
            $ad['views'] = (int)$ad['views'];
            $ad['totalViews'] = (int)$ad['totalViews'];
            $ad['isMonetized'] = (bool)$ad['isMonetized'];
            $ad['verified'] = (bool)$ad['verified'];
            $ad['premium'] = (bool)$ad['premium'];
            $ad['rating'] = $ad['rating'] ? (float)$ad['rating'] : 0;
            
            // Remove seller_ prefixed fields
            unset($ad['seller_id'], $ad['seller_username'], $ad['seller_profilePicture']);
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
                if (in_array($key, ['screenshots', 'additional_images', 'tags']) && is_array($value)) {
                    $params[":$key"] = json_encode($value);
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
        
        $sql = "SELECT COUNT(*) as count FROM " . self::$table . " WHERE status = 'active'";
        $params = [];
        
        // Apply filters
        if (!empty($filters['platform'])) {
            $sql .= " AND platform = :platform";
            $params[':platform'] = $filters['platform'];
        }
        
        if (!empty($filters['category'])) {
            $sql .= " AND category = :category";
            $params[':category'] = $filters['category'];
        }
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $result = $stmt->fetch();
        return $result['count'];
    }
    
    private static function formatJsonFields(&$ad) {
        // Decode JSON fields
        if (!empty($ad['screenshots'])) {
            $ad['screenshots'] = json_decode($ad['screenshots'], true);
        }
        
        if (!empty($ad['additional_images'])) {
            $ad['additional_images'] = json_decode($ad['additional_images'], true);
        }
        
        if (!empty($ad['tags'])) {
            $ad['tags'] = json_decode($ad['tags'], true);
        }
        
        // No need to modify URLs since we're using base64 data URIs now
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
}
?>
