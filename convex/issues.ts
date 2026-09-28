import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"

const statuses = ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "COMMUNITY_VERIFICATION", "VERIFIED_RESOLUTION", "REJECTED", "REOPENED"] as const
type Status = typeof statuses[number]
type Role = "citizen" | "department_staff" | "department_admin" | "super_admin"
const transitions: Record<Status, Status[]> = { SUBMITTED: ["UNDER_REVIEW"], UNDER_REVIEW: ["VERIFIED", "REJECTED"], VERIFIED: ["ASSIGNED"], ASSIGNED: ["IN_PROGRESS"], IN_PROGRESS: ["RESOLVED"], RESOLVED: ["COMMUNITY_VERIFICATION"], COMMUNITY_VERIFICATION: ["VERIFIED_RESOLUTION", "REOPENED"], VERIFIED_RESOLUTION: [], REJECTED: [], REOPENED: ["UNDER_REVIEW"] }

async function requireProfile(ctx: any) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("You must be signed in.")
  const profile = await ctx.db.query("profiles").withIndex("by_auth_identity", (q: any) => q.eq("authIdentityId", identity.subject)).unique()
  if (!profile) throw new Error("Your profile is still being created. Please try again.")
  if (!profile.isActive) throw new Error("Your account is not active.")
  return profile
}

async function audit(ctx: any, actorId: any, action: string, entityType: string, entityId: string, metadata?: string) {
  await ctx.db.insert("auditLogs", { actorId, action, entityType, entityId, timestamp: Date.now(), metadata })
}

async function enforceLimit(ctx: any, profileId: any, operation: string, max: number, windowMs = 60_000) {
  const key = `${profileId}:${operation}`; const now = Date.now(); const row = await ctx.db.query("rateLimits").withIndex("by_key", (q: any) => q.eq("key", key)).unique()
  if (!row || now - row.windowStartedAt >= windowMs) { if (row) await ctx.db.patch(row._id, { windowStartedAt: now, count: 1 }); else await ctx.db.insert("rateLimits", { key, windowStartedAt: now, count: 1 }); return }
  if (row.count >= max) throw new Error("You are doing that too often. Please try again shortly.")
  await ctx.db.patch(row._id, { count: row.count + 1 })
}

function canAccessIssue(profile: any, issue: any) {
  return profile.role === "super_admin" || (profile.role === "citizen" && issue.reporterId === profile._id) || ((profile.role === "department_staff" || profile.role === "department_admin") && profile.departmentId === issue.departmentId)
}

function publicIssue(issue: any) {
  return { ...issue, reporterId: undefined }
}

export const currentUser = query({ args: {}, handler: async (ctx) => { const identity = await ctx.auth.getUserIdentity(); if (!identity) return null; return await ctx.db.query("profiles").withIndex("by_auth_identity", (q) => q.eq("authIdentityId", identity.subject)).unique() } })

export const ensureProfile = mutation({ args: {}, handler: async (ctx) => {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error("You must be signed in.")
  const existing = await ctx.db.query("profiles").withIndex("by_auth_identity", (q) => q.eq("authIdentityId", identity.subject)).unique()
  if (existing) return existing
  const now = Date.now()
  const id = await ctx.db.insert("profiles", { authIdentityId: identity.subject, name: identity.name?.trim() || "CivicFix resident", email: identity.email?.trim().toLowerCase() || "", role: "citizen", isActive: true, reputationPoints: 0, createdAt: now, updatedAt: now })
  return await ctx.db.get(id)
} })

function validCoordinates(latitude: number, longitude: number) { return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 && !(latitude === 0 && longitude === 0) }
function normalizeText(value: string) { return value.toLowerCase().replace(/[^a-z0-9\\s]/g, " ").replace(/\\s+/g, " ").trim() }
function similarityScore(a: string, b: string) { const aa = new Set(normalizeText(a).split(" ").filter(Boolean)); const bb = new Set(normalizeText(b).split(" ").filter(Boolean)); if (!aa.size || !bb.size) return 0; let overlap = 0; for (const token of aa) if (bb.has(token)) overlap++; return overlap / Math.max(aa.size, bb.size) }
function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) { const r = 6371000; const toRad = (v: number) => v * Math.PI / 180; const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1); const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2; return 2*r*Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) }
const categoryDepartments: Record<string, string> = { roads: "ROADS", garbage: "SANITATION", sanitation: "SANITATION", water: "WATER", streetlights: "ELECTRICAL", electrical: "ELECTRICAL", drainage: "DRAINAGE", parks: "PARKS", safety: "SAFETY", "public safety": "SAFETY" }
function priorityFor(title: string, description: string, category: string, supporters = 0): { score: number; priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; reason: string } { const text = `${title} ${description}`.toLowerCase(); const safety = /(fire|danger|injury|crime|gas leak|live wire|flood)/.test(text) ? 45 : 0; const urgency = /(urgent|emergency|blocked|outage|hazard)/.test(text) ? 20 : 0; const social = Math.min(supporters * 2, 20); const score = Math.min(100, 10 + safety + urgency + social + (category.toLowerCase().includes("safety") ? 15 : 0)); const priority = score >= 75 ? "CRITICAL" : score >= 55 ? "HIGH" : score >= 30 ? "MEDIUM" : "LOW"; return { score, priority, reason: `${safety ? "public safety impact; " : ""}${urgency ? "urgent language; " : ""}${social ? `${supporters} supporter signal; ` : ""}`.trim() || "baseline category and age assessment" } }
async function departmentFor(ctx: any, categoryName: string, fallback: any) { const code = categoryDepartments[categoryName.trim().toLowerCase()]; if (!code) return fallback; return await ctx.db.query("departments").withIndex("by_code", (q: any) => q.eq("code", code)).unique() ?? fallback }

