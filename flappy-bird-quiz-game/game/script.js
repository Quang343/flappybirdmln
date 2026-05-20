const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const playerNameLabel = document.getElementById("playerNameLabel");
const playerNameInput = document.getElementById("playerNameInput");

const startScreen = document.getElementById("startScreen");
const questionPopup = document.getElementById("questionPopup");
const countdownPopup = document.getElementById("countdownPopup");
const gameOverScreen = document.getElementById("gameOverScreen");

const questionText = document.getElementById("questionText");
const questionOptions = document.getElementById("questionOptions");
const questionForm = document.getElementById("questionForm");
const questionTimerBar = document.getElementById("questionTimerBar");
const questionTimerLabel = document.getElementById("questionTimerLabel");
const countdownText = document.getElementById("countdownText");
const gameOverMessage = document.getElementById("gameOverMessage");
const rankDisplay = document.getElementById("rankDisplay");
const rankBadge = document.getElementById("rankBadge");
const rankSubtext = document.getElementById("rankSubtext");
const bestScoreText = document.getElementById("bestScoreText");

const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const playerIdHint = document.getElementById("playerIdHint");

const devtoolOverlay = document.getElementById("devtoolOverlay");
const devtoolListBody = document.getElementById("devtoolListBody");
const closeDevtoolBtn = document.getElementById("closeDevtoolBtn");

const devtoolAdminStatus = document.getElementById("devtoolAdminStatus");
const tabLocalBtn = document.getElementById("tabLocalBtn");
const tabLeaderboardBtn = document.getElementById("tabLeaderboardBtn");
const devtoolLocalTab = document.getElementById("devtoolLocalTab");
const devtoolLeaderboardTab = document.getElementById("devtoolLeaderboardTab");
const devtoolLoginContainer = document.getElementById("devtoolLoginContainer");
const devtoolAdminControls = document.getElementById("devtoolAdminControls");
const devtoolPasswordInput = document.getElementById("devtoolPasswordInput");
const devtoolLoginBtn = document.getElementById("devtoolLoginBtn");
const devtoolLogoutBtn = document.getElementById("devtoolLogoutBtn");
const devtoolLoginMsg = document.getElementById("devtoolLoginMsg");
const devtoolLeaderboardBody = document.getElementById("devtoolLeaderboardBody");

const PLAYER_PROFILE_KEY = "flappyQuizPlayerProfile";
const USED_IDS_KEY = "flappyQuizUsedIds";
const isServerMode = window.location.protocol.startsWith("http");

// Bật bằng phím H hoặc URL ?hitbox=1 — hiện vùng va chạm trên canvas
let showHitboxes =
  new URLSearchParams(window.location.search).get("hitbox") === "1" ||
  new URLSearchParams(window.location.search).get("debug") === "1";

const gameConfig = {
  width: canvas.width,
  height: canvas.height,
  gravity: 900,
  flapVelocity: -320,
  pipeSpeed: 190,
  pipeWidth: 82,
  pipeGap: 170,
  spawnInterval: 1650,
  groundHeight: 96,
};

const bird = {
  x: 110,
  y: gameConfig.height / 2,
  width: 100,
  height: 78,
  /** Chiều rộng / cao hitbox (px). Đặt số cụ thể để chỉnh từng chiều. */
  hitboxWidth: 45,
  hitboxHeight: 31,
  /** Chỉ dùng khi không đặt hitboxWidth / hitboxHeight — thu đều mỗi cạnh. */
  hitboxInset: 0,
  velocityY: 0,
  rotation: 0,
};

let pipes = [];
let score = 0;
let gameState = "menu";
let playerName = "";
let playerId = "";
let questions = [];
let usedQuestionIndexes = new Set();
let recentQuestionIndexes = [];
let currentQuestion = null;
let lastTimestamp = 0;
let spawnTimer = 0;
let animationFrameId = null;
let questionTimerInterval = null;
let questionTimerStart = 0;
let questionTimerElapsedBeforePause = 0;
let questionTimerIsPaused = false;

const QUIZ_TIME_LIMIT_MS = 15000;

const birdImage = new Image();
birdImage.src = "../assets/images/bird.png";

const pipeImage = new Image();
pipeImage.src = "../assets/images/pipe.png";

// Cấu hình âm lượng cho tất cả âm thanh trong game (giá trị từ 0.0 đến 1.0)
const soundVolumes = {
  bgm: 1.0,          // Âm lượng nhạc nền
  death: 1.0,        // Âm lượng khi game over
  quiz: 1.0,         // Âm lượng khi mở câu hỏi
  correct: 1.0,      // Âm lượng khi trả lời đúng
  incorrect: 1.0,    // Âm lượng khi trả lời sai
};

const bgmAudio = new Audio("../assets/sounds/background.mp3");
bgmAudio.loop = true;
bgmAudio.volume = soundVolumes.bgm;

const deathAudio = new Audio("../assets/sounds/death.mp3");
deathAudio.volume = soundVolumes.death;

let bgmAudioWorks = true;
let deathAudioWorks = true;

bgmAudio.addEventListener("error", () => {
  bgmAudioWorks = false;
});

deathAudio.addEventListener("error", () => {
  deathAudioWorks = false;
});

const quizAudio = new Audio("../assets/sounds/quiz.mp3");
quizAudio.volume = soundVolumes.quiz;
const correctAudio = new Audio("../assets/sounds/correct.mp3");
correctAudio.volume = soundVolumes.correct;
const incorrectAudio = new Audio("../assets/sounds/incorrect.mp3");
incorrectAudio.volume = soundVolumes.incorrect;

let quizAudioWorks = true;
let correctAudioWorks = true;
let incorrectAudioWorks = true;

quizAudio.addEventListener("error", () => { quizAudioWorks = false; });
correctAudio.addEventListener("error", () => { correctAudioWorks = false; });
incorrectAudio.addEventListener("error", () => { incorrectAudioWorks = false; });

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let fallbackBgmNodes = null;
let fallbackQuizInterval = null;

function startFallbackBgm() {
  stopFallbackBgm();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.value = 146.83;
  // Giả lập âm lượng nhạc nền dựa trên soundVolumes.bgm
  gain.gain.value = 0.15 * soundVolumes.bgm;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  fallbackBgmNodes = { osc, gain };
}

