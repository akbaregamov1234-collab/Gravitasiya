'use strict';

/* ---------- Sozlamalar ---------- */
const $ = (id) => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const G = 1, DT = 0.05, EPS2 = 4, TRAIL = 140;
const MASSES = [2, 10, 60, 400, 3000, 15000];

let W, H, dpr;
const cam = { x: 0, y: 0, z: 0.7 };
let bodies = [], running = true, time = 0, e0 = null;
let selected = null, follow = false, uid = 1, acc = 0;
let drag = null, pan = null;
const opt = { trails: true, predict: true, grid: true };

const rad = (m) => Math.max(2.2, Math.cbrt(m) * 0.9);
const hue = (m) => Math.round(195 - 155 * Math.min(1, Math.log10(m) / 4.3));
const mk = (x, y, vx, vy, m) => ({ id: uid++, x, y, vx, vy, m, r: rad(m), h: hue(m), ax: 0, ay: 0, trail: [] });

const sx = (x) => (x - cam.x) * cam.z + W / 2;
const sy = (y) => (y - cam.y) * cam.z + H / 2;
const wx = (x) => (x - W / 2) / cam.z + cam.x;
const wy = (y) => (y - H / 2) / cam.z + cam.y;

/* ---------- Fizika ---------- */
function accel(bs) {
  for (const b of bs) { b.ax = 0; b.ay = 0; }
  for (let i = 0; i < bs.length; i++) {
    const a = bs[i];
    for (let j = i + 1; j < bs.length; j++) {
      const b = bs[j];
      const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy + EPS2;
      const inv = G / (d2 * Math.sqrt(d2));
      a.ax += dx * inv * b.m; a.ay += dy * inv * b.m;
      b.ax -= dx * inv * a.m; b.ay -= dy * inv * a.m;
    }
  }
}
// Tezlik-Verle usuli: energiyani uzoq vaqt saqlaydi
function step(bs) {
  for (const b of bs) { b.vx += b.ax * DT / 2; b.vy += b.ay * DT / 2; b.x += b.vx * DT; b.y += b.vy * DT; }
  accel(bs);
  for (const b of bs) { b.vx += b.ax * DT / 2; b.vy += b.ay * DT / 2; }
}
function merge() {
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      if (Math.hypot(a.x - b.x, a.y - b.y) < (a.r + b.r) * 0.7) {
        const big = a.m >= b.m ? a : b, sm = big === a ? b : a, m = a.m + b.m;
        big.vx = (a.vx * a.m + b.vx * b.m) / m; big.vy = (a.vy * a.m + b.vy * b.m) / m;
        big.x = (a.x * a.m + b.x * b.m) / m; big.y = (a.y * a.m + b.y * b.m) / m;
        big.m = m; big.r = rad(m); big.h = hue(m);
        if (selected === sm) selected = big;
        bodies.splice(bodies.indexOf(sm), 1);
        return merge();
      }
    }
  }
}
function energy() {
  let e = 0;
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i];
    e += 0.5 * a.m * (a.vx * a.vx + a.vy * a.vy);
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j];
      e -= G * a.m * b.m / Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + EPS2);
    }
  }
  return e;
}
function predict(nb) {
  const c = bodies.map((b) => ({ ...b, trail: null })), n = { ...nb };
  c.push(n); accel(c);
  const pts = [];
  for (let i = 0; i < 220; i++) { step(c); if (i % 3 === 0) pts.push(n.x, n.y); }
  return pts;
}

