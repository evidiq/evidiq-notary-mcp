import { keccak256, stringToBytes, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { getOgConfig } from "../og/config.js";

/**
 * EVIDIQ Notary — cryptographic receipts for AI outputs.
 *
 * Hashing uses keccak256 over (prompt, response). The notary signer reuses the
 * 0G attester key (OG_PRIVATE_KEY) — see EVIDIQ-RUNBOOK.md §13: the same EVM
 * key signs Trust Reports + 0G storage uploads + notary receipts. When the key
 * is absent, receipts still carry hashes and Merkle proofs but no signature.
 */

const ogConfig = getOgConfig();
const notaryAccount = ogConfig ? privateKeyToAccount(ogConfig.privateKey) : null;

const batch: Array<{
  id: string;
  promptHash: string;
  responseHash: string;
  modelId: string;
  timestamp: number;
  receipt: {
    reportHash: string;
    signature: string;
    notaryAddress: string;
    timestamp: number;
    merkleProof?: string[];
  };
}> = [];

let batchRoot: string | undefined;
let batchTx: string | undefined;

export function hashData(data: string): string {
  return keccak256(stringToBytes(data));
}

export function hashPromptResponse(
  prompt: string,
  response: string
): { promptHash: string; responseHash: string; combinedHash: string } {
  const promptHash = keccak256(stringToBytes(prompt));
  const responseHash = keccak256(stringToBytes(response));
  const combinedHash = keccak256(
    encodePacked(
      ["bytes32", "bytes32"],
      [promptHash as `0x${string}`, responseHash as `0x${string}`]
    )
  );
  return { promptHash, responseHash, combinedHash };
}

export function buildMerkleTree(hashes: string[]): {
  root: string;
  proofs: Map<string, string[]>;
} {
  if (hashes.length === 0) return { root: "0x", proofs: new Map() };
  if (hashes.length === 1) return { root: hashes[0], proofs: new Map([[hashes[0], []]]) };

  const proofs = new Map<string, string[]>();
  const level = hashes.map((h) => {
    proofs.set(h, []);
    return h;
  });

  let current = level;
  while (current.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < current.length; i += 2) {
      const left = current[i];
      const right = i + 1 < current.length ? current[i + 1] : left;
      const parent = keccak256(
        encodePacked(
          ["bytes32", "bytes32"],
          [left as `0x${string}`, right as `0x${string}`]
        )
      );
      if (proofs.has(left)) proofs.get(left)!.push(right);
      if (proofs.has(right) && right !== left) proofs.get(right)!.push(left);
      next.push(parent);
    }
    current = next;
  }

  return { root: current[0], proofs };
}

/** Canonical message signed by the notary key (EIP-191 personal_sign). */
function attestationMessage(reportHash: string, merkleRoot: string): string {
  return [
    "EVIDIQ Notary Receipt v1",
    `reportHash: ${reportHash}`,
    `merkleRoot: ${merkleRoot}`,
  ].join("\n");
}

export async function signReceipt(
  reportHash: string,
  merkleRoot: string
): Promise<string> {
  if (!notaryAccount) return "0x";
  const message = attestationMessage(reportHash, merkleRoot);
  return notaryAccount.signMessage({ message });
}

export async function createReceipt(
  prompt: string,
  response: string,
  modelId: string,
  agentId?: string,
  trustReportHash?: string
): Promise<{
  promptHash: string;
  responseHash: string;
  combinedHash: string;
  reportHash: string;
  signature: string;
  merkleRoot: string;
  merkleProof: string[];
  timestamp: number;
  notaryAddress: string;
}> {
  const { promptHash, responseHash, combinedHash } = hashPromptResponse(prompt, response);

  const batchItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    promptHash,
    responseHash,
    modelId,
    timestamp: Date.now(),
    receipt: {
      reportHash: combinedHash,
      signature: "",
      notaryAddress: notaryAccount?.address || "0x",
      timestamp: Date.now(),
    },
  };

  batch.push(batchItem);

  const hashes = batch.map((b) => b.receipt.reportHash);
  const { root, proofs } = buildMerkleTree(hashes);
  batchRoot = root;

  const proof = proofs.get(combinedHash) || [];
  const signature = await signReceipt(combinedHash, root);

  return {
    promptHash,
    responseHash,
    combinedHash,
    reportHash: combinedHash,
    signature,
    merkleRoot: root,
    merkleProof: proof,
    timestamp: Date.now(),
    notaryAddress: notaryAccount?.address || "0x",
  };
}

export function getStats(): {
  totalNotarizations: number;
  totalBatches: number;
  latestBatchRoot?: string;
  latestBatchTx?: string;
  topModels: { modelId: string; count: number }[];
  notaryAddress: string;
} {
  const modelCounts = new Map<string, number>();
  for (const item of batch) {
    modelCounts.set(item.modelId, (modelCounts.get(item.modelId) || 0) + 1);
  }

  return {
    totalNotarizations: batch.length,
    totalBatches: batchRoot ? 1 : 0,
    latestBatchRoot: batchRoot,
    latestBatchTx: batchTx,
    topModels: Array.from(modelCounts.entries())
      .map(([modelId, count]) => ({ modelId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10),
    notaryAddress: notaryAccount?.address || "0xNotConfigured",
  };
}

/** The notary's address (EVM) — recoverable from any receipt signature. */
export function getNotaryAddress(): string {
  return notaryAccount?.address || "0xNotConfigured";
}

/** Whether a real notary signing key is configured. */
export function hasNotaryKey(): boolean {
  return notaryAccount !== null;
}

export function getBatchRoot(): string | undefined {
  return batchRoot;
}

export function getBatchTx(): string | undefined {
  return batchTx;
}

export function setBatchTx(tx: string) {
  batchTx = tx;
}

export function clearBatch() {
  batch.length = 0;
  batchRoot = undefined;
  batchTx = undefined;
}