function stopFallbackBgm() {
  if (!fallbackBgmNodes) return;
  fallbackBgmNodes.osc.stop();
  fallbackBgmNodes = null;
}

function playFallbackDeath() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(420, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.35);
  // Giả lập âm lượng dựa trên soundVolumes.death
  gain.gain.setValueAtTime(0.45 * soundVolumes.death, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.38);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.4);
}

function playFallbackQuiz() {
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => { });
  stopFallbackQuiz();

  const playTick = () => {
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    // Giả lập âm lượng dựa trên soundVolumes.quiz
    gain.gain.setValueAtTime(0.12 * soundVolumes.quiz, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  };

  playTick();
  fallbackQuizInterval = setInterval(playTick, 1000);
}

function stopFallbackQuiz() {
  if (fallbackQuizInterval) {
    clearInterval(fallbackQuizInterval);
    fallbackQuizInterval = null;
  }
}

function playFallbackCorrect() {
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => { });
  const now = audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, index) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, now + index * 0.08);
    // Giả lập âm lượng dựa trên soundVolumes.correct
    gain.gain.setValueAtTime(0.4 * soundVolumes.correct, now + index * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.08 + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now + index * 0.08);
    osc.stop(now + index * 0.08 + 0.3);
  });
}

function playFallbackIncorrect() {
  if (audioCtx.state === "suspended") audioCtx.resume().catch(() => { });
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(120, now);
  osc.frequency.linearRampToValueAtTime(80, now + 0.45);
  // Giả lập âm lượng dựa trên soundVolumes.incorrect
  gain.gain.setValueAtTime(0.5 * soundVolumes.incorrect, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.47);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.47);
}

function playQuizSound() {
  if (quizAudioWorks) {
    quizAudio.currentTime = 0;
    quizAudio.loop = true;
    quizAudio.play().catch(() => playFallbackQuiz());
  } else {
    playFallbackQuiz();
  }
}

function stopQuizSound() {
  quizAudio.pause();
  quizAudio.currentTime = 0;
  stopFallbackQuiz();
}

function playCorrectSound() {
  if (correctAudioWorks) {
    correctAudio.currentTime = 0;
    correctAudio.play().catch(() => playFallbackCorrect());
  } else {
    playFallbackCorrect();
  }
}

function playIncorrectSound() {
  if (incorrectAudioWorks) {
    incorrectAudio.currentTime = 0;
    incorrectAudio.play().catch(() => playFallbackIncorrect());
  } else {
    playFallbackIncorrect();
  }
}

async function loadQuestions() {
  try {
    if (isServerMode) {
      const response = await fetch("../api/questions/metadata");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      const count = data.totalQuestions || 0;
      questions = Array.from({ length: count }, (_, i) => ({ index: i }));
      console.info(`Đã tải ${questions.length} câu hỏi từ API Server (chế độ bảo mật).`);
    } else {
      const response = await fetch("../questions/questions.md");
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const markdown = await response.text();
      questions = parseQuestionsFromMarkdown(markdown);
      console.info(`Đã tải ${questions.length} câu hỏi trực tiếp (chế độ offline).`);
    }
  } catch (error) {
    questions = [];
    console.error("Không thể tải câu hỏi:", error);
  }
}

