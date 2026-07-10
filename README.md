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

Scope: **US + Canadian listings, all sectors, weighted to Tech + Semis.** The full
watchlist and rules live in `watchlist.ts`.

- **Curated watchlist (direct):** ~70 major US + Canadian names across every sector
  (semis, big tech, energy/materials, financials incl. Canadian banks, healthcare,
  consumer/industrials). Matched by company-name alias (word-boundary) or by
  Finnhub's structured `related` field. Canadian names are matched via their
  US-listed tickers (e.g. `SHOP`, `RY`, `ENB`, `CNQ`).
- **Sector/peer map (indirect):** memory-sector peers (SK Hynix, Samsung, Western
  Digital, Kioxia) fire an alert flagged as relevant to `MU`/`SNDK`.
- **Big-event mode:** market-moving phrases (`IPO, merger, acquisition, buyout,
  upgrade, downgrade, guidance, bankruptcy, trading halt, FDA approval, earnings
  beat/miss`, …) let news about *any* specific stock fire, so every sector is
  covered for major events — not just the curated names.
- **Noise guards:** market-roundup articles (many tickers in `related`) require a
  name match, not a bare symbol match. Deep per-company polling is limited to the
  core picks in `CORE_SYMBOLS`; everything else rides the general feed.

**Free-tier limit:** the general news feed returns only the ~100 latest articles,
so all-sector coverage catches big names when they surface there — it is not an
exhaustive scan of every listed stock.

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
