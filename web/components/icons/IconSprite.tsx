import { ICON_SPRITE } from "./sprite-content";

/** À monter une seule fois, dans le layout racine. Voir <Icon> pour l'usage. */
export function IconSprite() {
  return (
    <div
      id="icon-sprite"
      aria-hidden="true"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      dangerouslySetInnerHTML={{ __html: ICON_SPRITE }}
    />
  );
}
