(function () {
  "use strict";

  /* =========================================================
     CHARACTERS (Gloria is new in Part 2!)
  ========================================================= */
  var CHARACTERS = [
    { name: "Marley", color: "#ff5d5d", dark: "#c73f3f" },
    { name: "Miral",  color: "#4ec9ff", dark: "#2f96c4" },
    { name: "John",   color: "#7ee08a", dark: "#4bab58" },
    { name: "Paul",   color: "#ffd23f", dark: "#cc9f1c" },
    { name: "Marmar", color: "#ff8fd8", dark: "#c95fab" },
    { name: "Miko",   color: "#b98cff", dark: "#8a5ee0" },
    { name: "Mariam", color: "#ffb26b", dark: "#d1813a" },
    { name: "Gloria", color: "#00e5a0", dark: "#009e6e" }
  ];

  var selectedCharacter = 0;

  /* =========================================================
     SOUND ENGINE (Web Audio, no files needed)
  ========================================================= */
  var Sound = {
    ctx: null,
    muted: false,
    init: function () {
      if (this.ctx) {
        if (this.ctx.state === "suspended") this.ctx.resume();
        return;
      }
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) { this.ctx = null; }
    },
    tone: function (freq, dur, type, vol, slideTo, delay) {
      if (this.muted || !this.ctx) return;
      var t = this.ctx.currentTime + (delay || 0);
      var o = this.ctx.createOscillator();
      var g = this.ctx.createGain();
      o.type = type || "square";
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      g.gain.setValueAtTime(vol || 0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    jump: function () { this.tone(280, 0.14, "square", 0.10, 640); },
    death: function () { this.tone(220, 0.35, "sawtooth", 0.16, 50); },
    win: function () {
      var s = this;
      [523, 659, 784, 1047].forEach(function (f, i) { s.tone(f, 0.16, "square", 0.10, 0, i * 0.1); });
    },
    warn: function () { this.tone(920, 0.06, "square", 0.06); },
    click: function () { this.tone(620, 0.05, "square", 0.08); },
    spawn: function () { this.tone(150, 0.4, "sawtooth", 0.14, 80); },
    fake: function () { this.tone(180, 0.25, "square", 0.14, 90); }
  };

  /* =========================================================
     DOM
  ========================================================= */
  var characterSelect = document.getElementById("characterSelect");
  var gameScreen = document.getElementById("gameScreen");
  var charGrid = document.getElementById("charGrid");
  var startBtn = document.getElementById("startBtn");
  var canvas = document.getElementById("gameCanvas");
  var ctx = canvas.getContext("2d");
  var hudLevel = document.getElementById("hudLevel");
  var hudTries = document.getElementById("hudTries");
  var pauseBtn = document.getElementById("pauseBtn");
  var muteBtn = document.getElementById("muteBtn");
  var readyOverlay = document.getElementById("readyOverlay");
  var readyTitle = document.getElementById("readyTitle");
  var readySub = document.getElementById("readySub");
  var levelCompleteOverlay = document.getElementById("levelCompleteOverlay");
  var lcTries = document.getElementById("lcTries");
  var nextLevelBtn = document.getElementById("nextLevelBtn");
  var gameCompleteOverlay = document.getElementById("gameCompleteOverlay");
  var backToMenuBtn = document.getElementById("backToMenuBtn");
  var pauseOverlay = document.getElementById("pauseOverlay");
  var resumeBtn = document.getElementById("resumeBtn");
  var restartBtn = document.getElementById("restartBtn");
  var menuBtn = document.getElementById("menuBtn");
  var btnLeft = document.getElementById("btnLeft");
  var btnRight = document.getElementById("btnRight");
  var btnJump = document.getElementById("btnJump");

  /* =========================================================
     CHARACTER SELECT LOGIC
  ========================================================= */
  var cards = Array.prototype.slice.call(charGrid.querySelectorAll(".char-card"));
  cards.forEach(function (card) {
    card.addEventListener("click", function () {
      Sound.init();
      Sound.click();
      cards.forEach(function (c) { c.classList.remove("selected"); });
      card.classList.add("selected");
      selectedCharacter = parseInt(card.getAttribute("data-char"), 10);
      startBtn.disabled = false;
      startBtn.textContent = "START GAME";
    });
  });

  startBtn.addEventListener("click", function () {
    Sound.init();
    Sound.click();
    characterSelect.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    resizeCanvas();
    currentLevelIndex = 0;
    startLevel(currentLevelIndex);
  });

  backToMenuBtn.addEventListener("click", function () {
    Sound.click();
    gameCompleteOverlay.classList.add("hidden");
    gameScreen.classList.add("hidden");
    characterSelect.classList.remove("hidden");
  });

  menuBtn.addEventListener("click", function () {
    Sound.click();
    paused = false;
    pauseOverlay.classList.add("hidden");
    gameScreen.classList.add("hidden");
    characterSelect.classList.remove("hidden");
  });

  muteBtn.addEventListener("click", function () {
    Sound.init();
    Sound.muted = !Sound.muted;
    muteBtn.textContent = Sound.muted ? "🔇" : "🔊";
    if (!Sound.muted) Sound.click();
  });

  /* =========================================================
     TOUCH DETECTION
  ========================================================= */
  function isTouchDevice() {
    return ("ontouchstart" in window) || navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
  }
  if (isTouchDevice()) {
    document.body.classList.add("touch-mode");
  }

  /* =========================================================
     CANVAS / RESIZE
  ========================================================= */
  var DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  var DESIGN_HEIGHT = 600;
  var SCALE = 1;

  function resizeCanvas() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    SCALE = (canvas.height / DESIGN_HEIGHT);
  }
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("orientationchange", function () { setTimeout(resizeCanvas, 200); });
  resizeCanvas();

  /* =========================================================
     INPUT
  ========================================================= */
  var input = { left: false, right: false, jump: false, jumpPressed: false };

  window.addEventListener("keydown", function (e) {
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = true;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
    if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") {
      if (!input.jump) input.jumpPressed = true;
      input.jump = true;
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", function (e) {
    if (e.code === "ArrowLeft" || e.code === "KeyA") input.left = false;
    if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
    if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") input.jump = false;
  });

  function bindTouchBtn(el, onDown, onUp) {
    el.addEventListener("touchstart", function (e) { e.preventDefault(); Sound.init(); onDown(); }, { passive: false });
    el.addEventListener("touchend", function (e) { e.preventDefault(); onUp(); }, { passive: false });
    el.addEventListener("touchcancel", function (e) { e.preventDefault(); onUp(); }, { passive: false });
    el.addEventListener("mousedown", function (e) { e.preventDefault(); onDown(); });
    el.addEventListener("mouseup", function (e) { e.preventDefault(); onUp(); });
    el.addEventListener("mouseleave", function () { onUp(); });
  }
  bindTouchBtn(btnLeft, function () { input.left = true; }, function () { input.left = false; });
  bindTouchBtn(btnRight, function () { input.right = true; }, function () { input.right = false; });
  bindTouchBtn(btnJump, function () {
    if (!input.jump) input.jumpPressed = true;
    input.jump = true;
  }, function () { input.jump = false; });

  pauseBtn.addEventListener("click", function () {
    if (!levelActive) return;
    Sound.click();
    paused = !paused;
    pauseOverlay.classList.toggle("hidden", !paused);
  });
  resumeBtn.addEventListener("click", function () {
    Sound.click();
    paused = false;
    pauseOverlay.classList.add("hidden");
  });
  restartBtn.addEventListener("click", function () {
    Sound.click();
    paused = false;
    pauseOverlay.classList.add("hidden");
    startLevel(currentLevelIndex);
  });
  nextLevelBtn.addEventListener("click", function () {
    Sound.click();
    levelCompleteOverlay.classList.add("hidden");
    currentLevelIndex++;
    if (currentLevelIndex >= LEVELS.length) {
      gameCompleteOverlay.classList.remove("hidden");
    } else {
      startLevel(currentLevelIndex);
    }
  });

  /* =========================================================
     LEVEL DEFINITIONS — 10 brand-new harder levels
     (design units, groundY = 520)
  ========================================================= */
  var GY = 520;
  var DEATH_Y = 640;

  function P(x, y, w, h) { return { x: x, y: y, w: w, h: h }; }

  var LEVELS = [
    // ---------------- LEVEL 1 : Wake Up Call ----------------
    {
      name: "Wake Up Call",
      bg: "#2b2d5c", platform: "#3d3f7a", accent: "#ffd23f", spike: "#ff3b3b",
      width: 2600,
      spawn: { x: 60, y: GY - 60 },
      platforms: [
        P(0, GY, 600, 80),
        P(700, GY, 300, 80),
        P(1100, GY, 250, 80),
        P(1450, GY, 300, 80),
        P(1850, GY, 750, 80)
      ],
      moving: [],
      crumble: [],
      fake: [],
      spikes: [
        { x: 1200, y: GY, w: 40, h: 34, orient: "up", triggerDist: 140 }
      ],
      fallingSpikes: [],
      saws: [],
      chasers: [
        { triggerX: 1500, x: 1150, y: 350, speed: 235 }
      ],
      walls: [],
      fakeDoor: null,
      door: P(2460, GY - 90, 60, 90)
    },

    // ---------------- LEVEL 2 : Don't Look Back ----------------
    {
      name: "Don't Look Back",
      bg: "#3d1f4e", platform: "#5c2f78", accent: "#ffd23f", spike: "#ff3b3b",
      width: 3000,
      spawn: { x: 60, y: GY - 60 },
      platforms: [
        P(0, GY, 420, 80),
        P(540, GY, 200, 80),
        P(860, GY, 200, 80),
        P(1080, GY, 220, 80),
        P(1420, GY, 180, 80),
        P(1720, GY, 260, 80),
        P(2100, GY, 900, 80)
      ],
      moving: [],
      crumble: [
        { x: 740, y: GY, w: 100, h: 24 }
      ],
      fake: [],
      spikes: [
        { x: 1150, y: GY, w: 36, h: 32, orient: "up", triggerDist: 120 },
        { x: 1800, y: GY, w: 36, h: 32, orient: "up", triggerDist: 120 }
      ],
      fallingSpikes: [],
      saws: [],
      chasers: [
        { triggerX: 500, x: 150, y: 350, speed: 240 },
        { triggerX: 1900, x: 1500, y: 350, speed: 250 }
      ],
      walls: [],
      fakeDoor: null,
      door: P(2860, GY - 90, 60, 90)
    },

    // ---------------- LEVEL 3 : Sawmill ----------------
    {
      name: "Sawmill",
      bg: "#4e2b1f", platform: "#7a452e", accent: "#ffd23f", spike: "#ff3b3b",
      width: 3200,
      spawn: { x: 60, y: GY - 60 },
      platforms: [
        P(0, GY, 500, 80),
        P(620, GY, 280, 80),
        P(1020, GY, 280, 80),
        P(1420, GY, 280, 80),
        P(1820, GY, 300, 80),
        P(2240, GY, 960, 80)
      ],
      moving: [
        { x: 2050, y: GY - 90, w: 100, h: 20, axis: "y", range: 70, speed: 1.2, phase: 0 }
      ],
      crumble: [],
      fake: [],
      spikes: [
        { x: 1500, y: GY, w: 36, h: 32, orient: "up", triggerDist: 120 }
      ],
      fallingSpikes: [],
      saws: [
        { x: 560, y: 445, r: 20, axis: "x", range: 55, speed: 1.6, phase: 0 },
        { x: 960, y: 445, r: 20, axis: "x", range: 55, speed: 1.8, phase: 1 },
        { x: 1360, y: 445, r: 20, axis: "x", range: 55, speed: 2.0, phase: 0.5 },
        { x: 1760, y: 445, r: 20, axis: "x", range: 55, speed: 2.2, phase: 1.5 }
      ],
      chasers: [],
      walls: [],
      fakeDoor: null,
      door: P(3060, GY - 90, 60, 90)
    },

    // ---------------- LEVEL 4 : Fake Friends ----------------
    {
      name: "Fake Friends",
      bg: "#1f4e3d", platform: "#2f7a5c", accent: "#ffd23f", spike: "#ff3b3b",
      width: 3400,
      spawn: { x: 60, y: GY - 60 },
      platforms: [
        P(0, GY, 700, 80),
        P(820, GY, 260, 80),
        P(1200, GY, 240, 80),
        P(1560, GY, 260, 80),
        P(1940, GY, 240, 80),
        P(2700, GY, 700, 80)
      ],
      moving: [
        { x: 2300, y: GY - 90, w: 110, h: 20, axis: "x", range: 140, speed: 1.3, phase: 0 }
      ],
      crumble: [],
      fake: [
        { x: 940, y: GY, w: 120, h: 24 },
        { x: 1680, y: GY, w: 100, h: 24 }
      ],
      spikes: [
        { x: 1300, y: GY, w: 36, h: 32, orient: "up", triggerDist: 110 },
        { x: 2050, y: GY, w: 36, h: 32, orient: "up", triggerDist: 110 }
      ],
      fallingSpikes: [
        { x: 1750, y: 30, w: 34, h: 34, triggerDist: 150 }
      ],
      saws: [],
      chasers: [
        { triggerX: 1200, x: 850, y: 350, speed: 245 }
      ],
      walls: [],
      fakeDoor: P(2500, GY - 90, 60, 90),
      door: P(3260, GY - 90, 60, 90)
    },

    // ---------------- LEVEL 5 : The Chase ----------------
    {
      name: "The Chase",
      bg: "#5c1f1f", platform: "#7a2f2f", accent: "#ffd23f", spike: "#ff3b3b",
      width: 4300,
      spawn: { x: 60, y: GY - 60 },
      platforms: [
        P(0, GY, 500, 80),
        P(620, GY, 220, 80),
        P(960, GY, 220, 80),
        P(1300, GY, 220, 80),
        P(1640, GY, 220, 80),
        P(1980, GY, 240, 80),
        P(2340, GY, 220, 80),
        P(2680, GY, 240, 80),
        P(3040, GY, 220, 80),
        P(3380, GY, 920, 80)
      ],
      moving: [
        { x: 2150, y: GY - 90, w: 100, h: 20, axis: "y", range: 80, speed: 1.4, phase: 0 }
      ],
      crumble: [
        { x: 1080, y: GY, w: 100, h: 24 },
        { x: 2800, y: GY, w: 100, h: 24 }
      ],
      fake: [],
      spikes: [
        { x: 1400, y: GY, w: 36, h: 32, orient: "up", triggerDist: 110 },
        { x: 2450, y: GY, w: 36, h: 32, orient: "up", triggerDist: 110 },
        { x: 3150, y: GY, w: 36, h: 32, orient: "up", triggerDist: 110 }
      ],
      fallingSpikes: [
        { x: 1750, y: 30, w: 34, h: 34, triggerDist: 150 },
        { x: 2900, y: 30, w: 34, h: 34, triggerDist: 150 }
      ],
      saws: [],
      chasers: [
        { triggerX: 250, x: -80, y: 350, speed: 262 }
      ],
      walls: [],
      fakeDoor: null,
      door: P(4160, GY - 90, 60, 90)
    },

    // ---------------- LEVEL 6 : Ceiling's Falling ----------------
    {
      name: "Ceiling's Falling",
      bg: "#2b3a55", platform: "#3d557a", accent: "#ffd23f", spike: "#ff3b3b",
      width: 3600,
      spawn: { x: 60, y: GY - 60 },
      platforms: [
        P(0, GY, 450, 80),
        P(570, GY, 240, 80),
        P(930, GY, 240, 80),
        P(1290, GY, 240, 80),
        P(1650, GY, 260, 80),
        P(2030, GY, 240, 80),
        P(2390, GY, 260, 80),
        P(2770, GY, 830, 80)
      ],
      moving: [],
      crumble: [
        { x: 1170, y: GY, w: 100, h: 24 }
      ],
      fake: [
        { x: 1910, y: GY, w: 100, h: 24 }
      ],
      spikes: [
        { x: 1000, y: GY, w: 36, h: 32, orient: "up", triggerDist: 110 },
        { x: 2200, y: GY, w: 36, h: 32, orient: "up", triggerDist: 110 }
      ],
      fallingSpikes: [
        { x: 650, y: 30, w: 34, h: 34, triggerDist: 130 },
        { x: 1050, y: 30, w: 34, h: 34, triggerDist: 130 },
        { x: 1450, y: 30, w: 34, h: 34, triggerDist: 130 },
        { x: 1800, y: 30, w: 34, h: 34, triggerDist: 130 },
        { x: 2150, y: 30, w: 34, h: 34, triggerDist: 130 },
        { x: 2500, y: 30, w: 34, h: 34, triggerDist: 130 }
      ],
      saws: [],
      chasers: [],
      walls: [
        { x: 2900, y: GY - 220, w: 26, h: 220, range: 190, speed: 1.2, phase: 0 }
      ],
      fakeDoor: null,
      door: P(3460, GY - 90, 60, 90)
    }
  ];

  // ---------------- LEVEL 7 : Devil's Playground ----------------
  LEVELS.push({
    name: "Devil's Playground",
    bg: "#4a1f3d", platform: "#6e2f5c", accent: "#ffd23f", spike: "#ff3b3b",
    width: 4000,
    spawn: { x: 60, y: GY - 60 },
    platforms: [
      P(0, GY, 480, 80),
      P(600, GY, 240, 80),
      P(960, GY, 240, 80),
      P(1320, GY, 240, 80),
      P(1680, GY, 240, 80),
      P(2040, GY, 260, 80),
      P(2420, GY, 240, 80),
      P(2780, GY, 1220, 80)
    ],
    moving: [
      { x: 1100, y: GY - 100, w: 100, h: 20, axis: "y", range: 90, speed: 1.4, phase: 0 }
    ],
    crumble: [
      { x: 840, y: GY, w: 100, h: 24 }
    ],
    fake: [
      { x: 1920, y: GY, w: 100, h: 24 }
    ],
    spikes: [
      { x: 1750, y: GY, w: 36, h: 32, orient: "up", triggerDist: 110 },
      { x: 2600, y: GY, w: 36, h: 32, orient: "up", triggerDist: 110 }
    ],
    fallingSpikes: [
      { x: 1400, y: 30, w: 34, h: 34, triggerDist: 150 }
    ],
    saws: [
      { x: 720, y: 380, r: 20, axis: "y", range: 90, speed: 1.8, phase: 0 },
      { x: 1440, y: 380, r: 20, axis: "y", range: 90, speed: 2.0, phase: 1 },
      { x: 2160, y: 380, r: 20, axis: "y", range: 90, speed: 2.2, phase: 0.5 },
      { x: 2540, y: 380, r: 20, axis: "y", range: 90, speed: 2.4, phase: 1.5 }
    ],
    chasers: [
      { triggerX: 1500, x: 1150, y: 350, speed: 250 }
    ],
    walls: [],
    fakeDoor: null,
    door: P(3860, GY - 90, 60, 90)
  });

  // ---------------- LEVEL 8 : No Mercy ----------------
  LEVELS.push({
    name: "No Mercy",
    bg: "#1a1a2e", platform: "#2e2e4a", accent: "#ffd23f", spike: "#ff3b3b",
    width: 3800,
    spawn: { x: 60, y: GY - 60 },
    platforms: [
      P(0, GY, 300, 80),
      P(420, GY, 150, 80),
      P(690, GY, 150, 80),
      P(960, GY, 150, 80),
      P(1230, GY, 150, 80),
      P(1500, GY, 180, 80),
      P(1800, GY, 150, 80),
      P(2070, GY, 150, 80),
      P(2340, GY, 180, 80),
      P(2640, GY, 1160, 80)
    ],
    moving: [],
    crumble: [
      { x: 840, y: GY, w: 100, h: 24 },
      { x: 1950, y: GY, w: 100, h: 24 }
    ],
    fake: [
      { x: 1380, y: GY, w: 100, h: 24 }
    ],
    spikes: [
      { x: 1000, y: GY, w: 34, h: 30, orient: "up", triggerDist: 100 },
      { x: 1900, y: GY, w: 34, h: 30, orient: "up", triggerDist: 100 },
      { x: 2450, y: GY, w: 34, h: 30, orient: "up", triggerDist: 100 }
    ],
    fallingSpikes: [
      { x: 1350, y: 30, w: 34, h: 34, triggerDist: 140 },
      { x: 2200, y: 30, w: 34, h: 34, triggerDist: 140 }
    ],
    saws: [
      { x: 360, y: 445, r: 18, axis: "x", range: 50, speed: 2.2, phase: 0 },
      { x: 630, y: 445, r: 18, axis: "x", range: 50, speed: 2.4, phase: 1 },
      { x: 1170, y: 445, r: 18, axis: "x", range: 50, speed: 2.6, phase: 0.5 },
      { x: 2280, y: 445, r: 18, axis: "x", range: 50, speed: 2.8, phase: 1.5 }
    ],
    chasers: [
      { triggerX: 2000, x: 1650, y: 350, speed: 255 }
    ],
    walls: [
      { x: 1560, y: GY - 220, w: 26, h: 220, range: 190, speed: 1.3, phase: 0 },
      { x: 2520, y: GY - 220, w: 26, h: 220, range: 190, speed: 1.5, phase: 0.8 }
    ],
    fakeDoor: null,
    door: P(3660, GY - 90, 60, 90)
  });

  // ---------------- LEVEL 9 : Nightmare ----------------
  LEVELS.push({
    name: "Nightmare",
    bg: "#3d0f0f", platform: "#5c1f1f", accent: "#ffd23f", spike: "#ff3b3b",
    width: 4400,
    spawn: { x: 60, y: GY - 60 },
    platforms: [
      P(0, GY, 400, 80),
      P(520, GY, 180, 80),
      P(820, GY, 180, 80),
      P(1120, GY, 180, 80),
      P(1420, GY, 200, 80),
      P(1740, GY, 180, 80),
      P(2040, GY, 180, 80),
      P(2340, GY, 200, 80),
      P(2660, GY, 180, 80),
      P(2960, GY, 200, 80),
      P(3280, GY, 1120, 80)
    ],
    moving: [
      { x: 1560, y: GY - 100, w: 90, h: 20, axis: "y", range: 100, speed: 1.5, phase: 0 },
      { x: 2500, y: GY - 90, w: 90, h: 20, axis: "x", range: 130, speed: 1.7, phase: 1 }
    ],
    crumble: [
      { x: 700, y: GY, w: 100, h: 24 },
      { x: 2220, y: GY, w: 100, h: 24 }
    ],
    fake: [
      { x: 1300, y: GY, w: 100, h: 24 },
      { x: 2840, y: GY, w: 100, h: 24 }
    ],
    spikes: [
      { x: 1180, y: GY, w: 34, h: 30, orient: "up", triggerDist: 100 },
      { x: 2100, y: GY, w: 34, h: 30, orient: "up", triggerDist: 100 },
      { x: 3040, y: GY, w: 34, h: 30, orient: "up", triggerDist: 100 }
    ],
    fallingSpikes: [
      { x: 1500, y: 30, w: 34, h: 34, triggerDist: 140 },
      { x: 2400, y: 30, w: 34, h: 34, triggerDist: 140 },
      { x: 3100, y: 30, w: 34, h: 34, triggerDist: 140 }
    ],
    saws: [
      { x: 460, y: 445, r: 18, axis: "x", range: 50, speed: 2.4, phase: 0 },
      { x: 1920, y: 380, r: 20, axis: "y", range: 90, speed: 2.2, phase: 1 },
      { x: 2720, y: 445, r: 18, axis: "x", range: 50, speed: 2.6, phase: 0.5 }
    ],
    chasers: [
      { triggerX: 400, x: 50, y: 350, speed: 250 },
      { triggerX: 2200, x: 1850, y: 350, speed: 258 }
    ],
    walls: [
      { x: 3160, y: GY - 220, w: 26, h: 220, range: 190, speed: 1.4, phase: 0.4 }
    ],
    fakeDoor: null,
    door: P(4260, GY - 90, 60, 90)
  });

  // ---------------- LEVEL 10 : Final Devil ----------------
  LEVELS.push({
    name: "Final Devil",
    bg: "#0f0f0f", platform: "#2b2b2b", accent: "#ff3b3b", spike: "#ff3b3b",
    width: 5200,
    spawn: { x: 60, y: GY - 60 },
    platforms: [
      P(0, GY, 380, 80),
      P(500, GY, 160, 80),
      P(780, GY, 160, 80),
      P(1060, GY, 160, 80),
      P(1340, GY, 180, 80),
      P(1640, GY, 160, 80),
      P(1920, GY, 180, 80),
      P(2220, GY, 160, 80),
      P(2500, GY, 180, 80),
      P(2800, GY, 160, 80),
      P(3080, GY, 180, 80),
      P(3380, GY, 160, 80),
      P(3660, GY, 200, 80),
      P(4200, GY, 1000, 80)
    ],
    moving: [
      { x: 1200, y: GY - 100, w: 90, h: 20, axis: "y", range: 100, speed: 1.6, phase: 0 },
      { x: 2360, y: GY - 90, w: 90, h: 20, axis: "x", range: 140, speed: 1.8, phase: 0.7 },
      { x: 3930, y: GY - 100, w: 100, h: 20, axis: "y", range: 110, speed: 1.5, phase: 1.2 }
    ],
    crumble: [
      { x: 660, y: GY, w: 100, h: 24 },
      { x: 1800, y: GY, w: 100, h: 24 },
      { x: 2940, y: GY, w: 100, h: 24 }
    ],
    fake: [
      { x: 940, y: GY, w: 100, h: 24 },
      { x: 2380, y: GY, w: 100, h: 24 },
      { x: 3540, y: GY, w: 100, h: 24 }
    ],
    spikes: [
      { x: 1400, y: GY, w: 34, h: 30, orient: "up", triggerDist: 100 },
      { x: 2100, y: GY, w: 34, h: 30, orient: "up", triggerDist: 100 },
      { x: 2860, y: GY, w: 34, h: 30, orient: "up", triggerDist: 100 },
      { x: 3720, y: GY, w: 34, h: 30, orient: "up", triggerDist: 100 }
    ],
    fallingSpikes: [
      { x: 1120, y: 30, w: 34, h: 34, triggerDist: 140 },
      { x: 1980, y: 30, w: 34, h: 34, triggerDist: 140 },
      { x: 2650, y: 30, w: 34, h: 34, triggerDist: 140 },
      { x: 3440, y: 30, w: 34, h: 34, triggerDist: 140 }
    ],
    saws: [
      { x: 440, y: 445, r: 18, axis: "x", range: 50, speed: 2.6, phase: 0 },
      { x: 1520, y: 380, r: 20, axis: "y", range: 95, speed: 2.4, phase: 1 },
      { x: 2660, y: 445, r: 18, axis: "x", range: 50, speed: 2.8, phase: 0.5 },
      { x: 3860, y: 430, r: 20, axis: "x", range: 120, speed: 2.0, phase: 0 }
    ],
    chasers: [
      { triggerX: 350, x: 0, y: 350, speed: 258 },
      { triggerX: 2400, x: 2050, y: 350, speed: 270 }
    ],
    walls: [
      { x: 1700, y: GY - 220, w: 26, h: 220, range: 190, speed: 1.4, phase: 0 },
      { x: 3220, y: GY - 220, w: 26, h: 220, range: 190, speed: 1.6, phase: 0.9 }
    ],
    fakeDoor: P(4400, GY - 90, 60, 90),
    door: P(5060, GY - 90, 60, 90)
  });

  /* =========================================================
     PHYSICS CONSTANTS (design units)
  ========================================================= */
  var GRAVITY = 2400;
  var JUMP_VELOCITY = -840;
  var MOVE_SPEED = 300;
  var FRICTION_GROUND = 2400;
  var PLAYER_W = 30;
  var PLAYER_H = 46;

  /* =========================================================
     GAME STATE
  ========================================================= */
  var currentLevelIndex = 0;
  var level = null;
  var player = null;
  var camera = { x: 0, y: 0 };
  var tries = 1;
  var levelActive = false;
  var paused = false;
  var levelStartTime = 0;
  var lastTime = 0;

  function startLevel(idx) {
    level = cloneLevel(LEVELS[idx]);
    tries = 1;
    hudLevel.textContent = "Level " + (idx + 1) + ": " + level.name;
    hudTries.textContent = "Tries: " + tries;
    resetPlayer();
    camera.x = 0;
    camera.y = 0;
    levelActive = true;
    paused = false;
    levelCompleteOverlay.classList.add("hidden");
    pauseOverlay.classList.add("hidden");
    showReady(level.name);
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function cloneLevel(raw) {
    return JSON.parse(JSON.stringify(raw));
  }

  function resetPlayer() {
    player = {
      x: level.spawn.x,
      y: level.spawn.y,
      w: PLAYER_W,
      h: PLAYER_H,
      vx: 0,
      vy: 0,
      grounded: false,
      facing: 1,
      standingOn: null,
      alive: true
    };
    level.moving.forEach(function (m) { m.baseX = m.x; m.baseY = m.y; m.t = m.phase || 0; });
    level.walls.forEach(function (w) { w.baseY = w.y; w.t = w.phase || 0; });
    level.crumble.forEach(function (c) { c.state = "idle"; c.timer = 0; c.gone = false; });
    level.fake.forEach(function (f) { f.state = "idle"; f.timer = 0; f.gone = false; });
    level.spikes.forEach(function (s) { s.state = "idle"; s.timer = 0; });
    level.fallingSpikes.forEach(function (f) {
      f.state = "idle"; f.timer = 0; f.curY = f.y; f.vy = 0;
    });
    level.saws.forEach(function (s) { s.baseX = s.x; s.baseY = s.y; s.t = s.phase || 0; s.angle = 0; });
    level.chasers.forEach(function (c) {
      c.active = false;
      c.cx = c.x; c.cy = c.y;
      c.wob = Math.random() * 6.28;
    });
  }

  var READY_SUBS = [
    "Don't look back...",
    "Something is behind you...",
    "Trust nothing.",
    "The floor lies.",
    "Run.",
    "It sees you.",
    "No mercy.",
    "Faster. FASTER.",
    "The devils are hungry.",
    "One way out."
  ];

  function showReady(name) {
    readyTitle.textContent = name;
    readySub.textContent = READY_SUBS[currentLevelIndex % READY_SUBS.length];
    readyOverlay.classList.remove("hidden");
    setTimeout(function () { readyOverlay.classList.add("hidden"); }, 1100);
  }

  function die(silent) {
    if (!player.alive) return;
    player.alive = false;
    if (!silent) Sound.death();
    tries++;
    hudTries.textContent = "Tries: " + tries;
    setTimeout(function () {
      resetPlayer();
    }, 350);
  }

  function completeLevel() {
    levelActive = false;
    Sound.win();
    lcTries.textContent = "Finished in " + tries + " " + (tries === 1 ? "try" : "tries");
    levelCompleteOverlay.classList.remove("hidden");
  }

  /* =========================================================
     UPDATE
  ========================================================= */
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function update(dt) {
    if (!levelActive || paused) return;
    if (!player.alive) return;

    // -------- moving platforms --------
    level.moving.forEach(function (m) {
      m.t += dt * m.speed;
      if (m.axis === "x") {
        m.x = m.baseX + Math.sin(m.t) * m.range;
      } else {
        m.y = m.baseY + Math.sin(m.t) * m.range;
      }
    });

    // -------- saws --------
    level.saws.forEach(function (s) {
      s.t += dt * s.speed;
      s.angle += dt * 9;
      if (s.axis === "x") {
        s.x = s.baseX + Math.sin(s.t) * s.range;
      } else {
        s.y = s.baseY + Math.sin(s.t) * s.range;
      }
    });

    // -------- chasers (flying devils) --------
    level.chasers.forEach(function (c) {
      if (!c.active) {
        if (player.x > c.triggerX) {
          c.active = true;
          c.cx = Math.min(c.x, player.x - 260);
          c.cy = player.y - 60;
          Sound.spawn();
        }
        return;
      }
      c.wob += dt * 6;
      var pcx = player.x + player.w / 2;
      var pcy = player.y + player.h / 2;
      var dx = pcx - c.cx;
      var dy = pcy - c.cy;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var sp = c.speed;
      c.cx += (dx / dist) * sp * dt;
      c.cy += (dy / dist) * sp * dt + Math.sin(c.wob) * 30 * dt;
    });

    // -------- moving walls --------
    level.walls.forEach(function (w) {
      w.t += dt * w.speed;
      w.y = w.baseY + Math.sin(w.t) * w.range - w.range;
    });

    // -------- spike triggers (floor spikes) --------
    level.spikes.forEach(function (s) {
      var dist = Math.abs((player.x + player.w / 2) - (s.x + s.w / 2));
      if (s.state === "idle" && dist < s.triggerDist) {
        s.state = "warning"; s.timer = 0;
        Sound.warn();
      } else if (s.state === "warning") {
        s.timer += dt;
        if (s.timer > 0.32) { s.state = "active"; s.timer = 0; }
      } else if (s.state === "active") {
        s.timer += dt;
        if (s.timer > 1.1) { s.state = "cooldown"; s.timer = 0; }
      } else if (s.state === "cooldown") {
        s.timer += dt;
        if (s.timer > 0.8 && dist > s.triggerDist + 60) { s.state = "idle"; s.timer = 0; }
      }
    });

    // -------- falling spikes --------
    level.fallingSpikes.forEach(function (f) {
      var dist = Math.abs((player.x + player.w / 2) - (f.x + f.w / 2));
      if (f.state === "idle" && dist < f.triggerDist) {
        f.state = "warning"; f.timer = 0;
        Sound.warn();
      } else if (f.state === "warning") {
        f.timer += dt;
        if (f.timer > 0.28) { f.state = "falling"; f.vy = 0; }
      } else if (f.state === "falling") {
        f.vy += GRAVITY * 1.4 * dt;
        f.curY += f.vy * dt;
        if (f.curY > GY - f.h) {
          f.curY = GY - f.h;
          f.state = "landed"; f.timer = 0;
        }
      } else if (f.state === "landed") {
        f.timer += dt;
        if (f.timer > 1.4 && dist > f.triggerDist + 80) {
          f.state = "idle"; f.curY = f.y; f.vy = 0;
        }
      }
    });

    // -------- crumble platforms --------
    level.crumble.forEach(function (c) {
      if (c.gone) return;
      var onIt = player.grounded && player.standingOn === c;
      if (c.state === "idle" && onIt) { c.state = "shaking"; c.timer = 0; }
      else if (c.state === "shaking") {
        c.timer += dt;
        if (c.timer > 0.45) { c.state = "gone"; c.gone = true; }
      }
    });

    // -------- fake platforms --------
    level.fake.forEach(function (f) {
      if (f.gone) return;
      var onIt = player.grounded && player.standingOn === f;
      if (f.state === "idle" && onIt) { f.state = "shaking"; f.timer = 0; }
      else if (f.state === "shaking") {
        f.timer += dt;
        if (f.timer > 0.15) { f.state = "gone"; f.gone = true; }
      }
    });

    // -------- horizontal input --------
    var move = 0;
    if (input.left) move -= 1;
    if (input.right) move += 1;
    if (move !== 0) {
      player.vx += move * MOVE_SPEED * 6 * dt;
      player.vx = Math.max(-MOVE_SPEED, Math.min(MOVE_SPEED, player.vx));
      player.facing = move;
    } else {
      var decel = FRICTION_GROUND * dt;
      if (Math.abs(player.vx) <= decel) player.vx = 0;
      else player.vx -= Math.sign(player.vx) * decel;
    }

    // -------- jump --------
    if (input.jumpPressed && player.grounded) {
      player.vy = JUMP_VELOCITY;
      player.grounded = false;
      Sound.jump();
    }
    input.jumpPressed = false;

    // -------- gravity --------
    player.vy += GRAVITY * dt;
    if (player.vy > 1600) player.vy = 1600;

    // -------- carry player on moving platform --------
    var carryDX = 0, carryDY = 0;
    if (player.grounded && player.standingOn && player.standingOn._isMoving) {
      var mp = player.standingOn;
      carryDX = mp.x - mp._prevX;
      carryDY = mp.y - mp._prevY;
    }

    // -------- integrate --------
    player.x += player.vx * dt + carryDX;
    player.y += player.vy * dt + carryDY;

    // -------- collision vs solids --------
    player.grounded = false;
    player.standingOn = null;
    var solids = collectSolids();

    solids.forEach(function (s) {
      if (!rectsOverlap(player, s)) return;
      var overlapX = Math.min(player.x + player.w - s.x, s.x + s.w - player.x);
      var overlapY = Math.min(player.y + player.h - s.y, s.y + s.h - player.y);
      if (overlapX < overlapY) {
        if (player.x < s.x) player.x -= overlapX; else player.x += overlapX;
        player.vx = 0;
      } else {
        if (player.y < s.y) {
          player.y -= overlapY;
          if (player.vy >= 0) {
            player.vy = 0;
            player.grounded = true;
            player.standingOn = s;
          }
        } else {
          player.y += overlapY;
          if (player.vy < 0) player.vy = 0;
        }
      }
    });

    level.moving.forEach(function (m) {
      m._isMoving = true;
      m._prevX = m.x; m._prevY = m.y;
    });

    // -------- hazards --------
    checkHazards();

    // -------- world bounds / fall death --------
    if (player.y > DEATH_Y) die();
    if (player.x < 0) player.x = 0;

    // -------- fake door (Level Devil style: it kills!) --------
    if (level.fakeDoor && rectsOverlap(player, level.fakeDoor)) {
      Sound.fake();
      die(true);
      return;
    }

    // -------- real door --------
    if (rectsOverlap(player, level.door)) {
      completeLevel();
    }

    // -------- camera --------
    var targetX = player.x - canvasDesignWidth() * 0.4;
    targetX = Math.max(0, Math.min(level.width - canvasDesignWidth(), targetX));
    camera.x += (targetX - camera.x) * Math.min(1, dt * 6);
  }

  function canvasDesignWidth() {
    return canvas.width / SCALE;
  }

  function collectSolids() {
    var list = [];
    level.platforms.forEach(function (p) { list.push(p); });
    level.moving.forEach(function (m) { list.push(m); });
    level.crumble.forEach(function (c) { if (!c.gone) list.push(c); });
    level.fake.forEach(function (f) { if (!f.gone) list.push(f); });
    return list;
  }

  function checkHazards() {
    // floor/pop spikes
    level.spikes.forEach(function (s) {
      if (s.state !== "active") return;
      var hb = spikeHitbox(s);
      if (rectsOverlap(player, hb)) die();
    });
    // falling spikes
    level.fallingSpikes.forEach(function (f) {
      if (f.state !== "falling" && f.state !== "landed") return;
      var hb = { x: f.x, y: f.curY, w: f.w, h: f.h };
      if (rectsOverlap(player, hb)) die();
    });
    // moving walls
    level.walls.forEach(function (w) {
      var hb = { x: w.x, y: w.y, w: w.w, h: w.h };
      if (rectsOverlap(player, hb)) die();
    });
    // saws (slightly forgiving hitbox)
    level.saws.forEach(function (s) {
      var r = s.r * 0.82;
      var hb = { x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 };
      if (rectsOverlap(player, hb)) die();
    });
    // chasers
    level.chasers.forEach(function (c) {
      if (!c.active) return;
      var hb = { x: c.cx - 15, y: c.cy - 15, w: 30, h: 30 };
      if (rectsOverlap(player, hb)) die();
    });
  }

  function spikeHitbox(s) {
    if (s.orient === "up") return { x: s.x, y: s.y - s.h * spikeExtend(s), w: s.w, h: s.h * spikeExtend(s) };
    return { x: s.x, y: s.y, w: s.w, h: s.h };
  }
  function spikeExtend(s) {
    if (s.state === "active") return 1;
    if (s.state === "warning") return 0.15;
    return 0;
  }

  /* =========================================================
     RENDER
  ========================================================= */
  function render() {
    var w = canvas.width, h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!level) { ctx.fillStyle = "#111"; ctx.fillRect(0, 0, w, h); return; }

    ctx.fillStyle = level.bg;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.translate(-camera.x, -camera.y);

    // platforms
    level.platforms.forEach(function (p) { drawRect(p, level.platform); });

    // moving platforms
    level.moving.forEach(function (m) { drawRect(m, level.accent, level.platform); });

    // crumble platforms
    level.crumble.forEach(function (c) {
      if (c.gone) return;
      var alpha = c.state === "shaking" ? (0.5 + 0.5 * Math.sin(performance.now() / 40)) : 1;
      ctx.globalAlpha = alpha;
      drawRect(c, "#B36B00");
      ctx.globalAlpha = 1;
    });

    // fake platforms (visually identical to normal ground)
    level.fake.forEach(function (f) {
      if (f.gone) return;
      drawRect(f, level.platform);
    });

    // moving walls
    level.walls.forEach(function (w) {
      drawRect(w, "#3a3a3a", level.spike);
    });

    // floor spikes
    level.spikes.forEach(function (s) {
      drawSpike(s);
    });

    // falling spikes
    level.fallingSpikes.forEach(function (f) {
      if (f.state === "idle") {
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(f.x + f.w / 2 - 2, 0, 4, 14);
      } else {
        drawTriangleDown({ x: f.x, y: f.curY, w: f.w, h: f.h }, level.spike);
      }
    });

    // saws
    level.saws.forEach(function (s) { drawSaw(s); });

    // chasers (devils)
    level.chasers.forEach(function (c) { if (c.active) drawChaser(c); });

    // fake door (looks exactly like the real one... trust nothing)
    if (level.fakeDoor) drawDoor(level.fakeDoor, level.accent);

    // real door
    drawDoor(level.door, level.accent);

    // player
    drawPlayer();

    ctx.restore();
  }

  function drawRect(r, color, strokeColor) {
    ctx.fillStyle = color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    }
  }

  function drawTriangleDown(r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(r.x, r.y);
    ctx.lineTo(r.x + r.w, r.y);
    ctx.lineTo(r.x + r.w / 2, r.y + r.h);
    ctx.closePath();
    ctx.fill();
  }

  function drawSpike(s) {
    var ext = spikeExtend(s);
    if (ext <= 0.02 && s.state === "idle") return;
    var hh = s.h * ext;
    var baseColor = s.state === "warning" ? shade(level.spike, 40) : level.spike;
    ctx.fillStyle = baseColor;
    var n = 3;
    var segW = s.w / n;
    for (var i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(s.x + i * segW, s.y);
      ctx.lineTo(s.x + (i + 0.5) * segW, s.y - hh);
      ctx.lineTo(s.x + (i + 1) * segW, s.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawSaw(s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    // blade
    ctx.fillStyle = "#c9ccd4";
    var teeth = 10;
    ctx.beginPath();
    for (var i = 0; i < teeth * 2; i++) {
      var rr = (i % 2 === 0) ? s.r : s.r * 0.78;
      var a = (i / (teeth * 2)) * Math.PI * 2;
      var px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    // hub
    ctx.fillStyle = "#ff3b3b";
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawChaser(c) {
    var x = c.cx, y = c.cy;
    // glow
    ctx.fillStyle = "rgba(255,59,59,0.25)";
    ctx.beginPath();
    ctx.arc(x, y, 30 + Math.sin(c.wob) * 3, 0, Math.PI * 2);
    ctx.fill();
    // horns
    ctx.fillStyle = "#7a1010";
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 12);
    ctx.lineTo(x - 22, y - 30);
    ctx.lineTo(x - 6, y - 18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 14, y - 12);
    ctx.lineTo(x + 22, y - 30);
    ctx.lineTo(x + 6, y - 18);
    ctx.closePath();
    ctx.fill();
    // body
    ctx.fillStyle = "#d21f1f";
    ctx.beginPath();
    ctx.arc(x, y, 17, 0, Math.PI * 2);
    ctx.fill();
    // angry eyes
    ctx.fillStyle = "#ffe14d";
    var lookX = player ? Math.max(-3, Math.min(3, (player.x - x) * 0.02)) : 0;
    ctx.beginPath();
    ctx.arc(x - 6 + lookX, y - 3, 4, 0, Math.PI * 2);
    ctx.arc(x + 6 + lookX, y - 3, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1a0505";
    ctx.beginPath();
    ctx.arc(x - 6 + lookX, y - 3, 1.8, 0, Math.PI * 2);
    ctx.arc(x + 6 + lookX, y - 3, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // angry brows
    ctx.strokeStyle = "#5c0d0d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 11, y - 11); ctx.lineTo(x - 2, y - 7);
    ctx.moveTo(x + 11, y - 11); ctx.lineTo(x + 2, y - 7);
    ctx.stroke();
  }

  function shade(hex, amt) {
    var c = parseInt(hex.slice(1), 16);
    var r = Math.min(255, ((c >> 16) & 255) + amt);
    var g = Math.min(255, ((c >> 8) & 255) + amt);
    var b = Math.min(255, (c & 255) + amt);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function drawDoor(d, accent) {
    ctx.fillStyle = "#1c1c1c";
    ctx.fillRect(d.x - 4, d.y - 4, d.w + 8, d.h + 8);
    ctx.fillStyle = accent;
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = "#1c1c1c";
    ctx.beginPath();
    ctx.arc(d.x + d.w - 10, d.y + d.h / 2, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer() {
    var c = CHARACTERS[selectedCharacter];
    if (!player.alive) return;
    ctx.fillStyle = c.color;
    roundRect(player.x, player.y, player.w, player.h, 8);
    ctx.fill();
    ctx.fillStyle = "#1a1a1a";
    var eyeY = player.y + player.h * 0.32;
    var eyeOffset = player.facing >= 0 ? player.w * 0.55 : player.w * 0.2;
    ctx.beginPath();
    ctx.arc(player.x + eyeOffset, eyeY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* =========================================================
     LOOP
  ========================================================= */
  function loop(now) {
    if (!levelActive) return;
    var dt = Math.min(0.033, (now - lastTime) / 1000);
    lastTime = now;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

})();
