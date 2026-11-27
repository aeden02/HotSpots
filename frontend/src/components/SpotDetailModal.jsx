import { useEffect, useRef, useState } from 'react' 
import { Link, useNavigate, useParams } from 'react-router'
import { bookmarkSpot, getSpot, unbookmarkSpot } from '../api/API'
import { tagLabel } from '../utils/tags'

export default function SpotDetailModal({ user, setUser }){
    const { spotId } = useParams()
    const navigate = useNavigate()
    const dialogRef = useRef(null)
    const [spot, setSpot] = useState(null)
    const [status, setStatus] = useState('loading') // loading, ready, error, notfound
    const [reloadKey, setReloadKey] = useState(0)
    const [bookmarkError, setBookmarkError] = useState('')

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
        navigate('..')
    }

    function retry(){
        setStatus('loading')
        setReloadKey((key) => key + 1)
    }

    //is this spot already in signed in users bookmarks?
    const saved = spot && user?.bookmarks?.includes(spot.id)

    //save and update so every page sees bookmark.
    async function handleBookmark() {
        setBookmarkError('')
        try{
            if(saved){
                //already bookmarked - remove it and take out of list
                await unbookmarkSpot(spot.id)
                setUser({ ...user, bookmarks: user.bookmarks.filter((id) => id !== spot.id) })
            }else{
                await bookmarkSpot(spot.id)
                setUser({ ...user, bookmarks: [...(user.bookmarks ?? []), spot.id ] })
            }
        } catch (err){
            console.error('Bookmark failed: ', err) 
            setBookmarkError(
                err.response?.status === 401
                    ? 'Your session expired. Please sign in again to bookmark.'
                    : err.response?.data?.error ?? "Couldn't save this bookmark. Please try again."
            )
        }
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
                        <Link to="..">Back to spots</Link>
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
                        <div className="flex items-start justify-between gap-3">
                            <h2>{spot.title}</h2>
                            {user && (
                                <button 
                                    type="button"
                                    onClick={handleBookmark}
                                    aria-pressed={!!saved}
                                    aria-label={saved ? 'Remove Bookmark' : 'Bookmark this spot'}
                                    title={saved ? 'Remove Bookmark' : 'Bookmark this spot'}
                                    className="mr-8 shrink-0 rounded-full bg-transparent p-2 text-primary hover:bg-primary-tint"
                                >
                                    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"
                                        fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"
                                        strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z" />
                                    </svg>   
                                </button>
                            )}
                        </div>
                        {bookmarkError && <p className="form-error">{bookmarkError}</p>}
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
                                    <li key={tag}>{tagLabel(tag)}</li>
                                ))}
                            </ul>
                        )}

                       
                    </article>
                )}
            </div>            
        </dialog>
    )
}