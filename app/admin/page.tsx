import Link from "next/link";
import { Eye, Edit3, FileText, Plus, Tag, TrendingUp } from "lucide-react";
import { AdminPostList } from "@/components/admin-post-list";
import { ViewsChart } from "@/components/admin-views-chart";
import { TrendChart } from "@/components/admin-trend-chart";
import { Button } from "@/components/ui/button";
import { getAdminPostSummary, getAllPostsAdmin } from "@/lib/admin-queries";
import { Pagination } from "@/components/pagination";

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const [postResult, summary] = await Promise.all([
    getAllPostsAdmin(page, 50),
    getAdminPostSummary(),
  ]);

  const posts = postResult.items;
  const { totalPosts, totalViews, draftsCount, totalTags, topPosts } = summary;
  const maxViews = topPosts[0]?.views_count || 1;

  return (
    <div className="admin-page font-sans">
      <div className="admin-page-header sm:flex sm:items-end sm:justify-between">
        <div>
          <h1 className="admin-page-title">仪表盘</h1>
          <p className="admin-page-description">管理博客内容，查看阅读统计。</p>
        </div>
        <Button asChild className="mt-4 gap-2 sm:mt-0">
          <Link href="/admin/posts/new">
            <Plus className="h-4 w-4" />
            新建文章
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <div className="admin-panel relative flex flex-col justify-between p-5 transition-colors duration-300 hover:border-foreground/20">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[13px] font-medium">文章总数</span>
            <FileText className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-4">
            <h3 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
              {totalPosts}
            </h3>
          </div>
        </div>

        <div className="admin-panel relative flex flex-col justify-between p-5 transition-colors duration-300 hover:border-foreground/20">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[13px] font-medium">全站总阅读</span>
            <Eye className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-4">
            <h3 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
              {totalViews}
            </h3>
          </div>
        </div>

        <div className="admin-panel relative flex flex-col justify-between p-5 transition-colors duration-300 hover:border-foreground/20">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[13px] font-medium">草稿数</span>
            <Edit3 className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-4">
            <h3 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
              {draftsCount}
            </h3>
          </div>
        </div>

        <div className="admin-panel relative flex flex-col justify-between p-5 transition-colors duration-300 hover:border-foreground/20">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[13px] font-medium">标签数</span>
            <Tag className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-4">
            <h3 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
              {totalTags}
            </h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="admin-section-title">文章管理</h2>
          <AdminPostList posts={posts} />
          {postResult.totalPages > 1 && (
            <Pagination
              currentPage={postResult.page}
              totalPages={postResult.totalPages}
              basePath="/admin"
            />
          )}
        </div>

        <div className="space-y-6">
          <TrendChart />
          <ViewsChart posts={posts} />

          <div className="space-y-4">
            <h2 className="admin-section-title flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-muted-foreground" />
              热门阅读排行
            </h2>
            <div className="admin-panel space-y-4 p-5">
              {topPosts.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  暂无统计数据
                </p>
              ) : (
                topPosts.map((post, index) => {
                  const percentage = Math.max(
                    5,
                    Math.round(((post.views_count || 0) / maxViews) * 100),
                  );

                  return (
                    <div key={post.id} className="space-y-2">
                      <div className="flex items-start justify-between gap-4 text-sm">
                        <div className="min-w-0 space-y-0.5">
                          <span className="text-[11px] font-semibold uppercase text-muted-foreground/60">
                            NO. {index + 1}
                          </span>
                          <h4 className="block truncate text-[13.5px] font-medium text-foreground">
                            {post.title}
                          </h4>
                        </div>
                        <span className="shrink-0 font-mono text-[13px] font-semibold text-muted-foreground">
                          {post.views_count || 0} 次
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground/65 transition-all duration-500 ease-out"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
