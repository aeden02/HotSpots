import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { test, expect, vi } from 'vitest'
import ProfilePage from './ProfilePage'
import { deletePost } from '../api/API'


vi.mock('../api/API', () => {
  const spots = [
    { id: 'cafe-1', title: 'Sam Cafe', description: 'Mine.', city: 'Fort Smith', createdBy: 'u1', tags: [] },
    { id: 'park-2', title: 'Big Park', description: 'Not mine.', city: 'Fort Smith', createdBy: 'u2', tags: [] },
  ]
  return {
    getMe: vi.fn(async () => ({ _id: 'u1', username: 'sam', city: 'Fort Smith', bookmarks: ['park-2'], recentlyViewed: [] })),
    getSpotsByCity: vi.fn(async () => spots),
    getSpot: vi.fn(async (slug) => spots.find((s) => s.id === slug)),
    updatePost: vi.fn(),
    deletePost: vi.fn(),
  }
})

const member = { username: 'sam', city: 'Fort Smith' }

function renderPage(user){
  render(<MemoryRouter><ProfilePage user={user} /></MemoryRouter>)
}

test('asks you to sign in when nobody is signed in', () => {
  renderPage(null)
  expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy()
})

test('lists only my posts with edit buttons, and my bookmarks', async () => {
  renderPage(member)
  expect(await screen.findByText('Sam Cafe')).toBeTruthy()
  expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(1) // not Big Park
  expect(screen.getByText('Big Park')).toBeTruthy()                       // shown under Bookmarks
})

test('deletes a post after confirming', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  deletePost.mockResolvedValueOnce({ message: 'Spot deleted.' })
  renderPage(member)
  await screen.findByText('Sam Cafe')

  fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

  expect(await screen.findByText(/Deleted "Sam Cafe"/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
})