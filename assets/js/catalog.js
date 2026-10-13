/* YOLA catalogue — single source of truth for the website and the inventory seed.
   Prices are in Tanzanian shillings (TZS), taken from the YOLA Scent Marketing Solutions price list.
   price: null means "ask for price" on the website. */
window.YOLA = {
  phoneDisplay: "0653 060 820",
  phoneIntl: "+255653060820",
  whatsapp: "255653060820",
  address: "22 Huruma Street, Mikocheni B, Dar es Salaam",
  mapUrl: "https://maps.app.goo.gl/VaTDxh6cpkQRLg3R7",
  instagram: "https://www.instagram.com/yola_homefragrances/",

  scents: ["Rose Oud", "Freesia & Pears", "Peppermint & Eucalyptus", "Neroli", "Juicy", "Relaxing"],

  /* Home fragrance collection */
  products: [
    {
      id: "reed", name: "Organic reed diffuser", category: "Reed diffusers",
      img: "assets/img/reed-freesia-pears.jpg", alt: "YOLA Freesia & Pears reed diffuser on a marble table",
      tag: "Freesia & Pears",
      blurb: "Slow, steady fragrance for living rooms, bedrooms and offices. Also available in gift sets.",
      scented: true,
      sizes: [
        { label: "100ml", price: 65000, sku: "RD-100" },
        { label: "200ml", price: null, sku: "RD-200" },
        { label: "500ml", price: 230000, sku: "RD-500" }
      ]
    },
    {
      id: "spray", name: "Luxury room & linen spray", category: "Room & linen sprays",
      img: "assets/img/room-spray-energizing.jpg", alt: "YOLA Energizing room and linen spray with gold cap",
      tag: "Peppermint & Eucalyptus",
      blurb: "For curtains, bedding, upholstery and carpets, or a quick lift for any room. Also in gift sets.",
      scented: true,
      sizes: [
        { label: "100ml", price: 50000, sku: "RS-100" },
        { label: "300ml", price: 130000, sku: "RS-300" }
      ]
    },
    {
      id: "candle", name: "Soy scented candle", category: "Candles",
      img: "assets/img/candle-relaxing.jpg", alt: "Lighting a YOLA Relaxing soy candle beside a glass cloche",
      tag: "Relaxing",
      blurb: "Hand-poured soy wax, made for gifting. Add a candle cloche or lighter, priced separately.",
      scented: true,
      sizes: [
        { label: "220g", price: 60000, sku: "SC-220" },
        { label: "380g", price: 80000, sku: "SC-380" }
      ]
    },
    {
      id: "oil", name: "Fragrance oil", category: "Fragrance oils",
      img: "assets/img/oils-set.jpg", alt: "A group of YOLA fragrance oil dropper bottles",
      tag: "Refill oils",
      blurb: "Refills for every YOLA scent machine. Also lovely in baths, laundry, mopping water and the steam iron.",
      scented: true,
      sizes: [
        { label: "30ml", price: 35000, sku: "FO-30" },
        { label: "150ml", price: 150000, sku: "FO-150" },
        { label: "500ml", price: 450000, sku: "FO-500" }
      ]
    },
    {
      id: "giftbox", name: "Candle lover gift box", category: "Gift sets",
      img: "assets/img/candle-gift-box.jpg", alt: "Three YOLA soy candles — Neroli, Juicy and Relaxing — in an iridescent gift box",
      tag: "Neroli, Juicy, Relaxing",
      blurb: "Three soy candles wrapped in our iridescent box. Tell us who it's for and we'll help you pick.",
      scented: false,
      sizes: [{ label: "Box of 3", price: null, sku: "GB-CANDLE3" }]
    },
    {
      id: "mini", name: "Waterless mini machine", category: "Mini machines",
      img: "assets/img/car-mini-pink.jpg", alt: "A rose-pink YOLA mini scent machine misting inside a car",
      tag: "7 colours",
      blurb: "Our best seller. Made for cars, small enclosed spaces and travel. Choose from seven finishes.",
      scented: false,
      colours: ["Red", "Rose pink", "Silver", "Graphite", "Matte black", "Gloss black", "Gold"],
      sizes: [{ label: "One size", price: null, sku: "MM-1" }]
    }
  ],

  /* Scent machines for spaces. Coverage is room volume in cubic metres. */
  machines: [
    { id: "stick", name: "Surround Scent Stick", img: "assets/img/m-stick.jpg", min: 100, max: 500, oil: "150ml",
      install: "Tabletop", power: "Rechargeable battery", colours: "Matte black, silver, rose gold", price: 600000, sku: "SM-STICK" },
    { id: "box", name: "Surround Scent Box", img: "assets/img/m-box-black.jpg", min: 300, max: 1000, oil: "150ml",
      install: "Tabletop or wall mounted", power: "Mains", colours: "Black or white", price: 350000, sku: "SM-BOX" },
    { id: "pod", name: "Surround Scent Pod", img: "assets/img/m-pod.jpg", min: 500, max: 1500, oil: "150ml",
      install: "Tabletop or wall mounted", power: "Mains", colours: "White", price: 450000, sku: "SM-POD" },
    { id: "podb", name: "Surround Scent Pod+", img: "assets/img/m-pod-battery.jpg", min: 500, max: 1500, oil: "150ml",
      install: "Tabletop or wall mounted", power: "Mains and battery", colours: "White", price: 500000, sku: "SM-PODB" },
    { id: "tower", name: "Surround Scent Tower", img: "assets/img/m-tower.jpg", min: 1500, max: 3000, oil: "800ml",
      install: "Floor standing", power: "Mains", colours: "White", price: 1200000, sku: "SM-TOWER" },
    { id: "pro", name: "Surround Scent Box Pro", img: "assets/img/m-boxpro-black.jpg", min: 1500, max: 3500, oil: "800ml",
      install: "HVAC or tabletop", power: "Mains", colours: "Black or white", price: 1500000, sku: "SM-PRO" },
    { id: "promax", name: "Surround Scent Box Pro Max", img: "assets/img/m-promax.jpg", min: 3000, max: 6000, oil: "1000ml",
      install: "HVAC", power: "Mains", colours: "Black", price: 2000000, sku: "SM-PROMAX" }
  ]
};

window.tzs = function (n) {
  return "TZS " + Number(n || 0).toLocaleString("en-US");
};
