# Open School Inventory

A free, open source inventory management system for school labs, makerspaces, and technical classrooms. No server required to get started — runs as a single HTML file with optional PHP backend for multi-machine sync.

Built by a CIT teacher who couldn't find anything that actually fit a classroom workflow.

## Features

- **Barcode scanner ready** — USB scanners work out of the box on the checkout screen
- **QR code labels** — generate and print label sheets directly from the browser
- **Student checkout system** — 3-step wizard optimized for student phones
- **Email notifications** — automatic checkout confirmations and return receipts via EmailJS
- **Multi-machine sync** — optional PHP backend keeps kiosk, desk, and student devices in sync
- **Daily backups** — automatic server-side snapshots when using the PHP backend
- **CSV import** — bulk load inventory from a spreadsheet
- **End of day reports** — one-click EOD email with all unreturned items
- **Damage tracking** — flag and document damaged returns
- **PIN-protected admin** — public checkout, admin-only returns and settings
- **No dependencies** — single HTML file, runs anywhere

## Quick Start

### Option A — No Server (localStorage only)

1. Download `open-school-inventory.html`
2. Open it in any browser
3. Done — data lives in the browser

Good for: single machine, single browser, low stakes.

### Option B — Multi-Machine Sync (recommended)

1. Download both `open-school-inventory.html` and `api.php`
2. Drop both files in the same folder on a web server (Apache/IIS/XAMPP)
3. Browse to the HTML file — sync indicator appears top-right
4. Any machine on the network can now see live data

See [SETUP.md](SETUP.md) for XAMPP on Windows instructions (10 minutes).

## Student Email Setup

Students receive checkout confirmations and return receipts at `{studentid}@{yourdomain}`.

Uses [EmailJS](https://emailjs.com) (free tier). Configure in Settings → Email Setup.

Template variables required: `{{to_email}}`, `{{subject}}`, `{{message}}`

## CSV Import Format

| Column | Values |
|--------|--------|
| name | text |
| cat | RAM, GPU, CPU, Cable, Motherboard, Storage, PSU, Cooling, Network, Hardware, Tools, Other |
| qty | number |
| thresh | number (low stock warning) |
| loc | text |
| cond | Good, Fair, For Parts |
| notes | text (optional) |

## License

MIT — use it, modify it, deploy it, keep it or open source your changes. No attribution required.

## Origin

Built for a vocational technical classroom in Pennsylvania. Tested with USB barcode scanners, a Dymo LabelWriter 450, and students with 6-digit IDs checking out hardware components.

If it works for you in a different context — fork it, adapt it, share what you changed.
