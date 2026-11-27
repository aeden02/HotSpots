import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router'
import HomePage from './pages/HomePage'
import SpotListPage from './pages/SpotListPage'
import SpotDetailModal from './components/SpotDetailModal'
import NotFoundPage from './pages/NotFoundPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import SubmitSpotPage from './pages/SubmitSpotPage'
import ProfilePage from './pages/ProfilePage'
import PlannerPage from './pages/PlannerPage'
import { getMe, logout } from './api/API'
import logo from './assets/hotspots-mark-mono-white.svg'

export default function App() {
  const [user, setUser] = useState(null) //null = no one signed in. 

  useEffect(() => {
    getMe()
      .then((me) => setUser(me))
      .catch(() => setUser(null)) //backend = 401 when no sign in. 
  }, [])

  async function handleSignOut(){
    await logout()
    setUser(null)
  }

  return (
    <BrowserRouter>
     <div className="app-layout">
      <header className="sidebar">
        <Link to="/" className="logo">
          <img src={logo} alt="" className="logo-img" /> HotSpots</Link>

        <nav aria-label="Main">
          <NavLink to="/" end className="nav-link">Home</NavLink>
          <NavLink to={`/cities/${encodeURIComponent(user?.city ?? 'Fort Smith')}`} end className="nav-link">Listings</NavLink>
         {user ? (
          <>
            <span className="nav-link">Signed in as {user.username}</span> 
            <NavLink to={`/cities/${encodeURIComponent(user?.city ?? 'Fort Smith')}/plan`} className="nav-link">Plan my day</NavLink>
            <NavLink to="/profile" className="nav-link">My Profile</NavLink>
            <NavLink to="/submit" className="nav-link">Submit a spot</NavLink>
            <button type="button" onClick={handleSignOut}>Sign out</button>
          </>
         ) : (
          <>
            
            <NavLink to="/login" className="nav-link">Sign in</NavLink>
            <NavLink to="/register" className="nav-link">Create account</NavLink>
          </>
         )}
        </nav>
      </header>
      
     <div className="content"> 
      <main className="page">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage setUser={setUser} />} />
          <Route path="/register" element={<RegisterPage setUser={setUser} />} />
          <Route path="/submit" element={<SubmitSpotPage user={user} />} />
          <Route path="/profile" element={<ProfilePage user={user} />} />
          <Route path="/cities/:city/plan" element={<PlannerPage />} >
            <Route path="spots/:spotId" element={<SpotDetailModal user={user} setUser={setUser} />} />
          </Route>
          <Route path="/cities/:city" element={<SpotListPage />} >
            <Route path="spots/:spotId" element={<SpotDetailModal user={user} setUser={setUser} />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="site-footer">
        Map data © OpenStreetMap contributors
      </footer>
      </div>
    </div>
    </BrowserRouter>
  )
}