# Snip

A tiny URL shortener with **one backend, two clients** — each layer lives on its
own git branch and is wired into this superproject as a submodule.

```
snip-demo/
├── backend/    ← Bun HTTP server          (branch: backend)
├── frontend/   ← Angular 19 SPA          (branch: frontend)
└── cli/        ← Node.js CLI             (branch: cli)
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

| Branch     | Submodule path | Contents                                  |
|------------|----------------|-------------------------------------------|
| `backend`  | `backend/`     | `server.js`, `package.json`, README       |
| `frontend` | `frontend/`    | Angular 19 app (`snip-frontend`)          |
| `cli`      | `cli/`         | `cli.js`, shell wrappers, `package.json`  |
| `main`     | *(superproject)* | This README + `.gitmodules` pointers   |

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