/* ---------- Tayyor sahnalar ---------- */
function circ(cx, cy, cvx, cvy, M, r, ang, m) {
  const v = Math.sqrt(G * M / r);
  return mk(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, cvx - Math.sin(ang) * v, cvy + Math.cos(ang) * v, m);
}
const PRESETS = {
  solar() {
    const l = [mk(0, 0, 0, 0, 10000)];
    [[90, 4], [150, 8], [230, 40], [320, 6], [430, 150]].forEach(([r, m], i) => l.push(circ(0, 0, 0, 0, 10000, r, i * 1.9 + 0.5, m)));
    const p = l[3];
    l.push(circ(p.x, p.y, p.vx, p.vy, p.m, 9, 1, 0.5)); // Oy
    return l;
  },
  binary() {
    const v = Math.sqrt(5000 / 320);
    return [mk(-80, 0, 0, -v, 5000), mk(80, 0, 0, v, 5000), circ(0, 0, 0, 0, 10000, 330, 2, 10)];
  },
  figure8() { // Chenciner–Montgomery "sakkiz" yechimi
    const L = 200, m = 2000, k = Math.sqrt(m / L);
    const vx = -0.93240737 * k, vy = -0.86473146 * k;
    return [mk(-0.97000436 * L, 0.24308753 * L, -vx / 2, -vy / 2, m),
            mk(0.97000436 * L, -0.24308753 * L, -vx / 2, -vy / 2, m),
            mk(0, 0, vx, vy, m)];
  },
  cluster() {
    const l = [mk(0, 0, 0, 0, 8000)];
    for (let i = 0; i < 45; i++) l.push(circ(0, 0, 0, 0, 8000, 80 + Math.random() * 340, Math.random() * 6.283, 1 + Math.random() * 12));
    return l;
  }
};
function loadPreset(name) {
  const l = PRESETS[name]();
  let M = 0, px = 0, py = 0;
  l.forEach((b) => { M += b.m; px += b.vx * b.m; py += b.vy * b.m; });
  l.forEach((b) => { b.vx -= px / M; b.vy -= py / M; }); // umumiy impulsni nolga keltirish
  bodies = l; selected = null; follow = false; time = 0;
  cam.x = 0; cam.y = 0; cam.z = Math.min(W, H) / 1000;
  accel(bodies); e0 = energy();
}
function addBody(x, y, vx, vy) {
  const b = mk(x, y, vx, vy, MASSES[+$('mass').value]);
  bodies.push(b); accel(bodies); e0 = energy();
}

