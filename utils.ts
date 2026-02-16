import { createDefine } from "fresh";
import type { UserProfile } from "./shared/types.ts";

export interface State {
  title: string;
  userEmail: string | null;
  isAdmin: boolean;
  userProfile: UserProfile | null;
}

export const define = createDefine<State>();
