# Open School Inventory

A free, open source inventory and checkout system for school labs, makerspaces, and technical shops.
It runs as one HTML page. Add the small PHP file and every computer and phone in the room shares the same data.

Built by a CIT teacher who couldn't find anything that actually fit a classroom workflow.

## Features

- **QR labels**: print on Avery 5160/8160 sheets or Dymo 30334/30336 rolls, one per bin or one per unit
- **Scan with anything**: USB barcode scanners, the in-app camera, or a phone's normal camera app (link labels open checkout with the item already selected)
- **Student checkout**: 3 steps (ID → item → confirm), designed for phones
- **Returnable vs consumable items**: tools come back, screws and zip ties are logged as used
- **Multi-device sync**: record-by-record merging, so simultaneous checkouts and offline devices don't lose data
- **CSV import / export**: build the whole inventory in a spreadsheet, re-import to update counts
- **End-of-day email**: unreturned items, damage reports, consumables used, low stock
- **Damage tracking** on returns
- **PIN-protected admin**, checked on the server and auto-locked after 10 minutes idle
- **Custom categories** for any kind of shop
- **Works offline**: QR libraries are bundled in `vendor/`; devices keep working when the server is down and sync later
- **Daily server backups**: last 30 days

## Quick start

### Option A: one computer, no server
Open `open-school-inventory.html` in a browser (keep the `vendor/` folder next to it). Data stays in that browser,
so use **Settings → Export JSON Backup** regularly.

### Option B: shared across the shop (recommended)
Put `open-school-inventory.html`, `api.php` and `vendor/` in a folder on a PHP web server (XAMPP, Apache, IIS) and
browse to it from any device on the network.

**→ Full instructions, including upgrading from the earlier version: [SETUP.md](SETUP.md)**

## Getting a shop inventoried

**→ [docs/SHOP-INVENTORY-PLAN.md](docs/SHOP-INVENTORY-PLAN.md)** covers QR vs barcode, which items get labels,
supplies, a step-by-step count-and-label day, and keeping counts accurate.

## CSV import format

Start from `templates/inventory-template.csv` or **Settings → Blank Template**. Only `name` is required.

| Column | Values |
|--------|--------|
| id | leave blank for new items (assigned automatically); keep it to update an existing item |
| name | text |
| cat | any category; new ones are added automatically |
| qty | whole number on hand |
| thresh | low-stock warning level |
| loc | location / bin, e.g. `CAB-A / S2` |
| cond | Good, Fair, For Parts |
| kind | Returnable or Consumable |
| serial | serial number or district asset tag (scanning it finds the item) |
| notes | text |

Common header names also work (Category, Quantity, Location, Condition, Type, Asset Tag…).

## Student email (optional)

Students receive checkout confirmations and return receipts at `{studentid}@{yourdomain}`, sent through
[EmailJS](https://emailjs.com) (free tier). Set it up in **Settings → Email Setup**. The template needs
`{{to_email}}`, `{{subject}}` and `{{message}}`.

## Project docs

- [DEPLOY.md](DEPLOY.md): flash-drive checklist for one checkout computer with a Dymo LabelWriter 450
- [SETUP.md](SETUP.md): install, upgrade, security check, HTTPS options, troubleshooting
- [docs/student-instructions.pdf](docs/student-instructions.pdf): printable how-to-check-out sign for students
- [docs/SHOP-INVENTORY-PLAN.md](docs/SHOP-INVENTORY-PLAN.md): labeling and inventory process
- [docs/CODE-REVIEW.md](docs/CODE-REVIEW.md): code review findings, what was fixed, roadmap
- `tests/`: end-to-end tests (`cd tests && npm install && npx playwright install chromium && npm test`, needs PHP)

## License

MIT — use it, modify it, deploy it, keep it or open source your changes. No attribution required.
Bundled libraries: [qrcodejs](https://github.com/davidshimjs/qrcodejs) (MIT) and
[html5-qrcode](https://github.com/mebjas/html5-qrcode) (Apache 2.0); licenses are in `vendor/`.

## Origin

Built for a vocational technical classroom in Pennsylvania. Tested with USB barcode scanners, a Dymo LabelWriter 450,
and students with 6-digit IDs checking out hardware components.

If it works for you in a different context, fork it, adapt it, and share what you changed.
