<?php
// Social media routes
switch (true) {
    case ($path === '/social-media/extract' || $path === '/social-media/extract-profile') && $method === 'POST':
        handleSocialMediaExtract();
        break;
    case $path === '/social-media/analyze' && $method === 'POST':
        handleSocialMediaAnalyze();
        break;
    case $path === '/social-media/socialblade' && $method === 'POST':
        handleSocialBladeIntegration();
        break;
    default:
        Response::error('Social media route not found', 404);
}

function handleSocialMediaExtract() {
    $input = json_decode(file_get_contents('php://input'), true);
    $url = trim($input['url'] ?? '');

    if (!$url) {
        Response::error('URL is required', 400);
        return;
    }

    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        Response::error('Invalid URL format', 400);
        return;
    }

    try {
        $parsedUrl = parse_url($url);
        $host = strtolower($parsedUrl['host'] ?? '');
        $pathValue = $parsedUrl['path'] ?? '';

        $platform = detectSocialPlatform($host);
        if (!$platform) {
            Response::error('Unsupported platform', 400);
            return;
        }

        $channelName = extractChannelNameFromUrl($platform, $pathValue, $url);
        $profileData = [
            'platform' => $platform,
            'channelName' => $channelName,
            'channelUrl' => $url,
            'title' => $channelName ? $channelName . ' - ' . ucfirst($platform) . ' Channel' : ucfirst($platform) . ' Channel',
            'description' => 'Extracted from ' . $url,
            'subscribers' => 0,
            'followers' => 0,
            'totalViews' => 0,
            'profilePicture' => '',
            'isMonetized' => false,
            'monthlyIncome' => 0,
            'category' => '',
            'contentType' => '',
            'verified' => false
        ];

        if ($platform === 'youtube') {
            $youtubeData = fetchYouTubeProfileData($url);
            $profileData = array_merge($profileData, array_filter($youtubeData, function($value) {
                return $value !== null && $value !== '';
            }));
        }

        Response::success(['data' => $profileData]);
    } catch (Exception $e) {
        error_log('Social media extract error: ' . $e->getMessage());
        Response::error('Failed to extract social media data', 500);
    }
}

function detectSocialPlatform($host) {
    if (strpos($host, 'youtube.com') !== false || strpos($host, 'youtu.be') !== false) return 'youtube';
    if (strpos($host, 'instagram.com') !== false) return 'instagram';
    if (strpos($host, 'twitter.com') !== false || strpos($host, 'x.com') !== false) return 'twitter';
    if (strpos($host, 'tiktok.com') !== false) return 'tiktok';
    if (strpos($host, 'facebook.com') !== false) return 'facebook';
    return '';
}

function extractChannelNameFromUrl($platform, $path, $url) {
    if ($platform === 'youtube') {
        if (preg_match('/\/channel\/([^\/\?]+)/', $url, $matches)) return $matches[1];
        if (preg_match('/\/@([^\/\?]+)/', $url, $matches)) return '@' . $matches[1];
        if (preg_match('/\/c\/([^\/\?]+)/', $url, $matches)) return $matches[1];
        if (preg_match('/\/user\/([^\/\?]+)/', $url, $matches)) return $matches[1];
    }

    if ($platform === 'tiktok' && preg_match('/@([^\/\?]+)/', $path, $matches)) {
        return '@' . $matches[1];
    }

    if (preg_match('/\/([^\/\?]+)\/?$/', $path, $matches)) {
        return $matches[1];
    }

    return '';
}

function fetchYouTubeProfileData($url) {
    $result = [
        'title' => null,
        'channelName' => null,
        'profilePicture' => null,
        'subscribers' => 0,
        'followers' => 0
    ];

    // oEmbed is public and does not require an API key. It normally returns the channel/title and thumbnail.
    $oembedUrl = 'https://www.youtube.com/oembed?format=json&url=' . urlencode($url);
    $oembed = fetchJsonUrl($oembedUrl);
    if (is_array($oembed)) {
        $title = $oembed['author_name'] ?? $oembed['title'] ?? null;
        if ($title) {
            $result['title'] = $title;
            $result['channelName'] = $title;
        }
        if (!empty($oembed['thumbnail_url'])) {
            $result['profilePicture'] = $oembed['thumbnail_url'];
        }
    }

    $html = fetchTextUrl($url);
    if ($html) {
        if (!$result['title'] && preg_match('/<meta property="og:title" content="([^"]+)"/i', $html, $matches)) {
            $result['title'] = html_entity_decode($matches[1], ENT_QUOTES);
            $result['channelName'] = $result['title'];
        }
        if (!$result['profilePicture'] && preg_match('/<meta property="og:image" content="([^"]+)"/i', $html, $matches)) {
            $result['profilePicture'] = html_entity_decode($matches[1], ENT_QUOTES);
        }
    }

    $apiKey = getenv('YOUTUBE_API_KEY');
    $channelId = extractYouTubeChannelId($url, $html ?: '');
    if ($apiKey && $channelId) {
        $apiUrl = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=' . urlencode($channelId) . '&key=' . urlencode($apiKey);
        $apiData = fetchJsonUrl($apiUrl);
        if (!empty($apiData['items'][0])) {
            $item = $apiData['items'][0];
            $snippet = $item['snippet'] ?? [];
            $statistics = $item['statistics'] ?? [];
            $result['title'] = $snippet['title'] ?? $result['title'];
            $result['channelName'] = $snippet['title'] ?? $result['channelName'];
            $result['profilePicture'] = $snippet['thumbnails']['default']['url'] ?? $snippet['thumbnails']['medium']['url'] ?? $result['profilePicture'];
            $subscriberCount = isset($statistics['subscriberCount']) ? (int)$statistics['subscriberCount'] : 0;
            $result['subscribers'] = $subscriberCount;
            $result['followers'] = $subscriberCount;
        }
    }

    return $result;
}

