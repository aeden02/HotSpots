import { useState } from 'react'
import { Link, Outlet, useParams } from 'react-router'
import { buildItinerary, getSpotsByCity } from '../api/API'
import { buildRulePlan, toMinutes } from '../utils/planner'
import { TAGS, tagLabel } from '../utils/tags'
import SpotImage from '../components/SpotImage'

const inputClass = 'h-11 rounded-lg border border-border bg-white px-3 font-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'

//keep lodging out of planner
const PLAN_TAGS = TAGS.filter(({ tag }) => tag !== 'lodging')

//uses CA instead of US because date input only accepts dates as YYYY-MM-DD
function today(){
    return new Date().toLocaleDateString('en-CA')
}

export default function PlannerPage() {
    const { city } = useParams()
    const [date, setDate] = useState(today())
    const [start, setStart] = useState('09:00')
    const [end, setEnd] = useState('17:00')
    const [interests, setInterests] = useState([])
    const [stops, setStops] = useState(null) // null = no plan built yet 
    const [note, setNote] = useState('')
    const [error, setError] = useState('')
    const [building, setBuilding] = useState(false)

    function toggleInterest(tag){
        setInterests((current) =>
        current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag])
    }

    //ask the AI first; if fail/slow, build rule-based plan & tell user so. 
    async function handleSubmit(event){
        event.preventDefault()
        setError('')
        setNote('')
        if (toMinutes(end) - toMinutes(start) < 180) {
            setError('Pick a time window of 3 hours.')          //minute change to 2 hours. 
            return
        }
        setBuilding(true)
        try{
            const plan = await buildItinerary({ city, date, start, end, interests })
            setStops(plan.stops)
        } catch (err) {
            console.error('AI planner failed, using rule-based plan: ', err)
            try{
                const spots = await getSpotsByCity(city)
                setStops(buildRulePlan(spots, { start, end, interests }))
                setNote('The AI planner is unavailable, so this is a simpler plan based on your interests ')
            } catch {
                setError("Couldn't build a plan. Please try again.")
            }
        } finally {
            setBuilding(false)
        }
    }

    return (
        <section>
            <div className="mb-8">
                <Link to={`/cities/${encodeURIComponent(city)}`} className="back-link text-sm">Back to spots</Link>
                <h1 className="mt-1 text-4xl font-bold tracking-tight">Plan a day in {city}</h1>
                <p className="mt-2 text-text-muted">Pick a date, your free hours, and what you're into.</p>
            </div>

            <form onSubmit={handleSubmit} className="mb-8 rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5">
                <div className="grid gap-4 sm:grid-cols-3">
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            Date
                            <input type="date" value={date} min={today()} required
                                onChange={(e) => setDate(e.target.value)} className={inputClass} />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            Start time
                            <input type="time" value={start} required
                                onChange={(e) => setStart(e.target.value)} className={inputClass} />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                            End time
                            <input type="time" value={end} required
                                onChange={(e) => setEnd(e.target.value)} className={inputClass} />
                        </label>
                    </div>

                              <p className="mt-6 mb-2 text-sm font-medium">Interests</p>
                <div className="mb-6 flex flex-wrap gap-2">
                    {PLAN_TAGS.map(({ tag, label }) => {
                        const on = interests.includes(tag)
                        return (
                            <button
                                key={tag}
                                type="button"
                                onClick={() => toggleInterest(tag)}
                                aria-pressed={on}
                                className={on
                                    ? 'rounded-full px-3 py-1 text-sm'
                                    : 'rounded-full bg-white px-3 py-1 text-sm text-text ring-1 ring-border hover:bg-primary-tint'}
                            >
                                {label}
                            </button>
                        )
                    })}

                </div>
                 {error && <p className="form-error">{error}</p>}
                <button type="submit" disabled={building}>{building ? 'Building your day...' : 'Build my day'}</button>
            </form>
            
             {note && <p className="form-error">{note}</p>}

            {stops && (stops.length === 0 ? (
                <p className="status">No spots match those interests yet. Try picking different ones.</p>
            ) : (
                <ol className="space-y-4">
                    {stops.map((stop) => (
                        <li key={stop.spot.id} className="flex gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                            <span className="w-40 shrink-0 font-semibold text-primary">
                                {stop.time}{stop.endTime && ` – ${stop.endTime}`}
                            </span>
                            <SpotImage spot={stop.spot} className="h-20 w-20 shrink-0 rounded-lg" />
                            <div>
                                <Link to={`spots/${stop.spot.id}`} className="text-lg font-semibold">
                                    {stop.spot.title}
                                </Link>
                                {stop.spot.tags?.length > 0 && (
                                    <span className="ml-2 inline-block rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-medium text-primary">
                                        {tagLabel(stop.spot.tags[0])}
                                    </span>
                                )}
                                <p className="mt-1 text-sm text-text-muted">{stop.reason}</p>
                                {stop.spot.address && <p className="text-sm text-text-muted">{stop.spot.address}</p>}
                            </div>
                        </li>
                    ))}
                </ol>
            ))}
            <Outlet />
        </section>
    )
}

