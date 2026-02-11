interface SiteHeaderProps {
  title: string;
  userEmail: string;
  isAdmin: boolean;
}

export default function SiteHeader(props: SiteHeaderProps) {
  return (
    <header class="header card site-header">
      <div>
        <h1 class="display page-title">{props.title}</h1>
        <p class="muted">{props.userEmail}</p>
      </div>
      <nav class="nav-row">
        <a class="btn ghost" href="/home">Home</a>
        {props.isAdmin ? <a class="btn ghost" href="/admin">Admin</a> : null}
        <a class="btn ghost" href="/auth/logout">Logout</a>
      </nav>
    </header>
  );
}
