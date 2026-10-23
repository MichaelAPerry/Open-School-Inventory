<?php
/**
 * Open School Inventory — Server API
 * Drop this file next to open-school-inventory.html on your web server (XAMPP, Apache, IIS).
 * Requires PHP 7.0+.
 *
 * GET  api.php                  → full data (admin PIN removed)
 * POST api.php                  → merge client data into server data, returns merged data
 * POST api.php?action=unlock    → {pin}          → {ok}
 * POST api.php?action=setpin    → {old, new}     → {ok}
 *
 * Sync model: every inventory item and checkout record carries a "u" (updated-at, ms)
 * timestamp. Deletions are recorded in "del" as {id: deletedAt}. The server merges
 * record-by-record (newest "u" wins), so two machines saving at the same time no longer
 * overwrite each other, and a machine that was offline can safely catch up later.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('X-Content-Type-Options: nosniff');

// ── Config ────────────────────────────────────────────────────────────────────
// Data lives in a sub-folder that is blocked from direct download.
// For best security, point this at a folder OUTSIDE your web root,
// e.g. 'C:/xampp/osi-data' on Windows.
$DATA_DIR    = __DIR__ . '/osi-data';
$MAX_BACKUPS = 30;            // keep last 30 daily backups
$MAX_BODY    = 8 * 1024 * 1024; // reject uploads over 8 MB
$DEFAULT_PIN = '1234';

$DATA_FILE  = $DATA_DIR . '/osi-data.json';
$BACKUP_DIR = $DATA_DIR . '/backups';
$LOCK_FILE  = $DATA_DIR . '/osi-data.lock';

function respond($code, $payload) {
    http_response_code($code);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── First-run setup: protected data folder + migration from old versions ────
if (!is_dir($DATA_DIR) && !@mkdir($DATA_DIR, 0755, true)) {
    respond(500, ['error' => 'Cannot create data folder ' . $DATA_DIR . ' — check folder permissions']);
}
if (!file_exists($DATA_DIR . '/.htaccess')) {
    // Works on Apache 2.2 and 2.4 (XAMPP). IIS users: see SETUP.md.
    @file_put_contents($DATA_DIR . '/.htaccess',
        "<IfModule mod_authz_core.c>\n  Require all denied\n</IfModule>\n" .
        "<IfModule !mod_authz_core.c>\n  Order allow,deny\n  Deny from all\n</IfModule>\n");
}
if (!file_exists($DATA_DIR . '/index.html')) {
    @file_put_contents($DATA_DIR . '/index.html', '');
}
// Older versions stored data in cit-data.json next to this file, where anyone could
// download it. Move it into the protected folder (kept as a pre-migration copy too).
$LEGACY_FILE = __DIR__ . '/cit-data.json';
if (!file_exists($DATA_FILE) && file_exists($LEGACY_FILE)) {
    if (@copy($LEGACY_FILE, $DATA_FILE)) {
        @rename($LEGACY_FILE, $DATA_DIR . '/cit-data-premigration.json');
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function emptyData() {
    return ['inv' => [], 'co' => [], 'sett' => null, 'del' => new stdClass(), 'ts' => 0];
}

function readData($file) {
    if (!file_exists($file)) return emptyData();
    $d = json_decode(file_get_contents($file), true);
    if (!is_array($d)) {
        // Never treat a damaged file as empty — the next save would overwrite it
        respond(500, ['error' => 'Data file is damaged (' . json_last_error_msg() . '). Restore ' . basename($file) . ' from the backups folder.']);
    }
    $d['inv'] = isset($d['inv']) && is_array($d['inv']) ? $d['inv'] : [];
    $d['co']  = isset($d['co'])  && is_array($d['co'])  ? $d['co']  : [];
    $d['del'] = isset($d['del']) && is_array($d['del']) ? $d['del'] : [];
    $d['sett'] = isset($d['sett']) && is_array($d['sett']) ? $d['sett'] : null;
    return $d;
}

function writeData($file, $data) {
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) return false;
    $tmp = $file . '.tmp.' . uniqid();
    if (file_put_contents($tmp, $json) === false) { @unlink($tmp); return false; }
    if (!@rename($tmp, $file)) {
        // rename can fail on Windows when the target exists — fall back to direct write
        $ok = file_put_contents($file, $json) !== false;
        @unlink($tmp);
        return $ok;
    }
    return true;
}

function validId($id) {
    return is_string($id) && preg_match('/^[A-Za-z0-9._-]{1,64}$/', $id);
}

function recU($r) {
    return isset($r['u']) && is_numeric($r['u']) ? (float)$r['u'] : 0;
}

// Merge two record lists by id; on equal timestamps $b (incoming) wins.
function mergeList($a, $b, &$del) {
    $out = [];
    foreach ([$a, $b] as $list) {
        foreach ($list as $r) {
            if (!is_array($r) || !isset($r['id']) || !validId($r['id'])) continue;
            $id = $r['id'];
            if (!isset($out[$id]) || recU($r) >= recU($out[$id])) $out[$id] = $r;
        }
    }
    $res = [];
    foreach ($out as $id => $r) {
        if (isset($del[$id])) {
            if ((float)$del[$id] >= recU($r)) continue; // deleted after last edit
            unset($del[$id]);                           // re-created after deletion
        }
        $res[] = $r;
    }
    return $res;
}

function mergeData($server, $incoming) {
    $del = [];
    foreach ([$server['del'], isset($incoming['del']) && is_array($incoming['del']) ? $incoming['del'] : []] as $d) {
        foreach ($d as $id => $t) {
            if (!validId((string)$id) || !is_numeric($t)) continue;
            if (!isset($del[$id]) || (float)$t > $del[$id]) $del[$id] = (float)$t;
        }
    }
    $inInv = isset($incoming['inv']) && is_array($incoming['inv']) ? $incoming['inv'] : [];
    $inCo  = isset($incoming['co'])  && is_array($incoming['co'])  ? $incoming['co']  : [];
    $out = $server;
    $out['inv'] = mergeList($server['inv'], $inInv, $del);
    $out['co']  = mergeList($server['co'],  $inCo,  $del);
    $out['del'] = (object)$del; // keep as a JSON object even when ids look numeric

    // Settings: newest wins, but the PIN is only ever changed through ?action=setpin
    $sSett = $server['sett'];
    $iSett = isset($incoming['sett']) && is_array($incoming['sett']) ? $incoming['sett'] : null;
    if ($iSett !== null && ($sSett === null || recU($iSett) >= recU($sSett))) {
        $pin = $sSett !== null && isset($sSett['pin']) ? $sSett['pin'] : null;
        if ($pin === null && isset($iSett['pin']) && is_string($iSett['pin']) && preg_match('/^\d{4,8}$/', $iSett['pin'])) {
            $pin = $iSett['pin']; // first sync from a browser that only had a local PIN
        }
        $iSett['pin'] = $pin;
        if ($pin === null) unset($iSett['pin']);
        $out['sett'] = $iSett;
    }
    return $out;
}

function publicData($d) {
    if (isset($d['sett']) && is_array($d['sett'])) unset($d['sett']['pin']);
    $d['del'] = (object)(isset($d['del']) ? (array)$d['del'] : []);
    return $d;
}

function checkPin($stored, $given, $default) {
    if (!is_string($given) || $given === '') return false;
    if ($stored === null || $stored === '') return hash_equals($default, $given);
    if (strpos($stored, '$') === 0) return password_verify($given, $stored);
    return hash_equals((string)$stored, $given); // legacy plain-text PIN
}

function readBody($max) {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') respond(400, ['error' => 'Empty body']);
    if (strlen($raw) > $max) respond(413, ['error' => 'Upload too large']);
    $data = json_decode($raw, true);
    if (!is_array($data)) respond(400, ['error' => 'Invalid JSON: ' . json_last_error_msg()]);
    return $data;
}

// Exclusive lock around every read-modify-write so concurrent saves can't clobber each other
function withLock($lockFile, $fn) {
    $fh = fopen($lockFile, 'c');
    if (!$fh) respond(500, ['error' => 'Cannot open lock file — check permissions on ' . dirname($lockFile)]);
    flock($fh, LOCK_EX);
    try { return $fn(); }
    finally { flock($fh, LOCK_UN); fclose($fh); }
}

$method = $_SERVER['REQUEST_METHOD'];
$action = isset($_GET['action']) ? $_GET['action'] : '';

// ── GET — return current data (without the PIN) ───────────────────────────────
if ($method === 'GET') {
    $d = withLock($LOCK_FILE, function () use ($DATA_FILE) { return readData($DATA_FILE); });
    respond(200, publicData($d));
}

if ($method !== 'POST') respond(405, ['error' => 'Method not allowed']);

// ── POST ?action=unlock — verify admin PIN ────────────────────────────────────
if ($action === 'unlock') {
    $body = readBody(4096);
    $d = readData($DATA_FILE);
    $stored = isset($d['sett']['pin']) ? $d['sett']['pin'] : null;
    if (checkPin($stored, isset($body['pin']) ? $body['pin'] : '', $DEFAULT_PIN)) respond(200, ['ok' => true]);
    usleep(800000); // slow down guessing
    respond(403, ['ok' => false, 'error' => 'Incorrect PIN']);
}

// ── POST ?action=setpin — change admin PIN ────────────────────────────────────
if ($action === 'setpin') {
    $body = readBody(4096);
    $new = isset($body['new']) ? $body['new'] : '';
    if (!is_string($new) || !preg_match('/^\d{4,8}$/', $new)) respond(400, ['ok' => false, 'error' => 'PIN must be 4–8 digits']);
    $result = withLock($LOCK_FILE, function () use ($DATA_FILE, $body, $new, $DEFAULT_PIN) {
        $d = readData($DATA_FILE);
        $stored = isset($d['sett']['pin']) ? $d['sett']['pin'] : null;
        if (!checkPin($stored, isset($body['old']) ? $body['old'] : '', $DEFAULT_PIN)) return 'bad';
        if ($d['sett'] === null) $d['sett'] = [];
        $d['sett']['pin'] = password_hash($new, PASSWORD_DEFAULT);
        return writeData($DATA_FILE, $d) ? 'ok' : 'fail';
    });
    if ($result === 'bad') { usleep(800000); respond(403, ['ok' => false, 'error' => 'Current PIN is incorrect']); }
    if ($result === 'fail') respond(500, ['ok' => false, 'error' => 'Write failed — check folder permissions']);
    respond(200, ['ok' => true]);
}

if ($action !== '' && $action !== 'sync') respond(400, ['error' => 'Unknown action']);

// ── POST — merge and save ─────────────────────────────────────────────────────
$incoming = readBody($MAX_BODY);
if (!isset($incoming['inv']) && !isset($incoming['co'])) respond(400, ['error' => 'Missing required keys (inv, co)']);

$result = withLock($LOCK_FILE, function () use ($DATA_FILE, $BACKUP_DIR, $MAX_BACKUPS, $incoming) {
    $current = readData($DATA_FILE); // stops here if the file is damaged, before any backup is taken

    // Daily backup of the previous state (first save of each day)
    if (!is_dir($BACKUP_DIR)) @mkdir($BACKUP_DIR, 0755, true);
    $backupFile = $BACKUP_DIR . '/osi-data-' . date('Y-m-d') . '.json';
    if (!file_exists($backupFile) && file_exists($DATA_FILE)) @copy($DATA_FILE, $backupFile);
    $backups = glob($BACKUP_DIR . '/osi-data-*.json');
    if ($backups && count($backups) > $MAX_BACKUPS) {
        sort($backups);
        foreach (array_slice($backups, 0, count($backups) - $MAX_BACKUPS) as $f) @unlink($f);
    }

    $merged = mergeData($current, $incoming);
    $merged['ts'] = round(microtime(true) * 1000);
    $merged['savedAt'] = date('c');
    if (!writeData($DATA_FILE, $merged)) return null;
    return $merged;
});

if ($result === null) respond(500, ['error' => 'Write failed — check file permissions on ' . $DATA_DIR]);
$out = publicData($result);
$out['ok'] = true;
respond(200, $out);
