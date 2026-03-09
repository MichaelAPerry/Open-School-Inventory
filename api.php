<?php
/**
 * CIT Inventory — Server API
 * Drop this file next to cit-inventory.html on your web server.
 * Data is stored in cit-data.json in the same directory.
 *
 * GET  api.php        → returns full inventory JSON
 * POST api.php        → saves full inventory JSON, returns {ok, ts}
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store, no-cache, must-revalidate');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// ── Config ────────────────────────────────────────────────────────────────────
$DATA_FILE  = __DIR__ . '/cit-data.json';
$BACKUP_DIR = __DIR__ . '/cit-backups';
$MAX_BACKUPS = 30;   // keep last 30 daily backups

// Optional: set a secret token to prevent random people on the network
// from writing data. Leave empty ('') to disable.
// Must match $SYNC_TOKEN in cit-inventory.html JS (see comment there).
$SECRET = '';

// ── Auth check ────────────────────────────────────────────────────────────────
if ($SECRET !== '') {
    $token = $_SERVER['HTTP_X_CIT_TOKEN'] ?? ($_GET['token'] ?? '');
    if ($token !== $SECRET) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }
}

// ── GET — return current data ─────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (file_exists($DATA_FILE)) {
        echo file_get_contents($DATA_FILE);
    } else {
        // First run — return empty scaffold
        echo json_encode([
            'inv'  => [],
            'co'   => [],
            'sett' => null,
            'ts'   => 0
        ]);
    }
    exit;
}

// ── POST — save data ──────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw = file_get_contents('php://input');
    if (!$raw) {
        http_response_code(400);
        echo json_encode(['error' => 'Empty body']);
        exit;
    }

    $data = json_decode($raw, true);
    if ($data === null) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON: ' . json_last_error_msg()]);
        exit;
    }

    // Sanity check — must have at least inv or co keys
    if (!isset($data['inv']) && !isset($data['co'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required keys (inv, co)']);
        exit;
    }

    // Stamp server-side timestamp (authoritative)
    $data['ts'] = round(microtime(true) * 1000);
    $data['savedAt'] = date('c');

    // ── Daily backup (once per day) ───────────────────────────────────────────
    $today = date('Y-m-d');
    if (!is_dir($BACKUP_DIR)) {
        @mkdir($BACKUP_DIR, 0755, true);
        // Prevent directory listing
        file_put_contents($BACKUP_DIR . '/.htaccess', "Deny from all\n");
    }
    $backupFile = $BACKUP_DIR . '/cit-data-' . $today . '.json';
    if (!file_exists($backupFile) && file_exists($DATA_FILE)) {
        @copy($DATA_FILE, $backupFile);
    }

    // ── Trim old backups ──────────────────────────────────────────────────────
    $backups = glob($BACKUP_DIR . '/cit-data-*.json');
    if ($backups && count($backups) > $MAX_BACKUPS) {
        sort($backups);
        $toDelete = array_slice($backups, 0, count($backups) - $MAX_BACKUPS);
        foreach ($toDelete as $f) @unlink($f);
    }

    // ── Write main data file (atomic via temp file) ───────────────────────────
    $tmp = $DATA_FILE . '.tmp.' . uniqid();
    $bytes = file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);

    if ($bytes === false) {
        http_response_code(500);
        echo json_encode(['error' => 'Write failed — check file permissions on ' . dirname($DATA_FILE)]);
        @unlink($tmp);
        exit;
    }

    if (!rename($tmp, $DATA_FILE)) {
        // rename failed (cross-device?), fallback to direct write
        file_put_contents($DATA_FILE, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
        @unlink($tmp);
    }

    echo json_encode(['ok' => true, 'ts' => $data['ts'], 'savedAt' => $data['savedAt']]);
    exit;
}

// ── Anything else ─────────────────────────────────────────────────────────────
http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
