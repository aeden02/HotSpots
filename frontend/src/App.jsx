import { BrowserRouter, Routes, Route, Link, NavLink } from 'react-router'
import HomePage from './pages/HomePage'
import SpotListPage from './pages/SpotListPage'
import SpotDetailModal from './components/SpotDetailModal'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
     <div className="app-layout">
      <header className="sidebar">
        <Link to="/" className="logo">HotSpots</Link>
        <nav aria-label="Main">
          <NavLink to="/" end className="nav-link">Home</NavLink>
         { /*===ADD SIGN IN===*/}
        </nav>
      </header>
      
     <div className="content"> 
      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cities/:city" element={<SpotListPage />} >
            <Route path="spots/:spotId" element={<SpotDetailModal />} />
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