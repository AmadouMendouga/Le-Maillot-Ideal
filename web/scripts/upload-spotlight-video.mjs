// Upload one-off d'une vidéo vers Cloudinary et affichage de son secure_url —
// utilisé pour la vidéo vitrine "à la une" du portail (reel City Sport, accord
// client confirmé — voir la conversation), qui n'est pas rattachée à un
// produit précis donc n'a pas sa place dans un script d'import produit.
// Usage : node scripts/upload-spotlight-video.mjs <chemin-vers-le-mp4> <public_id>
import { config } from "dotenv";
config({ path: new URL("../.env.local", import.meta.url) });

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const [videoPath, publicId] = process.argv.slice(2);
if (!videoPath || !publicId) {
  console.error("Usage : node scripts/upload-spotlight-video.mjs <chemin-vers-le-mp4> <public_id>");
  process.exit(1);
}

cloudinary.uploader
  .upload(videoPath, {
    resource_type: "video",
    folder: "le-maillot-ideal/portal/spotlight",
    public_id: publicId,
    overwrite: true,
  })
  .then((upload) => console.log(upload.secure_url))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
