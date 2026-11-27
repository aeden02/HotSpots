import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { getCities, getSpotsByCity } from '../api/API'
import SpotsMap from '../components/SpotsMap'
import SpotImage from '../components/SpotImage'
import { tagLabel } from '../utils/tags'

export default function HomePage() {
  const [cities, setCities] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [selected, setSelected] = useState('')
  const [spots, setSpots] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    getCities()
      .then((data) => {
        setCities(data)
        setSelected(data[0]?.name ?? '')
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

  //load citys spots for map and list
  useEffect(() => {
    if (!selected) return
    let ignore = false
    getSpotsByCity(selected).then((data) => { if (!ignore) setSpots(data) })
                            .catch(() => { if (!ignore) setSpots([]) })
    return () => { ignore = true }
  }, [selected])

  function handleSubmit(event) {
    event.preventDefault()
    if (selected) navigate(`/cities/${encodeURIComponent(selected)}`)
  }

  // //signed-in users go straight to city's listings. if click "Change city", show menu. 
  // if (user && !searchParams.has('pick')) {
  //   return <Navigate to={`/cities/${encodeURIComponent(user.city)}`} replace />
  // }

  if (status === 'loading') {
    return <p className="status">Loading cities…</p>
  }
  if (status === 'error') {
    return <p className="status error">Couldn't load cities. Please refresh to try again.</p>
  }
  if (cities.length === 0) {
    return <p className="status">No cities available yet.</p>
  }

  return (
    <section className="home flex-col gap-8">
      <div className="city-card">
        <h1>Find the spots locals love</h1>
        <p>Pick a city to start exploring.</p>

        <form onSubmit={handleSubmit} className="city-form">
         
          <label htmlFor="city">City</label>

          <select id="city" value={selected} onChange={(e) => setSelected(e.target.value)}>
            {cities.map((city) => (
              <option key={city._id} value={city.name}>{city.name}</option>
            ))}
         </select>
        
         <button type="submit">Explore</button>

       </form>
      </div>

      <div className="grid w-full gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SpotsMap spots={spots} />
        </div>

        <ul className="h-96 space-y-3 overflow-y-auto pr-1">
          {spots.length === 0 && <li className="status">No spots in this city yet.</li>}
          {spots.map((spot) => (
            <li key={spot.id}>
              <Link to={`/cities/${encodeURIComponent(spot.city)}/spots/${spot.id}`}
                className="flex items-center gap-3 rounded-xl bg-white p-3 text-inherit no-underline shadow-sm ring-1 ring-black/5 hover:bg-primary-tint"
              >
                <SpotImage spot={spot} className="h-14 w-14 shrink-0 rounded-lg" />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{spot.title}</p>
                  {spot.tags?.length > 0 && <p className="text-sm text-text-muted">{tagLabel(spot.tags[0])}</p>}
                </div>
              </Link>            
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}