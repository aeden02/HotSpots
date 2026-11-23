import { Link } from 'react-router'
import { tagLabel } from '../utils/tags'

export default function SpotCard({ spot }){
    return(
        <Link to={`/cities/${encodeURIComponent(spot.city)}/spots/${spot.id}`} className="spot-card">
            {spot.banner ? (
                <img src={spot.banner} alt="" className="spot-card-photo" />
            ) : (
                <div className="spot-card-photo placeholder" aria-hidden="true" />
            )}
            <div className="spot-card-body">
                {spot.tags?.length > 0 && <span className="badge">{tagLabel(spot.tags[0])}</span>}
                <h2>{spot.title}</h2>
                <p>{spot.description}</p>
            </div>
        </Link>
    )
}