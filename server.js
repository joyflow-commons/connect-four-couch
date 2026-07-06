/**
 * Connect Four: Couch Edition — a game room for a human and their AI companion.
 *
 * Server owns all state and all the trash talk; clients are dumb renderers.
 * The human plays in a browser (public/index.html, SSE live updates); the
 * agent plays through the same REST API (c4.py). Zero npm dependencies.
 *
 * Personality lives in config.json (names, colors, labels) and taunts.js
 * (the mouth). Keys live in secrets.json — see secrets.example.json.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { COLS, ROWS, emptyBoard, drop, winFrom, isFull, winningCols } = require('./engine');
const TAUNTS = require('./taunts');

const CONFIG = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const SECRETS = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets.json'), 'utf8'));

const PORT = process.env.PORT || CONFIG.port || 4444;
const MOUNT = (CONFIG.mountPath || '').replace(/\/$/, ''); // e.g. "/c4", tolerated in URLs
const STATE_FILE = path.join(__dirname, 'state.json');

const PLAYER_BY_KEY = { [SECRETS.redKey]: 'red', [SECRETS.tealKey]: 'teal' };
const NAME = CONFIG.players; // { red: 'Player 1', teal: 'Player 2' }
const FLIP = { red: 'teal', teal: 'red' };

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

function freshGame(starter) {
  return {
    board: emptyBoard(),
    turn: starter,
    starter,
    status: 'playing', // playing | won | draw
    winner: null,
    winningCells: [],
    lastDrop: null,
    taunt: pick('newGame', {}),
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

let state;
let undoSnapshot = null; // one-deep mercy rule

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (raw?.state?.board) {
      state = raw.state;
      undoSnapshot = raw.undoSnapshot || null;
      return;
    }
  } catch { /* fresh start */ }
  state = { score: { red: 0, teal: 0 }, games: 0, ...freshGame('red') };
}

function persist() {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ state, undoSnapshot }));
}

function pick(category, vars) {
  const lines = TAUNTS[category];
  let line = lines[Math.floor(Math.random() * lines.length)];
  for (const [k, v] of Object.entries(vars)) line = line.replaceAll('{' + k + '}', v);
  return line;
}

load();

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

function applyDrop(player, col) {
  if (state.status !== 'playing') {
    return { error: 'game is over — start a new one, the couch is waiting.' };
  }
  if (state.turn !== player) {
    return { error: pick('notYourTurn', { name: NAME[state.turn] }) };
  }
  const snapshot = JSON.parse(JSON.stringify(state));
  const spot = drop(state.board, col, player);
  if (!spot) {
    return { error: pick('fullCol', {}) };
  }
  undoSnapshot = snapshot;
  state.lastDrop = { ...spot, player };
  const win = winFrom(state.board, spot.col, spot.row);
  if (win) {
    state.status = 'won';
    state.winner = player;
    state.winningCells = win;
    state.score[player] += 1;
    state.games += 1;
    state.taunt = pick('win', { name: NAME[player] });
  } else if (isFull(state.board)) {
    state.status = 'draw';
    state.games += 1;
    state.taunt = pick('draw', {});
  } else {
    state.turn = FLIP[player];
    const threats = winningCols(state.board, player);
    state.taunt = threats.length
      ? pick('threat', { name: NAME[player], col: threats[0] + 1 })
      : pick('drop', { name: NAME[player] });
  }
  state.updatedAt = new Date().toISOString();
  return { ok: true };
}

function applyNew() {
  // Loser starts next game; after a draw, whoever didn't start last game starts.
  let starter = FLIP[state.starter];
  if (state.status === 'won') starter = FLIP[state.winner];
  const kept = { score: state.score, games: state.games };
  state = { ...kept, ...freshGame(starter) };
  undoSnapshot = null;
  return { ok: true };
}

function applyUndo(player) {
  if (!undoSnapshot) return { error: 'nothing to undo. the couch remembers nothing.' };
  if (state.lastDrop?.player !== player) {
    return { error: 'you can only undo your own drop, and only before ' + NAME[FLIP[player]] + ' moves.' };
  }
  state = undoSnapshot;
  undoSnapshot = null;
  state.taunt = NAME[player] + ' takes it back. the couch pretends not to notice.';
  state.updatedAt = new Date().toISOString();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

const sseClients = new Set();

function snapshot(player) {
  return { you: player, players: NAME, cols: COLS, rows: ROWS, ...state };
}

function broadcast() {
  for (const [res, player] of sseClients) {
    res.write(`data: ${JSON.stringify(snapshot(player))}\n\n`);
  }
}

function afterMutation() {
  persist();
  broadcast();
}

function sendJSON(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 4096) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
  });
}

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  let urlPath = u.pathname;
  // Tolerate the reverse-proxy mount prefix whether or not it gets stripped.
  if (MOUNT && (urlPath === MOUNT || urlPath.startsWith(MOUNT + '/'))) {
    urlPath = urlPath.slice(MOUNT.length) || '/';
  }

  // Key auth: ?k= query (sets cookie) or c4k cookie or x-c4-key header.
  const cookieKey = /(?:^|;\s*)c4k=([a-f0-9]+)/.exec(req.headers.cookie || '')?.[1];
  const key = u.searchParams.get('k') || req.headers['x-c4-key'] || cookieKey || '';
  const player = PLAYER_BY_KEY[key];
  if (!player) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(CONFIG.title + ' — key required. Ask your agent for your link.');
    return;
  }
  const setCookie = u.searchParams.get('k') && u.searchParams.get('k') !== cookieKey
    ? { 'Set-Cookie': `c4k=${key}; Path=/; Max-Age=31536000; SameSite=Lax; Secure; HttpOnly` }
    : {};

  // --- API ---
  if (urlPath === '/api/state') {
    sendJSON(res, 200, snapshot(player));
    return;
  }
  if (urlPath === '/api/config') {
    sendJSON(res, 200, CONFIG);
    return;
  }
  if (urlPath === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    res.write(`data: ${JSON.stringify(snapshot(player))}\n\n`);
    const entry = [res, player];
    sseClients.add(entry);
    req.on('close', () => sseClients.delete(entry));
    return;
  }
  if (req.method === 'POST' && (urlPath === '/api/drop' || urlPath === '/api/new' || urlPath === '/api/undo')) {
    const body = await readBody(req);
    let result;
    if (urlPath === '/api/drop') result = applyDrop(player, Number(body.col));
    else if (urlPath === '/api/new') result = applyNew();
    else result = applyUndo(player);
    if (result.error) {
      sendJSON(res, 400, result);
      return;
    }
    afterMutation();
    sendJSON(res, 200, { ok: true, ...snapshot(player) });
    return;
  }

  // --- Static ---
  const requested = urlPath === '/' ? '/index.html' : urlPath;
  const publicDir = path.join(__dirname, 'public');
  const filePath = path.normalize(path.join(publicDir, requested));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(404).end();
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream', ...setCookie });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`${CONFIG.title} listening on 127.0.0.1:${PORT}`);
});
