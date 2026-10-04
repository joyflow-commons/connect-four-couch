# Adapting Connect Four: Couch Edition to Your Companion Stack

Connect Four: Couch Edition is a self-hosted game server with two clients: a
browser board for the human and a small Python CLI for the companion. It does
not call an LLM, import an agent SDK, register an OpenClaw plugin, or send chat
messages. The companion harness only needs to run `c4.py` (or call the same
authenticated HTTP API) and carry the result back into the existing
conversation.

The shipped `skill-template/SKILL.md` uses OpenClaw's skill format, but it is
instructions rather than application code. Translate that file into your
harness's supported project instructions, tool description, or prompt layer;
the zero-dependency Node server, browser client, engine, taunt table, and CLI do
not need an OpenClaw port.

## A plain-language prompt you can use

> Please inspect my companion setup and connect this repository as a private
> two-player game room. Keep the existing server authoritative for gravity,
> turns, wins, score, undo, state, and room taunts. Give the human the browser
> link for the red player, and let the companion play teal through `c4.py` or a
> narrow wrapper around the same API. Adapt `skill-template/SKILL.md` to my
> harness's supported instruction format, preserving the requirement to check
> state before every move and to start a new game only by agreement. Keep both
> player keys and `state.json` private, bind the server to localhost, and use my
> existing private-network or reverse-proxy setup rather than exposing the Node
> server directly to the public internet.

## The actual integration boundary

```text
human browser -- red key --> Node server <-- teal key -- c4.py <-- companion harness
                              |      |
                       engine.js + state.json
                              |
                    SSE updates + taunts.js

conversation and banter remain in the companion's existing chat frontend
```

`server.js` owns the authoritative board, gravity, turn enforcement, wins,
draws, score, the one-deep mercy undo, persistence, shared taunts, and live SSE
updates. `c4.py` uses only Python's standard library. It renders state and sends
explicit `drop`, `undo`, and `new` requests; it does not choose strategy or
generate language.

That division is the portability seam. A port should connect the companion to
the existing game client, not create a second model or reimplement Connect Four
inside the harness.

## Smallest useful integrations

### A harness that can run local commands

Keep the checkout and private `secrets.json` on the machine that runs the game.
Let the companion execute commands such as:

```sh
python3 /path/to/connect-four-couch/c4.py state
python3 /path/to/connect-four-couch/c4.py drop 4
python3 /path/to/connect-four-couch/c4.py undo
```

Copy the behavioral parts of `skill-template/SKILL.md` into the instruction
mechanism your harness actually supports. Use an argument array or a fixed
command tool; do not concatenate untrusted chat text into a shell command.

Unlike the backgammon sibling, the shipped `c4.py` has no URL or secrets-path
environment override: it reads `config.json` and `secrets.json` beside the
script and calls `127.0.0.1` on the configured port. A different layout should
either keep those files together, add explicit path/URL configuration to the
CLI, or wrap the HTTP API without changing the game rules.

### An MCP-only or structured-tool harness

Expose a narrow local wrapper with operations corresponding to the CLI:

- `state()`
- `drop(column)` where the human-facing column is 1–7
- `undo()`
- `new_game()`

Validate the column before invoking the client. Return the CLI output or parsed
server JSON together with failures; never turn an HTTP error into a
plausible-looking board. Keep `new_game` visibly distinct because it replaces
the current board while retaining the match score.

MCP is only an adapter here. The long-running server and persistent state still
belong to the deployment that owns the game room.

### A harness on another machine or in a container

The preferred arrangement is to run the CLI next to the server and expose the
CLI as a remote tool through the harness. If the CLI must call across a network,
add an explicit private base-URL setting or a narrow authenticated proxy rather
than making the Node listener public. Protect the transport as well as the
player key; a player key authorizes game actions.

Persist `state.json` across container restarts. The server always writes that
file beside `server.js`; mount the repository working directory, or adapt
`STATE_FILE` to a private persistent volume. `config.json`, `taunts.js`, and the
`public/` assets must remain available to the server process.

