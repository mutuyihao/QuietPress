"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format, subDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { readApiJson } from "@/lib/api-client";

interface DailyView {
  view_date: string;
  count: number;
}

export function TrendChart() {
  const [data, setData] = useState<DailyView[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setLoading(true);
        setError(null);
      }
    });
    fetch(`/api/admin/analytics?days=${days}`)
      .then((res) =>
        readApiJson<{ dailyViews: DailyView[]; message?: string }>(res),
      )
      .then((json) => {
        if (cancelled) return;
        if (json.message) {
          setError(json.message);
        } else if (Array.isArray(json.dailyViews)) {
          // Fill in missing days with 0
          const startDate = subDays(new Date(), days);
          const filled: DailyView[] = [];
          for (let i = 0; i <= days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            const dateStr = d.toISOString().split("T")[0];
            const found = json.dailyViews.find(
              (v: DailyView) => v.view_date === dateStr,
            );
            filled.push({ view_date: dateStr, count: found ? found.count : 0 });
          }
          setData(filled);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [days]);

  const chartData = data.map((d) => ({
    date: d.view_date,
    views: d.count,
    label: format(new Date(d.view_date), "MM/dd", { locale: zhCN }),
  }));

  const totalViews = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold tracking-wide text-foreground">
              浏览量趋势
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              {totalViews > 0
                ? `近${days}天共 ${totalViews} 次浏览`
                : error || ""}
            </CardDescription>
          </div>
          <div className="admin-tabs text-[11px] font-sans">
            {[7, 14, 30].map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDays(d)}
                aria-pressed={days === d}
                className={`admin-tab px-2.5 py-0.5 ${
                  days === d ? "admin-tab-active font-medium" : ""
                }`}
              >
                {d}天
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-64 pt-2">
        {loading ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            加载中...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="currentColor"
                    stopOpacity={0.12}
                  />
                  <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                className="stroke-border/50"
                vertical={false}
              />
              <XAxis
                dataKey="label"
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
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded-lg border border-border bg-background p-2.5 text-xs space-y-1">
                        <p className="font-semibold text-foreground">
                          {payload[0].payload.date}
                        </p>
                        <p className="text-muted-foreground flex items-center gap-1">
                          <span>浏览量:</span>
                          <span className="font-mono text-foreground font-semibold">
                            {payload[0].value} 次
                          </span>
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="currentColor"
                className="text-foreground/60"
                strokeWidth={1.5}
                fill="url(#viewsGradient)"
                dot={false}
                activeDot={{ r: 4, className: "fill-foreground" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
