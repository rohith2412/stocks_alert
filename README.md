# trading_bot

Market-moving event watchers that push instant alerts to a Telegram bot.

## Watchers

- **`edgar_watcher.ts`** — polls SEC EDGAR's "current filings" feed for IPO /
  going-public events (`S-1`, `S-1/A`, `F-1`, `F-1/A`, `424B4`, `DRS`), dedupes
  against `seen_filings.json`, and alerts on new filings.
- **`finnhub_watcher.ts`** — polls Finnhub's general + per-ticker news, dedupes
  against `seen_news.json`, and alerts on articles relevant to the watchlist.

Both follow the same shape: **fetch → dedupe → match → format → send → save state.**
Shared helpers live in `lib.ts`.

## Finnhub matching

- **Watchlist (direct):** `SNDK, MU, SOXL, URA, TSLA` — matched by symbol, by
  Finnhub's `related` field, or by company name (e.g. "Micron" → MU).
- **Sector/peer map (indirect):** memory-sector peers (SK Hynix, Samsung, Western
  Digital/WDC, Kioxia) fire an alert flagged as relevant to `MU`/`SNDK`.
- **Trigger phrases:** `going public, IPO, guidance, downgrade, upgrade` are
  surfaced as tags. By default an article must still hit a ticker or peer to fire
  (keeps the general feed quiet). To also fire on phrase-only matches, see the note
  in `evaluate()` in `finnhub_watcher.ts`.

## Setup

```bash
npm install
```

Environment variables (set locally in a `.env`-style shell, and as GitHub Actions
secrets for the scheduled runs):

| Variable              | Used by            | Notes                                             |
| --------------------- | ------------------ | ------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`  | both               | From @BotFather                                   |
| `TELEGRAM_CHAT_ID`    | both               | Target chat/channel id                            |
| `FINNHUB_API_KEY`     | finnhub            | Free tier key from finnhub.io                     |
| `SEC_USER_AGENT`      | edgar (optional)   | `"name contact@email"` — SEC requires a UA header |

## Run locally

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... npm run edgar
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... FINNHUB_API_KEY=... npm run finnhub
```

## Scheduling

`.github/workflows/edgar-watcher.yml` and `finnhub-watcher.yml` run every 5 minutes
via GitHub Actions cron, then commit the updated `seen_*.json` back to the repo to
persist dedupe state between runs.
# stocks_alert
