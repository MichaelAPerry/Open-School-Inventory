# Shop Inventory Plan — Labels, Scanning, and Getting Everything Into the System

## 1. The decision: QR codes (not 1D barcodes, not RFID)

**Use QR codes.** Encode the item ID, and if you have a stable server address, encode it as a link
(Labels → *QR Code Contains → Link*).

| | **QR code** ✅ | 1D barcode (Code 128) | RFID / NFC tags |
|---|---|---|---|
| Student phones can scan | Yes, with the built-in camera app | Poorly; most camera apps ignore them | Android only; iPhones need an app |
| Size for an ID like `OSI-7KQ2M` | ~0.75" square | ~1.5–2" wide strip | Small sticker |
| Damage tolerance (grease, scratches) | High: the app's ID labels survive ~25% damage, link labels ~15% | Low: one scratch across the bars can kill it | High |
| Scan angle | Any | Must line up with the bars | Any (proximity) |
| Hardware | Phone, or a ~$30–80 **2D** USB scanner | Any USB scanner | Readers, tags at ~$0.20–1 each |
| Printable on a Dymo / laser printer | Yes | Yes | No |
| Works in this app today | Yes | Yes (any text a scanner types works) | No |

Why not 1D: it only wins if you already own a 1D-only laser scanner, and that is the one thing to check.
**Hold your current USB scanner up to a QR code on screen. If it doesn't beep, it's 1D-only and
can't read QR.** A 2D "imager" scanner reads both QR codes and the 1D barcodes on student IDs and district
asset tags, so it replaces the old one completely.

Why not RFID: tags, readers and iPhone limits cost more than they save in one shop.

### ID-only vs Link labels

| | **ID only** (`OSI-7KQ2M`) | **Link** (`http://cit-inventory/#item=OSI-7KQ2M`) |
|---|---|---|
| USB scanner at the kiosk | ✅ | ✅ (the app pulls the ID out of the link) |
| In-app camera scanner | ✅ but only on HTTPS | ✅ but only on HTTPS |
| Phone's normal camera app | Shows text only | ✅ **Opens checkout with the item already selected** |
| If the server address changes | Unaffected | Phone-camera links break (scanners still work); reprint or have IT keep the old name |
| QR density | Smaller, easier to scan | Denser; keep labels ≥ 0.75" |

**No student phones (one checkout computer)?** Print **ID only** and use a 2D USB scanner at that computer. That's the simplest, most reliable setup.

**If students will use phones:** get a DNS name from IT (e.g. `cit-inventory`), rename the page to `index.html`, and print **Link** labels.
That works with every device and needs no HTTPS. If you can't get a stable address, print **ID only** and use a USB scanner at the kiosk.

## 2. What gets a label — three tiers

