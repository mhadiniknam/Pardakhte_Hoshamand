#!/usr/bin/env node
/**
 * Minimal installer / bootstrap script.
 *
 * Usage:
 *   node install.js
 *   node install.js --force
 *   node install.js --production
 *   node install.js --ci
 *
 * What it does:
 * - Checks Node version
 * - Installs dependencies (npm)
 * - Optionally uses production mode (--production)
 * - Creates .env and .env.example if not present
 * - Provides helpful logs
 */

const { execSync, spawnSync } = require("child_process");
const { existsSync, writeFileSync, readFileSync } = require("fs");
const path = require("path");

const PROJECT_ROOT = process.cwd();
const PKG_PATH = path.join(PROJECT_ROOT, "package.json");
const ENV_PATH = path.join(PROJECT_ROOT, ".env");
const ENV_EXAMPLE_PATH = path.join(PROJECT_ROOT, ".env.example");

const args = process.argv.slice(2);
const FLAG_FORCE = args.includes("--force");
const FLAG_PROD = args.includes("--production");
const FLAG_CI = args.includes("--ci");

function log(msg) {
  console.log(`[install] ${msg}`);
}

function warn(msg) {
  console.warn(`[install][warn] ${msg}`);
}

function error(msg) {
  console.error(`[install][error] ${msg}`);
}

function checkNodeVersion() {
  const requiredMajor = 18; // Node 18+ recommended for global fetch
  const actual = process.versions.node;
  const major = parseInt(actual.split(".")[0], 10);
  if (major < requiredMajor) {
    warn(`Node ${actual} detected. Node >= ${requiredMajor} is recommended.`);
  } else {
    log(`Node version OK: ${actual}`);
  }
}

function ensurePackageJson() {
  if (!existsSync(PKG_PATH)) {
    warn("No package.json found. Creating a minimal one...");
    const pkg = {
      name: "zarinpal-minimal",
      version: "0.1.0",
      type: "module",
      main: "src/server.js",
      scripts: {
        start: "node src/server.js",
        dev: "node src/server.js"
      },
      dependencies: {
        "node-fetch": "^3.3.2",
        dotenv: "^16.4.5",
        express: "^4.19.2"
      }
    };
    writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2), "utf8");
    log("Created package.json");
  } else {
    log("Found existing package.json");
  }
}

function createEnvTemplates() {
  const template = `# ZarinPal configuration
ZARINPAL_MERCHANT_ID=
ZARINPAL_CALLBACK_URL=http://localhost:3000/payment/callback
ZARINPAL_SANDBOX=true
ZARINPAL_DEFAULT_AMOUNT=10000
`;
  if (!existsSync(ENV_EXAMPLE_PATH)) {
    writeFileSync(ENV_EXAMPLE_PATH, template, "utf8");
    log("Created .env.example");
  }
  if (!existsSync(ENV_PATH)) {
    writeFileSync(ENV_PATH, template, "utf8");
    log("Created .env (remember to fill your Merchant ID)");
  } else {
    log(".env already exists");
  }
}

function shouldInstall() {
  const nodeModulesPath = path.join(PROJECT_ROOT, "node_modules");
  if (!existsSync(nodeModulesPath)) {
    return true;
  }
  if (FLAG_FORCE) {
    log("--force specified, reinstalling dependencies.");
    return true;
  }
  log("Dependencies appear installed (node_modules exists). Use --force to reinstall.");
  return false;
}

function installDeps() {
  const installArgs = ["install"];
  if (FLAG_PROD) {
    installArgs.push("--omit=dev");
  }
  if (FLAG_CI) {
    installArgs.push("--no-fund", "--no-audit");
  }

  log(`Running: npm ${installArgs.join(" ")}`);
  const result = spawnSync("npm", installArgs, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) {
    error("npm install failed.");
    process.exit(result.status || 1);
  }
  log("Dependencies installed successfully.");
}

function summary() {
  log("Installation complete.");
  log("Next steps:");
  console.log(`
  1. Edit .env and add your ZARINPAL_MERCHANT_ID.
  2. Start a test server (if you've added one):
     npm run dev
  3. Initiate a payment request in your code.
`);
}

function main() {
  log("Starting installer...");
  checkNodeVersion();
  ensurePackageJson();
  createEnvTemplates();
  if (shouldInstall()) {
    installDeps();
  }
  summary();
}

main();
