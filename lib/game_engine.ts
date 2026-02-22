import type { ProgressState } from "../shared/types.ts";

export function buildInitialProgressState(): ProgressState {
  return { turn: 0 };
}

export function incrementTurn(state: ProgressState): ProgressState {
  return { turn: state.turn + 1 };
}