/* ---------- Chizish ---------- */
function draw() {
  ctx.fillStyle = '#e8efe9'; ctx.fillRect(0, 0, W, H);

  if (opt.grid) {
    let s = 100; while (s * cam.z < 28) s *= 5;
    ctx.strokeStyle = 'rgba(16,48,58,.09)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = Math.floor(wx(0) / s) * s; x < wx(W); x += s) { ctx.moveTo(sx(x), 0); ctx.lineTo(sx(x), H); }
    for (let y = Math.floor(wy(0) / s) * s; y < wy(H); y += s) { ctx.moveTo(0, sy(y)); ctx.lineTo(W, sy(y)); }
    ctx.stroke();
  }
  if (opt.trails) {
    for (const b of bodies) {
      const t = b.trail; if (t.length < 4) continue;
      ctx.strokeStyle = `hsla(${b.h},70%,38%,.55)`; ctx.lineWidth = 1.3; ctx.beginPath();
      ctx.moveTo(sx(t[0]), sy(t[1]));
      for (let i = 2; i < t.length; i += 2) ctx.lineTo(sx(t[i]), sy(t[i + 1]));
      ctx.stroke();
    }
  }
  for (const b of bodies) {
    const x = sx(b.x), y = sy(b.y), r = Math.max(2, b.r * cam.z), star = b.m >= 3000;
    if (star) {
      const g = ctx.createRadialGradient(x, y, r, x, y, r * 3);
      g.addColorStop(0, 'rgba(242,183,5,.35)'); g.addColorStop(1, 'rgba(242,183,5,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, 7); ctx.fill();
    }
    ctx.fillStyle = `hsl(${b.h},75%,${star ? 55 : 45}%)`;
    ctx.strokeStyle = '#10303a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    if (b === selected) {
      ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(x, y, r + 7, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  if (drag) {
    const x0 = sx(drag.x0), y0 = sy(drag.y0);
    const nb = mk(drag.x0, drag.y0, (drag.x1 - drag.x0) * 0.05, (drag.y1 - drag.y0) * 0.05, MASSES[+$('mass').value]);
    ctx.strokeStyle = '#e8553d'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(sx(drag.x1), sy(drag.y1)); ctx.stroke();
    if (opt.predict) {
      const p = predict(nb);
      ctx.setLineDash([3, 5]); ctx.beginPath();
      for (let i = 0; i < p.length; i += 2) i ? ctx.lineTo(sx(p[i]), sy(p[i + 1])) : ctx.moveTo(sx(p[i]), sy(p[i + 1]));
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.fillStyle = '#e8553d'; ctx.beginPath(); ctx.arc(x0, y0, Math.max(3, nb.r * cam.z), 0, 7); ctx.fill();
  }
}

/* ---------- Asosiy sikl ---------- */
function ui() {
  $('sN').textContent = bodies.length;
  $('sT').textContent = time.toFixed(0);
  const e = bodies.length > 1 ? energy() : 0;
  $('sE').textContent = e.toFixed(0);
  $('sD').textContent = e0 && bodies.length > 1 ? ((e - e0) / Math.abs(e0) * 100).toFixed(2) + '%' : '—';
  const box = $('sel');
  if (selected && bodies.includes(selected)) {
    const heavy = bodies.reduce((a, b) => (b.m > a.m ? b : a), bodies[0]);
    box.hidden = false;
    $('selName').textContent = 'Jism #' + selected.id;
    $('selM').textContent = selected.m.toFixed(1);
    $('selV').textContent = Math.hypot(selected.vx, selected.vy).toFixed(2);
    $('selD').textContent = selected === heavy ? '—' : Math.hypot(selected.x - heavy.x, selected.y - heavy.y).toFixed(0);
    $('fol').classList.toggle('on', follow);
  } else { selected = null; follow = false; box.hidden = true; }
}
function loop() {
  if (running) {
    acc += +$('speed').value;
    const n = Math.floor(acc); acc -= n;
    accel(bodies);
    for (let i = 0; i < n; i++) step(bodies);
    merge(); time += n * DT;
    for (const b of bodies) {
      if (opt.trails) { b.trail.push(b.x, b.y); if (b.trail.length > TRAIL * 2) b.trail.splice(0, 2); }
      else b.trail.length = 0;
    }
  }
  if (follow && selected) { cam.x += (selected.x - cam.x) * 0.1; cam.y += (selected.y - cam.y) * 0.1; }
  draw(); ui();
  requestAnimationFrame(loop);
}

/* ---------- Boshqaruv ---------- */
function pick(x, y) {
  let hit = null, best = 1e9;
  for (const b of bodies) {
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < Math.max(b.r, 10 / cam.z) && d < best) { best = d; hit = b; }
  }
  return hit;
}
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  if (e.button === 1 || e.button === 2 || e.shiftKey) { pan = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y }; return; }
  const x = wx(e.clientX), y = wy(e.clientY);
  drag = { x0: x, y0: y, x1: x, y1: y, sx: e.clientX, sy: e.clientY };
});
cv.addEventListener('pointermove', (e) => {
  if (pan) { cam.x = pan.cx - (e.clientX - pan.x) / cam.z; cam.y = pan.cy - (e.clientY - pan.y) / cam.z; follow = false; }
  if (drag) { drag.x1 = wx(e.clientX); drag.y1 = wy(e.clientY); }
});
cv.addEventListener('pointerup', (e) => {
  if (pan) { pan = null; return; }
  if (!drag) return;
  if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) {
    const hit = pick(drag.x0, drag.y0);
    hit ? (selected = hit) : (selected = null, addBody(drag.x0, drag.y0, 0, 0));
  } else addBody(drag.x0, drag.y0, (drag.x1 - drag.x0) * 0.05, (drag.y1 - drag.y0) * 0.05);
  drag = null;
});
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const bx = wx(e.clientX), by = wy(e.clientY);
  cam.z = Math.min(6, Math.max(0.1, cam.z * Math.exp(-e.deltaY * 0.0012)));
  cam.x = bx - (e.clientX - W / 2) / cam.z; cam.y = by - (e.clientY - H / 2) / cam.z;
}, { passive: false });

const setPlay = (v) => { running = v; $('play').textContent = v ? 'Pauza' : 'Davom'; };
$('play').onclick = () => setPlay(!running);
$('speed').oninput = (e) => { $('spOut').textContent = '×' + (e.target.value / 4).toFixed(1).replace('.0', ''); };
$('mass').oninput = (e) => { $('mOut').textContent = MASSES[+e.target.value]; };
document.querySelectorAll('[data-p]').forEach((b) => (b.onclick = () => loadPreset(b.dataset.p)));
$('oTr').onchange = (e) => (opt.trails = e.target.checked);
$('oPr').onchange = (e) => (opt.predict = e.target.checked);
$('oGr').onchange = (e) => (opt.grid = e.target.checked);
$('clr').onclick = () => { bodies = []; selected = null; e0 = null; time = 0; };
$('fol').onclick = () => (follow = !follow);
$('del').onclick = () => { bodies = bodies.filter((b) => b !== selected); selected = null; accel(bodies); e0 = energy(); };
$('shot').onclick = () => {
  const a = document.createElement('a');
  a.href = cv.toDataURL('image/png'); a.download = 'gravitatsiya.png'; a.click();
};
addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); setPlay(!running); }
  if (e.key === 'c' || e.key === 'C') $('clr').click();
  if (e.key === 'Escape') selected = null;
});

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth; H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);

resize(); loadPreset('solar'); loop();
