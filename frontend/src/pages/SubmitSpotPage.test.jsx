import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { test, expect, vi } from 'vitest'
import SubmitSpotPage from './SubmitSpotPage'
import { createSpot } from '../api/API'

// Fake API so tests don't need a running backend.
vi.mock('../api/API', () => ({
  createSpot: vi.fn(),
}))

const member = { username: 'sam', city: 'Fort Smith' }

function renderPage(user) {
  render(
    <MemoryRouter>
      <SubmitSpotPage user={user} />
    </MemoryRouter>
  )
}

test('asks you to sign in when nobody is signed in', () => {
  renderPage(null)
  expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy()
})

test('shows a message when required fields are empty', async () => {
  renderPage(member)
  fireEvent.click(screen.getByRole('button', { name: 'Submit spot' }))
  expect(await screen.findByText(/fill in every required field/i)).toBeTruthy()
})

test('sends the spot and shows a success message', async () => {
  createSpot.mockResolvedValueOnce({ message: 'Spot created.' })
  renderPage(member)

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Fort Smith Coffee Co.' } })
  fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Quiet cafe for studying.' } })
  fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'food' } })
  fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Fort Smith, AR' } })
  fireEvent.change(screen.getByLabelText('Tags (optional)'), { target: { value: 'coffee, quiet' } })
  fireEvent.click(screen.getByRole('button', { name: 'Submit spot' }))

  expect(await screen.findByText(/your spot was submitted/i)).toBeTruthy()
  expect(createSpot).toHaveBeenCalledWith({
    title: 'Fort Smith Coffee Co.',
    description: 'Quiet cafe for studying.',
    category: 'food',
    address: 'Fort Smith, AR',
    tags: ['coffee', 'quiet'],
  })
})