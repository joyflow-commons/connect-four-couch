// Connect Four engine — 7 columns × 6 rows.
// Board is column-major, bottom-up: board[col] = ['red','teal',...], so gravity is a push().
const COLS = 7;
const ROWS = 6;

function emptyBoard() {
  return Array.from({ length: COLS }, () => []);
}

function cellAt(board, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return board[col][row] ?? null;
}

// Drop a disc; returns landing {col,row} or null if the column is full/invalid.
function drop(board, col, player) {
  if (!Number.isInteger(col) || col < 0 || col >= COLS || board[col].length >= ROWS) return null;
  board[col].push(player);
  return { col, row: board[col].length - 1 };
}

const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

// If the disc at (col,row) completes four or more, return every cell in the winning line(s).
function winFrom(board, col, row) {
  const p = cellAt(board, col, row);
  if (!p) return null;
  const cells = new Map();
  for (const [dc, dr] of DIRS) {
    const line = [[col, row]];
    for (const s of [1, -1]) {
      let c = col + dc * s, r = row + dr * s;
      while (cellAt(board, c, r) === p) {
        line.push([c, r]);
        c += dc * s;
        r += dr * s;
      }
    }
    if (line.length >= 4) for (const [c, r] of line) cells.set(c + ',' + r, [c, r]);
  }
  return cells.size ? [...cells.values()] : null;
}

function isFull(board) {
  return board.every(c => c.length >= ROWS);
}

// Columns where dropping right now would win for player.
function winningCols(board, player) {
  const cols = [];
  for (let c = 0; c < COLS; c++) {
    const spot = drop(board, c, player);
    if (!spot) continue;
    if (winFrom(board, c, spot.row)) cols.push(c);
    board[c].pop();
  }
  return cols;
}

module.exports = { COLS, ROWS, emptyBoard, cellAt, drop, winFrom, isFull, winningCols };
