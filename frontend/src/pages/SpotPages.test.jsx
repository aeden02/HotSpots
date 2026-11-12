import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { test, expect } from 'vitest'
import SpotListPage from './SpotListPage'
import SpotDetailModal from '../components/SpotDetailModal'

function renderAt(path){
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route path="/cities/:cityId" element={<SpotListPage />}>
                  <Route path="spots/:spotId" element={<SpotDetailModal />} />
                </Route>
            </Routes>
        </MemoryRouter>
    )
}

test('spot list shows spots for Fort Smith', async () => {
  renderAt('/cities/fort-smith')
  expect(await screen.findByText('Ben Geren Regional Park')).toBeTruthy()
})

test('spot list shows an empty message for a city with no spots', async () => {
  renderAt('/cities/nowhere')
  expect(await screen.findByText(/no spots in this city yet/i)).toBeTruthy()
})

test('spot modal shows not-found for a spot that does not exist', async () => {
  renderAt('/cities/fort-smith/spots/does-not-exist')
  expect(await screen.findByText(/spot not found/i)).toBeTruthy()
})