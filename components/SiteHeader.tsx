import ResetGameButton from "../islands/ResetGameButton.tsx";
import type { UserProfile } from "../shared/types.ts";

interface SiteHeaderProps {
  userEmail: string;
  isAdmin: boolean;
  userProfile: UserProfile | null;
  creditBalance: number | null;
  activeGameHeader?: {
    slug: string;
    title: string;
  };
}

export default function SiteHeader(props: SiteHeaderProps) {
  return (
    <header class="site-header">
      <div class="header-top-row">
        <a class="header-brand" href="/home">
          <img
            class="header-brand-logo"
            src="/logo/transparent_logo_only.png"
            width="28"
            height="28"
            alt="Persuasion logo"
          />
          <span>PERSUASION</span>
        </a>
        {props.isAdmin
          ? <a class="btn primary" href="/admin">admin</a>
          : null}
        <div class="header-spacer" />
        {props.creditBalance !== null
          ? (
            <span class="header-credits" title="Credits remaining">
              {props.creditBalance.toFixed(1)} cr
            </span>
          )
          : null}
        <span class="header-email">{props.userEmail}</span>
        <a class="btn ghost" href="/profile">
          {props.userProfile ? "Profile" : "Complete profile"}
        </a>
        <a class="btn ghost" href="/auth/logout-all">Log out all devices</a>
        <a class="btn ghost" href="/auth/logout">Log out</a>
      </div>
      <div class="header-subnav">
        <div class="header-subnav-section header-subnav-section-nav">
          <nav class="header-subnav-links">
            <a class="btn ghost" href="/create-game">Create</a>
            <a class="btn ghost" href="/home">Play</a>
          </nav>
        </div>
        <div class="header-subnav-section header-subnav-section-center">
          {props.activeGameHeader
            ? <span class="header-game-title">{props.activeGameHeader.title}</span>
            : null}
        </div>
        <div class="header-subnav-section header-subnav-section-end">
          {props.activeGameHeader
            ? <ResetGameButton slug={props.activeGameHeader.slug} />
            : null}
        </div>
      </div>
    </header>
  );
}
