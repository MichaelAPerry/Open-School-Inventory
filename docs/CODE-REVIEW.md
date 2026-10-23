# Code Review & Improvement Plan

Review of the version uploaded in March 2026 (`open-school-inventory.html` + `api.php`), what this
update changed, and what is planned next.

Severity: 🔴 broken / data loss / security · 🟠 wrong results · 🟡 usability or robustness

## Part 1 — Findings and fixes in this update

### Broken as uploaded

| # | Sev | Finding | Fix |
|---|---|---|---|
| 1 | 🔴 | **The HTML file in the repo is cut off** mid-line (`document.addEventLis`), with no closing `});`, `</script>` or `</html>`. That's a JavaScript syntax error, so **none of the app runs** from the GitHub copy. (The copy on your server may still be complete.) | Rebuilt the script. |
| 2 | 🔴 | The file was saved from a page served through Cloudflare. It contained `/cdn-cgi/…/email-decode.min.js` (404 on XAMPP) and an example email replaced by `[email protected]`. | Removed. |
| 3 | 🟡 | Broken markup `<div class="nav-brand-icon">OSI/div>`. | Fixed. |

### Security

| # | Sev | Finding | Fix |
|---|---|---|---|
| 4 | 🔴 | **Admin PIN readable by anyone.** It was stored in plain text in `cit-data.json` and returned by `GET api.php`. Any student who opened `/api.php` or `/cit-data.json` in a browser could read it. | `api.php` strips the PIN from every response and checks it server-side (`?action=unlock`). The PIN is stored hashed (`password_hash`). Wrong guesses are slowed down. Changing the PIN requires the current one. |
| 5 | 🔴 | **Data file downloadable.** `cit-data.json`, which holds student IDs and checkout history, sat in the web root. | Data moved to `osi-data/` with a deny-all `.htaccess`. `$DATA_DIR` can point outside the web root. Existing data migrates automatically. |
| 6 | 🔴 | **Stored XSS.** Student-typed notes, item names, locations and scanned QR text were inserted as raw HTML. A note like `<img src=x onerror=…>` would run in the teacher's browser with admin unlocked. | Everything is escaped (`esc()`). Item IDs are restricted to `A–Z 0–9 . _ -`. |
| 7 | 🟠 | `Access-Control-Allow-Origin: *` let any website a student visits read or overwrite the inventory through their browser. | Removed. The page and API are same-origin. |
| 8 | 🟡 | `.htaccess` used Apache 2.2 syntax only. | Generated file supports 2.2 and 2.4. IIS `web.config` is documented. |
| 9 | 🟡 | Admin stayed unlocked forever on a shared kiosk. | Auto-locks after 10 minutes without interaction. |

### Data loss / sync

| # | Sev | Finding | Fix |
|---|---|---|---|
| 10 | 🔴 | **Last save wins for the whole file.** If two devices saved within the same window, such as two students checking out at once or the kiosk and the teacher PC, one device's changes were silently lost. | Every record now carries an updated-at stamp. Deletions are recorded. `api.php` merges record by record under a file lock. Tested with two simultaneous kiosks. |
| 11 | 🔴 | **Offline changes were thrown away.** The banner promised "changes will sync when connection restores", but the next poll overwrote local changes with the server copy. | Unsynced changes are tracked and pushed when the server is reachable again. Tested with a kiosk taken offline. |
| 12 | 🔴 | **"Clear All Data" and deletes didn't reach the server** (`DB.del` never pushed), so the data came back on the next poll. | Deletions sync as tombstones, so other devices can't bring them back. |
| 13 | 🟠 | Item IDs came from the clock (`Date.now()` → 6 chars). Items created in the same millisecond, as in a bulk import, got the same ID. | Random 5-character IDs from an unambiguous alphabet (no 0/O, 1/I), checked for uniqueness. |
| 14 | 🟡 | A damaged data file would have been treated as empty and overwritten. | `api.php` refuses to save and explains how to restore from `osi-data/backups/`. |

### Wrong results

