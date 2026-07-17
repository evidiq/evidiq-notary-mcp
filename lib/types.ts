// EVIDIQ Notary types
export interface NotarizeInput {
  prompt: string;
  response: string;
  modelId: string;
  agentId?: string;
  trustReportHash?: string;
  context?: string;
}

export interface NotarizeOutput {
  attestationId: string;
  contentHash: string;
  signature: string;
  notaryAddress: string;
  timestamp: string;
  modelId: string;
  storageRoot?: string;
  storageTx?: string;
  trustReportHash?: string;
  payment?: {
    txHash: string;
    amount: string;
    asset: string;
    chainId: number;
  };
}

export interface VerifyInput {
  attestationId: string;
  prompt: string;
  response: string;
  modelId: string;
}

export interface VerifyOutput {
  valid: boolean;
  attestationId: string;
  contentMatch: boolean;
  signatureValid: boolean;
  notaryAddress: string;
  timestamp: string;
  storageRoot?: string;
  storageTx?: string;
  trustReportHash?: string;
  note?: string;
}

export interface StatsOutput {
  totalNotarizations: number;
  totalBatches: number;
  latestBatchRoot?: string;
  latestBatchTx?: string;
  topModels: { modelId: string; count: number }[];
  notaryAddress: string;
}

export interface NotarizeBatchInput {
  items: NotarizeInput[];
}