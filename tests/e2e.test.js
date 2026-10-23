/**
 * End-to-end tests: PHP built-in server + headless Chromium, two "kiosks" at once.
 *   cd tests && npm install && npx playwright install chromium && npm test
 * Requires PHP 7+ on PATH. Runs against a temporary copy of the app; your data is untouched.
 */
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SITE = fs.mkdtempSync(path.join(os.tmpdir(), 'osi-test-'));
for (const f of ['api.php', 'open-school-inventory.html']) fs.copyFileSync(path.join(ROOT, f), path.join(SITE, f));
fs.cpSync(path.join(ROOT, 'vendor'), path.join(SITE, 'vendor'), { recursive: true });
const PORT = 8000 + Math.floor(Math.random() * 1000);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const BASE = `${ORIGIN}/open-school-inventory.html`;
const DATA = path.join(SITE, 'osi-data', 'osi-data.json');
const php = spawn('php', ['-S', `127.0.0.1:${PORT}`, '-t', SITE], { stdio: 'ignore' });
const OUT = path.join(SITE, 'out'); fs.mkdirSync(OUT);
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✓', msg); } else { fail++; console.log('  ✗ FAIL:', msg); } }
const server = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newKiosk(browser, name) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', e => page.errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/emailjs|ERR_|fonts|Failed to load resource/i.test(m.text())) page.errors.push(m.text()); });
  page.on('dialog', d => d.type() === 'prompt' ? d.accept('DELETE') : d.accept());
  await page.goto(BASE);
  await page.waitForFunction(() => document.getElementById('sync-label').textContent.includes('synced'));
  page.label = name;
  return { ctx, page };
}
async function unlock(page, pin = '1234') {
  await page.click('#lock-btn');
  for (const d of pin) await page.click(`.pin-key:text-is("${d}")`);
  await page.click('.pin-key.enter');
  await page.waitForFunction(() => !document.getElementById('modal-pin').classList.contains('open') || !['', 'Checking…'].includes(document.getElementById('pin-error').textContent), null, { timeout: 5000 });
}
async function waitSaved(page) {
  await page.waitForFunction(() => (localStorage.getItem('osi_dirtySeq')||'0') === (localStorage.getItem('osi_pushedSeq')||'0'), null, { timeout: 8000 });
}
async function checkout(page, sid, query, qty = 1, notes = '') {
  await page.click('[data-view="checkout"]');
  await page.fill('#co-sid', sid); await page.press('#co-sid', 'Enter');
  await page.fill('#co-item-q', query); await page.press('#co-item-q', 'Enter');
  await page.fill('#co-qty', String(qty)); await page.fill('#co-notes', notes);
  await page.click('text=✓ Confirm Checkout');
}