export const create = mutation({ args: { title: v.string(), description: v.string(), category: v.string(), address: v.string(), latitude: v.number(), longitude: v.number(), landmark: v.optional(v.string()) }, handler: async (ctx, args) => {
  const reporter = await requireProfile(ctx); await enforceLimit(ctx, reporter._id, "create_issue", 5, 60 * 60_000)
  if (!validCoordinates(args.latitude, args.longitude)) throw new Error("Choose a valid location on the map.")
  if (args.title.trim().length < 3 || args.description.trim().length < 10) throw new Error("Add a more descriptive title and description.")
  let department = await ctx.db.query("departments").withIndex("by_code", (q) => q.eq("code", "OPS")).unique()
  const now = Date.now()
  if (!department) { const id = await ctx.db.insert("departments", { name: "Public Works", code: "OPS", description: "Civic operations", isActive: true, createdAt: now, updatedAt: now }); department = await ctx.db.get(id) }
  if (!department || !department.isActive) throw new Error("The department is inactive.")
  department = await departmentFor(ctx, args.category, department); if (!department) throw new Error("No routing department is available.")
  let category = await ctx.db.query("categories").withIndex("by_department", (q) => q.eq("departmentId", department._id)).filter((q) => q.eq(q.field("name"), args.category)).unique()
  if (!category) { const id = await ctx.db.insert("categories", { name: args.category || "Other", description: "Community report", departmentId: department._id, defaultPriority: "MEDIUM", defaultSlaHours: 72, isActive: true, createdAt: now, updatedAt: now }); category = await ctx.db.get(id) }
  if (!category || !category.isActive) throw new Error("The category is inactive.")
  const initialPriority = priorityFor(args.title, args.description, args.category)
  const recent = await ctx.db.query("issues").withIndex("by_created").order("desc").take(250)
  const duplicate = recent.find((candidate) => candidate.isPublic && candidate.categoryId === category._id && distanceMeters(candidate.latitude,candidate.longitude,args.latitude,args.longitude) <= 150 && (similarityScore(candidate.title,args.title) >= 0.65 || similarityScore(candidate.description,args.description) >= 0.55))
  const referenceNumber = `CFX-${new Date(now).getFullYear()}-${String(now).slice(-6)}-${String(Math.floor(Math.random() * 100)).padStart(2, "0")}`
  const issueId = await ctx.db.insert("issues", { referenceNumber, title: args.title.trim(), description: args.description.trim(), categoryId: category._id, departmentId: category.departmentId, reporterId: reporter._id, status: "SUBMITTED", priority: initialPriority.priority, priorityScore: initialPriority.score, priorityReason: initialPriority.reason, priorityCalculatedAt: now, latitude: args.latitude, longitude: args.longitude, address: args.address.trim(), landmark: args.landmark?.trim() || undefined, city: "CivicFix", supportCount: 0, commentCount: 0, viewCount: 0, isPublic: true, isDuplicate: Boolean(duplicate), duplicateOf: duplicate?._id, createdAt: now, updatedAt: now, dueAt: now + category.defaultSlaHours * 3600000 })
  await ctx.db.insert("issueStatusHistory", { issueId, newStatus: "SUBMITTED", changedBy: reporter._id, timestamp: now, note: duplicate ? `Possible duplicate of ${duplicate.referenceNumber}` : "Issue submitted" })
  if (duplicate) await notify(ctx, reporter._id, "POSSIBLE_DUPLICATE", "Possible duplicate report", `Your report may duplicate ${duplicate.referenceNumber}. Please review before submitting another report.`, issueId)
  return issueId
} })

export const storeAiAnalysis = internalMutation({ args: { issueId: v.id("issues"), analysis: v.object({ suggestedCategory: v.string(), severity: v.string(), summary: v.string(), keywords: v.array(v.string()), suggestedDepartment: v.string(), safetyConcern: v.boolean(), priorityFactors: v.array(v.string()), analyzedAt: v.number() }) }, handler: async (ctx, args) => { const issue = await ctx.db.get(args.issueId); if (!issue) return; await ctx.db.patch(issue._id, { aiAnalysis: args.analysis }); } })

