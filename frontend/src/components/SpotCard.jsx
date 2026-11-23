import { Link } from 'react-router'
import { tagLabel } from '../utils/tags'

export default function SpotCard({ spot }){
    return(
              <Link
            to={`/cities/${encodeURIComponent(spot.city)}/spots/${spot.id}`}
            className="block overflow-hidden rounded-xl bg-white text-inherit no-underline shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
        >
            {spot.banner ? (
                <img src={spot.banner} alt="" className="h-40 w-full object-cover" />
            ) : (
                <div className="h-40 w-full bg-primary-tint" aria-hidden="true" />
            )}
            <div className="p-4">
                {spot.tags?.length > 0 && (
                    <span className="inline-block rounded-full bg-primary-tint px-2.5 py-0.5 text-xs font-medium text-primary">
                        {tagLabel(spot.tags[0])}
                    </span>
                )}
                <h2 className="mt-2 text-lg font-semibold">{spot.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-text-muted">{spot.description}</p>
            </div>
        </Link>
    )
}