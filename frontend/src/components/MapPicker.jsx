import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const FORT_SMITH = [35.3859, -94.3985] //map starts here 

//turn map point into short street addr using OpenStreetMap's Nominatim service. 
async function lookUpAddress(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    const res = await fetch(url)
    if (!res.ok)
        throw new Error('Address lookup failed')

    const place = await res.json()
    const a = place.address ?? {}
    const street = [a.house_number, a.road].filter(Boolean).join(' ')
    const town = a.city ?? a.town ?? a.village ?? ''

    return [street, town, a.state].filter(Boolean).join(', ') || place.display_name    
}

export default function MapPicker({ onPick, onClose }){
    const dialogRef = useRef(null)
    const mapRef = useRef(null)
    const [ picked, setPicked ] = useState(null) //lat, lng, addres
    const [ status, setStatus ]= useState('idle') //idle, looking, error 

    useEffect(() => {
        const dialog = dialogRef.current
        if(!dialog.open) dialog.showModal()

            //Leaflet draws so create map once pop-up is open. 
            const map = L.map(mapRef.current).setView(FORT_SMITH, 16)
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19, 
                attribution: '&copy; OpenStreetMap contributors',
            }).addTo(map)

            let marker = null 
            map.on('click', async (event) =>{
                const { lat, lng } = event.latlng
                //move dot if there is one, otherwise add it
                if(marker)
                    marker.setLatLng(event.latlng)
                else
                    marker = L.circleMarker(event.latlng, { radius: 8, color: '#9d2235'}).addTo(map)

                setStatus('looking')
                try{
                    const address = await lookUpAddress(lat, lng)
                    setPicked({ lat, lng, address })
                    setStatus('idle')
                } catch {
                    setPicked(null)
                    setStatus('error')
                }
            })

            //when pop-up closes, remove the map so Leaflet cleans up after itself. 
            return () => map.remove () 
    }, [])

    return(
        <dialog ref={dialogRef} className="modal" onClose={onClose}>
            <div className="modal-content">
                <button type="button" className="modal-close" onClick={onClose} aria-label="Close">x</button>
                <h2>Click where the spot is</h2>
                <div ref={mapRef} className="map-picker" />

                {status === 'looking' && <p className="status">Finding the address...</p>}
                {status === 'error'  && <p className="form-error">Couldn't find an address there. You can type it instead.</p>}
                {picked && <p>Nearest address: <strong>{picked.address}</strong> (You can still edit it after.)</p>}

                <div className="form-action">
                    <button type="button" disabled={!picked} onClick={() => onPick(picked)}>Use this address</button>
                </div>
            </div>
        </dialog>
    )
}