export const triageIssue = action({ args: { issueId: v.id("issues") }, handler: async (ctx, args): Promise<any> => { const identity = await ctx.auth.getUserIdentity(); if (!identity) throw new Error("You must be signed in."); const issue = await ctx.runQuery(internal.issues.publicIssueForTriage, { issueId: args.issueId }); if (!issue) throw new Error("Issue not found."); const key = process.env.GEMINI_API_KEY; if (!key) return { status: "unavailable", reason: "GEMINI_API_KEY is not configured; deterministic triage remains active." }; const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: `Return JSON only with suggestedCategory, severity, summary, keywords, suggestedDepartment, safetyConcern, priorityFactors. Analyze this civic issue: ${issue.title}\n${issue.description}` }] }], generationConfig: { responseMimeType: "application/json" } }) }); if (!response.ok) return { status: "unavailable", reason: "Gemini request failed; deterministic triage remains active." }; const payload = await response.json(); const text = payload.candidates?.[0]?.content?.parts?.[0]?.text; if (!text) return { status: "unavailable", reason: "Gemini returned no analysis; deterministic triage remains active." }; try { const raw = JSON.parse(text); const analysis: any = { suggestedCategory: String(raw.suggestedCategory ?? issue.categoryName), severity: String(raw.severity ?? issue.priority), summary: String(raw.summary ?? issue.title).slice(0, 500), keywords: Array.isArray(raw.keywords) ? raw.keywords.map(String).slice(0, 12) : [], suggestedDepartment: String(raw.suggestedDepartment ?? issue.departmentName), safetyConcern: Boolean(raw.safetyConcern), priorityFactors: Array.isArray(raw.priorityFactors) ? raw.priorityFactors.map(String).slice(0, 12) : [], analyzedAt: Date.now() }; await ctx.runMutation(internal.issues.storeAiAnalysis, { issueId: args.issueId, analysis }); return { status: "complete", analysis }; } catch { return { status: "unavailable", reason: "Gemini returned invalid structured data; deterministic triage remains active." } } } })

export const publicIssueForTriage = internalQuery({ args: { issueId: v.id("issues") }, handler: async (ctx, args) => { const issue = await ctx.db.get(args.issueId); if (!issue) return null; const category = await ctx.db.get(issue.categoryId); const department = await ctx.db.get(issue.departmentId); return { title: issue.title, description: issue.description, categoryName: category?.name ?? "Other", departmentName: department?.name ?? "Unassigned", priority: issue.priority } } })

export const generateUploadUrl = mutation({ args: {}, handler: async (ctx) => { await requireProfile(ctx); return await ctx.storage.generateUploadUrl() } })

export const addEvidence = mutation({ args: { issueId: v.id("issues"), storageId: v.id("_storage"), filename: v.string(), contentType: v.string() }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); const issue = await ctx.db.get(args.issueId); if (!issue || !canAccessIssue(profile, issue)) throw new Error("You are not authorized to attach evidence."); if (!args.contentType.startsWith("image/") || args.filename.length > 200) throw new Error("Unsupported image."); const metadata = await ctx.storage.getMetadata(args.storageId); if (!metadata) throw new Error("Uploaded file not found."); if (metadata.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller."); if (metadata.contentType !== args.contentType || !/^image\/(jpeg|png|webp|gif)$/.test(metadata.contentType ?? "")) throw new Error("Only JPEG, PNG, WebP, or GIF images are supported."); await ctx.db.insert("evidence", { issueId: args.issueId, storageId: args.storageId, uploaderId: profile._id, filename: args.filename.trim().slice(0, 200), contentType: metadata.contentType, createdAt: Date.now() }); return args.issueId } })

export const deleteEvidence = mutation({ args: { evidenceId: v.id("evidence") }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); const row = await ctx.db.get(args.evidenceId); if (!row || row.uploaderId !== profile._id) throw new Error("You are not authorized to delete this evidence."); const issue = await ctx.db.get(row.issueId); if (!issue || !canAccessIssue(profile, issue)) throw new Error("You are not authorized to delete this evidence."); await ctx.db.delete(row._id); await ctx.storage.delete(row.storageId); return row._id } })

export const evidence = query({ args: { issueId: v.id("issues") }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); const issue = await ctx.db.get(args.issueId); if (!issue || !canAccessIssue(profile, issue)) throw new Error("Issue not found."); const rows = await ctx.db.query("evidence").withIndex("by_issue", (q) => q.eq("issueId", args.issueId)).order("desc").collect(); return await Promise.all(rows.map(async (row) => ({ ...row, uploaderId: undefined, url: await ctx.storage.getUrl(row.storageId) }))) } })

export const recent = query({ args: { limit: v.optional(v.number()) }, handler: async (ctx, args) => { const limit = Math.min(Math.max(args.limit ?? 20, 1), 100); const issues = await ctx.db.query("issues").withIndex("by_created").order("desc").take(limit); return issues.filter((issue) => issue.isPublic).map(publicIssue) } })
export const summary = query({ args: {}, handler: async (ctx) => { const identity = await ctx.auth.getUserIdentity(); if (!identity) return { total: 0, active: 0, resolved: 0 }; const profile = await requireProfile(ctx); let issues = profile.role === "citizen" ? await ctx.db.query("issues").withIndex("by_reporter", (q) => q.eq("reporterId", profile._id)).collect() : profile.role === "super_admin" ? await ctx.db.query("issues").collect() : await ctx.db.query("issues").withIndex("by_department", (q) => q.eq("departmentId", profile.departmentId)).collect(); return { total: issues.length, active: issues.filter((i) => !["RESOLVED", "VERIFIED_RESOLUTION", "REJECTED"].includes(i.status)).length, resolved: issues.filter((i) => i.status === "VERIFIED_RESOLUTION" || i.status === "RESOLVED").length } } })
async function enrichIssue(ctx: any, issue: any) { const category = await ctx.db.get(issue.categoryId); const department = await ctx.db.get(issue.departmentId); return { ...issue, reporterId: undefined, categoryName: category?.name ?? "Other", departmentName: department?.name ?? "Unassigned" } }

