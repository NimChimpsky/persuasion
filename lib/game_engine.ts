import type {
  Character,
  CharacterVisibility,
  PlotMilestone,
  ProgressState,
} from "../shared/types.ts";

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

  // Build prerequisite map for filtering
  const prereqMap = new Map<string, string[]>();
  for (const m of milestones) {
    prereqMap.set(
      m.id.toLowerCase(),
      m.prerequisiteIds.map((id) => id.toLowerCase()),
    );
  }

  const newlyDiscoveredIds = normalizeUnique(result.newlyDiscoveredIds)
    .map((id) => id.toLowerCase())
    .filter((id) => {
      if (!known.has(id) || discovered.has(id)) return false;
      // Check all prerequisites are already discovered
      const prereqs = prereqMap.get(id) ?? [];
      return prereqs.every((prereqId) => discovered.has(prereqId));
    });

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

export function resolveCharacterVisibility(
  character: Character,
  progressState: ProgressState,
  encounteredCharacterIds: string[],
  milestones: PlotMilestone[],
): "hidden" | "locked" | "available" | "encountered" {
  const charIdLower = character.id.toLowerCase();

  // Already encountered → always show
  if (encounteredCharacterIds.some((id) => id.toLowerCase() === charIdLower)) {
    return "encountered";
  }

  const discoveredSet = new Set(
    progressState.discoveredMilestoneIds.map((id) => id.toLowerCase()),
  );

  // Check if any discovered milestone unlocks this character
  for (const milestone of milestones) {
    if (!discoveredSet.has(milestone.id.toLowerCase())) continue;
    const unlocks = milestone.unlocksCharacterIds.map((id) => id.toLowerCase());
    if (unlocks.includes(charIdLower)) {
      return "available";
    }
  }

  // Check if any milestone gates this character (even undiscovered ones)
  const isGatedByMilestone = milestones.some((m) =>
    m.unlocksCharacterIds.some((id) => id.toLowerCase() === charIdLower)
  );

  if (!isGatedByMilestone && character.initialVisibility === "available") {
    return "available";
  }

  return character.initialVisibility as CharacterVisibility;
}
