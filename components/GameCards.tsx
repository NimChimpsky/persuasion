import { formatDateTime } from "../shared/format.ts";
import type { GameSummary } from "../shared/game.ts";

interface GameCardsProps {
  games: GameSummary[];
  emptyText: string;
  pathPrefix?: string;
  actionLabel?: string;
  slugLabel?: string;
}

export default function GameCards(
  {
    games,
    emptyText,
    pathPrefix = "/game/",
    actionLabel = "Open",
    slugLabel = "",
  }: GameCardsProps,
) {
  if (games.length === 0) {
    return <p class="notice">{emptyText}</p>;
  }

  return (
    <div class="cards-grid">
      {games.map((game) => {
        const href = `${pathPrefix}${game.slug}`;
        const slugText = slugLabel ? `${slugLabel}: ${game.slug}` : href;
        return (
          <article key={game.slug} class="card game-card">
            <h3>{game.title}</h3>
            <p class="muted">{slugText}</p>
            <p class="inline-meta">
              {game.characterCount} character(s) · updated{" "}
              {formatDateTime(game.updatedAt)}
            </p>
            {actionLabel
              ? (
                <div class="action-row">
                  <a class="btn primary" href={href}>
                    {actionLabel}
                  </a>
                </div>
              )
              : null}
          </article>
        );
      })}
    </div>
  );
}