export const myIssues = query({ args: {}, handler: async (ctx) => { const profile = await requireProfile(ctx); const issues = await ctx.db.query("issues").withIndex("by_reporter", (q) => q.eq("reporterId", profile._id)).order("desc").collect(); return await Promise.all(issues.map((issue) => enrichIssue(ctx, issue))) } })
export const departmentIssues = query({ args: {}, handler: async (ctx) => { const profile = await requireProfile(ctx); if (profile.role !== "department_staff" && profile.role !== "department_admin" && profile.role !== "super_admin") throw new Error("You are not authorized to view department issues."); const issues = profile.role === "super_admin" ? await ctx.db.query("issues").withIndex("by_created").order("desc").collect() : await ctx.db.query("issues").withIndex("by_department", (q) => q.eq("departmentId", profile.departmentId)).order("desc").collect(); return issues } })
export const byId = query({ args: { issueId: v.id("issues") }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); const issue = await ctx.db.get(args.issueId); if (!issue || !canAccessIssue(profile, issue)) throw new Error("Issue not found."); const category = await ctx.db.get(issue.categoryId); const department = await ctx.db.get(issue.departmentId); const reporter = profile.role === "citizen" ? null : await ctx.db.get(issue.reporterId); const assignee = issue.assigneeId ? await ctx.db.get(issue.assigneeId) : null; return { ...issue, reporterId: undefined, categoryName: category?.name ?? "Other", departmentName: department?.name ?? "Unassigned", reporter: reporter ? { name: reporter.name, email: reporter.email } : null, assignee: assignee ? { id: assignee._id, name: assignee.name, email: assignee.email } : null, canTransition: profile.role !== "citizen" } } })
export const dashboardAnalytics = query({ args: {}, handler: async (ctx) => {
  const profile = await requireProfile(ctx)
  const issues = profile.role === "citizen" ? await ctx.db.query("issues").withIndex("by_reporter",(q)=>q.eq("reporterId",profile._id)).collect() : profile.role === "super_admin" ? await ctx.db.query("issues").collect() : await ctx.db.query("issues").withIndex("by_department",(q)=>q.eq("departmentId",profile.departmentId)).collect()
  const now=Date.now(), monthStart=now-30*86400000, recent=issues.filter(i=>i.createdAt>=monthStart)
  const categories=await ctx.db.query("categories").collect(), names=new Map(categories.map(x=>[x._id,x.name])); const categoryCounts:Record<string,number>={}
  for(const issue of recent){const name=names.get(issue.categoryId)??"Other";categoryCounts[name]=(categoryCounts[name]??0)+1}
  const daily=Array.from({length:30},(_,index)=>{const start=monthStart+index*86400000;return {label:new Date(start).toLocaleDateString("en-US",{month:"short",day:"numeric"}),count:issues.filter(i=>i.createdAt>=start&&i.createdAt<start+86400000).length}})
  return {total:issues.length,recent:recent.length,active:issues.filter(i=>!["RESOLVED","VERIFIED_RESOLUTION","REJECTED"].includes(i.status)).length,resolved:issues.filter(i=>["RESOLVED","VERIFIED_RESOLUTION"].includes(i.status)).length,daily,categoryCounts}
} })

export const adminOverview = query({ args: {}, handler: async (ctx) => { const profile = await requireProfile(ctx); if (profile.role !== "super_admin") throw new Error("You are not authorized to view administration."); return { users: await ctx.db.query("profiles").collect(), departments: await ctx.db.query("departments").collect(), categories: await ctx.db.query("categories").collect() } } })
export const departmentStaff = query({ args: {}, handler: async (ctx) => {
  const profile=await requireProfile(ctx); if(!["department_admin","super_admin"].includes(profile.role)) throw new Error("Not authorized.")
  const rows=profile.role==="super_admin"?await ctx.db.query("profiles").collect():await ctx.db.query("profiles").withIndex("by_department",(q)=>q.eq("departmentId",profile.departmentId)).collect()
  return rows.filter(p=>["department_staff","department_admin"].includes(p.role)).map(p=>({_id:p._id,name:p.name,email:p.email,role:p.role,departmentId:p.departmentId}))
} })

