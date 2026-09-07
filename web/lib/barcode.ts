// Génération de code-barres produit — 12 chiffres aléatoires, pas de format
// imposé. L'admin peut toujours le remplacer par le sien (voir
// ProductEditDrawer/ProductCreateDrawer) ; ce générateur ne sert que de valeur
// par défaut pour qu'aucun produit ne reste sans code. Pas destiné au rendu
// visuel/scannable — voir components/delivery/DeliveryBarcode.tsx pour le
// code de livraison, qui lui doit être lisible par un lecteur de code-barres.
export function generateProductBarcode(): string {
  let code = "";
  for (let i = 0; i < 12; i++) code += Math.floor(Math.random() * 10);
  return code;
}
