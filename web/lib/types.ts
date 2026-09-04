// "Domicile"/"Extérieur"/"Third" reste la liste figée proposée en admin quand
// sport === "football" (voir ProductEditDrawer/ProductCreateDrawer), mais le
// champ produit lui-même est un string libre depuis la migration IKIGAI Sport
// (multi-sports) — un judogi ou une sneaker n'a pas de "Domicile/Extérieur".
export type Kit = "Domicile" | "Extérieur" | "Third";

export interface ProductImages {
  square: string;
  wide: string;
  svgFallback: string;
  /** Photos supplémentaires du même maillot (optionnel — absent sur les anciens produits). */
  gallery?: string[];
}

export interface Product {
  slug: string;
  name: string;
  team: string;
  /** Libre depuis IKIGAI Sport (ex-union stricte "Domicile"|"Extérieur"|"Third") — non validé au runtime, voir productPatchError. */
  kit?: string;
  sport: string;
  sportLabel: string;
  /** Optionnel : seuls les produits rattachés à un championnat (football aujourd'hui) en ont un. */
  league?: string;
  leagueLabel?: string;
  color: string;
  season: string;
  priceOriginal: number;
  price: number;
  discountPct: number;
  isNew: boolean;
  stock: number;
  rating: number | null;
  reviews: number;
  sizes: string[];
  kidsAvailable: boolean;
  description: string;
  images: ProductImages;
  /** Vidéo de présentation courte (reel), optionnelle — voir ProductDetail. */
  reelUrl?: string;
  updatedAt: string;
  updatedBy: string;
}

export interface Sport {
  key: string;
  label: string;
  color: string;
  logo: string;
  /** Bandeau d'accueil et chiffres clés du site de ce sport — propres à chaque sport
   * depuis la migration portail (avant : globaux dans SiteSettings, ce qui mélangeait
   * le discours "maillot" avec les autres sports). */
  heroBadge: string;
  heroTitle1: string;
  heroTitle2: string;
  heroLead: string;
  statDelay: string;
  statDelayLabel: string;
  statRating: string;
  statRatingLabel: string;
}

export interface League {
  key: string;
  label: string;
  color: string;
  logo: string;
  /** FK vers sports/{key} — sans ça, les championnats de plusieurs sports se mélangeraient dans un seul pool. */
  sport: string;
  teams: string[];
}

export interface GalleryItem {
  id: string;
  src: string;
  thumb: string;
  order: number;
  createdAt: string;
}

export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  designation: string;
  photoUrl: string;
  order: number;
}

export type OrderStatus = "confirmee" | "livree";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed";

export interface OrderItem {
  slug: string;
  size: string;
  qty: number;
}

export type LiveLocation = { lat: number; lng: number; updatedAt: string } | null;

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  orderSummary: string;
  address: string | null;
  // Position partagée par le client, pour aider à localiser l'adresse de livraison.
  locationToken: string | null;
  locationSharing: boolean;
  liveLocation: LiveLocation;
  // Position partagée par qui livre effectivement (Djimi ou une aide ponctuelle
  // — variable, voir CLAUDE.md) — canal séparé du client, même mécanique.
  courierLocationToken: string | null;
  courierLocationSharing: boolean;
  courierLiveLocation: LiveLocation;
  status: OrderStatus;
  createdAt: string;
  deliveredAt: string | null;
  reviewToken: string | null;
  reviewSubmitted: boolean;
  uid: string | null;
  items?: OrderItem[];
  total?: number;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  campayReference: string | null;
  ussdCode: string | null;
  paidAt: string | null;
  paymentFailureReason: string | null;
}

export interface Customer {
  uid: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface TestimonialSubmission {
  id: string;
  orderId: string;
  name: string;
  designation: string;
  quote: string;
  photoUrl: string;
  submittedAt: string;
}

export interface DeliveryRow {
  zone: string;
  delay: string;
  cost: string;
  payment: string;
}

export interface SiteSettings {
  businessName: string;
  siteUrl: string;
  shareImage: string;
  topbarInfo: string;
  topbarHelp: string;
  whatsapp: string;
  whatsappDisplay: string;
  email: string;
  address: string;
  addressLocality: string;
  addressCountry: string;
  hours: string;
  responseTime: string;
  openingDays: string[];
  openingTime: string;
  closingTime: string;
  areaServed: string[];
  paymentAccepted: string[];
  catalogDataVerified: boolean;
  commercialTermsVerified: boolean;
  freeShippingThreshold: number;
  deliveryRows: DeliveryRow[];
  instagram: string;
  facebook: string;
  tiktok: string;
  showGallery: boolean;
  showTestimonials: boolean;
  showDemoNotice: boolean;
}
