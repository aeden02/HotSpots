import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { createAccount, login, getMe, getCities } from '../api/API'

export default function RegisterPage({ setUser }){
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [city, setCity] = useState('')
  const [cities, setCities] = useState([])
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    getCities()
        .then((data) => {
            setCities(data)
            setCity(data[0]?.name ?? '')
        })
        .catch(() => setError("Couldn't load cities. Please refresh to try again."))
  }, [])

  async function handleSubmit(event){
    event.preventDefault()

    if(!username || !email || !password || !city){
        setError('Please fill in every field.')
        return
    }

    //check pw length. 
    if(password.length < 8) {
        setError('Password must be at least 8 characters.')
        return
    }

    //check if at least 1 num.
    if(!/[0-9]/.test(password)){
        setError('Password must include at least 1 number.')
        return
    }

    //check if at least 1 special char. 
    if(!/[^A-Za-z0-9]/.test(password)){
        setError('Password much include at least 1 special character.')
        return
    }

    try{
      await createAccount({ username, email, password, city })
      await login({ email, password })
      const user = await getMe()
      setUser(user)
      navigate('/')
    } catch (err) {
        setError(err.response?.data?.error ?? 'Something went wrong. Please try again.')
    }
  }

  return(
    <section className="home">
        <div className="city-card">
            <h1>Create An Account</h1>

            <form onSubmit={handleSubmit} className="city-form">
                <div className="form-row">
                    <label htmlFor="username">Username</label>
                    <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>

                <div className="form-row">
                    <label htmlFor="email">Email</label>
                    <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>

                <div className="form-row">
                    <label htmlFor="password">Password</label>
                    <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>

                

                <div className="form-row">
                    <label htmlFor="city">City</label>
                        <select id="city" value={city} onChange={(e) => setCity(e.target.value)}>
                            {cities.map((c) => (
                                <option key={c._id} value={c.name}>{c.name}</option>
                            ))}
                        </select>
                </div>

                {error && <p className="status error">{error}</p>}
                
                <div className="form-action">
                    <button type="submit">Create account</button>
                </div>
            </form>

            <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
    </section>
  )
}