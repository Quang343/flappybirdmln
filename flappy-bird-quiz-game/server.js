const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { exec } = require("child_process");

const HOST = "0.0.0.0";
const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const SCORES_PATH = path.join(ROOT_DIR, "scores", "scores.json");
const ADMIN_KEY = process.env.ADMIN_KEY || "giang";
const ADMIN_COOKIE = "flappy_admin_session";
const ADMIN_TOKEN = crypto.createHmac("sha256", ADMIN_KEY).update("leaderboard-admin").digest("hex");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
};

function ensureScoresFile() {
  if (!fs.existsSync(path.dirname(SCORES_PATH))) {
    fs.mkdirSync(path.dirname(SCORES_PATH), { recursive: true });
  }
  if (!fs.existsSync(SCORES_PATH)) {
    fs.writeFileSync(SCORES_PATH, "[]", "utf8");
  }
}

let questions = [];

function parseQuestionsFromMarkdown(markdown) {
  const list = [];
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
        question: questionMatch[1].trim(),
        options,
        answer: answerMatch[1].trim().toUpperCase(),
      });
    }
  }

  return list;
}

function loadQuestions() {
  const questionsPath = path.join(ROOT_DIR, "questions", "questions.md");
  try {
    if (fs.existsSync(questionsPath)) {
      const markdown = fs.readFileSync(questionsPath, "utf8");
      questions = parseQuestionsFromMarkdown(markdown);
      console.log(`Da tai ${questions.length} cau hoi tren Server.`);
    } else {
      console.error("Khong tim thay file questions.md");
    }
  } catch (err) {
    console.error("Loi khi doc questions.md:", err);
  }
}

