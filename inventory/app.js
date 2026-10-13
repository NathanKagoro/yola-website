/* YOLA Inventory — a small, offline-first stock, sales, customer and supplier tracker.
   Everything is stored in this browser (localStorage). Use Backup & settings to download copies. */
(function () {
  "use strict";

  /* ================= helpers ================= */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var uid = function (p) { return (p || "") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  var money = function (n) { return "TZS " + Math.round(Number(n) || 0).toLocaleString("en-US"); };
  var num = function (v) { var n = parseFloat(String(v).replace(/,/g, "")); return isNaN(n) ? 0 : n; };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var fmtDate = function (iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  };
  var fmtTime = function (iso) { return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); };
  var lower = function (s) { return String(s || "").toLowerCase(); };
  var plural = function (n, one, many) { return n + " " + (n === 1 ? one : (many || one + "s")); };

  var PAYMENTS = ["Cash", "M-Pesa", "Mixx by Yas", "Airtel Money", "HaloPesa", "Bank transfer", "Card", "Other"];
  var CHANNELS = ["Showroom", "WhatsApp", "Instagram", "Phone call", "Website", "Event", "Corporate order"];
  var REASONS = ["Stock count correction", "Damaged or broken", "Used at an event", "Tester or sample", "Given as a gift", "Returned by customer", "Other"];
  var CATEGORIES = ["Reed diffusers", "Room & linen sprays", "Candles", "Fragrance oils", "Gift sets", "Mini machines", "Scent machines", "Accessories", "Packaging", "Raw materials"];

  /* ================= data ================= */
  var KEY = "yola-inventory-v1";
  var db;

  function seedProducts() {
    var Y = window.YOLA, list = [];
    Y.products.forEach(function (p) {
      p.sizes.forEach(function (s) {
        list.push({ id: uid("p"), sku: s.sku, name: p.name, category: p.category, size: p.sizes.length > 1 || s.label !== "One size" ? s.label : "",
          scent: "", price: s.price || 0, cost: 0, stock: 0, reorder: p.category === "Mini machines" ? 3 : 5, supplierId: "", notes: "", active: true });
      });
    });
    Y.machines.forEach(function (m) {
      list.push({ id: uid("p"), sku: m.sku, name: m.name, category: "Scent machines", size: m.oil + " oil", scent: "",
        price: m.price, cost: 0, stock: 0, reorder: 1, supplierId: "", notes: m.min + "–" + m.max + " m³ coverage", active: true });
    });
    [["AC-CLOCHE", "Candle cloche", 0], ["AC-LIGHTER", "Candle lighter", 0]].forEach(function (a) {
      list.push({ id: uid("p"), sku: a[0], name: a[1], category: "Accessories", size: "", scent: "", price: a[2], cost: 0, stock: 0, reorder: 3, supplierId: "", notes: "", active: true });
    });
    return list;
  }
  function fresh() {
    return { v: 1, nextSaleNo: 1, products: seedProducts(), customers: [], suppliers: [], sales: [], purchases: [], movements: [],
      settings: { business: "YOLA Company Limited", address: "22 Huruma Street, Mikocheni B, Dar es Salaam", phone: "0653 060 820", lastBackup: "" } };
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      db = raw ? JSON.parse(raw) : fresh();
    } catch (e) { db = fresh(); }
    if (!db.settings) db.settings = fresh().settings;
  }
  var storageOk = true;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(db)); storageOk = true; }
    catch (e) { storageOk = false; toast("Couldn't save on this device. Download a backup now from Backup & settings.", true); }
  }
  var staff = function () { try { return localStorage.getItem("yola-staff") || ""; } catch (e) { return ""; } };

  var byId = function (list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; };
  var product = function (id) { return byId(db.products, id); };
  var customer = function (id) { return byId(db.customers, id); };
  var supplier = function (id) { return byId(db.suppliers, id); };
  var pname = function (p) { return p ? [p.name, p.size, p.scent].filter(Boolean).join(" · ") : "Deleted product"; };
  var isLow = function (p) { return p.active && p.stock <= p.reorder; };
  var liveSales = function () { return db.sales.filter(function (s) { return !s.void; }); };
  var balance = function (s) { return Math.max(0, s.total - s.paid); };

  function move(productId, qty, type, ref, reason) {
    var p = product(productId); if (!p) return;
    p.stock = Math.round((p.stock + qty) * 100) / 100;
    db.movements.push({ id: uid("m"), date: new Date().toISOString(), productId: productId, qty: qty, type: type, ref: ref || "", reason: reason || "", by: staff(), after: p.stock });
  }

  /* ================= UI primitives ================= */
  var view = $("#view");
  function toast(msg, bad) {
    var t = $("[data-toast]"); t.textContent = msg; t.classList.toggle("bad", !!bad); t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, bad ? 5000 : 2600);
  }

  var modal = $("[data-modal]"), modalForm = $("[data-modal-form]"), onModalSubmit = null;
  function openModal(title, body, opts) {
    opts = opts || {};
    $("[data-modal-title]").textContent = title;
    $("[data-modal-body]").innerHTML = body;
    $("[data-modal-foot]").innerHTML = (opts.extra || "") +
      '<button type="button" class="btn btn-quiet" data-modal-close>' + (opts.cancel || "Cancel") + "</button>" +
      (opts.submit ? '<button type="submit" class="btn ' + (opts.danger ? "btn-danger" : "btn-main") + '">' + esc(opts.submit) + "</button>" : "");
    modal.classList.toggle("wide", !!opts.wide);
    onModalSubmit = opts.onSubmit || null;
    if (!modal.open) modal.showModal();
    var first = $("[data-modal-body] input:not([type=hidden]), [data-modal-body] select, [data-modal-body] textarea", modal);
    if (first && !opts.noFocus) setTimeout(function () { first.focus(); }, 30);
    if (opts.after) opts.after($("[data-modal-body]"));
  }
  function closeModal() { if (modal.open) modal.close(); onModalSubmit = null; }
  modal.addEventListener("click", function (e) {
    if (e.target.closest("[data-modal-close]")) { e.preventDefault(); closeModal(); }
    if (e.target === modal) closeModal();
  });
  modalForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!onModalSubmit) return closeModal();
    var err = $(".form-error", modalForm);
    var result = onModalSubmit(formData(modalForm), modalForm);
    if (typeof result === "string") {
      if (!err) { err = document.createElement("p"); err.className = "form-error"; err.setAttribute("role", "alert"); $("[data-modal-body]").appendChild(err); }
      err.textContent = result; return;
    }
    if (result !== false) closeModal();
  });
  function formData(form) {
    var o = {};
    $$("input[name], select[name], textarea[name]", form).forEach(function (el) {
      if (el.type === "checkbox") o[el.name] = el.checked;
      else if (el.type === "radio") { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.value.trim();
    });
    return o;
  }
  function confirmBox(title, text, yes, fn, danger) {
    openModal(title, "<p>" + text + "</p>", { submit: yes, danger: danger, onSubmit: function () { fn(); }, noFocus: true });
  }

  var field = function (label, name, value, opts) {
    opts = opts || {};
    var attrs = (opts.type ? ' type="' + opts.type + '"' : "") + (opts.required ? " required" : "") + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : "") +
      (opts.min != null ? ' min="' + opts.min + '"' : "") + (opts.step ? ' step="' + opts.step + '"' : "") + (opts.list ? ' list="' + opts.list + '"' : "") +
      (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : "");
    return '<label class="field' + (opts.cls ? " " + opts.cls : "") + '"><span>' + esc(label) + (opts.required ? ' <b class="req">required</b>' : "") + "</span>" +
      (opts.textarea ? '<textarea name="' + name + '" rows="3"' + attrs + ">" + esc(value) + "</textarea>" : '<input name="' + name + '" value="' + esc(value) + '"' + attrs + ">") +
      (opts.help ? '<small>' + esc(opts.help) + "</small>" : "") + "</label>";
  };
  var selectField = function (label, name, options, value, opts) {
    opts = opts || {};
    return '<label class="field' + (opts.cls ? " " + opts.cls : "") + '"><span>' + esc(label) + "</span><select name=\"" + name + "\">" +
      options.map(function (o) { var v = typeof o === "string" ? o : o.v, t = typeof o === "string" ? o : o.t; return '<option value="' + esc(v) + '"' + (String(v) === String(value) ? " selected" : "") + ">" + esc(t) + "</option>"; }).join("") +
      "</select>" + (opts.help ? '<small>' + esc(opts.help) + "</small>" : "") + "</label>";
  };
  var empty = function (title, text, action) {
    return '<div class="empty"><h3>' + esc(title) + "</h3><p>" + esc(text) + "</p>" + (action || "") + "</div>";
  };
  var stockBadge = function (p) {
    var cls = p.stock <= 0 ? "out" : isLow(p) ? "low" : "ok";
    var label = p.stock <= 0 ? "Out of stock" : isLow(p) ? "Low" : "In stock";
    return '<span class="stock ' + cls + '"><b>' + p.stock + "</b> " + label + "</span>";
  };
  var catOptions = function () {
    var set = {}; CATEGORIES.concat(db.products.map(function (p) { return p.category; })).forEach(function (c) { if (c) set[c] = 1; });
    return Object.keys(set);
  };

  /* ================= routing ================= */
  var routes = {};
  var state = { stockFilter: "", stockCat: "", stockLow: false, salesQ: "", salesFrom: "", salesTo: "", salesPay: "", salesStatus: "", custQ: "", supQ: "", period: "month", cart: [], cartCustomer: "", receive: [] };
  function go() {
    var parts = (location.hash || "#/home").slice(2).split("/");
    var name = routes[parts[0]] ? parts[0] : "home";
    $$("[data-route]").forEach(function (a) { a.classList.toggle("active", a.dataset.route === name); if (a.dataset.route === name) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    routes[name](parts.slice(1));
    document.title = (name === "home" ? "" : $('[data-route="' + name + '"]').lastChild.textContent.trim() + " — ") + "YOLA Inventory";
  }
  window.addEventListener("hashchange", function () { go(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); });
  function rerender() { go(); }

  /* ================= HOME ================= */
  routes.home = function () {
    var t = today(), monthKey = t.slice(0, 7);
    var live = liveSales();
    var todays = live.filter(function (s) { return s.date.slice(0, 10) === t; });
    var month = live.filter(function (s) { return s.date.slice(0, 7) === monthKey; });
    var sum = function (l) { return l.reduce(function (n, s) { return n + s.total; }, 0); };
    var owed = live.reduce(function (n, s) { return n + balance(s); }, 0);
    var low = db.products.filter(isLow).sort(function (a, b) { return a.stock - b.stock; });
    var noStockYet = db.products.every(function (p) { return p.stock === 0; }) && !db.sales.length;
    var recent = db.sales.slice().reverse().slice(0, 6);
    var greeting = staff() ? "Hello, " + esc(staff().split(" ")[0]) + "." : "Hello.";

    view.innerHTML =
      '<div class="page-head"><h1>' + greeting + '</h1><p class="sub">' + new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) + "</p></div>" +
      (noStockYet ? '<div class="callout"><div><h3>Start by entering your stock</h3><p>The YOLA product list is already here. Use <b>Receive stock</b> to add what you have on the shelves, or open <b>Stock</b> and set counts one by one. Want to practise first? Load the practice data in <a href="#/settings">Backup &amp; settings</a>.</p></div><a class="btn btn-main" href="#/receive">Receive stock</a></div>' : "") +
      '<div class="actions">' +
        '<a class="action action-main" href="#/sell"><b>New sale</b><span>Record what a customer bought</span></a>' +
        '<a class="action" href="#/receive"><b>Receive stock</b><span>Add a delivery from a supplier</span></a>' +
        '<button class="action" type="button" data-new-customer><b>Add customer</b><span>Save a name and phone number</span></button>' +
        '<a class="action" href="#/stock/low"><b>Check stock</b><span>See counts and adjust</span></a>' +
      "</div>" +
      '<div class="kpis">' +
        kpi("Sales today", money(sum(todays)), plural(todays.length, "sale")) +
        kpi("This month", money(sum(month)), plural(month.length, "sale")) +
        kpi("Customers owe", money(owed), owed ? '<a href="#/sales/unpaid">See unpaid sales</a>' : "All paid") +
        kpi("Low or out of stock", String(low.length), low.length ? '<a href="#/stock/low">See the list</a>' : "Nothing to reorder") +
      "</div>" +
      '<div class="cols">' +
        '<section class="panel"><div class="panel-head"><h2>Running low</h2><a href="#/stock/low">All low stock</a></div>' +
          (low.length ? '<ul class="list">' + low.slice(0, 8).map(function (p) {
            return '<li><button type="button" class="row-btn" data-adjust="' + p.id + '"><span>' + esc(pname(p)) + "<small>Reorder at " + p.reorder + "</small></span>" + stockBadge(p) + "</button></li>";
          }).join("") + "</ul>" : empty("Nothing is running low", "Products appear here when stock reaches their reorder level.")) +
        "</section>" +
        '<section class="panel"><div class="panel-head"><h2>Latest sales</h2><a href="#/sales">All sales</a></div>' +
          (recent.length ? '<ul class="list">' + recent.map(saleRow).join("") + "</ul>" : empty("No sales yet", "Sales you record will show here.", '<a class="btn btn-main" href="#/sell">Record a sale</a>')) +
        "</section>" +
      "</div>";
  };
  function kpi(label, value, foot) { return '<div class="kpi"><span>' + label + "</span><b>" + value + "</b><small>" + foot + "</small></div>"; }
  function saleRow(s) {
    var c = customer(s.customerId);
    var status = s.void ? '<span class="tag tag-void">Voided</span>' : balance(s) > 0 ? '<span class="tag tag-owe">Owes ' + money(balance(s)) + "</span>" : '<span class="tag tag-paid">Paid</span>';
    return '<li><button type="button" class="row-btn" data-sale="' + s.id + '"><span><b>#' + s.no + "</b> " + esc(c ? c.name : "Walk-in customer") +
      "<small>" + fmtDate(s.date) + ", " + fmtTime(s.date) + " · " + plural(s.items.reduce(function (n, i) { return n + i.qty; }, 0), "item") + " · " + esc(s.payment) + "</small></span>" +
      '<span class="right"><b>' + money(s.total) + "</b>" + status + "</span></button></li>";
  }

  /* ================= SELL ================= */
  routes.sell = function () {
    view.innerHTML =
      '<div class="page-head"><h1>New sale</h1><p class="sub">Tap products to add them. Check the quantities, choose the customer and how they paid, then save.</p></div>' +
      '<div class="sell">' +
        '<section class="panel picker"><input type="search" class="big-search" placeholder="Find a product by name, size, scent or code" data-pick-q aria-label="Find a product">' +
          '<div class="pick-grid" data-pick></div></section>' +
        '<section class="panel cart" data-cart aria-label="This sale"></section>' +
      "</div>";
    var q = $("[data-pick-q]");
    q.addEventListener("input", drawPicker);
    drawPicker(); drawCart();
  };
  function drawPicker() {
    var q = lower($("[data-pick-q]").value);
    var list = db.products.filter(function (p) { return p.active && (!q || lower(pname(p) + " " + p.sku + " " + p.category).indexOf(q) > -1); });
    $("[data-pick]").innerHTML = list.length ? list.map(function (p) {
      var inCart = state.cart.filter(function (c) { return c.productId === p.id; })[0];
      return '<button type="button" class="pick' + (p.stock <= 0 ? " is-out" : "") + (inCart ? " in-cart" : "") + '" data-add="' + p.id + '">' +
        "<b>" + esc(p.name) + "</b><span>" + esc([p.size, p.scent].filter(Boolean).join(" · ") || p.category) + "</span>" +
        "<em>" + (p.price ? money(p.price) : "No price set") + "</em><small" + (isLow(p) && p.stock > 0 ? ' class="is-low"' : "") + ">" + (p.stock <= 0 ? "Out of stock" : p.stock + " in stock") + (inCart ? " · " + inCart.qty + " in sale" : "") + "</small></button>";
    }).join("") : empty("No products match", "Try another word, or add the product in Stock.", '<a class="btn" href="#/stock">Go to Stock</a>');
  }
  function drawCart() {
    var box = $("[data-cart]"); if (!box) return;
    var subtotal = state.cart.reduce(function (n, c) { return n + c.qty * c.price; }, 0);
    var custOpts = [{ v: "", t: "Walk-in customer (no details)" }].concat(db.customers.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) { return { v: c.id, t: c.name + (c.phone ? " — " + c.phone : "") }; }));
    box.innerHTML = '<h2>This sale</h2>' +
      (state.cart.length ? '<ul class="cart-lines">' + state.cart.map(function (c, i) {
        var p = product(c.productId);
        return '<li><div class="cl-name">' + esc(pname(p)) + '<small>' + (p ? p.stock + " in stock" : "") + "</small></div>" +
          '<div class="qty"><button type="button" data-dec="' + i + '" aria-label="One fewer">−</button><input aria-label="Quantity" inputmode="numeric" value="' + c.qty + '" data-qty="' + i + '"><button type="button" data-inc="' + i + '" aria-label="One more">+</button></div>' +
          '<label class="cl-price"><span>Price each</span><input inputmode="numeric" value="' + c.price + '" data-price="' + i + '"></label>' +
          '<b class="cl-total">' + money(c.qty * c.price) + '</b><button type="button" class="icon-btn" data-remove="' + i + '" aria-label="Remove ' + esc(pname(p)) + '">✕</button></li>';
      }).join("") + "</ul>" : '<p class="cart-empty">No products yet. Tap a product on the left to add it.</p>') +
      '<div class="cart-form">' +
        '<div class="row2"><label class="field"><span>Customer</span><select data-cart-customer>' + custOpts.map(function (o) { return '<option value="' + o.v + '"' + (o.v === state.cartCustomer ? " selected" : "") + ">" + esc(o.t) + "</option>"; }).join("") + '</select></label>' +
        '<button type="button" class="btn btn-small" data-new-customer="sell">New customer</button></div>' +
        '<div class="row3">' +
          '<label class="field"><span>Sold through</span><select data-cart-channel>' + CHANNELS.map(function (c) { return "<option" + (c === state.cartChannel ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select></label>" +
          '<label class="field"><span>Paid with</span><select data-cart-pay>' + PAYMENTS.map(function (c) { return "<option" + (c === state.cartPay ? " selected" : "") + ">" + c + "</option>"; }).join("") + "</select></label>" +
          '<label class="field"><span>Discount (TZS)</span><input inputmode="numeric" data-cart-discount value="' + (state.cartDiscount || "") + '" placeholder="0"></label>' +
        "</div>" +
        '<div class="totals"><span>Subtotal</span><b>' + money(subtotal) + "</b><span>Total to pay</span><b class=\"grand\" data-grand>" + money(Math.max(0, subtotal - num(state.cartDiscount))) + "</b></div>" +
        '<label class="field"><span>Amount paid now (TZS)</span><input inputmode="numeric" data-cart-paid value="' + (state.cartPaid != null ? state.cartPaid : "") + '" placeholder="Leave empty if paid in full"><small>If the customer will pay later, enter what they paid today (or 0). The rest shows as owed.</small></label>' +
        '<label class="field"><span>Note (optional)</span><input data-cart-note value="' + esc(state.cartNote || "") + '" placeholder="e.g. delivery to Masaki, gift wrapped"></label>' +
        '<p class="form-error" data-cart-error role="alert" hidden></p>' +
        '<div class="cart-actions"><button type="button" class="btn btn-quiet" data-cart-clear' + (state.cart.length ? "" : " disabled") + '>Clear</button><button type="button" class="btn btn-main btn-big" data-cart-save' + (state.cart.length ? "" : " disabled") + ">Save sale</button></div>" +
      "</div>";
  }
  function cartAdd(id) {
    var p = product(id); if (!p) return;
    var line = state.cart.filter(function (c) { return c.productId === id; })[0];
    var want = (line ? line.qty : 0) + 1;
    if (want > p.stock) return toast("Only " + p.stock + " of " + pname(p) + " in stock. Receive or adjust stock first.", true);
    if (line) line.qty++; else state.cart.push({ productId: id, qty: 1, price: p.price });
    drawCart(); drawPicker();
  }
  view.addEventListener("click", function (e) {
    var t = e.target;
    var add = t.closest("[data-add]"); if (add) return cartAdd(add.dataset.add);
    var inc = t.closest("[data-inc]"); if (inc) { var c = state.cart[+inc.dataset.inc], p = product(c.productId); if (c.qty + 1 > p.stock) return toast("Only " + p.stock + " in stock.", true); c.qty++; drawCart(); drawPicker(); return; }
    var dec = t.closest("[data-dec]"); if (dec) { var d = state.cart[+dec.dataset.dec]; d.qty--; if (d.qty <= 0) state.cart.splice(+dec.dataset.dec, 1); drawCart(); drawPicker(); return; }
    var rm = t.closest("[data-remove]"); if (rm) { state.cart.splice(+rm.dataset.remove, 1); drawCart(); drawPicker(); return; }
    if (t.closest("[data-cart-clear]")) { resetCart(); drawCart(); drawPicker(); return; }
    if (t.closest("[data-cart-save]")) return saveSale();
    var nc = t.closest("[data-new-customer]"); if (nc) return editCustomer(null, nc.dataset.newCustomer === "sell" ? function (c) { state.cartCustomer = c.id; drawCart(); } : null);
    var sale = t.closest("[data-sale]"); if (sale) return showSale(sale.dataset.sale);
    var adj = t.closest("[data-adjust]"); if (adj) return adjustStock(adj.dataset.adjust);
    var ed = t.closest("[data-edit-product]"); if (ed) return editProduct(ed.dataset.editProduct);
    var hist = t.closest("[data-history]"); if (hist) return productHistory(hist.dataset.history);
    var cu = t.closest("[data-customer]"); if (cu) return showCustomer(cu.dataset.customer);
    var su = t.closest("[data-supplier]"); if (su) return showSupplier(su.dataset.supplier);
  });
  view.addEventListener("input", function (e) {
    var t = e.target;
    if (t.matches("[data-qty]")) { var c = state.cart[+t.dataset.qty]; var p = product(c.productId); var v = Math.max(1, Math.floor(num(t.value)) || 1); if (v > p.stock) { v = p.stock; toast("Only " + p.stock + " in stock.", true); } c.qty = v; }
    if (t.matches("[data-price]")) state.cart[+t.dataset.price].price = num(t.value);
    if (t.matches("[data-cart-discount]")) state.cartDiscount = t.value;
    if (t.matches("[data-cart-paid]")) state.cartPaid = t.value;
    if (t.matches("[data-cart-note]")) state.cartNote = t.value;
    if (t.matches("[data-qty], [data-price], [data-cart-discount]")) {
      var subtotal = state.cart.reduce(function (n, c) { return n + c.qty * c.price; }, 0);
      var g = $("[data-grand]"); if (g) g.textContent = money(Math.max(0, subtotal - num(state.cartDiscount)));
      $$("[data-cart] .cl-total").forEach(function (el, i) { if (state.cart[i]) el.textContent = money(state.cart[i].qty * state.cart[i].price); });
    }
  });
  view.addEventListener("change", function (e) {
    var t = e.target;
    if (t.matches("[data-cart-customer]")) state.cartCustomer = t.value;
    if (t.matches("[data-cart-channel]")) state.cartChannel = t.value;
    if (t.matches("[data-cart-pay]")) state.cartPay = t.value;
    if (t.matches("[data-qty]")) { drawCart(); drawPicker(); }
  });
  function resetCart() { state.cart = []; state.cartCustomer = ""; state.cartDiscount = ""; state.cartPaid = null; state.cartNote = ""; }
  function saveSale() {
    var err = $("[data-cart-error]");
    var fail = function (m) { err.textContent = m; err.hidden = false; };
    if (!state.cart.length) return fail("Add at least one product.");
    for (var i = 0; i < state.cart.length; i++) {
      var p = product(state.cart[i].productId);
      if (state.cart[i].qty > p.stock) return fail("Only " + p.stock + " of " + pname(p) + " in stock. Lower the quantity or receive stock first.");
      if (!state.cart[i].price) return fail(pname(p) + " has no price. Enter the price each before saving.");
    }
    var subtotal = state.cart.reduce(function (n, c) { return n + c.qty * c.price; }, 0);
    var discount = Math.min(num(state.cartDiscount), subtotal);
    var total = subtotal - discount;
    var paid = state.cartPaid == null || String(state.cartPaid).trim() === "" ? total : Math.min(num(state.cartPaid), total);
    var s = { id: uid("s"), no: db.nextSaleNo++, date: new Date().toISOString(), customerId: state.cartCustomer || "",
      items: state.cart.map(function (c) { var p = product(c.productId); return { productId: c.productId, name: pname(p), qty: c.qty, price: c.price, cost: p.cost || 0 }; }),
      subtotal: subtotal, discount: discount, total: total, paid: paid, payments: paid ? [{ date: new Date().toISOString(), amount: paid, method: state.cartPay || PAYMENTS[0] }] : [],
      payment: state.cartPay || PAYMENTS[0], channel: state.cartChannel || CHANNELS[0], note: state.cartNote || "", by: staff(), void: false };
    db.sales.push(s);
    s.items.forEach(function (i) { move(i.productId, -i.qty, "Sale", "#" + s.no); });
    save(); resetCart(); drawCart(); drawPicker();
    toast("Sale #" + s.no + " saved");
    showSale(s.id);
  }

  function receiptHTML(s) {
    var c = customer(s.customerId);
    return '<div class="receipt"><h3>YOLA</h3><p>' + esc(db.settings.business) + "<br>" + esc(db.settings.address) + "<br>" + esc(db.settings.phone) + "</p>" +
      "<p><b>Receipt #" + s.no + "</b><br>" + fmtDate(s.date) + ", " + fmtTime(s.date) + (c ? "<br>Customer: " + esc(c.name) : "") + (s.by ? "<br>Served by: " + esc(s.by) : "") + "</p>" +
      "<table>" + s.items.map(function (i) { return "<tr><td>" + i.qty + " × " + esc(i.name) + "</td><td>" + money(i.qty * i.price) + "</td></tr>"; }).join("") +
      (s.discount ? "<tr><td>Discount</td><td>− " + money(s.discount) + "</td></tr>" : "") +
      '<tr class="t"><td>Total</td><td>' + money(s.total) + "</td></tr><tr><td>Paid (" + esc(s.payment) + ")</td><td>" + money(s.paid) + "</td></tr>" +
      (balance(s) ? "<tr><td>Balance due</td><td>" + money(balance(s)) + "</td></tr>" : "") + "</table><p>Thank you for choosing YOLA.</p></div>";
  }
  function printReceipt(s) {
    $("#print-area").innerHTML = receiptHTML(s);
    window.print();
  }
  function showSale(id) {
    var s = byId(db.sales, id); if (!s) return;
    var c = customer(s.customerId);
    var owe = balance(s);
    var phone = c && c.phone ? c.phone.replace(/\D/g, "").replace(/^0/, "255") : "";
    var body = (s.void ? '<p class="callout-bad">This sale was voided' + (s.voidReason ? ": " + esc(s.voidReason) : "") + ". Its stock was returned.</p>" : "") +
      receiptHTML(s) +
      '<dl class="facts"><div><dt>Sold through</dt><dd>' + esc(s.channel) + "</dd></div><div><dt>Recorded by</dt><dd>" + esc(s.by || "—") + "</dd></div>" + (s.note ? "<div><dt>Note</dt><dd>" + esc(s.note) + "</dd></div>" : "") +
      (s.payments && s.payments.length > 1 ? "<div><dt>Payments</dt><dd>" + s.payments.map(function (p) { return money(p.amount) + " by " + esc(p.method) + " on " + fmtDate(p.date); }).join("<br>") + "</dd></div>" : "") + "</dl>";
    var extra = (!s.void && owe ? '<button type="button" class="btn" data-pay-sale>Record payment</button>' : "") +
      '<button type="button" class="btn" data-print-sale>Print receipt</button>' +
      (phone ? '<button type="button" class="btn" data-wa-sale>Send on WhatsApp</button>' : "") +
      (!s.void ? '<button type="button" class="btn btn-quiet danger-text" data-void-sale>Void sale</button>' : "");
    openModal("Sale #" + s.no, body, { cancel: "Close", extra: extra, noFocus: true, after: function (b) {
      var foot = $("[data-modal-foot]");
      var pb = $("[data-print-sale]", foot); if (pb) pb.onclick = function () { printReceipt(s); };
      var wb = $("[data-wa-sale]", foot); if (wb) wb.onclick = function () {
        var text = "Hello " + c.name + ", thank you for shopping at YOLA.\nReceipt #" + s.no + " (" + fmtDate(s.date) + ")\n" +
          s.items.map(function (i) { return i.qty + " × " + i.name + " — " + money(i.qty * i.price); }).join("\n") +
          (s.discount ? "\nDiscount: −" + money(s.discount) : "") + "\nTotal: " + money(s.total) + (balance(s) ? "\nBalance due: " + money(balance(s)) : "");
        window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(text), "_blank", "noopener");
      };
      var pay = $("[data-pay-sale]", foot); if (pay) pay.onclick = function () { recordPayment(s); };
      var vb = $("[data-void-sale]", foot); if (vb) vb.onclick = function () { voidSale(s); };
    } });
  }
  function recordPayment(s) {
    openModal("Record a payment for sale #" + s.no,
      "<p>Balance due: <b>" + money(balance(s)) + "</b></p>" +
      field("Amount received (TZS)", "amount", balance(s), { required: true, inputmode: "numeric" }) +
      selectField("Paid with", "method", PAYMENTS, s.payment),
      { submit: "Save payment", onSubmit: function (d) {
        var a = num(d.amount);
        if (a <= 0) return "Enter the amount received.";
        if (a > balance(s)) return "That's more than the balance of " + money(balance(s)) + ".";
        s.paid += a; s.payments = s.payments || []; s.payments.push({ date: new Date().toISOString(), amount: a, method: d.method });
        save(); toast("Payment saved"); setTimeout(function () { showSale(s.id); rerender(); }, 0);
      } });
  }
  function voidSale(s) {
    openModal("Void sale #" + s.no + "?",
      "<p>Voiding puts the products back into stock and removes the sale from totals. The sale stays in the history, marked as voided.</p>" +
      field("Reason", "reason", "", { required: true, placeholder: "e.g. entered twice, customer returned everything" }),
      { submit: "Void sale", danger: true, onSubmit: function (d) {
        if (!d.reason) return "Give a short reason so the team knows why.";
        s.void = true; s.voidReason = d.reason; s.voidBy = staff();
        s.items.forEach(function (i) { move(i.productId, i.qty, "Void", "#" + s.no, d.reason); });
        save(); toast("Sale #" + s.no + " voided and stock returned"); rerender();
      } });
  }

  /* ================= RECEIVE STOCK ================= */
  routes.receive = function () {
    if (!state.receive.length) state.receive = [{ productId: "", qty: "", cost: "" }];
    var supOpts = [{ v: "", t: "No supplier / made in-house" }].concat(db.suppliers.map(function (s) { return { v: s.id, t: s.name }; }));
    var prodOpts = db.products.filter(function (p) { return p.active; }).sort(function (a, b) { return pname(a).localeCompare(pname(b)); });
    view.innerHTML =
      '<div class="page-head"><h1>Receive stock</h1><p class="sub">Use this when a delivery arrives or a new batch is made. The counts are added to what\'s on the shelf.</p></div>' +
      '<section class="panel receive">' +
        '<div class="row2"><label class="field"><span>Supplier</span><select data-rcv-supplier>' + supOpts.map(function (o) { return '<option value="' + o.v + '"' + (o.v === state.rcvSupplier ? " selected" : "") + ">" + esc(o.t) + "</option>"; }).join("") + "</select></label>" +
        '<button type="button" class="btn btn-small" data-new-supplier>New supplier</button></div>' +
        '<table class="rcv-table"><thead><tr><th>Product</th><th>Quantity</th><th>Cost each (TZS)</th><th></th></tr></thead><tbody>' +
        state.receive.map(function (r, i) {
          return '<tr><td><select data-rcv-product="' + i + '" aria-label="Product"><option value="">Choose a product…</option>' +
            prodOpts.map(function (p) { return '<option value="' + p.id + '"' + (p.id === r.productId ? " selected" : "") + ">" + esc(pname(p)) + " (now " + p.stock + ")</option>"; }).join("") + "</select></td>" +
            '<td><input inputmode="numeric" data-rcv-qty="' + i + '" value="' + esc(r.qty) + '" aria-label="Quantity" placeholder="0"></td>' +
            '<td><input inputmode="numeric" data-rcv-cost="' + i + '" value="' + esc(r.cost) + '" aria-label="Cost each" placeholder="Optional"></td>' +
            '<td><button type="button" class="icon-btn" data-rcv-remove="' + i + '" aria-label="Remove line">✕</button></td></tr>';
        }).join("") + "</tbody></table>" +
        '<button type="button" class="btn btn-small" data-rcv-add>Add another product</button>' +
        '<label class="field"><span>Note (optional)</span><input data-rcv-note value="' + esc(state.rcvNote || "") + '" placeholder="e.g. invoice number, batch name"></label>' +
        '<p class="form-error" data-rcv-error role="alert" hidden></p>' +
        '<div class="cart-actions"><a class="btn btn-quiet" href="#/stock">Add a product that isn\'t listed</a><button type="button" class="btn btn-main btn-big" data-rcv-save>Add to stock</button></div>' +
      "</section>" +
      '<section class="panel"><div class="panel-head"><h2>Recent deliveries</h2></div>' +
        (db.purchases.length ? '<ul class="list">' + db.purchases.slice().reverse().slice(0, 10).map(function (pu) {
          var sp = supplier(pu.supplierId);
          return '<li><div class="row-static"><span><b>' + fmtDate(pu.date) + "</b> " + esc(sp ? sp.name : "In-house / no supplier") + "<small>" +
            pu.items.map(function (i) { return i.qty + " × " + esc(i.name); }).join(", ") + (pu.note ? " · " + esc(pu.note) : "") + "</small></span><span class=\"right\"><b>" + (pu.total ? money(pu.total) : "") + "</b></span></div></li>";
        }).join("") + "</ul>" : empty("No deliveries yet", "Deliveries you add will be listed here.")) +
      "</section>";
  };
  view.addEventListener("change", function (e) {
    var t = e.target;
    if (t.matches("[data-rcv-product]")) {
      var r = state.receive[+t.dataset.rcvProduct]; r.productId = t.value;
      var p = product(t.value); if (p && !r.cost && p.cost) { r.cost = p.cost; var ci = $('[data-rcv-cost="' + t.dataset.rcvProduct + '"]'); if (ci) ci.value = p.cost; }
    }
    if (t.matches("[data-rcv-supplier]")) state.rcvSupplier = t.value;
  });
  view.addEventListener("input", function (e) {
    var t = e.target;
    if (t.matches("[data-rcv-qty]")) state.receive[+t.dataset.rcvQty].qty = t.value;
    if (t.matches("[data-rcv-cost]")) state.receive[+t.dataset.rcvCost].cost = t.value;
    if (t.matches("[data-rcv-note]")) state.rcvNote = t.value;
  });
  view.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-rcv-add]")) { state.receive.push({ productId: "", qty: "", cost: "" }); routes.receive(); var sels = $$("[data-rcv-product]"); sels[sels.length - 1].focus(); }
    var rm = t.closest("[data-rcv-remove]"); if (rm) { state.receive.splice(+rm.dataset.rcvRemove, 1); routes.receive(); }
    if (t.closest("[data-new-supplier]")) editSupplier(null, function (s) { state.rcvSupplier = s.id; routes.receive(); });
    if (t.closest("[data-rcv-save]")) {
      var err = $("[data-rcv-error]");
      var lines = state.receive.filter(function (r) { return r.productId || num(r.qty); });
      var bad = lines.filter(function (r) { return !r.productId || num(r.qty) <= 0; });
      if (!lines.length || bad.length) { err.textContent = !lines.length ? "Choose a product and enter how many arrived." : "Every line needs a product and a quantity above 0."; err.hidden = false; return; }
      var pu = { id: uid("pu"), date: new Date().toISOString(), supplierId: state.rcvSupplier || "", note: state.rcvNote || "", by: staff(), items: [], total: 0 };
      lines.forEach(function (r) {
        var p = product(r.productId), q = num(r.qty), c = num(r.cost);
        if (c) p.cost = c;
        if (state.rcvSupplier && !p.supplierId) p.supplierId = state.rcvSupplier;
        pu.items.push({ productId: p.id, name: pname(p), qty: q, cost: c }); pu.total += q * c;
        move(p.id, q, "Received", pu.supplierId ? (supplier(pu.supplierId) || {}).name : "Delivery", pu.note);
      });
      db.purchases.push(pu); save();
      toast("Added " + plural(pu.items.reduce(function (n, i) { return n + i.qty; }, 0), "item") + " to stock");
      state.receive = []; state.rcvNote = ""; routes.receive();
    }
  });

  /* ================= STOCK ================= */
  routes.stock = function (args) {
    if (args[0] === "low") state.stockLow = true;
    var cats = catOptions();
    view.innerHTML =
      '<div class="page-head with-action"><div><h1>Stock</h1><p class="sub">Tap a row to change a count. Use <b>Edit</b> for prices, reorder levels and details.</p></div><button type="button" class="btn btn-main" data-new-product>Add a product</button></div>' +
      '<div class="filters">' +
        '<input type="search" placeholder="Filter by name, scent or code" data-stock-q value="' + esc(state.stockFilter) + '" aria-label="Filter products">' +
        '<select data-stock-cat aria-label="Category"><option value="">All categories</option>' + cats.map(function (c) { return "<option" + (c === state.stockCat ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select>" +
        '<label class="check"><input type="checkbox" data-stock-low' + (state.stockLow ? " checked" : "") + "> Only low or out of stock</label>" +
        '<button type="button" class="btn btn-small" data-export="products">Download as spreadsheet</button>' +
      "</div>" +
      '<div class="panel table-wrap" data-stock-table></div>';
    drawStock();
  };
  function drawStock() {
    var q = lower(state.stockFilter);
    var list = db.products.filter(function (p) {
      return (!q || lower(pname(p) + " " + p.sku + " " + p.notes).indexOf(q) > -1) && (!state.stockCat || p.category === state.stockCat) && (!state.stockLow || isLow(p));
    }).sort(function (a, b) { return (a.active === b.active ? 0 : a.active ? -1 : 1) || a.category.localeCompare(b.category) || pname(a).localeCompare(pname(b)); });
    var valueCost = 0, valueRetail = 0;
    db.products.forEach(function (p) { if (p.stock > 0) { valueCost += p.stock * (p.cost || 0); valueRetail += p.stock * (p.price || 0); } });
    $("[data-stock-table]").innerHTML = list.length ?
      '<table class="tbl"><thead><tr><th>Product</th><th>Code</th><th>Category</th><th class="num">Price</th><th class="num">Cost</th><th>Stock</th><th class="num">Reorder at</th><th><span class="sr">Actions</span></th></tr></thead><tbody>' +
      list.map(function (p) {
        return '<tr class="' + (p.active ? "" : "inactive") + '"><td><button type="button" class="link-btn" data-adjust="' + p.id + '">' + esc(pname(p)) + "</button>" + (p.active ? "" : ' <span class="tag">Hidden</span>') + "</td><td>" + esc(p.sku) + "</td><td>" + esc(p.category) +
          '</td><td class="num">' + (p.price ? money(p.price) : '<span class="warn">Set price</span>') + '</td><td class="num">' + (p.cost ? money(p.cost) : "—") + "</td><td>" + stockBadge(p) + '</td><td class="num">' + p.reorder +
          '</td><td class="row-actions"><button type="button" class="btn btn-small" data-adjust="' + p.id + '">Count</button><button type="button" class="btn btn-small btn-quiet" data-edit-product="' + p.id + '">Edit</button><button type="button" class="btn btn-small btn-quiet" data-history="' + p.id + '">History</button></td></tr>';
      }).join("") + "</tbody></table>" +
      '<p class="table-foot">' + plural(list.length, "product") + " shown. Stock on hand is worth " + money(valueRetail) + " at selling price" + (valueCost ? " and " + money(valueCost) + " at cost" : "") + ".</p>"
      : empty("No products match", state.stockLow ? "Nothing is low on stock right now." : "Try a different word or category.");
  }
  view.addEventListener("input", function (e) { if (e.target.matches("[data-stock-q]")) { state.stockFilter = e.target.value; drawStock(); } });
  view.addEventListener("change", function (e) {
    if (e.target.matches("[data-stock-cat]")) { state.stockCat = e.target.value; drawStock(); }
    if (e.target.matches("[data-stock-low]")) { state.stockLow = e.target.checked; drawStock(); }
  });
  view.addEventListener("click", function (e) {
    if (e.target.closest("[data-new-product]")) editProduct(null);
    var ex = e.target.closest("[data-export]"); if (ex) exportCSV(ex.dataset.export);
  });

  function editProduct(id) {
    var p = id ? product(id) : { sku: "", name: "", category: CATEGORIES[0], size: "", scent: "", price: "", cost: "", stock: 0, reorder: 5, supplierId: "", notes: "", active: true };
    var supOpts = [{ v: "", t: "None" }].concat(db.suppliers.map(function (s) { return { v: s.id, t: s.name }; }));
    var scents = '<datalist id="scent-list">' + window.YOLA.scents.map(function (s) { return '<option value="' + esc(s) + '">'; }).join("") + "</datalist>";
    var cats = '<datalist id="cat-list">' + catOptions().map(function (c) { return '<option value="' + esc(c) + '">'; }).join("") + "</datalist>";
    openModal(id ? "Edit product" : "Add a product",
      '<div class="grid2">' +
      field("Product name", "name", p.name, { required: true, placeholder: "e.g. Organic reed diffuser" }) +
      field("Category", "category", p.category, { list: "cat-list", required: true }) +
      field("Size", "size", p.size, { placeholder: "e.g. 200ml, 380g" }) +
      field("Scent", "scent", p.scent, { list: "scent-list", placeholder: "Leave empty if not scented" }) +
      field("Selling price (TZS)", "price", p.price, { inputmode: "numeric", placeholder: "0" }) +
      field("Cost price (TZS)", "cost", p.cost, { inputmode: "numeric", placeholder: "What it costs YOLA", help: "Used for profit in Reports." }) +
      (id ? "" : field("Starting stock", "stock", p.stock, { inputmode: "numeric" })) +
      field("Warn me when stock is at or below", "reorder", p.reorder, { inputmode: "numeric" }) +
      field("Product code", "sku", p.sku, { placeholder: "e.g. RD-200-ROSE", help: "Optional. Short code for labels and search." }) +
      selectField("Usual supplier", "supplierId", supOpts, p.supplierId) +
      "</div>" + field("Notes", "notes", p.notes, { textarea: true }) +
      (id ? '<label class="check"><input type="checkbox" name="active"' + (p.active ? " checked" : "") + "> Show this product in sales and stock lists</label>" : "") + scents + cats,
      { submit: id ? "Save changes" : "Add product", wide: true,
        extra: id ? '<button type="button" class="btn btn-quiet" data-dup>Copy for another scent</button>' : "",
        after: function () { var d = $("[data-dup]"); if (d) d.onclick = function () { var c = JSON.parse(JSON.stringify(p)); c.id = uid("p"); c.stock = 0; c.scent = ""; c.sku = p.sku ? p.sku + "-2" : ""; db.products.push(c); save(); closeModal(); editProduct(c.id); toast("Copy made. Set its scent and code."); }; },
        onSubmit: function (d) {
          if (!d.name) return "Give the product a name.";
          if (!d.category) return "Choose or type a category.";
          var dupe = d.sku && db.products.some(function (x) { return x.sku && x.id !== id && lower(x.sku) === lower(d.sku); });
          if (dupe) return "Another product already uses the code " + d.sku + ".";
          var target = id ? p : { id: uid("p"), stock: 0 };
          target.name = d.name; target.category = d.category; target.size = d.size; target.scent = d.scent; target.price = num(d.price); target.cost = num(d.cost);
          target.reorder = num(d.reorder); target.sku = d.sku; target.supplierId = d.supplierId; target.notes = d.notes; target.active = id ? !!d.active : true;
          if (!id) { db.products.push(target); if (num(d.stock)) move(target.id, num(d.stock), "Opening stock", "", ""); }
          save(); toast(id ? "Changes saved" : "Product added"); rerender();
        } });
  }
  function adjustStock(id) {
    var p = product(id);
    openModal("Change stock: " + pname(p),
      '<p class="big-count">On the shelf now: <b>' + p.stock + "</b></p>" +
      '<div class="seg" role="radiogroup" aria-label="How to change"><label><input type="radio" name="mode" value="set" checked><span>I counted it</span></label><label><input type="radio" name="mode" value="remove"><span>Take some out</span></label><label><input type="radio" name="mode" value="add"><span>Put some back</span></label></div>' +
      field("How many?", "qty", "", { required: true, inputmode: "numeric", help: "For “I counted it”, enter the total you counted." }) +
      selectField("Reason", "reason", REASONS, REASONS[0]) +
      field("Note (optional)", "note", ""),
      { submit: "Save stock", onSubmit: function (d) {
        var q = num(d.qty);
        if (d.qty === "" || q < 0) return "Enter a number (0 or more).";
        var delta = d.mode === "set" ? q - p.stock : d.mode === "remove" ? -q : q;
        if (p.stock + delta < 0) return "That would make stock negative. There are only " + p.stock + ".";
        if (!delta) { toast("No change — count matches"); return; }
        move(p.id, delta, "Adjustment", "", d.reason + (d.note ? ": " + d.note : ""));
        save(); toast(pname(p) + " now " + p.stock); rerender();
      } });
  }
  function productHistory(id) {
    var p = product(id);
    var mv = db.movements.filter(function (m) { return m.productId === id; }).slice().reverse();
    openModal("History: " + pname(p),
      mv.length ? '<table class="tbl compact"><thead><tr><th>When</th><th>What</th><th class="num">Change</th><th class="num">After</th><th>By</th></tr></thead><tbody>' +
        mv.map(function (m) { return "<tr><td>" + fmtDate(m.date) + " " + fmtTime(m.date) + "</td><td>" + esc(m.type) + (m.ref ? " " + esc(m.ref) : "") + (m.reason ? "<small>" + esc(m.reason) + "</small>" : "") +
          '</td><td class="num ' + (m.qty < 0 ? "neg" : "pos") + '">' + (m.qty > 0 ? "+" : "") + m.qty + '</td><td class="num">' + (m.after != null ? m.after : "") + "</td><td>" + esc(m.by || "") + "</td></tr>"; }).join("") + "</tbody></table>"
        : empty("No history yet", "Sales, deliveries and count changes for this product will be listed here."),
      { cancel: "Close", wide: true, noFocus: true });
  }

  /* ================= SALES ================= */
  routes.sales = function (args) {
    if (args[0] === "unpaid") state.salesStatus = "unpaid";
    view.innerHTML =
      '<div class="page-head with-action"><div><h1>Sales</h1><p class="sub">Every sale, newest first. Tap a sale to see the receipt, record a payment or void it.</p></div><a class="btn btn-main" href="#/sell">New sale</a></div>' +
      '<div class="filters">' +
        '<input type="search" placeholder="Customer, product or sale number" data-sales-q value="' + esc(state.salesQ) + '" aria-label="Filter sales">' +
        '<label class="inline">From <input type="date" data-sales-from value="' + state.salesFrom + '"></label>' +
        '<label class="inline">To <input type="date" data-sales-to value="' + state.salesTo + '"></label>' +
        '<select data-sales-pay aria-label="Payment method"><option value="">Any payment</option>' + PAYMENTS.map(function (p) { return "<option" + (p === state.salesPay ? " selected" : "") + ">" + p + "</option>"; }).join("") + "</select>" +
        '<select data-sales-status aria-label="Status"><option value="">Any status</option><option value="paid"' + (state.salesStatus === "paid" ? " selected" : "") + '>Paid in full</option><option value="unpaid"' + (state.salesStatus === "unpaid" ? " selected" : "") + '>Still owing</option><option value="void"' + (state.salesStatus === "void" ? " selected" : "") + ">Voided</option></select>" +
        '<button type="button" class="btn btn-small" data-export="sales">Download as spreadsheet</button>' +
      "</div><div class=\"panel\" data-sales-list></div>";
    drawSales();
  };
  function filteredSales() {
    var q = lower(state.salesQ);
    return db.sales.filter(function (s) {
      var c = customer(s.customerId), d = s.date.slice(0, 10);
      if (state.salesFrom && d < state.salesFrom) return false;
      if (state.salesTo && d > state.salesTo) return false;
      if (state.salesPay && s.payment !== state.salesPay) return false;
      if (state.salesStatus === "paid" && (s.void || balance(s) > 0)) return false;
      if (state.salesStatus === "unpaid" && (s.void || balance(s) <= 0)) return false;
      if (state.salesStatus === "void" && !s.void) return false;
      if (q) {
        var hay = lower("#" + s.no + " " + s.no + " " + (c ? c.name + " " + c.phone : "walk-in") + " " + s.items.map(function (i) { return i.name; }).join(" ") + " " + s.note);
        if (hay.indexOf(q.replace(/^#/, "#")) < 0 && hay.indexOf(q) < 0) return false;
      }
      return true;
    }).slice().reverse();
  }
  function drawSales() {
    var list = filteredSales();
    var live = list.filter(function (s) { return !s.void; });
    var tot = live.reduce(function (n, s) { return n + s.total; }, 0), owed = live.reduce(function (n, s) { return n + balance(s); }, 0);
    $("[data-sales-list]").innerHTML = list.length ?
      '<p class="table-foot top">' + plural(live.length, "sale") + " · " + money(tot) + (owed ? " · " + money(owed) + " still owed" : "") + "</p>" +
      '<ul class="list">' + list.slice(0, 300).map(saleRow).join("") + "</ul>" + (list.length > 300 ? '<p class="table-foot">Showing the latest 300. Narrow the dates to see older sales.</p>' : "")
      : empty(db.sales.length ? "No sales match" : "No sales yet", db.sales.length ? "Clear a filter to see more." : "Record your first sale to see it here.", db.sales.length ? "" : '<a class="btn btn-main" href="#/sell">Record a sale</a>');
  }
  view.addEventListener("input", function (e) { if (e.target.matches("[data-sales-q]")) { state.salesQ = e.target.value; drawSales(); } });
  view.addEventListener("change", function (e) {
    var t = e.target, hit = true;
    if (t.matches("[data-sales-from]")) state.salesFrom = t.value;
    else if (t.matches("[data-sales-to]")) state.salesTo = t.value;
    else if (t.matches("[data-sales-pay]")) state.salesPay = t.value;
    else if (t.matches("[data-sales-status]")) state.salesStatus = t.value;
    else hit = false;
    if (hit) drawSales();
  });

  /* ================= CUSTOMERS ================= */
  function custStats(id) {
    var s = liveSales().filter(function (x) { return x.customerId === id; });
    return { count: s.length, spent: s.reduce(function (n, x) { return n + x.total; }, 0), owed: s.reduce(function (n, x) { return n + balance(x); }, 0), last: s.length ? s[s.length - 1].date : "" };
  }
  routes.customers = function () {
    view.innerHTML =
      '<div class="page-head with-action"><div><h1>Customers</h1><p class="sub">People and businesses who buy from YOLA, with what they\'ve spent.</p></div><button type="button" class="btn btn-main" data-new-customer>Add customer</button></div>' +
      '<div class="filters"><input type="search" placeholder="Name, phone, area or company" data-cust-q value="' + esc(state.custQ) + '" aria-label="Filter customers"><button type="button" class="btn btn-small" data-export="customers">Download as spreadsheet</button></div>' +
      '<div class="panel table-wrap" data-cust-list></div>';
    drawCustomers();
  };
  function drawCustomers() {
    var q = lower(state.custQ);
    var list = db.customers.filter(function (c) { return !q || lower([c.name, c.phone, c.email, c.area, c.type, c.notes].join(" ")).indexOf(q) > -1; })
      .map(function (c) { return { c: c, s: custStats(c.id) }; }).sort(function (a, b) { return b.s.spent - a.s.spent || a.c.name.localeCompare(b.c.name); });
    $("[data-cust-list]").innerHTML = list.length ?
      '<table class="tbl"><thead><tr><th>Name</th><th>Phone</th><th>Type</th><th>Area</th><th class="num">Purchases</th><th class="num">Spent</th><th class="num">Owes</th><th>Last bought</th></tr></thead><tbody>' +
      list.map(function (r) { var c = r.c, s = r.s;
        return '<tr><td><button type="button" class="link-btn" data-customer="' + c.id + '">' + esc(c.name) + "</button></td><td>" + esc(c.phone) + "</td><td>" + esc(c.type) + "</td><td>" + esc(c.area) +
          '</td><td class="num">' + s.count + '</td><td class="num">' + money(s.spent) + '</td><td class="num">' + (s.owed ? '<span class="warn">' + money(s.owed) + "</span>" : "—") + "</td><td>" + (s.last ? fmtDate(s.last) : "—") + "</td></tr>"; }).join("") + "</tbody></table>"
      : empty(db.customers.length ? "No customers match" : "No customers yet", db.customers.length ? "Try a different name or number." : "Add customers here or while recording a sale.", db.customers.length ? "" : '<button type="button" class="btn btn-main" data-new-customer>Add customer</button>');
  }
  view.addEventListener("input", function (e) { if (e.target.matches("[data-cust-q]")) { state.custQ = e.target.value; drawCustomers(); } });

  function editCustomer(id, then) {
    var c = id ? customer(id) : { name: "", phone: "", email: "", type: "Individual", area: "", birthday: "", scents: "", notes: "" };
    openModal(id ? "Edit customer" : "Add customer",
      '<div class="grid2">' +
      field("Name", "name", c.name, { required: true, placeholder: "Person or business name" }) +
      field("Phone / WhatsApp", "phone", c.phone, { type: "tel", placeholder: "e.g. 0712 345 678" }) +
      selectField("Type", "type", ["Individual", "Business", "Hotel", "Restaurant", "Office", "Event planner", "Reseller"], c.type) +
      field("Area or address", "area", c.area, { placeholder: "e.g. Masaki" }) +
      field("Email", "email", c.email, { type: "email" }) +
      field("Birthday or anniversary", "birthday", c.birthday, { type: "date", help: "Optional. Handy for gift reminders." }) +
      "</div>" +
      field("Favourite scents", "scents", c.scents, { placeholder: "e.g. Rose Oud, Neroli" }) +
      field("Notes", "notes", c.notes, { textarea: true, placeholder: "Delivery details, machine installed, preferences…" }),
      { submit: id ? "Save changes" : "Add customer", wide: true, onSubmit: function (d) {
        if (!d.name) return "Enter the customer's name.";
        var digits = d.phone.replace(/\D/g, "");
        if (d.phone && digits.length < 9) return "That phone number looks too short.";
        var dupe = digits && db.customers.some(function (x) { return x.id !== id && x.phone && x.phone.replace(/\D/g, "").slice(-9) === digits.slice(-9); });
        if (dupe) return "A customer with this phone number already exists. Search for them instead.";
        var target = id ? c : { id: uid("c"), created: new Date().toISOString() };
        ["name", "phone", "email", "type", "area", "birthday", "scents", "notes"].forEach(function (k) { target[k] = d[k]; });
        if (!id) db.customers.push(target);
        save(); toast(id ? "Customer saved" : "Customer added");
        if (then) then(target); else rerender();
      } });
  }
  function showCustomer(id) {
    var c = customer(id), s = custStats(id);
    var sales = db.sales.filter(function (x) { return x.customerId === id; }).slice().reverse();
    var phone = c.phone ? c.phone.replace(/\D/g, "").replace(/^0/, "255") : "";
    openModal(c.name,
      '<div class="kpis small">' + kpi("Spent", money(s.spent), plural(s.count, "purchase")) + kpi("Owes", money(s.owed), s.owed ? "Unpaid balance" : "Nothing owed") + kpi("Last bought", s.last ? fmtDate(s.last) : "—", "") + "</div>" +
      '<dl class="facts">' + [["Phone", c.phone], ["Type", c.type], ["Area", c.area], ["Email", c.email], ["Birthday", c.birthday ? fmtDate(c.birthday) : ""], ["Favourite scents", c.scents], ["Notes", c.notes]]
        .filter(function (f) { return f[1]; }).map(function (f) { return "<div><dt>" + f[0] + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") + "</dl>" +
      "<h3 class=\"mt\">Purchases</h3>" + (sales.length ? '<ul class="list">' + sales.map(saleRow).join("") + "</ul>" : "<p class=\"muted\">No purchases yet.</p>"),
      { cancel: "Close", wide: true, noFocus: true,
        extra: '<button type="button" class="btn" data-edit-c>Edit</button>' + (phone ? '<a class="btn" target="_blank" rel="noopener" href="https://wa.me/' + phone + '">WhatsApp</a><a class="btn" href="tel:' + esc(c.phone) + '">Call</a>' : "") + '<button type="button" class="btn btn-quiet danger-text" data-del-c>Delete</button>',
        after: function (body) {
          $("[data-edit-c]").onclick = function () { editCustomer(id); };
          $("[data-del-c]").onclick = function () {
            confirmBox("Delete " + c.name + "?", "Their past sales stay in the records but will show as “Walk-in customer”. This can't be undone.", "Delete customer", function () {
              db.sales.forEach(function (x) { if (x.customerId === id) x.customerId = ""; });
              db.customers = db.customers.filter(function (x) { return x.id !== id; }); save(); toast("Customer deleted"); rerender();
            }, true);
          };
          body.onclick = function (e) { var b = e.target.closest("[data-sale]"); if (b) showSale(b.dataset.sale); };
        } });
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-new-customer]") && !view.contains(e.target)) editCustomer(null);
  });

  /* ================= SUPPLIERS ================= */
  routes.suppliers = function () {
    view.innerHTML =
      '<div class="page-head with-action"><div><h1>Suppliers</h1><p class="sub">Who you buy oils, machines, bottles and packaging from.</p></div><button type="button" class="btn btn-main" data-new-sup>Add supplier</button></div>' +
      '<div class="filters"><input type="search" placeholder="Name, contact person or what they supply" data-sup-q value="' + esc(state.supQ) + '" aria-label="Filter suppliers"><button type="button" class="btn btn-small" data-export="suppliers">Download as spreadsheet</button></div>' +
      '<div class="panel table-wrap" data-sup-list></div>';
    drawSuppliers();
  };
  function drawSuppliers() {
    var q = lower(state.supQ);
    var list = db.suppliers.filter(function (s) { return !q || lower([s.name, s.contact, s.phone, s.email, s.supplies, s.country, s.notes].join(" ")).indexOf(q) > -1; });
    $("[data-sup-list]").innerHTML = list.length ?
      '<table class="tbl"><thead><tr><th>Supplier</th><th>Contact person</th><th>Phone</th><th>Supplies</th><th>Lead time</th><th class="num">Deliveries</th><th class="num">Bought</th></tr></thead><tbody>' +
      list.map(function (s) {
        var pu = db.purchases.filter(function (p) { return p.supplierId === s.id; });
        return '<tr><td><button type="button" class="link-btn" data-supplier="' + s.id + '">' + esc(s.name) + "</button>" + (s.country ? "<small>" + esc(s.country) + "</small>" : "") + "</td><td>" + esc(s.contact) + "</td><td>" + esc(s.phone) + "</td><td>" + esc(s.supplies) +
          "</td><td>" + esc(s.lead) + '</td><td class="num">' + pu.length + '</td><td class="num">' + money(pu.reduce(function (n, p) { return n + p.total; }, 0)) + "</td></tr>";
      }).join("") + "</tbody></table>"
      : empty(db.suppliers.length ? "No suppliers match" : "No suppliers yet", db.suppliers.length ? "Try a different word." : "Add the companies you buy stock and materials from.", db.suppliers.length ? "" : '<button type="button" class="btn btn-main" data-new-sup>Add supplier</button>');
  }
  view.addEventListener("input", function (e) { if (e.target.matches("[data-sup-q]")) { state.supQ = e.target.value; drawSuppliers(); } });
  view.addEventListener("click", function (e) { if (e.target.closest("[data-new-sup]")) editSupplier(null); });
  function editSupplier(id, then) {
    var s = id ? supplier(id) : { name: "", contact: "", phone: "", email: "", country: "", supplies: "", lead: "", terms: "", notes: "" };
    openModal(id ? "Edit supplier" : "Add supplier",
      '<div class="grid2">' +
      field("Company name", "name", s.name, { required: true }) + field("Contact person", "contact", s.contact) +
      field("Phone / WhatsApp", "phone", s.phone, { type: "tel" }) + field("Email", "email", s.email, { type: "email" }) +
      field("Country or city", "country", s.country, { placeholder: "e.g. Dar es Salaam, Dubai, China" }) + field("What they supply", "supplies", s.supplies, { placeholder: "e.g. fragrance oils, glass bottles" }) +
      field("Delivery time", "lead", s.lead, { placeholder: "e.g. 2 weeks" }) + field("Payment terms", "terms", s.terms, { placeholder: "e.g. 50% upfront" }) +
      "</div>" + field("Notes", "notes", s.notes, { textarea: true }),
      { submit: id ? "Save changes" : "Add supplier", wide: true, onSubmit: function (d) {
        if (!d.name) return "Enter the supplier's name.";
        var target = id ? s : { id: uid("su") };
        ["name", "contact", "phone", "email", "country", "supplies", "lead", "terms", "notes"].forEach(function (k) { target[k] = d[k]; });
        if (!id) db.suppliers.push(target);
        save(); toast(id ? "Supplier saved" : "Supplier added");
        if (then) then(target); else rerender();
      } });
  }
  function showSupplier(id) {
    var s = supplier(id);
    var pu = db.purchases.filter(function (p) { return p.supplierId === id; }).slice().reverse();
    var prods = db.products.filter(function (p) { return p.supplierId === id; });
    openModal(s.name,
      '<dl class="facts">' + [["Contact", s.contact], ["Phone", s.phone], ["Email", s.email], ["Location", s.country], ["Supplies", s.supplies], ["Delivery time", s.lead], ["Payment terms", s.terms], ["Notes", s.notes]]
        .filter(function (f) { return f[1]; }).map(function (f) { return "<div><dt>" + f[0] + "</dt><dd>" + esc(f[1]) + "</dd></div>"; }).join("") + "</dl>" +
      (prods.length ? '<h3 class="mt">Products from this supplier</h3><p>' + prods.map(function (p) { return esc(pname(p)) + " (" + p.stock + ")"; }).join(", ") + "</p>" : "") +
      '<h3 class="mt">Deliveries</h3>' + (pu.length ? '<ul class="list">' + pu.map(function (p) { return '<li><div class="row-static"><span><b>' + fmtDate(p.date) + "</b><small>" + p.items.map(function (i) { return i.qty + " × " + esc(i.name); }).join(", ") + "</small></span><span class=\"right\"><b>" + money(p.total) + "</b></span></div></li>"; }).join("") + "</ul>" : '<p class="muted">No deliveries recorded yet.</p>'),
      { cancel: "Close", wide: true, noFocus: true,
        extra: '<button type="button" class="btn" data-edit-s>Edit</button>' + (s.phone ? '<a class="btn" href="tel:' + esc(s.phone) + '">Call</a>' : "") + '<button type="button" class="btn btn-quiet danger-text" data-del-s>Delete</button>',
        after: function () {
          $("[data-edit-s]").onclick = function () { editSupplier(id); };
          $("[data-del-s]").onclick = function () {
            confirmBox("Delete " + s.name + "?", "Past deliveries stay in the records without a supplier name. This can't be undone.", "Delete supplier", function () {
              db.purchases.forEach(function (p) { if (p.supplierId === id) p.supplierId = ""; });
              db.products.forEach(function (p) { if (p.supplierId === id) p.supplierId = ""; });
              db.suppliers = db.suppliers.filter(function (x) { return x.id !== id; }); save(); toast("Supplier deleted"); rerender();
            }, true);
          };
        } });
  }

  /* ================= REPORTS ================= */
  function periodRange(p) {
    var d = new Date(), y = d.getFullYear(), m = d.getMonth();
    var iso = function (x) { return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
    if (p === "today") return [iso(d), iso(d)];
    if (p === "week") { var s = new Date(d); s.setDate(d.getDate() - 6); return [iso(s), iso(d)]; }
    if (p === "month") return [iso(new Date(y, m, 1)), iso(d)];
    if (p === "lastmonth") return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    if (p === "year") return [iso(new Date(y, 0, 1)), iso(d)];
    return ["0000-00-00", "9999-99-99"];
  }
  routes.reports = function () {
    var periods = [["today", "Today"], ["week", "Last 7 days"], ["month", "This month"], ["lastmonth", "Last month"], ["year", "This year"], ["all", "All time"]];
    var r = periodRange(state.period);
    var sales = liveSales().filter(function (s) { var d = s.date.slice(0, 10); return d >= r[0] && d <= r[1]; });
    var revenue = 0, paid = 0, items = 0, cogs = 0, costKnown = true;
    var byProd = {}, byPay = {}, byChan = {}, byCat = {}, byDay = {};
    sales.forEach(function (s) {
      revenue += s.total; paid += s.paid;
      var share = s.subtotal ? s.total / s.subtotal : 1;
      s.items.forEach(function (i) {
        items += i.qty;
        if (!i.cost) costKnown = false; cogs += i.qty * (i.cost || 0);
        var k = i.name; byProd[k] = byProd[k] || { qty: 0, amt: 0 }; byProd[k].qty += i.qty; byProd[k].amt += i.qty * i.price * share;
        var p = product(i.productId), cat = p ? p.category : "Other"; byCat[cat] = (byCat[cat] || 0) + i.qty * i.price * share;
      });
      byPay[s.payment] = (byPay[s.payment] || 0) + s.total;
      byChan[s.channel] = (byChan[s.channel] || 0) + s.total;
      var day = s.date.slice(0, 10); byDay[day] = (byDay[day] || 0) + s.total;
    });
    var bars = function (obj, fmt) {
      var rows = Object.keys(obj).map(function (k) { return [k, obj[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
      var max = rows.length ? rows[0][1] : 1;
      return rows.length ? '<ul class="bars">' + rows.slice(0, 10).map(function (r) { return '<li><span class="bl">' + esc(r[0]) + '</span><span class="bt"><i style="width:' + Math.max(2, r[1] / max * 100) + '%"></i></span><b>' + (fmt ? fmt(r[1]) : money(r[1])) + "</b></li>"; }).join("") + "</ul>" : '<p class="muted">No sales in this period.</p>';
    };
    var top = {}; Object.keys(byProd).forEach(function (k) { top[k] = byProd[k].qty; });
    var stockRetail = 0, stockCost = 0; db.products.forEach(function (p) { if (p.stock > 0) { stockRetail += p.stock * p.price; stockCost += p.stock * p.cost; } });
    var days = Object.keys(byDay).sort();
    var dayMax = Math.max.apply(null, days.map(function (d) { return byDay[d]; }).concat([1]));

    view.innerHTML =
      '<div class="page-head with-action"><div><h1>Reports</h1><p class="sub">' + (state.period === "all" ? "All time" : fmtDate(r[0]) + " to " + fmtDate(r[1])) + ". Voided sales are left out.</p></div>" +
      '<button type="button" class="btn" data-print-report>Print</button></div>' +
      '<div class="seg period" role="radiogroup" aria-label="Period">' + periods.map(function (p) { return '<label><input type="radio" name="period" value="' + p[0] + '"' + (p[0] === state.period ? " checked" : "") + " data-period><span>" + p[1] + "</span></label>"; }).join("") + "</div>" +
      '<div class="kpis">' +
        kpi("Sales", money(revenue), plural(sales.length, "sale") + (sales.length ? ", average " + money(revenue / sales.length) : "")) +
        kpi("Money received", money(paid), revenue - paid > 0 ? money(revenue - paid) + " still owed" : "Nothing owed") +
        kpi("Items sold", String(items), Object.keys(byProd).length + " different products") +
        kpi("Gross profit", cogs ? money(revenue - cogs) : "—", cogs ? (costKnown ? "Sales minus cost of goods" : "Some products have no cost price") : "Add cost prices to see profit") +
      "</div>" +
      (days.length > 1 ? '<section class="panel"><div class="panel-head"><h2>Sales by day</h2></div><div class="daychart" role="img" aria-label="Sales by day">' +
        days.map(function (d) { return '<div class="day" title="' + fmtDate(d) + ": " + money(byDay[d]) + '"><i style="height:' + Math.max(2, byDay[d] / dayMax * 100) + '%"></i></div>'; }).join("") +
        '</div><div class="daylabels"><span>' + fmtDate(days[0]) + "</span><span>" + fmtDate(days[days.length - 1]) + "</span></div></section>" : "") +
      '<div class="cols">' +
        '<section class="panel"><div class="panel-head"><h2>Best sellers (units)</h2></div>' + bars(top, function (v) { return v + " sold"; }) + "</section>" +
        '<section class="panel"><div class="panel-head"><h2>Sales by category</h2></div>' + bars(byCat) + "</section>" +
        '<section class="panel"><div class="panel-head"><h2>How customers paid</h2></div>' + bars(byPay) + "</section>" +
        '<section class="panel"><div class="panel-head"><h2>Where sales came from</h2></div>' + bars(byChan) + "</section>" +
      "</div>" +
      '<section class="panel"><div class="panel-head"><h2>Stock on hand today</h2></div><p>Worth <b>' + money(stockRetail) + "</b> at selling price" + (stockCost ? " and <b>" + money(stockCost) + "</b> at cost" : "") + ". " +
        plural(db.products.filter(isLow).length, "product") + ' at or below the reorder level. <a href="#/stock/low">See them</a>.</p></section>';
  };
  view.addEventListener("change", function (e) { if (e.target.matches("[data-period]")) { state.period = e.target.value; routes.reports(); } });
  view.addEventListener("click", function (e) { if (e.target.closest("[data-print-report]")) { $("#print-area").innerHTML = '<div class="print-report">' + view.innerHTML + "</div>"; window.print(); } });

  /* ================= SETTINGS & BACKUP ================= */
  routes.settings = function () {
    var last = db.settings.lastBackup;
    view.innerHTML =
      '<div class="page-head"><h1>Backup &amp; settings</h1><p class="sub">Your records are saved in this browser on this device. If the browser data is cleared or the device is lost, the records go with it — so download a backup regularly.</p></div>' +
      '<div class="cols">' +
      '<section class="panel"><div class="panel-head"><h2>Backup</h2></div>' +
        "<p>" + (last ? "Last backup downloaded on <b>" + fmtDate(last) + "</b>." : "<b>You haven't downloaded a backup yet.</b>") + "</p>" +
        '<div class="stack"><button type="button" class="btn btn-main" data-backup>Download backup file</button>' +
        '<label class="btn file-btn">Restore from a backup file<input type="file" accept=".json,application/json" data-restore hidden></label></div>' +
        '<p class="muted">To use the same records on another computer or phone, download a backup here and restore it there.</p></section>' +
      '<section class="panel"><div class="panel-head"><h2>Spreadsheets</h2></div><p>Open these in Excel or Google Sheets.</p><div class="stack">' +
        '<button type="button" class="btn" data-export="products">Stock list</button><button type="button" class="btn" data-export="sales">Sales</button><button type="button" class="btn" data-export="saleitems">Sales by product line</button>' +
        '<button type="button" class="btn" data-export="customers">Customers</button><button type="button" class="btn" data-export="suppliers">Suppliers</button><button type="button" class="btn" data-export="movements">Stock movements</button></div></section>' +
      '<section class="panel"><div class="panel-head"><h2>Receipt details</h2></div><form data-settings class="stack">' +
        field("Business name", "business", db.settings.business) + field("Address", "address", db.settings.address) + field("Phone", "phone", db.settings.phone) +
        '<button type="submit" class="btn btn-main">Save receipt details</button></form></section>' +
      '<section class="panel"><div class="panel-head"><h2>Practice and reset</h2></div>' +
        "<p>Training someone new? Load sample customers, suppliers and three months of sales to practise on. It replaces what's here, so download a backup first.</p>" +
        '<div class="stack"><button type="button" class="btn" data-demo>Load practice data</button><button type="button" class="btn btn-quiet danger-text" data-reset>Start fresh with the YOLA product list</button></div></section>' +
      "</div>";
  };
  view.addEventListener("submit", function (e) {
    if (e.target.matches("[data-settings]")) {
      e.preventDefault(); var d = formData(e.target);
      db.settings.business = d.business; db.settings.address = d.address; db.settings.phone = d.phone; save(); toast("Receipt details saved");
    }
  });
  view.addEventListener("click", function (e) {
    if (e.target.closest("[data-backup]")) {
      db.settings.lastBackup = new Date().toISOString(); save();
      download("yola-inventory-backup-" + today() + ".json", JSON.stringify(db, null, 1), "application/json");
      toast("Backup downloaded"); routes.settings();
    }
    if (e.target.closest("[data-demo]")) confirmBox("Load practice data?", "This replaces all products, sales, customers and suppliers on this device with sample data.", "Load practice data", function () { db = demoData(); save(); toast("Practice data loaded"); location.hash = "#/home"; rerender(); }, true);
    if (e.target.closest("[data-reset]")) confirmBox("Start fresh?", "This deletes every sale, customer, supplier and stock count on this device and restores the YOLA product list with zero stock. Download a backup first if you might need the records.", "Delete everything and start fresh", function () { db = fresh(); save(); toast("Started fresh"); location.hash = "#/home"; rerender(); }, true);
  });
  view.addEventListener("change", function (e) {
    if (!e.target.matches("[data-restore]")) return;
    var f = e.target.files[0]; if (!f) return;
    var rd = new FileReader();
    rd.onload = function () {
      try {
        var d = JSON.parse(rd.result);
        if (!d || !Array.isArray(d.products) || !Array.isArray(d.sales)) throw new Error("shape");
        confirmBox("Restore this backup?", "It has " + plural(d.products.length, "product") + ", " + plural(d.sales.length, "sale") + " and " + plural((d.customers || []).length, "customer") + ". It replaces everything on this device.", "Restore backup", function () {
          ["customers", "suppliers", "purchases", "movements"].forEach(function (k) { if (!Array.isArray(d[k])) d[k] = []; });
          d.settings = d.settings || fresh().settings; db = d; save(); toast("Backup restored"); location.hash = "#/home"; rerender();
        }, true);
      } catch (err) { toast("That file isn't a YOLA inventory backup. Choose a file ending in .json downloaded from this page.", true); }
    };
    rd.readAsText(f); e.target.value = "";
  });

  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportCSV(kind) {
    var rows;
    if (kind === "products") rows = [["Code", "Product", "Size", "Scent", "Category", "Price", "Cost", "Stock", "Reorder at", "Supplier", "Active", "Notes"]].concat(db.products.map(function (p) { return [p.sku, p.name, p.size, p.scent, p.category, p.price, p.cost, p.stock, p.reorder, (supplier(p.supplierId) || {}).name || "", p.active ? "Yes" : "No", p.notes]; }));
    if (kind === "sales") rows = [["Sale no", "Date", "Time", "Customer", "Phone", "Items", "Subtotal", "Discount", "Total", "Paid", "Balance", "Payment", "Channel", "Staff", "Voided", "Note"]].concat(db.sales.map(function (s) { var c = customer(s.customerId) || {}; return [s.no, s.date.slice(0, 10), fmtTime(s.date), c.name || "Walk-in", c.phone || "", s.items.map(function (i) { return i.qty + " x " + i.name; }).join("; "), s.subtotal, s.discount, s.total, s.paid, s.void ? 0 : balance(s), s.payment, s.channel, s.by, s.void ? "Yes" : "", s.note]; }));
    if (kind === "saleitems") { rows = [["Sale no", "Date", "Product", "Qty", "Price each", "Line total", "Cost each", "Customer", "Voided"]]; db.sales.forEach(function (s) { var c = customer(s.customerId) || {}; s.items.forEach(function (i) { rows.push([s.no, s.date.slice(0, 10), i.name, i.qty, i.price, i.qty * i.price, i.cost || "", c.name || "Walk-in", s.void ? "Yes" : ""]); }); }); }
    if (kind === "customers") rows = [["Name", "Phone", "Email", "Type", "Area", "Birthday", "Favourite scents", "Purchases", "Spent", "Owes", "Notes"]].concat(db.customers.map(function (c) { var s = custStats(c.id); return [c.name, c.phone, c.email, c.type, c.area, c.birthday, c.scents, s.count, s.spent, s.owed, c.notes]; }));
    if (kind === "suppliers") rows = [["Name", "Contact", "Phone", "Email", "Location", "Supplies", "Delivery time", "Payment terms", "Notes"]].concat(db.suppliers.map(function (s) { return [s.name, s.contact, s.phone, s.email, s.country, s.supplies, s.lead, s.terms, s.notes]; }));
    if (kind === "movements") rows = [["Date", "Time", "Product", "Change", "Stock after", "Type", "Reference", "Reason", "Staff"]].concat(db.movements.map(function (m) { return [m.date.slice(0, 10), fmtTime(m.date), pname(product(m.productId)), m.qty, m.after, m.type, m.ref, m.reason, m.by]; }));
    var csv = rows.map(function (r) { return r.map(function (v) { v = v == null ? "" : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\r\n");
    download("yola-" + kind + "-" + today() + ".csv", "﻿" + csv, "text/csv");
    toast("Spreadsheet downloaded");
  }

  /* ================= global search ================= */
  var sInput = $("[data-search]"), sBox = $("[data-search-results]");
  function runSearch() {
    var q = lower(sInput.value.trim());
    if (q.length < 2) { sBox.hidden = true; return; }
    var hits = [];
    db.products.forEach(function (p) { if (lower(pname(p) + " " + p.sku + " " + p.category).indexOf(q) > -1) hits.push({ g: "Products", t: pname(p), s: p.stock + " in stock · " + (p.price ? money(p.price) : "no price"), a: function () { adjustStock(p.id); } }); });
    db.customers.forEach(function (c) { if (lower([c.name, c.phone, c.email, c.area, c.scents].join(" ")).indexOf(q) > -1) hits.push({ g: "Customers", t: c.name, s: c.phone || c.area || "", a: function () { showCustomer(c.id); } }); });
    db.suppliers.forEach(function (s) { if (lower([s.name, s.contact, s.phone, s.supplies].join(" ")).indexOf(q) > -1) hits.push({ g: "Suppliers", t: s.name, s: s.supplies || s.phone || "", a: function () { showSupplier(s.id); } }); });
    var qn = q.replace(/^#/, "");
    db.sales.slice().reverse().forEach(function (s) {
      var c = customer(s.customerId);
      if (String(s.no) === qn || (c && lower(c.name).indexOf(q) > -1 && hits.filter(function (h) { return h.g === "Sales"; }).length < 5))
        hits.push({ g: "Sales", t: "Sale #" + s.no + " — " + (c ? c.name : "Walk-in"), s: fmtDate(s.date) + " · " + money(s.total) + (s.void ? " · voided" : ""), a: function () { showSale(s.id); } });
    });
    var groups = {}; hits.forEach(function (h) { (groups[h.g] = groups[h.g] || []).push(h); });
    var flat = [];
    sBox.innerHTML = hits.length ? Object.keys(groups).map(function (g) {
      return '<div class="sg"><h4>' + g + "</h4>" + groups[g].slice(0, 6).map(function (h) { flat.push(h); return '<button type="button" data-hit="' + (flat.length - 1) + '"><b>' + esc(h.t) + "</b><small>" + esc(h.s) + "</small></button>"; }).join("") + "</div>";
    }).join("") : '<p class="none">Nothing found for “' + esc(sInput.value) + "”.</p>";
    sBox._hits = flat; sBox.hidden = false;
  }
  sInput.addEventListener("input", runSearch);
  sInput.addEventListener("focus", runSearch);
  sInput.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { sBox.hidden = true; sInput.blur(); }
    if (e.key === "Enter" && sBox._hits && sBox._hits.length) { e.preventDefault(); var hit = sBox._hits[0]; sBox.hidden = true; sInput.blur(); setTimeout(hit.a, 0); }
    if (e.key === "ArrowDown") { var b = $("button", sBox); if (b) { e.preventDefault(); b.focus(); } }
  });
  sBox.addEventListener("click", function (e) { var b = e.target.closest("[data-hit]"); if (b) { sBox._hits[+b.dataset.hit].a(); sBox.hidden = true; } });
  sBox.addEventListener("keydown", function (e) {
    var btns = $$("button", sBox), i = btns.indexOf(document.activeElement);
    if (e.key === "ArrowDown" && i < btns.length - 1) { e.preventDefault(); btns[i + 1].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? btns[i - 1] : sInput).focus(); }
    if (e.key === "Escape") { sBox.hidden = true; sInput.focus(); }
  });
  document.addEventListener("click", function (e) { if (!e.target.closest(".search")) sBox.hidden = true; });
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !modal.open) { e.preventDefault(); sInput.focus(); }
  });

  /* ================= staff name ================= */
  var staffInput = $("[data-staff]");
  staffInput.value = staff();
  staffInput.addEventListener("change", function () { try { localStorage.setItem("yola-staff", staffInput.value.trim()); } catch (e) {} if (location.hash === "#/home" || !location.hash) rerender(); });

  /* ================= practice data ================= */
  function demoData() {
    var d = fresh();
    var rnd = (function (seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; })(42);
    var pick = function (a) { return a[Math.floor(rnd() * a.length)]; };
    d.suppliers = [
      { id: uid("su"), name: "Aroma Oils Trading (sample)", contact: "Fatma", phone: "0700 000 001", email: "", country: "Dubai", supplies: "Fragrance oils", lead: "3 weeks", terms: "50% upfront", notes: "Practice data" },
      { id: uid("su"), name: "Glassworks Supplies (sample)", contact: "Peter", phone: "0700 000 002", email: "", country: "Dar es Salaam", supplies: "Bottles, jars, reeds", lead: "1 week", terms: "Cash on delivery", notes: "Practice data" },
      { id: uid("su"), name: "ScentTech Machines (sample)", contact: "Lin", phone: "0700 000 003", email: "", country: "China", supplies: "Scent machines, mini machines", lead: "6 weeks", terms: "Full payment upfront", notes: "Practice data" }
    ];
    var names = ["Amina Juma", "Neema Mushi", "Baraka Mollel", "Rehema Said", "Joseph Mrema", "Zawadi Kimaro", "Halima Omari", "Grace Lyimo", "Hotel Example Ltd", "Office Example Co"];
    d.customers = names.map(function (n, i) { return { id: uid("c"), name: n + " (sample)", phone: "07" + String(10000000 + i * 1234567).slice(0, 8), email: "", type: i >= 8 ? (i === 8 ? "Hotel" : "Office") : "Individual", area: pick(["Masaki", "Mikocheni", "Oysterbay", "Mbezi", "Kinondoni", "Upanga"]), birthday: "", scents: pick(window.YOLA.scents), notes: "Practice data", created: new Date().toISOString() }; });
    var supFor = function (p) { return p.category === "Fragrance oils" ? d.suppliers[0].id : /machine/i.test(p.category) ? d.suppliers[2].id : d.suppliers[1].id; };
    d.products.forEach(function (p) {
      p.price = p.price || (p.category === "Mini machines" ? 180000 : p.category === "Gift sets" ? 190000 : p.category === "Accessories" ? 25000 : 140000);
      p.cost = Math.round(p.price * (0.35 + rnd() * 0.15) / 1000) * 1000; p.supplierId = supFor(p);
    });
    var start = new Date(); start.setDate(start.getDate() - 90);
    var addMove = function (p, q, type, ref, date) { p.stock += q; d.movements.push({ id: uid("m"), date: date, productId: p.id, qty: q, type: type, ref: ref, reason: "", by: "Practice", after: p.stock }); };
    d.products.forEach(function (p) {
      var q = p.category === "Scent machines" ? 4 : p.category === "Mini machines" ? 20 : 30;
      var pu = { id: uid("pu"), date: start.toISOString(), supplierId: p.supplierId, note: "Opening stock (practice)", by: "Practice", items: [{ productId: p.id, name: pname(p), qty: q, cost: p.cost }], total: q * p.cost };
      d.purchases.push(pu); addMove(p, q, "Received", "Opening stock", start.toISOString());
    });
    var popular = d.products.filter(function (p) { return /Candles|sprays|diffusers|Mini|oils/.test(p.category); });
    for (var day = 0; day < 90; day++) {
      var n = Math.floor(rnd() * 3);
      for (var k = 0; k < n; k++) {
        var dt = new Date(start); dt.setDate(start.getDate() + day); dt.setHours(10 + Math.floor(rnd() * 8), Math.floor(rnd() * 60));
        var p = rnd() < 0.08 ? pick(d.products) : pick(popular);
        if (p.stock < 2) continue;
        var q = 1 + (rnd() < 0.2 ? 1 : 0);
        var total = q * p.price;
        var owe = rnd() < 0.08;
        var s = { id: uid("s"), no: d.nextSaleNo++, date: dt.toISOString(), customerId: rnd() < 0.7 ? pick(d.customers).id : "", items: [{ productId: p.id, name: pname(p), qty: q, price: p.price, cost: p.cost }],
          subtotal: total, discount: 0, total: total, paid: owe ? Math.round(total / 2) : total, payment: pick(["Cash", "M-Pesa", "M-Pesa", "Mixx by Yas", "Airtel Money", "Bank transfer", "Card"]),
          channel: pick(["Showroom", "Showroom", "WhatsApp", "Instagram", "Phone call"]), note: "", by: "Practice", void: false };
        s.payments = [{ date: s.date, amount: s.paid, method: s.payment }];
        d.sales.push(s); addMove(p, -q, "Sale", "#" + s.no, s.date);
      }
    }
    // leave a few products low so the warnings show
    d.products.slice(0, 3).forEach(function (p) { var drop = Math.max(0, p.stock - 2); if (drop) { addMove(p, -drop, "Adjustment", "", new Date().toISOString()); d.movements[d.movements.length - 1].reason = "Stock count correction (practice)"; } });
    return d;
  }

  /* ================= start ================= */
  load();
  try { if (!localStorage.getItem(KEY)) save(); } catch (e) {}
  go();
})();
