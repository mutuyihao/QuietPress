import Link from 'next/link'
import { getAllPostsAdmin } from '@/lib/admin-queries'
import { Button } from '@/components/ui/button'
import { AdminPostList } from '@/components/admin-post-list'
import { ViewsChart } from '@/components/admin-views-chart'
import { TrendChart } from '@/components/admin-trend-chart'
import { FileText, Eye, Edit3, Tag, TrendingUp, Plus } from 'lucide-react'

interface AdminDashboardProps {
  searchParams?: Promise<{ login?: string }>
}

export default async function AdminDashboard({ searchParams }: AdminDashboardProps) {
  const params = await searchParams
  const showLoginSuccess = params?.login === 'success'
  const posts = await getAllPostsAdmin()

  // Calculate statistics
  const totalPosts = posts.length
  const totalViews = posts.reduce((sum, p) => sum + (p.views_count || 0), 0)
  const draftsCount = posts.filter((p) => p.status === 'draft').length
  const uniqueTags = new Set(posts.flatMap((p) => p.tags.map((t) => t.id)))
  const totalTags = uniqueTags.size

  // Top posts by views
  const topPosts = [...posts]
    .sort((a, b) => (b.views_count || 0) - (a.views_count || 0))
    .slice(0, 3)
  const maxViews = topPosts[0]?.views_count || 1

  return (
    <div className="admin-page font-sans">
      {showLoginSuccess && (
        <div
          role="status"
          className="rounded-lg border border-border/60 bg-muted/40 px-4 py-3 text-sm leading-relaxed text-foreground shadow-xs"
        >
          登录成功，已进入管理后台。
        </div>
      )}

      {/* Upper header */}
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {/* Total Posts */}
        <div className="admin-panel relative flex flex-col justify-between p-5 transition-colors duration-300 hover:border-foreground/20">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[13px] font-medium">文章总数</span>
            <FileText className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-semibold font-mono tracking-tight text-foreground">{totalPosts}</h3>
          </div>
        </div>

        {/* Total Views */}
        <div className="admin-panel relative flex flex-col justify-between p-5 transition-colors duration-300 hover:border-foreground/20">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[13px] font-medium">全站总阅读</span>
            <Eye className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-semibold font-mono tracking-tight text-foreground">{totalViews}</h3>
          </div>
        </div>

        {/* Drafts */}
        <div className="admin-panel relative flex flex-col justify-between p-5 transition-colors duration-300 hover:border-foreground/20">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[13px] font-medium">草稿箱</span>
            <Edit3 className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-semibold font-mono tracking-tight text-foreground">{draftsCount}</h3>
          </div>
        </div>

        {/* Tags */}
        <div className="admin-panel relative flex flex-col justify-between p-5 transition-colors duration-300 hover:border-foreground/20">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[13px] font-medium">标签数</span>
            <Tag className="h-4 w-4 opacity-70" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-semibold font-mono tracking-tight text-foreground">{totalTags}</h3>
          </div>
        </div>
      </div>

      {/* Main Grid: List + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Post List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="admin-section-title">文章管理</h2>
          <AdminPostList posts={posts} />
        </div>

        {/* Right Side: Popular Leaderboard */}
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
              <p className="text-sm text-muted-foreground text-center py-6">暂无统计数据</p>
            ) : (
              topPosts.map((post, idx) => {
                const percentage = Math.max(5, Math.round(((post.views_count || 0) / maxViews) * 100))
                return (
                  <div key={post.id} className="space-y-2">
                    <div className="flex justify-between items-start text-sm gap-4">
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase">NO. {idx + 1}</span>
                        <h4 className="font-medium text-[13.5px] text-foreground truncate block">{post.title}</h4>
                      </div>
                      <span className="text-[13px] font-semibold font-mono text-muted-foreground shrink-0">{post.views_count || 0} 次</span>
                    </div>
                    {/* Micro Progress Bar */}
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-foreground/65 rounded-full transition-all duration-500 ease-out" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
  )
}