export const addResolutionEvidence = mutation({ args:{issueId:v.id("issues"),storageId:v.id("_storage"),description:v.string()}, handler:async(ctx,args)=>{
  const profile=await requireProfile(ctx), issue=await ctx.db.get(args.issueId)
  if(!issue||!["department_staff","department_admin","super_admin"].includes(profile.role)) throw new Error("You are not authorized to add resolution evidence.")
  if(profile.role!=="super_admin"&&profile.departmentId!==issue.departmentId) throw new Error("This issue is outside your department.")
  const metadata=await ctx.storage.getMetadata(args.storageId); if(!metadata||!(metadata.contentType??"").startsWith("image/")||metadata.size>10*1024*1024) throw new Error("Resolution evidence must be a JPEG, PNG, WebP, or GIF up to 10 MB.")
  const description=args.description.trim(); if(description.length<3||description.length>500) throw new Error("Add a concise evidence description.")
  return await ctx.db.insert("resolutionEvidence",{issueId:issue._id,storageId:args.storageId,uploadedBy:profile._id,description,createdAt:Date.now()})
} })

export const resolutionEvidence = query({ args:{issueId:v.id("issues")}, handler:async(ctx,args)=>{
  const profile=await requireProfile(ctx), issue=await ctx.db.get(args.issueId); if(!issue||!canAccessIssue(profile,issue)) throw new Error("Issue not found.")
  const rows=await ctx.db.query("resolutionEvidence").withIndex("by_issue",(q)=>q.eq("issueId",args.issueId)).order("desc").collect()
  return await Promise.all(rows.map(async row=>({...row,uploadedBy:undefined,url:await ctx.storage.getUrl(row.storageId)})))
} })

export const aiAnalysis = query({ args:{issueId:v.id("issues")}, handler:async(ctx,args)=>{
  const profile=await requireProfile(ctx), issue=await ctx.db.get(args.issueId); if(!issue||!canAccessIssue(profile,issue)) throw new Error("Issue not found."); return issue.aiAnalysis??null
} })

export const profile = query({ args: {}, handler: async (ctx) => await requireProfile(ctx) })
export const byReference = query({ args: { referenceNumber: v.string() }, handler: async (ctx, args) => { const referenceNumber = args.referenceNumber.trim().toUpperCase(); const issue = await ctx.db.query("issues").withIndex("by_reference", (q) => q.eq("referenceNumber", referenceNumber)).unique(); if (!issue || !issue.isPublic) return null; const category = await ctx.db.get(issue.categoryId); const department = await ctx.db.get(issue.departmentId); const latest = await ctx.db.query("issueStatusHistory").withIndex("by_issue", (q) => q.eq("issueId", issue._id)).order("desc").first(); return { ...publicIssue(issue), categoryName: category?.name ?? "Other", departmentName: department?.name ?? "Unassigned", lastStatusUpdate: latest?.timestamp ?? issue.updatedAt } } })

export const publicSearch = query({ args: { term: v.string() }, handler: async (ctx, args) => { const term = args.term.trim().toLowerCase(); if (term.length < 2) return []; const issues = await ctx.db.query("issues").withIndex("by_created").order("desc").take(200); const results = issues.filter((issue) => issue.isPublic && `${issue.referenceNumber} ${issue.title} ${issue.description} ${issue.address}`.toLowerCase().includes(term)).slice(0, 25); return await Promise.all(results.map(async (issue) => { const category = await ctx.db.get(issue.categoryId); return { ...publicIssue(issue), categoryName: category?.name ?? "Other" } })) } })

export const publicIssues = query({ args: { limit: v.optional(v.number()) }, handler: async (ctx, args) => { const limit = Math.min(Math.max(args.limit ?? 100, 1), 200); const issues = await ctx.db.query("issues").withIndex("by_created").order("desc").take(limit); return issues.filter((issue) => issue.isPublic).map(publicIssue) } })
export const timeline = query({ args: { issueId: v.id("issues") }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); const issue = await ctx.db.get(args.issueId); if (!issue || (!issue.isPublic && !canAccessIssue(profile, issue))) throw new Error("Issue not found."); const history = await ctx.db.query("issueStatusHistory").withIndex("by_issue", (q) => q.eq("issueId", args.issueId)).order("asc").collect(); return await Promise.all(history.map(async (event) => ({ ...event, actor: await ctx.db.get(event.changedBy).then((p) => p ? { name: p.name, role: p.role } : null) }))) } })

export const transition = mutation({ args: { issueId: v.id("issues"), newStatus: v.union(...statuses.map((s) => v.literal(s)) as [any, any, ...any[]]), note: v.optional(v.string()) }, handler: async (ctx, args) => {
  const profile = await requireProfile(ctx); const issue = await ctx.db.get(args.issueId); if (!issue) throw new Error("Issue not found.")
  if (!canAccessIssue(profile, issue)) throw new Error("You are not authorized to update this issue.")
  if (profile.role === "citizen") throw new Error("Citizens cannot change workflow status.")
  if (!transitions[issue.status as Status].includes(args.newStatus as Status) && profile.role !== "super_admin") throw new Error("Invalid status transition.")
  if ((profile.role === "department_staff" || profile.role === "department_admin") && profile.departmentId !== issue.departmentId) throw new Error("You are not authorized for this department.")
  const now = Date.now(); await ctx.db.patch(issue._id, { status: args.newStatus, updatedAt: now, resolvedAt: args.newStatus === "RESOLVED" || args.newStatus === "VERIFIED_RESOLUTION" ? now : undefined });   await ctx.db.insert("issueStatusHistory", { issueId: issue._id, previousStatus: issue.status, newStatus: args.newStatus, changedBy: profile._id, timestamp: now, note: args.note }); await audit(ctx, profile._id, "STATUS_CHANGED", "issue", issue._id, JSON.stringify({ from: issue.status, to: args.newStatus }));
  const followers = await ctx.db.query("issueFollowers").withIndex("by_issue", (q: any) => q.eq("issueId", issue._id)).collect(); const recipients = new Set([issue.reporterId, ...followers.map((f: any) => f.userId)]); for (const recipientId of recipients) if (recipientId !== profile._id) await notify(ctx, recipientId, "STATUS_CHANGED", "Issue status updated", `${issue.referenceNumber} is now ${args.newStatus.replaceAll("_", " ").toLowerCase()}.`, issue._id)
  return issue._id
} })

