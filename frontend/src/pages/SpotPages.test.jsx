import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { test, expect, vi } from 'vitest'
import SpotListPage from './SpotListPage'
import SpotDetailModal from '../components/SpotDetailModal'

// Stub the real API so tests don't need a running backend.
vi.mock('../api/API', () => {
    const spots = [
        { id: 'ben-geren-regional-park-abc123', title: 'Ben Geren Regional Park', city: 'Fort Smith', category: 'Generated', description: 'A park in Fort Smith.', address: 'Fort Smith, AR', tags: [], banner: null },
    ]
    return {
        getSpotsByCity: vi.fn(async (city) => spots.filter((s) => s.city === city)),
        getSpot: vi.fn(async (slug) => {
            const spot = spots.find((s) => s.id === slug)
            if (!spot) throw Object.assign(new Error('Not found'), { response: { status: 404 } })
            return spot
        }),
    }
})

function renderAt(path){
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/cities/:city" element={<SpotListPage />}>
                  <Route path="spots/:spotId" element={<SpotDetailModal />} />
                </Route>
            </Routes>
        </MemoryRouter>
    )
}

test('spot list shows spots for Fort Smith', async () => {
  renderAt('/cities/Fort%20Smith')
  expect(await screen.findByText('Ben Geren Regional Park')).toBeTruthy()
})

test('spot list shows an empty message for a city with no spots', async () => {
  renderAt('/cities/Nowhere')
  expect(await screen.findByText(/no spots in this city yet/i)).toBeTruthy()
})

test('spot modal shows not-found for a spot that does not exist', async () => {
  renderAt('/cities/Fort%20Smith/spots/does-not-exist')
  expect(await screen.findByText(/spot not found/i)).toBeTruthy()
})
