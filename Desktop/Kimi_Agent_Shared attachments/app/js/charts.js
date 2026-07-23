/* ============================================================
   charts.js — رسوم بيانية SVG مبنية يدويًا (بدون مكتبات خارجية)
   ============================================================ */
window.App = window.App || {};

(function () {
  const tooltip = () => document.getElementById("chart-tooltip");

  function showTip(html, x, y) {
    const t = tooltip();
    t.innerHTML = html;
    t.hidden = false;
    t.style.left = x + "px";
    t.style.top = y + "px";
  }
  function hideTip() { tooltip().hidden = true; }

  /* ---------- منحنى ناعم (Catmull-Rom → Bezier) ---------- */
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6;
      const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
    }
    return d;
  }

  /* ============================================================
     مخطط مساحي (Area Chart) — طلبات آخر N يوم
     ============================================================ */
  function areaChart(container, data, { height = 240, color = "#0ea5e9", color2 = "#2563eb" } = {}) {
    const W = 720, H = height, padL = 34, padR = 14, padT = 18, padB = 30;
    const max = Math.max(...data.map((d) => d.value), 4);
    const iw = W - padL - padR, ih = H - padT - padB;
    const stepX = iw / (data.length - 1 || 1);

    const pts = data.map((d, i) => [
      +(padL + i * stepX).toFixed(2),
      +(padT + ih - (d.value / max) * ih).toFixed(2),
    ]);

    const line = smoothPath(pts);
    const area = `${line} L ${pts[pts.length - 1][0]} ${padT + ih} L ${pts[0][0]} ${padT + ih} Z`;
    const gid = "g" + Math.random().toString(36).slice(2, 8);

    /* خطوط الشبكة الأفقية */
    let grid = "", labels = "";
    for (let g = 0; g <= 4; g++) {
      const y = padT + (ih / 4) * g;
      const val = Math.round(max - (max / 4) * g);
      grid += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e3edf7" stroke-width="1" stroke-dasharray="${g === 4 ? "0" : "4 5"}"/>
               <text x="${padL - 8}" y="${y + 4}" text-anchor="end" font-size="10.5" fill="#9db4c8" font-weight="700">${val}</text>`;
    }
    /* تسميات المحور السيني (كل نقطة ثانية) */
    data.forEach((d, i) => {
      if (data.length > 8 && i % 2 !== 0 && i !== data.length - 1) return;
      labels += `<text x="${pts[i][0]}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="#9db4c8" font-weight="700">${d.label}</text>`;
    });

    const dots = pts.map((p, i) => `
      <circle class="ac-dot" cx="${p[0]}" cy="${p[1]}" r="9" fill="transparent" data-i="${i}" style="cursor:pointer"/>
      <circle cx="${p[0]}" cy="${p[1]}" r="3.6" fill="#fff" stroke="${color}" stroke-width="2.4" pointer-events="none"/>`).join("");

    container.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">
        <defs>
          <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
          </linearGradient>
          <linearGradient id="${gid}l" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="${color}"/>
            <stop offset="100%" stop-color="${color2}"/>
          </linearGradient>
        </defs>
        ${grid}${labels}
        <path d="${area}" fill="url(#${gid})"/>
        <path d="${line}" fill="none" stroke="url(#${gid}l)" stroke-width="3" stroke-linecap="round"
              style="filter:drop-shadow(0 4px 8px rgba(14,165,233,.3))"/>
        ${dots}
      </svg>`;

    container.querySelectorAll(".ac-dot").forEach((dot) => {
      dot.addEventListener("mousemove", (e) => {
        const d = data[+dot.dataset.i];
        showTip(`${d.label} — <b style="color:#7dd3fc">${d.value} طلب</b>`, e.clientX, e.clientY);
      });
      dot.addEventListener("mouseleave", hideTip);
    });
  }

  /* ============================================================
     مخطط دائري (Donut) — توزيع الحالات
     ============================================================ */
  function donut(container, segments, { size = 190, thickness = 26 } = {}) {
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const r = (size - thickness) / 2;
    const cx = size / 2, cy = size / 2;
    const C = 2 * Math.PI * r;
    let offset = 0;

    const rings = segments.filter((s) => s.value > 0).map((s) => {
      const frac = s.value / total;
      const dash = `${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}`;
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${thickness}"
        stroke-dasharray="${dash}" stroke-dashoffset="${(-offset * C).toFixed(2)}"
        transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt"
        style="transition:stroke-dasharray .8s ease; cursor:pointer"
        class="dn-seg" data-label="${s.label}" data-value="${s.value}"/>`;
      offset += frac;
      return el;
    }).join("");

    container.innerHTML = `
      <div class="donut-wrap">
        <div style="position:relative;flex-shrink:0">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#eef5fc" stroke-width="${thickness}"/>
            ${rings}
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center">
            <div class="donut-center-txt">${total}</div>
            <div class="donut-center-sub">إجمالي الطلبات</div>
          </div>
        </div>
        <div class="legend" style="flex-direction:column;gap:10px">
          ${segments.map((s) => `
            <div class="lg"><span class="sw" style="background:${s.color}"></span>${s.label}
              <b style="color:var(--ink)">${s.value}</b>
              <span class="muted small">(${Math.round((s.value / total) * 100)}%)</span>
            </div>`).join("")}
        </div>
      </div>`;

    container.querySelectorAll(".dn-seg").forEach((seg) => {
      seg.addEventListener("mousemove", (e) => showTip(`${seg.dataset.label}: <b style="color:#7dd3fc">${seg.dataset.value}</b>`, e.clientX, e.clientY));
      seg.addEventListener("mouseleave", hideTip);
    });
  }

  /* ============================================================
     أعمدة أفقية (Top Medicines / Pharmacy Stats)
     ============================================================ */
  function hbars(container, items, { valueLabel = "طلب", maxItems = 10 } = {}) {
    const list = items.slice(0, maxItems);
    const max = Math.max(...list.map((i) => i.count), 1);
    container.innerHTML = list.map((item, i) => `
      <div class="hbar-row ${i < 3 ? "top" : ""}">
        <div class="hb-rank">${i + 1}</div>
        <div class="hb-name" title="${App.ui.esc(item.name)}">${App.ui.esc(item.name)}</div>
        <div class="hb-track"><div class="hb-fill" data-w="${((item.count / max) * 100).toFixed(1)}"></div></div>
        <div class="hb-val">${item.count} ${valueLabel}</div>
      </div>`).join("");
    /* تحريك الأعمدة بعد الرسم */
    requestAnimationFrame(() => {
      setTimeout(() => {
        container.querySelectorAll(".hb-fill").forEach((f) => { f.style.width = f.dataset.w + "%"; });
      }, 60);
    });
  }

  App.charts = { areaChart, donut, hbars };
})();
