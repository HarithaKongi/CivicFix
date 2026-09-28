'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery } from 'convex/react'
import { useConvexAuth } from '@convex-dev/auth/react'
import { api } from '../convex/_generated/api'
import { ArrowLeft, CheckCircle2, Clock3, FileWarning, Loader2, MapPin, ShieldAlert } from 'lucide-react'
import { useState } from 'react'

const labels: Record<string, string> = { SUBMITTED: 'Submitted', UNDER_REVIEW: 'Under review', VERIFIED: 'Verified', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', RESOLVED: 'Resolved', COMMUNITY_VERIFICATION: 'Community verification', VERIFIED_RESOLUTION: 'Verified resolution', REJECTED: 'Rejected', REOPENED: 'Reopened' }
const transitions: Record<string, string[]> = { SUBMITTED: ['UNDER_REVIEW'], UNDER_REVIEW: ['VERIFIED', 'REJECTED'], VERIFIED: ['ASSIGNED'], ASSIGNED: ['IN_PROGRESS'], IN_PROGRESS: ['RESOLVED'], RESOLVED: ['COMMUNITY_VERIFICATION'], COMMUNITY_VERIFICATION: ['VERIFIED_RESOLUTION', 'REOPENED'], REOPENED: ['UNDER_REVIEW'] }
const date = (value: number) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(value)

function Shell({ children, title }: { children: React.ReactNode; title: string }) { return <main className="min-h-screen bg-[#f6f8fb] px-5 py-8 text-slate-900 sm:px-8"><div className="mx-auto max-w-5xl"><div className="mb-8 flex items-center justify-between"><div><Link href="/" className="mb-3 inline-flex items-center gap-2 text-xs font-semibold text-[#245582] hover:underline"><ArrowLeft size={14} /> Dashboard</Link><h1 className="text-2xl font-bold tracking-tight">{title}</h1></div><Link href="/" className="rounded-xl bg-[#163b66] px-4 py-2.5 text-xs font-semibold text-white">CivicFix</Link></div>{children}</div></main> }
function AuthGate({ children }: { children: React.ReactNode }) { const { isAuthenticated, isLoading } = useConvexAuth(); if (isLoading) return <Shell title="Loading"><Loading /></Shell>; if (!isAuthenticated) return <Shell title="Sign in required"><Empty icon={<ShieldAlert />} text="Please sign in from the dashboard to continue." link="Return to sign in" /></Shell>; return <>{children}</> }
function Loading() { return <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500"><Loader2 className="animate-spin" size={17} /> Loading CivicFix data…</div> }
function Empty({ icon, text, link }: { icon: React.ReactNode; text: string; link: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm"><div className="mx-auto grid size-12 place-items-center rounded-full bg-slate-100 text-slate-500">{icon}</div><p className="mt-4 text-sm text-slate-500">{text}</p><Link href="/" className="mt-5 inline-block rounded-xl bg-[#163b66] px-4 py-2.5 text-xs font-semibold text-white">{link}</Link></div> }
function ErrorState({ message }: { message: string }) { return <Empty icon={<ShieldAlert />} text={message || 'This information is unavailable.'} link="Back to dashboard" /> }

export function MyIssuesPage() { return <AuthGate><MyIssuesContent /></AuthGate> }
function MyIssuesContent() { const issues = useQuery(api.issues.myIssues); const [search, setSearch] = useState(''); if (issues === undefined) return <Shell title="My issues"><Loading /></Shell>; const filtered = issues.filter((i) => `${i.referenceNumber} ${i.title} ${i.address}`.toLowerCase().includes(search.toLowerCase())); return <Shell title="My issues"><div className="mb-5 flex flex-col gap-3 sm:flex-row"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your reports…" className="h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-[#7fa9cb]" /><Link href="/?report=1" className="rounded-xl bg-[#163b66] px-4 py-3 text-center text-xs font-semibold text-white">Report an issue</Link></div>{filtered.length === 0 ? <Empty icon={<FileWarning />} text={issues.length ? 'No reports match your search.' : 'You have not submitted any reports yet.'} link="Return to dashboard" /> : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="divide-y divide-slate-100">{filtered.map((issue) => <Link key={issue._id} href={`/issues/${issue._id}`} className="flex flex-col gap-3 p-5 transition hover:bg-slate-50 sm:flex-row sm:items-center"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#eaf1f8] text-[#2d638f]"><FileWarning size={18} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-800">{issue.title}</p><span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{issue.referenceNumber}</span></div><p className="mt-1 text-xs text-slate-400">{issue.categoryId} · {issue.address}</p></div><div className="text-left sm:text-right"><p className="text-xs font-semibold text-[#245582]">{labels[issue.status]}</p><p className="mt-1 text-[11px] text-slate-400">Updated {date(issue.updatedAt)}</p></div></Link>)}</div></div>}</Shell> }

export function IssueDetailPage({ issueId }: { issueId: string }) { return <AuthGate><IssueDetailContent issueId={issueId} /></AuthGate> }
function IssueDetailContent({ issueId }: { issueId: string }) { const issue = useQuery(api.issues.byId, { issueId: issueId as any }); const timeline = useQuery(api.issues.timeline, { issueId: issueId as any }); const transition = useMutation(api.issues.transition); const [next, setNext] = useState(''); const [message, setMessage] = useState(''); if (issue === undefined || timeline === undefined) return <Shell title="Issue detail"><Loading /></Shell>; if (!issue) return <Shell title="Issue detail"><ErrorState message="Issue not found or you are not authorized to view it." /></Shell>; const options = transitions[issue.status] ?? []; async function update() { if (!next) return; try { await transition({ issueId: issueId as any, newStatus: next as any }); setMessage('Status updated.'); setNext('') } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update status.') } } return <Shell title={issue.referenceNumber}><div className="grid gap-5 lg:grid-cols-[1.3fr_.7fr]"><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#4d83b1]">{issue.categoryName}</p><h2 className="mt-2 text-2xl font-bold tracking-tight">{issue.title}</h2></div><span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">{labels[issue.status]}</span></div><p className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-600">{issue.description}</p><div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 text-xs text-slate-500 sm:grid-cols-2"><p><strong className="text-slate-700">Department</strong><br />{issue.departmentName}</p><p><strong className="text-slate-700">Location</strong><br /><MapPin className="mr-1 inline" size={13} />{issue.address || 'Not provided'}</p><p><strong className="text-slate-700">Created</strong><br />{date(issue.createdAt)}</p><p><strong className="text-slate-700">Updated</strong><br />{date(issue.updatedAt)}</p></div>{issue.reporter && <p className="mt-5 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Reported by <span className="font-semibold text-slate-700">{issue.reporter.name}</span></p>}</section><section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-sm font-bold text-slate-800">Status timeline</h2><div className="mt-5 space-y-5">{timeline.map((event, index) => <div key={event._id} className="relative flex gap-3"><div className="relative flex flex-col items-center"><div className="grid size-7 place-items-center rounded-full bg-[#eaf1f8] text-[#2d638f]"><CheckCircle2 size={14} /></div>{index < timeline.length - 1 && <div className="absolute top-7 h-full w-px bg-slate-200" />}</div><div><p className="text-xs font-semibold text-slate-700">{labels[event.newStatus]}</p><p className="mt-1 text-[11px] text-slate-400">{date(event.timestamp)}{event.actor ? ` · ${event.actor.name}` : ''}</p>{event.note && <p className="mt-1 text-xs text-slate-500">{event.note}</p>}</div></div>)}</div>{issue.canTransition && options.length > 0 && <div className="mt-7 border-t border-slate-100 pt-5"><label className="text-xs font-semibold text-slate-700">Update status<select value={next} onChange={(e) => setNext(e.target.value)} className="mt-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"><option value="">Choose a valid next status</option>{options.map((option) => <option key={option} value={option}>{labels[option]}</option>)}</select></label><button onClick={update} disabled={!next} className="mt-3 w-full rounded-xl bg-[#163b66] py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">Save status</button>{message && <p role="status" className="mt-2 text-xs text-slate-500">{message}</p>}</div>}</section></div></Shell> }

export function DepartmentIssuesPage() { return <AuthGate><DepartmentIssuesContent /></AuthGate> }
function DepartmentIssuesContent() { const issues = useQuery(api.issues.departmentIssues); if (issues === undefined) return <Shell title="Department issues"><Loading /></Shell>; return <Shell title="Department issues">{issues.length === 0 ? <Empty icon={<Clock3 />} text="No authorized department issues found." link="Back to dashboard" /> : <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="divide-y divide-slate-100">{issues.map((issue) => <Link key={issue._id} href={`/issues/${issue._id}`} className="flex items-center gap-4 p-5 hover:bg-slate-50"><div className="flex-1"><p className="font-semibold text-slate-800">{issue.title}</p><p className="mt-1 text-xs text-slate-400">{issue.referenceNumber} · {issue.address}</p></div><span className="text-xs font-semibold text-[#245582]">{labels[issue.status]}</span></Link>)}</div></div>}</Shell> }

export function ProfilePage() { return <AuthGate><ProfileContent /></AuthGate> }
function ProfileContent() { const profile = useQuery(api.issues.profile); if (!profile) return <Shell title="Profile"><Loading /></Shell>; return <Shell title="Profile"><div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="grid size-14 place-items-center rounded-full bg-[#dbe9f6] text-lg font-bold text-[#245582]">{profile.name.slice(0, 1).toUpperCase()}</div><h2 className="mt-4 text-xl font-bold">{profile.name}</h2><p className="mt-1 text-sm text-slate-500">{profile.email}</p><dl className="mt-6 divide-y divide-slate-100 border-t border-slate-100">{[['Role', profile.role.replaceAll('_', ' ')], ['Department', profile.departmentId ? 'Assigned department' : 'Not assigned']].map(([label, value]) => <div key={label} className="flex justify-between py-4 text-sm"><dt className="text-slate-500">{label}</dt><dd className="font-semibold capitalize text-slate-800">{value}</dd></div>)}</dl><p className="mt-4 text-xs text-slate-400">Role and department changes are managed by authorized administrators.</p></div></Shell> }

export function AdminPage() { return <AuthGate><AdminContent /></AuthGate> }
function AdminContent() { const data = useQuery(api.issues.adminOverview); if (data === undefined) return <Shell title="Administration"><Loading /></Shell>; if (!data) return <Shell title="Administration"><ErrorState message="You are not authorized to view administration." /></Shell>; return <Shell title="Administration"><div className="grid gap-4 md:grid-cols-3">{[['Users', data.users.length], ['Departments', data.departments.length], ['Categories', data.categories.length]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-400">{label}</p><p className="mt-3 text-3xl font-bold text-[#163b66]">{value}</p></div>)}</div><div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="divide-y divide-slate-100">{data.users.map((user) => <div key={user._id} className="flex items-center justify-between p-4"><div><p className="text-sm font-semibold">{user.name}</p><p className="text-xs text-slate-400">{user.email}</p></div><span className="text-xs font-semibold capitalize text-[#245582]">{user.role.replaceAll('_', ' ')}</span></div>)}</div></div></Shell> }

export { Loading }

export const StatusIcon = Clock3
export const IssueIcon = FileWarning
export const IssueStatusLabel = labels
export const IssueTransitionLabel = transitions
export const IssueStatusDate = date
export const IssueRouteVersion = 'phase-4'
export const IssuePagesReady = true
export const IssuePageAccent = '#163b66'
export const IssuePageSurface = '#f6f8fb'
export const IssuePageSuccess = CheckCircle2
export const IssuePageWarning = ShieldAlert
export const IssuePageLoader = Loader2
export const IssuePageMapPin = MapPin
export const IssuePageRouter = useRouter
export const IssuePageApi = api
export const IssuePageUseQuery = useQuery
export const IssuePageUseMutation = useMutation
export const IssuePageAuth = useConvexAuth
export const IssuePageLink = Link
export const IssuePageReact = useState
export const IssuePageArrow = ArrowLeft
export const IssuePageClock = Clock3
export const IssuePageWarningIcon = ShieldAlert
export const IssuePageCheck = CheckCircle2
export const IssuePageFile = FileWarning
export const IssuePageMap = MapPin
export const IssuePageLoaderIcon = Loader2
export const IssuePageShield = ShieldAlert
export const IssuePageShell = Shell
export const IssuePageEmpty = Empty
export const IssuePageError = ErrorState
export const IssuePageAuthGate = AuthGate
export const IssuePageDate = date
export const IssuePageLabels = labels
export const IssuePageTransitions = transitions
