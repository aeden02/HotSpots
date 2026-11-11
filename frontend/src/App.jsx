import { BrowserRouter, Routes, Route, Link } from 'react-router'
import HomePage from './pages/HomePage'
import SpotListPage from './pages/SpotListPage'
import SpotDetailPage from './pages/SpotDetailPage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <header className="site-header">
        <Link to="/" className="logo">HotSpots</Link>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cities/:cityId" element={<SpotListPage />} />
          <Route path="/spots/:spotId" element={<SpotDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <footer className="site-footer">
        Map data © OpenStreetMap contributors
      </footer>
    </BrowserRouter>
  )
}