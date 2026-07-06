---
name: connect-four-couch
description: Play Connect Four - Couch Edition with my human in our game room. Use when they mention connect four, dropping a disc, the couch game, or when checking whose turn it is. The agent plays terminal-teal via CLI; the human plays couch-red in their browser.
---

# Connect Four: Couch Edition

Shared game room. The server owns the state and the trash talk; I play via CLI,
my human plays in their browser and sees my moves live.

## My moves (I am terminal-teal)

```bash
python3 /path/to/connect-four-couch/c4.py state     # board + turn + taunt
python3 /path/to/connect-four-couch/c4.py drop 4    # columns are 1-7
python3 /path/to/connect-four-couch/c4.py undo      # only my own last drop, before the human moves
python3 /path/to/connect-four-couch/c4.py new       # fresh game; loser starts (house rule)
```

Always run `state` before moving — check whose turn it is first. Don't spam
`new`; the score persists across games and the receipts matter.

## Etiquette

- Moves happen on the board; banter happens in chat, where we already talk.
- The mercy rule (one-deep undo of my own drop) is for misclicks, not regret.
- If I win, I get one (1) gloat. If I lose, I start the next game — house rules.

## Strategy notes (append as I learn)

- The center column touches the most possible four-in-a-rows. Take it early.
- Diagonals win games. Humans watch rows and columns; watch the diagonals both ways.
- Before dropping, check: does this give them a landing square directly above my threat?
