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

function parseYouTubeSubscribers($text) {
    $text = html_entity_decode($text, ENT_QUOTES);
    
    // Pattern 1: e.g., "1.23M", "100K", "5B"
    if (preg_match('/([0-9.,]+)\s*([KMB])/i', $text, $m)) {
        $val = floatval(str_replace(',', '', $m[1]));
        $unit = strtoupper($m[2]);
        if ($unit === 'K') return (int)($val * 1000);
        if ($unit === 'M') return (int)($val * 1000000);
        if ($unit === 'B') return (int)($val * 1000000000);
    }
    
    // Pattern 2: e.g., "1,230", "1230"
    if (preg_match('/([0-9,.]+)/', $text, $m)) {
        $cleaned = str_replace([',', ' '], '', $m[1]);
        if (strpos($cleaned, '.') !== false && strlen(substr($cleaned, strpos($cleaned, '.') + 1)) !== 2) {
            $cleaned = str_replace('.', '', $cleaned);
        }
        return (int)$cleaned;
    }
    return 0;
}

function fetchYouTubeProfileData($url) {
    $result = [
        'title'          => null,
        'channelName'    => null,
        'profilePicture' => null,
        'subscribers'    => 0,
        'followers'      => 0
    ];

    // ── Step 1: oEmbed — reliable for channel/author name ──────────────────────
    $oembedUrl = 'https://www.youtube.com/oembed?format=json&url=' . urlencode($url);
    $oembed = fetchJsonUrl($oembedUrl);
    if (is_array($oembed)) {
        $authorName = $oembed['author_name'] ?? null;
        if ($authorName) {
            $result['title']       = $authorName;
            $result['channelName'] = $authorName;
        }
        // NOTE: oembed thumbnail_url is a VIDEO thumbnail — do NOT use as avatar
    }

    // ── Step 2: YouTube Data API v3 (best quality when key is available) ───────
    $apiKey    = getenv('YOUTUBE_API_KEY');
    $html      = '';
    $channelId = '';

    if ($apiKey) {
        // First get channel ID from URL or by searching
        $channelId = extractYouTubeChannelId($url, '');

        // If no direct channel ID, try resolving handle/@username via search
        if (!$channelId && preg_match('/\/@([^\/\?]+)/', $url, $hm)) {
            $handle    = $hm[1];
            $searchUrl = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&forHandle=' . urlencode('@' . $handle) . '&key=' . urlencode($apiKey);
            $searchData = fetchJsonUrl($searchUrl);
            if (!empty($searchData['items'][0])) {
                $channelId = $searchData['items'][0]['id'] ?? '';
            }
        }

        if ($channelId) {
            $apiUrl  = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=' . urlencode($channelId) . '&key=' . urlencode($apiKey);
            $apiData = fetchJsonUrl($apiUrl);
            if (!empty($apiData['items'][0])) {
                $item      = $apiData['items'][0];
                $snippet   = $item['snippet']    ?? [];
                $statistics = $item['statistics'] ?? [];

                $apiTitle = $snippet['title'] ?? null;
                if ($apiTitle) {
                    $result['title']       = $apiTitle;
                    $result['channelName'] = $apiTitle;
                }

                // Use the highest resolution available (medium 240px is good for avatar)
                $avatarUrl = $snippet['thumbnails']['high']['url']
                          ?? $snippet['thumbnails']['medium']['url']
                          ?? $snippet['thumbnails']['default']['url']
                          ?? null;
                if ($avatarUrl) {
                    $result['profilePicture'] = $avatarUrl;
                }

                $subCount = isset($statistics['subscriberCount']) ? (int)$statistics['subscriberCount'] : 0;
                if ($subCount > 0) {
                    $result['subscribers'] = $subCount;
                    $result['followers']   = $subCount;
                }

                // If we got all three key fields from the API, return immediately
                if ($result['title'] && $result['profilePicture'] && $result['subscribers'] > 0) {
                    return $result;
                }
            }
        }
    }

    // ── Step 3: HTML scrape — avatar from ytInitialData JSON ───────────────────
    $html = fetchTextUrl($url);
    if (!$html) return $result;

    // Unescape JSON escaped slashes so our regexes can match easily
    $html = str_replace('\/', '/', $html);

    // Channel name from og:title (overrides URL-extracted name)
    if (!$result['title'] && preg_match('/<meta property="og:title" content="([^"]+)"/i', $html, $m)) {
        $name = html_entity_decode($m[1], ENT_QUOTES);
        $result['title']       = $name;
        $result['channelName'] = $name;
    }

    // YouTube now uses BOTH yt3.googleusercontent.com AND yt3.ggpht.com for avatars, 
    // and sometimes lh3.googleusercontent.com for default/Google-linked avatars.
    // All patterns must match these CDNs.
    $ytAvatarPattern = 'https:\/\/(yt3\.googleusercontent\.com|yt3\.ggpht\.com|lh3\.googleusercontent\.com)\/[^"\s]+';

    // --- Avatar extraction strategies (priority order) ---

    // Strategy A: c4TabbedHeaderRenderer avatar (channel home page header)
    if (!$result['profilePicture'] && preg_match(
        '/"c4TabbedHeaderRenderer".*?"avatar"\s*:\s*\{\s*"thumbnails"\s*:\s*\[\s*\{\s*"url"\s*:\s*"(' . $ytAvatarPattern . ')"/is',
        $html, $m
    )) {
        $result['profilePicture'] = $m[1];
    }

    // Strategy B: any "avatar":{"thumbnails":[{"url":"yt3...
    if (!$result['profilePicture'] && preg_match(
        '/"avatar"\s*:\s*\{\s*"thumbnails"\s*:\s*\[\s*\{[^}]{0,200}"url"\s*:\s*"(' . $ytAvatarPattern . ')"/i',
        $html, $m
    )) {
        $result['profilePicture'] = $m[1];
    }

    // Strategy C: pageHeaderViewModel image sources
    if (!$result['profilePicture'] && preg_match(
        '/"avatarViewModel"[^}]{0,500}"url"\s*:\s*"(' . $ytAvatarPattern . ')"/is',
        $html, $m
    )) {
        $result['profilePicture'] = $m[1];
    }

    // Strategy D: decoratedAvatarViewModel (newer YouTube layout)
    if (!$result['profilePicture'] && preg_match(
        '/"decoratedAvatarViewModel"[^}]{0,800}"url"\s*:\s*"(' . $ytAvatarPattern . ')"/is',
        $html, $m
    )) {
        $result['profilePicture'] = $m[1];
    }

    // Strategy E: "avatar" key near any yt3 CDN URL
    if (!$result['profilePicture'] && preg_match(
        '/"avatar[^"]*"\s*:\s*\{[^}]{0,300}"url"\s*:\s*"(' . $ytAvatarPattern . ')"/i',
        $html, $m
    )) {
        $result['profilePicture'] = $m[1];
    }

    // Strategy F: first yt3.googleusercontent.com URL (new CDN — try before ggpht)
    if (!$result['profilePicture'] && preg_match(
        '/(https:\/\/yt3\.googleusercontent\.com\/[A-Za-z0-9_\-\/=?%]+)/i',
        $html, $m
    )) {
        $result['profilePicture'] = $m[1];
    }

    // Strategy G: first yt3.ggpht.com URL (legacy CDN fallback)
    if (!$result['profilePicture'] && preg_match(
        '/(https:\/\/yt3\.ggpht\.com\/[A-Za-z0-9_\-\/=?%]+)/i',
        $html, $m
    )) {
        $result['profilePicture'] = $m[1];
    }

    // Strategy H: first lh3.googleusercontent.com URL (Google account fallback)
    if (!$result['profilePicture'] && preg_match(
        '/(https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9_\-\/=?%]+)/i',
        $html, $m
    )) {
        $result['profilePicture'] = $m[1];
    }

    // Normalise avatar size — request 240px crop
    if ($result['profilePicture']) {
        // Strip =sXX, =sXX-c, or complex flags like =s176-c-k-c0x00ffffff-no-rj
        $result['profilePicture'] = preg_replace('/=s\d+(-[a-zA-Z0-9\-]+)*$/', '', $result['profilePicture']);
        $result['profilePicture'] = rtrim($result['profilePicture'], '=') . '=s240-c';
    }

    // --- Subscriber count from ytInitialData (multiple patterns) ---
    $subCount = 0;

    // Pattern 1: subscriberCountText simpleText (classic layout)
    if (preg_match('/"subscriberCountText"\s*:\s*\{\s*"simpleText"\s*:\s*"([^"]+)"/i', $html, $m)) {
        $subCount = parseYouTubeSubscribers($m[1]);
    }
    // Pattern 2: subscriberCountText label (new layout)
    if (!$subCount && preg_match('/"subscriberCountText"\s*:\s*\{[^{}]{0,80}"label"\s*:\s*"([^"]+)"/i', $html, $m)) {
        $subCount = parseYouTubeSubscribers($m[1]);
    }
    // Pattern 3: metadataParts subscriber label
    if (!$subCount && preg_match('/"metadataParts"[^}]{0,500}"([0-9,.KMBk]+)\s+subscriber/i', $html, $m)) {
        $subCount = parseYouTubeSubscribers($m[1]);
    }
    // Pattern 4: channelAboutFullMetadataRenderer subscriberCountText
    if (!$subCount && preg_match('/"channelAboutFullMetadataRenderer"[^}]{0,800}"subscriberCountText"[^}]{0,80}"simpleText"\s*:\s*"([^"]+)"/is', $html, $m)) {
        $subCount = parseYouTubeSubscribers($m[1]);
    }
    // Pattern 5: "subscribers" appearing after a count in any JSON string
    if (!$subCount && preg_match('/"([0-9,.]+[KMBk]?)\s+subscribers?"/i', $html, $m)) {
        $subCount = parseYouTubeSubscribers($m[1]);
    }
    // Pattern 6: viewCountText as last resort (total views as proxy, skip)
    // Actually try numeric extraction near subscriberCount key
    if (!$subCount && preg_match('/"subscriberCount"\s*:\s*"([0-9]+)"/i', $html, $m)) {
        $subCount = (int)$m[1];
    }

    if ($subCount > 0) {
        $result['subscribers'] = $subCount;
        $result['followers']   = $subCount;
    }

    // Fill channel name from channelMetadataRenderer if still missing
    if (!$result['title'] && preg_match('/"channelMetadataRenderer"\s*:\s*\{[^}]{0,200}"title"\s*:\s*"([^"]+)"/i', $html, $m)) {
        $result['title']       = html_entity_decode($m[1], ENT_QUOTES);
        $result['channelName'] = $result['title'];
    }

    // Try extracting channel ID from HTML and calling API if key is set
    if ($apiKey && !$channelId) {
        $channelId = extractYouTubeChannelId($url, $html);
        if ($channelId) {
            $apiUrl  = 'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=' . urlencode($channelId) . '&key=' . urlencode($apiKey);
            $apiData = fetchJsonUrl($apiUrl);
            if (!empty($apiData['items'][0])) {
                $item      = $apiData['items'][0];
                $snippet   = $item['snippet']    ?? [];
                $statistics = $item['statistics'] ?? [];
                if (!empty($snippet['title'])) {
                    $result['title']       = $snippet['title'];
                    $result['channelName'] = $snippet['title'];
                }
                $avatarUrl = $snippet['thumbnails']['high']['url']
                          ?? $snippet['thumbnails']['medium']['url']
                          ?? $snippet['thumbnails']['default']['url']
                          ?? null;
                if ($avatarUrl) $result['profilePicture'] = $avatarUrl;
                $subCount = isset($statistics['subscriberCount']) ? (int)$statistics['subscriberCount'] : 0;
                if ($subCount > 0) {
                    $result['subscribers'] = $subCount;
                    $result['followers']   = $subCount;
                }
            }
        }
    }

    return $result;
}

