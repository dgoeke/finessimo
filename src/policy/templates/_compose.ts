// Template composition utilities for opener policy system
// Enables patch-based template variants with deterministic left-to-right merge

import type { Template, StepCandidate } from "../types";

// Patch type - partial template override with required id
export type TemplatePatch = Partial<Omit<Template, "id" | "opener">> & {
  id: string;
};

/**
 * Extends a base template with a patch, creating a new template variant.
 *
 * Composition rules:
 * - Shallow field override for most fields
 * - preconditions: AND feasible flags, concatenate notes, sum scoreDelta
 * - nextStep: concatenate candidates from base + patch
 *
 * @param base The base template to extend
 * @param patch The patch containing overrides and extensions
 * @returns A new template with composed behavior
 */
export function extendTemplate(base: Template, patch: TemplatePatch): Template {
  return {
    ...base,
    ...patch,
    nextStep: patch.nextStep
      ? (s): ReadonlyArray<StepCandidate> => {
          const patchNextStep = patch.nextStep;
          if (patchNextStep === undefined) return base.nextStep(s);
          return [...base.nextStep(s), ...patchNextStep(s)];
        }
      : base.nextStep,
    preconditions: patch.preconditions
      ? (
          s,
        ): {
          feasible: boolean;
          notes: ReadonlyArray<string>;
          scoreDelta?: number;
        } => {
          const patchPreconditions = patch.preconditions;
          if (patchPreconditions === undefined) return base.preconditions(s);

          const baseResult = base.preconditions(s);
          const patchResult = patchPreconditions(s);
          return {
            feasible: baseResult.feasible && patchResult.feasible,
            notes: [...baseResult.notes, ...patchResult.notes],
            scoreDelta:
              (baseResult.scoreDelta ?? 0) + (patchResult.scoreDelta ?? 0),
          };
        }
      : base.preconditions,
  };
}
