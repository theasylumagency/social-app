export type VisualCreditReason = "demo_seed" | "subscription_allowance" | "credit_purchase" | "manual_adjustment" | "generation_success"
export type VisualTarget = { runId: string; postKey: string; slot: number }
export type VisualInput = { requestId: string; prompt: string; brandId: string | null; aspectRatio: "1:1" | "4:5" | "9:16"; requestKind: "generate" | "regenerate"; target: VisualTarget | null }
export type VisualGeneration = {
  id: string; prompt: string; model: string; status: "pending" | "succeeded" | "failed";
  brandId: string | null; target: VisualTarget | null; requestKind: VisualInput["requestKind"];
  imageUrl: string | null; width: number | null; height: number | null; error: string | null;
  createdAt: string; completedAt: string | null;
}
export type VisualBalance = { remainingCredits: number; reservedCredits: number; availableCredits: number }
export type GeneratedVisual = { content: Buffer; width: number; height: number; providerRequestId: string | null; providerAssetId: string | null; providerCostUsd: number | null; metadata: Record<string, unknown> }
