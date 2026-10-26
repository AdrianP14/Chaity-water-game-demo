(() => {
  "use strict";

  const GAME_LENGTH = 30;
  const MAX_LIVES = 3;
  const DROP_POINTS = 10;
  const TRASH_PENALTY = 5;
  const PLAYER_X = 0.13;
  const player = document.getElementById("player");
  const area = document.getElementById("game-area");
  const entityLayer = document.getElementById("entity-layer");
  const scoreDisplay = document.getElementById("score");
  const timeDisplay = document.getElementById("time");
  const heartsDisplay = document.getElementById("hearts");
  const meter = document.getElementById("meter");
  const meterFill = document.getElementById("meter-fill");
  const meterValue = document.getElementById("meter-value");
  const startScreen = document.getElementById("start-screen");
  const endScreen = document.getElementById("end-screen");
  const resetButton = document.getElementById("reset-button");
  const celebration = document.getElementById("celebration");
  const toast = document.getElementById("toast");

  let running = false;
  let animationFrame = 0;
  let lastFrameTime = 0;
  let elapsed = 0;
  let score = 0;
  let dropsCollected = 0;
  let lives = MAX_LIVES;
  let cleanliness = 0;
  let playerY = 0.5;
  let verticalSpeed = 0;
  let spawnElapsed = 0;
  let powerElapsed = 0;
  let invulnerableUntil = 0;
  let toastTimeout = 0;
  let entities = [];
  let nextEntityId = 0;

  function updateHud() {
    scoreDisplay.textContent = String(score);
    timeDisplay.textContent = String(Math.max(0, Math.ceil(GAME_LENGTH - elapsed)));
    heartsDisplay.textContent = Array.from({ length: MAX_LIVES }, (_, index) => index < lives ? "♥" : "♡").join(" ");
    heartsDisplay.setAttribute("aria-label", `${lives} ${lives === 1 ? "life" : "lives"} remaining`);
    meterFill.style.width = `${cleanliness}%`;
    meterValue.textContent = `${cleanliness}%`;
    meter.setAttribute("aria-valuenow", String(cleanliness));
    area.style.setProperty("--river-clear", String(cleanliness / 100));
  }

  function clearEntities() {
    entities = [];
    entityLayer.replaceChildren();
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove("show"), 1050);
  }

  function addEntity(type, x, y) {
    const element = document.createElement("div");
    element.className = `entity entity-${type}`;
    element.textContent = type === "drop" ? "💧" : type === "trash" ? "🗑️" : "✦";
    element.setAttribute("aria-hidden", "true");
    entityLayer.append(element);
    const entity = {
      id: nextEntityId++,
      type,
      x,
      y,
      element,
      width: type === "drop" ? 50 : 34,
      height: type === "drop" ? 54 : 34,
      speed: type === "drop" ? 195 : type === "trash" ? 175 : 165,
      hit: false
    };
    entities.push(entity);
    placeEntity(entity);
  }

  function placeEntity(entity) {
    entity.element.style.left = `${entity.x}px`;
    entity.element.style.top = `${entity.y}px`;
  }

  function spawn(type) {
    const height = area.clientHeight;
    const safeMargin = 38;
    addEntity(type, area.clientWidth + 30, safeMargin + Math.random() * Math.max(1, height - safeMargin * 2));
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
  }

  function collect(entity) {
    if (entity.type === "drop") {
      score += DROP_POINTS;
      dropsCollected += 1;
      cleanliness = Math.min(100, cleanliness + 10);
      updateHud();
      showToast("+10 · Water drop collected!");
    } else if (entity.type === "power") {
      const trash = entities.filter((item) => item.type === "trash");
      for (const item of trash) item.element.remove();
      entities = entities.filter((item) => item.type !== "trash");
      showToast("Current cleared!");
    }
    entity.element.remove();
    entities = entities.filter((item) => item.id !== entity.id);
  }

  function hitTrash(entity, now) {
    if (entity.hit || now < invulnerableUntil) return;
    entity.hit = true;
    invulnerableUntil = now + 950;
    lives -= 1;
    score = Math.max(0, score - TRASH_PENALTY);
    player.classList.remove("hit");
    void player.offsetWidth;
    player.classList.add("hit");
    window.setTimeout(() => player.classList.remove("hit"), 950);
    updateHud();
    showToast("-5 · Watch out!");
    if (lives <= 0) endGame(false);
  }

  function swimUp() {
    if (!running) return;
    verticalSpeed = -420;
  }

  function finishCelebration() {
    celebration.replaceChildren();
    const colors = ["#ffd447", "#45c5dc", "#ffffff", "#4dbb87", "#f18a73"];
    for (let i = 0; i < 75; i += 1) {
      const piece = document.createElement("i");
      piece.className = "confetti";
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.backgroundColor = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 1.1}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      celebration.append(piece);
    }
  }

  function endGame(won) {
    if (!running) return;
    running = false;
    window.cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    resetButton.hidden = true;
    document.getElementById("final-score").textContent = String(score);
    document.getElementById("final-drops").textContent = String(dropsCollected);
    document.getElementById("end-title").textContent = won ? "You made it!" : "The current got you.";
    document.getElementById("end-eyebrow").textContent = won ? "RIVER RESCUE COMPLETE" : "RIVER REPORT";
    document.getElementById("end-icon").textContent = won ? "🎉" : "💧";
    endScreen.hidden = false;
    if (won) finishCelebration();
    else celebration.replaceChildren();
  }

  function startGame() {
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
    running = false;
    clearEntities();
    celebration.replaceChildren();
    window.clearTimeout(toastTimeout);
    toast.classList.remove("show");
    player.classList.remove("hit");
    score = 0;
    dropsCollected = 0;
    lives = MAX_LIVES;
    cleanliness = 0;
    playerY = area.clientHeight / 2;
    verticalSpeed = 0;
    elapsed = 0;
    spawnElapsed = 0;
    powerElapsed = 0;
    invulnerableUntil = 0;
    lastFrameTime = 0;
    player.style.top = `${playerY}px`;
    updateHud();
    startScreen.hidden = true;
    endScreen.hidden = true;
    resetButton.hidden = false;
    running = true;
    animationFrame = window.requestAnimationFrame(gameFrame);
  }

  function gameFrame(timestamp) {
    if (!running) return;
    const frameTime = lastFrameTime ? (timestamp - lastFrameTime) / 1000 : 0;
    const delta = Math.min(frameTime, 0.05);
    lastFrameTime = timestamp;
    elapsed += frameTime;

    const height = area.clientHeight;
    const width = area.clientWidth;
    verticalSpeed += 680 * delta;
    playerY = Math.max(38, Math.min(height - 38, playerY + verticalSpeed * delta));
    if (playerY <= 38 || playerY >= height - 38) verticalSpeed = 0;
    player.style.top = `${playerY}px`;

    spawnElapsed += delta;
    powerElapsed += delta;
    if (spawnElapsed >= 1.05) {
      spawnElapsed = 0;
      spawn(Math.random() < 0.48 ? "drop" : "trash");
    }
    if (powerElapsed >= 9.5) {
      powerElapsed = 0;
      spawn("power");
    }

    const now = performance.now();
    const playerX = width * PLAYER_X;
    for (const entity of [...entities]) {
      if (!entities.some((item) => item.id === entity.id)) continue;
      entity.x -= entity.speed * delta;
      placeEntity(entity);
      if (entity.type === "trash" && rectsOverlap(playerX, playerY, 40, 38, entity.x, entity.y, entity.width, entity.height)) {
        hitTrash(entity, now);
        if (!running) return;
      } else if (entity.type !== "trash" && rectsOverlap(playerX, playerY, 40, 38, entity.x, entity.y, entity.width, entity.height)) {
        collect(entity);
      }
      if (entity.x < -40) {
        entity.element.remove();
        entities = entities.filter((item) => item.id !== entity.id);
      }
    }

    updateHud();
    if (elapsed >= GAME_LENGTH) {
      elapsed = GAME_LENGTH;
      updateHud();
      endGame(true);
      return;
    }
    animationFrame = window.requestAnimationFrame(gameFrame);
  }

  document.getElementById("play-button").addEventListener("click", startGame);
  document.getElementById("play-again-button").addEventListener("click", startGame);
  resetButton.addEventListener("click", startGame);
  area.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a")) return;
    swimUp();
  });
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" && running) {
      event.preventDefault();
      swimUp();
    }
  });
  window.addEventListener("resize", () => {
    if (!running) return;
    playerY = Math.max(38, Math.min(area.clientHeight - 38, playerY));
    player.style.top = `${playerY}px`;
    for (const entity of entities) placeEntity(entity);
  });

  updateHud();
})();
