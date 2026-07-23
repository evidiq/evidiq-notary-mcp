---
name: EVIDIQ Notary
version: 1.0.0
description: Cryptographic receipts for AI outputs — signed EIP-191 attestations, Merkle proofs, and 0G Storage anchors via x402 USDT0 on X Layer.
category: Provenance
provider: EVIDIQ
provider_url: https://evidiq.dev
license: MIT
---

# EVIDIQ Notary MCP

![EVIDIQ Notary — cryptographic receipts visual](https://evidiq.dev/docs/notary-hero.png)

**Notarize any AI output. Prove it existed, unchanged.**

[Read the full EVIDIQ Notary documentation](https://evidiq.dev/docs/notary) for quickstart, tool reference, receipt anatomy, offline verification, and pricing.

EVIDIQ Notary turns any AI inference into a signed, timestamped, 0G-anchored receipt. Submit a prompt + response + model id and receive an EIP-191 signature plus a Merkle-proofed attestation that anyone can verify offline — proving existence, integrity, and model provenance before the output is trusted or paid for.

## Supported Inputs

- **Single inference** (`prompt`, `response`, `modelId`, + optional `agentId` / `trustReportHash` / `context`)
- **Batch of inferences** (up to 20 items in one call for audit trails)
- **Attestation IDs** (for free verification and receipt lookup)

## Paid Tools

| Tool | Cost | Purpose |
|------|------|---------|
| `notarize_inference` | 0.001 USDT0 (`1000` atomic) | Notarize a single AI inference; returns a signed, 0G-anchored receipt |
| `notarize_batch` | 0.005 USDT0 (`5000` atomic) | Notarize up to 20 inferences in one call under a batch Merkle root |

## Free Tools

| Tool | Purpose |
|------|---------|
| `verify_attestation` | Verify a receipt: content hash, EIP-191 signature, and Merkle proof |
| `get_receipt` | Fetch the public proof material for an attestation |
| `notary_stats` | Live volume, top models, and anchored batches |
| `notary_pubkey` | The notary's EVM address + algorithm for offline verification |

## What a receipt proves

- **Existence** — this exact prompt/response existed at this timestamp.
- **Integrity** — change one character and the hash changes; verification fails.
- **Provenance** — the model id, notary address, and optional trust-report hash are bound into the signature.
- **Independence** — verify offline with the notary address; Merkle roots anchor batches on 0G Storage.

## Receipt contract

Every paid `notarize_inference` call returns:

- `attestationId` / `contentHash` / `promptHash` / `responseHash`
- `signature` (EIP-191) + `notaryAddress`
- `merkleRoot` / `merkleProof`
- `storageRoot` / `storageTx` (0G Storage anchor, best-effort)
- `storageNote` (present only when the anchor could not be written)
- `timestamp` / `modelId`

The 0G Storage anchor is best-effort: a missing anchor does not invalidate an otherwise valid EIP-191 signature.

## Offline verification

Anyone can verify a receipt without contacting the notary:

1. Fetch the notary address via `notary_pubkey`.
2. Recompute `contentHash = keccak256(prompt ‖ response)`.
3. Recover the EIP-191 signer from `signature` — it must equal `notaryAddress`.
4. Verify the Merkle proof against `merkleRoot`.

## Pricing

- `notarize_inference`: `1000` atomic (`X402_PRICE=1000`) = **0.001 USDT0**.
- `notarize_batch`: `5000` atomic (`X402_BATCH_PRICE=5000`) = **0.005 USDT0** (up to 20 items).
- Token: `USDT0` (`0x779ded0c9e1022225f8e0630b35a9b54be713736`, 6 decimals) on X Layer (`eip155:196`, chain `196`).
- EIP-712 token domain: `{ name: "USD₮0", version: "1" }`.
- Free tools (`verify_attestation`, `get_receipt`, `notary_stats`, `notary_pubkey`) are always `HTTP 200` and never gated.

## Usage Example

```bash
# Free: capabilities and pricing discovery (returns the full 6-tool pricing table)
curl https://mcp.evidiq.dev/notary/x402 | python3 -m json.tool

# Paid: notarize a single inference (requires PAYMENT-SIGNATURE header with x402 v2 envelope)
curl -X POST https://mcp.evidiq.dev/notary/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"notarize_inference","arguments":{"prompt":"hi","response":"hello","modelId":"glm-5.2"}}}'

# Expected: 402 challenge with amount: "1000", x402Version: 2, scheme: "exact"
```

## Paying from your agent (x402 v2)

1. An unpaid call to a paid tool returns **HTTP 402** with `accepts[]` payment requirements.
2. Sign an EIP-3009 `transferWithAuthorization` (gasless for the payer) over the requested USDT0 amount.
3. Retry with a base64 `PAYMENT-SIGNATURE` header carrying `{ x402Version: 2, accepted, payload: { signature, authorization } }`.
4. Notary verifies + settles, then returns the receipt with a `payment-response` header (settlement tx).

## Endpoints (public)

- Documentation: `https://evidiq.dev/docs/notary`
- Health: `GET https://mcp.evidiq.dev/notary/health`
- Skill (this document): `GET https://mcp.evidiq.dev/notary/skill.md`
- MCP: `POST https://mcp.evidiq.dev/notary/mcp`
- x402 discovery: `GET https://mcp.evidiq.dev/notary/x402`

## References

- EVIDIQ family repos: `github.com/evidiq/evidiq`, `github.com/evidiq/evidiq-operator`, `github.com/evidiq/evidiq-sentinel-mcp`
- Open Skill format: `SKILL.md`

## Version

`v1.0.0` — MIT © 2026 EVIDIQ — OKX.AI Agent #6278.
