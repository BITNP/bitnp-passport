import type { HandoverInput } from "./handover.ts";

export const jobItemStatuses = ["pending", "succeeded", "failed"] as const;

export type JobItemStatus = (typeof jobItemStatuses)[number];

export type JobData =
  | { type: "membership" }
  | { type: "handover"; input: HandoverInput; total: number };

export interface JobResult {
  label: string;
  outcome: JobItemStatus;
  error?: string;
}
