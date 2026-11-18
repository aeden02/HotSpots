import { useEffect, useRef, useState } from 'react' 
import { Link, useNavigate, useParams } from 'react-router'
import { getSpot } from '../api/API'
import { categoryLabel } from '../utils/categories'

export default function SpotDetailModal(){
    const { city, spotId } = useParams()
    const cityPath = `/cities/${encodeURIComponent(city)}`
    const navigate = useNavigate()
    const dialogRef = useRef(null)
    const [spot, setSpot] = useState(null)
    const [status, setStatus] = useState('loading') // loading, ready, error, notfound
    const [reloadKey, setReloadKey] = useState(0)

    //open modal when component first appears
    useEffect(()=>{
        const dialog = dialogRef.current
        if(!dialog.open) dialog.showModal()
        }, [])

    //load spot when spot id changes or user retries. 
    useEffect(() => {
        let ignore = false
        getSpot(spotId)
            .then((data) => {
                if(!ignore){
                    setSpot(data)
                    setStatus('ready')
                }
    })
    .catch((error) => {
        console.error('Failed to load spot: ', error)
        if(!ignore) setStatus(error.response?.status === 404 ? 'notfound' : 'error')
    })
    return () => { ignore = true }}, [spotId, reloadKey])

    function close(){
        navigate(cityPath)
    }

    function retry(){
        setStatus('loading')
        setReloadKey((key) => key + 1)
    }

    //close when clicking outside of modal box 
    function handleBackdropClick(event){
        if (event.target === dialogRef.current) close()
    }

    return(
        <dialog ref={dialogRef} className="modal" onClose={close} onClick={handleBackdropClick}>
            <div className="modal-content">
                <button className="modal-close" onClick={close} aria-label="Close">x</button>

                {status === 'loading' && <p className="status">Loading spot...</p>}

                {status === 'notfound' && (
                    <div className="status">
                        <h2>Spot not found</h2>
                        <p>Sorry, we couldn't find the spot you were looking for.</p>
                        <Link to={cityPath}>Back to spots</Link>
                    </div>
                )}

                {status === 'error' && (
                    <div className="status error">
                        <p>Couldn't load this spot.</p>
                        <button onClick={retry}>Try again</button>
                    </div>
                )}

                {status === 'ready' && (
                    <article>
                        {spot.banner && (
                            <img src={spot.banner} alt={spot.title} className="modal-photo" />

                        )}
                        <span className="badge">{categoryLabel(spot.category)}</span>
                        <h2>{spot.title}</h2>
                        <p>{spot.description}</p>

                        <dl className="spot-facts">
                            <dt>Address</dt>
                            <dd>{spot.address}</dd>
                            {spot.hours && ( 
                                <> <dt>Hours</dt>
                                   <dd>{spot.hours}</dd>
                                </>
                            )}
                        </dl>

                        {spot.tags?.length > 0 && (
                            <ul className="tags">
                                {spot.tags.map((tag) => (
                                    <li key={tag}>{tag}</li>
                                ))}
                            </ul>
                        )}
                    </article>
                )}
            </div>            
        </dialog>
    )
}