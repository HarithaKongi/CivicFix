import { describe, expect, it } from 'vitest'
import { calculateDueAt, calculatePriority } from './issue-operations'

describe('issue operations', () => {
  it('raises safety emergencies to critical', () => {
    const result = calculatePriority('Broken wire', 'Urgent live wire near school', 'Electrical', 5)
    expect(result.priority).toBe('CRITICAL')
    expect(result.score).toBeGreaterThanOrEqual(75)
  })

  it('uses supporter signals without exceeding the score cap', () => {
    const result = calculatePriority('Pothole', 'Road damage', 'Roads', 100)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.priority).toBe('MEDIUM')
  })

  it('shortens critical SLAs', () => {
    expect(calculateDueAt(0, 72, 'CRITICAL')).toBe(36 * 60 * 60 * 1000)
    expect(calculateDueAt(0, 72, 'LOW')).toBe(72 * 60 * 60 * 1000)
  })
})