function parseQuestionsFromMarkdown(markdown) {
  const list = [];
  // Tach theo tung muc "## Question N" (tranh regex \s*$ voi flag /m cat som tung dong).
  const blocks = markdown.split(/^##\s+Question\s+\d+\s*/m).slice(1);

  for (const block of blocks) {
    const questionMatch = block.match(/Câu hỏi:\s*(.+)/i);
    const answerMatch = block.match(/Đáp án:\s*([A-D])/i);
    const options = [];
    const optionRegex = /^([A-D])\.\s*(.+)$/gm;
    let optionMatch;

    while ((optionMatch = optionRegex.exec(block)) !== null) {
      options.push({
        key: optionMatch[1].trim().toUpperCase(),
        text: optionMatch[2].trim(),
      });
    }

    if (questionMatch && answerMatch && options.length >= 2) {
      list.push({
        index: list.length,
        question: questionMatch[1].trim(),
        options,
        answer: answerMatch[1].trim().toUpperCase(),
      });
    }
  }

  return list;
}

function showOverlay(element) {
  element.classList.add("visible");
}

function hideOverlay(element) {
  element.classList.remove("visible");
}

function saveIdToHistory(id, name) {
  if (!id) return;
  try {
    const raw = localStorage.getItem(USED_IDS_KEY);
    let history = [];
    if (raw) {
      history = JSON.parse(raw);
    }
    if (!Array.isArray(history)) {
      history = [];
    }

    const existingIndex = history.findIndex(item => item.id === id);
    const newEntry = {
      id: id,
      name: (name || "Người chơi").trim(),
      timestamp: new Date().toISOString()
    };

    if (existingIndex > -1) {
      history[existingIndex].name = (name || history[existingIndex].name || "Người chơi").trim();
      history[existingIndex].timestamp = newEntry.timestamp;
    } else {
      history.push(newEntry);
    }

    localStorage.setItem(USED_IDS_KEY, JSON.stringify(history));
  } catch (e) {
    console.error("Lỗi khi lưu lịch sử ID vào cache:", e);
  }
}

function generatePlayerId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadPlayerProfile() {
  try {
    const raw = localStorage.getItem(PLAYER_PROFILE_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw);
    if (!profile || typeof profile.id !== "string" || !profile.id.trim()) {
      return null;
    }
    return {
      id: profile.id.trim(),
      name: typeof profile.name === "string" ? profile.name.trim() : "",
    };
  } catch {
    return null;
  }
}

/** Lưu tên mới; giữ nguyên id nếu đã có. */
function savePlayerProfile(name) {
  const trimmedName = String(name || "").trim().slice(0, 24);
  if (!playerId) {
    playerId = generatePlayerId();
  }

  const profile = { id: playerId, name: trimmedName };
  localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
  
  // Lưu ID này vào cache lịch sử
  saveIdToHistory(playerId, trimmedName);
  
  updatePlayerIdHint();
  return profile;
}

function restorePlayerProfile() {
  const profile = loadPlayerProfile();
  if (!profile) {
    updatePlayerIdHint();
    return;
  }

  playerId = profile.id;
  playerName = profile.name;
  if (profile.name) {
    playerNameInput.value = profile.name;
  }
  updatePlayerIdHint();
  
  // Khôi phục ID và cập nhật/lưu vào cache lịch sử
  saveIdToHistory(playerId, playerName);
}

function updatePlayerIdHint() {
  if (!playerIdHint) return;
  if (!playerId) {
    playerIdHint.hidden = true;
    playerIdHint.textContent = "";
    return;
  }
  playerIdHint.hidden = false;
  playerIdHint.textContent = `ID của bạn (không đổi khi đổi tên): ${playerId}`;
}

function updateHud() {
  scoreValue.textContent = String(score);
  const maxNameLen = 10;
  const displayName = playerName
    ? (playerName.length > maxNameLen ? playerName.slice(0, maxNameLen) + "…" : playerName)
    : "-";
  playerNameLabel.textContent = `Người chơi: ${displayName}`;
}

function resetRoundState() {
  pipes = [];
  score = 0;
  spawnTimer = 0;
  usedQuestionIndexes = new Set();
  bird.y = gameConfig.height / 2;
  bird.velocityY = 0;
  bird.rotation = 0;
  updateHud();
}

function createPipe() {
  const minGapTop = 90;
  const maxGapTop = gameConfig.height - gameConfig.groundHeight - gameConfig.pipeGap - 60;
  const gapTop = minGapTop + Math.random() * (maxGapTop - minGapTop);

  pipes.push({
    x: gameConfig.width + 20,
    width: gameConfig.pipeWidth,
    gapTop,
    gapBottom: gapTop + gameConfig.pipeGap,
    askedQuestion: false,
  });
}

function flapBird() {
  if (gameState !== "playing") return;
  bird.velocityY = gameConfig.flapVelocity;
}

function drawBackground() {
  ctx.fillStyle = "#87ceeb";
  ctx.fillRect(0, 0, gameConfig.width, gameConfig.height);

  ctx.fillStyle = "#f1f5f9";
  ctx.globalAlpha = 0.3;
  ctx.fillRect(50, 80, 84, 20);
  ctx.fillRect(230, 120, 112, 24);
  ctx.fillRect(310, 65, 70, 18);
  ctx.globalAlpha = 1;
}

function drawGround() {
  const y = gameConfig.height - gameConfig.groundHeight;
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(0, y, gameConfig.width, gameConfig.groundHeight);
  ctx.fillStyle = "#65a30d";
  ctx.fillRect(0, y, gameConfig.width, 14);
}

function drawPipes() {
  pipes.forEach((pipe) => {
    const topHeight = pipe.gapTop;
    const bottomY = pipe.gapBottom;
    const bottomHeight = gameConfig.height - gameConfig.groundHeight - bottomY;

    drawPipeSegment(pipe.x, 0, pipe.width, topHeight, true);
    drawPipeSegment(pipe.x, bottomY, pipe.width, bottomHeight, false);
  });
}

function drawPipeSegment(x, y, width, height, topPipe) {
  if (pipeImage.complete && pipeImage.naturalWidth > 0) {
    if (topPipe) {
      ctx.save();
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate(Math.PI);
      ctx.drawImage(pipeImage, -width / 2, -height / 2, width, height);
      ctx.restore();
    } else {
      ctx.drawImage(pipeImage, x, y, width, height);
    }
    return;
  }

  ctx.fillStyle = "#16a34a";
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = "#14532d";
  ctx.fillRect(x - 4, topPipe ? height - 12 : y, width + 8, 12);
}

function drawBird() {
  bird.rotation = Math.max(-0.45, Math.min(0.7, bird.velocityY / 450));

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);
  if (birdImage.complete && birdImage.naturalWidth > 0) {
    ctx.drawImage(birdImage, -bird.width / 2, -bird.height / 2, bird.width, bird.height);
  } else {
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.width / 2, bird.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.moveTo(12, -2);
    ctx.lineTo(24, 3);
    ctx.lineTo(12, 8);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function getBirdHitboxSize() {
  const inset = Math.max(0, bird.hitboxInset || 0);
  const w =
    bird.hitboxWidth != null ? Number(bird.hitboxWidth) : bird.width - 2 * inset;
  const h =
    bird.hitboxHeight != null ? Number(bird.hitboxHeight) : bird.height - 2 * inset;
  return {
    width: Math.max(8, w),
    height: Math.max(8, h),
  };
}

function getBirdHitbox() {
  const { width, height } = getBirdHitboxSize();
  const halfW = width / 2;
  const halfH = height / 2;
  return {
    left: bird.x - halfW,
    right: bird.x + halfW,
    top: bird.y - halfH,
    bottom: bird.y + halfH,
    width,
    height,
  };
}

/** Vẽ vùng va chạm (hitbox) để chỉnh chim/ống cho khớp. */
function drawHitboxes() {
  if (!showHitboxes) return;

  const groundY = gameConfig.height - gameConfig.groundHeight;
  const box = getBirdHitbox();

  pipes.forEach((pipe) => {
    ctx.fillStyle = "rgba(239, 68, 68, 0.35)";
    ctx.fillRect(pipe.x, 0, pipe.width, pipe.gapTop);
    ctx.fillRect(pipe.x, pipe.gapBottom, pipe.width, groundY - pipe.gapBottom);

    ctx.fillStyle = "rgba(34, 197, 94, 0.22)";
    ctx.fillRect(pipe.x, pipe.gapTop, pipe.width, pipe.gapBottom - pipe.gapTop);
  });

  ctx.strokeStyle = "rgba(250, 204, 21, 0.95)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(gameConfig.width, groundY);
  ctx.stroke();

  ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(gameConfig.width, 0);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.lineWidth = 2;
  ctx.strokeRect(box.left, box.top, box.right - box.left, box.bottom - box.top);

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(8, gameConfig.height - 88, 248, 80);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "12px Arial, sans-serif";
  const hb = getBirdHitboxSize();
  ctx.fillText("HITBOX (H: tắt/bật)", 14, gameConfig.height - 68);
  ctx.fillStyle = "#e2e8f0";
  ctx.fillText(`Chim: ${bird.width}x${bird.height} | Hit: ${hb.width}x${hb.height}`, 14, gameConfig.height - 52);
  ctx.fillStyle = "#fca5a5";
  ctx.fillText("Đỏ: ống va chạm", 14, gameConfig.height - 36);
  ctx.fillStyle = "#86efac";
  ctx.fillText("Xanh: khe an toàn", 14, gameConfig.height - 20);
  ctx.fillStyle = "#fde047";
  ctx.fillText("Vàng: mặt đất", 14, gameConfig.height - 4);
}

function renderGame() {
  drawBackground();
  drawPipes();
  drawGround();
  drawBird();
  drawHitboxes();
}

function updateGame(deltaTime) {
  spawnTimer += deltaTime;
  if (spawnTimer >= gameConfig.spawnInterval) {
    spawnTimer = 0;
    createPipe();
  }

  bird.velocityY += gameConfig.gravity * (deltaTime / 1000);
  bird.y += bird.velocityY * (deltaTime / 1000);

  pipes.forEach((pipe) => {
    pipe.x -= gameConfig.pipeSpeed * (deltaTime / 1000);
  });

  pipes = pipes.filter((pipe) => pipe.x + pipe.width > -30);

  const groundY = gameConfig.height - gameConfig.groundHeight;
  const box = getBirdHitbox();

  if (box.bottom >= groundY || box.top <= 0) {
    triggerGameOver("Bạn đã va chạm với biên giới!");
    return;
  }

  for (const pipe of pipes) {
    const hitsPipeX = box.right > pipe.x && box.left < pipe.x + pipe.width;
    if (!hitsPipeX) continue;
    const hitsGap = box.top > pipe.gapTop && box.bottom < pipe.gapBottom;

    if (!hitsGap) {
      triggerGameOver("Bạn đã va vào ống!");
      return;
    }
  }

  for (const pipe of pipes) {
    const passedPipe = pipe.x + pipe.width < box.left;
    if (!pipe.askedQuestion && passedPipe) {
      pipe.askedQuestion = true;
      pauseForQuestion();
      break;
    }
  }
}

function loop(timestamp) {
  if (!lastTimestamp) lastTimestamp = timestamp;
  const deltaTime = Math.min(32, timestamp - lastTimestamp);
  lastTimestamp = timestamp;

  if (gameState === "playing") {
    updateGame(deltaTime);
  }
  renderGame();
  animationFrameId = requestAnimationFrame(loop);
}

function pickQuestion() {
  if (!questions.length) return null;
  if (usedQuestionIndexes.size === questions.length) {
    usedQuestionIndexes = new Set();
  }

  const availableIndexes = questions
    .map((_, index) => index)
    .filter((index) => !usedQuestionIndexes.has(index));

  // Loc bo nhung cau hoi da xuat hien gan day
  let filteredIndexes = availableIndexes.filter((index) => !recentQuestionIndexes.includes(index));

  // Phong truong hop danh sach loc bi rong (vi du: tong so cau hoi qua it)
  if (filteredIndexes.length === 0) {
    filteredIndexes = availableIndexes;
  }

  const selectedIndex = filteredIndexes[Math.floor(Math.random() * filteredIndexes.length)];
  usedQuestionIndexes.add(selectedIndex);

  // Them vao danh sach cau hoi gan day va gioi han do dai hang doi
  recentQuestionIndexes.push(selectedIndex);
  const maxRecent = Math.max(1, Math.min(10, Math.floor(questions.length / 3)));
  while (recentQuestionIndexes.length > maxRecent) {
    recentQuestionIndexes.shift();
  }

  return questions[selectedIndex];
}

async function pauseForQuestion() {
  gameState = "paused";
  currentQuestion = pickQuestion();
  bgmAudio.pause();
  stopFallbackBgm();
  playQuizSound();

  if (!currentQuestion) {
    questionText.textContent =
      questions.length === 0
        ? "Không tải được câu hỏi. Hãy chạy: node server.js và mở http://localhost:3000"
        : "Hết câu hỏi trong danh sách.";
    questionOptions.innerHTML =
      '<button type="button" id="skipQuestionBtn" class="skip-btn">Tiếp tục chơi</button>';
    const submitBtn = document.getElementById("submitAnswerBtn");
    if (submitBtn) submitBtn.hidden = true;
    showOverlay(questionPopup);
    document.getElementById("skipQuestionBtn")?.addEventListener(
      "click",
      () => {
        stopQuestionTimer();
        stopQuizSound();
        hideOverlay(questionPopup);
        if (submitBtn) submitBtn.hidden = false;
        resumeGame();
      },
      { once: true }
    );
    return;
  }

  const submitBtn = document.getElementById("submitAnswerBtn");
  if (submitBtn) submitBtn.hidden = false;

  if (isServerMode) {
    questionText.textContent = "Đang tải câu hỏi...";
    questionOptions.innerHTML = "";
    showOverlay(questionPopup);
    try {
      const response = await fetch(`../api/question?index=${currentQuestion.index}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      currentQuestion.question = data.question;
      currentQuestion.options = data.options;
      renderQuestion(currentQuestion);
      startQuestionTimer();
    } catch (err) {
      console.error("Lỗi khi tải câu hỏi từ server:", err);
      questionText.textContent = "Không thể kết nối đến máy chủ để tải câu hỏi.";
      triggerGameOver("Lỗi kết nối máy chủ.");
    }
  } else {
    renderQuestion(currentQuestion);
    showOverlay(questionPopup);
    startQuestionTimer();
  }
}

function stopQuestionTimer() {
  if (questionTimerInterval) {
    clearInterval(questionTimerInterval);
    questionTimerInterval = null;
  }
}

function pauseQuestionTimer() {
  if (questionTimerInterval && !questionTimerIsPaused) {
    questionTimerIsPaused = true;
    questionTimerElapsedBeforePause += (Date.now() - questionTimerStart);
  }
}

function resumeQuestionTimer() {
  if (questionTimerInterval && questionTimerIsPaused) {
    questionTimerStart = Date.now();
    questionTimerIsPaused = false;
  }
}

function startQuestionTimer() {
  stopQuestionTimer();
  if (!questionTimerBar || !questionTimerLabel) return;

  questionTimerStart = Date.now();
  questionTimerElapsedBeforePause = 0;
  questionTimerIsPaused = false;
  questionTimerBar.classList.remove("warning", "danger");
  questionTimerBar.style.width = "100%";

  const tick = () => {
    if (gameState !== "paused" || !currentQuestion) {
      stopQuestionTimer();
      return;
    }

    if (questionTimerIsPaused) {
      return;
    }

    const elapsed = (Date.now() - questionTimerStart) + questionTimerElapsedBeforePause;
    const remainMs = Math.max(0, QUIZ_TIME_LIMIT_MS - elapsed);
    const percent = (remainMs / QUIZ_TIME_LIMIT_MS) * 100;
    const remainSec = Math.ceil(remainMs / 1000);

    questionTimerBar.style.width = `${percent}%`;
    questionTimerLabel.textContent = `${remainSec} giây`;
    questionTimerBar.classList.toggle("warning", percent <= 35 && percent > 15);
    questionTimerBar.classList.toggle("danger", percent <= 15);

    if (remainMs <= 0) {
      stopQuestionTimer();
      stopQuizSound();
      currentQuestion = null;
      hideOverlay(questionPopup);
      playIncorrectSound();
      triggerGameOver("Hết thời gian trả lời.");
    }
  };

  tick();
  questionTimerInterval = setInterval(tick, 50);
}

function renderQuestion(questionData) {
  const highlight = document.getElementById("questionHighlight");
  questionText.textContent = questionData.question;
  if (highlight) {
    highlight.classList.remove("question-animate");
    void highlight.offsetWidth;
    highlight.classList.add("question-animate");
  }
  questionOptions.innerHTML = "";
  questionData.options.forEach((option, idx) => {
    const item = document.createElement("div");
    item.className = "option-item";
    const id = `option-${option.key}-${idx}`;
    item.innerHTML = `
      <input id="${id}" type="radio" name="quizOption" value="${option.key}" data-option-index="${idx}" ${idx === 0 ? "checked" : ""} />
      <label for="${id}"><strong>${idx + 1}</strong> — ${option.key}. ${option.text}</label>
    `;
    questionOptions.appendChild(item);
  });
}

async function submitQuizAnswer(selectedKey) {
  if (gameState !== "paused" || !currentQuestion || !selectedKey) return;

  stopQuestionTimer();
  stopQuizSound();
  hideOverlay(questionPopup);

  let isCorrect = false;
  if (isServerMode) {
    try {
      const response = await fetch("../api/question/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          index: currentQuestion.index,
          answer: selectedKey.toString()
        })
      });
      if (response.ok) {
        const data = await response.json();
        isCorrect = data.correct;
      }
    } catch (err) {
      console.error("Lỗi xác thực đáp án:", err);
    }
  } else {
    isCorrect = (selectedKey.toString().toUpperCase() === currentQuestion.answer);
  }

  if (isCorrect) {
    score += 1;
    updateHud();
    playCorrectSound();
    startCountdownThenResume(true);
  } else {
    playIncorrectSound();
    triggerGameOver("Trả lời sai câu hỏi.");
  }
}

function selectAnswerByKeyNumber(keyNumber) {
  if (gameState !== "paused" || !currentQuestion) return;
  const index = keyNumber - 1;
  const option = currentQuestion.options[index];
  if (!option) return;

  const radio = questionOptions.querySelector(`input[data-option-index="${index}"]`);
  if (radio) radio.checked = true;
  submitQuizAnswer(option.key);
}

const ANSWER_KEY_MAP = {
  Digit1: 1,
  Digit2: 2,
  Digit3: 3,
  Digit4: 4,
  Numpad1: 1,
  Numpad2: 2,
  Numpad3: 3,
  Numpad4: 4,
};

questionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const selected = new FormData(questionForm).get("quizOption");
  if (selected) submitQuizAnswer(selected.toString());
});

function startCountdownThenResume(correct = false) {
  let remain = 3;
  showOverlay(countdownPopup);
  countdownText.textContent = correct ? `Chính xác! Tiếp tục sau ${remain} giây` : `Tiếp tục sau ${remain} giây`;

  const timer = setInterval(() => {
    remain -= 1;
    if (remain > 0) {
      countdownText.textContent = correct ? `Chính xác! Tiếp tục sau ${remain} giây` : `Tiếp tục sau ${remain} giây`;
      return;
    }

    clearInterval(timer);
    hideOverlay(countdownPopup);
    resumeGame();
  }, 1000);
}

function startBgm() {
  if (bgmAudioWorks) {
    bgmAudio.currentTime = 0;
    bgmAudio
      .play()
      .then(() => {
        stopFallbackBgm();
      })
      .catch(() => {
        startFallbackBgm();
      });
  } else {
    startFallbackBgm();
  }
}

function stopBgm() {
  bgmAudio.pause();
  bgmAudio.currentTime = 0;
  stopFallbackBgm();
}

function playDeathSound() {
  if (deathAudioWorks) {
    deathAudio.currentTime = 0;
    deathAudio.play().catch(() => playFallbackDeath());
  } else {
    playFallbackDeath();
  }
}

function resumeGame() {
  gameState = "playing";
  startBgm();
}

async function triggerGameOver(reason) {
  if (gameState === "gameover") return;
  gameState = "gameover";
  stopQuestionTimer();
  hideOverlay(questionPopup);
  hideOverlay(countdownPopup);
  stopBgm();
  playDeathSound();

  gameOverMessage.textContent = `${reason} Điểm của bạn: ${score}`;
  if (rankDisplay) rankDisplay.hidden = true;
  showOverlay(gameOverScreen);

  await saveScore(playerName, score);

  try {
    const activePlayerId = playerId || loadPlayerProfile()?.id || "";
    if (activePlayerId) {
      const res = await fetch(`/api/rank?playerId=${encodeURIComponent(activePlayerId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.rank !== null && rankDisplay) {
          rankBadge.textContent = `#${data.rank}`;
          rankSubtext.textContent = `trong số ${data.totalPlayers} người chơi`;
          bestScoreText.textContent = `Kỷ lục cá nhân: ${data.bestScore}`;
          rankDisplay.hidden = false;
        }
      }
    }
  } catch (err) {
    console.warn("Không thể lấy rank:", err);
  }
}

async function saveScore(name, currentScore) {
  const payload = {
    playerId: playerId || loadPlayerProfile()?.id || "",
    name: (name || "Người chơi").trim(),
    score: Number(currentScore) || 0,
  };

  try {
    const response = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error("Lưu điểm thất bại");
  } catch (error) {
    // Du phong khi chay khong qua Node server.
    const key = "flappyQuizLocalScores";
    const oldScores = JSON.parse(localStorage.getItem(key) || "[]");
    oldScores.push({ ...payload, createdAt: new Date().toISOString() });
    oldScores.sort((a, b) => b.score - a.score);
    localStorage.setItem(key, JSON.stringify(oldScores));
    console.warn("Lưu localStorage vì không gọi được API:", error);
  }
}

function startGame() {
  const rawName = playerNameInput.value.trim();
  if (!rawName) {
    playerNameInput.focus();
    return;
  }

  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => { });
  }

  const profile = savePlayerProfile(rawName);
  playerId = profile.id;
  playerName = profile.name;
  resetRoundState();
  updateHud();
  hideOverlay(startScreen);
  hideOverlay(gameOverScreen);
  hideOverlay(questionPopup);
  hideOverlay(countdownPopup);
  gameState = "playing";
  startBgm();
}

function restartToMenu() {
  gameState = "menu";
  stopBgm();
  resetRoundState();
  restorePlayerProfile();
  hideOverlay(gameOverScreen);
  showOverlay(startScreen);
}

let preDevtoolState = null;
let currentDevtoolTab = "local";

function toggleIdHistoryDevTool() {
  if (!devtoolOverlay) return;

  if (devtoolOverlay.classList.contains("visible")) {
    hideOverlay(devtoolOverlay);
    if (preDevtoolState === "playing") {
      gameState = "playing";
      startBgm();
    } else if (preDevtoolState) {
      gameState = preDevtoolState;
    }
    preDevtoolState = null;
    resumeQuestionTimer();
  } else {
    preDevtoolState = gameState;
    if (gameState === "playing") {
      gameState = "paused";
      stopBgm();
    }
    pauseQuestionTimer();
    
    // Mặc định chuyển sang tab local khi mở devtool
    switchDevtoolTab("local");
    checkDevtoolAdminStatusSilently();
    
    showOverlay(devtoolOverlay);
  }
}

let devtoolEditingPlayerId = null;

function switchDevtoolTab(tab) {
  currentDevtoolTab = tab;
  if (!tabLocalBtn || !tabLeaderboardBtn || !devtoolLocalTab || !devtoolLeaderboardTab) return;

  if (tab === "local") {
    tabLocalBtn.classList.add("active");
    tabLeaderboardBtn.classList.remove("active");
    devtoolLocalTab.classList.add("active");
    devtoolLeaderboardTab.classList.remove("active");
    renderIdHistoryList();
  } else {
    tabLocalBtn.classList.remove("active");
    tabLeaderboardBtn.classList.add("active");
    devtoolLocalTab.classList.remove("active");
    devtoolLeaderboardTab.classList.add("active");
    checkDevtoolAdminStatus();
  }
}

async function checkDevtoolAdminStatus() {
  try {
    const response = await fetch("/api/admin/check", { credentials: "include" });
    const data = await response.json().catch(() => ({}));
    if (data.authenticated) {
      showDevtoolAdminControls();
    } else {
      showDevtoolLoginContainer();
    }
  } catch (err) {
    console.error("Lỗi kiểm tra admin:", err);
    showDevtoolLoginContainer();
  }
}

async function checkDevtoolAdminStatusSilently() {
  if (!devtoolAdminStatus) return;
  try {
    const response = await fetch("/api/admin/check", { credentials: "include" });
    const data = await response.json().catch(() => ({}));
    if (data.authenticated) {
      devtoolAdminStatus.textContent = "CHẾ ĐỘ ADMIN";
      devtoolAdminStatus.style.background = "#fbbf24";
      devtoolAdminStatus.style.color = "#0f172a";
    } else {
      devtoolAdminStatus.textContent = "CHẾ ĐỘ CHỈ ĐỌC";
      devtoolAdminStatus.style.background = "";
      devtoolAdminStatus.style.color = "";
    }
  } catch {
    devtoolAdminStatus.textContent = "CHẾ ĐỘ CHỈ ĐỌC";
    devtoolAdminStatus.style.background = "";
    devtoolAdminStatus.style.color = "";
  }
}

function showDevtoolAdminControls() {
  if (!devtoolAdminStatus || !devtoolLoginContainer || !devtoolAdminControls) return;
  devtoolAdminStatus.textContent = "CHẾ ĐỘ ADMIN";
  devtoolAdminStatus.style.background = "#fbbf24";
  devtoolAdminStatus.style.color = "#0f172a";
  devtoolLoginContainer.hidden = true;
  devtoolAdminControls.hidden = false;
  devtoolEditingPlayerId = null; // Reset edit state when showing
  loadLeaderboardAdminList();
}

function showDevtoolLoginContainer() {
  if (!devtoolAdminStatus || !devtoolLoginContainer || !devtoolAdminControls) return;
  devtoolAdminStatus.textContent = "CHẾ ĐỘ CHỈ ĐỌC";
  devtoolAdminStatus.style.background = "";
  devtoolAdminStatus.style.color = "";
  devtoolLoginContainer.hidden = false;
  devtoolAdminControls.hidden = true;
}

async function performDevtoolAdminLogin() {
  if (!devtoolPasswordInput || !devtoolLoginMsg) return;
  const key = devtoolPasswordInput.value.trim();
  if (!key) {
    devtoolLoginMsg.textContent = "Vui lòng nhập mã Admin.";
    devtoolLoginMsg.hidden = false;
    return;
  }

  try {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ key }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      devtoolLoginMsg.hidden = true;
      devtoolPasswordInput.value = "";
      showDevtoolAdminControls();
    } else {
      devtoolLoginMsg.textContent = data.error || "Sai mã admin.";
      devtoolLoginMsg.hidden = false;
    }
  } catch (err) {
    console.error(err);
    devtoolLoginMsg.textContent = "Lỗi kết nối máy chủ.";
    devtoolLoginMsg.hidden = false;
  }
}

