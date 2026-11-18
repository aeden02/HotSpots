import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { login, getMe } from '../api/API'

export default function LoginPage({ setUser }){
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const navigate = useNavigate()

    async function handleSubmit(event){
        event.preventDefault()

        if(!email || !password){
            setError('Please enter your email and password.')
            return
        }

        try{
            await login({ email, password })
            const user = await getMe()
            setUser(user)
            navigate('/')
        } catch(err){
            //axois has backend msg in err.response.data.error
            setError(err.response?.data?.error ?? 'Something went wrong. Please try again.')
        }
    }

    return(
        <section className="home">
            <div className="city-card">
                <h1>Sign in</h1>

                <form onSubmit={handleSubmit} className="city-form">
                    <div className ="form-row">
                        <label htmlFor="email">Email</label>
                        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>

                    <div className="form-row">
                        <label htmlFor="password">Password</label>
                        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>

                    {error && <p className="status error">{error}</p>}

                    <div className="form-action">
                        <button type="submit">Sign in</button>
                    </div>
                    
                </form>

                <p>New Here? <Link to="/register">Create an account</Link></p>
            </div>
        </section>
    )
}