| # | Sev | Finding | Fix |
|---|---|---|---|
| 15 | 🔴 | **Negative checkout quantity** (`-3`) passed validation and *increased* stock. | Whole numbers ≥ 1 only. |
| 16 | 🟠 | Low-stock threshold `0` was saved as `2` (`parseInt(…) \|\| 2`). | `0` is kept. |
| 17 | 🟠 | Consumables (screws, zip ties) had to be "checked out" and never came back, so they filled the end-of-day report forever. | New **Item Type: Consumable**. Taking one lowers on-hand and is logged as *Used*, not as an open checkout. EOD lists consumables used today separately. |
| 18 | 🟡 | QR scanner errors (no HTTPS, camera denied) failed silently, because the promise rejection was never caught. | Clear message with what to do instead. |
| 19 | 🟡 | README promised CSV import; it didn't exist. README linked `SETUP.md`; it didn't exist. | Both added. |
| 20 | 🟡 | USB scanner only worked on the student ID box. Scanning an item label didn't select it. | Scan + Enter selects the item on Checkout and opens it on Inventory. Returns and History accept scans too. Matching is case-insensitive and also matches district asset tags. |
| 21 | 🟡 | Every list re-parsed all of localStorage per item (O(items × records)), which slows down after a few thousand checkouts. | In-memory cache plus one pass to count quantities. |
| 22 | 🟡 | All libraries came from CDNs, so QR labels and scanning broke when the internet was down. | QR libraries bundled in `vendor/` with the CDN as fallback. Email still needs the internet, by design. |
| 23 | 🟡 | Printed labels had no layout for real label stock. | Avery 5160/8160 sheets and Dymo 30334 / 30336 rolls, one label per unit, and a white quiet zone around each QR. Verified by decoding every printed QR. |
| 24 | 🟡 | Categories were hard-coded for PC parts only. | Editable in **Settings → Categories**. CSV import adds new ones. |
| 25 | 🟡 | `user-scalable=no` blocked pinch-zoom, an accessibility problem. | Removed. |
| 26 | 🟡 | CSV export could be opened as formulas by Excel ("CSV injection") from student-typed notes. | Cells starting with `= + - @` are neutralised. |

All of the above is covered by `tests/e2e.test.js` (55 checks: two kiosks, offline, XSS, PIN, CSV,
labels, phone link flow).

## Part 2 — Known limits (still true after this update)

- **The admin lock protects the screens, not the data.** Writes to `api.php` are still unauthenticated,
  so a student with browser developer tools could edit data directly. This is the top item for the next phase.
- **Device clocks matter.** "Newest edit wins" uses each device's clock. School-managed devices are normally
  time-synced; a device with a badly wrong clock could win or lose an edit it shouldn't.
- **Capacity.** Each device keeps a full copy in browser storage (about 5 MB). That holds roughly
  **15,000 checkout records** plus a few thousand items. A busy shop doing 30 checkouts a day reaches that in about
  2½ school years. Until archiving exists (roadmap #6), export the History CSV each June and clear old records.
  Not designed for a whole district.
- Email uses EmailJS from the browser, so the EmailJS public key is visible to anyone who can open Settings.

## Part 3 — Roadmap

### Phase 2 — hardening (recommended next)
1. **Server-enforced admin.** `unlock` returns a short-lived session token, and `api.php` rejects inventory
   edits, returns and deletes without it. Students can only add checkouts.
2. **Action endpoints** (`checkout`, `return`) instead of sending the whole data set. The server checks
   available quantity, so two students can never take the last unit at the same time.
3. **Student roster import** (ID, name, class period). Checkout rejects unknown IDs and the EOD report shows names.
4. **Due dates and overdue list.** Per-item loan period, highlighted on the dashboard and in the EOD report.
5. **Partial returns** (return 3 of 5).
6. **History archiving.** Move returned or used records older than a school year into
   `osi-data/archive-YYYY.json` on the server, so devices only keep the current year.

### Phase 3 — shop operations
7. **Audit mode.** Pick a location, scan every label there, and get a report of missing, unexpected and misplaced items.
8. **Individual unit tracking.** One item with child units (`OSI-ABCDE-01…08`), so each multimeter
   has its own history while the catalogue stays one line.
9. **Maintenance log** for equipment (calibration, blade changes, safety checks) with reminders.
10. **Photos** of items and of damage on return.

### Phase 4 — platform
11. **SQLite storage** (PHP's built-in PDO SQLite driver; no database server needed) with an append-only audit log.
12. **Installable offline app (PWA)** so kiosks keep working without the server and sync later.
13. **Server-side email** through the district SMTP server (PHPMailer), replacing EmailJS.
14. **Accessibility pass**: contrast, focus order, screen reader labels, larger touch targets.
15. **CI**: run the end-to-end tests on every push with GitHub Actions.
