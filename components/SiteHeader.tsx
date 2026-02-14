interface SiteHeaderProps {
  userEmail: string;
  isAdmin: boolean;
}

export default function SiteHeader(props: SiteHeaderProps) {
  return (
    <header class="header site-header">
      <div class="header-top-row">
        <a class="header-brand" href="/home">
          <img
            class="header-brand-logo"
            src="/robot-book-yellow-32.png"
            width="24"
            height="24"
            alt=""
          />
          <span>PERSUASION</span>
        </a>
        <div class="header-spacer" />
        <span class="header-email">{props.userEmail}</span>
        <a class="btn ghost" href="/auth/logout-all">Log out all devices</a>
        <a class="btn ghost" href="/auth/logout">Log out</a>
      </div>
      <nav class="header-subnav">
        {props.isAdmin ? <a class="btn primary" href="/admin">admin</a> : null}
        <a class="btn ghost" href="/create-game">create game</a>
        <a class="btn ghost" href="/home">active games</a>
        <a class="btn ghost" href="/find">find</a>
      </nav>
    </header>
  );
}
