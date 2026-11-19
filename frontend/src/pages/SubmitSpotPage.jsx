import { useState } from 'react'
import { Link } from 'react-router'
import { createSpot } from '../api/API'
import { categoryLabel } from '../utils/categories'

const CATEGORIES = ['food', 'attractions', 'outdoors', 'shops']

export default function SubmitSpotPage({ user }){
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [category, setCategory] = useState('')
    const [address, setAddress] = useState('')
    const [tags, setTags] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    async function handleSubmit(event){
        event.preventDefault()
        setSuccess('')

        if(!title || !description || !category || !address) {
            setError('Please fill in every required field.')
            return
        }

        //"coffee, quiet, wifi" -> ['coffee','quiet','wifi']
        const tagList = tags.split(',').map((t) => t.trim()).filter((t) => t !== '')
        
        try{
            await createSpot({ title, description, category, address, tags: tagList })
            setError('')
            setSuccess('Thanks! Your spot was submitted. It will show up after an admin approves it.')

            //clear form 
            setTitle('')
            setDescription('')
            setCategory('')
            setAddress('')
            setTags('')
        } catch (err) {
            setError(err.response?.data?.error ?? 'Something went wrong. Please try again.')
        }
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
                        <label htmlFor="category">Category</label>
                        <select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                            <option value="">Choose one</option>
                            {CATEGORIES.map((c) =>(
                                <option key={c} value={c}>{categoryLabel(c)}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-row">
                        <label htmlFor="address">Address</label>
                        <input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
                    </div>

                    <div className="form-row">
                        <label htmlFor="tags">Tags (optional)</label>
                        <input id="tags" palceholder="coffee, quiet, wifi" vaule={tags} onChange={(e) => setTags(e.target.value)} />
                    </div>

                    {error && <p className="form-error">{error}</p>}
                    {success && <p className="form-success">{success}</p>}

                    <div className="form-actions">
                        <button type="submit">Submit spot</button>
                    </div>
                </form>
            </div>
        </section>
    )
}