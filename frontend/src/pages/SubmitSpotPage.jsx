import { useState } from 'react'
import { Link } from 'react-router'
import { createSpot } from '../api/API'
import MapPicker from '../components/MapPicker'


//const CATEGORIES = ['food', 'attractions', 'outdoors', 'shops']

export default function SubmitSpotPage({ user }){
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
 
    const [address, setAddress] = useState('')
    
    const [location, setLocation] = useState(null)
    const [showMap, setShowMap] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    async function handleSubmit(event){
        event.preventDefault()
        setSuccess('')

        if(!title || !description || !address) {
            setError('Please fill in every required field.')
            return
        }

   
        try{
            await createSpot({ title, description, address, lat: location?.lat, lng: location?.lng })
            setError('')
            setSuccess('Thanks! Your spot was submitted and is now live!')

            //clear form 
            setTitle('')
            setDescription('')
            setAddress('')
            setLocation(null)
        } catch (err) {
            setError(err.response?.data?.error ?? 'Something went wrong. Please try again.')
        }
    }

    function handlePick(place){
        setAddress(place.address)
        setLocation({ lat: place.lat, lng: place.lng })
        setShowMap(false)
    }

    //only signed in users can submit spots
    if(!user){
        return(
            <section className="home">
                <div className="city-card">
                    <h1>Submit a spot</h1>
                    <p>Please <Link to="/login">Sign in</Link> to submit a spot.</p>
                </div>
            </section>
        )
    }

    return(
        <section className="home">
            <div className="city-card">
                <h1>Submit a spot!</h1>
                <p>Share a place in {user.city} that visitors should know about.</p>

                <form onSubmit={handleSubmit} className="city-form">
                    <div className="form-row">
                        <label htmlFor="title">Name</label>
                        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>

                    <div className="form-row">
                        <label htmlFor="description">Description</label>
                        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>

                     <div className="form-row">
                        <label htmlFor="address">Address</label>
                        <div className="address-field"> {/* NEW: input + icon share one grid column */}
                            <input id="address" value={address} onChange={(e) => { setAddress(e.target.value); setLocation(null) }} />
                            <button type="button" className="icon-button" onClick={() => setShowMap(true)} aria-label="Pick on map" title="Pick on map">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" fillRule="evenodd" aria-hidden="true">
                                    <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
                                </svg>
                            </button>
                        </div> {/* closes address-field: easy to forget */}
                    </div>


                    <p>Tags are added automatically from your description. </p>
                    

                    

                    {error && <p className="form-error">{error}</p>}
                    {success && <p className="form-success">{success}</p>}

                    <div className="form-action">
                        <button type="submit">Submit spot</button>
                    </div>
                </form>

                {showMap && <MapPicker onPick={handlePick} onClose={() => setShowMap(false)} />}
            </div>
        </section>
    )
}