function extractYouTubeChannelId($url, $html) {
    if (preg_match('/\/channel\/(UC[^\/\?]+)/', $url, $matches)) return $matches[1];
    if ($html) {
        if (preg_match('/"channelId"\s*:\s*"(UC[^"]+)"/', $html, $matches)) return $matches[1];
        if (preg_match('/<meta itemprop="channelId" content="(UC[^"]+)"/i', $html, $matches)) return $matches[1];
        if (preg_match('/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[^"]+)"/i', $html, $matches)) return $matches[1];
        if (preg_match('/youtube\.com\/channel\/(UC[^"\/]+)/i', $html, $matches)) return $matches[1];
    }
    return '';
}

function fetchJsonUrl($url) {
    $text = fetchTextUrl($url);
    if (!$text) return null;
    $json = json_decode($text, true);
    return is_array($json) ? $json : null;
}

function fetchTextUrl($url) {
    // Use curl with full browser headers — YouTube requires Accept-Language etc to return ytInitialData
    if (function_exists('curl_init')) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 5,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_ENCODING       => '',   // let curl handle gzip/deflate automatically
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            CURLOPT_HTTPHEADER     => [
                'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language: en-US,en;q=0.9',
                'Accept-Encoding: gzip, deflate, br',
                'Cache-Control: no-cache',
                'Pragma: no-cache',
                'Sec-Fetch-Dest: document',
                'Sec-Fetch-Mode: navigate',
                'Sec-Fetch-Site: none',
                'Upgrade-Insecure-Requests: 1',
            ],
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($response && $httpCode >= 200 && $httpCode < 400) {
            return $response;
        }
    }
    // Fallback: file_get_contents
    $context = stream_context_create([
        'http' => [
            'timeout' => 10,
            'header'  =>
                "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36\r\n" .
                "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n" .
                "Accept-Language: en-US,en;q=0.9\r\n"
        ]
    ]);
    return @file_get_contents($url, false, $context) ?: '';
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