function extractYouTubeChannelId($url, $html) {
    if (preg_match('/\/channel\/(UC[^\/\?]+)/', $url, $matches)) return $matches[1];
    if ($html && preg_match('/"channelId":"(UC[^"]+)"/', $html, $matches)) return $matches[1];
    return '';
}

function fetchJsonUrl($url) {
    $text = fetchTextUrl($url);
    if (!$text) return null;
    $json = json_decode($text, true);
    return is_array($json) ? $json : null;
}

function fetchTextUrl($url) {
    $context = stream_context_create([
        'http' => [
            'timeout' => 8,
            'header' => "User-Agent: XSMMarket/1.0\r\n"
        ]
    ]);
    $response = @file_get_contents($url, false, $context);
    return $response ?: '';
}

function handleSocialMediaAnalyze() {
    $input = json_decode(file_get_contents('php://input'), true);
    $url = trim($input['url'] ?? '');

    if (!$url) {
        Response::error('URL is required', 400);
        return;
    }

    try {
        $analysisData = [
            'engagement_rate' => rand(10, 80) / 10,
            'growth_rate' => rand(-10, 50) / 10,
            'audience_demographics' => [
                'age_groups' => [
                    '18-24' => rand(20, 40),
                    '25-34' => rand(25, 45),
                    '35-44' => rand(15, 30),
                    '45+' => rand(10, 25)
                ],
                'gender' => [
                    'male' => rand(40, 60),
                    'female' => rand(40, 60)
                ]
            ],
            'performance_metrics' => [
                'avg_likes' => rand(100, 10000),
                'avg_comments' => rand(10, 1000),
                'avg_shares' => rand(5, 500)
            ],
            'content_analysis' => [
                'posting_frequency' => rand(1, 7) . ' posts per week',
                'best_posting_times' => ['10:00 AM', '3:00 PM', '8:00 PM'],
                'top_hashtags' => ['#trending', '#viral', '#content']
            ]
        ];

        Response::success(['analysis' => $analysisData]);
    } catch (Exception $e) {
        error_log('Social media analyze error: ' . $e->getMessage());
        Response::error('Failed to analyze social media data', 500);
    }
}

function handleSocialBladeIntegration() {
    $input = json_decode(file_get_contents('php://input'), true);
    $url = trim($input['url'] ?? '');

    if (!$url) {
        Response::error('URL is required', 400);
        return;
    }

    try {
        $socialBladeData = [
            'rank' => rand(1000, 100000),
            'grade' => chr(rand(65, 68)),
            'subscribers' => rand(10000, 1000000),
            'video_views' => rand(1000000, 100000000),
            'uploads' => rand(100, 5000),
            'country_rank' => rand(100, 10000),
            'channel_type' => 'Entertainment',
            'created_date' => date('Y-m-d', strtotime('-' . rand(365, 3650) . ' days')),
            'daily_stats' => [
                'subscriber_gain' => rand(-100, 1000),
                'view_gain' => rand(1000, 100000)
            ],
            'monthly_stats' => [
                'subscriber_gain' => rand(1000, 50000),
                'view_gain' => rand(100000, 5000000)
            ],
            'estimated_earnings' => [
                'daily' => '$' . rand(10, 500),
                'monthly' => '$' . rand(300, 15000),
                'yearly' => '$' . rand(3600, 180000)
            ]
        ];

        Response::success(['socialBlade' => $socialBladeData]);
    } catch (Exception $e) {
        error_log('Social Blade integration error: ' . $e->getMessage());
        Response::error('Failed to fetch Social Blade data', 500);
    }
}
?>