export const assignIssue = mutation({ args: { issueId: v.id("issues"), assigneeId: v.optional(v.id("profiles")), note: v.optional(v.string()) }, handler: async (ctx, args) => { const actor = await requireProfile(ctx); const issue = await ctx.db.get(args.issueId); if (!issue || !["super_admin", "department_admin"].includes(actor.role) || (actor.role === "department_admin" && actor.departmentId !== issue.departmentId)) throw new Error("You are not authorized to assign this issue."); const assignee = args.assigneeId ? await ctx.db.get(args.assigneeId) : null; if (assignee && (assignee.role !== "department_staff" && assignee.role !== "department_admin" || assignee.departmentId !== issue.departmentId)) throw new Error("Assignee must belong to the issue department."); const now = Date.now(); await ctx.db.patch(issue._id, { assigneeId: args.assigneeId, updatedAt: now }); await ctx.db.insert("assignmentHistory", { issueId: issue._id, assigneeId: args.assigneeId, changedBy: actor._id, createdAt: now, note: args.note?.trim() }); await audit(ctx, actor._id, "ISSUE_ASSIGNED", "issue", issue._id, JSON.stringify({ assigneeId: args.assigneeId })); return issue._id } })

export const departmentAnalytics = query({ args: {}, handler: async (ctx) => { const profile = await requireProfile(ctx); if (!["department_staff", "department_admin", "super_admin"].includes(profile.role)) throw new Error("Not authorized."); const issues = profile.role === "super_admin" ? await ctx.db.query("issues").collect() : await ctx.db.query("issues").withIndex("by_department", (q: any) => q.eq("departmentId", profile.departmentId)).collect(); const now = Date.now(); const resolved = issues.filter((i: any) => i.resolvedAt); return { total: issues.length, open: issues.filter((i: any) => !["RESOLVED", "VERIFIED_RESOLUTION", "REJECTED"].includes(i.status)).length, resolved: resolved.length, overdue: issues.filter((i: any) => i.dueAt && i.dueAt < now && !["RESOLVED", "VERIFIED_RESOLUTION", "REJECTED"].includes(i.status)).length, byStatus: Object.fromEntries(statuses.map((status) => [status, issues.filter((i: any) => i.status === status).length])), byPriority: Object.fromEntries(["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((level) => [level, issues.filter((i: any) => i.priority === level).length])), averageResolutionHours: resolved.length ? Math.round(resolved.reduce((sum: number, i: any) => sum + ((i.resolvedAt - i.createdAt) / 3600000), 0) / resolved.length) : 0 } } })

export const publicMap = query({ args: { status: v.optional(v.string()), category: v.optional(v.string()) }, handler: async (ctx, args) => { const issues = await ctx.db.query("issues").withIndex("by_created").order("desc").take(500); const categories = await ctx.db.query("categories").collect(); const names = new Map(categories.map((c) => [c._id, c.name])); return issues.filter((i) => i.isPublic && (!args.status || i.status === args.status) && (!args.category || names.get(i.categoryId) === args.category)).map((i) => ({ ...publicIssue(i), categoryName: names.get(i.categoryId) ?? "Other" })) } })

export const verifyResolution = mutation({ args: { issueId: v.id("issues"), accepted: v.boolean(), comment: v.optional(v.string()) }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); const issue = await ctx.db.get(args.issueId); if (!issue || issue.status !== "COMMUNITY_VERIFICATION" || !issue.isPublic) throw new Error("This issue is not awaiting community verification."); const existing = await ctx.db.query("resolutionVerifications").withIndex("by_user_issue", (q: any) => q.eq("userId", profile._id).eq("issueId", issue._id)).unique(); if (existing) throw new Error("You have already submitted verification."); await ctx.db.insert("resolutionVerifications", { issueId: issue._id, userId: profile._id, accepted: args.accepted, comment: args.comment?.trim().slice(0, 1000), createdAt: Date.now() }); const nextStatus = args.accepted ? "VERIFIED_RESOLUTION" : "REOPENED"; await ctx.db.patch(issue._id, { status: nextStatus, updatedAt: Date.now(), resolvedAt: args.accepted ? issue.resolvedAt : undefined }); await ctx.db.insert("issueStatusHistory", { issueId: issue._id, previousStatus: issue.status, newStatus: nextStatus, changedBy: profile._id, timestamp: Date.now(), note: args.comment?.trim() || (args.accepted ? "Community verified resolution" : "Community rejected resolution") }); return nextStatus } })

export const slaStatus = query({ args: { issueId: v.id("issues") }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); const issue = await ctx.db.get(args.issueId); if (!issue || !canAccessIssue(profile, issue)) throw new Error("Issue not found."); const terminal = ["VERIFIED_RESOLUTION", "REJECTED"].includes(issue.status); const remainingMs = issue.dueAt ? issue.dueAt - Date.now() : null; return { dueAt: issue.dueAt ?? null, remainingMs, status: terminal ? "COMPLETE" : remainingMs === null ? "UNSCHEDULED" : remainingMs < 0 ? "OVERDUE" : remainingMs < 24 * 3600000 ? "DUE_SOON" : "ON_TRACK" } } })

export const moderationReports = query({ args: {}, handler: async (ctx) => { const profile = await requireProfile(ctx); if (!["super_admin", "department_admin"].includes(profile.role)) throw new Error("You are not authorized to moderate reports."); const reports = await ctx.db.query("abuseReports").withIndex("by_status", (q: any) => q.eq("status", "OPEN")).order("desc").collect(); return await Promise.all(reports.map(async (report: any) => { const issue: any = report.issueId ? await ctx.db.get(report.issueId) : null; return { ...report, reporterId: undefined, issue: issue ? { _id: issue._id, referenceNumber: issue.referenceNumber, title: issue.title, status: issue.status, isPublic: issue.isPublic } : null } })) } })

export const reviewModerationReport = mutation({ args: { reportId: v.id("abuseReports"), action: v.union(v.literal("DISMISS"), v.literal("HIDE_ISSUE"), v.literal("REOPEN_REPORT")), note: v.optional(v.string()) }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); if (!["super_admin", "department_admin"].includes(profile.role)) throw new Error("You are not authorized to moderate reports."); const report = await ctx.db.get(args.reportId); if (!report || report.status !== "OPEN") throw new Error("This report is already reviewed."); const issue = report.issueId ? await ctx.db.get(report.issueId) : null; if (profile.role === "department_admin" && issue && issue.departmentId !== profile.departmentId) throw new Error("This report is outside your department."); const now = Date.now(); await ctx.db.patch(report._id, { status: args.action === "REOPEN_REPORT" ? "OPEN" : "REVIEWED", reviewedBy: profile._id, reviewedAt: now, reviewNote: args.note?.trim().slice(0, 500) }); if (args.action === "HIDE_ISSUE" && issue) await ctx.db.patch(issue._id, { isPublic: false, updatedAt: now }); await ctx.db.insert("moderationActions", { reportId: report._id, moderatorId: profile._id, action: args.action, note: args.note?.trim().slice(0, 500), createdAt: now }); await audit(ctx, profile._id, `MODERATION_${args.action}`, "abuseReport", report._id, args.note); return report._id } })

