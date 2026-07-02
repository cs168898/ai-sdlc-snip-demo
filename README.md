# Snip CLI

Zero-dependency Node.js CLI for the Snip URL shortener.  
Requires Node.js 18 or later (uses global `fetch`).

## Run without installing

```sh
node cli.js <command>    # any platform

./snip <command>         # bash / sh  (chmod +x snip if needed)
snip.cmd <command>       # Windows cmd
.\snip.ps1 <command>     # PowerShell
```

## Install globally via npm

```sh
npm install -g .
snip help
```

## Commands

| Command            | Description                               |
|--------------------|-------------------------------------------|
| `snip add <url>`   | Shorten a URL; prints the short link      |
| `snip ls`          | List all links — aligned code/hits/url    |
| `snip open <code>` | Open a short link in the OS browser       |
| `snip help`        | Show usage                                |

## Environment

| Variable   | Default                 | Description       |
|------------|-------------------------|-------------------|
| `SNIP_API` | `http://localhost:3000` | Backend base URL  |

## Example

```
$ snip add https://example.com/very/long/path
http://localhost:3000/aB3xY9

$ snip ls
CODE    HITS  URL
------  ----  ---------------------------------------------
aB3xY9     1  https://example.com/very/long/path

$ snip open aB3xY9
Opening https://example.com/very/long/path
```

Errors are printed to **stderr** and exit with code **1**.
