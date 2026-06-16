import type { Tag } from "@/lib/types";

interface TagsPanelProps {
  allTags: Tag[];
  selectedTags: string[];
  onToggleTag: (tagId: string) => void;
}

export function TagsPanel({
  allTags,
  selectedTags,
  onToggleTag,
}: TagsPanelProps) {
  return (
    <section className="admin-panel p-4">
      <h2 className="mb-3 text-sm font-medium text-foreground">标签</h2>
      {allTags.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无标签</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => onToggleTag(tag.id)}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                selectedTags.includes(tag.id)
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/70 bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
