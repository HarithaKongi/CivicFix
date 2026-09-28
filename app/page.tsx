'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useAuthActions, useConvexAuth } from '@convex-dev/auth/react'
import { api } from '../convex/_generated/api'
import { formatCoordinates, useCurrentLocation } from '../components/location-utils'

const LocationMap = dynamic(() => import('../components/location-map').then((module) => module.LocationMap), { ssr: false })
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileWarning,
  Filter,
  HelpCircle,
  Home,
  Layers3,
  ListFilter,
  MapPin,
  Menu,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from 'lucide-react'

const navItems = [
  { label: 'Overview', icon: Home, href: '/' },
  { label: 'All issues', icon: Layers3, href: '/map' },
  { label: 'My reports', icon: FileWarning, href: '/my-issues' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics' },
]

function StatusBadge({ children, tone }: { children: React.ReactNode; tone: 'blue' | 'amber' | 'green' | 'rose' }) {
  const tones = { blue: 'bg-sky-50 text-sky-700 ring-sky-200', amber: 'bg-amber-50 text-amber-700 ring-amber-200', green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', rose: 'bg-rose-50 text-rose-700 ring-rose-200' }
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tones[tone]}`}>{children}</span>
}

export default function Page() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('All issues')
  const [submitted, setSubmitted] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('General')
  const [address, setAddress] = useState('')
  const [location, setLocation] = useState<[number, number] | undefined>()
  const [locationError, setLocationError] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authError, setAuthError] = useState('')
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth()
  const { signIn, signOut } = useAuthActions()
  const currentUser = useQuery(api.issues.currentUser, isAuthenticated ? {} : 'skip')
  const issueData = useQuery(api.issues.recent, isAuthenticated ? { limit: 20 } : 'skip')
  const summary = useQuery(api.issues.summary, isAuthenticated ? {} : 'skip')
  const createIssue = useMutation(api.issues.create)
  const triageIssue = useAction(api.issues.triageIssue)
  const analytics = useQuery(api.issues.dashboardAnalytics, isAuthenticated ? {} : 'skip')
  const generateUploadUrl = useMutation(api.issues.generateUploadUrl)
  const addEvidence = useMutation(api.issues.addEvidence)
  const ensureProfile = useMutation(api.issues.ensureProfile)

  useEffect(() => {
    if (!isAuthenticated || currentUser) return
    void ensureProfile({}).catch(() => undefined)
  }, [currentUser, ensureProfile, isAuthenticated])

  const issueRows = (issueData ?? []).map((issue) => ({
    id: issue.referenceNumber,
    title: issue.title,
    category: issue.categoryId,
    location: issue.address,
    status: issue.status.replaceAll('_', ' ').toLowerCase().replace(/\\b\\w/g, (letter: string) => letter.toUpperCase()),
    priority: issue.priority.charAt(0) + issue.priority.slice(1).toLowerCase(),
    age: `${Math.max(1, Math.round((Date.now() - issue.createdAt) / 3600000))}h ago`,
    color: issue.status === 'RESOLVED' ? 'bg-emerald-500' : issue.priority === 'CRITICAL' ? 'bg-rose-500' : 'bg-amber-500',
    icon: issue.status === 'RESOLVED' ? CheckCircle2 : issue.priority === 'CRITICAL' ? FileWarning : AlertTriangle,
  }))

  const visibleIssues = useMemo(() => issueRows.filter((issue) => {
    const matchesSearch = `${issue.title} ${issue.location} ${issue.id}`.toLowerCase().includes(query.toLowerCase())
    const matchesFilter = filter === 'All issues' || issue.status === filter
    return matchesSearch && matchesFilter
  }), [filter, query, issueData])

  async function handleAuth(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAuthError('')
    try {
      await signIn('password', { email: authEmail, password: authPassword, name: authName, flow: authMode })
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to authenticate.')
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitError('')
    setUploadError('')
    if (!title.trim() || !description.trim() || !address.trim() || !location) {
      setSubmitError('Add a title, description, location description, and map point before submitting.')
      return
    }
    try {
      setUploading(true)
      const createdIssue = await createIssue({ title, description, category, address, latitude: location[0], longitude: location[1] })
      const issueId = createdIssue.issueId
      for (const photo of photos) {
        const uploadUrl = await generateUploadUrl()
        const uploadResponse = await fetch(uploadUrl, { method: 'POST', headers: { 'Content-Type': photo.type }, body: photo })
        if (!uploadResponse.ok) throw new Error('Photo upload failed.')
        const { storageId } = await uploadResponse.json()
        await addEvidence({ issueId, storageId, filename: photo.name, contentType: photo.type })
      }
      try { await triageIssue({ issueId }) } catch { /* deterministic server-side triage remains active */ }
      setReferenceNumber(createdIssue.referenceNumber)
      setSubmitted(true)
      setTitle(''); setDescription(''); setCategory('General'); setAddress(''); setLocation(undefined); setLocationError(''); setPhotos([]); setUploading(false)
    } catch (error) {
      setUploading(false)
      setUploadError(error instanceof Error ? error.message : 'Unable to upload photo evidence.')
      setSubmitError(error instanceof Error ? error.message : 'Unable to submit this report.')
    }
  }

  if (authLoading) {
    return <main className="grid min-h-screen place-items-center bg-[#f6f8fb] text-slate-500"><div className="text-center"><div className="mx-auto size-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#163b66]" /><p className="mt-3 text-sm">Loading CivicFix...</p></div></main>
  }

  if (!isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f8fb] px-5 py-10 text-slate-900">
        <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
          <div className="mb-8 flex items-center gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[#163b66] text-white"><MapPin size={21} /></div><div><p className="text-xl font-bold tracking-tight text-[#163b66]">CivicFix</p><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">CivicFix community</p></div></div>
          <h1 className="text-2xl font-bold tracking-tight">{authMode === 'signIn' ? 'Welcome back' : 'Create your resident account'}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">Sign in to report issues, track updates, and help improve your neighborhood.</p>
          <form onSubmit={handleAuth} className="mt-7 space-y-4">
            {authMode === 'signUp' && <label className="block text-sm font-medium text-slate-700">Full name<input required value={authName} onChange={(event) => setAuthName(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#7fa9cb]" /></label>}
            <label className="block text-sm font-medium text-slate-700">Email<input required type="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#7fa9cb]" /></label>
            <label className="block text-sm font-medium text-slate-700">Password<input required minLength={8} type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#7fa9cb]" /></label>
            {authError && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700">{authError}</p>}
            <button type="submit" className="h-11 w-full rounded-xl bg-[#163b66] text-sm font-semibold text-white transition hover:bg-[#102e50]">{authMode === 'signIn' ? 'Sign in' : 'Create account'}</button>
          </form>
          <button type="button" onClick={() => { setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn'); setAuthError('') }} className="mt-5 w-full text-center text-sm font-medium text-[#245582] hover:underline">{authMode === 'signIn' ? 'New to CivicFix? Create an account' : 'Already have an account? Sign in'}</button>
        </section>
      </main>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-slate-900">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[244px] flex-col border-r border-slate-200 bg-white px-4 py-5 transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-3">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-[#163b66] text-white shadow-sm"><MapPin size={19} strokeWidth={2.5} /></div>
            <div><p className="text-[17px] font-bold tracking-tight text-[#163b66]">CivicFix</p><p className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">City of Northbridge</p></div>
          </div>
          <button className="rounded-lg p-1 text-slate-400 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation"><X size={18} /></button>
        </div>
        <div className="mt-9 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Workspace</div>
        <nav className="mt-2 space-y-1">
          {navItems.map(({ label, icon: Icon, href }) => <Link key={label} href={href} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition ${label==='Overview' ? 'bg-[#eaf1f8] text-[#163b66]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}><Icon size={17}/><span>{label}</span></Link>)}
        </nav>
        <div className="mt-8 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Community</div>
        <nav className="mt-2 space-y-1"><Link href="/notifications" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-slate-500 hover:bg-slate-50"><Bell size={17} /><span>Notifications</span></Link><Link href="/track" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-slate-500 hover:bg-slate-50"><Search size={17} /><span>Track a report</span></Link><Link href="/search" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-slate-500 hover:bg-slate-50"><FileWarning size={17} /><span>Search reports</span></Link><Link href="/search" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-slate-500 hover:bg-slate-50"><MessageSquare size={17}/><span>Community discussions</span></Link><Link href="/map" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-slate-500 hover:bg-slate-50"><Users size={17}/><span>Neighborhood map</span></Link></nav>
        <div className="mt-auto space-y-1 border-t border-slate-100 pt-4"><Link href="/profile" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-slate-500 hover:bg-slate-50"><Settings size={17}/><span>Profile & settings</span></Link><button onClick={()=>void signOut()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium text-rose-600 hover:bg-rose-50"><ShieldCheck size={17}/><span>Sign out</span></button><div className="mt-4 flex items-center gap-2.5 rounded-xl bg-slate-50 p-2.5"><div className="grid size-8 place-items-center rounded-full bg-[#dbe9f6] text-xs font-bold text-[#245582]">{currentUser?.name?.slice(0, 2).toUpperCase() ?? 'CF'}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{currentUser?.name ?? 'CivicFix resident'}</p><p className="text-[10px] text-slate-400">Resident</p></div><ChevronDown size={15} className="text-slate-400" /></div></div>
      </aside>

      <div className="lg:pl-[244px]">
        <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-md sm:px-8"><div className="flex items-center gap-3"><button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="relative hidden sm:block"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reports, locations..." className="h-10 w-[280px] rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-[#7fa9cb] focus:bg-white" /></div></div><div className="flex items-center gap-3"><Link href="/notifications" className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100" aria-label="Notifications"><Bell size={18}/></Link><div className="hidden h-7 w-px bg-slate-200 sm:block" /><button onClick={() => { setReportOpen(true); setSubmitted(false) }} className="flex items-center gap-2 rounded-xl bg-[#163b66] px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm shadow-[#163b66]/20 transition hover:bg-[#102e50]"><Plus size={16} /> Report an issue</button></div></header>

        <main className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mb-1 text-xs font-medium text-slate-400">{new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(new Date())}</p><h1 className="text-[27px] font-bold tracking-[-0.03em] text-slate-900">Good morning, {currentUser?.name?.split(' ')[0] ?? 'neighbor'}</h1><p className="mt-1 text-sm text-slate-500">Here&apos;s what&apos;s happening in your community today.</p></div><div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm"><span className="size-2 rounded-full bg-emerald-500" /> CivicFix community <ChevronDown size={14} className="text-slate-400" /></div></div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Reports submitted" value={summary ? String(summary.total) : '—'} delta="live from Convex" icon={FileWarning} tone="blue" /><StatCard label="Active reports" value={summary ? String(summary.active) : '—'} delta="currently open" icon={Clock3} tone="amber" /><StatCard label="Resolved reports" value={summary ? String(summary.resolved) : '—'} delta="resolved in CivicFix" icon={CheckCircle2} tone="green" /><StatCard label="Community impact" value={summary ? String(summary.total) : '—'} delta="public reports" icon={Users} tone="purple" /></section>

          <section className="mt-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-bold text-slate-800">Issue activity</h2><p className="mt-0.5 text-xs text-slate-400">Reports across your current scope</p></div><span className="text-[11px] text-slate-400">Live · last 30 days</span></div>
              <div className="px-5 pb-4 pt-5"><div className="flex h-[178px] items-end gap-2 sm:gap-4"><div className="flex h-full flex-col justify-between pb-1 text-[10px] text-slate-400"><span>60</span><span>40</span><span>20</span><span>0</span></div><div className="relative flex h-full flex-1 items-end justify-between gap-1 border-b border-l border-slate-100 pl-3">{(analytics?.daily ?? []).map((day,index)=><div key={day.label} title={`${day.label}: ${day.count} reports`} className={`group relative flex h-full flex-1 items-end ${index>25?'hidden sm:flex':''}`}><div className="w-full rounded-t-[3px] bg-[#75a8cc]" style={{height:`${Math.min(100,day.count*18)}%`}}/></div>)}</div></div><div className="mt-3 flex justify-between pl-8 text-[10px] text-slate-400"><span>30d ago</span><span>Today</span></div></div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-bold text-slate-800">Reports by category</h2><p className="mt-0.5 text-xs text-slate-400">Last 30 days</p></div><Link href="/map" className="text-[11px] font-semibold text-[#245b88]">Open map</Link></div>
              <div className="p-5"><div className="mb-4 text-3xl font-bold text-slate-800">{analytics?.recent ?? 0}<span className="ml-2 text-xs font-normal text-slate-400">recent reports</span></div><div className="space-y-3">{Object.entries(analytics?.categoryCounts ?? {}).slice(0,6).map(([name,count])=><div key={name} className="flex items-center gap-2 text-xs"><span className="size-2 rounded-full bg-[#75a8cc]"/><span className="flex-1 text-slate-500">{name}</span><span className="font-semibold text-slate-700">{count}</span></div>)}{Object.keys(analytics?.categoryCounts ?? {}).length===0&&<p className="text-xs text-slate-400">No recent reports.</p>}</div></div>
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-[0_3px_16px_rgba(24,52,78,0.04)]"><div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-800">Recent community reports</h2><p className="mt-0.5 text-xs text-slate-400">Stay up to date with issues near you</p></div><div className="flex items-center gap-2"><div className="flex rounded-lg border border-slate-200 p-0.5">{['All issues','In progress','Resolved'].map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium ${filter === item ? 'bg-slate-100 text-slate-800' : 'text-slate-400'}`}>{item}</button>)}</div><button className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><SlidersHorizontal size={15} /></button></div></div><div className="divide-y divide-slate-100">{visibleIssues.map((issue) => { const Icon = issue.icon; const tone = issue.status === 'Resolved' ? 'green' : issue.priority === 'Critical' ? 'rose' : issue.status === 'In progress' ? 'amber' : 'blue'; return <div key={issue.id} className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50/70"><div className={`grid size-9 shrink-0 place-items-center rounded-xl ${issue.color}/10`}><Icon size={17} className={issue.color.replace('bg-', 'text-')} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-xs font-semibold text-slate-800">{issue.title}</p><span className="hidden rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-500 sm:inline">{issue.id}</span></div><div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400"><span>{issue.category}</span><span className="size-0.5 rounded-full bg-slate-300" /><MapPin size={11} /><span>{issue.location}</span></div></div><div className="hidden w-24 sm:block"><StatusBadge tone={tone}>{issue.status}</StatusBadge></div><div className="hidden w-14 text-right text-[11px] text-slate-400 md:block">{issue.age}</div><button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label={`More actions for ${issue.title}`}><MoreHorizontal size={16} /></button></div>})}</div><div className="flex items-center justify-between border-t border-slate-100 px-5 py-3"><span className="text-[11px] text-slate-400">Showing {visibleIssues.length} live reports</span><Link href="/map" className="flex items-center gap-1 text-[11px] font-semibold text-[#245b88] hover:text-[#163b66]">View all reports <ArrowUpRight size={13} /></Link></div></section>
        </main>
      </div>

      {reportOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">{submitted ? <div className="py-7 text-center"><div className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-100 text-emerald-600"><CheckCircle2 size={28} /></div><h2 className="mt-4 text-lg font-bold text-slate-900">Report submitted</h2><p className="mt-2 text-sm text-slate-500">Thanks for helping improve your community. Your reference is <span className="font-semibold text-slate-700">{referenceNumber}</span>.</p><button onClick={() => setReportOpen(false)} className="mt-6 rounded-xl bg-[#163b66] px-5 py-2.5 text-xs font-semibold text-white">Done</button></div> : <><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4d83b1]">New report</p><h2 className="mt-1 text-xl font-bold text-slate-900">What needs attention?</h2><p className="mt-1 text-sm text-slate-500">Give your city team the details they need to help.</p></div><button onClick={() => setReportOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close report form"><X size={18} /></button></div><form onSubmit={handleSubmit}><div className="mt-6 space-y-4"><div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold text-slate-700">Report location</p><p className="mt-1 text-[11px] text-slate-500">Choose the point on the map or use your current location.</p></div><button type="button" onClick={useCurrentLocation((point) => { setLocation(point); setLocationError('') }, setLocationError)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#245582]">Use my location</button></div><LocationMap value={location} onChange={(point) => { setLocation(point); setLocationError('') }} className="mt-3 h-44" /><p className="mt-2 text-[11px] text-slate-500">{formatCoordinates(location)}</p>{locationError && <p className="mt-1 text-[11px] text-amber-700">{locationError}</p>}</div><div className="rounded-xl border border-dashed border-slate-300 bg-white p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-700">Photo evidence</p><p className="mt-1 text-[11px] text-slate-500">Optional JPEG, PNG, WebP, or GIF up to 10 MB.</p></div><label className="cursor-pointer rounded-lg bg-[#eaf1f8] px-2.5 py-1.5 text-[11px] font-semibold text-[#245582]">Add photos<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="sr-only" onChange={(event) => { const selected = Array.from(event.target.files ?? []); const invalid = selected.find((file) => !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 10 * 1024 * 1024); if (invalid) { setUploadError(`${invalid.name} is unsupported or larger than 10 MB.`); return } setUploadError(''); setPhotos(selected) }} /></label></div>{photos.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{photos.map((photo) => <div key={`${photo.name}-${photo.size}`} className="overflow-hidden rounded-lg border border-slate-200"><img src={URL.createObjectURL(photo)} alt={photo.name} className="aspect-square w-full object-cover" /><button type="button" onClick={() => setPhotos((current) => current.filter((item) => item !== photo))} className="w-full py-1 text-[10px] font-semibold text-rose-600">Remove</button></div>)}</div>}{uploadError && <p role="alert" className="mt-2 text-[11px] text-rose-600">{uploadError}</p>}</div><label className="block text-xs font-semibold text-slate-700">Issue title<input value={title} onChange={(event) => setTitle(event.target.value)} required className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#7fa9cb] focus:bg-white" placeholder="e.g. Pothole on Oak Street" /></label><label className="block text-xs font-semibold text-slate-700">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none focus:border-[#7fa9cb] focus:bg-white"><option value="General">Select a category</option><option>Roads & sidewalks</option><option>Street lighting</option><option>Sanitation</option><option>Water supply</option><option>Parks & recreation</option></select></label><label className="block text-xs font-semibold text-slate-700">Location<div className="relative mt-1.5"><MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input value={address} onChange={(event) => setAddress(event.target.value)} required className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-[#7fa9cb] focus:bg-white" placeholder="Enter the location/address" /></div></label><label className="block text-xs font-semibold text-slate-700">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} required className="mt-1.5 min-h-[88px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-[#7fa9cb] focus:bg-white" placeholder="Tell us what you see..." /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setReportOpen(false)} className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50">Cancel</button><button type="submit" disabled={uploading} aria-busy={uploading} className="rounded-xl bg-[#163b66] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#102e50] disabled:cursor-not-allowed disabled:opacity-60">{uploading ? "Submitting..." : "Submit report"}</button></div></div></form></>}</div></div>
    </div>
  )
}

function StatCard({ label, value, delta, icon: Icon, tone }: { label: string; value: string; delta: string; icon: React.ElementType; tone: 'blue' | 'amber' | 'green' | 'purple' }) {
  const styles = { blue: 'bg-[#eaf1f8] text-[#2d638f]', amber: 'bg-amber-50 text-amber-600', green: 'bg-emerald-50 text-emerald-600', purple: 'bg-violet-50 text-violet-600' }
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_3px_16px_rgba(24,52,78,0.04)]"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-[27px] font-bold tracking-tight text-slate-900">{value}</p></div><div className={`grid size-9 place-items-center rounded-xl ${styles[tone]}`}><Icon size={18} /></div></div><p className="mt-3 text-[11px] text-slate-400"><span className={tone === 'green' ? 'font-semibold text-emerald-600' : 'font-semibold text-slate-600'}>{delta.split(' ')[0]}</span>{' '}{delta.split(' ').slice(1).join(' ')}</p></div>
}