export const reportAbuse = mutation({ args: { issueId: v.optional(v.id("issues")), reason: v.string() }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); await enforceLimit(ctx, profile._id, "abuse_report", 5, 60 * 60_000); const reason = args.reason.trim(); if (reason.length < 5 || reason.length > 500) throw new Error("Add a concise abuse report."); const recent = await ctx.db.query("abuseReports").withIndex("by_status", (q: any) => q.eq("status", "OPEN")).collect(); if (recent.some((r: any) => r.reporterId === profile._id && r.issueId === args.issueId && Date.now() - r.createdAt < 86400000)) throw new Error("You already reported this recently."); return await ctx.db.insert("abuseReports", { issueId: args.issueId, reporterId: profile._id, reason, createdAt: Date.now(), status: "OPEN" }) } })

export const assignRole = mutation({
  args: {
    profileId: v.id("profiles"),
    role: v.union(v.literal("citizen"), v.literal("department_staff"), v.literal("department_admin"), v.literal("super_admin")),
    departmentId: v.optional(v.id("departments")),
  },
  handler: async (ctx, args) => {
    const actor = await requireProfile(ctx)
    if (actor.role !== "super_admin") throw new Error("Only super admins can assign roles.")
    const target = await ctx.db.get(args.profileId)
    if (!target) throw new Error("User not found.")
    const now = Date.now()
    await ctx.db.patch(target._id, { role: args.role, departmentId: args.departmentId, updatedAt: now })
    await audit(ctx, actor._id, "ROLE_CHANGED", "profile", target._id, JSON.stringify({ role: args.role, departmentId: args.departmentId }))
    return target._id
  },
})

export const departments = query({ args: {}, handler: async (ctx) => await ctx.db.query("departments").collect() })
export const categories = query({ args: {}, handler: async (ctx) => await ctx.db.query("categories").collect() })

async function accessibleIssue(ctx: any, profile: any, issueId: any) {
  const issue = await ctx.db.get(issueId)
  if (!issue || (!issue.isPublic && !canAccessIssue(profile, issue))) throw new Error("Issue not found.")
  return issue
}