async function performDevtoolAdminLogout() {
  try {
    const response = await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
    });
    if (response.ok) {
      showDevtoolLoginContainer();
    }
  } catch (err) {
    console.error("Lỗi khi đăng xuất admin:", err);
  }
}

function changeActivePlayerId(targetId, targetName) {
  playerId = targetId;
  playerName = targetName;
  
  localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify({ id: playerId, name: playerName }));
  
  if (playerNameInput) {
    playerNameInput.value = playerName;
  }
  
  updateHud();
  updatePlayerIdHint();
  saveIdToHistory(playerId, playerName);
  
  renderIdHistoryList();
  if (devtoolAdminControls && !devtoolAdminControls.hidden) {
    loadLeaderboardAdminList();
  }
}

async function saveEditedScore(targetId, targetName, newScore) {
  try {
    const res = await fetch("/api/admin/change-score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: targetId, name: targetName, score: newScore })
    });
    if (res.ok) {
      return true;
    } else {
      const data = await res.json().catch(() => ({}));
      alert(`Lỗi khi cập nhật điểm: ${data.error || "Không rõ nguyên nhân"}`);
      return false;
    }
  } catch (err) {
    console.error(err);
    alert("Lỗi kết nối máy chủ!");
    return false;
  }
}

async function loadLeaderboardAdminList() {
  if (!devtoolLeaderboardBody) return;
  
  // Chỉ hiển thị "Đang tải..." khi không phải đang ở giữa chế độ edit
  if (devtoolEditingPlayerId === null) {
    devtoolLeaderboardBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Đang tải danh sách...</td></tr>`;
  }

  try {
    const response = await fetch("/api/scores", { credentials: "include", cache: "no-store" });
    if (response.status === 403) {
      showDevtoolLoginContainer();
      return;
    }
    if (!response.ok) throw new Error("Không thể lấy dữ liệu bảng xếp hạng.");

    const scores = await response.json();
    const consolidated = consolidateScoresByPlayerId(scores);
    renderDevtoolLeaderboard(consolidated);
  } catch (err) {
    console.error(err);
    if (devtoolEditingPlayerId === null) {
      devtoolLeaderboardBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444; padding: 20px;">Lỗi tải dữ liệu bảng xếp hạng.</td></tr>`;
    }
  }
}

