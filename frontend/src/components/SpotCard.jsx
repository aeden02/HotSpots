import { Link } from 'react-router'
import { categoryLabel } from '../utils/categories'

export default function SpotCard({ spot }){
    return(
        <Link to={`/cities/${encodeURIComponent(spot.city)}/spots/${spot.id}`} className="spot-card">
            {spot.banner ? (
                <img src={spot.banner} alt="" className="spot-card-photo" />
            ) : (
                <div className="spot-card-photo placeholder" aria-hidden="true" />
            )}
            <div className="spot-card-body">
                <span className="badge">{categoryLabel(spot.category)}</span>
                <h2>{spot.title}</h2>
                <p>{spot.description}</p>
            </div>
        </Link>
    )
}