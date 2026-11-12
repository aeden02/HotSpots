import { useEffect, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router'
import { getSpots } from '../api/spots'
import { cityName } from '../utils/categories'
import SpotCard from '../components/SpotCard'


export default function SpotListPage() {
   const { cityId } = useParams()
   const [spots, setSpots] = useState([])
   const [status, setStatus] = useState('loading') // loading, ready, error 
   const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
        let ignore = false 
        getSpots(cityId)
            .then((data)=> {
                if(!ignore){
                    setSpots(data)
                    setStatus('ready')
                }
            })
            .catch((error)=>{
                console.error('Failed to load spots: ', error)
                if (!ignore) setStatus('error')
            })
        return () => { ignore = true }  }, [cityId, reloadKey])

        function retry(){
            setStatus('loading')
            setReloadKey((key)=> key + 1)
        }

        if (status === 'loading'){
            return <p className="status">Loading spots…</p>
        }

        if(status === 'error'){
            return(
                <div className="status error">
                    <p>Couldn't load spots.</p>
                    <button onClick={retry}>Try again</button>
                </div>
            )
        }

        return (
            <section>
                <Link to="/" className="back-link">Change city</Link>
                <h1>Spots in {cityName(cityId)}</h1>
                
                {spots.length === 0 ? (
                    <p className="status">No spots in this city yet.</p>
                ) : (
                    <div className="spot-grid">
                        {spots.map((spot)=> (
                            <SpotCard key={spot._id} spot={spot} />
                    ))}
                    </div>
                )}

                <Outlet />
                </section>
          
        )
}