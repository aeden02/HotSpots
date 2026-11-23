import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { test, expect, vi } from 'vitest'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import { login, createAccount } from '../api/API'


// Stub the real API so tests don't need a running backend.
vi.mock('../api/API', () => ({
    login: vi.fn(),
    getMe: vi.fn(),
    createAccount: vi.fn(),
    getCities: vi.fn(async () => [{_id: '1', name: 'Fort Smith'}]),
}))

function renderPage(page){
    render(<MemoryRouter>{page}</MemoryRouter>)
}

test('sign in shows a message when fields are empty', async () => {
    renderPage(<LoginPage setUser={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findAllByText(/please enter your email and password/i)).toBeTruthy()
})

test('sign in shows the error message from the backend', async ()=> {
    login.mockRejectedValueOnce({ response: { data: { error: 'Invalid email or password.' } } })
    renderPage(<LoginPage setUser={() => {}} />)

    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'bob@test.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Invalid email or password.')).toBeTruthy()

})

test('register shows the password error from the backend', async () => {
  createAccount.mockRejectedValueOnce({ response: { data: { error: 'Password must be at least 8 characters.' } } })
  renderPage(<RegisterPage setUser={() => {}} />)
  await screen.findByRole('option', { name: 'Fort Smith' }) // wait for the dropdown to load

  fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'sam' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'sam@test.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abc' } })
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByText(/at least 8 characters/i)).toBeTruthy()
})