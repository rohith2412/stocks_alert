// Polls SEC EDGAR's "current filings" feed for IPO / going-public events
// (S-1, S-1/A, F-1, F-1/A, 424B4, DRS), dedupes against seen_filings.json,
// and pushes new filings to Telegram.

import Parser from 'rss-parser';
import { sendTelegram, loadSeen, saveSeen, escapeHtml, sleep } from './lib.ts';

const SEEN_PATH = 'seen_filings.json';

const FORM_TYPES = ['S-1', 'S-1/A', 'F-1', 'F-1/A', '424B4', 'DRS'];

// SEC requires a descriptive User-Agent with contact info on every request.
const USER_AGENT =
  process.env.SEC_USER_AGENT || 'trading-bot alerts (rohithdevswe@gmail.com)';

// EDGAR "current filings" Atom feed — most recent filings across all form types.
const FEED_URL =
  'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=&company=&dateb=&owner=include&count=100&output=atom';

const parser = new Parser({
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/atom+xml' },
});

/** EDGAR entry titles look like: "424B4 - COMPANY NAME (0001234567) (Filer)". */
function formType(item: Parser.Item): string {
  return (item.title ?? '').split(' - ')[0].trim();
}

function companyName(item: Parser.Item): string {
  return (item.title ?? '').split(' - ').slice(1).join(' - ').trim();
}

function formatAlert(item: Parser.Item): string {
  const when = item.isoDate ?? item.pubDate ?? '';
  return [
    `🚨 <b>SEC EDGAR</b> — new <b>${escapeHtml(formType(item))}</b> filing`,
    escapeHtml(companyName(item)),
    when ? `🕒 ${escapeHtml(when)}` : '',
    item.link ? `🔗 ${escapeHtml(item.link)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function main(): Promise<void> {
  const seen = await loadSeen(SEEN_PATH);
  const feed = await parser.parseURL(FEED_URL);

  const matches = feed.items.filter((item) => FORM_TYPES.includes(formType(item)));

  let sent = 0;
  for (const item of matches) {
    const key = item.link ?? item.guid ?? item.title;
    if (!key || seen.has(key)) continue;

    seen.add(key);
    await sendTelegram(formatAlert(item));
    sent++;
    await sleep(1200); // stay under Telegram's ~1 msg/sec sustained limit
  }

  await saveSeen(SEEN_PATH, seen);
  console.log(`EDGAR: ${matches.length} matching filings in feed, ${sent} new alert(s) sent.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
