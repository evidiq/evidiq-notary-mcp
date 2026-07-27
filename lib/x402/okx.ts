/**
 * Verify and settle through the official OKX Onchain OS Payment SDK.
 *
 * This is the same implementation the seven listed EVIDIQ services run
 * (`@okxweb3/x402-core` + `@okxweb3/x402-evm`), reduced to the simpler
 * `SettleResult` shape these three older services use. It is selected whenever
 * OKX credentials are present; without them the service keeps its previous
 * behaviour rather than failing closed.
 *
 * Two behaviours here exist because their absence cost a listing:
 *
 *   - A settlement the facilitator reports as successful **without** a transaction
 *     hash is honoured with a warning. Refusing it denies service for a payment the
 *     payer already made, and OKX's reviewer read those 402s as "not integrated
 *     with the SDK".
 *   - `pending` / `timeout` without a hash still fails, and with a hash is polled
 *     to a definitive answer. Ambiguity is never reported as success.
 */
import { OKXFacilitatorClient } from "@okxweb3/x402-core";
import { x402ResourceServer } from "@okxweb3/x402-core/server";
import type {
  PaymentPayload as SdkPaymentPayload,
  PaymentRequirements as SdkPaymentRequirements,
} from "@okxweb3/x402-core/types";
import { ExactEvmScheme } from "@okxweb3/x402-evm/exact/server";

import type { PaymentVerifier } from "./facilitator.js";
import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResult,
  VerifyResult,
} from "./types.js";

const DEFAULT_OKX_BASE_URL = "https://web3.okx.com";
const TRANSACTION_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const SETTLE_POLL_INTERVAL_MS = 2_000;
const SETTLE_POLL_DEADLINE_MS = 24_000;

/** Only the config fields the SDK needs, so this file fits every service. */
type SdkGateConfig = {
  network: string;
  asset: string;
  payTo: string;
  domainName: string;
  domainVersion: string;
};

export type OkxCredentials = {
  apiKey: string;
  secretKey: string;
  passphrase: string;
  baseUrl: string;
  syncSettle: boolean;
};

export function getOkxCredentials(): OkxCredentials | null {
  const apiKey = process.env.OKX_API_KEY?.trim();
  const secretKey = process.env.OKX_SECRET_KEY?.trim();
  const passphrase = process.env.OKX_PASSPHRASE?.trim();

  if (!apiKey && !secretKey && !passphrase) return null;
  if (!apiKey || !secretKey || !passphrase) {
    throw new Error(
      "Incomplete OKX Payment SDK config: OKX_API_KEY, OKX_SECRET_KEY, and OKX_PASSPHRASE must be set together"
    );
  }

  return {
    apiKey,
    secretKey,
    passphrase,
    baseUrl: process.env.OKX_BASE_URL?.trim() || DEFAULT_OKX_BASE_URL,
    syncSettle: process.env.OKX_SYNC_SETTLE?.trim() !== "0",
  };
}

function transactionHash(value: unknown): string | undefined {
  return typeof value === "string" && TRANSACTION_HASH_PATTERN.test(value)
    ? value
    : undefined;
}

function reason(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") return candidate;
  }
  return undefined;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class OkxSdkVerifier implements PaymentVerifier {
  private readonly client: OKXFacilitatorClient;
  private readonly server: x402ResourceServer;
  private ready: Promise<void> | null = null;

  constructor(
    private readonly cfg: SdkGateConfig,
    credentials: OkxCredentials
  ) {
    this.client = new OKXFacilitatorClient({
      apiKey: credentials.apiKey,
      secretKey: credentials.secretKey,
      passphrase: credentials.passphrase,
      baseUrl: credentials.baseUrl,
      syncSettle: credentials.syncSettle,
    });
    this.server = new x402ResourceServer(this.client);
    this.server.register(cfg.network as `${string}:${string}`, new ExactEvmScheme());
  }

  private initialize(): Promise<void> {
    const pending =
      this.ready ??
      this.server.initialize().catch((error: unknown) => {
        this.ready = null;
        throw error;
      });
    this.ready = pending;
    return pending;
  }

  async verify(
    payment: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResult> {
    await this.initialize();
    const verdict = await this.server.verifyPayment(
      payment as unknown as SdkPaymentPayload,
      requirements as unknown as SdkPaymentRequirements
    );
    if (!verdict.isValid) {
      return {
        valid: false,
        reason:
          reason(verdict.invalidReason, verdict.invalidMessage) ??
          "the OKX facilitator rejected the payment",
      };
    }
    const payer = verdict.payer ?? payment.payload.authorization.from;
    return { valid: true, payer: payer as `0x${string}` };
  }

  async settle(
    payment: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResult> {
    const fallbackPayer = payment.payload.authorization.from;
    await this.initialize();

    let response;
    try {
      response = await this.server.settlePayment(
        payment as unknown as SdkPaymentPayload,
        requirements as unknown as SdkPaymentRequirements
      );
    } catch (error) {
      return {
        success: false,
        transaction: "",
        payer: fallbackPayer,
        errorReason: `OKX facilitator settlement ended without a definitive response: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }

    const payer = String(response.payer ?? fallbackPayer);
    const transaction = transactionHash(response.transaction);

    if (response.status === "pending" || response.status === "timeout") {
      if (!transaction) {
        return {
          success: false,
          transaction: "",
          payer,
          errorReason: `the OKX facilitator reported settlement ${response.status} without a transaction hash`,
        };
      }
      return this.awaitSettlement(transaction, payer, response.status);
    }

    if (!response.success) {
      return {
        success: false,
        transaction: transaction ?? "",
        payer,
        errorReason:
          reason(response.errorReason, response.errorMessage) ??
          "the OKX facilitator settlement failed",
      };
    }

    if (BigInt(requirements.amount) > 0n && !transaction) {
      console.warn(
        `[x402] SETTLED WITHOUT TX the OKX facilitator reported success with no settlement transaction` +
          ` amount=${requirements.amount} payer=${payer}`
      );
    }

    console.warn(
      `[x402] SETTLED via OKX SDK amount=${requirements.amount} tx=${transaction ?? "(none)"} payer=${payer}`
    );
    return { success: true, transaction: transaction ?? "", payer };
  }

  private async awaitSettlement(
    transaction: string,
    payer: string,
    facilitatorStatus: "pending" | "timeout"
  ): Promise<SettleResult> {
    const unresolved: SettleResult = {
      success: false,
      transaction,
      payer,
      errorReason: `the OKX facilitator reported settlement ${facilitatorStatus}; retry with the same authorization`,
    };
    if (!this.client.getSettleStatus) return unresolved;

    const deadline = Date.now() + SETTLE_POLL_DEADLINE_MS;
    let lastPayer = payer;
    while (Date.now() < deadline) {
      let status;
      try {
        status = await this.client.getSettleStatus(transaction);
      } catch {
        await sleep(SETTLE_POLL_INTERVAL_MS);
        continue;
      }
      lastPayer = String(status.payer ?? lastPayer);
      if (status.status === "success" || status.success === true) {
        return { success: true, transaction, payer: lastPayer };
      }
      if (status.status === "failed" || status.success === false) {
        return {
          success: false,
          transaction,
          payer: lastPayer,
          errorReason:
            reason(status.errorReason, status.errorMessage) ??
            "the OKX facilitator reported the settlement failed",
        };
      }
      await sleep(SETTLE_POLL_INTERVAL_MS);
    }
    return { ...unresolved, payer: lastPayer };
  }
}
