import { z } from "zod";

export const NOTARY_CONFIG = {
  name: "EVIDIQ Notary",
  version: "0.1.0",
  description: "Cryptographic receipts for AI outputs — signed attestations, Merkle proofs, and 0G chain-anchors via x402 USDT0 micropayments on X Layer",
  payment: {
    asset: "0x779ded0c9e1022225f8e0630b35a9b54be713736",
    assetName: "USDT0",
    assetDecimals: 6,
    priceUsd: 0.001,
    priceAtomic: "1000",
    chainId: 196,
    chainName: "X Layer",
    payTo: "0x2a8efe3093278bb4bd3b2d9c7b5ba992ca4fc9b0",
  },
  batching: {
    maxBatchSize: 100,
    batchIntervalMs: 30000,
    minBatchSize: 1,
  },
  og: {
    enabled: true,
    storageRpc: process.env.OG_STORAGE_RPC || "https://evmrpc.0g.ai",
    storageIndexer: process.env.OG_STORAGE_INDEXER || "https://indexer-storage-turbo.0g.ai",
    computeRouter: process.env.OG_COMPUTE_ROUTER || "https://router-api.0g.ai/v1",
    model: "glm-5.2",
    privateKey: process.env.OG_PRIVATE_KEY,
  },
  rpc: {
    xlayer: process.env.XLAYER_RPC || "https://rpc.xlayer.tech",
  },
};

export function getConfig() {
  const envSchema = z.object({
    NOTARY_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    X402_PAY_TO: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
    X402_PRICE_ATOMIC: z.string().regex(/^\d+$/).optional(),
    XLAYER_RPC: z.string().url().optional(),
    OG_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
    OG_STORAGE_RPC: z.string().url().optional(),
    OG_STORAGE_INDEXER: z.string().url().optional(),
    OG_COMPUTE_ROUTER: z.string().url().optional(),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).optional(),
  });

  const env = envSchema.parse(process.env);

  return {
    ...NOTARY_CONFIG,
    notaryPrivateKey: env.NOTARY_PRIVATE_KEY,
    payTo: env.X402_PAY_TO || NOTARY_CONFIG.payment.payTo,
    priceAtomic: env.X402_PRICE_ATOMIC || NOTARY_CONFIG.payment.priceAtomic,
    rpcUrl: env.XLAYER_RPC || NOTARY_CONFIG.rpc.xlayer,
    ogPrivateKey: env.OG_PRIVATE_KEY || NOTARY_CONFIG.og.privateKey,
    ogStorageRpc: env.OG_STORAGE_RPC || NOTARY_CONFIG.og.storageRpc,
    ogStorageIndexer: env.OG_STORAGE_INDEXER || NOTARY_CONFIG.og.storageIndexer,
    ogComputeRouter: env.OG_COMPUTE_ROUTER || NOTARY_CONFIG.og.computeRouter,
    logLevel: env.LOG_LEVEL || "info",
  };
}

export type Config = ReturnType<typeof getConfig>;