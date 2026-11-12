import { Link } from 'react-router'
import { categoryLabel } from '../utils/categories'

export default function SpotCard({ spot }){
    return(
        <Link to={`/cities/${spot.city}/spots/${spot._id}`} className="spot-card">
            {spot.photoUrl ? (
                <img src={spot.photoUrl} alt="" className="spot-card-photo" />
            ) : (
                <div className="spot-card-photo placeholder" aria-hidden="true" />
            )}
            <div className="spot-card-body">
                <span className="badge">{categoryLabel(spot.category)}</span>
                <h2>{spot.name}</h2>
                <p>{spot.description}</p>
            </div>
        </Link>
    )
} 