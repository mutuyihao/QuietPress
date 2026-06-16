import { getSiteSettingsAdmin } from "@/lib/admin-queries";
import { getImageUploadConfig } from "@/lib/image-upload-config";
import { MediaLibrary } from "@/components/media-library";

export default async function AdminMediaPage() {
  const settings = await getSiteSettingsAdmin();

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">媒体中心</h1>
        <p className="admin-page-description">管理已上传图片。</p>
      </div>

      <MediaLibrary
        mode="manage"
        uploadConfig={getImageUploadConfig(settings)}
      />
    </div>
  );
}
