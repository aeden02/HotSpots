import { tagLabel } from './tags'

//"9:30" => 570 (turns text into minutes after Midnight)  
export function toMinutes(time){
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
}

// 570 -> "9:30AM" (turns number into 12-hour time, including noon = 12)
export function formatTime(minutes){
    const h = Math.floor(minutes / 60)
    const m = String(minutes % 60).padStart(2, '0')
    const suffix = h >= 12 ? 'PM' : 'AM'
    const hour12 = h % 12 === 0 ? 12 : h % 12
    return `${hour12}:${m} ${suffix}`
}

//travel time constant
const TRAVEL_MINUTES = 20

//Plan used when the AI planner is unavaiable.
//takes turns between the picked interest so the day isn't all one kind of place
export function buildRulePlan(spots, { start, end, interests }) {
    const startMin = toMinutes(start)
    const total = toMinutes(end) - startMin
    const count = Math.min(6, Math.max(3, Math.floor(total / 60))) //3-6 stops, about one per hour
    const slot = Math.floor(total / count)                         // minutes between stops

    const picks = []
    const used = new Set()
    const wanted = interests.length > 0 ? interests : [null] //null = any spot

    let addedThisRound = true
    while (picks.length < count && addedThisRound) {
        addedThisRound = false
        for (const tag of wanted){
            if (picks.length === count) break
            const spot = spots.find((s) => !used.has(s.id) && !s.tags?.includes('lodging') && (tag === null || s.tags?.includes(tag)))
            if (spot) {
                used.add(spot.id)
                picks.push({ spot, tag })
                addedThisRound = true
            }
        }
    }

    //not enough spots match interests, so fill day with other spots
    for (const spot of spots){
        if (picks.length === count) break
        if(!used.has(spot.id) && !spot.tags?.includes('lodging')) {
            used.add(spot.id)
            picks.push({ spot, tag: null })
        }
    }

    return picks.map(({ spot, tag}, i) => {
        const arrive = startMin + i * slot
        const leave = arrive + slot - TRAVEL_MINUTES
        return{
            time: formatTime(arrive),
            endTime: formatTime(leave),
            spot,
            reason: tag ? `Matches your interest in ${tagLabel(tag)}.` : 'A local favorite in this city.', 
        }
   
    })
}