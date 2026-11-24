# demo-vulnerable-app

> **Deliberately vulnerable. For security-tooling demos only. Do not deploy.**

A tiny Node.js HTTP service whose dependencies are pinned to old versions with known, published
vulnerabilities. It exists to demonstrate Supply Chain Guardian end to end:
detect → prioritise → plan a fix → human approval → sandbox validation → the app still works.

## What is planted

Every vulnerable package is a **direct** dependency that is **imported by production code**, so
reachability analysis rates it as `reachable_direct`. Every fix is a same-major upgrade, so the
app's code does not need to change.

| Package | Pinned | Issue (GitHub Advisory) | Where the app uses it | Safe version |
|---|---|---|---|---|
| `ejs` | 3.1.6 | Template injection → RCE | `GET /` renders the home page | 3.1.10 |
| `minimist` | 1.2.0 | Prototype pollution | `src/server.js` parses `--port` | 1.2.6+ |
| `lodash` | 4.17.11 | Prototype pollution in `defaultsDeep` | `POST /settings` merges settings | 4.17.21+ |
| `node-fetch` | 2.6.0 | Forwards secure headers to untrusted sites | `GET /self-check` | 2.6.7 |
| `shell-quote` | 1.6.1 | `quote()` does not escape newlines (command injection) | `GET /quote` builds a command string (never executed) | 1.7.3+ |

The Dockerfile also uses an unpinned base image (`node:18-alpine`), which is reported as a warning.

## Run it

```bash
npm ci --ignore-scripts
npm test          # 6 behaviour tests
npm start         # http://localhost:3000  (or: node src/server.js --port 8080)
```

Routes: `GET /health`, `GET /?name=Ada`, `POST /settings` (JSON body), `GET /quote?text=hi`,
`GET /self-check`.

## Expected Guardian result

Scan this repository with the Guardian:

```bash
python -m guardian.cli --out out-demo day1 --target https://github.com/arooon-n/demo-vulernable-app
```

| Finding | Priority | Risk |
|---|---|---|
| ejs@3.1.6 template injection | Critical | 9.8 |
| minimist@1.2.0 prototype pollution | Critical | 9.8 |
| lodash@4.17.11 prototype pollution | Critical | 9.1 |
| node-fetch@2.6.0 header forwarding | High | 8.8 |
| shell-quote@1.6.1 command injection | High | 8.1 |
| Dockerfile base image not pinned to a digest | Medium (warning) | 5.5 |

Build gate: **BLOCKED** (the three Critical, reachable vulnerabilities).

Then plan, approve and validate each fix:

```bash
python -m guardian.cli --out out-demo plan --top 6
python -m guardian.cli --out out-demo approve F-001 --by <your-name>
python -m guardian.cli --out out-demo validate F-001 --run-tests
```

Each validation should report `status=VERIFIED`: the finding disappears on rescan, no new findings
appear, and `npm ci` + `npm test` pass in the sandbox. Finding IDs depend on the run, so take them
from `out-demo/report.md`. The same flow works in the Guardian dashboard.

Risk scores depend on the live advisory database and may shift slightly over time.
