// Upload one-off d'une image vers Cloudinary — variante image de
// upload-spotlight-video.mjs, pour l'affiche (poster) d'un reel "à la une".
// Usage : node scripts/upload-spotlight-image.mjs <chemin-vers-l-image> <public_id>
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url) });

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const [imagePath, publicId] = process.argv.slice(2);
if (!imagePath || !publicId) {
  console.error("Usage : node scripts/upload-spotlight-image.mjs <chemin-vers-l-image> <public_id>");
  process.exit(1);
}

cloudinary.uploader
  .upload(imagePath, {
    folder: "le-maillot-ideal/portal/spotlight",
    public_id: publicId,
    overwrite: true,
  })
  .then((upload) => console.log(upload.secure_url))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
