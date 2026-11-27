import { useEffect, useState } from 'react'
import { Link, Outlet, useParams } from 'react-router'
import { getSpotsByCity, rankSpots } from '../api/API'
import SpotCard from '../components/SpotCard'
import { TAGS } from '../utils/tags'


//keyword search: fallback
function keywordMatch(spot, query){
    const text = `${spot.title} ${spot.description}`.toLowerCase()
    return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => text.includes(word))
}

export default function SpotListPage() {
   const { city } = useParams()
   const [spots, setSpots] = useState([])
   const [status, setStatus] = useState('loading') // loading, ready, error 
   const [reloadKey, setReloadKey] = useState(0)
   const [query, setQuery] = useState('')
   const [results, setResults] = useState(null)
   const [searchNote, setSearchNote] = useState('') 
   const [searching, setSearching] = useState(false)
   const [pickedTags, setPickedTags] = useState([])

    useEffect(() => {
        let ignore = false 
        getSpotsByCity(city)
            .then((data)=> {
                if(!ignore){
                    setSpots(data)
                    setStatus('ready')
                }
            })
            .catch((error)=>{
                console.error('Failed to load spots: ', error)
                if (!ignore) setStatus('error')
            })
        return () => { ignore = true }  }, [city, reloadKey])

        function retry(){
            setStatus('loading')
            setReloadKey((key)=> key + 1)
        }

        //ask the ai, if down use keyword search and say so. 
        async function handleSearch(event){
            event.preventDefault()
            const text = query.trim()
            if(!text){
                clearSearch()
                return
            }
            setSearching(true)
            setSearchNote('')
            try{
                setResults(await rankSpots({ query: text, city }))
            } catch (err){
                if(err.response?.status === 503){
                    setResults(spots.filter((spot) => keywordMatch(spot, text)))
                    setSearchNote('AI search is unavailable. Matching on keyword matches.')
                }else{
                    setSearchNote('Search failed. Please try again.')
                }
            } finally {
                setSearching(false)
            }
        }

        function clearSearch(){
            setQuery('')
            setResults(null)
            setSearchNote('')
        }

        function toggleTag(tag){
            setPickedTags((current) => 
                    current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]
            )
        }

        if (status === 'loading'){
            return <p className="status">Loading spots…</p>
        }

        if(status === 'error'){
            return(
                <div className="status error">
                    <p>Couldn't load spots.</p>
                    <button onClick={retry}>Try again</button>
                </div>
            )
        }

        //only offer chips for tags that some spot in this city actually has
        const cityTags = TAGS.filter(({tag}) => spots.some((spot) => spot.tags?.includes(tag)))

        //start from search results, then keep spots with any picked tag
        const shown = (results ?? spots).filter((spot) =>
                pickedTags.length === 0 || spot.tags?.some((tag) => pickedTags.includes(tag))
        )

        return (
            <section>
                <div className="mb-8">
                    <Link to="/" className="back-link text-sm">Change city</Link>
                    <h1 className="mt-1 text-4xl font-bold tracking-tight">Spots in {city}</h1>
                    <p className="mt-2 text-text-muted">Local favorites shared by locals. </p>
                </div>


                {/*search box*/}
                <form onSubmit={handleSearch} role="search" className="mb-4 flex gap-2">
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder='Search or describe a spot, e.g "quiet place to study"'
                        aria-label="Search spots"
                        className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-white px-3 focus:border-primary focus:outline-none
                            focus:ring-2 focus:ring-primary/20"
                    />
                    <button type="submit" disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
                    {results && (
                        <button type="button" onClick={clearSearch} className="bg-white text-primary ring-1 ring-border hover:bg-primary-tint">
                            Clear
                        </button>
                    )}
                </form>

                {/* tag chips */}
                {cityTags.length > 0 && (
                    <div className="mb-6 flex flex-wrap gap-2">
                        {cityTags.map(({ tag, label}) => {
                            const on = pickedTags.includes(tag)
                            return ( 
                                <button 
                                    key={tag}
                                    type="button"
                                    onClick={() => toggleTag(tag)}
                                    aria-pressed={on}
                                    className={on
                                        ? 'rounded-full px-3 py-1 text-sm'
                                        : 'rounded-full bg-white px-3 py-1 text-sm text-text ring-1 ring-border hover:bg-primary-tint'}
                                >
                                    {label}
                                </button>    
                            )
                        })}
                    </div>
                )}

                {searchNote && <p className="form-error">{searchNote}</p>}
                {results && <p className="mb-4 text-sm text-text-muted">{shown.length} matching spot{shown.length === 1 ? '' : 's'}</p>}


                {spots.length === 0 ? (
                    <p className="status">No spots in this city yet.</p>
                ) : shown.length === 0 ? (
                    <p className="status">No spots match your search.</p>
                ) : (
                    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {shown.map((spot)=> (
                            <SpotCard key={spot.id} spot={spot} />
                    ))}
                    </div>
                )}

                <Outlet />
                </section>
          
        )
}