'use client'

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { PostWithTags } from '@/lib/types'

interface ViewsChartProps {
  posts: PostWithTags[]
}

export function ViewsChart({ posts }: ViewsChartProps) {
  // Sort posts by views
  const data = [...posts]
    .sort((a, b) => (b.views_count || 0) - (a.views_count || 0))
    .slice(0, 5)
    .map(p => ({
      name: p.title.length > 8 ? p.title.substring(0, 8) + '...' : p.title,
      views: p.views_count || 0,
      fullTitle: p.title
    }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold tracking-wide text-foreground">热度对比柱状图</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">TOP 5 最受欢迎文章浏览量对比</CardDescription>
      </CardHeader>
      <CardContent className="h-64 pt-4">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            暂无浏览统计数据
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="name" 
                stroke="currentColor" 
                className="text-muted-foreground/60"
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
              />
              <YAxis 
                stroke="currentColor" 
                className="text-muted-foreground/60"
                fontSize={11} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(value) => `${value}`}
              />
              <Tooltip 
                cursor={{ fill: 'currentColor', className: 'text-muted/40', opacity: 0.15 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-border bg-background p-2.5 text-xs space-y-1">
                        <p className="font-semibold text-foreground">{payload[0].payload.fullTitle}</p>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <span>浏览量:</span>
                          <span className="font-mono text-foreground font-semibold">{payload[0].value} 次</span>
                        </p>
                      </div>
                    )
                  }
                  return null
                }}
              />
              <Bar 
                dataKey="views" 
                fill="currentColor" 
                className="text-foreground/80 dark:text-foreground/90"
                radius={[4, 4, 0, 0]} 
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
