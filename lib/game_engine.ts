import type { PlotMilestone, ProgressState } from "../shared/types.ts";

function normalizeUnique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

export function buildInitialProgressState(): ProgressState {
  return {
    turn: 0,
    discoveredMilestoneIds: [],
  };
}

export function computeUndiscoveredMilestones(
  milestones: PlotMilestone[],
  discoveredMilestoneIds: string[],
): PlotMilestone[] {
  const discovered = new Set(
    discoveredMilestoneIds.map((id) => id.toLowerCase()),
  );
  return milestones.filter((milestone) =>
    !discovered.has(milestone.id.toLowerCase())
  );
}

export interface MilestoneJudgeResult {
  newlyDiscoveredIds: string[];
  reasoning: string;
}

export function sanitizeJudgeResult(
  result: MilestoneJudgeResult,
  milestones: PlotMilestone[],
  alreadyDiscoveredIds: string[],
): MilestoneJudgeResult {
  const known = new Set(milestones.map((item) => item.id.toLowerCase()));
  const discovered = new Set(
    alreadyDiscoveredIds.map((id) => id.toLowerCase()),
  );

  const newlyDiscoveredIds = normalizeUnique(result.newlyDiscoveredIds)
    .map((id) => id.toLowerCase())
    .filter((id) => known.has(id) && !discovered.has(id));

  return {
    newlyDiscoveredIds,
    reasoning: result.reasoning.trim(),
  };
}

export function applyProgressUpdate(
  progressState: ProgressState,
  judgeResult: MilestoneJudgeResult,
): ProgressState {
  const mergedDiscovered = normalizeUnique([
    ...progressState.discoveredMilestoneIds,
    ...judgeResult.newlyDiscoveredIds,
  ]);

  return {
    turn: progressState.turn + 1,
    discoveredMilestoneIds: mergedDiscovered,
  };
}
