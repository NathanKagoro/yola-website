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
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ask]");
    if (b) wa(b.getAttribute("data-ask"));
  });

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- nav turns solid after the hero ---------- */
  var nav = $("[data-nav]"), hero = $(".hero");
  function navState() { nav.classList.toggle("solid", window.scrollY > hero.offsetHeight - 80); }
  window.addEventListener("scroll", navState, { passive: true }); navState();

  /* ---------- ribbons ---------- */
  $$("[data-ribbon]").forEach(function (t) {
    var words = t.dataset.ribbon === "scents" ? Y.scents : ["YOLA"];
    var unit = "", i;
    for (i = 0; i < (words.length > 1 ? 2 : 14); i++) unit += words.map(function (w) { return "<span>" + esc(w) + "</span>"; }).join("");
    t.innerHTML = unit + unit; /* doubled for a seamless loop */
  });

  /* ---------- "now in the air" label ---------- */
  var air = $("[data-air]"), airI = 0;
  if (air && !reduce) setInterval(function () {
    airI = (airI + 1) % Y.scents.length;
    air.style.opacity = 0;
    setTimeout(function () { air.textContent = Y.scents[airI]; air.style.opacity = 1; }, 400);
  }, 3200);

  /* ---------- mist: scent made visible ---------- */
  (function mist() {
    var c = $("[data-mist]"); if (!c || !c.getContext) return;
    var ctx = c.getContext("2d"), w, h, dpr, parts = [], running = true, visible = true;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function spawn(initial) {
      var r = 60 + Math.random() * 160;
      return { x: w * (0.15 + Math.random() * 0.7), y: initial ? Math.random() * h : h + r, r: r,
        vy: 0.18 + Math.random() * 0.35, sway: Math.random() * Math.PI * 2, swaySpeed: 0.002 + Math.random() * 0.004,
        a: 0.035 + Math.random() * 0.05, warm: Math.random() < 0.35 };
    }
    size(); for (var i = 0; i < 26; i++) parts.push(spawn(true));
    window.addEventListener("resize", size);
    function draw() {
      ctx.clearRect(0, 0, w, h);
      parts.forEach(function (p, i) {
        p.y -= p.vy; p.sway += p.swaySpeed; p.r += 0.06;
        var x = p.x + Math.sin(p.sway) * 40;
        var fade = Math.min(1, p.y / (h * 0.5)) * Math.min(1, (h + p.r - p.y) / 200);
        var g = ctx.createRadialGradient(x, p.y, 0, x, p.y, p.r);
        var col = p.warm ? "220,194,147" : "244,236,226";
        g.addColorStop(0, "rgba(" + col + "," + (p.a * fade) + ")"); g.addColorStop(1, "rgba(" + col + ",0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        if (p.y < -p.r) parts[i] = spawn(false);
      });
      if (running && visible) requestAnimationFrame(draw);
    }
    if (reduce) { running = false; draw(); return; }
    if ("IntersectionObserver" in window) new IntersectionObserver(function (en) {
      var was = visible; visible = en[0].isIntersecting; if (visible && !was) requestAnimationFrame(draw);
    }).observe(c);
    requestAnimationFrame(draw);
  })();

  /* ---------- scent wardrobe ---------- */
  var wardrobe = $("[data-wardrobe]"), tabs = $("[data-scent-tabs]"), panel = $("[data-scent-panel]");
  tabs.innerHTML = Y.scentProfiles.map(function (s, i) {
    return '<li role="presentation"><button type="button" role="tab" id="tab-' + i + '" aria-selected="' + (i === 0) + '" tabindex="' + (i === 0 ? 0 : -1) + '" data-scent-i="' + i + '">' +
      '<span class="nm"><i class="dot" style="--dot:' + s.bg + '"></i>' + esc(s.name) + "</span><small>" + esc(s.mood) + "</small></button></li>";
  }).join("");
  function pickScent(i, focus) {
    var s = Y.scentProfiles[i];
    wardrobe.style.setProperty("--bg", s.bg); wardrobe.style.setProperty("--fg", s.fg); wardrobe.style.setProperty("--accent", s.accent);
    $$("[data-scent-i]", tabs).forEach(function (b) { var on = +b.dataset.scentI === i; b.setAttribute("aria-selected", on); b.parentNode.classList.toggle("on", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    panel.setAttribute("aria-labelledby", "tab-" + i);
    panel.innerHTML = '<div class="scent-bottle"><div class="label"><span class="label-brand">YOLA</span><span class="label-kind">Organic home fragrance</span><span class="label-scent">' + esc(s.name) + "</span></div></div>" +
      "<h3>" + esc(s.name) + '</h3><p class="mood">' + esc(s.mood) + '</p><p class="desc">' + esc(s.desc) + '</p><p class="rooms">Lovely in: ' + esc(s.rooms) + "</p>" +
      '<button type="button" class="btn" data-shop-scent="' + esc(s.name) + '">Shop ' + esc(s.name) + "</button>";
    panel.classList.remove("swap"); void panel.offsetWidth; panel.classList.add("swap");
  }
  /* Until someone touches it, the wardrobe plays through the scents by itself so the colour change is obvious. */
  var AUTO_MS = 3000, autoTimer = null, autoIdx = 0, userTook = false;
  var hintText = $("[data-hint-text]");
  wardrobe.style.setProperty("--auto-ms", AUTO_MS + "ms");
  function autoStep() {
    autoIdx = (autoIdx + 1) % Y.scentProfiles.length; pickScent(autoIdx);
    var li = tabs.children[autoIdx]; li.classList.remove("on"); void li.offsetWidth; li.classList.add("on");
  }
  function startAuto() {
    if (reduce || userTook || autoTimer) return;
    wardrobe.classList.add("auto"); hintText.textContent = "Playing through the scents. Tap one to choose.";
    var li = tabs.children[autoIdx]; li.classList.remove("on"); void li.offsetWidth; li.classList.add("on");
    autoTimer = setInterval(autoStep, AUTO_MS);
  }
  function stopAuto(byUser) {
    clearInterval(autoTimer); autoTimer = null; wardrobe.classList.remove("auto");
    if (byUser) { userTook = true; hintText.textContent = "Tap a scent and the room changes with it."; }
  }
  if ("IntersectionObserver" in window) new IntersectionObserver(function (en) {
    if (en[0].isIntersecting) startAuto(); else stopAuto(false);
  }, { threshold: 0.6 }).observe(tabs);
  tabs.addEventListener("click", function (e) { var b = e.target.closest("[data-scent-i]"); if (b) { stopAuto(true); pickScent(+b.dataset.scentI); } });
  tabs.addEventListener("mouseover", function (e) {
    var b = e.target.closest("[data-scent-i]");
    if (b && window.matchMedia("(hover: hover)").matches) { stopAuto(true); if (b.getAttribute("aria-selected") !== "true") pickScent(+b.dataset.scentI); }
  });
  tabs.addEventListener("focusin", function () { stopAuto(true); });
  tabs.addEventListener("keydown", function (e) {
    var cur = +document.activeElement.dataset.scentI, n = Y.scentProfiles.length;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); pickScent((cur + 1) % n, true); }
    if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); pickScent((cur - 1 + n) % n, true); }
  });
  pickScent(0);
  panel.addEventListener("click", function (e) {
    var b = e.target.closest("[data-shop-scent]"); if (!b) return;
    var name = b.dataset.shopScent;
    $$("[data-scent]").forEach(function (sel) { sel.value = name; });
    $$(".product").forEach(function (c) { refreshCard(c); if ($("[data-scent]", c)) { c.classList.add("flash"); setTimeout(function () { c.classList.remove("flash"); }, 1600); } });
    $("#collection").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    toast(name + " selected on every scented product");
  });

  /* ---------- mini machine finishes ---------- */
  var mini = $("[data-mini]"), sw = $("[data-swatches]"), miniColour = "Rose pink";
  function pickFinish(btn) {
    $$("button", sw).forEach(function (b) { b.setAttribute("aria-checked", b === btn); b.tabIndex = b === btn ? 0 : -1; });
    miniColour = btn.dataset.colour;
    mini.style.setProperty("--halo", getComputedStyle(btn).getPropertyValue("--sw"));
    var frame = $("[data-mini-frame]"), cur = $("img:last-child", frame);
    if (btn.dataset.img && cur.getAttribute("src") !== btn.dataset.img) {
      var next = new Image(); next.className = "incoming"; next.alt = "A YOLA mini scent machine in " + miniColour.toLowerCase() + ", misting inside a car";
      next.onload = function () {
        frame.appendChild(next); void next.offsetWidth; next.classList.remove("incoming");
        setTimeout(function () { $$("img", frame).forEach(function (im) { if (im !== next) im.remove(); }); }, 600);
      };
      next.src = btn.dataset.img;
    }
    $("[data-swatch-name]").textContent = miniColour;
    $("[data-ask-mini]").textContent = "Ask if " + miniColour.toLowerCase() + " is in stock";
  }
  sw.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) pickFinish(b); });
  sw.addEventListener("keydown", function (e) {
    var bs = $$("button", sw), i = bs.indexOf(document.activeElement);
    if (i < 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); var nb = bs[(i + 1) % bs.length]; pickFinish(nb); nb.focus(); }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); var pb = bs[(i - 1 + bs.length) % bs.length]; pickFinish(pb); pb.focus(); }
  });
  $$("button", sw).forEach(function (b) { b.tabIndex = b.getAttribute("aria-checked") === "true" ? 0 : -1; });
  if ("IntersectionObserver" in window) {
    var pre = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { $$("[data-img]", sw).forEach(function (b) { new Image().src = b.dataset.img; }); pre.disconnect(); }
    }, { rootMargin: "400px" });
    pre.observe(mini);
  }
  $("[data-ask-mini]").addEventListener("click", function () { wa("Hello YOLA, is the waterless mini machine in " + miniColour.toLowerCase() + " in stock? What's the price?"); });

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
      '<div class="product-img"><div class="frame"><img src="' + p.img + '" alt="' + esc(p.alt) + '" loading="lazy"></div>' +
      '<div class="label" aria-hidden="true"><span class="label-brand">YOLA</span><span class="label-scent">' + esc(p.tag) + "</span></div></div>" +
      '<p class="cat">' + esc(p.category) + "</p><h3>" + esc(p.name) + '</h3><p class="blurb">' + esc(p.blurb) + "</p>" +
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
