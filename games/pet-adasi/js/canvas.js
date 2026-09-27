export const FONT = "'Arial Rounded MT Bold', 'Avenir Next Rounded', 'Nunito', 'Segoe UI Black', 'Segoe UI', system-ui, sans-serif";

export function drawCoin(ctx, x, y, r) {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff7b0');
  g.addColorStop(0.5, '#ffd23a');
  g.addColorStop(1, '#e08a00');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = '#9a5a00';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(160,90,0,0.55)';
  ctx.lineWidth = r * 0.1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

export function drawGem(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  const pts = [[0, -r], [r * 0.9, -r * 0.3], [r * 0.55, r * 0.9], [-r * 0.55, r * 0.9], [-r * 0.9, -r * 0.3]];
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, '#b9f6ff');
  g.addColorStop(0.5, '#3fc8ff');
  g.addColorStop(1, '#6a4dff');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.14;
  ctx.strokeStyle = '#2a3a8f';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.8);
  ctx.lineTo(r * 0.45, -r * 0.3);
  ctx.lineTo(0, -r * 0.1);
  ctx.lineTo(-r * 0.45, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawLock(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = s * 0.16;
  ctx.strokeStyle = '#3a2a10';
  ctx.beginPath();
  ctx.arc(0, -s * 0.15, s * 0.32, Math.PI, 0);
  ctx.stroke();
  ctx.fillStyle = '#ffc52e';
  ctx.strokeStyle = '#6b4300';
  ctx.lineWidth = s * 0.08;
  roundRect(ctx, -s * 0.45, -s * 0.15, s * 0.9, s * 0.72, s * 0.14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#6b4300';
  ctx.beginPath();
  ctx.arc(0, s * 0.15, s * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function outlinedText(ctx, text, x, y, size, fill, stroke = '#1d1b3a', lw) {
  ctx.font = `900 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lw || size * 0.22;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}
