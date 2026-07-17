import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import {
  createReceipt,
  getStats,
  buildMerkleTree,
  clearBatch,
  getNotaryAddress,
  hasNotaryKey,
  verifyReceipt,
  getReceipt,
} from "./lib/crypto/notary.js";
import { uploadJson } from "./lib/og/storage.js";
import { getOgConfig } from "./lib/og/config.js";
import { getNotaryConfig } from "./lib/x402/config.js";

const x402Config = getNotaryConfig();
const ogConfig = getOgConfig();

const NOTARY_INSTRUCTIONS = `EVIDIQ Notary — Cryptographic receipts for AI outputs.
Submit any AI inference (prompt + response + model_id) and receive a signed, 
timestamped, 0G-anchored receipt proving existence, integrity, and model provenance.
Pay $0.001 USDT0 per notarization via x402 on X Layer.`;

export const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "notarize_inference",
      {
        title: "Notarize a single AI inference",
        description: "Submit {prompt, response, model_id} and receive a signed, 0G-anchored receipt. Cost: $0.001 USDT0 via x402.",
        inputSchema: {
          prompt: z.string().min(1).max(100000).describe("The prompt sent to the AI model"),
          response: z.string().min(1).max(100000).describe("The AI model's response"),
          modelId: z.string().min(1).max(100).describe("Model identifier (e.g., 'gpt-4', 'claude-3-opus', 'glm-5.2')"),
          agentId: z.string().optional().describe("Optional agent identifier for cross-referencing"),
          trustReportHash: z.string().optional().describe("Optional hash of associated trust report"),
          context: z.string().optional().describe("Optional context about the inference"),
        },
      },
      async (args) => {
        const receipt = await createReceipt(args.prompt, args.response, args.modelId, args.agentId, args.trustReportHash);
        
        const data = {
          prompt: args.prompt,
          response: args.response,
          modelId: args.modelId,
          agentId: args.agentId,
          context: args.context,
          timestamp: receipt.timestamp,
          attestation: {
            reportHash: receipt.reportHash,
            signature: receipt.signature,
            notaryAddress: receipt.notaryAddress,
            merkleRoot: receipt.merkleRoot,
            merkleProof: receipt.merkleProof,
          }
        };
        
        const storageResult = ogConfig
          ? await uploadJson(
              ogConfig,
              data,
              `notary-${receipt.reportHash.slice(2, 18)}.json`
            )
          : { ok: false as const, error: "0G not configured: OG_PRIVATE_KEY missing" };
        
        let storageRoot: string | undefined;
        let storageTx: string | undefined;
        let storageNote: string | undefined;
        
        if (storageResult.ok) {
          storageRoot = storageResult.root;
          storageTx = storageResult.tx;
        } else {
          storageNote = storageResult.error;
        }
        
        return {
          content: [
            { type: "text", text: `Notarization complete. Attestation ID: ${receipt.reportHash.slice(0, 16)}...` },
            { type: "text", text: JSON.stringify({
              attestationId: receipt.reportHash,
              contentHash: receipt.combinedHash,
              promptHash: receipt.promptHash,
              responseHash: receipt.responseHash,
              signature: receipt.signature,
              notaryAddress: receipt.notaryAddress,
              timestamp: new Date(receipt.timestamp).toISOString(),
              modelId: args.modelId,
              merkleRoot: receipt.merkleRoot,
              merkleProof: receipt.merkleProof,
              storageRoot,
              storageTx,
              storageNote,
              payment: {
                asset: "USDT0",
                amount: "0.001",
                chainId: 196,
                chainName: "X Layer",
              }
            }, null, 2) }
          ],
        };
      }
    );

    server.registerTool(
      "notarize_batch",
      {
        title: "Notarize multiple AI inferences in batch",
        description: "Submit up to 20 inferences in one call for audit trails. Cost: $0.005 USDT0 via x402.",
        inputSchema: {
          items: z.array(z.object({
            prompt: z.string().min(1).max(100000),
            response: z.string().min(1).max(100000),
            modelId: z.string().min(1).max(100),
            agentId: z.string().optional(),
            trustReportHash: z.string().optional(),
            context: z.string().optional(),
          })).min(1).max(20),
        },
      },
      async (args) => {
        const results = [];
        for (const item of args.items) {
          const receipt = await createReceipt(item.prompt, item.response, item.modelId, item.agentId, item.trustReportHash);
          results.push({
            attestationId: receipt.reportHash,
            contentHash: receipt.combinedHash,
            promptHash: receipt.promptHash,
            responseHash: receipt.responseHash,
            signature: receipt.signature,
            timestamp: new Date(receipt.timestamp).toISOString(),
          });
        }
        
        const hashes = results.map(r => r.attestationId);
        const { root: batchRoot } = buildMerkleTree(hashes);
        
        clearBatch();
        
        return {
          content: [
            { type: "text", text: `Batch notarization complete. ${results.length} items notarized.` },
            { type: "text", text: JSON.stringify({
              batchRoot,
              batchSize: results.length,
              items: results,
              batchTimestamp: new Date().toISOString(),
            }, null, 2) }
          ],
        };
      }
    );

    server.registerTool(
      "verify_attestation",
      {
        title: "Verify an attestation receipt",
        description: "Check any receipt: signature, content hash, Merkle proof. Free.",
        inputSchema: {
          attestationId: z.string().describe("The attestation ID to verify"),
          prompt: z.string().describe("Original prompt"),
          response: z.string().describe("Original response"),
          modelId: z.string().describe("Model identifier"),
        },
      },
      async (args) => {
        const result = await verifyReceipt(args.attestationId, args.prompt, args.response);
        return {
          content: [
            { type: "text", text: JSON.stringify({
              valid: result.valid,
              attestationId: args.attestationId,
              contentMatch: result.contentMatch,
              signatureValid: result.signatureValid,
              merkleValid: result.merkleValid,
              notaryAddress: result.notaryAddress,
              note: result.note,
            }, null, 2) }
          ],
        };
      }
    );

    server.registerTool(
      "get_receipt",
      {
        title: "Fetch public proof material for an attestation",
        description: "Fetch the public proof material for an attestation. Free.",
        inputSchema: {
          attestationId: z.string().describe("The attestation ID to fetch"),
        },
      },
      async (args) => {
        const stored = getReceipt(args.attestationId);
        if (stored) {
          return {
            content: [
              { type: "text", text: JSON.stringify({
                attestationId: args.attestationId,
                found: true,
                promptHash: stored.promptHash,
                responseHash: stored.responseHash,
                contentHash: stored.combinedHash,
                signature: stored.signature,
                notaryAddress: stored.notaryAddress,
                merkleRoot: stored.merkleRoot,
                merkleProof: stored.merkleProof,
                timestamp: new Date(stored.timestamp).toISOString(),
                modelId: stored.modelId,
                note: "Receipt fetched from notary store. For off-chain persistence, fetch from 0G Storage using the storageTx/storageRoot returned at notarization time.",
              }, null, 2) }
            ],
          };
        }
        return {
          content: [
            { type: "text", text: JSON.stringify({
              attestationId: args.attestationId,
              found: false,
              note: "Receipt not in store. Fetch from 0G Storage using the storageTx or storageRoot from the original notarize_inference response.",
            }, null, 2) }
          ],
        };
      }
    );

    server.registerTool(
      "notary_stats",
      {
        title: "Get live notary statistics",
        description: "Live volume, top models, anchored batches. Free.",
        inputSchema: {},
      },
      async () => {
        const stats = getStats();
        return {
          content: [
            { type: "text", text: JSON.stringify({
              totalNotarizations: stats.totalNotarizations,
              totalBatches: stats.totalBatches,
              latestBatchRoot: stats.latestBatchRoot,
              latestBatchTx: stats.latestBatchTx,
              topModels: stats.topModels,
              notaryAddress: stats.notaryAddress,
            }, null, 2) }
          ],
        };
      }
    );

    server.registerTool(
      "notary_pubkey",
      {
        title: "Get the notary's public key",
        description: "The notary's EVM address and algorithm — verify receipts offline with the EIP-191 signature. Free.",
        inputSchema: {},
      },
      async () => {
        return {
          content: [{ type: "text", text: JSON.stringify({
            notaryAddress: getNotaryAddress(),
            algorithm: "EIP-191 (secp256k1)",
            configured: hasNotaryKey(),
            note: hasNotaryKey()
              ? "Verify offline: recompute keccak256(prompt || response), then verify EIP-191 signature against notaryAddress."
              : "Notary signing key not configured — receipts carry hashes but no cryptographic signature.",
          }, null, 2) }]
        };
      }
    );
  },
  {
    instructions: NOTARY_INSTRUCTIONS,
    capabilities: { tools: {}, resources: {} },
  },
  {
    basePath: "",
    maxDuration: 60,
    verboseLogs: false,
  }
);