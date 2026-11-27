import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const FORT_SMITH = [35.3859, -94.3985] // where the map starts if no spot has a location

// Map with one pin per spot. Clicking a pin opens that spot.
export default function SpotsMap({ spots }) {
    const mapRef = useRef(null)
    const navigate = useNavigate()

    useEffect(() => {
        const map = L.map(mapRef.current).setView(FORT_SMITH, 13)
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors',
        }).addTo(map)

        // only spots that have coordinates can get a pin
        const placed = spots.filter((spot) => spot.lat != null && spot.lng != null)

        for (const spot of placed) {
            const label = document.createElement('span')
            label.textContent = spot.title // textContent, so a spot name is never run as HTML

            L.circleMarker([spot.lat, spot.lng], { radius: 8, color: '#9d2235', fillOpacity: 0.8 })
                .addTo(map)
                .bindTooltip(label)
                .on('click', () => navigate(`/cities/${encodeURIComponent(spot.city)}/spots/${spot.id}`))
        }

        // zoom so every pin fits on screen
        if (placed.length > 0) {
            map.fitBounds(placed.map((spot) => [spot.lat, spot.lng]), { padding: [30, 30], maxZoom: 15 })
        }

        // when the page changes, remove the map so Leaflet cleans up after itself
        return () => map.remove()
    }, [spots, navigate])

    return <div ref={mapRef} className="h-96 w-full rounded-xl ring-1 ring-black/5" />
}