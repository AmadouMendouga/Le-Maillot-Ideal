"use client";

// Écran de chargement du portail — patron restrowebsite ([data-preaload] +
// script.js "PRELOAD") : plein écran avec un anneau qui tourne, glisse hors
// champ une fois la page chargée (500ms, délai 250ms). Scopé au portail
// (la vitrine), pas au reste du site — voir la conversation.
import { useEffect, useState } from "react";

export function PortalPreloader() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (document.readyState === "complete") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lit un état déjà présent au montage (readyState), pas une donnée qui change pendant le rendu
      setLoaded(true);
      return;
    }
    function onLoad() {
      setLoaded(true);
    }
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return (
    <div className={"portal-preloader" + (loaded ? " loaded" : "")} aria-hidden="true">
      <span className="portal-preloader-spinner" />
      <span className="portal-preloader-text">IKIGAI Sport</span>
    </div>
  );
}
