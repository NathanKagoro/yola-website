(function () {
  "use strict";
  var Y = window.YOLA;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  function wa(text) {
    window.open("https://wa.me/" + Y.whatsapp + "?text=" + encodeURIComponent(text), "_blank", "noopener");
  }

  /* ---------- static links ---------- */
  $$("[data-map]").forEach(function (a) { a.href = Y.mapUrl; });
  $$("[data-tel]").forEach(function (a) { a.href = "tel:" + Y.phoneIntl; });
  $$("[data-ig]").forEach(function (a) { a.href = Y.instagram; });
  $$("[data-year]").forEach(function (e) { e.textContent = new Date().getFullYear(); });
  $$(".swatches li").forEach(function (li) { li.title = li.textContent; });
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ask]");
    if (b) wa(b.getAttribute("data-ask"));
  });

  /* ---------- scent library ---------- */
  $("[data-scent-list]").innerHTML = Y.scents.map(function (s) { return "<li>" + esc(s) + "</li>"; }).join("");

  /* ---------- products ---------- */
  var grid = $("[data-products]");
  grid.innerHTML = Y.products.map(function (p) {
    var sizes = p.sizes.map(function (s, i) {
      return '<label class="chip"><input type="radio" name="size-' + p.id + '" value="' + i + '"' + (i === 0 ? " checked" : "") + '><span>' + esc(s.label) + "</span></label>";
    }).join("");
    var scent = p.scented ? '<label class="field-label" for="scent-' + p.id + '">Scent</label><select class="select" id="scent-' + p.id + '" data-scent>' +
      '<option value="">Help me choose</option>' + Y.scents.map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("") + "</select>" : "";
    var colour = p.colours ? '<label class="field-label" for="colour-' + p.id + '">Finish</label><select class="select" id="colour-' + p.id + '" data-colour>' +
      p.colours.map(function (c) { return "<option>" + esc(c) + "</option>"; }).join("") + "</select>" : "";
    return '<article class="product" data-id="' + p.id + '">' +
      '<div class="product-img"><img src="' + p.img + '" alt="' + esc(p.alt) + '" loading="lazy">' +
      '<div class="label" aria-hidden="true"><span class="label-brand">YOLA</span><span class="label-scent">' + esc(p.tag) + "</span></div></div>" +
      "<h3>" + esc(p.name) + '</h3><p class="cat">' + esc(p.category) + '</p><p class="blurb">' + esc(p.blurb) + "</p>" +
      (p.sizes.length > 1 ? '<fieldset class="sizes"><legend>Size</legend>' + sizes + "</fieldset>" : "") +
      scent + colour +
      '<div class="buy"><span class="price" data-price></span><div class="buy-actions" data-actions></div></div></article>';
  }).join("");

  function selection(card) {
    var p = Y.products.filter(function (x) { return x.id === card.dataset.id; })[0];
    var r = $("input[type=radio]:checked", card);
    var size = p.sizes[r ? +r.value : 0];
    var scent = $("[data-scent]", card); var colour = $("[data-colour]", card);
    return { p: p, size: size, scent: scent ? scent.value : "", colour: colour ? colour.value : "" };
  }
  function describe(sel) {
    var bits = [sel.p.name];
    if (sel.p.sizes.length > 1) bits.push(sel.size.label);
    if (sel.scent) bits.push(sel.scent);
    if (sel.colour) bits.push(sel.colour);
    return bits.join(", ");
  }
  function refreshCard(card) {
    var sel = selection(card);
    var price = $("[data-price]", card), act = $("[data-actions]", card);
    if (sel.size.price) {
      price.textContent = tzs(sel.size.price); price.classList.remove("ask");
      act.innerHTML = '<button class="ask-link" type="button" data-q>Ask</button><button class="btn btn-dark" type="button" data-add>Add to bag</button>';
    } else {
      price.textContent = "Price on request"; price.classList.add("ask");
      act.innerHTML = '<button class="btn btn-line" type="button" data-q>Ask for price</button>';
    }
  }
  $$(".product", grid).forEach(refreshCard);
  grid.addEventListener("change", function (e) { var c = e.target.closest(".product"); if (c) refreshCard(c); });
  grid.addEventListener("click", function (e) {
    var card = e.target.closest(".product"); if (!card) return;
    var sel = selection(card);
    if (e.target.closest("[data-add]")) {
      addToBag({ key: sel.size.sku + "|" + sel.scent + "|" + sel.colour, name: sel.p.name, sku: sel.size.sku,
        detail: [sel.p.sizes.length > 1 ? sel.size.label : "", sel.scent || (sel.p.scented ? "Scent: help me choose" : ""), sel.colour].filter(Boolean).join(", "),
        price: sel.size.price, img: sel.p.img });
    } else if (e.target.closest("[data-q]")) {
      wa("Hello YOLA, I'm interested in the " + describe(sel) + ". " + (sel.size.price ? "Is it in stock?" : "What's the price and is it in stock?"));
    }
  });

  /* ---------- bag ---------- */
  var KEY = "yola-bag";
  var bag = [];
  try { bag = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch (e) { bag = []; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(bag)); } catch (e) {} }
  var drawer = $("[data-bag]"), scrim = $("[data-scrim]"), lastFocus = null;

  function toast(msg) {
    var t = $("[data-toast]"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }
  function addToBag(item) {
    var found = bag.filter(function (b) { return b.key === item.key; })[0];
    if (found) found.qty++; else { item.qty = 1; bag.push(item); }
    save(); renderBag(); toast("Added " + item.name + " to your bag");
  }
  function renderBag() {
    var count = bag.reduce(function (n, b) { return n + b.qty; }, 0);
    var c = $("[data-bag-count]"); c.textContent = count; c.dataset.empty = count === 0;
    var total = bag.reduce(function (n, b) { return n + b.qty * b.price; }, 0);
    $("[data-bag-total]").textContent = tzs(total);
    $("[data-bag-foot]").hidden = bag.length === 0;
    $("[data-bag-items]").innerHTML = bag.length ? bag.map(function (b, i) {
      return '<div class="bag-item"><img src="' + b.img + '" alt=""><div><h4>' + esc(b.name) + "</h4><p>" + esc(b.detail || "") + "</p>" +
        '<div class="qty"><button type="button" data-dec="' + i + '" aria-label="One fewer ' + esc(b.name) + '">−</button><span>' + b.qty +
        '</span><button type="button" data-inc="' + i + '" aria-label="One more ' + esc(b.name) + '">+</button></div></div>' +
        '<span class="line-total">' + tzs(b.qty * b.price) + "</span></div>";
    }).join("") : '<div class="bag-empty"><strong>Your bag is empty.</strong>Add a candle, spray or diffuser from the collection.</div>';
  }
  $("[data-bag-items]").addEventListener("click", function (e) {
    var inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]");
    if (inc) bag[+inc.dataset.inc].qty++;
    if (dec) { var i = +dec.dataset.dec; bag[i].qty--; if (bag[i].qty <= 0) bag.splice(i, 1); }
    if (inc || dec) { save(); renderBag(); }
  });
  function openBag() {
    lastFocus = document.activeElement; scrim.hidden = false; drawer.classList.add("open");
    drawer.setAttribute("aria-hidden", "false"); drawer.focus();
  }
  function closeBag() {
    drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); scrim.hidden = true;
    if (lastFocus) lastFocus.focus();
  }
  $$("[data-open-bag]").forEach(function (b) { b.addEventListener("click", openBag); });
  $("[data-close-bag]").addEventListener("click", closeBag);
  scrim.addEventListener("click", closeBag);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && drawer.classList.contains("open")) closeBag(); });
  $("[data-checkout]").addEventListener("click", function () {
    if (!bag.length) return;
    var name = $("[data-order-name]").value.trim(), area = $("[data-order-area]").value.trim();
    var lines = bag.map(function (b) { return "• " + b.qty + " × " + b.name + (b.detail ? " (" + b.detail + ")" : "") + " — " + tzs(b.qty * b.price); });
    var total = bag.reduce(function (n, b) { return n + b.qty * b.price; }, 0);
    wa("Hello YOLA, I'd like to place an order:\n" + lines.join("\n") + "\nTotal: " + tzs(total) +
      (name ? "\nName: " + name : "") + (area ? "\nDelivery / pickup: " + area : ""));
  });
  renderBag();

  /* ---------- coverage finder ---------- */
  var LO = Math.log(100), HI = Math.log(6000);
  var pos = function (v) { return Math.min(1, Math.max(0, (Math.log(Math.max(v, 1)) - LO) / (HI - LO))); };
  var cov = $("[data-machines]");
  cov.innerHTML = Y.machines.map(function (m) {
    var l = pos(m.min), r = pos(m.max);
    return '<div class="mrow" role="listitem" data-min="' + m.min + '" data-max="' + m.max + '">' +
      '<img src="' + m.img + '" alt="" loading="lazy">' +
      "<div><h4>" + esc(m.name) + '</h4><p class="spec">' + esc(m.install) + ", " + esc(m.oil) + " oil<br>" + esc(m.power) + ", " + esc(m.colours.toLowerCase()) + "</p></div>" +
      '<div class="track" aria-hidden="true"><div class="bar' + (r > .8 ? ' end' : '') + '" style="left:' + (l * 100).toFixed(2) + "%;width:" + ((r - l) * 100).toFixed(2) + '%"><span>' +
      m.min.toLocaleString() + "–" + m.max.toLocaleString() + " m³</span></div></div>" +
      '<div class="mrow-buy"><span class="price">' + tzs(m.price) + '</span><button class="btn btn-line" type="button" data-machine="' + m.id + '">Enquire</button></div></div>';
  }).join("");
  cov.addEventListener("click", function (e) {
    var b = e.target.closest("[data-machine]"); if (!b) return;
    var m = Y.machines.filter(function (x) { return x.id === b.dataset.machine; })[0];
    wa("Hello YOLA, I'm interested in the " + m.name + " (" + tzs(m.price) + ") for a space of about " + $("[data-volume]").textContent + " m³. Could you advise on installation and scents?");
  });

  var dims = { l: $('[data-dim="l"]'), w: $('[data-dim="w"]'), h: $('[data-dim="h"]') };
  function update() {
    var v = Math.round((+dims.l.value || 0) * (+dims.w.value || 0) * (+dims.h.value || 0));
    $("[data-volume]").textContent = v.toLocaleString();
    cov.style.setProperty("--you", pos(v).toFixed(4));
    var matches = 0;
    $$(".mrow", cov).forEach(function (row) {
      var ok = v >= +row.dataset.min && v <= +row.dataset.max;
      row.classList.toggle("match", ok); if (ok) matches++;
    });
    var t = $("[data-match-text]");
    if (v < 100) t.textContent = "Small space? The mini machine or a reed diffuser is the better fit.";
    else if (v > 6000) t.textContent = "Large venue: several machines work together. Book a site visit and we'll plan it.";
    else t.textContent = matches === 1 ? "1 machine fits this space" : matches + " machines fit this space";
  }
  Object.keys(dims).forEach(function (k) {
    dims[k].addEventListener("input", function () {
      $$(".presets button").forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      update();
    });
  });
  $$(".presets button").forEach(function (b) {
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", function () {
      var p = b.dataset.preset.split(",");
      dims.l.value = p[0]; dims.w.value = p[1]; dims.h.value = p[2];
      $$(".presets button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      update();
    });
  });
  update();

  /* ---------- contact form ---------- */
  var form = $("[data-contact]");
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("[data-form-error]");
    var name = form.name.value.trim(), msg = form.message.value.trim();
    if (!name || !msg) {
      err.textContent = !name ? "Add your name so we know who we're talking to." : "Write a short message so we can help.";
      err.hidden = false; (!name ? form.name : form.message).focus(); return;
    }
    err.hidden = true;
    wa("Hello YOLA, this is " + name + ".\nTopic: " + form.topic.value + "\n\n" + msg);
  });
})();
