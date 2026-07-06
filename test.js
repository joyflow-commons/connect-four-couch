// Engine regression tests. Run: node test.js
const assert = require('node:assert');
const { COLS, ROWS, emptyBoard, drop, winFrom, isFull, winningCols } = require('./engine');

let passed = 0;
function t(name, fn) {
  fn();
  passed++;
  console.log('ok -', name);
}

t('gravity stacks bottom-up', () => {
  const b = emptyBoard();
  assert.deepEqual(drop(b, 3, 'red'), { col: 3, row: 0 });
  assert.deepEqual(drop(b, 3, 'teal'), { col: 3, row: 1 });
});

t('full column rejects', () => {
  const b = emptyBoard();
  for (let i = 0; i < ROWS; i++) assert(drop(b, 0, 'red'));
  assert.equal(drop(b, 0, 'red'), null);
});

t('bad columns reject', () => {
  const b = emptyBoard();
  assert.equal(drop(b, -1, 'red'), null);
  assert.equal(drop(b, COLS, 'red'), null);
  assert.equal(drop(b, NaN, 'red'), null);
});

t('vertical win', () => {
  const b = emptyBoard();
  for (let i = 0; i < 4; i++) drop(b, 2, 'teal');
  const win = winFrom(b, 2, 3);
  assert(win && win.length === 4);
});

t('horizontal win', () => {
  const b = emptyBoard();
  for (const c of [0, 1, 2, 3]) drop(b, c, 'red');
  assert(winFrom(b, 3, 0));
});

t('diagonal / win', () => {
  const b = emptyBoard();
  // staircase: red at (0,0),(1,1),(2,2),(3,3)
  drop(b, 0, 'red');
  drop(b, 1, 'teal'); drop(b, 1, 'red');
  drop(b, 2, 'teal'); drop(b, 2, 'teal'); drop(b, 2, 'red');
  drop(b, 3, 'teal'); drop(b, 3, 'teal'); drop(b, 3, 'teal'); drop(b, 3, 'red');
  assert(winFrom(b, 3, 3));
});

t('diagonal \\ win', () => {
  const b = emptyBoard();
  drop(b, 3, 'red');
  drop(b, 2, 'teal'); drop(b, 2, 'red');
  drop(b, 1, 'teal'); drop(b, 1, 'teal'); drop(b, 1, 'red');
  drop(b, 0, 'teal'); drop(b, 0, 'teal'); drop(b, 0, 'teal'); drop(b, 0, 'red');
  assert(winFrom(b, 0, 3));
});

t('no false win on three', () => {
  const b = emptyBoard();
  for (const c of [0, 1, 2]) drop(b, c, 'red');
  assert.equal(winFrom(b, 2, 0), null);
});

t('five in a row still wins, all cells returned', () => {
  const b = emptyBoard();
  for (const c of [0, 1, 3, 4]) drop(b, c, 'teal');
  drop(b, 2, 'teal');
  const win = winFrom(b, 2, 0);
  assert(win && win.length === 5);
});

t('winningCols spots the threat', () => {
  const b = emptyBoard();
  for (const c of [0, 1, 2]) drop(b, c, 'red');
  assert.deepEqual(winningCols(b, 'red'), [3]);
  assert.deepEqual(winningCols(b, 'teal'), []);
});

t('winningCols double threat', () => {
  const b = emptyBoard();
  for (const c of [1, 2, 3]) drop(b, c, 'red');
  assert.deepEqual(winningCols(b, 'red'), [0, 4]);
});

t('winningCols leaves board untouched', () => {
  const b = emptyBoard();
  for (const c of [0, 1, 2]) drop(b, c, 'red');
  const before = JSON.stringify(b);
  winningCols(b, 'red');
  assert.equal(JSON.stringify(b), before);
});

t('isFull', () => {
  const b = emptyBoard();
  assert.equal(isFull(b), false);
  for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) drop(b, c, r % 2 ? 'red' : 'teal');
  assert.equal(isFull(b), true);
});

console.log(`\n${passed}/${passed} passed`);
