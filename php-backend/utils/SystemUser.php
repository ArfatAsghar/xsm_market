<?php

// Resolves the user id to use as the sender of automated "system" chat
// messages. Previously this was hardcoded to 1, which only works if the
// very first user ever created still has id 1 - not true on every DB
// (e.g. a locally restored dump can start at a much higher id). Resolves
// to the dedicated website_agent account, falling back to any admin user,
// and finally to literal 1 to preserve old behavior if neither exists.
function getSystemUserId($pdo) {
    static $cachedId = null;
    if ($cachedId !== null) {
        return $cachedId;
    }

    $stmt = $pdo->prepare("SELECT id FROM users WHERE username = 'website_agent' OR email = 'support@xsm-market.local' LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        $stmt = $pdo->prepare("SELECT id FROM users WHERE isAdmin = 1 ORDER BY id ASC LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    $cachedId = $row ? (int)$row['id'] : 1;
    return $cachedId;
}
