export type CivicRole = 'citizen' | 'department_staff' | 'department_admin' | 'super_admin'

export type PolicyIssue = { reporterId: string; departmentId: string; isPublic: boolean }
export type PolicyProfile = { id: string; role: CivicRole; departmentId?: string }

export function canAccessIssue(profile: PolicyProfile, issue: PolicyIssue) {
  return profile.role === 'super_admin' || issue.isPublic || (profile.role === 'citizen' && issue.reporterId === profile.id) || ((profile.role === 'department_staff' || profile.role === 'department_admin') && profile.departmentId === issue.departmentId)
}

export function canOperateDepartment(profile: PolicyProfile, departmentId: string) {
  return profile.role === 'super_admin' || ((profile.role === 'department_staff' || profile.role === 'department_admin') && profile.departmentId === departmentId)
}

export function canAssign(profile: PolicyProfile, departmentId: string) {
  return profile.role === 'super_admin' || (profile.role === 'department_admin' && profile.departmentId === departmentId)
}

export function canModerate(profile: PolicyProfile) {
  return profile.role === 'super_admin' || profile.role === 'department_admin'
}

export function canReadNotification(profileId: string, notificationUserId: string) {
  return profileId === notificationUserId
}

export function canVerifyCommunityResolution(profile: PolicyProfile, issue: PolicyIssue & { status: string }) {
  return profile.role === 'citizen' && issue.isPublic && issue.status === 'COMMUNITY_VERIFICATION'
}

export function canTransition(profile: PolicyProfile, issue: PolicyIssue, nextStatus: string) {
  if (!canOperateDepartment(profile, issue.departmentId)) return false
  if (profile.role === 'department_staff') return ['UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED'].includes(nextStatus)
  return true
}
