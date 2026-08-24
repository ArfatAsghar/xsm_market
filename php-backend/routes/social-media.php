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
    $verificationCode = trim($input['verificationCode'] ?? '');

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
            'verified' => false,
            'codeVerified' => false,
            'verificationCode' => $verificationCode
        ];

        $extracted = [];
        if ($platform === 'youtube') {
            $extracted = fetchYouTubeProfileData($url, $verificationCode);
        } elseif ($platform === 'tiktok') {
            $extracted = fetchTikTokProfileData($url, $verificationCode);
        } elseif ($platform === 'instagram') {
            $extracted = fetchInstagramProfileData($url, $verificationCode);
        } elseif ($platform === 'twitter') {
            $extracted = fetchTwitterProfileData($url, $verificationCode);
        } elseif ($platform === 'facebook') {
            $extracted = fetchFacebookProfileData($url, $verificationCode);
        } elseif ($platform === 'telegram') {
            $extracted = fetchTelegramProfileData($url, $verificationCode);
        }

        foreach ($extracted as $key => $value) {
            // Allow 0 integer/float through — only skip actual null / empty string
            if ($value !== null && $value !== '') {
                $profileData[$key] = $value;
            } elseif (is_int($value) || is_float($value)) {
                // Explicitly preserve numeric 0 so subscribers=0 is passed to frontend
                $profileData[$key] = $value;
            }
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
    if (strpos($host, 't.me') !== false || strpos($host, 'telegram.me') !== false) return 'telegram';
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

function fetchYouTubeProfileData($url, $verificationCode = '') {
    $result = [
        'title'            => null,
        'channelName'      => null,
        'profilePicture'   => null,
        'subscribers'      => 0,
        'followers'        => 0,
        'codeVerified'     => false,
        'verificationCode' => $verificationCode
    ];

    $apiDescription = '';
    $apiKey         = getenv('YOUTUBE_API_KEY');
    $html           = '';
    $channelId      = '';

    // ── Step 1: oEmbed — reliable for channel/author name ──────────────────────
    $oembedUrl = 'https://www.youtube.com/oembed?format=json&url=' . urlencode($url);
    $oembed = fetchJsonUrl($oembedUrl);
    if (is_array($oembed)) {
        $authorName = $oembed['author_name'] ?? null;
        if ($authorName) {
            $result['title']       = $authorName;
            $result['channelName'] = $authorName;
        }
    }

    // ── Step 2: YouTube Data API v3 (best quality when key is available) ───────
    if ($apiKey) {
        $channelId = extractYouTubeChannelId($url, '');

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
                $item       = $apiData['items'][0];
                $snippet    = $item['snippet']    ?? [];
                $statistics = $item['statistics'] ?? [];

                $apiDescription = $snippet['description'] ?? '';

                $apiTitle = $snippet['title'] ?? null;
                if ($apiTitle) {
                    $result['title']       = $apiTitle;
                    $result['channelName'] = $apiTitle;
                }

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
            }
        }
    }

    // ── Step 3: HTML scrape — avatar from ytInitialData JSON & Verification check ───────────────────
    $html = fetchTextUrl($url);
    if ($html) {
        $html = str_replace('\/', '/', $html);
    }

    // Check verification code against API description AND HTML source
    if (!empty($verificationCode)) {
        $code = trim($verificationCode);
        $foundInApi  = !empty($apiDescription) && (stripos($apiDescription, $code) !== false);
        $foundInHtml = !empty($html) && (stripos($html, $code) !== false);
        $result['codeVerified'] = ($foundInApi || $foundInHtml);
    } else {
        $result['codeVerified'] = true;
    }

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

function getRapidApiKey() {
    $envKey = getenv('RAPIDAPI_KEY');
    if ($envKey) return $envKey;
    return '0951108164mshd9a0970e7be24efp175df6jsn1104858fd362';
}