async function notify(ctx: any, recipientId: any, type: string, title: string, message: string, issueId?: any) {
  const recent = await ctx.db.query("notifications").withIndex("by_recipient", (q: any) => q.eq("recipientId", recipientId)).order("desc").take(20)
  if (recent.some((n: any) => n.type === type && n.issueId === issueId && n.message === message && Date.now() - n.createdAt < 60000)) return
  await ctx.db.insert("notifications", { recipientId, type, issueId, title, message, isRead: false, createdAt: Date.now() })
}

export const comments = query({ args: { issueId: v.id("issues") }, handler: async (ctx, args) => {
  const profile = await requireProfile(ctx); await accessibleIssue(ctx, profile, args.issueId)
  const rows = await ctx.db.query("comments").withIndex("by_issue", (q) => q.eq("issueId", args.issueId)).order("desc").collect()
  return await Promise.all(rows.map(async (row) => { const author = await ctx.db.get(row.authorId); return { ...row, authorId: undefined, authorName: author?.name ?? "CivicFix resident" } }))
} })

export const addComment = mutation({ args: { issueId: v.id("issues"), body: v.string() }, handler: async (ctx, args) => {
  const profile = await requireProfile(ctx); await enforceLimit(ctx, profile._id, "comment", 20); const issue = await accessibleIssue(ctx, profile, args.issueId); const body = args.body.trim()
  if (body.length < 2 || body.length > 1000) throw new Error("Comments must be between 2 and 1000 characters.")
  const now = Date.now(); const id = await ctx.db.insert("comments", { issueId: issue._id, authorId: profile._id, body, createdAt: now }); await ctx.db.patch(issue._id, { commentCount: issue.commentCount + 1, updatedAt: now })
  if (issue.reporterId !== profile._id) await notify(ctx, issue.reporterId, "COMMENT", "New comment on your issue", `${profile.name} commented on ${issue.referenceNumber}.`, issue._id)
  const followers = await ctx.db.query("issueFollowers").withIndex("by_issue", (q: any) => q.eq("issueId", issue._id)).collect(); for (const follower of followers) if (follower.userId !== profile._id && follower.userId !== issue.reporterId) await notify(ctx, follower.userId, "COMMENT", "New comment on a followed issue", `${profile.name} commented on ${issue.referenceNumber}.`, issue._id)
  return id
} })

export const support = query({ args: { issueId: v.id("issues") }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); const issue = await accessibleIssue(ctx, profile, args.issueId); const vote = await ctx.db.query("issueVotes").withIndex("by_user_issue", (q) => q.eq("userId", profile._id).eq("issueId", issue._id)).unique(); return { count: issue.supportCount, supported: Boolean(vote) } } })
export const toggleSupport = mutation({ args: { issueId: v.id("issues") }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); await enforceLimit(ctx, profile._id, "support", 30); const issue = await accessibleIssue(ctx, profile, args.issueId); const existing = await ctx.db.query("issueVotes").withIndex("by_user_issue", (q) => q.eq("userId", profile._id).eq("issueId", issue._id)).unique(); const count = Math.max(0, issue.supportCount + (existing ? -1 : 1)); if (existing) await ctx.db.delete(existing._id); else await ctx.db.insert("issueVotes", { issueId: issue._id, userId: profile._id, createdAt: Date.now() }); await ctx.db.patch(issue._id, { supportCount: count, updatedAt: Date.now() }); return { supported: !existing, count } } })

export const following = query({ args: { issueId: v.id("issues") }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); await accessibleIssue(ctx, profile, args.issueId); return Boolean(await ctx.db.query("issueFollowers").withIndex("by_user_issue", (q) => q.eq("userId", profile._id).eq("issueId", args.issueId)).unique()) } })
export const toggleFollowing = mutation({ args: { issueId: v.id("issues") }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); const issue = await accessibleIssue(ctx, profile, args.issueId); const existing = await ctx.db.query("issueFollowers").withIndex("by_user_issue", (q) => q.eq("userId", profile._id).eq("issueId", issue._id)).unique(); if (existing) await ctx.db.delete(existing._id); else await ctx.db.insert("issueFollowers", { issueId: issue._id, userId: profile._id, createdAt: Date.now() }); return !existing } })

export const notifications = query({ args: {}, handler: async (ctx) => { const profile = await requireProfile(ctx); return await ctx.db.query("notifications").withIndex("by_recipient", (q) => q.eq("recipientId", profile._id)).order("desc").take(50) } })
export const markNotificationRead = mutation({ args: { notificationId: v.id("notifications") }, handler: async (ctx, args) => { const profile = await requireProfile(ctx); const notification = await ctx.db.get(args.notificationId); if (!notification || notification.recipientId !== profile._id) throw new Error("Notification not found."); await ctx.db.patch(notification._id, { isRead: true }); return notification._id } })
export const markAllNotificationsRead = mutation({ args: {}, handler: async (ctx) => { const profile = await requireProfile(ctx); const rows = await ctx.db.query("notifications").withIndex("by_recipient_unread", (q) => q.eq("recipientId", profile._id).eq("isRead", false)).collect(); for (const row of rows) await ctx.db.patch(row._id, { isRead: true }); return rows.length } })
