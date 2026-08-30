import { getGallery } from "@/lib/data/gallery";
import { GalleryAdmin } from "@/components/admin/GalleryAdmin";

export default async function AdminGalleryPage() {
  const gallery = await getGallery();
  return <GalleryAdmin initialGallery={gallery} />;
}
