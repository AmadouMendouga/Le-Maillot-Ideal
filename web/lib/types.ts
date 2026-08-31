export type Kit = "Domicile" | "Extérieur" | "Third";

export interface ProductImages {
  square: string;
  wide: string;
  svgFallback: string;
}

export interface Product {
  slug: string;
  name: string;
  team: string;
  kit: Kit;
  league: string;
  leagueLabel: string;
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
  updatedAt: string;
  updatedBy: string;
}

export interface League {
  key: string;
  label: string;
  color: string;
  logo: string;
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

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  orderSummary: string;
  status: OrderStatus;
  createdAt: string;
  deliveredAt: string | null;
  reviewToken: string | null;
  reviewSubmitted: boolean;
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
  heroBadge: string;
  heroTitle1: string;
  heroTitle2: string;
  heroLead: string;
  statDelay: string;
  statDelayLabel: string;
  statRating: string;
  statRatingLabel: string;
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