function consolidateScoresByPlayerId(scores) {
  const groups = new Map();

  scores.forEach((item, index) => {
    const pId = String(item.playerId || "").trim();
    const key = pId || `solo:${index}:${item.createdAt || ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const consolidated = [];

  groups.forEach((entries) => {
    const byTimeDesc = [...entries].sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );
    const latestName = byTimeDesc[0]?.name || "Không rõ";
    const bestScore = Math.max(...entries.map((e) => Number(e.score || 0)));

    const bestEntries = entries.filter((e) => Number(e.score || 0) === bestScore);
    const bestRecord = bestEntries.sort(
      (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    )[0];

    consolidated.push({
      playerId: String(entries[0].playerId || "").trim(),
      name: latestName,
      score: bestScore,
      createdAt: bestRecord?.createdAt || byTimeDesc[0]?.createdAt,
    });
  });

  consolidated.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  return consolidated;
}

function renderDevtoolLeaderboard(scores) {
  if (!devtoolLeaderboardBody) return;
  devtoolLeaderboardBody.innerHTML = "";

  if (!scores || scores.length === 0) {
    devtoolLeaderboardBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Bảng xếp hạng trống.</td></tr>`;
    return;
  }

  scores.forEach(item => {
    const row = document.createElement("tr");
    const isCurrentActive = (playerId && item.playerId === playerId);
    if (isCurrentActive) {
      row.classList.add("active-row");
    }

    const nameCell = document.createElement("td");
    nameCell.className = "cell-name";
    nameCell.textContent = item.name || "Không rõ";
    if (isCurrentActive) {
      const activeBadge = document.createElement("span");
      activeBadge.className = "devtool-active-badge";
      activeBadge.textContent = "Đang dùng";
      nameCell.appendChild(activeBadge);
    }

    const idCell = document.createElement("td");
    idCell.className = "cell-id";
    idCell.textContent = item.playerId || "-";

    const scoreCell = document.createElement("td");
    const actionCell = document.createElement("td");
    actionCell.className = "devtool-actions-cell";

    if (devtoolEditingPlayerId === item.playerId) {
      // Chế độ chỉnh sửa inline
      const input = document.createElement("input");
      input.type = "number";
      input.className = "devtool-score-edit-input";
      input.value = item.score;
      input.style.width = "60px";
      input.style.background = "#0f172a";
      input.style.color = "#fff";
      input.style.border = "1px solid #fbbf24";
      input.style.borderRadius = "4px";
      input.style.padding = "4px";
      input.style.textAlign = "center";
      scoreCell.appendChild(input);

      // Nút Lưu
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "devtool-btn-action";
      saveBtn.style.background = "rgba(34, 197, 94, 0.15)";
      saveBtn.style.color = "#22c55e";
      saveBtn.style.borderColor = "rgba(34, 197, 94, 0.3)";
      saveBtn.textContent = "Lưu";
      saveBtn.addEventListener("click", async () => {
        const val = parseInt(input.value, 10);
        if (isNaN(val) || val < 0) {
          alert("Điểm số không hợp lệ.");
          return;
        }
        const success = await saveEditedScore(item.playerId, item.name, val);
        if (success) {
          devtoolEditingPlayerId = null;
          loadLeaderboardAdminList();
        }
      });

      // Nút Hủy
      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "devtool-btn-action";
      cancelBtn.style.background = "rgba(239, 68, 68, 0.15)";
      cancelBtn.style.color = "#ef4444";
      cancelBtn.style.borderColor = "rgba(239, 68, 68, 0.3)";
      cancelBtn.textContent = "Hủy";
      cancelBtn.addEventListener("click", () => {
        devtoolEditingPlayerId = null;
        renderDevtoolLeaderboard(scores);
      });

      actionCell.appendChild(saveBtn);
      actionCell.appendChild(cancelBtn);
    } else {
      // Chế độ bình thường
      scoreCell.style.fontWeight = "bold";
      scoreCell.style.color = "#fbbf24";
      scoreCell.textContent = item.score;

      // Nút Copy
      const copyBtn = document.createElement("button");
      copyBtn.type = "button";
      copyBtn.className = "devtool-btn-action devtool-btn-copy";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(item.playerId).then(() => {
          copyBtn.textContent = "Copied!";
          setTimeout(() => {
            copyBtn.textContent = "Copy";
          }, 1500);
        });
      });
      actionCell.appendChild(copyBtn);

      // Nút Dùng ID
      if (item.playerId && !isCurrentActive) {
        const useBtn = document.createElement("button");
        useBtn.type = "button";
        useBtn.className = "devtool-btn-action devtool-btn-use";
        useBtn.textContent = "Dùng ID";
        useBtn.addEventListener("click", () => {
          if (confirm(`Bạn có chắc muốn chuyển sang sử dụng ID của người chơi "${item.name}"?`)) {
            changeActivePlayerId(item.playerId, item.name);
          }
        });
        actionCell.appendChild(useBtn);
      }

      // Nút Sửa Điểm
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "devtool-btn-action devtool-btn-edit";
      editBtn.textContent = "Sửa Điểm";
      editBtn.addEventListener("click", () => {
        devtoolEditingPlayerId = item.playerId;
        renderDevtoolLeaderboard(scores);
      });
      actionCell.appendChild(editBtn);
    }

    row.appendChild(nameCell);
    row.appendChild(idCell);
    row.appendChild(scoreCell);
    row.appendChild(actionCell);

    devtoolLeaderboardBody.appendChild(row);
  });
}

