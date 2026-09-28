import { describe, expect, it } from 'vitest'
import { canAccessIssue, canAssign, canModerate, canOperateDepartment, canReadNotification, canTransition, canVerifyCommunityResolution } from './authorization'

const citizen = { id: 'citizen-1', role: 'citizen' as const }
const staff = { id: 'staff-1', role: 'department_staff' as const, departmentId: 'roads' }
const admin = { id: 'admin-1', role: 'department_admin' as const, departmentId: 'roads' }
const superAdmin = { id: 'root-1', role: 'super_admin' as const }
const ownPrivate = { reporterId: 'citizen-1', departmentId: 'roads', isPublic: false }
const otherPrivate = { reporterId: 'citizen-2', departmentId: 'roads', isPublic: false }
const publicRoad = { reporterId: 'citizen-2', departmentId: 'roads', isPublic: true }

 describe('CivicFix authorization policies', () => {
  it('enforces citizen ownership while allowing public issues', () => {
    expect(canAccessIssue(citizen, ownPrivate)).toBe(true)
    expect(canAccessIssue(citizen, otherPrivate)).toBe(false)
    expect(canAccessIssue(citizen, publicRoad)).toBe(true)
  })

  it('isolates department staff and admins', () => {
    expect(canAccessIssue(staff, publicRoad)).toBe(true)
    expect(canAccessIssue(staff, { ...publicRoad, departmentId: 'water' })).toBe(true)
    expect(canOperateDepartment(staff, 'roads')).toBe(true)
    expect(canOperateDepartment(staff, 'water')).toBe(false)
    expect(canOperateDepartment(admin, 'roads')).toBe(true)
    expect(canOperateDepartment(admin, 'water')).toBe(false)
  })

  it('gives super admins global access without department assignment', () => {
    expect(canAccessIssue(superAdmin, otherPrivate)).toBe(true)
    expect(canOperateDepartment(superAdmin, 'water')).toBe(true)
    expect(canModerate(superAdmin)).toBe(true)
  })

  it('restricts assignment to department admins and super admins', () => {
    expect(canAssign(admin, 'roads')).toBe(true)
    expect(canAssign(admin, 'water')).toBe(false)
    expect(canAssign(staff, 'roads')).toBe(false)
    expect(canAssign(superAdmin, 'water')).toBe(true)
  })

  it('restricts status transitions by role and department', () => {
    expect(canTransition(staff, publicRoad, 'IN_PROGRESS')).toBe(true)
    expect(canTransition(staff, publicRoad, 'REOPENED')).toBe(false)
    expect(canTransition(staff, { ...publicRoad, departmentId: 'water' }, 'IN_PROGRESS')).toBe(false)
    expect(canTransition(admin, publicRoad, 'REOPENED')).toBe(true)
    expect(canTransition(citizen, publicRoad, 'RESOLVED')).toBe(false)
  })

  it('protects notifications and community verification', () => {
    expect(canReadNotification('citizen-1', 'citizen-1')).toBe(true)
    expect(canReadNotification('citizen-1', 'citizen-2')).toBe(false)
    expect(canVerifyCommunityResolution(citizen, { ...publicRoad, status: 'COMMUNITY_VERIFICATION' })).toBe(true)
    expect(canVerifyCommunityResolution(staff, { ...publicRoad, status: 'COMMUNITY_VERIFICATION' })).toBe(false)
    expect(canVerifyCommunityResolution(citizen, { ...publicRoad, status: 'RESOLVED' })).toBe(false)
  })

  it('restricts moderation to authorized roles', () => {
    expect(canModerate(citizen)).toBe(false)
    expect(canModerate(staff)).toBe(false)
    expect(canModerate(admin)).toBe(true)
    expect(canModerate(superAdmin)).toBe(true)
  })
})
