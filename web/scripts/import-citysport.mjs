// Import de produits Sneakers pour IKIGAI Sport, depuis City Sport Cameroun
// (nouveau fournisseur, accord pour utiliser leurs photos Instagram — voir la
// conversation). Contrairement aux imports précédents, City Sport ne publie
// aucun prix sur Instagram : chaque prix est fourni directement par le
// client, produit par produit, plutôt que sourcé du site. Ce fichier grandit
// au fil des publications identifiées — relancer le script est sans risque
// (set() sur le slug, idempotent).
//
// Usage : node scripts/import-citysport.mjs
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url) });

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const ADULT_SHOE_SIZES = ["40", "41", "42", "43", "44", "45"];

const SPORT = "sneakers";
const SPORT_LABEL = "Sneakers";
const SPORT_COLOR = "#6d28d9";

// Prix déjà en FCFA (donné directement par le client, pas de conversion EUR).
const PRODUCTS = [
  {
    slug: "sneakers-adidas-samba-og-marron",
    name: "Adidas Samba OG Marron",
    team: "Adidas",
    price: 45000,
    sizes: ADULT_SHOE_SIZES,
    description:
      "Adidas Samba OG, coloris marron — un classique qui garde son charme d'origine, parfait pour les looks du quotidien. Disponible chez City Sport.",
    image:
      "https://instagram.fdla2-1.fna.fbcdn.net/v/t39.30808-6/790024514_1492592619578437_3150936737189928573_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=108&ig_cache_key=Mzk3NjY5NjkxMjg2MjkwOTk0MQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTYzOC5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=MKkhWkQPEDQQ7kNvwEsXJfh&_nc_oc=Adq83QKxdz8woyMWmZQQ8upTydawunE4xm9jHicPgB5OEFTiMaebOF6oX3cvw5-8Rsg&_nc_ad=z-m&_nc_cid=1395&_nc_zt=23&_nc_ht=instagram.fdla2-1.fna&_nc_gid=Xp0zvb2ZFsnwCcJMwfRuIg&_nc_ss=7a22e&oh=00_AQIuk-diT2PmNCxETOkA9ihrCyyH7TCl0xh_uQUd9pjJlw&oe=6AA06D80",
    stock: 5,
  },
  {
    slug: "sneakers-puma-replicatch",
    name: "Puma Replicatch",
    team: "Puma",
    price: 45000,
    sizes: ADULT_SHOE_SIZES,
    description:
      "Puma Replicatch — une paire simple mais qui a du caractère, s'adapte facilement aux différents styles. Disponible en plusieurs coloris chez City Sport.",
    image:
      "https://instagram.fdla2-1.fna.fbcdn.net/v/t39.30808-6/789178432_1488978266606539_4197709296437790472_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ig_cache_key=Mzk3MzcwMzIxMTc1NjY4NTUzNw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYzOC5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=kQ9uy44MDeAQ7kNvwERYaxw&_nc_oc=Adpd1V1MeR_6Wt_ItrUGbQ2XykOH_VsjZ_Xob-wQOFRn8AxLk3ScsJZNwZpd2rJh3DM&_nc_ad=z-m&_nc_cid=1395&_nc_zt=23&_nc_ht=instagram.fdla2-1.fna&_nc_gid=oF8bmtI2yVcgYoviYxgqEw&_nc_ss=7a22e&oh=00_AQI13Mk3RbHk16dh1iMuZOvXgT83sGR6aCffhNvIHe447w&oe=6AA0A215",
    stock: 5,
  },
  {
    slug: "sneakers-air-jordan-4-lakers-imperial-purple",
    name: "Air Jordan 4 Lakers Imperial Purple",
    team: "Jordan",
    price: 45000,
    sizes: ADULT_SHOE_SIZES,
    description:
      "Air Jordan 4 Lakers Imperial Purple — un classique Jordan revisité dans un coloris inspiré des Lakers. Disponible chez City Sport.",
    image:
      "https://instagram.fdla2-1.fna.fbcdn.net/v/t39.30808-6/772101945_1473674208136945_3932915416965913734_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzk2MTMyNDE1NzUwOTkxODI5NQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE1Mi5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=6NqDfYguU-MQ7kNvwElQYK_&_nc_oc=AdpUjeWM0Hs-9igmtv3QXQ_Z-K-Ou7Jma5sVglb0Qu_WxRQdBhcdnEA-PgSmcfcV-lY&_nc_ad=z-m&_nc_cid=1395&_nc_zt=23&_nc_ht=instagram.fdla2-1.fna&_nc_gid=-U_cx3ehlpRGgWPTzYIhSg&_nc_ss=7a22e&oh=00_AQIy-0_OB2YAQvBSsNHDLmEi9tEZQ1vfkyP8POin-vAz2A&oe=6AA093CA",
    stock: 4,
  },
  {
    slug: "sneakers-nike-dunk-low-bordeaux",
    name: "Nike Dunk Low Bordeaux/Blanc",
    team: "Nike",
    price: 45000,
    sizes: ADULT_SHOE_SIZES,
    description: "Nike Dunk Low, coloris bordeaux et blanc — un incontournable pour renouveler sa collection. Disponible chez City Sport.",
    image:
      "https://instagram.fdla2-1.fna.fbcdn.net/v/t39.30808-6/759224660_1462190442618655_1056271609021686184_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=109&ig_cache_key=Mzk1MTkwNDUxNjE3ODA0ODg4MA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYzOC5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=Xo-N6BQjBCQQ7kNvwHn6AtO&_nc_oc=AdqMV7UkrluTzqgiHsGnn-ZZdZMcfdEQE07qQNpVnSIt0W0n5SlPKGbcaUjM_fZktk4&_nc_ad=z-m&_nc_cid=1395&_nc_zt=23&_nc_ht=instagram.fdla2-1.fna&_nc_gid=mVmPOUziv4ZsPMWwjxfCVQ&_nc_ss=7a22e&oh=00_AQJeaW4tHtHfX4mEeLogDKQRz3kyVOrzzzY9ENV_Dmiyog&oe=6AA098CD",
    stock: 5,
  },
  {
    slug: "sneakers-nike-vomero-5",
    name: "Nike Vomero 5",
    team: "Nike",
    price: 45000,
    sizes: ADULT_SHOE_SIZES,
    description:
      "Nike Vomero 5 — le confort qui suit le rythme de la journée, aussi à l'aise en look casual qu'en tenue sportive. Disponible chez City Sport.",
    image:
      "https://instagram.fdla2-1.fna.fbcdn.net/v/t39.30808-6/774461364_1476549831182716_8136638050669664065_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzk2MzYyOTU2MTUyNzUzOTAzOA%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTA4MC5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=sZHIheeVNEQQ7kNvwGznasf&_nc_oc=Adr0686jRHE6qTiC14J2YiWm3VRcwM-IBrJGcXnBy4oX_2HszS6WA0F-CVhgElQSX_k&_nc_ad=z-m&_nc_cid=1395&_nc_zt=23&_nc_ht=instagram.fdla2-1.fna&_nc_gid=D1egXdf9-gsXwuqfIhBswA&_nc_ss=7a22e&oh=00_AQLWg8e7oq_TkbKQQwXoQTieLcqX7kOqwMFDGbdpM7mMbg&oe=6AA0766A",
    stock: 5,
  },
  {
    slug: "sneakers-air-jordan-1-mid-enigma-stone",
    name: "Air Jordan 1 Mid 'Enigma Stone'",
    team: "Jordan",
    price: 45000,
    sizes: ADULT_SHOE_SIZES,
    description:
      "Air Jordan 1 Mid 'Enigma Stone' — des tons sobres et faciles à porter, parfaits pour les looks du quotidien. Disponible chez City Sport.",
    image:
      "https://instagram.fdla2-1.fna.fbcdn.net/v/t39.30808-6/777220391_1480192034151829_3917976460861390429_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=102&ig_cache_key=Mzk2NjUzODg0ODk4NTI1MzY0Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE3MC5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=qHfgjZ6uJFMQ7kNvwFOfbvL&_nc_oc=AdpAYNs4zhCEmem4a-DycVQ1vxmFZg3vpJAngVog-HCUxty8AODUaPFCtN46OnVWy0M&_nc_ad=z-m&_nc_cid=1395&_nc_zt=23&_nc_ht=instagram.fdla2-1.fna&_nc_gid=b7B2oJilclxEp_8pEQI6dg&_nc_ss=7a22e&oh=00_AQL7ELXznlQLmYldJcYuiavwAtUNYff9tD5JZxl8v4x16Q&oe=6AA074DB",
    stock: 4,
  },
  {
    slug: "sneakers-nike-dunk-low-vert",
    name: "Nike Dunk Low Vert/Blanc",
    team: "Nike",
    price: 45000,
    sizes: ADULT_SHOE_SIZES,
    description:
      "Nike Dunk Low, coloris vert et blanc — une simplicité qui complète chaque tenue. Disponible chez City Sport.",
    image:
      "https://instagram.fdla2-1.fna.fbcdn.net/v/t39.30808-6/751241499_1458754182962281_4860965571525646489_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=103&ig_cache_key=Mzk0OTAzOTk5NzcxNDAzMzM1Ng%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkZFRUQueHBpZHMuMTYzOC5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=Ejk86Mr3vggQ7kNvwGWtJvN&_nc_oc=AdrJfSW9EFgqoUZ4u63Js0O86UA_I2BFUR81zJ76FMsXJkbUWQS2DUfPWLUnsdX_o_0&_nc_ad=z-m&_nc_cid=1395&_nc_zt=23&_nc_ht=instagram.fdla2-1.fna&_nc_gid=xQu-lRDkYO-O29z0sku3QQ&_nc_ss=7a22e&oh=00_AQLcQ46DfP109Q6EmzpDSOpiHPLe1dN8rW223j0AD1uwCg&oe=6AA07E63",
    stock: 5,
  },
  {
    slug: "sneakers-nike-blazer",
    name: "Nike Blazer",
    team: "Nike",
    price: 45000,
    sizes: ADULT_SHOE_SIZES,
    description:
      "Nike Blazer — un design simple, des lignes iconiques et des coloris qui s'adaptent à chaque style. Disponible chez City Sport.",
    image:
      "https://instagram.fdla2-1.fna.fbcdn.net/v/t39.30808-6/730558680_1432888555548844_3420642999536306344_n.jpg?stp=c0.0.1199.1480a_dst-jpg_e35_s1199x1480_tt6&_nc_cat=109&ig_cache_key=MzkyNzIxNDMzMDA5MzUxOTI5Nw%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTE5OS5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=dff2gPn_ieIQ7kNvwFbbB2Y&_nc_oc=Adpg3yQ0lUqGoNSuvC6dNROLZgVVIrEoYE9XkIMkPoIp53sbD2R_Fpp4YtfCfLF7fFI&_nc_ad=z-m&_nc_cid=1395&_nc_zt=23&_nc_ht=instagram.fdla2-1.fna&_nc_gid=SDrU23o78ZMPkZVObnLuXg&_nc_ss=7a22e&oh=00_AQIIDpLYWXPw_XMJiihZW64eZaWuGfYQ87a-qGcxXP4ETw&oe=6AA095C9",
    stock: 5,
  },
  {
    slug: "sneakers-air-jordan-1-mid-chicago",
    name: "Air Jordan 1 Mid Rouge/Noir/Blanc",
    team: "Jordan",
    price: 45000,
    sizes: ADULT_SHOE_SIZES,
    description:
      "Air Jordan 1 Mid, palette rouge/blanc/noir intemporelle qui continue de marquer la culture sneaker. Disponible chez City Sport.",
    image:
      "https://instagram.fdla2-1.fna.fbcdn.net/v/t39.30808-6/668496267_1368430578661309_6138300504012956302_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=101&ig_cache_key=Mzg3Mjk2Nzk0MjAyODYxNDcyNQ%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYzOC5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=EK05WAqTFQUQ7kNvwHqGmXl&_nc_oc=AdrXJEEez4pPMNP_jattI44NUh2z_QELW13qYH9eU0Id9rO9dzY8qmLsEc35EtwrOcE&_nc_ad=z-m&_nc_cid=1395&_nc_zt=23&_nc_ht=instagram.fdla2-1.fna&_nc_gid=6cfXnVSRK9PX3UVxI9twFA&_nc_ss=7a22e&oh=00_AQJPWMdZn8ISPa49JezkACHcWTBhz0u5v7QpqKY0KDdBPw&oe=6AA088E5",
    stock: 4,
  },
  {
    slug: "sneakers-new-balance-1000-black-faded",
    name: "New Balance 1000 Black/Faded",
    team: "New Balance",
    price: 45000,
    sizes: ADULT_SHOE_SIZES,
    description:
      "New Balance 1000, coloris Black/Faded — une lecture moderne du rétro running. Disponible chez City Sport.",
    image:
      "https://instagram.fdla2-1.fna.fbcdn.net/v/t39.30808-6/672695816_1373343618170005_808894284069417945_n.jpg?stp=dst-jpg_e35_tt6&_nc_cat=107&ig_cache_key=Mzg3NzQ2MDA5MjU0NzY5ODQxMg%3D%3D.3-ccb7-5&ccb=7-5&_nc_sid=58cdad&efg=eyJ2ZW5jb2RlX3RhZyI6IkNBUk9VU0VMX0lURU0ueHBpZHMuMTYzOC5zZHIucmVndWxhcl9waG90by5DMiJ9&_nc_ohc=qkhQK6ztnqoQ7kNvwGktjkS&_nc_oc=AdpeOw9kURj1nkCqKmeLi_fd_HlH2BkUfTEnHXY2joX2ci9mDPhCtxZtL1W7-gP2auE&_nc_ad=z-m&_nc_cid=1395&_nc_zt=23&_nc_ht=instagram.fdla2-1.fna&_nc_gid=XuQ9y2YBjVweEoLW4u9yRw&_nc_ss=7a22e&oh=00_AQKek2gfSJf2gzsHs4y1dQ397qRcBZhBLxLZzTqfU4JRpg&oe=6AA0A1B2",
    stock: 4,
  },
];

async function main() {
  console.log(`${PRODUCTS.length} produit(s) à importer...`);
  for (const p of PRODUCTS) {
    const upload = await cloudinary.uploader.upload(p.image, {
      folder: `le-maillot-ideal/products/${p.slug}`,
      public_id: "main",
      overwrite: true,
    });

    await db
      .collection("products")
      .doc(p.slug)
      .set({
        name: p.name,
        team: p.team,
        kit: null,
        sport: SPORT,
        sportLabel: SPORT_LABEL,
        league: null,
        leagueLabel: null,
        color: SPORT_COLOR,
        season: "2026/2027",
        priceOriginal: p.price,
        price: p.price,
        discountPct: 0,
        isNew: true,
        stock: p.stock,
        rating: null,
        reviews: 0,
        sizes: p.sizes,
        kidsAvailable: false,
        description: p.description,
        images: { square: upload.secure_url, wide: upload.secure_url, svgFallback: "" },
        reelUrl: null,
        updatedAt: new Date().toISOString(),
        updatedBy: "import-citysport-script",
      });
    console.log(`✓ ${p.name} (${p.slug}) — ${p.price.toLocaleString("fr-FR")} FCFA`);
  }
  console.log("\nImport terminé.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