function fetchTikTokProfileData($url, $verificationCode = '') {
    $result = [
        'title'            => null,
        'channelName'      => null,
        'profilePicture'   => null,
        'subscribers'      => 0,
        'followers'        => 0,
        'description'      => null,
        'codeVerified'     => false,
        'verificationCode' => $verificationCode
    ];

    $apiKey = getRapidApiKey();
    $handle = '';
    if (preg_match('/@([^\/\?]+)/', $url, $m)) {
        $handle = $m[1];
    } elseif (preg_match('/tiktok\.com\/([^\/\?]+)/', $url, $m)) {
        $handle = ltrim($m[1], '@');
    }

    if (!$handle) return $result;

    $result['channelName'] = '@' . $handle;
    $result['title']       = '@' . $handle . ' TikTok';

    // ── RapidAPI Call: TikTok Scraper ────────────────
    if ($apiKey) {
        $rapidUrl = 'https://tiktok-all-in-one-api.p.rapidapi.com/user/info?username=' . urlencode($handle);
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $rapidUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_HTTPHEADER => [
                'X-RapidAPI-Key: ' . $apiKey,
                'X-RapidAPI-Host: tiktok-all-in-one-api.p.rapidapi.com'
            ]
        ]);
        $response = curl_exec($ch);
        curl_close($ch);

        if ($response) {
            $json = json_decode($response, true);
            $userInfo = $json['user'] ?? $json['data']['user'] ?? $json['userInfo']['user'] ?? $json['data'] ?? [];
            $stats    = $json['stats'] ?? $json['data']['stats'] ?? $json['userInfo']['stats'] ?? [];

            if (!empty($userInfo)) {
                $result['title']          = $userInfo['nickname'] ?? $userInfo['uniqueId'] ?? ('@' . $handle);
                $result['channelName']    = '@' . ($userInfo['uniqueId'] ?? $handle);
                $result['profilePicture'] = $userInfo['avatarLarger'] ?? $userInfo['avatarMedium'] ?? $userInfo['avatarThumb'] ?? null;
                $result['description']    = $userInfo['signature'] ?? '';

                $followerCount = $stats['followerCount'] ?? $userInfo['followerCount'] ?? null;
                if ($followerCount !== null) {
                    $result['subscribers'] = (int)$followerCount;
                    $result['followers']   = (int)$followerCount;
                }
            }
        }
    }

    // Fallback HTML scrape for TikTok avatar & bio
    if (!$result['profilePicture'] || !$result['description']) {
        $html = fetchTextUrl('https://www.tiktok.com/@' . urlencode($handle));
        if ($html) {
            if (!$result['title'] && preg_match('/<meta property="og:title" content="([^"]+)"/i', $html, $m)) {
                $result['title'] = html_entity_decode($m[1], ENT_QUOTES);
            }
            if (!$result['description'] && preg_match('/<meta property="og:description" content="([^"]+)"/i', $html, $m)) {
                $result['description'] = html_entity_decode($m[1], ENT_QUOTES);
            }
            if (!$result['profilePicture'] && preg_match('/<meta property="og:image" content="([^"]+)"/i', $html, $m)) {
                $result['profilePicture'] = $m[1];
            }
            // Try multiple patterns to extract follower count from TikTok HTML
            if (!isset($result['followersExtracted']) && preg_match('/"followerCount"\s*:\s*([0-9]+)/i', $html, $m)) {
                $result['subscribers'] = (int)$m[1];
                $result['followers']   = (int)$m[1];
            } elseif (!isset($result['followersExtracted']) && preg_match('/"fans"\s*:\s*([0-9]+)/i', $html, $m)) {
                $result['subscribers'] = (int)$m[1];
                $result['followers']   = (int)$m[1];
            }
        }
    }

    if (!empty($verificationCode)) {
        $code = trim($verificationCode);
        $result['codeVerified'] = !empty($result['description']) && (stripos($result['description'], $code) !== false);
    } else {
        $result['codeVerified'] = true;
    }

    return $result;
}

