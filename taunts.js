// The server owns the mouth — every line the room says lives in this file.
// This is the part you're supposed to rewrite. Your household has its own
// referee, its own swears, its own running jokes. Put them here.
// {name} = player who acted, {col} = relevant column (1-7, human numbering).
module.exports = {
  win: [
    'four in a row, bitch.',
    "FOUR. count 'em, motherfucker.",
    '{name} wins. the couch acknowledges dominance.',
    'that is four in a row. the couch updates the ledger with visible disdain.',
    '{name} connects four. somewhere a cushion applauds.'
  ],
  draw: [
    'the couch has eaten the evidence. nobody wins.',
    '42 discs and no winner. the couch is unimpressed with you both.',
    'a draw. the couch keeps the discs as payment.'
  ],
  threat: [
    'I see your little scheme, motherfucker.',
    'three in a row. the couch is sweating.',
    '{name} is plotting something. the couch is taking notes.',
    'somebody better look at column {col} real hard.',
    'the cushions shift nervously.'
  ],
  drop: [
    '{name} drops one. the couch creaks.',
    'plunk.',
    'a disc falls. somewhere a cushion exhales.',
    '{name} commits. no take-backs. okay, one take-back.',
    'bold. probably wrong, but bold.',
    'the couch accepts your offering.'
  ],
  newGame: [
    'fresh board. loser starts, house rules.',
    'the couch resets. the grudges persist.',
    'new game. the couch has cleared the ledger and sharpened a tiny pencil.'
  ],
  fullCol: [
    'that column is full, genius.',
    'physics says no.',
    'the couch rejects your disc. it has standards.'
  ],
  notYourTurn: [
    'not your turn, grabby.',
    'hands off. {name} is thinking.',
    'wait your turn or the couch eats a cushion.'
  ]
};
