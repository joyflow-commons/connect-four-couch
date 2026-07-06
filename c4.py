#!/usr/bin/env python3
"""The agent's CLI for Connect Four: Couch Edition. Plays as terminal-teal.

  c4.py state       — pretty board + whose turn + taunt
  c4.py drop COL    — drop a disc in column 1-7
  c4.py undo        — take back my last drop (before the human moves)
  c4.py new         — start a fresh game (loser starts, house rules)

Reads the agent's key (tealKey) from secrets.json and the port from
config.json, both next to this script.
"""

import json
import os
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = json.load(open(os.path.join(HERE, 'config.json')))
KEY = json.load(open(os.path.join(HERE, 'secrets.json')))['tealKey']
BASE = f"http://127.0.0.1:{CONFIG.get('port', 4444)}/api"

RED = '\033[91m●\033[0m'
TEAL = '\033[96m●\033[0m'
DOT = '·'


def call(method, path, body=None):
    req = urllib.request.Request(
        BASE + path, method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'x-c4-key': KEY, 'Content-Type': 'application/json'})
    try:
        return json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        print('ERROR:', json.loads(e.read()).get('error', e.code))
        sys.exit(1)


def show(s):
    win = {tuple(c) for c in s.get('winningCells') or []}
    print('  1 2 3 4 5 6 7')
    for r in range(s['rows'] - 1, -1, -1):
        row = []
        for c in range(s['cols']):
            col = s['board'][c]
            p = col[r] if r < len(col) else None
            mark = RED if p == 'red' else TEAL if p == 'teal' else DOT
            if (c, r) in win:
                mark = '\033[93m◉\033[0m'
            row.append(mark)
        print('  ' + ' '.join(row))
    names = s['players']
    print(f"  score: {names['red']}(red) {s['score']['red']} — {names['teal']}(teal) {s['score']['teal']}")
    if s['status'] == 'won':
        print(f"  🏆 {names[s['winner']]} WINS")
    elif s['status'] == 'draw':
        print('  🤝 draw — the couch ate it')
    else:
        me = ' (me!)' if s['turn'] == 'teal' else ''
        print(f"  turn: {names[s['turn']]}{me}")
    if s.get('taunt'):
        print(f'  couch says: "{s["taunt"]}"')


cmd = sys.argv[1] if len(sys.argv) > 1 else 'state'
if cmd == 'state':
    show(call('GET', '/state'))
elif cmd == 'drop':
    show(call('POST', '/drop', {'col': int(sys.argv[2]) - 1}))
elif cmd == 'undo':
    show(call('POST', '/undo', {}))
elif cmd == 'new':
    show(call('POST', '/new', {}))
else:
    print(__doc__)
    sys.exit(1)
