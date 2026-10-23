# Deploying from a Flash Drive: One Checkout Computer + Dymo LabelWriter 450

For the person installing. About 30 minutes. You need Windows administrator rights on the checkout computer.
Do the steps in order and tick each box.

This sets up a **fresh, empty** inventory on **one** computer. Nothing else on the network will be able to reach it.

---

## A. Prepare the flash drive (on any computer with internet)

- [ ] **XAMPP installer**: download "XAMPP for Windows" from **apachefriends.org**.
- [ ] **DYMO Connect for Desktop installer**: download from **dymo.com** (Support → Software & Drivers).
      This installs the LabelWriter 450 driver. Skip it if DYMO software already prints labels on the checkout computer.
- [ ] **The app**: on GitHub, open the repository → green **Code** button → **Download ZIP**. Don't unzip it yet.
- [ ] Print `docs/student-instructions.pdf` (it's inside the ZIP) to post next to the computer.

## B. Install XAMPP (on the checkout computer)

- [ ] Run the XAMPP installer. Keep the folder **`C:\xampp`**.
      On the components screen, untick everything except **Apache** and **PHP**.
      If a "User Account Control" warning appears, click **OK**.
- [ ] At the end, open the **XAMPP Control Panel** and click **Start** next to **Apache**. It turns green.
  - Red error about **port 80**? Another program is using it. Open Windows **Services**, stop
    "World Wide Web Publishing Service" and set it to Disabled, then click Start again.
- [ ] **Windows Firewall pops up about Apache: click Cancel.** Nothing outside this computer needs to reach it.

## C. Copy the app

- [ ] Unzip the ZIP from the flash drive. Inside is a folder named like `Open-School-Inventory-main`.
- [ ] Copy that folder into **`C:\xampp\htdocs\`** and rename it to **`inventory`**.
      You should now have `C:\xampp\htdocs\inventory\open-school-inventory.html` and `C:\xampp\htdocs\inventory\api.php`.

## D. Lock it to this computer

- [ ] Open `C:\xampp\htdocs\inventory\api.php` in **Notepad**. Find the line
      `$LOCAL_ONLY  = false;` and change `false` to `true`. Save.
- [ ] XAMPP Control Panel → Apache row → **Config** → **Apache (httpd.conf)**. Press Ctrl+F and search for `Listen 80`.
      Change that line to `Listen 127.0.0.1:80`. Save.
- [ ] Same **Config** button → **Apache (httpd-ssl.conf)**. Search for `Listen 443` and change it to `Listen 127.0.0.1:443`. Save.
- [ ] Click **Stop**, then **Start** on Apache. It must turn green again.
- [ ] **Start automatically:** click **Stop** on Apache and close the Control Panel. Right-click it →
      **Run as administrator** → tick the **Svc** box to the left of Apache → **Yes** → click **Start**.
      Apache now starts with Windows; nobody has to click Start.

## E. Open it and set the browser

- [ ] In Edge or Chrome, go to exactly:
      **`http://localhost/inventory/open-school-inventory.html#checkout`**
- [ ] The top-right should say **synced** and the screen shows **Check Out Item**.
      (The `#checkout` ending makes the computer open on Check Out and return there when idle.)
- [ ] Make that address the browser's start page:
      Edge → Settings → *Start, home, and new tabs* → *When Edge starts* → *Open these pages* → add the address.
      Chrome → Settings → *On startup* → *Open a specific page*.
- [ ] Check the lock: on any *other* computer or phone, try `http://THIS-PC-IP/inventory/api.php`. It must **not** load.
      (Find the IP with `ipconfig` in Command Prompt.)

## F. Set up the Dymo LabelWriter 450

- [ ] Install **DYMO Connect** from the flash drive (if needed), with the printer plugged in. Load a roll of
      **30334** labels (2¼" × 1¼"). That size suits tools and bins; 30336 (1" × 2⅛") is for small parts.
- [ ] In the inventory, click **🔒 Admin** → PIN **1234**.
- [ ] **Labels** tab → **Label Layout: Dymo 30334** → **QR Code Contains: Item ID only**.
- [ ] Make a test item: **Dashboard → + Add Item** → name it `TEST ITEM` → **Save Item** → **🏷 Print Label** → **🖨 Print**.
- [ ] In the print window:
  - **Printer:** DYMO LabelWriter 450
  - **More settings → Paper size:** the 30334 size (listed by its number or as 2¼" × 1¼")
  - **Margins:** None · **Scale:** Default (100) · **Headers and footers:** off
- [ ] Check the label: QR code on the left, name on the right, all on one label.
  - **Sideways or split across two labels?** Print again with the other **Layout** (Portrait/Landscape) if
    it's offered, or pick the other 30334 entry in Paper size. Write down the settings that worked and tape them to the printer.
  - **Still won't fit?** Use DYMO Connect instead: in the inventory, **Settings → Export Inventory CSV**. In DYMO Connect,
    design a 30334 label with a QR code bound to the `id` column and text bound to `name`, then use its *Import data* feature.

## G. Test the whole thing (2 minutes)

- [ ] Click **🔓 Lock Admin**. Plug in the USB barcode scanner.
- [ ] Scan a student ID card (or type `123456` and press Enter) → scan the TEST ITEM label → press **Enter**.
      A green message "TEST ITEM ×1 checked out to …" appears.
- [ ] **🔒 Admin** → **Returns** → **✓ Return** on that line → **Confirm Return**.
- [ ] **Inventory** → TEST ITEM → **Delete**. Then **🔓 Lock Admin**.

If the scanner does nothing on the QR label, it only reads old-style barcodes; a "2D" scanner is needed.

## H. Hand over to the teacher

- [ ] Tell the teacher it's ready. They should, on day one:
  1. **Admin → Settings → Admin PIN**: change it from `1234`. Current PIN is `1234`.
  2. **Settings → Lab Info** and **Categories**: set the shop name and categories.
  3. Start adding items: **+ Add Item → 🏷 Print Label** for each one, or use the spreadsheet import
     (see `docs/SHOP-INVENTORY-PLAN.md`).
- [ ] Post the student instruction sheet next to the computer.
- [ ] Leave the flash drive with the teacher: it holds the installers if the PC ever needs rebuilding.

**Backups:** the data lives in `C:\xampp\htdocs\inventory\osi-data\`, with a daily copy in `osi-data\backups\`.
Copy that folder to the flash drive (or another computer) once a month.