function fetchInstagramProfileData($url, $verificationCode = '') {
    $result = [
        'title'            => null,
        'channelName'      => null,
        'profilePicture'   => null,
        'subscribers'      => 0,
        'followers'        => 0,
        'description'      => null,
        'codeVerified'     => false,
        'verificationCode' => $verificationCode
    ];

    $apiKey = getRapidApiKey();
    $handle = '';
    if (preg_match('/instagram\.com\/([^\/\?]+)/', $url, $m)) {
        $handle = trim($m[1]);
    }

    if (!$handle || in_array($handle, ['p', 'reel', 'stories', 'explore', 'direct'])) return $result;

    $result['channelName'] = '@' . $handle;
    $result['title']       = '@' . $handle . ' Instagram';

    // ── RapidAPI Call: Instagram Data API ──────────────────
    if ($apiKey) {
        $rapidUrl = 'https://instagram-scraper-api2.p.rapidapi.com/v1/info?username_or_id_or_url=' . urlencode($handle);
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $rapidUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_HTTPHEADER => [
                'X-RapidAPI-Key: ' . $apiKey,
                'X-RapidAPI-Host: instagram-scraper-api2.p.rapidapi.com'
            ]
        ]);
        $response = curl_exec($ch);
        curl_close($ch);

        if ($response) {
            $json = json_decode($response, true);
            $data = $json['data'] ?? $json;
            if (!empty($data)) {
                $result['title']          = $data['full_name'] ?? $data['username'] ?? ('@' . $handle);
                $result['channelName']    = '@' . ($data['username'] ?? $handle);
                $result['profilePicture'] = $data['profile_pic_url_hd'] ?? $data['profile_pic_url'] ?? null;
                $result['description']    = $data['biography'] ?? '';

                $followerCount = $data['follower_count'] ?? $data['edge_followed_by']['count'] ?? null;
                if ($followerCount !== null) {
                    $result['subscribers'] = (int)$followerCount;
                    $result['followers']   = (int)$followerCount;
                }
            }
        }
    }

    // Fallback HTML Scrape
    if (!$result['profilePicture'] || !$result['description']) {
        $html = fetchTextUrl('https://www.instagram.com/' . urlencode($handle) . '/');
        if ($html) {
            if (!$result['title'] && preg_match('/<meta property="og:title" content="([^"]+)"/i', $html, $m)) {
                $result['title'] = html_entity_decode($m[1], ENT_QUOTES);
            }
            if (!$result['description'] && preg_match('/<meta property="og:description" content="([^"]+)"/i', $html, $m)) {
                $result['description'] = html_entity_decode($m[1], ENT_QUOTES);
            }
            if (!$result['profilePicture'] && preg_match('/<meta property="og:image" content="([^"]+)"/i', $html, $m)) {
                $result['profilePicture'] = $m[1];
            }
        }
    }

    if (!empty($verificationCode)) {
        $code = trim($verificationCode);
        $result['codeVerified'] = !empty($result['description']) && (stripos($result['description'], $code) !== false);
    } else {
        $result['codeVerified'] = true;
    }

    return $result;
}

