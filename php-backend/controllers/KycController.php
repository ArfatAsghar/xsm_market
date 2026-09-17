<?php
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../services/ReferralService.php';
require_once __DIR__ . '/../utils/Response.php';

class KycController {

    /**
     * Helper to process an uploaded image file
     */
    private function processUpload($fileKey, $userId, $suffix) {
        if (!isset($_FILES[$fileKey]) || $_FILES[$fileKey]['error'] !== UPLOAD_ERR_OK) {
            return null;
        }

        $file = $_FILES[$fileKey];
        $allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf', 'webp'];
        $fileExt = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

        if (!in_array($fileExt, $allowedExtensions)) {
            return false; // Invalid extension
        }

        if ($file['size'] > 10 * 1024 * 1024) { // 10MB max
            return false;
        }

        $uploadDir = __DIR__ . '/../uploads/kyc/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $fileName = 'kyc_' . $userId . '_' . $suffix . '_' . time() . '_' . bin2hex(random_bytes(3)) . '.' . $fileExt;
        $destination = $uploadDir . $fileName;

        if (!move_uploaded_file($file['tmp_name'], $destination)) {
            return null;
        }

        return '/uploads/kyc/' . $fileName;
    }

    /**
     * POST /api/user/kyc/submit
     * User submits KYC with CNIC/Passport/License details, Front, Back, and Live Selfie
     */
    public function submit() {
        $user = AuthMiddleware::protect();
        $pdo = Database::getConnection();

        // 1. Prevent duplicate submissions if already pending or approved
        $existingStmt = $pdo->prepare("SELECT status FROM user_kyc WHERE user_id = ? AND status IN ('pending', 'approved') LIMIT 1");
        $existingStmt->execute([$user['id']]);
        if ($existingRow = $existingStmt->fetch(PDO::FETCH_ASSOC)) {
            if ($existingRow['status'] === 'approved') {
                Response::error('Your account identity is already verified! No further upload required.', 400);
                return;
            }
            Response::error('You already have a KYC verification pending review. Please wait for staff approval.', 400);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $documentType = trim($_POST['documentType'] ?? $_POST['document_type'] ?? $input['documentType'] ?? '');
        $idNumber = trim($_POST['idNumber'] ?? $_POST['id_number'] ?? $_POST['cnicNumber'] ?? $input['idNumber'] ?? '');

        if (empty($documentType)) {
            Response::error('Document type (CNIC, Driving License, or Passport) is required.', 400);
            return;
        }

        if (empty($idNumber)) {
            Response::error('CNIC / Document Identification Number is required.', 400);
            return;
        }

        // 2. Check if this CNIC/ID number is already verified on another account
        $dupStmt = $pdo->prepare("SELECT id, username FROM users WHERE kyc_id_number = ? AND id != ? AND kyc_status = 'verified' LIMIT 1");
        $dupStmt->execute([$idNumber, $user['id']]);
        if ($dupUser = $dupStmt->fetch(PDO::FETCH_ASSOC)) {
            Response::error("This CNIC / ID Number is already registered and verified on another account (@{$dupUser['username']}). Duplicate IDs are prohibited.", 400);
            return;
        }

        // 3. Process uploads for Front, Back, and Live Selfie
        // Front image
        $frontUrl = $this->processUpload('frontImage', $user['id'], 'front')
                 ?: $this->processUpload('front', $user['id'], 'front')
                 ?: $this->processUpload('document', $user['id'], 'front')
                 ?: $this->processUpload('file', $user['id'], 'front');

        // Back image
        $backUrl = $this->processUpload('backImage', $user['id'], 'back')
                ?: $this->processUpload('back', $user['id'], 'back');

        // Selfie image
        $selfieUrl = $this->processUpload('selfieImage', $user['id'], 'selfie')
                  ?: $this->processUpload('selfie', $user['id'], 'selfie');

        // Check fallback JSON URLs if submitted as base64 or pre-uploaded URLs
        if (!$frontUrl && !empty($input['frontUrl'])) $frontUrl = trim($input['frontUrl']);
        if (!$backUrl && !empty($input['backUrl'])) $backUrl = trim($input['backUrl']);
        if (!$selfieUrl && !empty($input['selfieUrl'])) $selfieUrl = trim($input['selfieUrl']);

        if (!$frontUrl) {
            Response::error('Front side image of your document is required.', 400);
            return;
        }

        if (!$selfieUrl) {
            Response::error('A live selfie image holding or displaying your face is required for identity confirmation.', 400);
            return;
        }

        $documentUrl = $frontUrl; // Backward compatibility

        try {
            // Insert KYC submission
            $stmt = $pdo->prepare("
                INSERT INTO user_kyc (
                    user_id, document_type, id_number, document_url, 
                    front_image_url, back_image_url, selfie_image_url, 
                    status, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())
            ");
            $stmt->execute([
                $user['id'], 
                $documentType, 
                $idNumber, 
                $documentUrl, 
                $frontUrl, 
                $backUrl, 
                $selfieUrl
            ]);
            $kycId = $pdo->lastInsertId();

            // Update users table status to pending
            $pdo->prepare("
                UPDATE users 
                SET kyc_status = 'pending', kyc_submitted_at = NOW() 
                WHERE id = ?
            ")->execute([$user['id']]);

            // Update referral status if referred
            $pdo->prepare("
                UPDATE referrals 
                SET status = 'kyc_pending', updated_at = NOW() 
                WHERE referred_user_id = ? AND status = 'registered'
            ")->execute([$user['id']]);

            Response::json([
                'success' => true,
                'message' => 'KYC verification submitted successfully! Our verification staff will review your documents.',
                'kycId' => $kycId,
                'status' => 'pending'
            ]);
        } catch (Throwable $e) {
            error_log('KYC submission error: ' . $e->getMessage());
            Response::error('Server error submitting KYC: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/user/kyc/status
     */
    public function getStatus() {
        $user = AuthMiddleware::protect();
        $pdo = Database::getConnection();

        try {
            $stmt = $pdo->prepare("
                SELECT kyc_status, kyc_id_number, kyc_submitted_at, kyc_reviewed_at 
                FROM users WHERE id = ?
            ");
            $stmt->execute([$user['id']]);
            $userKyc = $stmt->fetch(PDO::FETCH_ASSOC);

            // Latest submission details
            $subStmt = $pdo->prepare("
                SELECT id, document_type, id_number, document_url, front_image_url, back_image_url, selfie_image_url, status, admin_notes, rejection_reason, created_at, reviewed_at
                FROM user_kyc
                WHERE user_id = ?
                ORDER BY created_at DESC LIMIT 1
            ");
            $subStmt->execute([$user['id']]);
            $latestSub = $subStmt->fetch(PDO::FETCH_ASSOC);

            $effectiveStatus = $userKyc['kyc_status'] ?? ($latestSub['status'] ?? 'unverified');

            Response::json([
                'success' => true,
                'kycStatus' => $effectiveStatus,
                'submittedAt' => $userKyc['kyc_submitted_at'],
                'reviewedAt' => $userKyc['kyc_reviewed_at'],
                'latestSubmission' => $latestSub ?: null,
                'data' => [
                    'kyc_status' => $effectiveStatus,
                    'id_number' => $latestSub['id_number'] ?? $userKyc['kyc_id_number'] ?? null,
                    'document_type' => $latestSub['document_type'] ?? null,
                    'document_url' => $latestSub['document_url'] ?? null,
                    'front_image_url' => $latestSub['front_image_url'] ?? $latestSub['document_url'] ?? null,
                    'back_image_url' => $latestSub['back_image_url'] ?? null,
                    'selfie_image_url' => $latestSub['selfie_image_url'] ?? null,
                    'admin_notes' => $latestSub['rejection_reason'] ?? $latestSub['admin_notes'] ?? null
                ]
            ]);
        } catch (Throwable $e) {
            error_log('Get KYC status error: ' . $e->getMessage());
            Response::error('Failed to get KYC status', 500);
        }
    }

    /**
     * GET /api/admin/kyc/pending or /api/admin/kyc/all
     * Admin view of KYC submissions with filter support
     */
    public function getPending() {
        $admin = AuthMiddleware::protect();
        if (($admin['role'] ?? '') !== 'admin' && ($admin['role'] ?? '') !== 'manager' && empty($admin['isAdmin'])) {
            Response::error('Access denied', 403);
            return;
        }

        $filterStatus = trim($_GET['status'] ?? 'pending');
        $pdo = Database::getConnection();

        try {
            $whereClause = "WHERE 1=1";
            $params = [];
            if ($filterStatus !== 'all' && in_array($filterStatus, ['pending', 'approved', 'rejected'])) {
                $whereClause .= " AND k.status = ?";
                $params[] = $filterStatus;
            }

            $sql = "
                SELECT 
                    k.id,
                    k.user_id,
                    k.document_type,
                    k.id_number,
                    k.document_url,
                    k.front_image_url,
                    k.back_image_url,
                    k.selfie_image_url,
                    k.status,
                    k.admin_notes,
                    k.rejection_reason,
                    k.created_at,
                    k.created_at as submitted_at,
                    k.reviewed_at,
                    u.username,
                    u.email,
                    u.profilePicture,
                    u.kyc_id_number as user_verified_id,
                    ref_u.username as referred_by_username
                FROM user_kyc k
                INNER JOIN users u ON k.user_id = u.id
                LEFT JOIN users ref_u ON u.referred_by = ref_u.id
                {$whereClause}
                ORDER BY CASE WHEN k.status = 'pending' THEN 0 ELSE 1 END, k.created_at DESC
                LIMIT 100
            ";

            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            $list = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Cross-check each submission for duplicate ID numbers
            foreach ($list as &$item) {
                $item['front_image_url'] = $item['front_image_url'] ?: $item['document_url'];
                $idNum = trim($item['id_number'] ?? '');
                $item['is_duplicate'] = false;
                $item['duplicate_user'] = null;

                if (!empty($idNum)) {
                    $dupStmt = $pdo->prepare("
                        SELECT u.id as user_id, u.username, u.email, k2.id as kyc_id 
                        FROM users u 
                        LEFT JOIN user_kyc k2 ON k2.user_id = u.id AND k2.status = 'approved'
                        WHERE (u.kyc_id_number = ? OR k2.id_number = ?) AND u.id != ? AND u.kyc_status = 'verified'
                        LIMIT 1
                    ");
                    $dupStmt->execute([$idNum, $idNum, $item['user_id']]);
                    if ($dup = $dupStmt->fetch(PDO::FETCH_ASSOC)) {
                        $item['is_duplicate'] = true;
                        $item['duplicate_user'] = $dup;
                    }
                }
            }

            Response::json([
                'success' => true,
                'data' => $list
            ]);
        } catch (Throwable $e) {
            error_log('Admin get KYC list error: ' . $e->getMessage());
            Response::error('Failed to fetch KYC submissions', 500);
        }
    }

    /**
     * POST /api/admin/kyc/check-duplicate
     * Proactively checks whether a CNIC / ID Number is registered to another user
     */
    public function checkDuplicate() {
        $admin = AuthMiddleware::protect();
        if (($admin['role'] ?? '') !== 'admin' && ($admin['role'] ?? '') !== 'manager' && empty($admin['isAdmin'])) {
            Response::error('Access denied', 403);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $idNumber = trim($input['idNumber'] ?? $input['id_number'] ?? $input['cnicNumber'] ?? '');
        $currentUserId = intval($input['userId'] ?? $input['user_id'] ?? 0);

        if (empty($idNumber)) {
            Response::json(['success' => true, 'isDuplicate' => false]);
            return;
        }

        $pdo = Database::getConnection();
        try {
            $stmt = $pdo->prepare("
                SELECT u.id as user_id, u.username, u.email, u.profilePicture, k.id as kyc_id, k.created_at as verified_at
                FROM users u 
                LEFT JOIN user_kyc k ON k.user_id = u.id AND k.status = 'approved'
                WHERE (u.kyc_id_number = ? OR k.id_number = ?) AND u.id != ? AND u.kyc_status = 'verified'
                LIMIT 1
            ");
            $stmt->execute([$idNumber, $idNumber, $currentUserId]);
            $duplicate = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($duplicate) {
                Response::json([
                    'success' => true,
                    'isDuplicate' => true,
                    'message' => "This CNIC / ID Number is already registered to user @{$duplicate['username']}!",
                    'duplicateUser' => $duplicate
                ]);
            } else {
                Response::json([
                    'success' => true,
                    'isDuplicate' => false
                ]);
            }
        } catch (Throwable $e) {
            error_log('Check duplicate CNIC error: ' . $e->getMessage());
            Response::error('Failed to check CNIC uniqueness', 500);
        }
    }

    /**
     * POST /api/admin/kyc/review
     * Admin approves or rejects KYC, with CNIC uniqueness validation
     */
    public function review() {
        $admin = AuthMiddleware::protect();
        if (($admin['role'] ?? '') !== 'admin' && ($admin['role'] ?? '') !== 'manager' && empty($admin['isAdmin'])) {
            Response::error('Access denied', 403);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $kycId = intval($input['kycId'] ?? $input['kyc_id'] ?? 0);
        $action = strtolower(trim($input['action'] ?? $input['status'] ?? ''));
        if ($action === 'approved') $action = 'approve';
        if ($action === 'rejected') $action = 'reject';
        $rejectionReason = trim($input['reason'] ?? $input['notes'] ?? 'Document could not be verified');
        $idNumber = trim($input['idNumber'] ?? $input['id_number'] ?? $input['cnicNumber'] ?? '');

        if (!$kycId || !in_array($action, ['approve', 'reject'])) {
            Response::error('Valid kycId and action (approve/reject) required', 400);
            return;
        }

        $pdo = Database::getConnection();
        try {
            $stmt = $pdo->prepare("SELECT * FROM user_kyc WHERE id = ?");
            $stmt->execute([$kycId]);
            $kyc = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$kyc) {
                Response::error('KYC submission not found', 404);
                return;
            }

            $userId = (int)$kyc['user_id'];
            $finalIdNumber = !empty($idNumber) ? $idNumber : trim($kyc['id_number'] ?? '');

            if ($action === 'approve') {
                // 1. Mandatory CNIC / ID Number check
                if (empty($finalIdNumber)) {
                    Response::error('Please enter and confirm the applicant\'s CNIC / ID Number before approving.', 400);
                    return;
                }

                // 2. Uniqueness verification — check if another verified user holds this CNIC
                $dupCheck = $pdo->prepare("
                    SELECT u.id as user_id, u.username, u.email, k2.id as kyc_id 
                    FROM users u 
                    LEFT JOIN user_kyc k2 ON k2.user_id = u.id AND k2.status = 'approved'
                    WHERE (u.kyc_id_number = ? OR k2.id_number = ?) AND u.id != ? AND u.kyc_status = 'verified'
                    LIMIT 1
                ");
                $dupCheck->execute([$finalIdNumber, $finalIdNumber, $userId]);
                if ($duplicate = $dupCheck->fetch(PDO::FETCH_ASSOC)) {
                    Response::json([
                        'success' => false,
                        'isDuplicate' => true,
                        'message' => "Approval Blocked: CNIC / ID Number ({$finalIdNumber}) is already registered and verified on user @{$duplicate['username']}!",
                        'duplicateUser' => $duplicate
                    ], 400);
                    return;
                }

                // 3. Update user_kyc record
                $pdo->prepare("
                    UPDATE user_kyc 
                    SET id_number = ?, status = 'approved', reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() 
                    WHERE id = ?
                ")->execute([$finalIdNumber, $admin['id'], $kycId]);

                // 4. Update users table with verified status and unique CNIC
                $pdo->prepare("
                    UPDATE users 
                    SET kyc_status = 'verified', kyc_id_number = ?, kyc_reviewed_at = NOW() 
                    WHERE id = ?
                ")->execute([$finalIdNumber, $userId]);

                // 5. Trigger Referral Qualification & Free Pin rewards!
                ReferralService::qualifyReferral($userId);

                // 6. In-App Notification to User
                $pdo->prepare("
                    INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                    VALUES (?, 'system', 'KYC Verification Approved! ✅', 'Your identity verification has been approved. Your account now holds full verified status and perks!', CONCAT('/u/', (SELECT username FROM users WHERE id = ?)), 0, NOW())
                ")->execute([$userId, $userId]);

                Response::json([
                    'success' => true,
                    'message' => 'KYC approved successfully! Verified CNIC saved and referral rewards unlocked.'
                ]);
            } else {
                // Reject
                $pdo->prepare("
                    UPDATE user_kyc 
                    SET status = 'rejected', rejection_reason = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() 
                    WHERE id = ?
                ")->execute([$rejectionReason, $rejectionReason, $admin['id'], $kycId]);

                $pdo->prepare("
                    UPDATE users 
                    SET kyc_status = 'rejected', kyc_reviewed_at = NOW() 
                    WHERE id = ?
                ")->execute([$userId]);

                // In-App Notification
                $pdo->prepare("
                    INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                    VALUES (?, 'system', 'KYC Verification Notice ⚠️', 'Your KYC submission was not approved: {$rejectionReason}. Please re-submit valid documentation.', '/verify', 0, NOW())
                ")->execute([$userId]);

                Response::json([
                    'success' => true,
                    'message' => 'KYC application rejected.'
                ]);
            }
        } catch (Throwable $e) {
            error_log('Admin KYC review error: ' . $e->getMessage());
            Response::error('Failed to review KYC: ' . $e->getMessage(), 500);
        }
    }
}
