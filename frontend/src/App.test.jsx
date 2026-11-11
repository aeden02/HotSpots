import { render } from '@testing-library/react'
import { test, expect } from 'vitest'
import App from './App'

test('app renders without crashing', () => {
  const { container } = render(<App />)
  expect(container).toBeTruthy()
})