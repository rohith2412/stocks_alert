// Shared helpers for the watchers: Telegram delivery, dedupe-state persistence,
// and small text utilities. Both edgar_watcher.ts and finnhub_watcher.ts follow
// the same shape: fetch -> dedupe -> format alert -> send -> save state.

import { readFile, writeFile } from 'node:fs/promises';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

/** Send a message to the configured Telegram chat (HTML formatting). */
export async function sendTelegram(text: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID env vars.');
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram send failed: ${res.status} ${res.statusText} — ${body}`);
  }
}

/** Load the set of already-seen ids from a JSON array file (empty if missing). */
export async function loadSeen(path: string): Promise<Set<string>> {
  try {
    const raw = await readFile(path, 'utf8');
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return new Set();
    throw err;
  }
}

/**
 * Persist seen ids back to disk. Keeps only the most recent `max` entries
 * (insertion order) so the state file can't grow without bound.
 */
export async function saveSeen(path: string, seen: Set<string>, max = 2000): Promise<void> {
  const arr = [...seen].slice(-max);
  await writeFile(path, JSON.stringify(arr, null, 2) + '\n');
}

/** Escape a string for Telegram HTML parse mode. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Truncate long text with an ellipsis. */
export function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

/** Sleep for `ms` milliseconds (used to stay under Telegram/API rate limits). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
