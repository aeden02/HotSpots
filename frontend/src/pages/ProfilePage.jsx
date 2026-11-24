import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { deletePost, getMe, getSpot, getSpotsByCity, updatePost } from '../api/API'
import SpotCard from '../components/SpotCard'

const inputClass = 'w-full rounded-lg border border-border bg-white px-3 py-2 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'
const secondaryButton = 'bg-white text-primary ring-1 ring-border hover:bg-primary-tint'

//load spot by slug, skip n/e that were deleted after being saved. 
async function loadSpots(slugs = []){
    const results = await Promise.allSettled(slugs.map((slug) => getSpot(slug)))
    return results.filter((r) => r.status === 'fulfilled').map((r) => r.value)
}

//heading plus grid of spot cards. 
function SpotSection({ title, spots, empty }){
    return(
        <div>
            <h2 className="mb-4 text 2xl font-semibold">{title}</h2>
            {spots.length === 0 ? (
                <p className="text-text-muted">{empty}</p>
            ) : (
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {spots.map((spot) => <SpotCard key={spot.id} spot={spot} />)}
                </div>
            )}
        </div>
    )
}

export default function ProfilePage({ user }){
    const [posts, setPosts] = useState([])
    const [bookmarks, setBookmarks] = useState([])
    const [recent, setRecent] = useState([])
    const [status, setStatus] = useState('loading') // loading, ready, error
    const [editing, setEditing] = useState(null)   // copy of the post being edited, or null
    const [message, setMessage] = useState('')

    useEffect(() => {
        if(!user) return
        let ignore = false
        async function load(){
            try{
                // Fresh copy of the user: bookmarks and recently viewed change as you browse.
                const me = await getMe()
                const [citySpots, saved, viewed] = await Promise.all([
                    getSpotsByCity(me.city),
                    loadSpots(me.bookmarks),
                    loadSpots(me.recentlyViewed),
                ])
                if(ignore) return
                // My posts = spots in my city that I created.
                setPosts(citySpots.filter((spot) => spot.createdBy === me._id))
                setBookmarks(saved)
                setRecent(viewed)
                setStatus('ready')
            } catch (err) {
                console.error('Failed to load profile: ', err)
                if(!ignore) setStatus('error')
            }
        }
        load()
        return () => { ignore = true }
    }, [user])

    async function handleDelete(post){
        if(!window.confirm(`Delete "${post.title}"? This can't be undone.`)) return
        try{
            await deletePost(post.id)
            setPosts((current) => current.filter((p) => p.id !== post.id))
            setMessage(`Deleted "${post.title}".`)
        } catch (err) {
            setMessage(err.response?.data?.error ?? 'Could not delete. Please try again.')
        }
    }

    async function handleSave(event){
        event.preventDefault()
        const { id, title, description, address } = editing
        try{
            await updatePost(id, { title, description, address })
            setPosts((current) => current.map((p) => (p.id === id ? { ...p, title, description, address } : p)))
            setEditing(null)
            setMessage('Changes saved.')
        } catch (err) {
            setMessage(err.response?.data?.error ?? 'Could not save. Please try again.')
        }
    }

    if(!user){
        return (
            <section className="home">
                <div className="city-card">
                    <h1>My profile</h1>
                    <p><Link to="/login">Sign in</Link> to see your posts and bookmarks.</p>
                </div>
            </section>
        )
    }

    if(status === 'loading') return <p className="status">Loading your profile…</p>
    if(status === 'error') return <p className="status error">Couldn't load your profile. Please refresh to try again.</p>

    return (
        <section className="space-y-10">
            <div>
                <h1 className="text-4xl font-bold tracking-tight">Hi, {user.username}</h1>
                <p className="mt-2 text-text-muted">Your posts, saved spots and recent views in {user.city}.</p>
            </div>

            {message && <p className="rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-border">{message}</p>}

            {/* My posts (US 13) */}
            <div>
                <h2 className="mb-4 text-2xl font-semibold">My posts</h2>
                {posts.length === 0 ? (
                    <p className="text-text-muted">You haven't posted any spots yet. <Link to="/submit">Submit one</Link>.</p>
                ) : (
                    <ul className="space-y-3">
                        {posts.map((post) => (
                            <li key={post.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-black/5">
                                {editing?.id === post.id ? (
                                    <form onSubmit={handleSave} className="space-y-3">
                                        <input aria-label="Name" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className={inputClass} />
                                        <textarea aria-label="Description" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className={inputClass} />
                                        <input aria-label="Address" value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} className={inputClass} />
                                        <div className="flex gap-2">
                                            <button type="submit">Save</button>
                                            <button type="button" onClick={() => setEditing(null)} className={secondaryButton}>Cancel</button>
                                        </div>
                                    </form>
                                ) : (
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <h3 className="font-semibold">{post.title}</h3>
                                            <p className="text-sm text-text-muted">{post.description}</p>
                                        </div>
                                        <div className="flex shrink-0 gap-2">
                                            <button type="button" onClick={() => setEditing({ ...post })} className={secondaryButton}>Edit</button>
                                            <button type="button" onClick={() => handleDelete(post)} className={secondaryButton}>Delete</button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Bookmarks (US 10) and recently viewed */}
            <SpotSection title="Bookmarks" spots={bookmarks} empty="No bookmarks yet. Open a spot and tap Bookmark." />
            <SpotSection title="Recently viewed" spots={recent} empty="Spots you open will show up here." />
        </section>
    )
}