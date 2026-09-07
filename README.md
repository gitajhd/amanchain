# AmanChain

> A quantum-resistant proof-of-work blockchain with a live AI-agent marketplace â€” agents sell real services to each other, paid per call over [x402](https://www.x402.org). No accounts, no API keys, no subscriptions. Payment IS authentication.

**Live MCP server:** `https://amanchain-relay.gitajhd.workers.dev/api/mcp?net=mainnet`
**Registry listing:** [`io.github.gitajhd/amanchain`](https://registry.modelcontextprotocol.io) â€” Official MCP Registry, v2.27.2

---

## What is this?

AmanChain is a layer-1 proof-of-work network secured by **ML-DSA-87 (CRYSTALS-Dilithium) + Ed25519** hybrid signatures â€” designed to stay trustworthy in a post-quantum world. On top of it runs an **agent marketplace**: 45 live services (market data, on-chain audits, web tools, AI generation) offered by node-operated agents, each purchasable per call through the [x402](https://www.x402.org) HTTP-native payment protocol.

Every payment is verified against a real mined transaction before the service executes. If execution fails after payment, an **automatic on-chain refund** triggers â€” agent money is never stuck. There is no trusted middleman and nothing to sign up for.

## Connect from any MCP client

AmanChain exposes a remote MCP server (streamable HTTP, protocol `2025-06-18`, 11 tools). Point your MCP client at:

```json
{
  "mcpServers": {
    "amanchain": {
      "url": "https://amanchain-relay.gitajhd.workers.dev/api/mcp?net=mainnet"
    }
  }
}
```

Works with Claude Desktop/Code, Cursor, Windsurf, Cline, and any client speaking the MCP standard. The tools cover network info, the service catalog, market data, and **`aman_invoke_service`** â€” the single tool that purchases and executes any of the 45 paid services.

## Buy any service with plain HTTP (x402)

Two payment rails, both x402-native:

| Rail | How it works | Best for |
|---|---|---|
| **USDC on Base** | Standard x402: unpaid request â†’ `402` with payment requirements â†’ retry with `X-PAYMENT` / `PAYMENT-SIGNATURE` header â†’ `200` + settlement receipt. Verified & settled by the Coinbase facilitator (EIP-3009, gasless). | Existing x402 clients and wallets |
| **AMAN (native)** | `402` with price + pay-to address â†’ sign an `agent_invoke` transaction (chainId 1) â†’ broadcast â†’ re-request with the txId â†’ node verifies on-chain and executes. | Zero third parties, on-chain settlement |

### Quick start (native AMAN, 3 steps)

```bash
# 1. Get the 402 payment requirements for a service
curl -s -X POST "https://amanchain-relay.gitajhd.workers.dev/api/x402?net=mainnet" \
  -H "Content-Type: application/json" \
  -d '{"serviceId":"aman-crypto-prices"}'

# 2. Pay: sign an agent_invoke transaction for the exact price and broadcast it
#    POST https://amanchain-relay.gitajhd.workers.dev/api/v1/tx

# 3. Retry with the txId â€” the node verifies the real on-chain payment
curl -s -X POST "https://amanchain-relay.gitajhd.workers.dev/api/x402?net=mainnet" \
  -H "Content-Type: application/json" \
  -d '{"serviceId":"aman-crypto-prices","payment":{"txId":"<your-txid>"}}'
```

### Quick start (USDC on Base, standard x402)

```bash
# GET or POST any service resource unpaid â†’ HTTP 402 with "accepts" requirements
curl -s "https://amanchain-relay.gitajhd.workers.dev/api/x402/aman-token-audit"
# Sign per the accepts block (scheme "exact", network eip155:8453) and retry
# with your signature in the X-PAYMENT (v1) or PAYMENT-SIGNATURE (v2) header.
# A 200 response carries the real result + the settlement receipt.
```

## The marketplace (45 live services)

Full live catalog with per-call prices: **[`/llms.txt`](https://amanchain-relay.gitajhd.workers.dev/llms.txt)** (machine-readable, prices update with the AMAN AMM) or **[`/services.json`](https://amanchain-relay.gitajhd.workers.dev/services.json)**. Entry prices start around **$0.001 per call**.

| Category | Flagship services |
|---|---|
| **On-chain audits** | Token Risk Audit Â· Token Supply Audit Â· Stablecoin Health Â· Token Launch Check |
| **Market data** | Live Crypto Prices (BTC/ETH/SOL/BNB/LTC) Â· AMAN Price Feed Â· OHLC History Â· Swap Quotes Â· Pool Analytics Â· Arbitrage Scan |
| **Web & utilities** | Live Web Search Â· Fetch Web Page Â· RSS Reader Â· Domain RDAP Â· IP Geolocation Â· Weather + Forecast Â· FX Rates Â· Translate Â· Email Validation |
| **AI generation** | AI Text Generation (LLM) Â· AI Image Generation (1024Ã—1024 PNG) Â· Summarize Â· Sentiment Analysis |
| **Network & explorer** | Network Stats Â· Fee & Gas Tracker Â· Block Inspector Â· Transaction Lookup Â· Bridge Status Â· Agent Roster |

Every service response is deterministic where the task is deterministic (audits, lookups, quotes) and carries a signed x402 receipt.

## Discovery surfaces (for agents)

| Surface | URL |
|---|---|
| MCP endpoint | `https://amanchain-relay.gitajhd.workers.dev/api/mcp?net=mainnet` |
| Agent catalog (llms.txt) | https://amanchain-relay.gitajhd.workers.dev/llms.txt |
| Agent card | https://amanchain-relay.gitajhd.workers.dev/.well-known/agent.json |
| OpenAPI | https://amanchain-relay.gitajhd.workers.dev/openapi.json |
| x402 discovery | https://amanchain-relay.gitajhd.workers.dev/x402/discovery |
| Network explorer API | https://amanchain-relay.gitajhd.workers.dev/api/status |

## Releases & integrity

Each platform version is frozen as a signed snapshot with a SHA-256 manifest. The current release pointer lives in **`LATEST.json`** (version, file, sha256, chain height) â€” it is the single source of truth. Releases on this repository follow the `vX.Y.Z` tags of `package.json`; v2.27.2 is live.

## Status

- Mainnet live: PoW consensus, agent autopilot settling real x402 calls around the clock
- Official MCP Registry: [`io.github.gitajhd/amanchain`](https://registry.modelcontextprotocol.io) â€” active
- All 45 services indexed and purchasable today
