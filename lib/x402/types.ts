/**
 * x402 v2 payment protocol types — ported from Evidiq main (lib/x402/types.ts).
 * EVIDIQ speaks x402 v2 only (no v1, no X-PAYMENT).
 */

export type Hex = `0x${string}`;

export type X402Resource = {
  url: string;
  description: string;
  mimeType: string;
};

export type PaymentRequirements = {
  scheme: "exact";
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
};

export type Eip3009Authorization = {
  from: Hex;
  to: Hex;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: Hex;
};

export type PaymentPayload = {
  x402Version: number;
  scheme: "exact";
  network: string;
  /**
   * The requirements the client agreed to, exactly as they arrived. The OKX SDK
   * compares this against the requirements it verifies against, so dropping it
   * makes the facilitator answer `param_mismatch`.
   */
  accepted?: PaymentRequirements;
  payload: {
    signature: Hex;
    authorization: Eip3009Authorization;
  };
};

export type VerifyResult =
  | { valid: true; payer: Hex }
  | { valid: false; reason: string };

export type SettleResult = {
  success: boolean;
  transaction: string;
  payer: string;
  errorReason?: string;
};

export type PaymentResponseHeader = {
  status: "settled" | "verified";
  transaction: string;
  amount: string;
  payer: string;
};
