<?php
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../models/Ad.php';
require_once __DIR__ . '/../utils/Response.php';
require_once __DIR__ . '/../utils/Validation.php';

class AdController {
    
    // Get all ads - matches Node.js getAllAds exactly
    public function getAllAds() {
        $page = intval($_GET['page'] ?? 1);
        $limit = intval($_GET['limit'] ?? 20);
        $platform = $_GET['platform'] ?? '';
        $category = $_GET['category'] ?? '';
        $minPrice = $_GET['minPrice'] ?? '';
        $maxPrice = $_GET['maxPrice'] ?? '';
        $search = $_GET['search'] ?? '';
        
        $offset = ($page - 1) * $limit;
        
        $filters = [];
        if ($platform) $filters['platform'] = $platform;
        if ($category) $filters['category'] = $category;
        if ($minPrice) $filters['minPrice'] = floatval($minPrice);
        if ($maxPrice) $filters['maxPrice'] = floatval($maxPrice);
        if ($search) $filters['search'] = $search;
        
        try {
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
            error_log('Get ads error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Create new ad - exact match to Node.js implementation
    public function createAd() {
        $user = AuthMiddleware::protect();
        
        $input = json_decode(file_get_contents('php://input'), true);
        
        error_log('Create ad attempt by user: ' . $user['id']);
        error_log('Create ad data: ' . json_encode($input));
        
        // Extract required fields - exact match to Node.js
        $title = $input['title'] ?? '';
        $description = $input['description'] ?? '';
        $channelUrl = $input['channelUrl'] ?? '';
        $platform = $input['platform'] ?? '';
        $category = $input['category'] ?? '';
        $contentType = $input['contentType'] ?? null;
        $contentCategory = $input['contentCategory'] ?? null;
        $price = isset($input['price']) && $input['price'] !== '' ? floatval($input['price']) : 0;
        $subscribers = isset($input['subscribers']) && $input['subscribers'] !== '' ? intval($input['subscribers']) : 0;
        $monthlyIncome = isset($input['monthlyIncome']) && $input['monthlyIncome'] !== '' ? floatval($input['monthlyIncome']) : 0;
        $isMonetized = isset($input['isMonetized']) ? (bool)$input['isMonetized'] : false;
        $incomeDetails = $input['incomeDetails'] ?? '';
        $promotionDetails = $input['promotionDetails'] ?? '';
        $thumbnail = $input['thumbnail'] ?? null;
        $screenshots = $input['screenshots'] ?? [];
        $tags = $input['tags'] ?? [];
        
        // Validation - exact match to Node.js
        if (!$title || !$channelUrl || !$platform || !$category || !$price) {
            Response::error('Title, channel URL, platform, category, and price are required', 400);
            return;
        }
        
        if (floatval($price) < 5) {
            Response::error('Minimum price should be $5', 400);
            return;
        }
        
        if (intval($subscribers) < 100) {
            Response::error('Minimum subscribers should be 100', 400);
            return;
        }
        
        // Auto-detect platform from URL - exact match to Node.js
        $detectedPlatform = strtolower($platform);
        if (strpos($channelUrl, 'youtube.com') !== false || strpos($channelUrl, 'youtu.be') !== false) {
            $detectedPlatform = 'youtube';
        } elseif (strpos($channelUrl, 'facebook.com') !== false || strpos($channelUrl, 'fb.com') !== false) {
            $detectedPlatform = 'facebook';
        } elseif (strpos($channelUrl, 'instagram.com') !== false) {
            $detectedPlatform = 'instagram';
        } elseif (strpos($channelUrl, 'twitter.com') !== false || strpos($channelUrl, 'x.com') !== false) {
            $detectedPlatform = 'twitter';
        } elseif (strpos($channelUrl, 'tiktok.com') !== false) {
            $detectedPlatform = 'tiktok';
        }
        
        try {
            // Prepare data for Ad::create - exact match to Node.js
            $adData = [
                'userId' => $user['id'],
                'title' => $title,
                'description' => $description,
                'channelUrl' => $channelUrl,
                'platform' => $detectedPlatform,
                'category' => $category,
                'contentType' => ($contentType && trim($contentType) !== '') ? $contentType : null,
                'contentCategory' => ($contentCategory && trim($contentCategory) !== '') ? $contentCategory : null,
                'price' => floatval($price),
                'subscribers' => $subscribers ? intval($subscribers) : 0,
                'monthlyIncome' => $monthlyIncome ? floatval($monthlyIncome) : 0,
                'isMonetized' => (bool)$isMonetized,
                'incomeDetails' => $incomeDetails,
                'promotionDetails' => $promotionDetails,
                'thumbnail' => $thumbnail,
                'screenshots' => $screenshots,
                'tags' => $tags,
                'status' => 'active' // All new ads start as active for immediate listing
            ];
            
            error_log('Processed ad data: ' . json_encode($adData));
            
            $adId = Ad::create($adData);
            
            error_log('New ad created: ' . $adId . ' by user ' . $user['id']);
            
            // Return response - exact match to Node.js
            Response::success([
                'message' => 'Ad created successfully and is now live!',
                'ad' => [
                    'id' => (int)$adId,
                    'title' => $title,
                    'platform' => $detectedPlatform,
                    'price' => floatval($price),
                    'status' => 'active',
                    'createdAt' => date('Y-m-d H:i:s')
                ]
            ], 201);
            
        } catch (Exception $e) {
            error_log('Create ad error: ' . $e->getMessage());
            error_log('Request body: ' . json_encode($input));
            error_log('User ID: ' . $user['id']);
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Get ad by ID
    public function getAdById($adId) {
        try {
            $ad = Ad::findByIdWithSeller($adId);
            
            if (!$ad) {
                Response::error('Ad not found', 404);
            }
            
            // Increment view count
            Ad::incrementViews($adId);
            
            Response::json($ad);
            
        } catch (Exception $e) {
            error_log('Get ad error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Update ad
    public function updateAd($adId) {
        $user = AuthMiddleware::protect();
        
        $input = json_decode(file_get_contents('php://input'), true);
        
        try {
            $ad = Ad::findById($adId);
            
            if (!$ad) {
                Response::error('Ad not found', 404);
            }
            
            // Check ownership
            if ($ad['userId'] != $user['id'] && !$user['isAdmin']) {
                Response::error('Access denied', 403);
            }
            
            // Fields that can be updated
            $allowedFields = [
                'title', 'description', 'channelUrl', 'platform', 'category',
                'contentType', 'contentCategory', 'price', 'subscribers', 'monthlyIncome',
                'isMonetized', 'incomeDetails', 'promotionDetails', 'totalViews',
                'thumbnail', 'screenshots', 'primary_image', 'additional_images', 'tags', 'socialBladeUrl', 'location', 'sellCondition'
            ];
            
            $updateData = [];
            foreach ($allowedFields as $field) {
                if (isset($input[$field])) {
                    if (in_array($field, ['title', 'description', 'channelUrl', 'category', 'contentCategory', 'incomeDetails', 'promotionDetails', 'thumbnail', 'socialBladeUrl', 'location', 'sellCondition'])) {
                        $updateData[$field] = trim($input[$field]);
                    } else {
                        $updateData[$field] = $input[$field];
                    }
                }
            }
            
            // Validation for updated fields
            if (isset($updateData['title']) && (strlen($updateData['title']) < 3 || strlen($updateData['title']) > 255)) {
                Response::error('Title must be between 3 and 255 characters', 400);
            }
            
            if (isset($updateData['channelUrl']) && !filter_var($updateData['channelUrl'], FILTER_VALIDATE_URL)) {
                Response::error('Please provide a valid channel URL', 400);
            }
            
            if (isset($updateData['platform']) && !in_array($updateData['platform'], ['facebook', 'instagram', 'twitter', 'tiktok', 'youtube'])) {
                Response::error('Invalid platform', 400);
            }
            
            if (isset($updateData['price']) && floatval($updateData['price']) < 5) {
                Response::error('Minimum price should be $5', 400);
            }
            
            if (isset($updateData['subscribers']) && intval($updateData['subscribers']) < 100) {
                Response::error('Minimum subscribers should be 100', 400);
            }
            
            if (empty($updateData)) {
                Response::error('No valid fields to update', 400);
            }
            
            Ad::update($adId, $updateData);
            
            $updatedAd = Ad::findByIdWithSeller($adId);
            
            Response::json([
                'message' => 'Ad updated successfully',
                'ad' => $updatedAd
            ]);
            
        } catch (Exception $e) {
            error_log('Update ad error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Delete ad
    public function deleteAd($adId) {
        // Remove all authentication - just delete the ad directly
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
            error_log('Delete ad error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Mark ad as sold
    public function markAsSold($adId) {
        $user = AuthMiddleware::protect();
        
        $input = json_decode(file_get_contents('php://input'), true);
        $buyerId = $input['buyerId'] ?? null;
        
        try {
            $ad = Ad::findById($adId);
            
            if (!$ad) {
                Response::error('Ad not found', 404);
            }
            
            // Check ownership
            if ($ad['userId'] != $user['id']) {
                Response::error('Access denied', 403);
            }
            
            if ($ad['status'] === 'sold') {
                Response::error('Ad is already marked as sold', 400);
            }
            
            Ad::markAsSold($adId, $buyerId);
            
            Response::json(['message' => 'Ad marked as sold successfully']);
            
        } catch (Exception $e) {
            error_log('Mark as sold error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Get user's ads
    public function getMyAds() {
        $user = AuthMiddleware::protect();
        
        $page = intval($_GET['page'] ?? 1);
        $limit = intval($_GET['limit'] ?? 10);
        $status = $_GET['status'] ?? null;
        $offset = ($page - 1) * $limit;
        
        try {
            $result = Ad::getUserAdsWithPagination($user['id'], $limit, $offset, $status);
            
            Response::json([
                'ads' => $result['ads'],
                'pagination' => [
                    'currentPage' => $page,
                    'totalPages' => $result['totalPages'],
                    'totalItems' => $result['totalItems'],
                    'itemsPerPage' => $limit
                ]
            ]);
            
        } catch (Exception $e) {
            error_log('Get my ads error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    public function getAdsByUserId($userId) {
    try {
        if (!$userId || !is_numeric($userId)) {
            Response::error('User ID is required', 400);
            return;
        }

        $stmt = Database::getConnection()->prepare("
            SELECT 
                a.id,
                a.title,
                a.platform,
                a.category,
                a.price,
                a.subscribers,
                a.monthlyIncome,
                a.isMonetized,
                a.createdAt,
                a.thumbnail,
                a.screenshots,
                a.description,
                u.vipUntil as seller_vipUntil
            FROM ads a
            INNER JOIN users u ON a.userId = u.id
            WHERE a.userId = ?
            AND (
                a.status = 1
                OR a.status = '1'
                OR a.status = 'active'
                OR a.status IS NULL
            )
            ORDER BY 
                a.pinned DESC,
                a.pinnedAt DESC,
                a.createdAt DESC
        ");

        $stmt->execute([(int)$userId]);
        $ads = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($ads as &$ad) {
            $ad['id'] = (int)$ad['id'];
            $ad['price'] = (float)$ad['price'];
            $ad['subscribers'] = (int)$ad['subscribers'];
            $ad['monthlyIncome'] = isset($ad['monthlyIncome']) ? (float)$ad['monthlyIncome'] : 0;
            $ad['isMonetized'] = (bool)$ad['isMonetized'];

            $sellerVipUntil = $ad['seller_vipUntil'] ?? null;
            $sellerIsVip = !empty($sellerVipUntil) && strtotime($sellerVipUntil) > time();
            $ad['isVip'] = $sellerIsVip;
            $ad['seller_isVip'] = $sellerIsVip;
            $ad['seller'] = [
                'id' => (int)$userId,
                'isVip' => $sellerIsVip,
                'vipUntil' => $sellerVipUntil
            ];
            unset($ad['seller_vipUntil']);

            if (!empty($ad['screenshots'])) {
                $decodedScreenshots = json_decode($ad['screenshots'], true);
                $ad['screenshots'] = is_array($decodedScreenshots) ? $decodedScreenshots : [];
            } else {
                $ad['screenshots'] = [];
            }
        }

        Response::json([
            'success' => true,
            'data' => $ads
        ]);
    } catch (Exception $e) {
        error_log('Get ads by user ID error: ' . $e->getMessage());
        Response::error('Failed to load listings', 500);
    }
}
    
    // Search ads
    public function searchAds() {
        $search = $_GET['q'] ?? '';
        $limit = intval($_GET['limit'] ?? 20);
        
        if (empty($search)) {
            Response::error('Search query is required', 400);
        }
        
        try {
            $ads = Ad::search($search, $limit);
            
            Response::json([
                'ads' => $ads,
                'query' => $search
            ]);
            
        } catch (Exception $e) {
            error_log('Search ads error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Pin/Unpin ad functionality
    public function togglePin($adId) {
        $user = AuthMiddleware::protect();
        
        try {
            $ad = Ad::findById($adId);
            
            if (!$ad) {
                Response::error('Ad not found', 404);
                return;
            }
            
            // Check ownership
            if ($ad['userId'] != $user['id']) {
                Response::error('Access denied', 403);
                return;
            }
            
            // Check if ad is active
            if ($ad['status'] !== 'active') {
                Response::error('Only active ads can be pinned', 400);
                return;
            }
            
            // Toggle pin status
            $newPinnedStatus = !$ad['pinned'];
            $pinnedAt = $newPinnedStatus ? date('Y-m-d H:i:s') : null;
            
            $result = Ad::updatePin($adId, $newPinnedStatus, $pinnedAt);
            
            if ($result) {
                $message = $newPinnedStatus ? 'Ad pinned successfully' : 'Ad unpinned successfully';
                Response::json([
                    'message' => $message,
                    'pinned' => $newPinnedStatus,
                    'pinnedAt' => $pinnedAt
                ]);
            } else {
                Response::error('Failed to update pin status', 500);
            }
            
        } catch (Exception $e) {
            error_log('Toggle pin error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }
    
    // Bump (Pull up) ad functionality with VIP-aware cooldown
    public function pullUpAd($adId) {
        $user = AuthMiddleware::protect();
        
        try {
            $ad = Ad::findById($adId);
            
            if (!$ad) {
                Response::error('Ad not found', 404);
                return;
            }
            
            // Check ownership
            if ($ad['userId'] != $user['id']) {
                Response::error('Access denied', 403);
                return;
            }
            
            // Check if ad is active
            if ($ad['status'] !== 'active') {
                Response::error('Only active ads can be bumped', 400);
                return;
            }

            // Determine cooldown based on VIP status
            $vipUntil = $user['vipUntil'] ?? null;
            $isVip = !empty($vipUntil) && strtotime($vipUntil) > time();
            $cooldownDays = $isVip ? 3 : 4;
            
            // Check cooldown
            if ($ad['lastPulledAt']) {
                $lastPulledTime = new DateTime($ad['lastPulledAt']);
                $currentTime = new DateTime();
                
                // Calculate exact next allowed time
                $nextPullTime = clone $lastPulledTime;
                $nextPullTime->add(new DateInterval('P' . $cooldownDays . 'D'));
                
                if ($currentTime < $nextPullTime) {
                    $timeUntilNextPull = $currentTime->diff($nextPullTime);
                    
                    Response::error('Bump cooldown active', 400, [
                        'cooldownActive' => true,
                        'isVip' => $isVip,
                        'cooldownDays' => $cooldownDays,
                        'lastPulledAt' => $ad['lastPulledAt'],
                        'nextPullAllowedAt' => $nextPullTime->format('Y-m-d H:i:s'),
                        'timeRemaining' => [
                            'days' => $timeUntilNextPull->days,
                            'hours' => $timeUntilNextPull->h,
                            'minutes' => $timeUntilNextPull->i,
                            'seconds' => $timeUntilNextPull->s
                        ]
                    ]);
                    return;
                }
            }
            
            // Update lastPulledAt and createdAt to make it appear at top
            $currentDateTime = date('Y-m-d H:i:s');
            $result = Ad::pullUpAd($adId, $currentDateTime);
            
            if ($result) {
                Response::json([
                    'success' => true,
                    'message' => 'Listing bumped successfully',
                    'lastPulledAt' => $currentDateTime,
                    'isVip' => $isVip,
                    'cooldownDays' => $cooldownDays,
                    'nextPullAllowedAt' => date('Y-m-d H:i:s', strtotime('+' . $cooldownDays . ' days'))
                ]);
            } else {
                Response::error('Failed to bump listing', 500);
            }
            
        } catch (Exception $e) {
            error_log('Bump ad error: ' . $e->getMessage());
            Response::error('Server error: ' . $e->getMessage(), 500);
        }
    }

    // Get public ads for a specific user
    public function getPublicUserAds($userId) {
        try {
            if (!$userId || !is_numeric($userId)) {
                Response::error('Valid user ID required', 400);
                return;
            }

            // Get ads for the specified user that are active and public
            $stmt = Database::getConnection()->prepare("
                SELECT a.*, u.username 
                FROM ads a 
                JOIN users u ON a.userId = u.id 
                WHERE a.userId = ? AND a.status = 'active' 
                ORDER BY a.createdAt DESC
            ");
            $stmt->execute([$userId]);
            $ads = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Process ads data
            $processedAds = [];
            foreach ($ads as $ad) {
                $processedAd = [
                    'id' => (int)$ad['id'],
                    'title' => $ad['title'],
                    'platform' => $ad['platform'],
                    'category' => $ad['category'],
                    'price' => (float)$ad['price'],
                    'subscribers' => (int)$ad['subscribers'],
                    'monthlyIncome' => (float)($ad['monthlyIncome'] ?? 0),
                    'isMonetized' => (bool)($ad['isMonetized'] ?? 0),
                    'createdAt' => $ad['createdAt'],
                    'description' => $ad['description'] ?? null,
                    'channelUrl' => $ad['channelUrl'] ?? null,
                    'thumbnail' => $ad['thumbnail'] ?? null,
                    'primary_image' => $ad['primary_image'] ?? null,
                ];

                $screenshots = [];
                if (!empty($ad['screenshots'])) {
                    $decodedScreenshots = is_string($ad['screenshots']) ? json_decode($ad['screenshots'], true) : $ad['screenshots'];
                    $screenshots = is_array($decodedScreenshots) ? $decodedScreenshots : [];
                }
                $processedAd['screenshots'] = $screenshots;
                $processedAd['images'] = [];

                $processedAds[] = $processedAd;
            }

            Response::json([
                'success' => true,
                'data' => $processedAds
            ]);

        } catch (Exception $e) {
            error_log('Get public user ads error: ' . $e->getMessage());
            Response::error('Server error', 500);
        }
    }
}
?>
