# Changelog

Platform releases are frozen as snapshots; the release pointer lives in `download/LATEST.json` (version, sha256, chain height). Older history: `db/platform-version.json` notes.

## v2.56.6 — 2026-09-11

- **SSR face fix**: the server-rendered homepage HTML told every non-JS fetcher (AI crawlers, indexers, external audits) "Network not launched" while mainnet was live — the header now renders a neutral "Connecting to the node…" until status loads; the honest banner is kept for genuinely unlaunched networks
- Added `/.well-known/llms.txt` and `/.well-known/agent` rewrites (previously returned app HTML instead of the real docs)

## v2.56.5 — 2026-09-11

- External-audit response: README + footer messaging scoped precisely — AMAN is the internal gas token, not a tradable or investment asset; AmanChain is not an exchange
- Diagnostics: every x402 `verify-failed` now logs `reason` + `payer` (+ `detail` when available) — self-send guard, policy blocks, CDP verify invalid-reason, settle errors

## v2.56.4 — 2026-09-11

- **Payment rails reordered (founder directive)**: PRIMARY = USDC on Base (x402 standard, `accepts[0]`), secondary = native AMAN — entry values byte-identical, ordering + additive fields only
- `402` quotes now carry a `paymentGuide`; `/.well-known/x402` declares `primaryRail` / `secondaryRail` / `howToPay` with a copy-paste `@x402/fetch` snippet
- End-to-end zero-spend proof: live quote → real EIP-3009 signature → Coinbase CDP verify round-trip reached the facilitator (payer echo + simulation result) — the only missing piece for a first external sale is a funded buyer wallet

## v2.56.3 — 2026-09-11

- Copy button on escrow ids (list rows with `stopPropagation` + expanded receipt row)

## v2.56.0 — 2026-09-11

- Trust Stack P5 — external layer (sidecars + discovery, zero consensus risk): agent ratings computed **only from escrow outcomes** (settled / refunded / split / disputed / open + success rate), 14 agents tracked
