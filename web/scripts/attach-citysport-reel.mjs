// Attache un reel City Sport (déballage Air Force 1, accord client confirmé
// pour la réutilisation vidéo — voir la conversation) au produit Sneakers le
// plus proche visuellement au catalogue actuel : pas d'Air Force 1 importée,
// le Nike Blazer est le silhouette Nike sobre/iconique la plus proche.
// Usage : node scripts/attach-citysport-reel.mjs <chemin-vers-le-mp4>
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

const SLUG = "sneakers-nike-blazer";
const videoPath = process.argv[2];
if (!videoPath) {
  console.error("Usage : node scripts/attach-citysport-reel.mjs <chemin-vers-le-mp4>");
  process.exit(1);
}

async function main() {
  const upload = await cloudinary.uploader.upload(videoPath, {
    resource_type: "video",
    folder: `le-maillot-ideal/products/${SLUG}/reel`,
    public_id: "main",
    overwrite: true,
  });

  await db.collection("products").doc(SLUG).update({
    reelUrl: upload.secure_url,
    updatedAt: new Date().toISOString(),
    updatedBy: "attach-citysport-reel-script",
  });

  console.log(`✓ Reel attaché à ${SLUG} : ${upload.secure_url}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
