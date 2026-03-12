/**
 * Moth particle system — canvas-based background moths
 * Gothic purple aesthetic for 0N1S3C2's writeup site
 */

(function () {
  'use strict';

  const canvas = document.getElementById('mothCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, moths = [], animFrame;
  const MOTH_COUNT = 14;

  // ── Resize handler ──────────────────────
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  // ── Moth constructor ─────────────────────
  function Moth() {
    this.reset(true);
  }

  Moth.prototype.reset = function (initial) {
    this.x      = Math.random() * W;
    this.y      = initial ? Math.random() * H : H + 20;
    this.size   = 8 + Math.random() * 14;      // wing span half-width
    this.speed  = 0.2 + Math.random() * 0.4;
    this.drift  = (Math.random() - 0.5) * 0.6; // horizontal drift
    this.wobble = 0;
    this.wobbleSpeed = 0.02 + Math.random() * 0.03;
    this.wobbleAmp   = 1 + Math.random() * 2.5;
    this.flapAngle   = Math.random() * Math.PI * 2;
    this.flapSpeed   = 0.04 + Math.random() * 0.06;
    this.opacity = 0.12 + Math.random() * 0.25;
    this.purple  = Math.floor(120 + Math.random() * 80);  // hue 270-290 area
  };

  // ── Draw a single moth ───────────────────
  Moth.prototype.draw = function () {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.globalAlpha = this.opacity;

    const s   = this.size;
    const flap = Math.sin(this.flapAngle) * 0.4; // wing fold factor 0=open, -1=closed

    // Upper left wing
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-s * 0.4, -s * 0.8 * (1 - Math.abs(flap)), -s * 1.1, -s * 0.5 * (1 - Math.abs(flap)), -s * 1.3, -s * 0.1);
    ctx.bezierCurveTo(-s * 1.0, s * 0.3, -s * 0.5, s * 0.1, 0, 0);
    ctx.fillStyle = `rgba(${this.purple - 30}, 20, ${this.purple + 40}, 0.7)`;
    ctx.fill();

    // Upper right wing (mirror)
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.4, -s * 0.8 * (1 - Math.abs(flap)), s * 1.1, -s * 0.5 * (1 - Math.abs(flap)), s * 1.3, -s * 0.1);
    ctx.bezierCurveTo(s * 1.0, s * 0.3, s * 0.5, s * 0.1, 0, 0);
    ctx.fillStyle = `rgba(${this.purple - 30}, 20, ${this.purple + 40}, 0.7)`;
    ctx.fill();

    // Lower left wing
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-s * 0.3, s * 0.4 * (1 - Math.abs(flap) * 0.5), -s * 0.9, s * 0.7, -s * 0.5, s * 0.9);
    ctx.bezierCurveTo(-s * 0.2, s * 0.8, -s * 0.1, s * 0.4, 0, 0);
    ctx.fillStyle = `rgba(${this.purple - 50}, 10, ${this.purple + 20}, 0.55)`;
    ctx.fill();

    // Lower right wing
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(s * 0.3, s * 0.4 * (1 - Math.abs(flap) * 0.5), s * 0.9, s * 0.7, s * 0.5, s * 0.9);
    ctx.bezierCurveTo(s * 0.2, s * 0.8, s * 0.1, s * 0.4, 0, 0);
    ctx.fillStyle = `rgba(${this.purple - 50}, 10, ${this.purple + 20}, 0.55)`;
    ctx.fill();

    // Body
    ctx.beginPath();
    ctx.ellipse(0, s * 0.15, s * 0.12, s * 0.55, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(10, 5, 20, 0.85)`;
    ctx.fill();

    ctx.restore();
  };

  // ── Update moth position ─────────────────
  Moth.prototype.update = function () {
    this.flapAngle += this.flapSpeed;
    this.wobble    += this.wobbleSpeed;
    this.x += this.drift + Math.sin(this.wobble) * this.wobbleAmp;
    this.y -= this.speed;

    // Wrap horizontally
    if (this.x < -50) this.x = W + 40;
    if (this.x > W + 50) this.x = -40;

    // Reset when off the top
    if (this.y < -60) this.reset(false);
  };

  // ── Rose petals (CSS-based) ──────────────
  function createPetals() {
    const rain = document.getElementById('petalRain');
    if (!rain) return;

    const colors = [
      'rgba(147, 51, 234, 0.6)',
      'rgba(168, 85, 247, 0.5)',
      'rgba(192, 132, 252, 0.45)',
      'rgba(217, 70, 239, 0.5)',
      'rgba(236, 72, 153, 0.4)',
      'rgba(107, 33, 168, 0.55)',
    ];

    const petalShapes = [
      'border-radius: 50% 0 50% 0',
      'border-radius: 0 50% 0 50%',
      'border-radius: 50% 50% 0 0',
      'border-radius: 0 0 50% 50%',
      'border-radius: 60% 40% 60% 40%',
    ];

    for (let i = 0; i < 22; i++) {
      const petal = document.createElement('div');
      const size  = 4 + Math.random() * 9;
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shape = petalShapes[Math.floor(Math.random() * petalShapes.length)];
      const left  = Math.random() * 100;
      const drift = (Math.random() - 0.5) * 200;
      const spin  = (Math.random() - 0.5) * 720;
      const dur   = 8 + Math.random() * 14;
      const delay = Math.random() * 12;

      petal.style.cssText = `
        position: absolute;
        width: ${size}px;
        height: ${size * 0.7}px;
        background: ${color};
        ${shape};
        left: ${left}%;
        top: -20px;
        --drift: ${drift}px;
        --spin: ${spin}deg;
        --duration: ${dur}s;
        --delay: ${delay}s;
        animation: petalFall ${dur}s ${delay}s ease-in infinite;
        pointer-events: none;
        transform-origin: center;
      `;
      rain.appendChild(petal);
    }
  }

  // ── Main animation loop ──────────────────
  function loop() {
    ctx.clearRect(0, 0, W, H);
    moths.forEach(m => { m.update(); m.draw(); });
    animFrame = requestAnimationFrame(loop);
  }

  // ── Init ─────────────────────────────────
  function init() {
    resize();
    moths = Array.from({ length: MOTH_COUNT }, () => new Moth());
    createPetals();
    loop();
  }

  window.addEventListener('resize', () => {
    resize();
    moths.forEach(m => m.reset(true));
  });

  // Pause animation when tab is not visible
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animFrame);
    } else {
      loop();
    }
  });

  // Start after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}());
