'use client'

import Link from 'next/link'
import { useQuery, useMutation } from 'convex/react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { api } from '@/convex/_generated/api'
import { Bell, Loader2, CheckCheck } from 'lucide-react'

export default function NotificationsPage() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const rows = useQuery(api.issues.notifications, isAuthenticated ? {} : 'skip')
  const markRead = useMutation(api.issues.markNotificationRead)
  const markAll = useMutation(api.issues.markAllNotificationsRead)
  if (isLoading) return <main className="grid min-h-screen place-items-center bg-[#f6f8fb]"><Loader2 className="animate-spin text-slate-400" /></main>
  if (!isAuthenticated) return <main className="grid min-h-screen place-items-center bg-[#f6f8fb] p-6"><div className="text-center"><h1 className="text-xl font-bold">Sign in required</h1><Link href="/" className="mt-4 inline-block text-sm font-semibold text-[#245582]">Go to sign in</Link></div></main>
  if (rows === undefined) return <main className="grid min-h-screen place-items-center bg-[#f6f8fb]"><Loader2 className="animate-spin text-slate-400" /></main>
  return <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between"><div><Link href="/my-issues" className="text-sm font-medium text-[#245582]">Back to My issues</Link><h1 className="mt-3 flex items-center gap-2 text-2xl font-bold"><Bell size={22} className="text-[#245582]" /> Notifications</h1></div>{rows.some((row) => !row.isRead) && <button onClick={() => markAll({})} className="inline-flex items-center gap-2 text-sm font-semibold text-[#245582]"><CheckCheck size={16} /> Mark all read</button>}</div><div className="mt-6 space-y-3">{rows.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">You&apos;re all caught up.</div> : rows.map((row) => <div key={row._id} className={`rounded-xl border bg-white p-4 ${row.isRead ? 'border-slate-200' : 'border-[#b9d5e8] bg-[#f4f9fc]'}`}><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{row.title}</p><p className="mt-1 text-sm text-slate-600">{row.message}</p><p className="mt-2 text-xs text-slate-400">{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(row.createdAt)}</p></div>{!row.isRead && <button onClick={() => markRead({ notificationId: row._id })} className="shrink-0 text-xs font-semibold text-[#245582]">Mark read</button>}</div>{row.issueId && <Link href={`/issues/${row.issueId}`} className="mt-3 inline-block text-xs font-semibold text-[#245582] hover:underline">View issue</Link>}</div>)}</div></div></main>
}