function fetchTwitterProfileData($url, $verificationCode = '') {
    $result = [
        'title'            => null,
        'channelName'      => null,
        'profilePicture'   => null,
        'subscribers'      => 0,
        'followers'        => 0,
        'description'      => null,
        'codeVerified'     => false,
        'verificationCode' => $verificationCode
    ];

    $apiKey = getRapidApiKey();
    $handle = '';
    if (preg_match('/(?:twitter\.com|x\.com)\/([^\/\?]+)/i', $url, $m)) {
        $handle = trim($m[1]);
    }

    if (!$handle || in_array(strtolower($handle), ['home', 'explore', 'notifications', 'messages', 'search', 'settings', 'i'])) {
        return $result;
    }

    $result['channelName'] = '@' . $handle;
    $result['title']       = '@' . $handle;

    // ── 1. Twitter Free Syndication Endpoint (No API Key Required!) ──
    $synUrl = 'https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=' . urlencode($handle);
    $chSyn = curl_init();
    curl_setopt_array($chSyn, [
        CURLOPT_URL            => $synUrl,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 6,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        CURLOPT_HTTPHEADER     => ['Accept: application/json']
    ]);
    $synResponse = curl_exec($chSyn);
    curl_close($chSyn);

    if ($synResponse) {
        $synJson = json_decode($synResponse, true);
        if (is_array($synJson) && isset($synJson[0])) {
            $user = $synJson[0];
            if (!empty($user['name'])) {
                $result['title'] = $user['name'];
            }
            if (!empty($user['screen_name'])) {
                $result['channelName'] = '@' . $user['screen_name'];
            }
            if (!empty($user['profile_image_url_https'])) {
                $result['profilePicture'] = str_replace('_normal', '_400x400', $user['profile_image_url_https']);
            }
            if (isset($user['followers_count'])) {
                $count = (int)$user['followers_count'];
                $result['subscribers'] = $count;
                $result['followers']   = $count;
            }
        }
    }

    // ── 2. RapidAPI Scraper (If API Key Configured) ─────────────
    if ($apiKey) {
        $rapidUrl = 'https://twitter-api45.p.rapidapi.com/screenname.php?username=' . urlencode($handle);
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL => $rapidUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 6,
            CURLOPT_HTTPHEADER => [
                'X-RapidAPI-Key: ' . $apiKey,
                'X-RapidAPI-Host: twitter-api45.p.rapidapi.com'
            ]
        ]);
        $response = curl_exec($ch);
        curl_close($ch);

        if ($response) {
            $json = json_decode($response, true);
            if (!empty($json) && (isset($json['name']) || isset($json['description']))) {
                if (!empty($json['name'])) {
                    $result['title'] = $json['name'];
                }
                if (!empty($json['screen_name'])) {
                    $result['channelName'] = '@' . $json['screen_name'];
                }
                $avatar = $json['profile_image_url_https'] ?? $json['avatar'] ?? null;
                if ($avatar) {
                    $result['profilePicture'] = str_replace('_normal', '_400x400', $avatar);
                }
                if (!empty($json['description']) || !empty($json['desc'])) {
                    $result['description'] = $json['description'] ?? $json['desc'];
                }
                $followerCount = $json['followers_count'] ?? $json['subscribers_count'] ?? 0;
                if ($followerCount > 0) {
                    $result['subscribers'] = (int)$followerCount;
                    $result['followers']   = (int)$followerCount;
                }
            }
        }
    }

    // ── 3. OEmbed & Web Bio Fallback ──────────────────────────
    $htmlContent = '';
    if (empty($result['description'])) {
        $oembedUrl = 'https://publish.twitter.com/oembed?url=https://x.com/' . urlencode($handle);
        $oembedResponse = fetchTextUrl($oembedUrl);
        if ($oembedResponse) {
            $oembedJson = json_decode($oembedResponse, true);
            if (!empty($oembedJson['author_name']) && $result['title'] === ('@' . $handle)) {
                $result['title'] = $oembedJson['author_name'];
            }
            if (!empty($oembedJson['html'])) {
                $result['description'] = strip_tags($oembedJson['html']);
                $htmlContent .= ' ' . $oembedJson['html'];
            }
        }

        $html = fetchTextUrl('https://x.com/' . urlencode($handle));
        if ($html) {
            $htmlContent .= ' ' . $html;
            if (preg_match('/<meta property="og:description" content="([^"]+)"/i', $html, $m)) {
                $result['description'] = html_entity_decode($m[1], ENT_QUOTES);
            }
            if (empty($result['profilePicture']) && preg_match('/<meta property="og:image" content="([^"]+)"/i', $html, $m)) {
                $result['profilePicture'] = $m[1];
            }
        }
    }

    // ── Code Ownership Verification ───────────────────────────
    if (!empty($verificationCode)) {
        $code = trim($verificationCode);
        $searchHaystack = ($result['description'] ?? '') . ' ' . ($result['title'] ?? '') . ' ' . $htmlContent;
        $result['codeVerified'] = (stripos($searchHaystack, $code) !== false);
    } else {
        $result['codeVerified'] = true;
    }

    return $result;
}

