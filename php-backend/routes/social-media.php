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

function normalizeInputUrl($inputUrl) {
    $url = trim($inputUrl ?? '');
    if (!$url) return '';

    // Strip wrapping quotes and whitespace
    $url = trim($url, " \t\n\r\0\x0B\"'");

    // If starts with @, infer platform if provided, or default to tiktok/youtube format
    if (strpos($url, '@') === 0) {
        $url = 'https://www.tiktok.com/' . $url;
    }

    // Add protocol if missing
    if (!preg_match('#^https?://#i', $url)) {
        $url = 'https://' . ltrim($url, '/');
    }

    return $url;
}

function checkVerificationCodeMatch($verificationCode, ...$searchSources) {
    if (empty($verificationCode)) return true;
    
    $code = trim($verificationCode);
    if ($code === '') return true;

    // Normalised alphanumeric code (e.g. XSMABC123)
    $cleanCode = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $code));

    foreach ($searchSources as $source) {
        if (empty($source) || !is_string($source)) continue;

        // 1. Direct case-insensitive search
        if (stripos($source, $code) !== false) {
            return true;
        }

        // 2. HTML entity decoded search
        $decoded = html_entity_decode($source, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if (stripos($decoded, $code) !== false) {
            return true;
        }

        // 3. JSON unescaped search (e.g. \u0020, \/, \n)
        $jsonUnescaped = stripcslashes($source);
        if (stripos($jsonUnescaped, $code) !== false) {
            return true;
        }

        // 4. Cleaned alphanumeric search ignoring punctuation / formatting
        $cleanSource = strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $decoded));
        if ($cleanCode && stripos($cleanSource, $cleanCode) !== false) {
            return true;
        }
    }

    return false;
}

