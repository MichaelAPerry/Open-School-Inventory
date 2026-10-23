# Setup — XAMPP on Windows

About 10–15 minutes. You need a Windows PC that stays on during school hours (the "server") and
can be reached by the other computers and phones in the shop.

## 1. Install XAMPP

1. Download XAMPP for Windows from apachefriends.org (any version with PHP 7.4 or newer).
2. Install to the default `C:\xampp`. You only need **Apache** and **PHP**. MySQL isn't used.
3. Open the **XAMPP Control Panel** and click **Start** next to Apache.
4. When Windows Firewall asks, allow Apache on **Private networks**.
5. Optional: click **Config → Service** (or tick the "Svc" box) so Apache starts automatically with Windows.

## 2. Copy the app

Create `C:\xampp\htdocs\inventory\` and copy these into it:

```
inventory\
  open-school-inventory.html
  api.php
  vendor\            (qrcode.min.js, html5-qrcode.min.js — needed for offline QR)
```

Tip: rename `open-school-inventory.html` to `index.html`. The address becomes
`http://SERVER/inventory/`, which is shorter and gives smaller QR codes if you use link labels.

## 3. Open it

- On the server: `http://localhost/inventory/open-school-inventory.html`
- From other devices: `http://SERVER-IP/inventory/open-school-inventory.html`
  (find the IP with `ipconfig` in a Command Prompt, under "IPv4 Address").

The pill in the top-right should read **synced**. The first save creates the protected `osi-data\`
folder next to `api.php`.

**Ask district IT for two things:**
1. A **fixed IP or DNS name** for the server (e.g. `http://cit-inventory/`), so bookmarks and QR link labels
   never break.
2. Confirm the server is **not reachable from the internet**. Checkout history is tied to student IDs,
   so treat it as a student record.

## 4. Secure it (do this before students use it)

1. Unlock **Admin** with the default PIN `1234` → **Settings → Admin PIN** and change it.
2. Check that the data can't be downloaded. In a browser, open
   `http://SERVER-IP/inventory/osi-data/osi-data.json`. You must get **403 Forbidden**.
   If you see data instead, `.htaccess` files are being ignored; set `$DATA_DIR` in `api.php` to a folder
   outside `htdocs`, e.g. `$DATA_DIR = 'C:/xampp/osi-data';`
3. Optional: change `$DATA_DIR` to a folder that is backed up (OneDrive and network shares are fine, as long as
   only one server uses it).

**IIS instead of Apache?** IIS ignores `.htaccess`. Add this `web.config` next to `api.php`, or put
`$DATA_DIR` outside the web root:

```xml
<configuration>
  <system.webServer>
    <security><requestFiltering><hiddenSegments>
      <add segment="osi-data" />
    </hiddenSegments></requestFiltering></security>
  </system.webServer>
</configuration>
```

## 5. Upgrading from the earlier version (cit-data.json)

Your inventory, checkouts and PIN carry over automatically.

1. **Back up first.** On the old version, go to **Settings → Export JSON Backup**. Also copy the whole
   `htdocs\inventory` folder (including `cit-data.json` and `cit-backups\`) somewhere safe.
2. Replace `open-school-inventory.html` and `api.php`, and add the `vendor\` folder.
3. Open the page once. `api.php` copies `cit-data.json` into the protected `osi-data\` folder and moves the
   original to `osi-data\cit-data-premigration.json`, so it can no longer be downloaded.
4. **Refresh every device** (Ctrl+F5 on computers; close and reopen the tab on phones) so nothing keeps
   running the old page.
5. Check that `http://SERVER-IP/inventory/cit-data.json` now returns **404 Not Found**.

## 6. Camera scanning and HTTPS

Browsers only allow the in-app camera scanner on `https://` or `localhost`. On a plain
`http://` school network you have three options, and you can mix them:

| Option | How | Needs |
|---|---|---|
| **Link labels** (recommended) | Labels → *QR Code Contains → Link*. Students scan with their phone's normal camera app; the checkout page opens with the item already selected. | A stable server address |
| **USB scanner at a kiosk** | A 2D barcode scanner on the shop computer. It types the code and presses Enter. | ~$30–80 scanner that reads QR codes |
| **HTTPS** | District IT installs a certificate for the server name. | IT help |

USB scanners also read link labels, because the app pulls the item ID out of the URL. So link labels work
with every option.

## 7. Backups

- With the server, `api.php` keeps a copy of the data from the start of each school day in `osi-data\backups\` (last 30 days).
- Once a month, also use **Settings → Export JSON Backup** and keep the file off the server.
- To restore, use **Settings → Import JSON Backup**. It replaces the data on every device.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Pill says **local only** | The page can't find `api.php`. Make sure both files are in the same folder and you opened the page through `http://`, not by double-clicking the file. |
| Pill says **offline** | Apache stopped or the server is unreachable. Changes are kept on the device and sync automatically when it's back. |
| "Write failed — check permissions" | Make sure the Windows account running Apache can write to the folder that holds `api.php` (or `$DATA_DIR`). |
| PIN lost | Stop Apache. Open `osi-data\osi-data.json` in Notepad and find `"pin":`. Replace the long value between the quotes with `1234`, so it reads `"pin": "1234",`. Leave the quotes and comma exactly as they were, then save and start Apache. Log in with `1234` and change it. |
| "Data file is damaged" | The JSON file was corrupted, usually by a hand edit. Copy the newest file from `osi-data\backups\` over `osi-data\osi-data.json`. Each device's own unsynced changes will sync back automatically. |
