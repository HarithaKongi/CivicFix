export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export function calculatePriority(title: string, description: string, category: string, supporters = 0) {
  const text = `${title} ${description}`.toLowerCase()
  const safety = /(fire|danger|injury|crime|gas leak|live wire|flood)/.test(text) ? 45 : 0
  const urgency = /(urgent|emergency|blocked|outage|hazard)/.test(text) ? 20 : 0
  const social = Math.min(supporters * 2, 20)
  const score = Math.min(100, 10 + safety + urgency + social + (category.toLowerCase().includes('safety') ? 15 : 0))
  const priority: PriorityLevel = score >= 75 ? 'CRITICAL' : score >= 55 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'LOW'
  return { score, priority, reason: `${safety ? 'public safety impact; ' : ''}${urgency ? 'urgent language; ' : ''}${social ? `${supporters} supporter signal; ` : ''}`.trim() || 'baseline category and age assessment' }
}

export function calculateDueAt(createdAt: number, slaHours: number, priority: PriorityLevel) {
  const multiplier = priority === 'CRITICAL' ? 0.5 : priority === 'HIGH' ? 0.75 : 1
  return createdAt + Math.max(1, slaHours * multiplier) * 60 * 60 * 1000
}
