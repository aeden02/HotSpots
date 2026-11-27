import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router'
import { test, expect, vi, beforeEach } from 'vitest'
import PlannerPage from './PlannerPage'
import { buildItinerary } from '../api/API'

// Fake API: the AI planner is "down" (503) unless a test says otherwise,
// and the city has three spots plus a hotel.
vi.mock('../api/API', () => {
    const spots = [
        { id: 'museum', title: 'History Museum', city: 'Fort Smith', tags: ['history'], banner: null },
        { id: 'cafe', title: 'Corner Cafe', city: 'Fort Smith', tags: ['food-and-drink'], banner: null },
        { id: 'fort', title: 'Old Fort', city: 'Fort Smith', tags: ['history'], banner: null },
        { id: 'hotel', title: 'Downtown Hotel', city: 'Fort Smith', tags: ['lodging'], banner: null },
    ]
    return {
        buildItinerary: vi.fn(async () => { throw Object.assign(new Error('Unavailable'), { response: { status: 503 } }) }),
        getSpotsByCity: vi.fn(async () => spots),
    }
})

// forget calls from earlier tests, so "was it called?" checks start fresh
beforeEach(() => {
    vi.clearAllMocks()
})

function renderPlanner() {
    render(
        <MemoryRouter initialEntries={['/cities/Fort%20Smith/plan']}>
            <Routes>
                <Route path="/cities/:city/plan" element={<PlannerPage />} />
            </Routes>
        </MemoryRouter>
    )
}

test('shows the city and the interests, but not Lodging', () => {
    renderPlanner()
    expect(screen.getByRole('heading', { name: 'Plan a day in Fort Smith' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'History' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Lodging' })).toBeNull()
})

test('a time window under 3 hours shows an error and builds nothing', () => {
    renderPlanner()
    fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '15:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Build my day' }))

    expect(screen.getByText(/time window/)).toBeTruthy()
    expect(buildItinerary).not.toHaveBeenCalled()
})

test('when the AI is down, builds the backup plan and says so', async () => {
    renderPlanner()
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    fireEvent.click(screen.getByRole('button', { name: 'Build my day' }))

    expect(await screen.findByText(/AI planner is unavailable/)).toBeTruthy()
    expect(screen.getByText('History Museum')).toBeTruthy()
    expect(screen.getByText('9:00 AM – 10:00 AM')).toBeTruthy()
    expect(screen.getAllByText('Matches your interest in History.')).toHaveLength(2)
    expect(screen.queryByText('Downtown Hotel')).toBeNull()
})

test('uses the AI plan when the AI answers', async () => {
    buildItinerary.mockResolvedValueOnce({
        stops: [{
            time: '10:00 AM', endTime: '11:00 AM', reason: 'Great coffee to start the day.',
            spot: { id: 'cafe', title: 'Corner Cafe', tags: ['food-and-drink'] },
        }],
    })
    renderPlanner()
    fireEvent.click(screen.getByRole('button', { name: 'Build my day' }))

    expect(await screen.findByText('Great coffee to start the day.')).toBeTruthy()
    expect(screen.queryByText(/AI planner is unavailable/)).toBeNull()
    expect(buildItinerary).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'Fort Smith', start: '09:00', end: '17:00', interests: [] })
    )
})