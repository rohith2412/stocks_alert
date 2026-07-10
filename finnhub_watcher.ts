// Polls Finnhub's news endpoints (free tier), dedupes against seen_news.json,
// and pushes watchlist-relevant articles to Telegram. Same shape as
// edgar_watcher.ts: fetch -> dedupe -> match -> format -> send -> save state.

import { sendTelegram, loadSeen, saveSeen, escapeHtml, truncate, sleep } from './lib.ts';
import { WATCHLIST, CORE_SYMBOLS, PEER_MAP, BIG_EVENTS } from './watchlist.ts';

const SEEN_PATH = 'seen_news.json';
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

const WATCHLIST_TICKERS = Object.keys(WATCHLIST);

/** True if `needle` appears in `text` as a whole word/phrase. */
function wordMatch(text: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
}

// Only alert on articles published within this window. Older matches are recorded
// as seen (silently) so the first run doesn't flood the channel with days of
// backlog — it just seeds state and then alerts on genuinely fresh news going
// forward. With a 5-min cron, 60 min gives comfortable overlap.
const MAX_AGE_MINUTES = Number(process.env.MAX_AGE_MINUTES ?? 60);

interface Article {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number; // unix seconds
  related: string; // comma-separated tickers, often empty on general news
  category: string;
}

interface Match {
  tickers: Set<string>;
  reasons: string[];
  triggers: string[];
}

async function fetchJson(url: string): Promise<Article[]> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Finnhub fetch failed: ${res.status} ${res.statusText} — ${body}`);
  }
  const data = (await res.json()) as Article[];
  return Array.isArray(data) ? data : [];
}

function fetchGeneralNews(): Promise<Article[]> {
  return fetchJson(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API_KEY}`);
}

function fetchCompanyNews(symbol: string): Promise<Article[]> {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const to = new Date();
  const from = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // last 3 days
  return fetchJson(
    `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fmt(from)}&to=${fmt(to)}&token=${FINNHUB_API_KEY}`,
  );
}

function evaluate(article: Article): Match | null {
  const text = `${article.headline} ${article.summary}`.toLowerCase();
  const relatedTickers = (article.related ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  const tickers = new Set<string>();
  const reasons: string[] = [];

  // Market-roundup articles list many tickers in `related` (e.g. "top movers
  // today"). For those, a bare symbol match is weak/misleading, so require a
  // name match instead. `isRoundup` gates symbol-only matches.
  const isRoundup = relatedTickers.length > 8;

  // Curated watchlist matches: by company-name alias (word-boundary in text) or
  // by symbol (from Finnhub's structured `related` field, unless it's a roundup).
  for (const t of WATCHLIST_TICKERS) {
    const byName = WATCHLIST[t].some((name) => wordMatch(text, name));
    const bySymbol = relatedTickers.includes(t) && !isRoundup;
    if (byName || bySymbol) {
      tickers.add(t);
      reasons.push(`direct:${t}`);
    }
  }

  // Sector/peer matches — indirect relevance.
  for (const [peer, mapped] of Object.entries(PEER_MAP)) {
    if (wordMatch(text, peer)) {
      for (const t of mapped) tickers.add(t);
      reasons.push(`peer:${peer}→${mapped.join('/')}`);
    }
  }

  const triggers = BIG_EVENTS.filter((p) => wordMatch(text, p));

  if (tickers.size > 0) return { tickers, reasons, triggers };

  // Big-event mode: news about ONE specific stock (a focused, non-roundup article
  // with a related ticker) that mentions a major market-moving phrase — covers
  // every sector for big events, not just the curated names.
  if (triggers.length > 0 && relatedTickers.length > 0 && !isRoundup) {
    return {
      tickers: new Set(relatedTickers.slice(0, 6)),
      reasons: [`event:${triggers.join('/')}`],
      triggers,
    };
  }

  return null;
}

function formatAlert(article: Article, match: Match): string {
  const when = new Date(article.datetime * 1000).toISOString();
  return [
    `📰 <b>Finnhub</b> — relevant to <b>${escapeHtml([...match.tickers].join(', '))}</b>`,
    `<b>${escapeHtml(article.headline)}</b>`,
    article.summary ? escapeHtml(truncate(article.summary, 300)) : '',
    match.triggers.length ? `🏷️ ${escapeHtml(match.triggers.join(', '))}` : '',
    `🧭 ${escapeHtml(match.reasons.join(' | '))}`,
    `📡 ${escapeHtml(article.source)} · 🕒 ${escapeHtml(when)}`,
    article.url ? `🔗 ${escapeHtml(article.url)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function main(): Promise<void> {
  if (!FINNHUB_API_KEY) throw new Error('Missing FINNHUB_API_KEY env var.');

  const seen = await loadSeen(SEEN_PATH);

  // Merge general news + per-ticker company news, deduped by article id.
  const articles = new Map<string, Article>();
  for (const a of await fetchGeneralNews()) articles.set(String(a.id), a);
  for (const sym of CORE_SYMBOLS) {
    for (const a of await fetchCompanyNews(sym)) articles.set(String(a.id), a);
    await sleep(300); // gentle on the free-tier rate limit (60 req/min)
  }

  // DRY_RUN prints alerts to stdout instead of sending, and doesn't touch state —
  // useful for testing matching without Telegram creds or spamming the channel.
  const dryRun = Boolean(process.env.DRY_RUN);
  const cutoff = Date.now() - MAX_AGE_MINUTES * 60 * 1000;

  let sent = 0;
  let seeded = 0;
  for (const [id, article] of articles) {
    if (seen.has(id)) continue;
    const match = evaluate(article);
    if (!match) continue; // non-matches aren't stored; they age out of the feed

    // Too old to alert on — record as seen so we never reconsider it, but stay quiet.
    if (article.datetime * 1000 < cutoff) {
      if (!dryRun) seen.add(id);
      seeded++;
      continue;
    }

    if (dryRun) {
      console.log('\n' + formatAlert(article, match).replace(/<\/?b>/g, ''));
      sent++;
      continue;
    }

    seen.add(id);
    await sendTelegram(formatAlert(article, match));
    sent++;
    await sleep(1200); // stay under Telegram's ~1 msg/sec sustained limit
  }

  if (!dryRun) await saveSeen(SEEN_PATH, seen);
  console.log(
    `\nFinnhub: ${articles.size} scanned, ${seeded} old match(es) seeded, ` +
      `${sent} ${dryRun ? 'would alert' : 'new alert(s) sent'} (< ${MAX_AGE_MINUTES}m old).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
