// Infinite Moving Cards — porté depuis js/infinite-moving-cards.js.
// La copie du contenu (au lieu du clonage DOM d'origine) fait tourner la
// boucle exactement pareil : la 2e liste prend le relais où la 1re finit.
import type { ReactNode } from "react";

const SPEED_SECONDS = { fast: 20, normal: 40, slow: 80 } as const;

export interface InfiniteMovingCardsProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemKey: (item: T, index: number) => string;
  speed?: keyof typeof SPEED_SECONDS;
  direction?: "left" | "right";
  ariaLabel?: string;
}

export function InfiniteMovingCards<T>({
  items,
  renderItem,
  itemKey,
  speed = "normal",
  direction = "left",
  ariaLabel,
}: InfiniteMovingCardsProps<T>) {
  if (!items.length) return null;

  return (
    <div className="imc-wrap">
      <div
        className={"imc" + (direction === "right" ? " imc-reverse" : "")}
        style={{ ["--imc-duration" as string]: `${SPEED_SECONDS[speed]}s` }}
        aria-hidden={ariaLabel ? undefined : "true"}
        aria-label={ariaLabel}
      >
        <ul className="imc-track">
          {items.map((item, i) => (
            <li key={"a-" + itemKey(item, i)} className="imc-item">
              {renderItem(item, i)}
            </li>
          ))}
          {items.map((item, i) => (
            <li key={"b-" + itemKey(item, i)} className="imc-item" aria-hidden="true">
              {renderItem(item, i)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
