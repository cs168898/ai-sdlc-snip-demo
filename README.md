# Snip — Backend

Tiny URL shortener API built with [Bun](https://bun.sh). Zero npm dependencies.

## Quick start

```sh
bun start
# or
bun run server.js
```

## Environment variables

| Variable                | Default                    | Description                                            |
|-------------------------|----------------------------|--------------------------------------------------------|
| `PORT`                  | `3000`                     | TCP port to listen on                                  |
| `BASE_URL`              | `http://localhost:<PORT>`  | Origin used in `shortUrl` responses                    |
| `RAILWAY_PUBLIC_DOMAIN` | —                          | Detected automatically on Railway (fallback for BASE_URL) |
| `PUBLIC_DIR`            | —                          | Optional folder to serve static files from             |

When `PUBLIC_DIR` is set, `GET /` serves `index.html` from that folder, and any
existing static file takes priority over a same-named short code.

## API

### `POST /api/links`

Create a short link.

**Request body** (`application/json`):
```json
{ "url": "https://example.com/very/long/path" }
```

**Response `201`**:
```json
{
  "code": "aB3xY9",
  "url": "https://example.com/very/long/path",
  "shortUrl": "http://localhost:3000/aB3xY9",
  "hits": 0,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

Returns `400` for invalid JSON or a non-http(s) URL.

---

### `GET /api/links`

Returns a JSON array of all links (same shape as above).

---

### `GET /:code`

Redirects (`302`) to the original URL and increments `hits`.  
Returns `404` if the code is unknown.
