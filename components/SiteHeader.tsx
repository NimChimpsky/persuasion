interface SiteHeaderProps {
  title: string;
  userEmail: string;
  isAdmin: boolean;
  showHomeLink?: boolean;
  showLogoutAllLink?: boolean;
}

export default function SiteHeader(props: SiteHeaderProps) {
  const showHomeLink = props.showHomeLink ?? true;
  const showLogoutAllLink = props.showLogoutAllLink ?? false;

  return (
    <header class="header card site-header">
      <div>
        <h1 class="display page-title">{props.title}</h1>
        <p class="muted">{props.userEmail}</p>
      </div>
      <nav class="nav-row">
        {showHomeLink ? <a class="btn ghost" href="/home">Home</a> : null}
        {props.isAdmin ? <a class="btn ghost" href="/admin">Admin</a> : null}
        {showLogoutAllLink
          ? <a class="btn ghost" href="/auth/logout-all">Log out all devices</a>
          : null}
        <a class="btn ghost" href="/auth/logout">Logout</a>
      </nav>
    </header>
  );
}