| Tier | Examples | How to enter it | Label on |
|---|---|---|---|
| **A. Individually tracked** (≳ $50, or anything you'd chase down) | Multimeters, crimpers, laptops, Pi kits, cordless drills | **One item per unit**, qty 1: "Fluke 117 Multimeter #1", "#2" … The CSV template makes this fast. Put the district asset tag in *Serial / Asset Tag*. | The unit itself |
| **B. Pooled returnables** | Screwdrivers, patch cables, breadboards, safety glasses | One item, qty = count, type *Returnable* | The bin/drawer, and optionally each unit with the same code (Labels → *Copies → one per unit*) |
| **C. Consumables** | Screws, zip ties, wire nuts, solder, heat shrink | One item, type **Consumable**, qty = rough count, threshold = reorder point | The bin/drawer only |

Fixed equipment that never leaves the room (drill press, 3D printer, server rack) can still be entered as a Tier A item
for an asset list. Label it, but there's no need to check it out.

**Locations:** pick one naming pattern and label the shelves too, e.g. `CAB-A / S2` (cabinet A, shelf 2),
`WALL-1`, `DRAWER-7`, `BENCH-3`. It goes in the *Location* column and prints on every label.

## 3. Supplies checklist

- [ ] **2D USB barcode scanner** (USB "keyboard wedge", reads QR + 1D). One for the checkout kiosk, optionally one for the teacher desk.
- [ ] **Label stock**, either:
  - Dymo LabelWriter 450 → **30334** (2¼" × 1¼") for tools and bins, or **30336** (2⅛" × 1") for small parts.
    For greasy or handled tools, Dymo's **durable (polyester)** LabelWriter labels last far longer than paper.
    *Note: the newer LabelWriter 550/5XL models only accept Dymo-brand labels; the 450 accepts any compatible roll.*
  - Laser printer → **Avery 5160 / 8160** (30 per sheet, 1" × 2⅝"). Weatherproof versions exist for shop use.
- [ ] **Clear packing tape or laminating tape** to cover labels on hand tools.
- [ ] **Isopropyl wipes** to clean surfaces before labeling.
- [ ] A cheap tablet, Chromebook or old PC as a **checkout kiosk**, plus a printed "How to check out" sign.

## 4. Inventory day(s) — step by step

### Before (≈ 1 hour)
1. Set up the server (`SETUP.md`), change the admin PIN, confirm `osi-data/osi-data.json` returns 403.
2. **Settings → Categories**: set categories that fit the shop, e.g. Hand Tools, Power Tools, Test Equipment,
   Networking, Computer Parts, Cables, Electronics, Fasteners, Supplies, Safety, Consumables, Other.
3. Draw a quick map of the room and split it into **zones** (one cabinet or wall each). Print location labels.
4. Download the template (**Settings → Inventory Spreadsheet → Blank Template**, or `templates/inventory-template.csv`).
   Put it in a shared Google Sheet with one tab per zone.

### Count (student teams work well: one counts, one types)
5. Work zone by zone, top shelf to bottom, left to right. One spreadsheet row per item (Tier B/C) or per unit (Tier A).
6. Columns: `name, cat, qty, thresh, loc, cond, kind, serial, notes`. Leave `id` **blank**; the app assigns IDs.
   - Name things the way students ask for them ("Wire Stripper 10–22 AWG", not "Klein 11055").
     Put model and spec details in `notes`.
   - `cond`: Good / Fair / For Parts. `kind`: Returnable / Consumable.
   - `thresh`: when to warn (consumables: your reorder point; tools: 0 or 1).
7. Put anything broken or unknown in a "triage" box. Decide later; don't slow the count.
8. Two-person count for anything expensive (Tier A).

### Import and label
9. In Google Sheets, **File → Download → CSV** exports only the tab you're on. Either paste every zone into one tab first, or download and import each tab in turn. Then **Settings → Import Inventory CSV**, and fix any rows it reports.
10. **Labels tab** → pick the layout → filter by location (type the zone in the filter box) → **Select All** → **Print**.
    Print **one test sheet on plain paper first** and hold it over the label sheet to check alignment.
    For Dymo, choose the matching paper size (30334 or 30336) in the print dialog and set margins to none.
11. Apply labels zone by zone, using the location shown on each label to put it in the right place.
    Flat, clean surfaces. Avoid wrapping a label around anything thinner than about 1" (the QR distorts).
    Cover with clear tape on hand tools.
12. **Verify:** in the Inventory tab, click the search box and scan labels at random (about 1 in 10, plus every Tier A).
    A correct scan opens the item. Fix anything wrong right away.

### Go live
13. Put the kiosk by the door with the scanner, and post the 3 steps: *scan/type your ID → scan the item → confirm*.
14. Run the **EOD Email** for the first week to catch anything not returned.

## 5. Keeping it accurate

| When | What |
|---|---|
| Daily | EOD email: unreturned items, damage, consumables used, low stock |
| Monthly | **Cycle count** one or two zones: Settings → Export Inventory CSV, count, fix `qty` in the sheet, re-import (rows keep their `id`, so they update instead of duplicating) |
| New items arrive | Add Item (or a CSV with blank `id`), then print just those labels |
| End of year | Full count of Tier A, export the History CSV, Export JSON Backup to a USB drive / district storage |

## 6. Privacy note

Checkout history ties student ID numbers to dates and items, so treat it as a student record. Keep the server
on the district network only, keep `osi-data/` blocked, and don't email exports outside the district.
