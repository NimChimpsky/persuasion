import { createDefine } from "fresh";

export interface State {
  title: string;
  userEmail: string | null;
  isAdmin: boolean;
}

export const define = createDefine<State>();
