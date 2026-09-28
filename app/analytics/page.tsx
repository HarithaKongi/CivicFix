'use client'

import Link from 'next/link'
import { useQuery } from 'convex/react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { api } from '@/convex/_generated/api'
import { ArrowLeft, BarChart3, CheckCircle2, Clock3, FileWarning, Loader2, Users } from 'lucide-react'

export default function AnalyticsPage() {
  const { isAuthenticated } = useConvexAuth()
  const analytics = useQuery(api.issues.dashboardAnalytics, isAuthenticated ? {} : 'skip')

  if (!isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8fb] p-6 text-slate-900">
        <div className="text-center">
          <h1 className="text-xl font-bold">Sign in required</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to view your CivicFix analytics.</p>
          <Link href="/" className="mt-5 inline-block text-sm font-semibold text-[#245582]">Go to sign in</Link>
        </div>
      </main>
    )
  }

  if (analytics === undefined) {
    return <main className="grid min-h-screen place-items-center bg-[#f6f8fb]"><Loader2 className="animate-spin text-slate-400" /></main>
  }

  const maxDaily = Math.max(...analytics.daily.map((day) => day.count), 1)
  const categories = Object.entries(analytics.categoryCounts).sort((a, b) => b[1] - a[1])

  return (
    <main className="min-h-screen bg-[#f6f8fb] p-5 text-slate-900 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-[#245582]">
          <ArrowLeft size={16} /> Dashboard
        </Link>

        <div className="mt-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4d83b1]">CivicFix insights</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Live metrics from Convex. Residents see their own reports; authorized staff and administrators see their permitted scope.
          </p>
        </div>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total reports" value={analytics.total} icon={FileWarning} />
          <Metric label="Last 30 days" value={analytics.recent} icon={BarChart3} />
          <Metric label="Active" value={analytics.active} icon={Clock3} />
          <Metric label="Resolved" value={analytics.resolved} icon={CheckCircle2} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold">Report activity</h2>
                <p className="mt-1 text-xs text-slate-400">Daily reports over the last 30 days</p>
              </div>
              <BarChart3 size={18} className="text-[#4d83b1]" />
            </div>
            <div className="mt-6 flex h-56 items-end gap-1.5 border-b border-slate-100">
              {analytics.daily.map((day) => (
                <div key={day.label} className="group flex h-full flex-1 items-end">
                  <div
                    title={`${day.label}: ${day.count} report${day.count === 1 ? '' : 's'}`}
                    className="w-full rounded-t bg-[#75a8cc] transition hover:bg-[#4d83b1]"
                    style={{ height: `${Math.max(day.count ? (day.count / maxDaily) * 100 : 1, 1)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-slate-400">
              <span>{analytics.daily[0]?.label ?? '30d ago'}</span>
              <span>{analytics.daily.at(-1)?.label ?? 'Today'}</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#4d83b1]" />
              <div>
                <h2 className="text-sm font-bold">Reports by category</h2>
                <p className="mt-1 text-xs text-slate-400">Last 30 days</p>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              {categories.length === 0 ? (
                <p className="rounded-xl bg-slate-50 p-5 text-center text-xs text-slate-400">No reports in this period.</p>
              ) : categories.map(([name, count]) => (
                <div key={name}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">{name}</span>
                    <span className="font-semibold text-slate-800">{count}</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-[#75a8cc]" style={{ width: `${Math.max((count / Math.max(analytics.recent, 1)) * 100, 2)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
        </div>
        <div className="grid size-9 place-items-center rounded-xl bg-[#eaf1f8] text-[#2d638f]">
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}
