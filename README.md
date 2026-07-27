<p align="center">
  <img src="https://raw.githubusercontent.com/evidiq/evidiq/main/assets/evidiq.png" width="88" alt="EVIDIQ" />
</p>

<h1 align="center">EVIDIQ Notary MCP</h1>

<p align="center"><strong>Cryptographic receipts for AI outputs.</strong></p>

<p align="center">
  Sign &middot; Anchor &middot; Verify — every inference provably existed, exactly as recorded.
</p>

<p align="center">
  <a href="https://evidiq.dev">evidiq.dev</a> &middot;
  <a href="https://github.com/evidiq/evidiq">EVIDIQ Main</a> &middot;
  <a href="https://github.com/evidiq/evidiq-notary-mcp">Notary MCP</a>
</p>

<p align="center">
  <a href="https://mcp.evidiq.dev/notary/mcp"><img src="https://img.shields.io/badge/MCP%20Server-Live-6E56CF?style=flat-square" alt="MCP Server" /></a> <a href="https://0g.ai"><img src="https://img.shields.io/badge/0G-Storage-00C2A8?style=flat-square" alt="0G Storage" /></a> <a href="https://www.oklink.com/xlayer"><img src="https://img.shields.io/badge/X%20Layer-Settlement-3CCF4E?style=flat-square" alt="X Layer" /></a> <a href="https://mcp.evidiq.dev/notary/x402"><img src="https://img.shields.io/badge/x402-pay--per--call-2563EB?style=flat-square" alt="x402" /></a> <a href="https://www.okx.ai/agents/6278"><img src="https://img.shields.io/badge/OKX.AI-Agent%20%236278%20Listed-121212?style=flat-square&logo=okx&logoColor=white" alt="OKX.AI Agent 6278 listed" /></a> <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-3DA639?style=flat-square" alt="License: MIT" /></a>
</p>

---

AI agents generate outputs at scale, but nothing proves *what* a model said, *when*,
or *whether* it was altered afterward. **EVIDIQ Notary is the cryptographic receipt
layer for AI inferences** — delivered as a remote MCP server, billed per call over
x402. Submit a prompt + response + model id; receive a signed, timestamped, 0G-anchored
receipt that anyone can verify offline.

## What it does

Every notarization returns a **receipt** that proves four things at once:

- **Existence** — this exact prompt/response existed at this timestamp.
- **Integrity** — change one character and the hash changes; verification fails.
- **Provenance** — the model id, notary address, and optional trust report are bound into the signature.
- **Independence** — verify a receipt offline with the notary's EVM address; batch Merkle roots are anchored on 0G Storage.

## Use it from any agent

```bash
# Read the live pricing discovery
curl -s https://mcp.evidiq.dev/notary/x402

# Or connect the remote MCP server (Claude Code)
claude mcp add --transport http evidiq-notary https://mcp.evidiq.dev/notary/mcp
```

