import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { getCities } from '../api/API'

export default function HomePage({ user }) {
  const [searchParams] = useSearchParams()
  const [cities, setCities] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
  const [selected, setSelected] = useState('')
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

  function handleSubmit(event) {
    event.preventDefault()
    if (selected) navigate(`/cities/${encodeURIComponent(selected)}`)
  }

  //signed-in users go straight to city's listings. if click "Change city", show menu. 
  if (user && !searchParams.has('pick')) {
    return <Navigate to={`/cities/${encodeURIComponent(user.city)}`} replace />
  }

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
    <section className="home">
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
    </section>
  )
}