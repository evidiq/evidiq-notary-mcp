import type { NotaryConfig } from "./config.js";
import type {
  PaymentRequirements,
  PaymentResponseHeader,
  X402Resource,
} from "./types.js";

/**
 * x402 v2 challenge construction — ported from Evidiq main (lib/x402/challenge.ts).
 * Base64 of the challenge object goes in the PAYMENT-REQUIRED response header
 * (what OKX marketplace validates), mirrored in the 402 body. x402 v2 only.
 */

function b64(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

const RESOURCE_DESCRIPTION =
  "EVIDIQ Notary — x402-gated cryptographic receipts for AI outputs: signed attestations, Merkle proofs, and 0G chain-anchors. Free tools (verify_attestation, get_receipt, notary_stats, notary_pubkey) remain free.";

function buildResource(resourceUrl: string): X402Resource {
  return {
    url: resourceUrl,
    description: RESOURCE_DESCRIPTION,
    mimeType: "application/json",
  };
}

export function buildAccepts(cfg: NotaryConfig): PaymentRequirements[] {
  return [
    {
      scheme: "exact",
      network: cfg.network,
      asset: cfg.asset,
      amount: cfg.price.toString(),
      payTo: cfg.payTo,
      maxTimeoutSeconds: 300,
      extra: { name: cfg.domainName, version: cfg.domainVersion },
    },
  ];
}

type Challenge = {
  x402Version: 2;
  resource: X402Resource;
  accepts: PaymentRequirements[];
};

function challenge(cfg: NotaryConfig, resourceUrl: string): Challenge {
  return {
    x402Version: 2,
    resource: buildResource(resourceUrl),
    accepts: buildAccepts(cfg),
  };
}

function paymentRequiredHeader(cfg: NotaryConfig, resourceUrl: string): string {
  return b64(challenge(cfg, resourceUrl));
}

export function build402Response(
  cfg: NotaryConfig,
  resourceUrl: string,
  error?: string
): Response {
  const body = {
    ...challenge(cfg, resourceUrl),
    error:
      error ??
      `Payment required. Sign the x402 v2 challenge (PAYMENT-REQUIRED header / accepts[] below) and retry with a PAYMENT-SIGNATURE header. Free tools (verify_attestation, get_receipt, notary_stats, notary_pubkey) need no payment.`,
  };
  return new Response(JSON.stringify(body), {
    status: 402,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "payment-required": paymentRequiredHeader(cfg, resourceUrl),
    },
  });
}

export function buildDiscoveryResponse(
  cfg: NotaryConfig,
  resourceUrl: string
): Response {
  return new Response(JSON.stringify(challenge(cfg, resourceUrl), null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "payment-required": paymentRequiredHeader(cfg, resourceUrl),
    },
  });
}

export function encodePaymentResponseHeader(r: PaymentResponseHeader): string {
  return b64(r);
}