`verify_attestation`, `get_receipt`, `notary_stats`, and `notary_pubkey` are free.
`notarize_inference` and `notarize_batch` are **pay-per-call over
[x402](https://mcp.evidiq.dev/notary/x402)**: unauthenticated requests receive an
HTTP 402 challenge; sign it and retry.

## MCP Tools

| Tool | Cost | Description |
|------|------|-------------|
| `notarize_inference` | $0.001 USDT0 | Single AI output notarization — signed receipt + 0G anchor |
| `notarize_batch` | $0.005 USDT0 | Up to 20 inferences in one call (audit trails) |
| `verify_attestation` | Free | Verify receipt: EIP-191 signature + content hash + Merkle proof |
| `get_receipt` | Free | Fetch proof material for an attestation |
| `notary_stats` | Free | Live volume, top models, notary address |
| `notary_pubkey` | Free | Notary EVM address + algorithm (offline verify) |

## How it settles

EVIDIQ Notary owns signing, anchoring, and verification, and settles on open infrastructure:

- **0G Storage** — every receipt is anchored on 0G mainnet (Aristotle, chain 16661) via the `@0gfoundation/0g-ts-sdk`. Tamper-evident, durable, and fetchable by anyone.
- **x402 v2** — per-call settlement (EIP-3009 `exact` / `transferWithAuthorization`), gasless for the payer, settled on-chain by the notary's `X402_SETTLE_KEY`.
- **X Layer / USDT0** — the OKX A2MCP settlement token (`0x779ded…`, 6 decimals). Per-tool pricing: `$0.001 = 1000` atomic (single), `$0.005 = 5000` atomic (batch).
- **EIP-191** — receipts are signed with the notary's EVM key (`OG_PRIVATE_KEY`). The same signature any verifier can recover offline.

## Proven on-chain

Every notarization is verifiable end-to-end — the **payment** settles on X Layer and
the **receipt** is anchored on 0G Storage. Both from live calls, not mockups.

**1 · Payment — x402 settlement on X Layer**

| | |
|---|---|
| Amount | `0.001 USDT0` on X Layer (`eip155:196`) — per-tool pricing (batch: `0.005`) |
| Flow | HTTP 402 → EIP-3009 signature → `transferWithAuthorization` (gasless for the payer) |
| Tx | [`0x53f72073…0070f2`](https://www.oklink.com/xlayer/tx/0x53f72073820d7958d18c86c5f436ccb1e53af510c2079c329b08eb1abd0070f2) · SUCCESS |

**2 · Receipt — 0G Storage anchor**

| | |
|---|---|
| Signer | `0x8a3c7524…3ee7D` (EIP-191, the EVIDIQ attester key) |
| Anchor | receipt JSON uploaded to 0G Storage mainnet via `@0gfoundation/0g-ts-sdk` |
| Anchor tx | [`0xa43c8186…1a5e1`](https://chainscan.0g.ai/tx/0xa43c8186f8a53e9540a2ac8bf407037451209123b523253d7d3be379c281a5e1) · SUCCESS |

**3 · Verification — EIP-191 + Merkle proof**

| | |
|---|---|
| `verify_attestation` | recompute `keccak256(prompt ‖ response)` → recover EIP-191 signer → brute-force Merkle proof against `merkleRoot` |
| Live result | `valid: true, contentMatch: true, signatureValid: true, merkleValid: true` |

```bash
# Reproduce a paid notarization end-to-end (free tools need no payment)
curl -s https://mcp.evidiq.dev/notary/x402 | python3 -m json.tool
```

Payment on one chain, tamper-evident proof on 0G — the whole receipt is auditable end to end.

## Pricing

Per-tool pricing — `notarize_inference` and `notarize_batch` are paid (x402); receipts are anchor + signed; everything else is free.

| Operation | Cost | Token | Chain | Atomic |
|-----------|------|-------|-------|--------|
| `notarize_inference` (single) | $0.001 | USDT0 | X Layer (`eip155:196`) | 1000 |
| `notarize_batch` (≤20 items) | $0.005 | USDT0 | X Layer (`eip155:196`) | 5000 |
| `verify_attestation` | Free | — | — | — |
| `get_receipt` | Free | — | — | — |
| `notary_stats` | Free | — | — | — |
| `notary_pubkey` | Free | — | — | — |

**Payment**: x402 v2 protocol (EIP-3009 `transferWithAuthorization` on X Layer). No API keys, no accounts — the challenge quotes the right price per tool; sign it and retry.

Live discovery: `GET https://mcp.evidiq.dev/notary/x402` returns the full per-tool pricing table.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   AI Agent      │────▶│  EVIDIQ Notary   │────▶│  0G Storage │
│ (MCP Client)    │     │   MCP Server     │     │  (anchoring)│
└─────────────────┘     └──────────────────┘     └─────────────┘
                               │
                               ▼
                      ┌──────────────────┐     ┌──────────────┐
                      │  x402 v2 gate    │────▶│  X Layer     │
                      │  (EIP-3009)      │     │  USDT0 settle│
                      └──────────────────┘     └──────────────┘
                               │
                               ▼
                      ┌──────────────────┐
                      │  EIP-191 sign    │
                      │  + Merkle tree   │
                      └──────────────────┘
```

## Self-host

```bash
# Build & run (Docker)
docker build -t evidiq-notary .
docker run -d -p 3000:3000 --env-file .env evidiq-notary

# Or from source
npm install && npm run build
PORT=3000 node dist/start-server.js
```

Endpoint: `POST /mcp` · Discovery: `GET /x402` · Health: `GET /`

### Configuration

```bash
# Notary signing key (EVM, EIP-191) — reuses the EVIDIQ 0G attester key
NOTARY_PRIVATE_KEY=0x...
OG_PRIVATE_KEY=0x...

# x402 payment config (X Layer mainnet, USDT0)
X402_CHAIN=x-layer
X402_ASSET=0x779ded0c9e1022225f8e0630b35a9b54be713736
X402_PAY_TO=0x2a8efe3093278bb4bd3b2d9c7b5ba992ca4fc9b0
X402_PRICE=1000                   # $0.001 USDT0 per single notarization (6 decimals)
X402_BATCH_PRICE=5000             # $0.005 USDT0 per batch (≤20 items)
X402_DOMAIN_NAME=USD₮0
X402_DOMAIN_VERSION=1
X402_SETTLE_KEY=0x...             # Gas-funded X Layer wallet
X402_RPC=https://rpc.xlayer.tech

# 0G Storage (mainnet Aristotle, chain 16661)
OG_STORAGE_RPC=https://evmrpc.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
```

## Receipt structure

```json
{
  "attestationId": "0xfbd95c81…eeb1",
  "contentHash": "0xfbd95c81…eeb1",
  "promptHash": "0x…",
  "responseHash": "0x…",
  "signature": "0x2f012d7f… (EIP-191)",
  "notaryAddress": "0x8a3c7524Aaed081825aC88eC7f4cCECFc583ee7D",
  "timestamp": "2026-07-17T00:41:15.303Z",
  "modelId": "glm-5.2",
  "merkleRoot": "0xfbd95c81…eeb1",
  "merkleProof": ["0x…"],
  "storageRoot": "0xae8526f7…e894",
  "storageTx": "0xa43c8186…1a5e1"
}
```

## Verification (offline)

Anyone can verify a receipt **without contacting the notary**:

1. Fetch the notary address: `notary_pubkey` tool (`0x8a3c7524…3ee7D`).
2. Recompute `contentHash = keccak256(prompt ‖ response)`.
3. Recover the EIP-191 signer from `signature` over `attestationMessage(reportHash, merkleRoot)` — must equal `notaryAddress`.
4. Verify the Merkle proof against `merkleRoot` (anchored on 0G).

## Development

```bash
npm install      # install deps
npm run build    # tsc → dist/
npm run dev      # tsx watch server.ts
npm test         # vitest
```

## Links

- **Live endpoint** — https://mcp.evidiq.dev/notary/mcp
- **Pricing discovery** — https://mcp.evidiq.dev/notary/x402
- **EVIDIQ main** — https://github.com/evidiq/evidiq
- **EVIDIQ skill** — https://github.com/evidiq/evidiq-skill
- **0G Labs** — https://0g.ai
- **x402 Protocol** — https://x402.org
- **OKX.AI** — https://okx.ai

## License

MIT © 2026 EVIDIQ — see [LICENSE](./LICENSE). Part of the
[EVIDIQ](https://github.com/evidiq/evidiq) trust layer for the AI agent economy.