function fetchFacebookProfileData($url, $verificationCode = '') {
    $result = [
        'title'            => null,
        'channelName'      => null,
        'profilePicture'   => null,
        'subscribers'      => 0,
        'followers'        => 0,
        'description'      => null,
        'codeVerified'     => false,
        'verificationCode' => $verificationCode
    ];

    $apiKey = getRapidApiKey();

    // Extract Facebook page username / ID from URL
    $fbHandle = '';
    if (preg_match('/facebook\.com\/([^\/\?]+)/', $url, $m)) {
        $fbHandle = trim($m[1]);
    }

    // ── 1. RapidAPI: Facebook Pages Scraper ─────────────────────
    if ($apiKey && $fbHandle && !in_array(strtolower($fbHandle), ['groups', 'events', 'watch', 'marketplace', 'login', 'profile.php'])) {
        $rapidUrl = 'https://facebook-pages-scraper.p.rapidapi.com/page_info?page_name=' . urlencode($fbHandle);
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $rapidUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 6,
            CURLOPT_HTTPHEADER     => [
                'X-RapidAPI-Key: ' . $apiKey,
                'X-RapidAPI-Host: facebook-pages-scraper.p.rapidapi.com'
            ]
        ]);
        $response = curl_exec($ch);
        curl_close($ch);

        if ($response) {
            $json = json_decode($response, true);
            $data = $json['data'] ?? $json ?? [];
            if (!empty($data) && (isset($data['name']) || isset($data['fan_count']))) {
                if (!empty($data['name'])) {
                    $result['title']       = $data['name'];
                    $result['channelName'] = $data['name'];
                }
                if (!empty($data['description']) || !empty($data['about'])) {
                    $result['description'] = $data['description'] ?? $data['about'];
                }
                if (!empty($data['picture']['data']['url']) || !empty($data['cover']['source'])) {
                    $result['profilePicture'] = $data['picture']['data']['url'] ?? $data['cover']['source'];
                }
                $fans = $data['fan_count'] ?? $data['followers_count'] ?? $data['likes'] ?? null;
                if ($fans !== null) {
                    $result['subscribers'] = (int)$fans;
                    $result['followers']   = (int)$fans;
                }
            }
        }
    }

    // ── 2. HTML Scrape Fallback ───────────────────────────────────
    $html = '';
    if (!$result['title'] || !$result['profilePicture']) {
        $html = fetchTextUrl($url);
        if ($html) {
            if (!$result['title'] && preg_match('/<meta property="og:title" content="([^"]+)"/i', $html, $m)) {
                $title = html_entity_decode($m[1], ENT_QUOTES);
                $result['title']       = $title;
                $result['channelName'] = $title;
            }
            if (!$result['description'] && preg_match('/<meta property="og:description" content="([^"]+)"/i', $html, $m)) {
                $result['description'] = html_entity_decode($m[1], ENT_QUOTES);
            }
            if (!$result['profilePicture'] && preg_match('/<meta property="og:image" content="([^"]+)"/i', $html, $m)) {
                $result['profilePicture'] = $m[1];
            }
            // Try to extract follower count from JSON-LD or page text
            if ($result['followers'] === 0) {
                if (preg_match('/([0-9,.]+[KMB]?)\s+(?:people follow|followers?|likes?)/i', $html, $m)) {
                    $raw = $m[1];
                    $count = 0;
                    if (preg_match('/([0-9.]+)([KMB])/i', $raw, $pm)) {
                        $val  = floatval($pm[1]);
                        $unit = strtoupper($pm[2]);
                        if ($unit === 'K') $count = (int)($val * 1000);
                        elseif ($unit === 'M') $count = (int)($val * 1000000);
                        elseif ($unit === 'B') $count = (int)($val * 1000000000);
                    } else {
                        $count = (int)preg_replace('/[^0-9]/', '', $raw);
                    }
                    if ($count >= 0) {
                        $result['subscribers'] = $count;
                        $result['followers']   = $count;
                    }
                }
            }
        }
    }

    if (!empty($verificationCode)) {
        $code = trim($verificationCode);
        $searchIn = ($result['description'] ?? '') . ' ' . $html;
        $result['codeVerified'] = (stripos($searchIn, $code) !== false);
    } else {
        $result['codeVerified'] = true;
    }

    return $result;
}

