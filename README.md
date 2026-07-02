# Snip

A tiny URL shortener with **one backend, two clients** — each layer lives on its
own git branch and is wired into this superproject as a submodule.

```
snip-demo/
├── backend/    ← Bun HTTP server          (branch: backend)
├── frontend/   ← Angular 19 SPA          (branch: frontend)
├── cli/        ← Node.js CLI             (branch: cli)
└── bundle/     ← Generated release       (branch: bundle  — do not hand-edit)
```

## Architecture

```
┌──────────────┐        ┌──────────────┐
│ Angular SPA  │──HTTP──►              │
└──────────────┘        │  Bun server  │──► in-memory Map
┌──────────────┐        │  :3000       │
│ Node CLI     │──HTTP──►              │
└──────────────┘        └──────────────┘
```

The **backend** is the single source of truth.  
The **frontend** and the **CLI** are independent clients that speak the same API.

## API contract

| Method   | Path          | Request body                     | Success response                                       | Error          |
|----------|---------------|----------------------------------|--------------------------------------------------------|----------------|
| `POST`   | `/api/links`  | `{ "url": "https://…" }`         | `201 { code, url, shortUrl, hits, createdAt }`         | `400 { error }`|
| `GET`    | `/api/links`  | —                                | `200` array of link objects (same shape)               | —              |
| `GET`    | `/:code`      | —                                | `302 Location: <original url>` (increments `hits`)     | `404`          |
| `OPTIONS`| `*`           | —                                | `204` (open CORS preflight)                            | —              |

## Branch / submodule layout

| Branch     | Submodule path | Contents                                                 |
|------------|----------------|----------------------------------------------------------|
| `backend`  | `backend/`     | `server.js`, `package.json`, README                      |
| `frontend` | `frontend/`    | Angular 19 app (`snip-frontend`)                         |
| `cli`      | `cli/`         | `cli.js`, shell wrappers, `package.json`                 |
| `bundle`   | `bundle/`      | **Generated** — `server.js`, `cli.js`, `public/`, Docker |
| `main`     | *(superproject)* | This README + `.gitmodules` + `scripts/`              |

## Clone

Always pass `--recurse-submodules`; a plain `git clone` leaves the submodule
folders empty:

```sh
git clone --recurse-submodules https://github.com/cs168898/ai-sdlc-snip-demo
cd ai-sdlc-snip-demo
```

Already cloned without the flag?

```sh
git submodule update --init --recursive
```

## Run

### 1 — Backend

```sh
cd backend
bun start                    # bun run server.js
```

Default port: **3000**.  
Environment variables: `PORT`, `BASE_URL`, `PUBLIC_DIR` — see `backend/README.md`.

### 2a — Frontend dev server

```sh
cd frontend
npm install
npx ng serve                 # → http://localhost:4200
```

The Angular app calls the backend at `http://localhost:3000`.

### 2b — Frontend built + served by backend

```sh
cd frontend
npm install
npx ng build                 # output → dist/snip-frontend/browser/

# in a second terminal, from the repo root:
PUBLIC_DIR=frontend/dist/snip-frontend/browser bun run backend/server.js
```

### 3 — CLI

```sh
cd cli
node cli.js help
node cli.js add https://example.com/very/long/path
node cli.js ls
node cli.js open <code>
```

Override the backend URL with `SNIP_API=http://host:port`.  
Install globally: `npm install -g .` then just `snip <command>`.

## Updating a submodule

Edit inside the submodule folder → commit → push to its own branch → bump the
superproject pointer:

```sh
# 1. Work inside the submodule
cd backend
# ... make changes ...
git add .
git commit -m "fix: improve something"
git push origin backend

# 2. Back in the superproject — advance the pinned commit
cd ..
git submodule update --remote backend   # fetches latest tip of the tracked branch
git add backend
git commit -m "chore: bump backend submodule"
git push
```

To update **all** submodules at once:

```sh
git submodule update --remote
git add backend frontend cli
git commit -m "chore: bump all submodules"
git push
```

## Bundle — release artefact

The `bundle/` submodule (branch: `bundle`) is **generated output**. Never edit
it by hand. Run the build script instead:

```sh
node scripts/build-bundle.mjs           # assemble + commit (dry run)
node scripts/build-bundle.mjs --push    # assemble + commit + push
```

The script:
1. Pulls the latest tip of `backend`, `frontend`, and `cli`
2. Runs `npm install && ng build` in `frontend/`
3. Copies `server.js`, `cli.js`, and the compiled SPA into `bundle/`
4. Writes `.env` (`PUBLIC_DIR=./public`), `package.json`, `Dockerfile`, and
   `railway.json` into `bundle/`
5. Commits inside `bundle/` and bumps the superproject pointer — skipping
   both commits when nothing has changed (safe to run repeatedly)

The assembled bundle is self-contained: `bun start` in the `bundle/` folder
runs the backend and also serves the Angular SPA.

