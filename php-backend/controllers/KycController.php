<?php
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../services/ReferralService.php';
require_once __DIR__ . '/../utils/Response.php';

class KycController {

    /**
     * POST /api/user/kyc/submit
     * User submits KYC document
     */
    public function submit() {
        $user = AuthMiddleware::protect();
        $pdo = Database::getConnection();

        $documentType = trim($_POST['documentType'] ?? '');
        if (empty($documentType)) {
            // Check JSON if not multipart
            $input = json_decode(file_get_contents('php://input'), true);
            $documentType = trim($input['documentType'] ?? '');
        }

        if (empty($documentType)) {
            Response::error('Document type is required', 400);
            return;
        }

        $documentUrl = '';

        // Handle file upload
        if (isset($_FILES['file']) && $_FILES['file']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['file'];
            $allowedExtensions = ['jpg', 'jpeg', 'png', 'pdf', 'webp'];
            $fileExt = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

            if (!in_array($fileExt, $allowedExtensions)) {
                Response::error('Invalid file type. Allowed: JPG, PNG, WEBP, PDF', 400);
                return;
            }

            if ($file['size'] > 10 * 1024 * 1024) { // 10MB max
                Response::error('File size exceeds 10MB limit', 400);
                return;
            }

            $uploadDir = __DIR__ . '/../uploads/kyc/';
            if (!file_exists($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }

            $fileName = 'kyc_' . $user['id'] . '_' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $fileExt;
            $destination = $uploadDir . $fileName;

            if (!move_uploaded_file($file['tmp_name'], $destination)) {
                Response::error('Failed to save uploaded document', 500);
                return;
            }

            $documentUrl = '/uploads/kyc/' . $fileName;
        } else {
            // Check for fileUrl or base64 in body
            $input = json_decode(file_get_contents('php://input'), true);
            $documentUrl = trim($input['documentUrl'] ?? '');
            if (empty($documentUrl)) {
                Response::error('Document file or URL is required', 400);
                return;
            }
        }

        try {
            // Insert KYC submission
            $stmt = $pdo->prepare("
                INSERT INTO user_kyc (user_id, document_type, document_url, status, created_at, updated_at)
                VALUES (?, ?, ?, 'pending', NOW(), NOW())
            ");
            $stmt->execute([$user['id'], $documentType, $documentUrl]);
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
                'message' => 'KYC document submitted successfully. Our team will review your submission shortly.',
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
                SELECT kyc_status, kyc_submitted_at, kyc_reviewed_at 
                FROM users WHERE id = ?
            ");
            $stmt->execute([$user['id']]);
            $userKyc = $stmt->fetch(PDO::FETCH_ASSOC);

            // Latest submission details
            $subStmt = $pdo->prepare("
                SELECT id, document_type, status, rejection_reason, created_at, reviewed_at
                FROM user_kyc
                WHERE user_id = ?
                ORDER BY created_at DESC LIMIT 1
            ");
            $subStmt->execute([$user['id']]);
            $latestSub = $subStmt->fetch(PDO::FETCH_ASSOC);

            Response::json([
                'success' => true,
                'kycStatus' => $userKyc['kyc_status'] ?? 'unverified',
                'submittedAt' => $userKyc['kyc_submitted_at'],
                'reviewedAt' => $userKyc['kyc_reviewed_at'],
                'latestSubmission' => $latestSub ?: null
            ]);
        } catch (Throwable $e) {
            error_log('Get KYC status error: ' . $e->getMessage());
            Response::error('Failed to get KYC status', 500);
        }
    }

    /**
     * GET /api/admin/kyc/pending
     * Admin view of pending KYC submissions
     */
    public function getPending() {
        $admin = AuthMiddleware::protect();
        if (($admin['role'] ?? '') !== 'admin' && ($admin['role'] ?? '') !== 'manager' && empty($admin['isAdmin'])) {
            Response::error('Access denied', 403);
            return;
        }

        $pdo = Database::getConnection();
        try {
            $stmt = $pdo->prepare("
                SELECT 
                    k.id,
                    k.user_id,
                    k.document_type,
                    k.document_url,
                    k.status,
                    k.created_at,
                    k.created_at as submitted_at,
                    u.username,
                    u.email,
                    u.profilePicture,
                    ref_u.username as referred_by_username
                FROM user_kyc k
                INNER JOIN users u ON k.user_id = u.id
                LEFT JOIN users ref_u ON u.referred_by = ref_u.id
                WHERE k.status = 'pending'
                ORDER BY k.created_at ASC
                LIMIT 50
            ");
            $stmt->execute();
            $list = $stmt->fetchAll(PDO::FETCH_ASSOC);

            Response::json([
                'success' => true,
                'data' => $list
            ]);
        } catch (Throwable $e) {
            error_log('Admin get KYC pending error: ' . $e->getMessage());
            Response::error('Failed to fetch pending KYC', 500);
        }
    }

    /**
     * POST /api/admin/kyc/review
     * Admin approves or rejects KYC
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

            if ($action === 'approve') {
                // 1. Update user_kyc record
                $pdo->prepare("
                    UPDATE user_kyc 
                    SET status = 'approved', reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() 
                    WHERE id = ?
                ")->execute([$admin['id'], $kycId]);

                // 2. Update users table
                $pdo->prepare("
                    UPDATE users 
                    SET kyc_status = 'verified', kyc_reviewed_at = NOW() 
                    WHERE id = ?
                ")->execute([$userId]);

                // 3. Trigger Referral Qualification & Free Pin rewards!
                ReferralService::qualifyReferral($userId);

                // 4. In-App Notification to User
                $pdo->prepare("
                    INSERT INTO notifications (userId, type, title, message, link, isRead, createdAt)
                    VALUES (?, 'system', 'KYC Verification Approved! ✅', 'Your identity verification has been approved. Your account now holds full verified status and perks!', CONCAT('/u/', (SELECT username FROM users WHERE id = ?)), 0, NOW())
                ")->execute([$userId, $userId]);

                Response::json([
                    'success' => true,
                    'message' => 'KYC approved successfully! Referral rewards granted.'
                ]);
            } else {
                // Reject
                $pdo->prepare("
                    UPDATE user_kyc 
                    SET status = 'rejected', rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW() 
                    WHERE id = ?
                ")->execute([$rejectionReason, $admin['id'], $kycId]);

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
                    'message' => 'KYC rejected.'
                ]);
            }
        } catch (Throwable $e) {
            error_log('Admin KYC review error: ' . $e->getMessage());
            Response::error('Failed to review KYC: ' . $e->getMessage(), 500);
        }
    }
}