function sendJson(res, statusCode, data, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const cookies = {};
  const header = req.headers.cookie || "";
  header.split(";").forEach((part) => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const eq = trimmed.indexOf("=");
    if (eq === -1) return;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

function isAdminAuthenticated(req) {
  return parseCookies(req)[ADMIN_COOKIE] === ADMIN_TOKEN;
}

function setAdminCookie(res) {
  const maxAge = 60 * 60 * 24;
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=${ADMIN_TOKEN}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${maxAge}`
  );
}

function clearAdminCookie(res) {
  res.setHeader("Set-Cookie", `${ADMIN_COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0`);
}

function readRequestBody(req, callback) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
    if (body.length > 1_000_000) {
      req.socket.destroy();
    }
  });
  req.on("end", () => callback(body));
}

function readScores() {
  ensureScoresFile();
  try {
    const raw = fs.readFileSync(SCORES_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeScores(scores) {
  fs.writeFileSync(SCORES_PATH, JSON.stringify(scores, null, 2), "utf8");
}

function saveScore(payload) {
  const playerId = String(payload.playerId || "").trim().slice(0, 64);
  const name = String(payload.name || "").trim().slice(0, 24) || "Người chơi";
  const score = Number.isFinite(Number(payload.score)) ? Number(payload.score) : 0;
  const newItem = { playerId, name, score, createdAt: new Date().toISOString() };

  const scores = readScores();
  const existingIndex = scores.findIndex((s) => s.playerId === playerId);

  if (existingIndex !== -1) {
    // Chỉ ghi đè (cập nhật) nếu điểm mới lớn hơn điểm đã lưu
    if (score > scores[existingIndex].score) {
      scores[existingIndex] = newItem;
    } else {
      // Cập nhật lại tên nếu có thay đổi
      scores[existingIndex].name = name;
    }
  } else {
    scores.push(newItem);
  }

  scores.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  writeScores(scores);
  return scores;
}

function isSafePath(fullPath) {
  const normalized = path.normalize(fullPath);
  return normalized.startsWith(ROOT_DIR);
}

function injectSecurityHeaders(html) {
  const securityScript = `<script>
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('keydown', e => {
      if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && [73, 74, 67].includes(e.keyCode)) || (e.ctrlKey && e.keyCode === 85)) {
        e.preventDefault();
        return false;
      }
    });
    setInterval(() => {
      (function() {}.constructor("debugger")());
    }, 1000);
  </script>`;
  
  const match = html.match(/<head[^>]*>/i);
  if (match) {
    return html.replace(match[0], match[0] + securityScript);
  }
  return securityScript + html;
}

function obfuscateJS(code) {
  try {
    const JavaScriptObfuscator = require("javascript-obfuscator");
    
    // Check if the script contains devtool specific code (e.g. devtoolOverlay, toggleIdHistoryDevTool, performDevtoolAdminLogin)
    const isDevtoolCode = code.includes("devtoolOverlay") || code.includes("toggleIdHistoryDevTool") || code.includes("performDevtoolAdminLogin");
    
    // Inject the anti-devtools protections into the code before obfuscation
    const protections = `
      document.addEventListener('contextmenu', e => e.preventDefault());
      document.addEventListener('keydown', e => {
        if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && [73, 74, 67].includes(e.keyCode)) || (e.ctrlKey && e.keyCode === 85)) {
          e.preventDefault();
          return false;
        }
      });
      setInterval(() => {
        (function() {}.constructor("debugger")());
      }, 1000);
    `;
    
    let codeToObfuscate = protections + "\n" + code;
    
    const obfuscationResult = JavaScriptObfuscator.obfuscate(codeToObfuscate, {
        compact: true,
        controlFlowFlattening: isDevtoolCode, // Flatten control flow to make reversing very hard
        controlFlowFlatteningThreshold: isDevtoolCode ? 0.75 : 0.2, 
        deadCodeInjection: isDevtoolCode,
        deadCodeInjectionThreshold: isDevtoolCode ? 0.4 : 0.1,
        debugProtection: true,
        debugProtectionInterval: 2000,
        disableConsoleOutput: true,
        identifierNamesGenerator: 'hexadecimal',
        log: false,
        numbersToExpressions: true,
        renameGlobals: false,
        selfDefending: true,
        simplify: true,
        splitStrings: true,
        splitStringsChunkLength: 10,
        stringArray: true,
        stringArrayCallsTransform: true,
        stringArrayCallsTransformThreshold: 0.5,
        stringArrayEncoding: ['base64', 'rc4'],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayWrappersCount: 1,
        stringArrayWrappersChainedCalls: true,
        stringArrayWrappersParametersMaxCount: 2,
        stringArrayWrappersType: 'variable',
        stringArrayThreshold: 0.75,
        unicodeEscapeSequence: false
    });
    
    return obfuscationResult.getObfuscatedCode();
  } catch (err) {
    console.error("Obfuscation error:", err);
    // Fallback to basic obfuscation if the package fails
    const protections = `
      document.addEventListener('contextmenu', e => e.preventDefault());
      document.addEventListener('keydown', e => {
        if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && [73, 74, 67].includes(e.keyCode)) || (e.ctrlKey && e.keyCode === 85)) {
          e.preventDefault();
          return false;
        }
      });
      setInterval(() => {
        (function() {}.constructor("debugger")());
      }, 1000);
    `;
    const fullCode = protections + "\n" + code;
    const b64 = Buffer.from(fullCode, 'utf8').toString('base64');
    const reversedB64 = b64.split('').reverse().join('');
    return `(function(){const r="${reversedB64}";const d=decodeURIComponent(escape(atob(r.split("").reverse().join(""))));(0,eval)(d);})();`;
  }
}

function serveStatic(req, res) {
  const requestPath = req.url.split("?")[0];
  const lowerPath = requestPath.toLowerCase();

  if (
    lowerPath === "/scores/scores.json" ||
    lowerPath.endsWith("server.js") ||
    lowerPath.includes("/questions/") ||
    lowerPath.endsWith(".md")
  ) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  if (requestPath === "/") {
    res.writeHead(302, { Location: "/game/index.html" });
    res.end();
    return;
  }

  const safePath = requestPath;
  const filePath = path.join(ROOT_DIR, safePath);

  if (!isSafePath(filePath)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.stat(filePath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      sendJson(res, 404, { error: "Not Found" });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";
    const headers = { "Content-Type": mimeType };
    if (ext === ".html" || ext === ".js" || ext === ".css") {
      headers["Cache-Control"] = "no-cache";
    }

    if (ext === ".html") {
      fs.readFile(filePath, "utf8", (readErr, content) => {
        if (readErr) {
          sendJson(res, 500, { error: "Internal Server Error" });
          return;
        }
        res.writeHead(200, headers);
        res.end(injectSecurityHeaders(content));
      });
    } else if (ext === ".js") {
      fs.readFile(filePath, "utf8", (readErr, content) => {
        if (readErr) {
          sendJson(res, 500, { error: "Internal Server Error" });
          return;
        }
        res.writeHead(200, headers);
        res.end(obfuscateJS(content));
      });
    } else {
      res.writeHead(200, headers);
      fs.createReadStream(filePath).pipe(res);
    }
  });
}

const server = http.createServer((req, res) => {
  const pathname = req.url.split("?")[0];

  if (req.method === "GET" && pathname === "/api/admin/check") {
    sendJson(res, 200, { authenticated: isAdminAuthenticated(req) });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    readRequestBody(req, (body) => {
      try {
        const payload = JSON.parse(body || "{}");
        const key = String(payload.key || "").trim();
        if (key !== ADMIN_KEY) {
          sendJson(res, 401, { success: false, error: "Sai key admin." });
          return;
        }
        setAdminCookie(res);
        sendJson(res, 200, { success: true });
      } catch {
        sendJson(res, 400, { success: false, error: "Invalid JSON body" });
      }
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/logout") {
    clearAdminCookie(res);
    sendJson(res, 200, { success: true });
    return;
  }

  if (req.method === "GET" && pathname === "/api/scores") {
    if (!isAdminAuthenticated(req)) {
      sendJson(res, 403, { error: "Cần quyền admin." });
      return;
    }
    sendJson(res, 200, readScores());
    return;
  }

  if (req.method === "POST" && pathname === "/api/scores") {
    readRequestBody(req, (body) => {
      try {
        const payload = JSON.parse(body || "{}");
        const updatedScores = saveScore(payload);
        sendJson(res, 200, { success: true, scores: updatedScores });
      } catch {
        sendJson(res, 400, { success: false, error: "Invalid JSON body" });
      }
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/admin/change-score") {
    if (!isAdminAuthenticated(req)) {
      sendJson(res, 403, { error: "Cần quyền admin." });
      return;
    }
    readRequestBody(req, (body) => {
      try {
        const payload = JSON.parse(body || "{}");
        const targetPlayerId = String(payload.playerId || "").trim();
        const newScore = parseInt(payload.score, 10);

        if (!targetPlayerId) {
          sendJson(res, 400, { success: false, error: "Thiếu playerId" });
          return;
        }
        if (isNaN(newScore)) {
          sendJson(res, 400, { success: false, error: "Điểm số không hợp lệ" });
          return;
        }

        const scores = readScores();
        const existingIndex = scores.findIndex((s) => s.playerId === targetPlayerId);

        if (existingIndex !== -1) {
          scores[existingIndex].score = newScore;
          scores[existingIndex].createdAt = new Date().toISOString();
          // Cập nhật tên nếu có truyền
          if (payload.name) {
            scores[existingIndex].name = String(payload.name).trim().slice(0, 24);
          }
        } else {
          scores.push({
            playerId: targetPlayerId,
            name: String(payload.name || "Người chơi").trim().slice(0, 24),
            score: newScore,
            createdAt: new Date().toISOString()
          });
        }

        scores.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
        writeScores(scores);
        sendJson(res, 200, { success: true, scores });
      } catch (err) {
        sendJson(res, 400, { success: false, error: "Invalid JSON body" });
      }
    });
    return;
  }

  if (req.method === "GET" && pathname === "/api/rank") {
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const playerId = String(urlParams.searchParams.get("playerId") || "").trim();
    const scores = readScores();

    // Tính điểm cao nhất của mỗi người chơi (theo playerId)
    const bestByPlayer = {};
    for (const entry of scores) {
      const pid = entry.playerId || "";
      if (!bestByPlayer[pid] || entry.score > bestByPlayer[pid].score) {
        bestByPlayer[pid] = entry;
      }
    }

    // Sắp xếp theo điểm giảm dần
    const ranked = Object.values(bestByPlayer).sort((a, b) => b.score - a.score);
    const totalPlayers = ranked.length;
    const rankIndex = ranked.findIndex((e) => e.playerId === playerId);
    const rank = rankIndex === -1 ? null : rankIndex + 1;
    const bestScore = rankIndex === -1 ? 0 : ranked[rankIndex].score;

    sendJson(res, 200, { rank, totalPlayers, bestScore, playerId });
    return;
  }

  if (req.method === "GET" && pathname === "/api/questions/metadata") {
    sendJson(res, 200, { totalQuestions: questions.length });
    return;
  }

  if (req.method === "GET" && pathname === "/api/question") {
    const urlParams = new URL(req.url, `http://${req.headers.host}`);
    const index = parseInt(urlParams.searchParams.get("index"), 10);
    if (isNaN(index) || index < 0 || index >= questions.length) {
      sendJson(res, 400, { error: "Invalid question index" });
      return;
    }
    const q = questions[index];
    sendJson(res, 200, {
      question: q.question,
      options: q.options,
    });
    return;
  }

  if (req.method === "POST" && pathname === "/api/question/verify") {
    readRequestBody(req, (body) => {
      try {
        const payload = JSON.parse(body || "{}");
        const index = parseInt(payload.index, 10);
        const answer = String(payload.answer || "").trim().toUpperCase();

        if (isNaN(index) || index < 0 || index >= questions.length) {
          sendJson(res, 400, { error: "Invalid question index" });
          return;
        }

        const correctAnswer = questions[index].answer;
        const isCorrect = (answer === correctAnswer);

        sendJson(res, 200, { correct: isCorrect });
      } catch {
        sendJson(res, 400, { success: false, error: "Invalid JSON body" });
      }
    });
    return;
  }

  serveStatic(req, res);
});

loadQuestions();
ensureScoresFile();
server.listen(PORT, HOST, () => {
  const url = `http://localhost:${PORT}/game/index.html`;
  console.log(`Flappy Bird Quiz server dang chay tai ${url}`);
  console.log(`Bang xep hang (admin): http://localhost:${PORT}/scores/leaderboard.html`);
  
  const startCmd = process.platform === 'win32' ? 'start' : (process.platform === 'darwin' ? 'open' : 'xdg-open');
  exec(`${startCmd} ${url}`, (err) => {
    if (err) console.error("Khong the tu dong mo trinh duyet:", err);
  });
});
