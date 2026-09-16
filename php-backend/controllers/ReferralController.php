<?php
require_once __DIR__ . '/../middleware/auth.php';
require_once __DIR__ . '/../services/ReferralService.php';
require_once __DIR__ . '/../utils/Response.php';

class ReferralController {

    /**
     * GET /api/referral/dashboard
     * Returns full user referral dashboard data
     */
    public function getDashboard() {
        $user = AuthMiddleware::protect();
        try {
            $data = ReferralService::getDashboardData($user['id']);
            if (!$data) {
                Response::error('User not found', 404);
                return;
            }
            Response::json([
                'success' => true,
                'data' => $data
            ]);
        } catch (Throwable $e) {
            error_log('Referral dashboard error: ' . $e->getMessage());
            Response::error('Failed to load referral dashboard: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /api/referral/leaderboard
     * Returns top referrers
     */
    public function getLeaderboard() {
        try {
            $limit = intval($_GET['limit'] ?? 10);
            if ($limit < 1 || $limit > 50) $limit = 10;
            $leaderboard = ReferralService::getLeaderboard($limit);
            Response::json([
                'success' => true,
                'data' => $leaderboard
            ]);
        } catch (Throwable $e) {
            error_log('Referral leaderboard error: ' . $e->getMessage());
            Response::error('Failed to load leaderboard', 500);
        }
    }

    /**
     * POST /api/referral/use-pin
     * Consume 1 active Free Pin on user listing
     */
    public function usePin() {
        $user = AuthMiddleware::protect();
        $input = json_decode(file_get_contents('php://input'), true);
        $adId = intval($input['adId'] ?? 0);

        if (!$adId) {
            Response::error('Valid ad ID required', 400);
            return;
        }

        try {
            $success = ReferralService::useFreePin($user['id'], $adId);
            if ($success) {
                Response::json([
                    'success' => true,
                    'message' => 'Free Pin applied! Your listing is now pinned for 72 hours.'
                ]);
            } else {
                Response::error('No active Free Pins available, or ad does not belong to you.', 400);
            }
        } catch (Throwable $e) {
            error_log('Use Free Pin error: ' . $e->getMessage());
            Response::error('Failed to apply Free Pin', 500);
        }
    }

    /**
     * POST /api/referral/use-bump
     * Consume 1 active Free Bump on user listing
     */
    public function useBump() {
        $user = AuthMiddleware::protect();
        $input = json_decode(file_get_contents('php://input'), true);
        $adId = intval($input['adId'] ?? 0);

        if (!$adId) {
            Response::error('Valid ad ID required', 400);
            return;
        }

        try {
            $success = ReferralService::useFreeBump($user['id'], $adId);
            if ($success) {
                Response::json([
                    'success' => true,
                    'message' => 'Free Bump used! Your listing has been bumped to Position #1 on Marketplace.'
                ]);
            } else {
                Response::error('No active Free Bumps available, or ad does not belong to you.', 400);
            }
        } catch (Throwable $e) {
            error_log('Use Free Bump error: ' . $e->getMessage());
            Response::error('Failed to apply Free Bump', 500);
        }
    }

    /**
     * POST /api/referral/claim-milestone
     */
    public function claimMilestone() {
        $user = AuthMiddleware::protect();
        try {
            ReferralService::checkAndAwardMilestones($user['id']);
            $dashboard = ReferralService::getDashboardData($user['id']);
            Response::json([
                'success' => true,
                'message' => 'Milestones checked and awarded!',
                'data' => $dashboard
            ]);
        } catch (Throwable $e) {
            error_log('Claim milestone error: ' . $e->getMessage());
            Response::error('Failed to claim milestone', 500);
        }
    }
}
