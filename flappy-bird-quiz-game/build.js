const fs = require("fs");
const path = require("path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, "dist");

const COPY_DIRS = ["assets", "game", "questions", "scores"];
const COPY_FILES = ["README.md"];

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
  const isDevtoolCode =
    code.includes("devtoolOverlay") ||
    code.includes("toggleIdHistoryDevTool") ||
    code.includes("performDevtoolAdminLogin");

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

  const codeToObfuscate = protections + "\n" + code;

  const obfuscationResult = JavaScriptObfuscator.obfuscate(codeToObfuscate, {
    compact: true,
    controlFlowFlattening: isDevtoolCode,
    controlFlowFlatteningThreshold: isDevtoolCode ? 0.75 : 0.2,
    deadCodeInjection: isDevtoolCode,
    deadCodeInjectionThreshold: isDevtoolCode ? 0.4 : 0.1,
    debugProtection: true,
    debugProtectionInterval: 2000,
    disableConsoleOutput: true,
    identifierNamesGenerator: "hexadecimal",
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
    stringArrayEncoding: ["base64", "rc4"],
    stringArrayIndexShift: true,
    stringArrayRotate: true,
    stringArrayShuffle: true,
    stringArrayWrappersCount: 1,
    stringArrayWrappersChainedCalls: true,
    stringArrayWrappersParametersMaxCount: 2,
    stringArrayWrappersType: "variable",
    stringArrayThreshold: 0.75,
    unicodeEscapeSequence: false,
  });

  return obfuscationResult.getObfuscatedCode();
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function processFile(relPath) {
  const srcPath = path.join(ROOT_DIR, relPath);
  const destPath = path.join(DIST_DIR, relPath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  const ext = path.extname(relPath).toLowerCase();

  if (ext === ".js") {
    const content = fs.readFileSync(srcPath, "utf8");
    fs.writeFileSync(destPath, obfuscateJS(content), "utf8");
    console.log(`  obfuscated: ${relPath}`);
    return;
  }

  if (ext === ".html") {
    const content = fs.readFileSync(srcPath, "utf8");
    fs.writeFileSync(destPath, injectSecurityHeaders(content), "utf8");
    console.log(`  secured: ${relPath}`);
    return;
  }

  fs.copyFileSync(srcPath, destPath);
}

function writeDistServer() {
  let server = fs.readFileSync(path.join(ROOT_DIR, "server.js"), "utf8");

  const injectStart = server.indexOf("function injectSecurityHeaders(html)");
  const serveStaticStart = server.indexOf("function serveStatic(req, res)");
  if (injectStart === -1 || serveStaticStart === -1) {
    throw new Error("Could not patch server.js for dist build");
  }
  server = server.slice(0, injectStart) + server.slice(serveStaticStart);

  const servePatched = server.replace(
    /if \(ext === "\.html"\) \{[\s\S]*?res\.end\(injectSecurityHeaders\(content\)\);[\s\S]*?\} else if \(ext === "\.js"\) \{[\s\S]*?res\.end\(obfuscateJS\(content\)\);[\s\S]*?\} else \{/,
    `if (ext === ".html" || ext === ".js") {
      fs.readFile(filePath, "utf8", (readErr, content) => {
        if (readErr) {
          sendJson(res, 500, { error: "Internal Server Error" });
          return;
        }
        res.writeHead(200, headers);
        res.end(content);
      });
    } else {`
  );
  if (servePatched === server) {
    throw new Error("Could not patch serveStatic in server.js for dist build");
  }
  server = servePatched;

  server = server.replace(
    /\s*const startCmd = process\.platform === 'win32' \? 'start' : \(process\.platform === 'darwin' \? 'open' : 'xdg-open'\);\s*exec\(`\$\{startCmd\} \$\{url\}`[\s\S]*?\}\);\s*/,
    "\n"
  );

  fs.writeFileSync(path.join(DIST_DIR, "server.js"), server, "utf8");
  console.log("  wrote: server.js (production, no runtime obfuscation)");
}

function build() {
  console.log("Building dist/ ...");

  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });

  for (const dir of COPY_DIRS) {
    const src = path.join(ROOT_DIR, dir);
    if (fs.existsSync(src)) {
      copyDir(src, path.join(DIST_DIR, dir));
      console.log(`  copied: ${dir}/`);
    }
  }

  for (const file of COPY_FILES) {
    const src = path.join(ROOT_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(DIST_DIR, file));
      console.log(`  copied: ${file}`);
    }
  }

  const jsFiles = [];
  const htmlFiles = [];

  function walk(dir, base = "") {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = path.join(base, entry.name).replace(/\\/g, "/");
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, rel);
      } else if (entry.name.endsWith(".js")) {
        jsFiles.push(rel);
      } else if (entry.name.endsWith(".html")) {
        htmlFiles.push(rel);
      }
    }
  }

  for (const dir of COPY_DIRS) {
    const src = path.join(DIST_DIR, dir);
    if (fs.existsSync(src)) {
      walk(src, dir);
    }
  }

  for (const rel of jsFiles) {
    const srcPath = path.join(ROOT_DIR, rel);
    const destPath = path.join(DIST_DIR, rel);
    const content = fs.readFileSync(srcPath, "utf8");
    fs.writeFileSync(destPath, obfuscateJS(content), "utf8");
    console.log(`  obfuscated: ${rel}`);
  }

  for (const rel of htmlFiles) {
    const destPath = path.join(DIST_DIR, rel);
    const content = fs.readFileSync(destPath, "utf8");
    fs.writeFileSync(destPath, injectSecurityHeaders(content), "utf8");
    console.log(`  secured: ${rel}`);
  }

  writeDistServer();

  fs.writeFileSync(
    path.join(DIST_DIR, "_redirects"),
    "/  /game/index.html  200\n/game  /game/index.html  200\n",
    "utf8"
  );

  fs.writeFileSync(
    path.join(DIST_DIR, "package.json"),
    JSON.stringify(
      {
        name: "flappy-bird-quiz-game",
        private: true,
        scripts: {
          start: "node server.js",
        },
      },
      null,
      2
    ),
    "utf8"
  );

  console.log("\nDone. Deploy folder: dist/");
  console.log("Run: cd dist && node server.js");
}

build();
