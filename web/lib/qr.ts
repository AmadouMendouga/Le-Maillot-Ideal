import "server-only";
import QRCode from "qrcode";

// QR du code de livraison (voir CLAUDE.md, section livraison) — généré côté
// serveur (une fois, au chargement de la page) plutôt que dans le navigateur :
// le code ne change jamais après coup, pas besoin de refaire ce calcul à
// chaque rendu. Encode le PIN à 4 chiffres tel quel — le QR n'est qu'un
// raccourci de saisie pour le livreur (scanner plutôt que taper), le PIN
// affiché en dessous reste la vraie donnée à vérifier si le scan échoue.
export async function deliveryCodeQrDataUrl(code: string): Promise<string> {
  return QRCode.toDataURL(code, { margin: 1, width: 220, errorCorrectionLevel: "M" });
}
