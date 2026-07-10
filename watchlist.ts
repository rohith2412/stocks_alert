// Watchlist + matching config for finnhub_watcher.ts.
// Scope: US + Canadian listings, all sectors, weighted toward Tech + Semis.
// Many big Canadian names (Shopify, RBC, Enbridge, CNQ, Brookfield…) are matched
// via their US-listed (NYSE) tickers, which is what Finnhub tends to tag.

// Curated names that ALWAYS alert when mentioned. Key = ticker, value = name
// aliases matched (word-boundary) in headline/summary. Symbol matches come from
// Finnhub's structured `related` field, so short tickers don't false-match words.
export const WATCHLIST: Record<string, string[]> = {
  // ── Semiconductors (deep) ────────────────────────────────────────────────
  NVDA: ['nvidia'],
  AMD: ['advanced micro devices'],
  MU: ['micron'],
  SNDK: ['sandisk'],
  INTC: ['intel'],
  AVGO: ['broadcom'],
  TSM: ['taiwan semiconductor', 'tsmc'],
  QCOM: ['qualcomm'],
  ASML: ['asml'],
  AMAT: ['applied materials'],
  LRCX: ['lam research'],
  MRVL: ['marvell'],
  ARM: ['arm holdings'],
  SMCI: ['super micro', 'supermicro'],
  SOXL: [], // leveraged semi ETF — symbol/related only

  // ── Big Tech / software (deep) ───────────────────────────────────────────
  AAPL: ['apple'],
  MSFT: ['microsoft'],
  GOOGL: ['alphabet', 'google'],
  AMZN: ['amazon'],
  META: ['meta platforms', 'facebook'],
  TSLA: ['tesla'],
  NFLX: ['netflix'],
  ORCL: ['oracle'],
  CRM: ['salesforce'],
  ADBE: ['adobe'],
  PLTR: ['palantir'],
  DELL: ['dell'],
  UBER: ['uber'],

  // ── Energy + Materials (Canada-strong) ───────────────────────────────────
  XOM: ['exxon'],
  CVX: ['chevron'],
  OXY: ['occidental'],
  CNQ: ['canadian natural'],
  SU: ['suncor'],
  CVE: ['cenovus'],
  ENB: ['enbridge'],
  TRP: ['tc energy', 'transcanada'],
  NTR: ['nutrien'],
  CCJ: ['cameco'],
  URA: ['uranium'], // uranium ETF / theme
  FCX: ['freeport'],
  NEM: ['newmont'],

  // ── Financials (incl. Canadian banks) ────────────────────────────────────
  JPM: ['jpmorgan', 'jp morgan'],
  BAC: ['bank of america'],
  GS: ['goldman sachs'],
  MS: ['morgan stanley'],
  V: ['visa inc'],
  MA: ['mastercard'],
  RY: ['royal bank of canada'],
  TD: ['toronto-dominion', 'td bank'],
  BNS: ['scotiabank', 'bank of nova scotia'],
  BMO: ['bank of montreal'],
  BN: ['brookfield'],

  // ── Healthcare ───────────────────────────────────────────────────────────
  LLY: ['eli lilly'],
  UNH: ['unitedhealth'],
  JNJ: ['johnson & johnson'],
  PFE: ['pfizer'],
  MRK: ['merck'],
  ABBV: ['abbvie'],
  MRNA: ['moderna'],

  // ── Consumer / Industrials / other majors ────────────────────────────────
  SHOP: ['shopify'],
  COST: ['costco'],
  WMT: ['walmart'],
  HD: ['home depot'],
  MCD: ["mcdonald's", 'mcdonalds'],
  NKE: ['nike'],
  DIS: ['disney'],
  BA: ['boeing'],
  CAT: ['caterpillar'],
  GE: ['general electric'],
  CP: ['canadian pacific'],
  CNI: ['canadian national railway'],
};

// Symbols we ALSO pull per-company news for (depth on the ones you care most
// about). Kept to your explicit picks — the general feed covers the rest of the
// watchlist accurately, and per-company pulls on huge names add roundup noise.
export const CORE_SYMBOLS = ['SNDK', 'MU', 'SOXL', 'URA', 'TSLA'];

// Sector/peer map: when a peer entity shows up, flag the mapped watchlist tickers
// even if those tickers aren't in the text.
export const PEER_MAP: Record<string, string[]> = {
  'sk hynix': ['MU', 'SNDK'],
  hynix: ['MU', 'SNDK'],
  'samsung electronics': ['MU', 'SNDK'],
  kioxia: ['MU', 'SNDK'],
  'western digital': ['MU', 'SNDK'],
};

// Big market-moving phrases. These let news about ANY specific stock fire, even
// if it's not on the curated list — so every sector is covered for major events.
export const BIG_EVENTS = [
  'ipo',
  'going public',
  'merger',
  'to acquire',
  'acquisition',
  'buyout',
  'takeover',
  'upgrade',
  'downgrade',
  'guidance',
  'profit warning',
  'bankruptcy',
  'chapter 11',
  'trading halt',
  'halted',
  'sec investigation',
  'sec probe',
  'fda approval',
  'recall',
  'earnings beat',
  'earnings miss',
];
