# YOLA Home Fragrances: website & inventory

A display-first website for YOLA (organic home fragrances and scent solutions, Mikocheni B, Dar es Salaam) and a simple inventory tool for the team. Plain HTML, CSS and JavaScript , no build step, so it runs on GitHub Pages as is.

- **Website:** `index.html`: collection, scent machines with a "how big is your space?" finder, experiences, showroom details and contact.
- **Inventory:** `inventory/`: stock, sales, customers, suppliers, deliveries, reports and backups. Linked quietly from the website footer ("Staff: inventory").

## How ordering works on the website

There's no online payment. Customers add items to a bag and press **Send order on WhatsApp**, which opens a chat with **0653 060 820** containing the order, sizes, scents, total, name and delivery area. Every "Ask", "Enquire", "Book" button and the contact form also open WhatsApp with a pre-written message. The team confirms stock, delivery and payment in the chat.

## Editing products and prices

Everything the website shows (products, sizes, prices, scents, scent machines, phone, address) lives in one file: `assets/js/catalog.js`. Prices come from the *YOLA Scent Marketing Solutions* price list (TZS). A `price: null` shows "Price on request" with an **Ask for price** button.

Please confirm these, which weren't in the price list:
- Reed diffuser **200ml** price (shown as "price on request")
- **Candle lover gift box** and **waterless mini machine** prices
- The seven mini machine finish names (read from a photo)
- The scent library list (taken from labels in the photos: Rose Oud, Freesia & Pears, Peppermint & Eucalyptus, Neroli, Juicy, Relaxing)
- The mood, description and "lovely in" rooms for each scent in the scent wardrobe (`scentProfiles` in `catalog.js`), written from the scent names

## Using the inventory tool

1. Type your name in **Staff on duty** (top right) so records show who did what.
2. **Receive stock**: add what's on the shelves (or a new delivery). The YOLA product list is already loaded with zero stock.
3. **New sale**: tap products, check quantities, choose the customer and payment method (Cash, M-Pesa, Mixx by Yas, Airtel Money, HaloPesa, bank, card), and save. Part-payments are tracked as "owed" until settled. Receipts can be printed or sent on WhatsApp.
4. **Stock**: tap **Count** to correct a count, take items out (damaged, testers, events) or put them back, always with a reason. **History** shows every change.
5. The search bar at the top finds products, customers, suppliers and sale numbers from any page (press `/` to jump to it).
6. **Reports**: sales, money received, amounts owed, profit (when cost prices are entered), best sellers, payment methods and sales channels.

**Demo data:** the first time the inventory opens on a device, it loads four months of made-up sales, customers, suppliers and deliveries (all fictional) so it can be demonstrated and practised on. A banner on the home page says so. *Backup & settings → Start fresh* clears it and starts with the empty YOLA product list; *Load demo data* brings it back. Before handing the tool over for real use, set `DEMO_ON_FIRST_VISIT = false` near the bottom of `inventory/app.js`.

### Important: where the data lives

The inventory saves to the browser on the device being used (localStorage). It is not shared between devices and is lost if the browser's site data is cleared. So:

- Use one main device (e.g. the showroom computer) for recording.
- Download a backup weekly from **Backup & settings**, and keep it somewhere safe (Google Drive, email).
- To move to another device, restore that backup file there.
- Spreadsheet (CSV) exports are available for stock, sales, sale lines, customers, suppliers and stock movements.

Because the site is public on GitHub Pages, anyone with the link can open the inventory page, but data never leaves their own device, so nobody sees YOLA's records.

## Images

Product photos were taken from the YOLA Instagram and price list. Instagram interface elements (carousel arrows and dots, profile badges, the reel icon and screenshot borders) were cropped or inpainted out. They're in `assets/img/`. Higher-resolution originals from the team will make the site look even sharper , just replace the files with the same names.

## Fonts

Bodoni Moda (headlines) and Jost (text), self-hosted in `assets/fonts/` under the SIL Open Font License.

## Running locally

Open `index.html` in a browser, or serve the folder: `python3 -m http.server` and visit http://localhost:8000.
