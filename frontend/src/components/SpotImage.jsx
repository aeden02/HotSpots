import { useState } from 'react'
import {
    BedDouble, Dumbbell, GraduationCap, HeartPulse, Landmark, MapPin,
    Moon, Palette, ShoppingBag, Ticket, Trees, Users, UtensilsCrossed,
} from 'lucide-react'

// one icon per AI tag (same tag names as utils/tags.js)
const TAG_ICONS = {
    'food-and-drink': UtensilsCrossed,
    'outdoors': Trees,
    'history': Landmark,
    'arts-and-culture': Palette,
    'shopping': ShoppingBag,
    'entertainment': Ticket,
    'family-activities': Users,
    'sports-and-fitness': Dumbbell,
    'nightlife': Moon,
    'education': GraduationCap,
    'wellness': HeartPulse,
    'lodging': BedDouble,
}

// Shows the spot's photo. If it has none, or the photo won't load, shows the icon for its main tag.
export default function SpotImage({ spot, className }) {
    const [failed, setFailed] = useState(false)

    if (spot.banner && !failed) {
        return <img src={spot.banner} alt="" className={`${className} object-cover`} onError={() => setFailed(true)} />
    }

    const Icon = TAG_ICONS[spot.tags?.[0]] ?? MapPin
    return (
        <div className={`${className} flex items-center justify-center bg-primary-tint text-primary`} aria-hidden="true">
            <Icon size={40} strokeWidth={1.5} />
        </div>
    )
}