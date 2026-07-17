# EVIDIQ Notary MCP

> **Cryptographic receipts for AI outputs** — signed attestations, Merkle proofs, and 0G chain-anchors via x402 USDT0 micropayments on X Layer.

Built by [EVIDIQ](https://evidiq.dev) — the trust layer for the AI agent economy.

---

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 22
- 0G Storage/Compute access (OG_PRIVATE_KEY)
- X Layer wallet with USDT0 for x402 payments (X402_SETTLE_KEY)
- NOTARY_PRIVATE_KEY (Ed25519 signing key)

### Install

```bash
npm install -g @evidiq/notary-mcp
# or
npx @evidiq/notary-mcp
```

### Configuration

Create `.env` with:

```bash
# Notary signing key (Ed25519)
NOTARY_PRIVATE_KEY=0x...

# x402 payment config (X Layer mainnet)
X402_CHAIN=x-layer
X402_ASSET=0x779ded0c9e1022225f8e0630b35a9b54be713736
X402_PAY_TO=0x2a8efe3093278bb4bd3b2d9c7b5ba992ca4fc9b0
X402_PRICE=1000                    # $0.001 USDT0 per notarization
X402_BATCH_PRICE=50000             # $0.05 per batch (20 items)
X402_SETTLE_KEY=0x...              # Gas-funded X Layer wallet
X402_FACILITATOR_URL=https://web3.okx.com
X402_RPC=https://rpc.xlayer.tech

# 0G Storage/Compute
OG_PRIVATE_KEY=0x...
OG_STORAGE_RPC=https://rpc.0g.ai
OG_STORAGE_INDEXER=https://indexer.0g.ai
OG_COMPUTE_ROUTER=https://router-api.0g.ai/v1

# Notary signing key (Ed25519)
NOTARY_PRIVATE_KEY=0x...
```

### Run

```bash
# Stdio (for Claude Desktop, Cursor, etc.)
evidiq-notary

# HTTP server (port 3000)
evidiq-notary --http
```

---

## 🔧 MCP Tools

| Tool | Cost | Description |
|------|------|-------------|
| `notarize_inference` | $0.001 USDT0 | Single AI output notarization |
| `notarize_batch` | $0.005 USDT0 | Up to 20 inferences (audit trails) |
| `verify_attestation` | Free | Verify receipt signature & hash |
| `get_receipt` | Free | Fetch proof from 0G Storage |
| `notary_stats` | Free | Live volume, top models |
| `notary_pubkey` | Free | Ed25519 public key (offline verify) |

---

## 📝 Usage Examples

### Notarize Single Inference

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "notarize_inference",
    "arguments": {
      "prompt": "What is the capital of France?",
      "response": "The capital of France is Paris.",
      "modelId": "gpt-4",
      "agentId": "0x1234...",
      "context": "User query via chat"
    }
  }
}
```

**Response:**
```json
{
  "attestationId": "0xabc123...",
  "contentHash": "0xdef456...",
  "promptHash": "0x789abc...",
  "responseHash": "0xabc789...",
  "signature": "0x...",
  "notaryAddress": "0x...",
  "timestamp": "2026-07-17T05:30:00.000Z",
  "modelId": "gpt-4",
  "merkleRoot": "0x...",
  "merkleProof": ["0x...", "0x..."],
  "storageRoot": "0x...",
  "storageTx": "0x...",
  "payment": {
    "asset": "USDT0",
    "amount": "0.001",
    "chainId": 196,
    "chainName": "X Layer"
  }
}
```

### Verify Attestation (Free)

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "verify_attestation",
    "arguments": {
      "attestationId": "0xabc123...",
      "prompt": "What is the capital of France?",
      "response": "The capital of France is Paris.",
      "modelId": "gpt-4"
    }
  }
}
```

---

## 🔐 What a Receipt Proves

Every notarization returns a **cryptographic receipt** proving:

1. **Existence** — This exact prompt/response existed at this timestamp
2. **Integrity** — Change one character → hash changes → verification fails  
3. **Independence** — Verify offline with Ed25519 public key; Merkle roots anchor batches on-chain
4. **Provenance** — Model ID, timestamp, and optional trust report linked

---

## 🏗 Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   AI Agent      │────▶│  EVIDIQ Notary   │────▶│  0G Storage │
│ (MCP Client)    │     │   MCP Server     │     │  (anchoring)│
└─────────────────┘     └──────────────────┘     └─────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  0G Compute      │
                       │  (GLM-5.2 TEE)   │
                       └──────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │  X Layer         │
                       │  (USDT0 x402)    │
                       └──────────────────┘
```

---

## 💰 Pricing

| Operation | Cost | Token | Chain |
|-----------|------|-------|-------|
| Single notarization | $0.001 | USDT0 | X Layer (196) |
| Batch (≤20) | $0.005 | USDT0 | X Layer (196) |
| Verify / Stats / Pubkey | Free | — | — |

**Payment**: x402 protocol (EIP-3009 on X Layer). No API keys, no accounts — just USDC micropayments.

---

## 🔧 MCP Client Config

### Claude Desktop / Cursor / Cline

```json
{
  "mcpServers": {
    "evidiq-notary": {
      "command": "npx",
      "args": ["-y", "@evidiq/notary-mcp"],
      "env": {
        "NOTARY_PRIVATE_KEY": "0x...",
        "X402_SETTLE_KEY": "0x...",
        "OG_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### HTTP Server (for remote agents)

```bash
# Start HTTP server on port 3000
PORT=3000 npx @evidiq/notary-mcp --http
```

Then call: `POST http://localhost:3000/mcp`

---

## 🔍 Verification (Offline)

Anyone can verify a receipt **without contacting the notary**:

1. Fetch notary public key: `notary_pubkey` tool
2. Recompute `contentHash = keccak256(prompt + response)`
3. Verify Ed25519 signature against `notaryAddress`
4. Verify Merkle proof against `merkleRoot` (anchored on 0G)

---

## 📄 Receipt Structure

```json
{
  "attestationId": "0xabc123...",
  "contentHash": "0x...",
  "promptHash": "0x...",
  "responseHash": "0x...",
  "signature": "0x...",
  "notaryAddress": "0x...",
  "timestamp": "2026-07-17T05:30:00.000Z",
  "modelId": "gpt-4",
  "merkleRoot": "0x...",
  "merkleProof": ["0x...", "0x..."],
  "storageRoot": "0x...",
  "storageTx": "0x...",
  "payment": {
    "asset": "USDT0",
    "amount": "0.001",
    "chainId": 196,
    "chainName": "X Layer"
  }
}
```

---

## 🛠 Development

```bash
# Install deps
npm install

# Build
npm run build

# Dev mode (watch)
npm run dev

# Test
npm test
```

---

## 🔗 Links

- **EVIDIQ Main**: https://evidiq.dev
- **OKX Marketplace**: https://okx.ai
- **0G Labs**: https://0g.ai
- **x402 Protocol**: https://x402.org

---

## 📄 License

MIT © 2026 EVIDIQ