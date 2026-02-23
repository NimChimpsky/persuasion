import { createDefine } from "fresh";
import type { UserProfile } from "./shared/types.ts";

export interface State {
  title: string;
  userEmail: string | null;
  isAdmin: boolean;
  userProfile: UserProfile | null;
  creditBalance: number | null;
  activeGameHeader?: {
    slug: string;
    title: string;
  };
}

export const define = createDefine<State>();
