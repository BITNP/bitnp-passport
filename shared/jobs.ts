import type { HandoverInput } from "./handover.ts";

export type JobData =
  | { type: "membership" }
  | { type: "handover"; input: HandoverInput; total: number };

export interface JobResult {
  label: string;
  outcome: "succeeded" | "failed" | "unknown";
  error?: string;
}