function fetchTelegramProfileData($url, $verificationCode = '') {
    $result = [
        'title'            => null,
        'channelName'      => null,
        'profilePicture'   => null,
        'subscribers'      => 0,
        'followers'        => 0,
        'description'      => null,
        'codeVerified'     => false,
        'verificationCode' => $verificationCode
    ];

    // Normalise t.me URL → actual preview URL
    $previewUrl = $url;
    if (preg_match('/t\.me\/([^\/\?]+)/', $url, $m)) {
        $handle = $m[1];
        $result['channelName'] = '@' . $handle;
        $previewUrl = 'https://t.me/' . urlencode($handle);
    }

    $html = fetchTextUrl($previewUrl);
    if ($html) {
        // Title
        if (preg_match('/<meta property="og:title" content="([^"]+)"/i', $html, $m)) {
            $title = html_entity_decode($m[1], ENT_QUOTES);
            $result['title']       = $title;
            $result['channelName'] = $title;
        } elseif (preg_match('/<div class="tgme_page_title">([^<]+)<\/div>/i', $html, $m)) {
            $title = html_entity_decode(trim($m[1]), ENT_QUOTES);
            $result['title']       = $title;
            $result['channelName'] = $title;
        }

        // Bio / description
        if (preg_match('/<meta property="og:description" content="([^"]+)"/i', $html, $m)) {
            $result['description'] = html_entity_decode($m[1], ENT_QUOTES);
        } elseif (preg_match('/<div class="tgme_page_description">([^<]+)<\/div>/i', $html, $m)) {
            $result['description'] = html_entity_decode(trim($m[1]), ENT_QUOTES);
        }

        // Avatar
        if (preg_match('/<meta property="og:image" content="([^"]+)"/i', $html, $m)) {
            $result['profilePicture'] = $m[1];
        } elseif (preg_match('/tgme_page_photo.*?src="([^"]+)"/is', $html, $m)) {
            $result['profilePicture'] = $m[1];
        }

        // Subscriber / member count — multiple Telegram page patterns
        $subCount = 0;
        // Pattern 1: tgme_page_extra (e.g. "1 234 subscribers", "5 members")
        if (preg_match('/<div class="tgme_page_extra">[^<]*?([0-9][\s0-9,\.]*[0-9])\s*(?:subscribers?|members?)[^<]*<\/div>/i', $html, $m)) {
            $subCount = (int)preg_replace('/[^0-9]/', '', $m[1]);
        }
        // Pattern 2: generic text anywhere on the page
        if (!$subCount && preg_match('/([0-9][\s0-9,]+[0-9])\s*(?:subscribers?|members?)/i', $html, $m)) {
            $subCount = (int)preg_replace('/[^0-9]/', '', $m[1]);
        }
        // Pattern 3: JSON-style "subscribers":N or "members":N
        if (!$subCount && preg_match('/"(?:subscribers?|members?)"\s*:\s*([0-9]+)/i', $html, $m)) {
            $subCount = (int)$m[1];
        }
        $result['subscribers'] = $subCount;
        $result['followers']   = $subCount;
    }

    if (!empty($verificationCode)) {
        $code = trim($verificationCode);
        $searchIn = ($result['description'] ?? '') . ' ' . ($html ?? '');
        $result['codeVerified'] = (stripos($searchIn, $code) !== false);
    } else {
        $result['codeVerified'] = true;
    }

    return $result;
}
?>
