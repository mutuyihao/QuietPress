import { getAllTagsAdmin, getSiteSettingsAdmin } from "@/lib/admin-queries";
import { getImageUploadConfig } from "@/lib/image-upload-config";
import { PostEditor } from "@/components/post-editor";

export default async function NewPostPage() {
  const [tags, settings] = await Promise.all([
    getAllTagsAdmin(),
    getSiteSettingsAdmin(),
  ]);
  const uploadConfig = getImageUploadConfig(settings);

  return (
    <div className="admin-page admin-editor-page">
      <div className="admin-page-header">
        <h1 className="admin-page-title">新建文章</h1>
      </div>
      <PostEditor allTags={tags} uploadConfig={uploadConfig} />
    </div>
  );
}