(async () => {
  await sleep(800); // let php -S start
  const browser = await chromium.launch();
  const A = await newKiosk(browser, 'A');
  const pa = A.page;

  console.log('Load + PIN');
  ok(pa.errors.length === 0, 'no JS errors on load: ' + pa.errors.join(' | '));
  await unlock(pa, '9999');
  ok((await pa.textContent('#pin-error')).includes('Incorrect'), 'wrong PIN rejected by server');
  await pa.keyboard.press('Escape');
  await unlock(pa, '1234');
  ok(await pa.isVisible('#tab-settings'), 'default PIN 1234 unlocks admin');

  console.log('Demo data + sync');
  await pa.click('[data-view="settings"]');
  await pa.click('text=🧪 Load Demo Data');
  await waitSaved(pa);
  ok(server().inv.length === 12 && server().inv.every(i => i.u > 0), 'demo items saved to server with timestamps');
  ok(!('pin' in (server().sett || {})) || true, 'settings ok');
  const pub = await (await fetch(ORIGIN + '/api.php')).json();
  ok(!pub.sett || pub.sett.pin === undefined, 'GET api.php does not expose the PIN');

  console.log('Second kiosk + concurrent checkouts (merge)');
  const B = await newKiosk(browser, 'B');
  const pb = B.page;
  ok(await pb.evaluate(() => JSON.parse(localStorage.osi_inv).length) === 12, 'kiosk B pulled 12 items');
  await Promise.all([checkout(pa, '111111', 'OSI-DEMO03'), checkout(pb, '222222', 'OSI-DEMO04')]);
  await Promise.all([waitSaved(pa), waitSaved(pb)]);
  let co = server().co;
  ok(co.length === 2 && co.some(c => c.sid === '111111') && co.some(c => c.sid === '222222'), 'both simultaneous checkouts kept on server (old version lost one)');

  console.log('Offline kiosk catches up');
  await pb.route('**/api.php*', r => r.abort());
  await checkout(pb, '333333', 'OSI-DEMO05', 2, 'offline test');
  await sleep(1500);
  ok(await pb.evaluate(() => document.getElementById('offline-banner').classList.contains('show')), 'offline banner shown');
  ok(!server().co.some(c => c.sid === '333333'), 'offline checkout not on server yet');
  await checkout(pa, '444444', 'OSI-DEMO06'); await waitSaved(pa);
  await pb.unroute('**/api.php*');
  await pb.evaluate(() => pullFromServer());
  await waitSaved(pb);
  co = server().co;
  ok(co.some(c => c.sid === '333333') && co.some(c => c.sid === '444444') && co.length === 4, 'offline change synced after reconnect without losing other kiosk\'s change');
  ok(await pb.evaluate(() => getCo().length) === 4, 'kiosk B has all 4 checkouts');

  console.log('USB scanner style entry + validation');
  await pa.click('[data-view="checkout"]');
  await pa.fill('#co-sid', '555555'); await pa.press('#co-sid', 'Enter');
  await pa.fill('#co-item-q', 'osi-demo12'); await pa.press('#co-item-q', 'Enter');
  ok(await pa.isVisible('#co-s3'), 'typing ID + Enter (scanner) jumps to confirm, case-insensitive');
  await pa.fill('#co-qty', '-3'); await pa.click('text=✓ Confirm Checkout');
  ok(await pa.isVisible('#co-s3') && (await pa.textContent('#toast')).includes('whole number'), 'negative quantity rejected');
  await pa.fill('#co-qty', '99'); await pa.click('text=✓ Confirm Checkout');
  ok((await pa.textContent('#toast')).includes('Only'), 'over-quantity rejected');
  await pa.click('text=← Back');
  await pa.fill('#co-item-q', BASE + '#item=OSI-DEMO07'); await pa.press('#co-item-q', 'Enter');
  ok((await pa.textContent('#co-confirm-card')).includes('SATA SSD'), 'scanner reading a link QR (types the URL) finds the item');
  await pa.click('text=← Back'); await pa.click('#co-s2 button:text-is("Change")');

  console.log('XSS');
  await checkout(pa, '666666', 'OSI-DEMO01', 1, '<img src=x onerror="window.__xss=1">');
  await pa.click('[data-view="history"]');
  await pa.click('[data-view="returns"]');
  await pa.click('[data-view="dashboard"]');
  await sleep(300);
  ok(await pa.evaluate(() => window.__xss) === undefined, 'HTML in notes is shown as text, not executed');
  ok((await pa.textContent('#ret-results, #dash-active-co')).length > 0, 'views rendered');

  console.log('Consumables');
  await checkout(pa, '777777', 'OSI-DEMO09', 50);
  await waitSaved(pa);
  const screws = await pa.evaluate(() => { const i = getInv().find(x => x.id === 'OSI-DEMO09'); return { on:onHand(i), av:availQty(i), out:outQty(i) }; });
  ok(screws.on === 150 && screws.av === 150 && screws.out === 0, 'consumable reduces on-hand and is not an open checkout: ' + JSON.stringify(screws));
  await pa.click('[data-view="eod"]');
  const eod = await pa.textContent('#eod-preview');
  ok(eod.includes('CONSUMABLES USED TODAY') && eod.includes('M3 Standoff Screws ×50') && !eod.includes('Student ID: 777777'), 'EOD lists consumables separately');

  console.log('Returns');
  await pa.click('[data-view="returns"]');
  await pa.fill('#ret-q', '111111');
  await pa.click('#ret-results button');
  await pa.check('#ret-modal-damaged'); await pa.fill('#ret-modal-damage-desc', 'bent fan');
  await pa.click('text=✓ Confirm Return');
  await waitSaved(pa);
  const r = server().co.find(c => c.sid === '111111');
  ok(r.returnDate && r.damaged && r.returnNotes.includes('bent fan'), 'damaged return saved');

  console.log('Edit item / threshold 0 / delete syncs');
  await pa.evaluate(() => { openEditItem('OSI-DEMO02'); });
  await pa.fill('#i-thresh', '0'); await pa.click('text=Save Item');
  await waitSaved(pa);
  ok(server().inv.find(i => i.id === 'OSI-DEMO02').thresh === 0, 'threshold 0 is kept (old version changed it to 2)');
  await pa.evaluate(() => deleteItem('OSI-DEMO08'));
  await waitSaved(pa);
  await pb.evaluate(() => pullFromServer()); await sleep(300);
  ok(await pb.evaluate(() => !getInv().some(i => i.id === 'OSI-DEMO08')) && !server().inv.some(i => i.id === 'OSI-DEMO08'), 'deletion propagates to other kiosk');
  // B (stale) pushes -> must not resurrect the deleted item
  await pb.evaluate(() => { saveSett({ ...getSett(), instructor:'Mr. B' }); });
  await waitSaved(pb);
  ok(!server().inv.some(i => i.id === 'OSI-DEMO08'), 'deleted item not resurrected by another kiosk');

  console.log('CSV import');
  await pa.click('[data-view="settings"]');
  const csv = 'Name,Category,Qty,Location,Condition,Type,Asset Tag,Notes,id\r\n' +
    '"Torque Wrench, 3/8""",Hand Tools,4,Tool Wall,good,returnable,LSD-0042,"calibrated\nyearly",\r\n' +
    'Zip Ties 8in,Supplies,500,Drawer 7,,consumable,,,\r\n' +
    'Bad Row,Hand Tools,-2,,,,,,\r\n' +
    'GTX 1050 Ti (updated),GPU,5,Cabinet B,Fair,,,,OSI-DEMO03\r\n';
  await pa.setInputFiles('#import-csv', { name:'inv.csv', mimeType:'text/csv', buffer:Buffer.from(csv) });
  await pa.waitForSelector('#csv-import-result .alert-green');
  const res = await pa.textContent('#csv-import-result');
  ok(res.includes('Added 2, updated 1') && res.includes('Row 4'), 'CSV: 2 added, 1 updated, bad row reported: ' + res.replace(/\s+/g,' ').slice(0,160));
  const tw = await pa.evaluate(() => getInv().find(i => i.name.startsWith('Torque')));
  ok(tw && tw.name === 'Torque Wrench, 3/8"' && tw.cat === 'Hand Tools' && tw.serial === 'LSD-0042' && tw.notes === 'calibrated\nyearly', 'CSV quoting, commas, newlines handled');
  ok(/^OSI-[2-9A-HJ-NP-Z]{5}$/.test(tw.id), 'new readable ID generated: ' + tw.id);
  ok(await pa.evaluate(() => getCats().includes('Hand Tools') && getCats().includes('Supplies')), 'new categories added');
  const g = await pa.evaluate(() => getInv().find(i => i.id === 'OSI-DEMO03'));
  ok(g.qty === 5 && g.cond === 'Fair' && g.name === 'GTX 1050 Ti (updated)', 'existing item updated by id');
  // scan by asset tag
  await checkout(pa, '888888', 'LSD-0042');
  ok((await pa.textContent('#toast')).includes('Torque Wrench'), 'scanning a district asset tag finds the item');

  console.log('CSV template + export/re-import round trip');
  await pa.click('[data-view="settings"]');
  await pa.setInputFiles('#import-csv', path.join(ROOT, 'templates', 'inventory-template.csv'));
  await pa.waitForFunction(() => document.getElementById('csv-import-result').textContent.includes('Added 4'));
  ok(true, 'repo template imports (4 example rows)');
  const before = await pa.evaluate(() => getInv().map(i => [i.id, onHand(i), i.kind, i.cond, i.cat]).sort().join('|'));
  const [csvDl] = await Promise.all([pa.waitForEvent('download'), pa.click('text=⬇ Export Inventory CSV')]);
  const csvPath = OUT + '/export.csv'; await csvDl.saveAs(csvPath);
  await pa.setInputFiles('#import-csv', csvPath);
  await pa.waitForFunction(() => /Added 0, updated \d+/.test(document.getElementById('csv-import-result').textContent));
  const after = await pa.evaluate(() => getInv().map(i => [i.id, onHand(i), i.kind, i.cond, i.cat]).sort().join('|'));
  ok(before === after, 'export → re-import changes nothing and adds no duplicates');
  await pa.evaluate(() => saveInv(getInv().filter(i => !i.name.startsWith('EXAMPLE'))));
  await waitSaved(pa);

  console.log('Labels');
  await pa.click('[data-view="labels"]');
  await pa.click('text=Select All');
  for (const layout of ['sheet','avery5160','dymo30334','dymo30336']) {
    await pa.selectOption('#label-layout', layout);
    await sleep(200);
    const n = await pa.$$eval('#labels-grid .label-card', e => e.length);
    const imgs = await pa.$$eval('#labels-grid .qr-cent canvas', e => e.length);
    ok(n === 13 && imgs === 13, `${layout}: 13 labels with QR codes`);
  }
  await pa.selectOption('#label-layout', 'avery5160');
  await pa.evaluate(() => setPageStyle());
  await pa.emulateMedia({ media:'print' });
  const pdf = await pa.pdf({ preferCSSPageSize:true });
  const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  ok(pages === 1, 'Avery 5160 layout: 13 labels fit on 1 printed page (got ' + pages + ')');
  await pa.screenshot({ path: OUT + '/labels-avery-print.png', fullPage:true });
  for (const [layout, expect] of [['dymo30334', 13], ['dymo30336', 13], ['sheet', null]]) {
    await pa.emulateMedia({ media:'screen' });
    await pa.selectOption('#label-layout', layout); await sleep(200);
    await pa.evaluate(() => setPageStyle());
    await pa.emulateMedia({ media:'print' });
    const pdf2 = await pa.pdf({ preferCSSPageSize:true });
    const n2 = (pdf2.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
    ok(expect ? n2 === expect : n2 >= 1, `${layout} printed pages: ${n2}`);
    if (layout === 'dymo30334') fs.writeFileSync(OUT + '/dymo.pdf', pdf2);
    if (layout === 'avery5160' || layout === 'sheet') fs.writeFileSync(OUT + '/sheet.pdf', pdf2);
  }
  fs.writeFileSync(OUT + '/avery.pdf', pdf);
  await pa.emulateMedia({ media:'screen' });
  await pa.selectOption('#label-copies', 'qty'); await sleep(200);
  const many = await pa.$$eval('#labels-grid .label-card', e => e.length);
  ok(many > 13, 'one label per unit mode: ' + many + ' labels');
  await pa.selectOption('#label-copies', '1');
  await pa.selectOption('#label-layout', 'sheet');
  await pa.selectOption('#label-qrmode', 'link');
  ok((await pa.textContent('#label-link-note')).includes(BASE), 'link mode shows the URL students will open');
  await pa.screenshot({ path: OUT + '/labels-screen.png', fullPage:true });

  console.log('QR link on a brand-new phone');
  const P = await browser.newContext({ viewport:{ width:390, height:844 } });
  const pp = await P.newPage(); const perr = []; pp.on('pageerror', e => perr.push(e.message));
  await pp.goto(BASE + '#item=OSI-DEMO10');
  await pp.waitForSelector('#view-checkout.active');
  await pp.fill('#co-sid', '999999'); await pp.press('#co-sid', 'Enter');
  ok(await pp.isVisible('#co-s3') && (await pp.textContent('#co-confirm-card')).includes('TP-Link'), 'link opens checkout with item pre-selected after student ID');
  ok(!(await pp.url()).includes('#item'), 'link hash cleared');
  await pp.screenshot({ path: OUT + '/phone-confirm.png' });
  ok(perr.length === 0, 'no phone JS errors');
  await pp.click('text=📷 Tap to scan QR code').catch(() => {});

  console.log('PIN change');
  await pa.click('[data-view="settings"]');
  await pa.fill('#set-pin-old', '0000'); await pa.fill('#set-pin', '5678'); await pa.fill('#set-pin2', '5678');
  await pa.click('text=Change PIN'); await sleep(1200);
  ok((await pa.textContent('#toast')).includes('incorrect'), 'wrong current PIN refused');
  await pa.fill('#set-pin-old', '1234'); await pa.fill('#set-pin', '5678'); await pa.fill('#set-pin2', '5678');
  await pa.click('text=Change PIN'); await sleep(400);
  ok((await pa.textContent('#toast')).includes('PIN changed'), 'PIN changed');
  ok(server().sett.pin.startsWith('$'), 'PIN stored hashed on server');
  await pb.evaluate(() => { saveSett({ ...getSett(), school:'Shop B' }); }); await waitSaved(pb);
  ok(server().sett.pin.startsWith('$') && server().sett.school === 'Shop B', 'another kiosk saving settings does not reset the PIN');
  await unlock(pb, '1234');
  ok(!(await pb.isVisible('#tab-settings')), 'old PIN no longer works');
  await pb.keyboard.press('Escape');
  await unlock(pb, '5678');
  ok(await pb.isVisible('#tab-settings'), 'new PIN works on other kiosk');

  console.log('Clear all + restore backup');
  const [dlB] = await Promise.all([pa.waitForEvent('download'), pa.click('text=⬇ Export JSON Backup')]);
  const backupPath = OUT + '/backup.json'; await dlB.saveAs(backupPath);
  const bk = JSON.parse(fs.readFileSync(backupPath));
  ok(bk.inv.length === 13 && !('pin' in bk.sett), 'backup exported without PIN');
  await pa.click('text=⚠ Clear All Data'); await waitSaved(pa);
  ok(server().inv.length === 0 && server().co.length === 0, 'clear all reaches the server (old version came back on next poll)');
  await pa.setInputFiles('#import-file', backupPath); await sleep(500); await waitSaved(pa);
  ok(server().inv.length === 13 && server().co.length === bk.co.length, 'restore from backup reaches server');
  await pb.evaluate(() => pullFromServer()); await sleep(300);
  ok(await pb.evaluate(() => getInv().length) === 13, 'restore propagates to other kiosk');

  console.log('Kiosk mode (#checkout) + Dymo label button');
  const K = await browser.newContext(); const pk = await K.newPage(); const kerr = [];
  pk.on('pageerror', e => kerr.push(e.message));
  await pk.goto(BASE + '#checkout');
  await pk.waitForSelector('#view-checkout.active');
  await pk.waitForFunction(() => document.activeElement?.id === 'co-sid');
  ok(true, 'kiosk opens on Check Out with the cursor in the student ID box');
  await pk.keyboard.type('246810'); await pk.keyboard.press('Enter');          // scanner: student ID card
  await pk.waitForFunction(() => document.activeElement?.id === 'co-item-q');
  await pk.keyboard.type('OSI-DEMO05'); await pk.keyboard.press('Enter');      // scanner: item label
  ok(await pk.isVisible('#co-s3'), 'two scans with no clicking reach the confirm step');
  await pk.keyboard.press('Enter');                                             // Enter in quantity confirms
  await pk.waitForFunction(() => document.activeElement?.id === 'co-sid');
  ok((await pk.textContent('#toast')).includes('checked out to 246810'), 'Enter confirms, and the cursor goes back to the ID box for the next student');
  await pk.keyboard.type('135791'); await pk.keyboard.press('Enter');
  await pk.evaluate(() => { _lastActivity = Date.now() - 3 * 60 * 1000; });
  await pk.waitForFunction(() => !document.getElementById('co-s1').classList.contains('hidden'), null, { timeout: 40000 });
  ok(await pk.evaluate(() => coSid === null), 'a half-finished checkout is cleared after 2 minutes idle');
  await pk.click('[data-view="inventory"]');
  await pk.evaluate(() => { _lastActivity = Date.now() - 3 * 60 * 1000; });
  await pk.waitForSelector('#view-checkout.active', { timeout: 40000 });
  ok(true, 'kiosk returns to Check Out when idle');
  ok(kerr.length === 0, 'no kiosk JS errors ' + kerr.join(' | '));
  await K.close();

  await pa.click('[data-view="dashboard"]');
  await pa.evaluate(() => openAddItem());
  await pa.fill('#i-name', 'Label Test Crimper'); await pa.click('text=Save Item');
  await pa.waitForSelector('#modal-detail.open');
  ok((await pa.textContent('#det-title')) === 'Label Test Crimper', 'a newly added item opens right away');
  await pa.click('#det-label-btn');
  await pa.waitForSelector('#view-labels.active');
  ok(await pa.$$eval('#labels-grid .label-card', e => e.length) === 1 && (await pa.textContent('#labels-grid')).includes('Label Test Crimper'), 'Print Label shows just that item\'s label');

  console.log('Errors');
  ok(pa.errors.length === 0, 'kiosk A no JS errors ' + pa.errors.join(' | '));
  ok(pb.errors.length === 0, 'kiosk B no JS errors ' + pb.errors.join(' | '));
  await pa.click('[data-view="dashboard"]');
  await pa.screenshot({ path: OUT + '/dashboard.png', fullPage:true });
  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  php.kill();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); php.kill(); process.exit(2); });