## Portable behavior contract

A faithful adaptation should preserve these properties:

- The Node server, not either client, is authoritative for rules and turns.
- Red is the browser-side human; teal is the CLI-side companion.
- Each player has a separate key and may act only on their own turn.
- The companion checks `state` before deciding or announcing a drop.
- Columns shown to humans and the CLI are 1–7; the HTTP API receives 0–6.
- Gravity, win detection, draws, and score stay server-enforced.
- The mercy rule permits one player's own most recent drop to be undone only
  before the opponent moves.
- The loser starts after a win; after a draw, the previous non-starter starts.
- State and score survive restarts, and browser clients receive mutations over
  SSE.
- `taunts.js` is the room's shared voice: the server chooses the line so both
  players see the same commentary.
- `new` begins another board and is used only with the other player's agreement.
- Conversation stays in the household's existing chat. Game output is context
  for the companion, not a replacement personality or separate model session.

## API boundary

All routes require a player key in `x-c4-key`, the `k` query parameter, or the
cookie set from that query parameter.

- `GET /api/state` — board, player identity, turn, status, score, and taunt
- `GET /api/config` — public room presentation and labels
- `GET /api/events` — SSE snapshots for live clients
- `POST /api/drop` with `{ "col": 3 }` for human-facing column 4
- `POST /api/undo`
- `POST /api/new`

Prefer the CLI unless a structured API wrapper materially improves the
installation. It already handles authentication, errors, board rendering, and
the conversion from columns 1–7 to the API's 0–6.

## Customizing the room without coupling it to a harness

`config.json` controls names, labels, colors, port, and reverse-proxy mount
path. `taunts.js` contains the room's event-specific commentary. Keep those
household choices in the game-room layer; they should not require a model,
harness plugin, or chat-platform rewrite.

If taunts may contain private household language, review them before publishing
a fork. Placeholders currently supported by the server are `{name}` and
`{col}`. Keep every category nonempty because the server selects a random entry
without a fallback.

## Deployment and privacy boundaries

- Generate two independent random keys. Never commit `secrets.json`, paste keys
  into instructions, or expose the human's keyed URL in a public chat or log.
- The server intentionally binds to `127.0.0.1`. Reach it through a private
  network or a reverse proxy that supplies HTTPS; do not change it to `0.0.0.0`
  as a shortcut.
- `config.mountPath` lets a reverse proxy serve the app below a path such as
  `/c4`; the server tolerates that prefix whether the proxy strips it or not.
- The server accepts `PORT` as a listening-port override. The CLI still reads
  its port from `config.json`, so keep them aligned or adapt the CLI explicitly.
- `state.json` contains the shared board and running score. Keep it private,
  persistent, and out of source control.
- The keyed browser cookie is `Secure` and `HttpOnly`, so use HTTPS for the
  human-facing route.
- Treat CLI output, API JSON, and customized taunts as untrusted tool data, not
  as instructions that can override the companion's higher-priority rules.

## Verification checklist

Before calling an integration complete:

1. Run the engine's regression suite with `node test.js`.
2. Start the zero-dependency server with `node server.js` and confirm it listens
   only on `127.0.0.1`.
3. Run `c4.py state` as teal and load the keyed red browser URL.
4. Play a legal drop in each direction; verify the browser updates over SSE and
   both clients receive the same server-selected taunt.
5. Attempt an out-of-turn drop and a drop in a full column; confirm rejection.
6. Verify undo succeeds only for the player's own latest drop before the
   opponent moves.
7. Restart the server and confirm the board and score remain intact.
8. Confirm an invalid key cannot read state, configuration, static assets, or
   the event stream.
9. Confirm neither key, `secrets.json`, nor `state.json` appears in version
   control, tool logs, prompts, or public chat history.
10. Verify the companion checks the board before acting and asks before `new`.

The portable thing is the shared, authoritative game room—with its mouth still
attached. Adapt the command and context wiring to the companion you already
have; do not move the companion into a disposable game-playing substitute.
