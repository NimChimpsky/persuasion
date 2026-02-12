interface SiteHeaderProps {
  userEmail: string;
  isAdmin: boolean;
}

export default function SiteHeader(props: SiteHeaderProps) {
  return (
    <header class="header card site-header">
      <div class="header-top-row">
        <a class="header-brand" href="/home">Persuasion</a>
        <div class="header-spacer" />
        <span class="header-email">{props.userEmail}</span>
        <a class="btn ghost" href="/auth/logout-all">log out all</a>
        <a class="btn ghost" href="/auth/logout">log out</a>
      </div>
      <nav class="header-subnav">
        {props.isAdmin ? <a class="btn primary" href="/admin">admin</a> : null}
        <a class="btn ghost" href="/publish">publish</a>
        <a class="btn ghost" href="/home">active games</a>
        <a class="btn ghost" href="/find">find</a>
      </nav>
    </header>
  );
}
