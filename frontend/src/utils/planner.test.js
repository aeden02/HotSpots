import { test, expect } from 'vitest'
import { buildRulePlan, toMinutes, formatTime } from './planner'

//fake spots for testing. two history, two food, two outdoors, one art, one hotel. 
const spots = [
    { id: 'museum', title: 'History Museum', tags: ['history'] },
    { id: 'fort', title: 'Old Fort', tags: ['history'] },
    { id: 'cafe', title: 'Corner Cafe', tags: ['food-and-drink'] },
    { id: 'diner', title: 'Main Street Diner', tags: ['food-and-drink'] },
    { id: 'park', title: 'River Park', tags: ['outdoors'] },
    { id: 'hotel', title: 'Downtown Hotel', tags: ['lodging'] },
    { id: 'trail', title: 'Lake Trail', tags: ['outdoors'] },
    { id: 'gallery', title: 'Art Gallery', tags: ['arts-and-culture'] },
]

test('converts times to minutes and back', () => {
    expect(toMinutes('09:30')).toBe(570)
    expect(formatTime(570)).toBe('9:30 AM')
    expect(formatTime(905)).toBe('3:05 PM')
    expect(formatTime(720)).toBe('12:00 PM') // noon
    expect(formatTime(0)).toBe('12:00 AM')   // midnight
})

test('a 9 to 5 day has 6 stops with 20 minutes to travel between them', () => {
    const plan = buildRulePlan(spots, { start: '09:00', end: '17:00', interests: [] })
    expect(plan).toHaveLength(6)
    expect(plan[0].time).toBe('9:00 AM')
    expect(plan[0].endTime).toBe('10:00 AM')
    expect(plan[1].time).toBe('10:20 AM') // 20 minutes after the first stop ends
})

test('a 3 hour window has the minimum of 3 stops', () => {
    const plan = buildRulePlan(spots, { start: '09:00', end: '12:00', interests: [] })
    expect(plan).toHaveLength(3)
    expect(plan[0].endTime).toBe('9:40 AM')
})

test('takes turns between the picked interests', () => {
    const plan = buildRulePlan(spots, { start: '09:00', end: '17:00', interests: ['history', 'food-and-drink'] })
    expect(plan.slice(0, 4).map((stop) => stop.spot.id)).toEqual(['museum', 'cafe', 'fort', 'diner'])
    expect(plan[0].reason).toBe('Matches your interest in History.')
    expect(plan[1].reason).toBe('Matches your interest in Food & drink.')
})

test('fills the rest of the day when not enough spots match', () => {
    const plan = buildRulePlan(spots, { start: '09:00', end: '12:00', interests: ['arts-and-culture'] })
    expect(plan.map((stop) => stop.spot.id)).toEqual(['gallery', 'museum', 'fort'])
    expect(plan[1].reason).toBe('A local favorite in this city.')
})

test('never puts a hotel in the plan or repeats a spot', () => {
    const plan = buildRulePlan(spots, { start: '09:00', end: '17:00', interests: [] })
    const ids = plan.map((stop) => stop.spot.id)
    expect(ids).not.toContain('hotel')
    expect(new Set(ids).size).toBe(ids.length)
})