function handleSocialMediaExtract() {
    $input = json_decode(file_get_contents('php://input'), true);
    $rawUrl = trim($input['url'] ?? '');
    $verificationCode = trim($input['verificationCode'] ?? '');

    if (!$rawUrl) {
        Response::error('URL is required', 400);
        return;
    }

    $url = normalizeInputUrl($rawUrl);

    if (!filter_var($url, FILTER_VALIDATE_URL)) {
        Response::error('Invalid URL format', 400);
        return;
    }

    try {
        $parsedUrl = parse_url($url);
        $host = strtolower($parsedUrl['host'] ?? '');
        $pathValue = $parsedUrl['path'] ?? '';

        $platform = detectSocialPlatform($host ?: $url);
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
            'description' => '',
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

function detectSocialPlatform($hostOrUrl) {
    $lower = strtolower($hostOrUrl);
    if (strpos($lower, 'youtube.com') !== false || strpos($lower, 'youtu.be') !== false) return 'youtube';
    if (strpos($lower, 'tiktok.com') !== false || strpos($lower, 'vm.tiktok.com') !== false || strpos($lower, 'vt.tiktok.com') !== false) return 'tiktok';
    if (strpos($lower, 'instagram.com') !== false || strpos($lower, 'instagr.am') !== false) return 'instagram';
    if (strpos($lower, 'twitter.com') !== false || strpos($lower, 'x.com') !== false) return 'twitter';
    if (strpos($lower, 'facebook.com') !== false || strpos($lower, 'fb.com') !== false || strpos($lower, 'fb.watch') !== false) return 'facebook';
    if (strpos($lower, 't.me') !== false || strpos($lower, 'telegram.me') !== false || strpos($lower, 'telegram.dog') !== false) return 'telegram';
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
    $result['codeVerified'] = checkVerificationCodeMatch(
        $verificationCode,
        $apiDescription,
        $result['title'],
        $html
    );

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

function parseSocialNumber($str) {
    if (!$str && $str !== '0') return 0;
    $str = trim(html_entity_decode((string)$str, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    
    // Pattern 1: e.g. 1.5M, 100K, 2.3B, 10.2k
    if (preg_match('/([0-9.,]+)\s*([KMBkmb])/i', $str, $m)) {
        $val = floatval(str_replace(',', '', $m[1]));
        $unit = strtoupper($m[2]);
        if ($unit === 'K') return (int)($val * 1000);
        if ($unit === 'M') return (int)($val * 1000000);
        if ($unit === 'B') return (int)($val * 1000000000);
    }
    
    // Pattern 2: e.g. 1,234,567
    $cleaned = preg_replace('/[^0-9]/', '', $str);
    return (int)$cleaned;
}

function fetchSocialPage($url, $isMobile = false) {
    if (!function_exists('curl_init')) {
        $context = stream_context_create([
            'http' => [
                'timeout' => 8,
                'header'  => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n"
            ]
        ]);
        return @file_get_contents($url, false, $context) ?: '';
    }

    $ua = $isMobile
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

    $headers = [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language: en-US,en;q=0.9',
        'Cache-Control: no-cache',
        'Pragma: no-cache',
        'Sec-Fetch-Dest: document',
        'Sec-Fetch-Mode: navigate',
        'Sec-Fetch-Site: none',
        'Sec-Fetch-User: ?1',
        'Upgrade-Insecure-Requests: 1',
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 4,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_ENCODING       => '',
        CURLOPT_USERAGENT      => $ua,
        CURLOPT_HTTPHEADER     => $headers,
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    return $response ?: '';
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
    if (preg_match('/@([^\/\?#]+)/', $url, $m)) {
        $handle = $m[1];
    } elseif (preg_match('/tiktok\.com\/([^\/\?#]+)/', $url, $m)) {
        $handle = ltrim($m[1], '@');
    } else {
        $handle = ltrim(trim($url), '@');
    }

    if (!$handle) return $result;

    $result['channelName'] = '@' . $handle;
    $result['title']       = '@' . $handle . ' TikTok';

    $rawHtml = '';
    $apiSignature = '';
    $followerFound = false;

    // ── SOURCE 1: TikTok oEmbed API (fast, always returns title) ─────────
    $oembedResp = fetchSocialPage('https://www.tiktok.com/oembed?url=' . urlencode('https://www.tiktok.com/@' . $handle));
    if ($oembedResp) {
        $oe = json_decode($oembedResp, true);
        if (!empty($oe['author_name'])) {
            $result['title'] = $oe['author_name'];
        }
        if (!empty($oe['thumbnail_url']) && empty($result['profilePicture'])) {
            $result['profilePicture'] = $oe['thumbnail_url'];
        }
    }

    // ── SOURCE 2: TikTok Web Profile HTML scrape (embedded JSON) ─────────
    $rawHtml = fetchSocialPage('https://www.tiktok.com/@' . urlencode($handle));
    if (!$rawHtml) {
        // Try mobile user-agent
        $rawHtml = fetchSocialPage('https://www.tiktok.com/@' . urlencode($handle), true);
    }
    if ($rawHtml) {
        // Parse all embedded JSON blobs for user info
        $jsonSources = [];

        // __UNIVERSAL_DATA_FOR_REHYDRATION__ JSON state
        if (preg_match('/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>\s*({.*?})\s*<\/script>/is', $rawHtml, $m)) {
            $d = json_decode($m[1], true);
            $uDetail = $d['__DEFAULT_SCOPE__']['webapp.user-detail']['userInfo'] ?? [];
            if (!empty($uDetail['user'])) {
                $u = $uDetail['user'];
                $s = $uDetail['stats'] ?? [];
                if (!empty($u['nickname'])) $result['title'] = $u['nickname'];
                if (!empty($u['uniqueId'])) $result['channelName'] = '@' . $u['uniqueId'];
                if (!empty($u['avatarLarger'])) $result['profilePicture'] = $u['avatarLarger'];
                if (!empty($u['signature'])) {
                    $result['description'] = $u['signature'];
                    $apiSignature = $u['signature'];
                }
                if (isset($s['followerCount']) && (int)$s['followerCount'] > 0) {
                    $result['subscribers'] = (int)$s['followerCount'];
                    $result['followers']   = (int)$s['followerCount'];
                    $followerFound = true;
                }
            }
        }

        // SIGI_STATE JSON state
        if (empty($result['description']) && preg_match('/<script id="SIGI_STATE"[^>]*>\s*({.*?})\s*<\/script>/is', $rawHtml, $m)) {
            $sigi = json_decode($m[1], true);
            // Try both exact and lowercase handle
            foreach ([$handle, strtolower($handle)] as $tryHandle) {
                $uMod = $sigi['UserModule']['users'][$tryHandle] ?? [];
                $sMod = $sigi['UserModule']['stats'][$tryHandle] ?? [];
                if (!empty($uMod)) {
                    if (!empty($uMod['nickname']) && $result['title'] === '@' . $handle . ' TikTok') $result['title'] = $uMod['nickname'];
                    if (!empty($uMod['signature']) && empty($result['description'])) {
                        $result['description'] = $uMod['signature'];
                        $apiSignature = $uMod['signature'];
                    }
                    if (!empty($uMod['avatarLarger']) && empty($result['profilePicture'])) $result['profilePicture'] = $uMod['avatarLarger'];
                    if (!empty($sMod['followerCount']) && !$followerFound) {
                        $result['subscribers'] = (int)$sMod['followerCount'];
                        $result['followers']   = (int)$sMod['followerCount'];
                        $followerFound = true;
                    }
                    break;
                }
            }
        }

        // Any JSON blob containing "signature" key (bio) — broad regex sweep
        if (empty($result['description'])) {
            // Look for signature in any script tag JSON
            if (preg_match_all('/<script[^>]*>\s*window\.__[^=]+=\s*({.*?});?\s*<\/script>/is', $rawHtml, $allMs)) {
                foreach ($allMs[1] as $blob) {
                    $parsed = json_decode($blob, true);
                    if (is_array($parsed)) {
                        $sig = $parsed['signature'] ?? $parsed['user']['signature'] ?? null;
                        if ($sig && is_string($sig) && strlen($sig) < 500) {
                            $result['description'] = $sig;
                            $apiSignature = $sig;
                            break;
                        }
                    }
                }
            }
        }

        // Raw regex fallback for "signature" key in any embedded JSON
        if (empty($result['description'])) {
            if (preg_match('/"signature"\s*:\s*"((?:[^"\\\\]|\\\\.)*?)"/s', $rawHtml, $sigM)) {
                $sig = json_decode('"' . $sigM[1] . '"');
                if ($sig && is_string($sig) && strlen($sig) > 1 && strlen($sig) < 500) {
                    $result['description'] = $sig;
                    $apiSignature = $sig;
                }
            }
        }

        // Follower count raw regex from page HTML
        if (!$followerFound) {
            if (preg_match('/"followerCount"\s*:\s*([0-9]+)/i', $rawHtml, $fM)) {
                $result['subscribers'] = (int)$fM[1];
                $result['followers']   = (int)$fM[1];
                $followerFound = true;
            } elseif (preg_match('/"fans"\s*:\s*([0-9]+)/i', $rawHtml, $fM)) {
                $result['subscribers'] = (int)$fM[1];
                $result['followers']   = (int)$fM[1];
                $followerFound = true;
            }
        }

        // Avatar from JSON
        if (empty($result['profilePicture'])) {
            if (preg_match('/"avatarLarger"\s*:\s*"(https:[^"]+)"/i', $rawHtml, $avM)) {
                $result['profilePicture'] = json_decode('"' . str_replace('\\/', '/', $avM[1]) . '"');
            }
        }

        // Meta title / image fallback
        if (!$result['title'] && preg_match('/<meta property="og:title" content="([^"]+)"/i', $rawHtml, $m)) {
            $result['title'] = html_entity_decode($m[1], ENT_QUOTES);
        }
        if (empty($result['profilePicture']) && preg_match('/<meta property="og:image" content="([^"]+)"/i', $rawHtml, $m)) {
            $result['profilePicture'] = $m[1];
        }

        // og:description — parse follower count + bio
        if (preg_match('/<meta (?:name|property)="(?:og:)?description" content="([^"]+)"/i', $rawHtml, $m)) {
            $metaDesc = html_entity_decode($m[1], ENT_QUOTES);
            if (!$followerFound && preg_match('/([0-9.,]+[KMBkmb]?)\s+(?:Followers|Fans)/i', $metaDesc, $fm)) {
                $fc = parseSocialNumber($fm[1]);
                if ($fc > 0) { $result['subscribers'] = $fc; $result['followers'] = $fc; $followerFound = true; }
            }
            // Extract bio part after stats line
            if (empty($result['description'])) {
                // Pattern: "Xk Followers, X Following, Xk Likes - Bio text here"
                $parts = preg_split('/(?:[0-9.,]+[KMBkmb]?\s+(?:Followers|Fans|Following|Likes)[^-]*-\s*)/i', $metaDesc);
                if (!empty($parts[1])) {
                    $bio = trim(strip_tags($parts[1]));
                    $bio = preg_replace('/\s+/', ' ', $bio);
                    if ($bio && strlen($bio) > 2 && !preg_match('/^(?:Watch short videos|TikTok|Sign up)/i', $bio)) {
                        $result['description'] = $bio;
                    }
                }
            }
        }
    }

    // ── SOURCE 3: RapidAPI Scrapers ──────────────────────────────────────
    if ((empty($result['description']) || !$followerFound) && $apiKey) {
        $rapidApis = [
            'https://tiktok-all-in-one-api.p.rapidapi.com/user/info?username=' . urlencode($handle) => 'tiktok-all-in-one-api.p.rapidapi.com',
            'https://tiktok-scraper7.p.rapidapi.com/user/info?unique_id=' . urlencode($handle) => 'tiktok-scraper7.p.rapidapi.com',
        ];
        foreach ($rapidApis as $rapidUrl => $rapidHost) {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL            => $rapidUrl,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 6,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_HTTPHEADER     => [
                    'X-RapidAPI-Key: ' . $apiKey,
                    'X-RapidAPI-Host: ' . $rapidHost
                ]
            ]);
            $response = curl_exec($ch);
            curl_close($ch);
            if (!$response) continue;
            $json = json_decode($response, true);
            if (!is_array($json)) continue;
            $userInfo = $json['user'] ?? $json['data']['user'] ?? $json['userInfo']['user'] ?? $json['data'] ?? [];
            $stats    = $json['stats'] ?? $json['data']['stats'] ?? $json['userInfo']['stats'] ?? [];
            if (!empty($userInfo)) {
                if (!empty($userInfo['nickname'])) $result['title'] = $userInfo['nickname'];
                if (!empty($userInfo['uniqueId'])) $result['channelName'] = '@' . $userInfo['uniqueId'];
                if (!empty($userInfo['avatarLarger'] ?? $userInfo['avatarMedium'] ?? null)) {
                    $result['profilePicture'] = $userInfo['avatarLarger'] ?? $userInfo['avatarMedium'];
                }
                if (!empty($userInfo['signature'])) {
                    $result['description'] = $userInfo['signature'];
                    $apiSignature = $userInfo['signature'];
                }
                $followerCount = $stats['followerCount'] ?? $userInfo['followerCount'] ?? null;
                if ($followerCount !== null) {
                    $result['subscribers'] = (int)$followerCount;
                    $result['followers']   = (int)$followerCount;
                    $followerFound = true;
                }
                if ($followerFound && !empty($result['description'])) break;
            }
        }
    }

    // Ownership Verification Code Check
    $result['codeVerified'] = checkVerificationCodeMatch(
        $verificationCode,
        $result['description'],
        $apiSignature,
        $result['title'],
        $rawHtml
    );

    return $result;
}

function fetchInstagramWebProfileApi($handle) {
    $out = [
        'title'          => null,
        'channelName'    => null,
        'profilePicture' => null,
        'description'    => null,
        'subscribers'    => 0,
        'followers'      => 0,
    ];

    if (!function_exists('curl_init') || !$handle) {
        return $out;
    }

    $endpoints = [
        [
            'url'  => 'https://www.instagram.com/api/v1/users/web_profile_info/?username=' . urlencode($handle),
            'ua'   => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'refs' => 'https://www.instagram.com/' . urlencode($handle) . '/',
        ],
        [
            'url'  => 'https://i.instagram.com/api/v1/users/web_profile_info/?username=' . urlencode($handle),
            'ua'   => 'Instagram 76.0.0.15.395 Android (24/7.0; 640dpi; 1440x2560; samsung; SM-G930F; herolte; samsungexynos8890; en_US; 138226743)',
            'refs' => 'https://www.instagram.com/',
        ],
    ];

    foreach ($endpoints as $cfg) {
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $cfg['url'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER     => [
                'User-Agent: ' . $cfg['ua'],
                'X-IG-App-ID: 936619743392459',
                'X-Requested-With: XMLHttpRequest',
                'Accept: */*',
                'Referer: ' . $cfg['refs'],
            ],
        ]);
        $response = curl_exec($ch);
        $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if (!$response || $httpCode < 200 || $httpCode >= 400) {
            continue;
        }

        $json = json_decode($response, true);
        $user = $json['data']['user'] ?? $json['user'] ?? null;
        if (empty($user) || !is_array($user)) {
            continue;
        }

        if (!empty($user['full_name'])) {
            $out['title'] = $user['full_name'];
        }
        if (!empty($user['username'])) {
            $out['channelName'] = '@' . $user['username'];
        }
        if (!empty($user['biography'])) {
            $out['description'] = $user['biography'];
        }
        if (!empty($user['profile_pic_url_hd']) || !empty($user['profile_pic_url'])) {
            $out['profilePicture'] = $user['profile_pic_url_hd'] ?? $user['profile_pic_url'];
        }

        $fc = $user['edge_followed_by']['count']
           ?? $user['follower_count']
           ?? $user['followers']
           ?? null;
        if ($fc !== null) {
            $out['subscribers'] = (int)$fc;
            $out['followers']   = (int)$fc;
        }

        if (!empty($out['description']) || $out['followers'] > 0) {
            return $out;
        }
    }

    return $out;
}

function applyInstagramExtract(&$result, $extracted, &$followerFound, &$htmlContent) {
    if (empty($extracted) || !is_array($extracted)) {
        return;
    }

    if (!empty($extracted['title'])) {
        $result['title'] = $extracted['title'];
    }
    if (!empty($extracted['channelName'])) {
        $result['channelName'] = $extracted['channelName'];
    }
    if (!empty($extracted['description'])) {
        $result['description'] = $extracted['description'];
        $htmlContent .= ' ' . $extracted['description'];
    }
    if (!empty($extracted['profilePicture'])) {
        $result['profilePicture'] = $extracted['profilePicture'];
    }
    if (!empty($extracted['followers']) || !empty($extracted['subscribers'])) {
        $fc = (int)($extracted['followers'] ?? $extracted['subscribers'] ?? 0);
        if ($fc > 0) {
            $result['subscribers'] = $fc;
            $result['followers']   = $fc;
            $followerFound = true;
        }
    }
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
    if (preg_match('/instagram\.com\/([^\/\?#]+)/i', $url, $m)) {
        $handle = trim($m[1]);
    } else {
        $handle = ltrim(trim($url), '@');
    }

    if (!$handle || in_array(strtolower($handle), ['p', 'reel', 'stories', 'explore', 'direct', 'accounts', 'developer', 'about', 'legal'])) {
        return $result;
    }

    $result['channelName'] = '@' . $handle;
    $result['title']       = '@' . $handle . ' Instagram';

    $htmlContent = '';
    $followerFound = false;

    // ── SOURCE 0: Instagram official web profile API (most reliable) ─────
    applyInstagramExtract($result, fetchInstagramWebProfileApi($handle), $followerFound, $htmlContent);

    // ── SOURCE 1: Instagram GraphQL endpoint ─────────────────────────────
    if (empty($result['description']) || !$followerFound) {
        $graphEndpoints = [
            'https://www.instagram.com/api/v1/users/web_profile_info/?username=' . urlencode($handle),
        ];
        foreach ($graphEndpoints as $graphUrl) {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL            => $graphUrl,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 8,
                CURLOPT_CONNECTTIMEOUT => 4,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                CURLOPT_HTTPHEADER     => [
                    'X-IG-App-ID: 936619743392459',
                    'X-ASBD-ID: 198387',
                    'X-IG-WWW-Claim: 0',
                    'X-Requested-With: XMLHttpRequest',
                    'Accept: */*',
                    'Accept-Language: en-US,en;q=0.9',
                    'Referer: https://www.instagram.com/' . urlencode($handle) . '/',
                    'Origin: https://www.instagram.com',
                    'Sec-Fetch-Dest: empty',
                    'Sec-Fetch-Mode: cors',
                    'Sec-Fetch-Site: same-origin',
                ],
                CURLOPT_COOKIE         => 'ig_did=x; datr=x; ig_nrcb=1',
            ]);
            $response = curl_exec($ch);
            $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if (!$response || $httpCode >= 400) continue;
            $json = json_decode($response, true);
            $user = $json['data']['user'] ?? $json['user'] ?? null;
            if (!empty($user)) {
                if (!empty($user['full_name'])) $result['title'] = $user['full_name'];
                if (!empty($user['username'])) $result['channelName'] = '@' . $user['username'];
                if (!empty($user['biography'])) {
                    $result['description'] = $user['biography'];
                    $htmlContent .= ' ' . $user['biography'];
                }
                if (!empty($user['profile_pic_url_hd'] ?? $user['profile_pic_url'] ?? null)) {
                    $result['profilePicture'] = $user['profile_pic_url_hd'] ?? $user['profile_pic_url'];
                }
                $fc = $user['edge_followed_by']['count'] ?? $user['follower_count'] ?? null;
                if ($fc !== null) {
                    $result['subscribers'] = (int)$fc;
                    $result['followers']   = (int)$fc;
                    $followerFound = true;
                }
                if (!empty($result['description']) && $followerFound) break;
            }
        }
    }

    // ── SOURCE 2: Instagram page HTML scrape — JSON embedded data ────────
    if (empty($result['description']) || !$followerFound) {
        $igHtml = fetchSocialPage('https://www.instagram.com/' . urlencode($handle) . '/');
        if ($igHtml) {
            $htmlContent .= ' ' . $igHtml;

            // Extract JSON-LD structured data
            if (preg_match_all('/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/is', $igHtml, $allLd)) {
                foreach ($allLd[1] as $ldBlob) {
                    $ld = json_decode($ldBlob, true);
                    if (!is_array($ld)) continue;
                    if (!empty($ld['description']) && empty($result['description'])) {
                        $result['description'] = html_entity_decode(strip_tags($ld['description']), ENT_QUOTES);
                        $htmlContent .= ' ' . $result['description'];
                    }
                    if (!empty($ld['name']) && $result['title'] === '@' . $handle . ' Instagram') {
                        $result['title'] = $ld['name'];
                    }
                    if (!empty($ld['image']) && empty($result['profilePicture'])) {
                        $result['profilePicture'] = is_array($ld['image']) ? ($ld['image']['url'] ?? $ld['image'][0] ?? null) : $ld['image'];
                    }
                    if (!empty($ld['mainEntityofPage']['interactionStatistic'])) {
                        foreach ($ld['mainEntityofPage']['interactionStatistic'] as $stat) {
                            if (!empty($stat['userInteractionCount']) && stripos($stat['interactionType'] ?? '', 'Follow') !== false) {
                                $result['subscribers'] = (int)$stat['userInteractionCount'];
                                $result['followers']   = (int)$stat['userInteractionCount'];
                                $followerFound = true;
                            }
                        }
                    }
                }
            }

            // Embedded shared_data JSON
            if (empty($result['description']) && preg_match('/window\._sharedData\s*=\s*({.*?});/s', $igHtml, $m)) {
                $shared = json_decode($m[1], true);
                $igUser = $shared['entry_data']['ProfilePage'][0]['graphql']['user']
                    ?? $shared['entry_data']['ProfilePage'][0]['user']
                    ?? null;
                if ($igUser) {
                    if (!empty($igUser['biography']) && empty($result['description'])) {
                        $result['description'] = $igUser['biography'];
                    }
                    if (!empty($igUser['full_name']) && $result['title'] === '@' . $handle . ' Instagram') {
                        $result['title'] = $igUser['full_name'];
                    }
                    $fc = $igUser['edge_followed_by']['count'] ?? $igUser['follower_count'] ?? null;
                    if ($fc && !$followerFound) {
                        $result['subscribers'] = (int)$fc;
                        $result['followers']   = (int)$fc;
                        $followerFound = true;
                    }
                }
            }

            // Broad "biography" key sweep
            if (empty($result['description'])) {
                if (preg_match('/"biography"\s*:\s*"((?:[^"\\\\]|\\\\.)*?)"/s', $igHtml, $bioM)) {
                    $bio = json_decode('"' . $bioM[1] . '"');
                    if ($bio && is_string($bio) && strlen($bio) > 1) {
                        $result['description'] = $bio;
                    }
                }
            }

            // Raw follower count key sweep
            if (!$followerFound) {
                if (preg_match('/"edge_followed_by"\s*:\s*{\s*"count"\s*:\s*([0-9]+)/i', $igHtml, $fM)) {
                    $result['subscribers'] = (int)$fM[1];
                    $result['followers']   = (int)$fM[1];
                    $followerFound = true;
                } elseif (preg_match('/"follower_count"\s*:\s*([0-9]+)/i', $igHtml, $fM)) {
                    $result['subscribers'] = (int)$fM[1];
                    $result['followers']   = (int)$fM[1];
                    $followerFound = true;
                }
            }

            // og: meta tags
            if (!$result['title'] && preg_match('/<meta property="og:title" content="([^"]+)"/i', $igHtml, $m)) {
                $result['title'] = html_entity_decode($m[1], ENT_QUOTES);
            }
            if (empty($result['profilePicture']) && preg_match('/<meta property="og:image" content="([^"]+)"/i', $igHtml, $m)) {
                $result['profilePicture'] = $m[1];
            }
            if (preg_match('/<meta property="og:description" content="([^"]+)"/i', $igHtml, $m)) {
                $ogDesc = html_entity_decode($m[1], ENT_QUOTES);
                if (!$followerFound && preg_match('/([0-9.,]+[KMBkmb]?)\s+Followers/i', $ogDesc, $fm)) {
                    $fc = parseSocialNumber($fm[1]);
                    if ($fc > 0) { $result['subscribers'] = $fc; $result['followers'] = $fc; $followerFound = true; }
                }
            }
        }
    }

    // ── SOURCE 3: RapidAPI Instagram Scrapers ────────────────────────────
    if ((empty($result['description']) || !$followerFound) && $apiKey) {
        $rapidApis = [
            'https://instagram-scraper-api2.p.rapidapi.com/v1/info?username_or_id_or_url=' . urlencode($handle) => 'instagram-scraper-api2.p.rapidapi.com',
            'https://instagram-data12.p.rapidapi.com/user/details?username=' . urlencode($handle) => 'instagram-data12.p.rapidapi.com',
        ];
        foreach ($rapidApis as $rapidUrl => $rapidHost) {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL            => $rapidUrl,
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 6,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_HTTPHEADER     => [
                    'X-RapidAPI-Key: ' . $apiKey,
                    'X-RapidAPI-Host: ' . $rapidHost
                ]
            ]);
            $response = curl_exec($ch);
            curl_close($ch);
            if (!$response) continue;
            $json = json_decode($response, true);
            $data = $json['data'] ?? $json;
            if (!empty($data) && is_array($data)) {
                if (!empty($data['full_name'])) $result['title'] = $data['full_name'];
                if (!empty($data['username'])) $result['channelName'] = '@' . $data['username'];
                if (!empty($data['profile_pic_url_hd'] ?? $data['profile_pic_url'] ?? null)) {
                    $result['profilePicture'] = $data['profile_pic_url_hd'] ?? $data['profile_pic_url'];
                }
                if (!empty($data['biography'])) {
                    $result['description'] = $data['biography'];
                }
                $followerCount = $data['follower_count'] ?? $data['edge_followed_by']['count'] ?? null;
                if ($followerCount !== null) {
                    $result['subscribers'] = (int)$followerCount;
                    $result['followers']   = (int)$followerCount;
                    $followerFound = true;
                }
                if ($followerFound && !empty($result['description'])) {
                    break;
                }
            }
        }
    }

    // ── SOURCE 4: Instagram Embed Endpoint Scraper ──────────────────────
    if (empty($result['description']) || !$followerFound) {
        $embedHtml = fetchSocialPage('https://www.instagram.com/' . urlencode($handle) . '/embed/');
        if ($embedHtml) {
            $htmlContent .= ' ' . $embedHtml;
            if (empty($result['description'])) {
                if (preg_match('/"biography"\s*:\s*"((?:[^"\\\\]|\\\\.)*?)"/s', $embedHtml, $bioM)) {
                    $bio = json_decode('"' . $bioM[1] . '"');
                    if ($bio && is_string($bio) && strlen($bio) > 1) {
                        $result['description'] = $bio;
                    }
                }
            }
        }
    }

    // ── SOURCE 5: Search Snippet Fallback (DuckDuckGo / Bing) ───────────
    if (empty($result['description']) || !$followerFound) {
        $ddgHtml = fetchSocialPage('https://html.duckduckgo.com/html/?q=site:instagram.com/' . urlencode($handle));
        if ($ddgHtml) {
            $htmlContent .= ' ' . $ddgHtml;
            if (!$followerFound && preg_match('/([0-9.,]+[KMBkmb]?)\s+Followers/i', $ddgHtml, $fm)) {
                $fc = parseSocialNumber($fm[1]);
                if ($fc > 0) { $result['subscribers'] = $fc; $result['followers'] = $fc; $followerFound = true; }
            }
            if (empty($result['description']) && preg_match('/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i', $ddgHtml, $sm)) {
                $snippet = html_entity_decode(trim(strip_tags($sm[1])), ENT_QUOTES);
                if ($snippet && !preg_match('/^See Instagram/i', $snippet)) {
                    $result['description'] = $snippet;
                }
            }
        }
    }

    $result['codeVerified'] = checkVerificationCodeMatch(
        $verificationCode,
        $result['description'],
        $result['title'],
        $htmlContent
    );

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
    if (preg_match('/(?:twitter\.com|x\.com)\/([^\/?@#]+)/i', $url, $m)) {
        $handle = trim($m[1]);
    } else {
        $handle = ltrim(trim($url), '@');
    }
    if (!$handle || in_array(strtolower($handle), ['home','explore','notifications','messages','search','settings','i','intent','hashtag'])) {
        return $result;
    }

    $result['channelName'] = '@' . $handle;
    $result['title']       = '@' . $handle;
    $htmlContent   = '';
    $followerFound = false;

    // ======================================================
    // SOURCE 1: FixTwitter & VxTwitter Public APIs (Fast & Free)
    // ======================================================
    $fxApis = [
        'https://api.fxtwitter.com/' . urlencode($handle),
        'https://api.vxtwitter.com/' . urlencode($handle),
    ];
    foreach ($fxApis as $fxUrl) {
        $chFx = curl_init();
        curl_setopt_array($chFx, [
            CURLOPT_URL            => $fxUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 6,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_USERAGENT      => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            CURLOPT_HTTPHEADER     => ['Accept: application/json']
        ]);
        $fxResponse = curl_exec($chFx);
        curl_close($chFx);
        if ($fxResponse) {
            $json = json_decode($fxResponse, true);
            $user = $json['user'] ?? $json ?? [];
            if (!empty($user) && is_array($user)) {
                $name   = $user['name'] ?? null;
                $sname  = $user['screen_name'] ?? null;
                $desc   = $user['description'] ?? null;
                $avatar = $user['avatar_url'] ?? $user['profile_image_url'] ?? $user['profile_image_url_https'] ?? null;
                $fc     = $user['followers'] ?? $user['followers_count'] ?? null;

                if ($name)   { $result['title']         = $name; }
                if ($sname)  { $result['channelName']   = '@' . $sname; }
                if ($desc)   { $result['description']   = $desc; $htmlContent .= ' ' . $desc; }
                if ($avatar) { $result['profilePicture'] = str_replace('_normal', '_400x400', $avatar); }
                if ($fc !== null) {
                    $result['subscribers'] = (int)$fc;
                    $result['followers']   = (int)$fc;
                    $followerFound = true;
                }
                if (!empty($result['description']) && $followerFound) {
                    break;
                }
            }
        }
    }

    // ======================================================
    // SOURCE 2: RapidAPI Twitter scrapers
    // ======================================================
    if ((empty($result['description']) || !$followerFound) && $apiKey) {
        $rapidApis = [
            ['url'  => 'https://twitter-api45.p.rapidapi.com/screenname.php?username=' . urlencode($handle),
             'host' => 'twitter-api45.p.rapidapi.com'],
            ['url'  => 'https://twitter154.p.rapidapi.com/user/details?username=' . urlencode($handle),
             'host' => 'twitter154.p.rapidapi.com'],
        ];
        foreach ($rapidApis as $api) {
            $ch = curl_init();
            curl_setopt_array($ch, [
                CURLOPT_URL            => $api['url'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 6,
                CURLOPT_HTTPHEADER     => [
                    'X-RapidAPI-Key: ' . $apiKey,
                    'X-RapidAPI-Host: ' . $api['host'],
                ]
            ]);
            $response = curl_exec($ch);
            curl_close($ch);
            if (!$response) continue;
            $json = json_decode($response, true);
            if (!is_array($json)) continue;
            $name   = $json['name']   ?? $json['legacy']['name']   ?? null;
            $sname  = $json['screen_name'] ?? $json['legacy']['screen_name'] ?? null;
            $desc   = $json['description'] ?? $json['legacy']['description'] ?? $json['desc'] ?? null;
            $avatar = $json['profile_image_url_https'] ?? $json['legacy']['profile_image_url_https'] ?? $json['avatar'] ?? null;
            $fc     = $json['followers_count'] ?? $json['legacy']['followers_count'] ?? $json['subscribers_count'] ?? null;
            if ($name)   { $result['title']         = $name; }
            if ($sname)  { $result['channelName']   = '@' . $sname; }
            if ($desc)   { $result['description']   = $desc; $htmlContent .= ' ' . $desc; }
            if ($avatar) { $result['profilePicture'] = str_replace('_normal', '_400x400', $avatar); }
            if ($fc !== null) {
                $result['subscribers'] = (int)$fc;
                $result['followers']   = (int)$fc;
                $followerFound = true;
            }
            if ($name || $desc) break;
        }
    }

    // ======================================================
    // SOURCE 3: Twitter Syndication CDN (name + avatar)
    // ======================================================
    if ($result['title'] === '@' . $handle || empty($result['profilePicture'])) {
        $chSyn = curl_init();
        curl_setopt_array($chSyn, [
            CURLOPT_URL            => 'https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=' . urlencode($handle),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_USERAGENT      => 'Mozilla/5.0',
            CURLOPT_HTTPHEADER     => ['Accept: application/json'],
        ]);
        $synResp = curl_exec($chSyn);
        curl_close($chSyn);
        if ($synResp) {
            $synJson = json_decode($synResp, true);
            if (is_array($synJson) && isset($synJson[0])) {
                $u = $synJson[0];
                if (!empty($u['name']) && $result['title'] === '@' . $handle) {
                    $result['title'] = $u['name'];
                }
                if (!empty($u['screen_name'])) {
                    $result['channelName'] = '@' . $u['screen_name'];
                }
                if (!empty($u['profile_image_url_https']) && empty($result['profilePicture'])) {
                    $result['profilePicture'] = str_replace('_normal', '_400x400', $u['profile_image_url_https']);
                }
                if (!$followerFound && isset($u['followers_count']) && (int)$u['followers_count'] > 0) {
                    $result['subscribers'] = (int)$u['followers_count'];
                    $result['followers']   = (int)$u['followers_count'];
                    $followerFound = true;
                }
            }
        }
    }

    // ======================================================
    // SOURCE 4: oEmbed (bio + author name as last resort)
    // ======================================================
    if (empty($result['description'])) {
        $oembedResp = fetchSocialPage('https://publish.twitter.com/oembed?url=https://x.com/' . urlencode($handle));
        if ($oembedResp) {
            $oe = json_decode($oembedResp, true);
            if (!empty($oe['author_name']) && $result['title'] === '@' . $handle) {
                $result['title'] = $oe['author_name'];
            }
            if (!empty($oe['html'])) {
                $result['description'] = strip_tags($oe['html']);
                $htmlContent .= ' ' . $oe['html'];
            }
        }
    }

    // Ownership Verification
    $result['codeVerified'] = checkVerificationCodeMatch(
        $verificationCode,
        $result['description'],
        $result['title'],
        $htmlContent
    );

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
    if (preg_match('/facebook\.com\/([^\/\?#]+)/i', $url, $m)) {
        $fbHandle = trim($m[1]);
    } else {
        $fbHandle = trim($url);
    }

    if (!$fbHandle || in_array(strtolower($fbHandle), ['groups', 'events', 'watch', 'marketplace', 'login', 'recover', 'help'])) {
        return $result;
    }

    $result['channelName'] = $fbHandle;
    $result['title']       = $fbHandle . ' Facebook';

    $htmlContent = '';
    $followerFound = false;

    // ── SOURCE 0: mbasic.facebook.com (lightweight HTML, fewer blocks) ───
    $mbHtml = fetchSocialPage('https://mbasic.facebook.com/' . urlencode($fbHandle), true);
    if ($mbHtml) {
        $htmlContent .= ' ' . $mbHtml;
        if (preg_match('/<title[^>]*>([^<]+)<\/title>/i', $mbHtml, $m)) {
            $title = html_entity_decode(trim(preg_replace('/\s*-\s*Facebook.*$/i', '', $m[1])), ENT_QUOTES);
            if ($title && !preg_match('/^Log in/i', $title)) {
                $result['title']       = $title;
                $result['channelName'] = $title;
            }
        }

        // Intro/About box
        if (preg_match('/<div[^>]*id="pages_milestone[^"]*"[^>]*>(.*?)<\/div>/is', $mbHtml, $m)) {
            $aboutText = html_entity_decode(trim(strip_tags($m[1])), ENT_QUOTES);
            if ($aboutText) $result['description'] = $aboutText;
        }
        if (empty($result['description']) && preg_match('/<div[^>]*id="pages_m_about[^"]*"[^>]*>(.*?)<\/div>/is', $mbHtml, $m)) {
            $aboutText = html_entity_decode(trim(strip_tags($m[1])), ENT_QUOTES);
            if ($aboutText && !preg_match('/^Log in/i', $aboutText)) $result['description'] = $aboutText;
        }

        // Broad scan of "About" sections
        if (empty($result['description'])) {
            if (preg_match('/About\s*<\/[^>]+>\s*<[^>]+>([^<]{10,500})/is', $mbHtml, $m)) {
                $aboutText = html_entity_decode(trim(strip_tags($m[1])), ENT_QUOTES);
                if ($aboutText && !preg_match('/^Log in|^Sign up/i', $aboutText)) {
                    $result['description'] = $aboutText;
                }
            }
        }

        if (empty($result['profilePicture']) && preg_match('/<img[^>]+src="([^"]+)"[^>]*class="[^"]*profilePic/i', $mbHtml, $m)) {
            $result['profilePicture'] = html_entity_decode($m[1], ENT_QUOTES);
        }
        if (preg_match('/([0-9.,]+[KMBkmb]?)\s+(?:people follow this|followers|people like this|likes)/i', $mbHtml, $m)) {
            $fc = parseSocialNumber($m[1]);
            if ($fc > 0) {
                $result['subscribers'] = $fc;
                $result['followers']   = $fc;
                $followerFound = true;
            }
        }
    }

    // ── SOURCE 1: Mobile Web Scraper (og: meta + JSON key sweep) ──────────
    $mHtml = fetchSocialPage('https://m.facebook.com/' . urlencode($fbHandle), true);
    if ($mHtml) {
        $htmlContent .= ' ' . $mHtml;
        if (preg_match('/<meta property="og:title" content="([^"]+)"/i', $mHtml, $m)) {
            $title = html_entity_decode(trim($m[1]), ENT_QUOTES);
            $result['title']       = $title;
            $result['channelName'] = $title;
        }
        // og:description on mobile is often the actual page bio
        if (preg_match('/<meta property="og:description" content="([^"]+)"/i', $mHtml, $m)) {
            $desc = html_entity_decode(trim($m[1]), ENT_QUOTES);
            if (!empty($desc) && !preg_match('/^Log in or sign up|^Log in to Facebook|^Facebook/i', $desc)) {
                if (empty($result['description'])) $result['description'] = $desc;
            }
        }
        // name=description meta tag
        if (empty($result['description']) && preg_match('/<meta name="description" content="([^"]+)"/i', $mHtml, $m)) {
            $desc = html_entity_decode(trim($m[1]), ENT_QUOTES);
            if (!empty($desc) && !preg_match('/^Log in|^Facebook/i', $desc)) $result['description'] = $desc;
        }
        // JSON-LD structured data
        if (empty($result['description']) && preg_match_all('/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/is', $mHtml, $allLd)) {
            foreach ($allLd[1] as $ldBlob) {
                $ld = json_decode($ldBlob, true);
                if (!is_array($ld)) continue;
                if (!empty($ld['description']) && strlen($ld['description']) > 5) {
                    $result['description'] = html_entity_decode(strip_tags($ld['description']), ENT_QUOTES);
                    break;
                }
            }
        }
        // Broad key sweep in embedded JSON
        if (empty($result['description'])) {
            if (preg_match('/"biography"\s*:\s*"((?:[^"\\\\]|\\\\.){5,500})"/s', $mHtml, $bioM)) {
                $bio = json_decode('"' . $bioM[1] . '"');
                if ($bio && is_string($bio)) $result['description'] = $bio;
            } elseif (preg_match('/"intro"\s*:\s*\{[^}]*"text"\s*:\s*"((?:[^"\\\\]|\\\\.){5,500})"/s', $mHtml, $bioM)) {
                $bio = json_decode('"' . $bioM[1] . '"');
                if ($bio && is_string($bio)) $result['description'] = $bio;
            }
        }

        if (empty($result['profilePicture']) && preg_match('/<meta property="og:image" content="([^"]+)"/i', $mHtml, $m)) {
            $result['profilePicture'] = $m[1];
        }

        if (!$followerFound && preg_match('/([0-9.,]+[KMBkmb]?)\s+(?:people follow|followers?|likes?|people like this)/i', $mHtml, $m)) {
            $fc = parseSocialNumber($m[1]);
            if ($fc > 0) {
                $result['subscribers'] = $fc;
                $result['followers']   = $fc;
                $followerFound = true;
            }
        }

        if (!$followerFound && preg_match('/"follower_count"\s*:\s*([0-9]+)/i', $mHtml, $fM)) {
            $result['subscribers'] = (int)$fM[1];
            $result['followers']   = (int)$fM[1];
            $followerFound = true;
        }
    }

    // ── SOURCE 2: Desktop Facebook Web Scraper (+ JSON sweeps) ───────────
    if (empty($result['description']) || !$followerFound) {
        $dHtml = fetchSocialPage('https://www.facebook.com/' . urlencode($fbHandle));
        if ($dHtml) {
            $htmlContent .= ' ' . $dHtml;
            if ($result['title'] === $fbHandle . ' Facebook' && preg_match('/<meta property="og:title" content="([^"]+)"/i', $dHtml, $m)) {
                $title = html_entity_decode(trim($m[1]), ENT_QUOTES);
                $result['title']       = $title;
                $result['channelName'] = $title;
            }
            if (empty($result['description']) && preg_match('/<meta (?:name|property)="(?:description|og:description)" content="([^"]+)"/i', $dHtml, $m)) {
                $desc = html_entity_decode(trim($m[1]), ENT_QUOTES);
                if (!empty($desc) && !preg_match('/^Log in to Facebook|^Facebook/i', $desc)) {
                    $result['description'] = $desc;
                }
            }
            // JSON key sweeps for embedded data
            if (empty($result['description'])) {
                if (preg_match('/"biography"\s*:\s*"((?:[^"\\\\]|\\\\.){5,500})"/s', $dHtml, $bioM)) {
                    $bio = json_decode('"' . $bioM[1] . '"');
                    if ($bio && is_string($bio)) $result['description'] = $bio;
                } elseif (preg_match('/"intro"\s*:\s*\{[^}]*"text"\s*:\s*"((?:[^"\\\\]|\\\\.){5,500})"/s', $dHtml, $bioM)) {
                    $bio = json_decode('"' . $bioM[1] . '"');
                    if ($bio && is_string($bio)) $result['description'] = $bio;
                } elseif (preg_match('/"description"\s*:\s*\{[^}]*"text"\s*:\s*"((?:[^"\\\\]|\\\\.){5,500})"/s', $dHtml, $bioM)) {
                    $bio = json_decode('"' . $bioM[1] . '"');
                    if ($bio && is_string($bio) && !preg_match('/^Log in|^Facebook/i', $bio)) $result['description'] = $bio;
                }
            }
            if (empty($result['profilePicture']) && preg_match('/<meta property="og:image" content="([^"]+)"/i', $dHtml, $m)) {
                $result['profilePicture'] = $m[1];
            }
            if (!$followerFound && preg_match('/([0-9.,]+[KMBkmb]?)\s+(?:people follow|followers?|likes?|people like this)/i', $dHtml, $m)) {
                $fc = parseSocialNumber($m[1]);
                if ($fc > 0) {
                    $result['subscribers'] = $fc;
                    $result['followers']   = $fc;
                    $followerFound = true;
                }
            }
            if (!$followerFound && preg_match('/"follower_count"\s*:\s*([0-9]+)/i', $dHtml, $fM)) {
                $result['subscribers'] = (int)$fM[1];
                $result['followers']   = (int)$fM[1];
                $followerFound = true;
            }
        }
    }

    // ── SOURCE 3: RapidAPI Facebook Scraper ───────────────────────────
    if ((empty($result['description']) || !$followerFound) && $apiKey) {
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
                    $followerFound = true;
                }
            }
        }
    }

    $result['codeVerified'] = checkVerificationCodeMatch(
        $verificationCode,
        $result['description'],
        $result['title'],
        $htmlContent
    );

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

    $handle = '';
    if (preg_match('/(?:t\.me|telegram\.me|telegram\.dog)\/(?:s\/)?([^\/\?#]+)/i', $url, $m)) {
        $handle = trim($m[1]);
    } else {
        $handle = ltrim(trim($url), '@');
    }

    if (!$handle) return $result;

    $result['channelName'] = '@' . $handle;
    $result['title']       = '@' . $handle . ' Telegram';

    $htmlContent = '';
    $subCount = 0;

    // ── SOURCE 1: Official Public Web Preview (https://t.me/s/channel) ───
    $sHtml = fetchSocialPage('https://t.me/s/' . urlencode($handle));
    if ($sHtml) {
        $htmlContent .= ' ' . $sHtml;

        // Title
        if (preg_match('/<div[^>]*class="[^"]*tgme_channel_info_header_title[^"]*"[^>]*>.*?<span[^>]*dir="auto"[^>]*>([^<]+)<\/span>/is', $sHtml, $m)) {
            $result['title'] = html_entity_decode(trim($m[1]), ENT_QUOTES);
        } elseif (preg_match('/<div[^>]*class="[^"]*tgme_channel_info_header_title[^"]*"[^>]*>([^<]+)<\/div>/is', $sHtml, $m)) {
            $result['title'] = html_entity_decode(trim($m[1]), ENT_QUOTES);
        } elseif (preg_match('/<meta property="og:title" content="([^"]+)"/i', $sHtml, $m)) {
            $result['title'] = html_entity_decode(trim($m[1]), ENT_QUOTES);
        }

        // Bio / Description
        if (preg_match('/<div[^>]*class="[^"]*tgme_channel_info_description[^"]*"[^>]*>(.*?)<\/div>/is', $sHtml, $m)) {
            $result['description'] = html_entity_decode(trim(strip_tags($m[1])), ENT_QUOTES);
        } elseif (preg_match('/<meta property="og:description" content="([^"]+)"/i', $sHtml, $m)) {
            $result['description'] = html_entity_decode(trim($m[1]), ENT_QUOTES);
        }

        // Profile Avatar
        if (preg_match('/<img[^>]*class="[^"]*tgme_page_photo_image[^"]*"[^>]+src="([^"]+)"/is', $sHtml, $m)) {
            $result['profilePicture'] = $m[1];
        } elseif (preg_match('/<meta property="og:image" content="([^"]+)"/i', $sHtml, $m)) {
            $result['profilePicture'] = $m[1];
        }

        // Subscribers / Members counter
        if (preg_match('/<div[^>]*class="[^"]*tgme_channel_info_counter[^"]*"[^>]*>.*?<span[^>]*class="[^"]*counter_value[^"]*"[^>]*>([^<]+)<\/span>\s*<span[^>]*class="[^"]*counter_type[^"]*"[^>]*>(?:subscribers?|members?)/is', $sHtml, $m)) {
            $subCount = parseSocialNumber($m[1]);
        } elseif (preg_match('/<div[^>]*class="[^"]*tgme_page_extra[^"]*"[^>]*>([^<]+)\s*(?:subscribers?|members?)<\/div>/is', $sHtml, $m)) {
            $subCount = parseSocialNumber($m[1]);
        } elseif (preg_match('/([0-9.,\s]+[KMBkmb]?)\s*(?:subscribers?|members?)/i', $sHtml, $m)) {
            $subCount = parseSocialNumber($m[1]);
        }
    }

    // ── SOURCE 2: Standard preview fallback (https://t.me/channel) ───────
    if (empty($result['description']) || $subCount === 0) {
        $tHtml = fetchSocialPage('https://t.me/' . urlencode($handle));
        if ($tHtml) {
            $htmlContent .= ' ' . $tHtml;
            if ($result['title'] === '@' . $handle . ' Telegram' && preg_match('/<div[^>]*class="[^"]*tgme_page_title[^"]*"[^>]*>([^<]+)<\/div>/i', $tHtml, $m)) {
                $result['title'] = html_entity_decode(trim($m[1]), ENT_QUOTES);
            }
            if (empty($result['description']) && preg_match('/<div[^>]*class="[^"]*tgme_page_description[^"]*"[^>]*>(.*?)<\/div>/is', $tHtml, $m)) {
                $result['description'] = html_entity_decode(trim(strip_tags($m[1])), ENT_QUOTES);
            }
            if (empty($result['profilePicture']) && preg_match('/<meta property="og:image" content="([^"]+)"/i', $tHtml, $m)) {
                $result['profilePicture'] = $m[1];
            }
            if ($subCount === 0 && preg_match('/<div[^>]*class="[^"]*tgme_page_extra[^"]*"[^>]*>([^<]+)\s*(?:subscribers?|members?)<\/div>/i', $tHtml, $m)) {
                $subCount = parseSocialNumber($m[1]);
            }
        }
    }

    if ($subCount > 0) {
        $result['subscribers'] = $subCount;
        $result['followers']   = $subCount;
    }

    $result['codeVerified'] = checkVerificationCodeMatch(
        $verificationCode,
        $result['description'],
        $result['title'],
        $htmlContent
    );

    return $result;
}
?>