function renderIdHistoryList() {
  if (!devtoolListBody) return;
  devtoolListBody.innerHTML = "";

  let history = [];
  try {
    const raw = localStorage.getItem(USED_IDS_KEY);
    if (raw) {
      history = JSON.parse(raw);
    }
  } catch (e) {
    console.error("Lỗi đọc lịch sử ID:", e);
  }

  if (!Array.isArray(history) || history.length === 0) {
    devtoolListBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Chưa có lịch sử ID nào được lưu.</td></tr>`;
    return;
  }

  history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  history.forEach(item => {
    const row = document.createElement("tr");
    const isActive = (playerId && item.id === playerId);
    if (isActive) {
      row.classList.add("active-row");
    }

    const nameCell = document.createElement("td");
    nameCell.className = "cell-name";
    nameCell.textContent = item.name || "Người chơi";
    if (isActive) {
      const activeBadge = document.createElement("span");
      activeBadge.className = "devtool-active-badge";
      activeBadge.textContent = "Đang dùng";
      nameCell.appendChild(activeBadge);
    }

    const idCell = document.createElement("td");
    idCell.className = "cell-id";
    idCell.textContent = item.id;

    const timeCell = document.createElement("td");
    timeCell.className = "cell-time";
    try {
      const date = new Date(item.timestamp);
      timeCell.textContent = date.toLocaleString("vi-VN");
    } catch {
      timeCell.textContent = "-";
    }

    const actionCell = document.createElement("td");
    actionCell.className = "devtool-actions-cell";

    // Nút copy
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "devtool-btn-action devtool-btn-copy";
    copyBtn.textContent = "Copy";
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(item.id).then(() => {
        copyBtn.textContent = "Copied!";
        setTimeout(() => {
          copyBtn.textContent = "Copy";
        }, 1500);
      }).catch(err => {
        console.error("Lỗi khi copy ID:", err);
      });
    });
    actionCell.appendChild(copyBtn);

    // Nút Dùng ID
    if (item.id && !isActive) {
      const useBtn = document.createElement("button");
      useBtn.type = "button";
      useBtn.className = "devtool-btn-action devtool-btn-use";
      useBtn.textContent = "Dùng ID";
      useBtn.addEventListener("click", () => {
        if (confirm(`Bạn có chắc muốn chuyển sang sử dụng ID "${item.name}"?`)) {
          changeActivePlayerId(item.id, item.name);
        }
      });
      actionCell.appendChild(useBtn);
    }

    row.appendChild(nameCell);
    row.appendChild(idCell);
    row.appendChild(timeCell);
    row.appendChild(actionCell);

    devtoolListBody.appendChild(row);
  });
}

// Gắn sự kiện tab và form login
if (tabLocalBtn) {
  tabLocalBtn.addEventListener("click", () => switchDevtoolTab("local"));
}
if (tabLeaderboardBtn) {
  tabLeaderboardBtn.addEventListener("click", () => switchDevtoolTab("leaderboard"));
}
if (devtoolLoginBtn) {
  devtoolLoginBtn.addEventListener("click", performDevtoolAdminLogin);
}
if (devtoolLogoutBtn) {
  devtoolLogoutBtn.addEventListener("click", performDevtoolAdminLogout);
}
if (devtoolPasswordInput) {
  devtoolPasswordInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      performDevtoolAdminLogin();
    }
  });
}

if (closeDevtoolBtn) {
  closeDevtoolBtn.addEventListener("click", () => {
    if (devtoolOverlay && devtoolOverlay.classList.contains("visible")) {
      toggleIdHistoryDevTool();
    }
  });
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", restartToMenu);

window.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.altKey && (event.key === "g" || event.key === "G" || event.code === "KeyG")) {
    event.preventDefault();
    toggleIdHistoryDevTool();
    return;
  }

  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || event.target.isContentEditable) {
    return;
  }

  if (gameState === "paused" && currentQuestion && ANSWER_KEY_MAP[event.code]) {
    event.preventDefault();
    selectAnswerByKeyNumber(ANSWER_KEY_MAP[event.code]);
    return;
  }

  if (event.code === "KeyH") {
    showHitboxes = !showHitboxes;
    return;
  }

  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    if (gameState === "playing") {
      flapBird();
    } else if (gameState === "menu") {
      startGame();
    } else if (gameState === "gameover") {
      restartToMenu();
    }
  }
});

canvas.addEventListener("pointerdown", () => {
  flapBird();
});

async function init() {
  await loadQuestions();
  restorePlayerProfile();
  updateHud();
  showOverlay(startScreen);
  renderGame();
  animationFrameId = requestAnimationFrame(loop);
}

init();
