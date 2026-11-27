import { render, fireEvent } from '@testing-library/react'
import { test, expect } from 'vitest'
import SpotImage from './SpotImage'

test('shows the photo when the spot has one', () => {
    const spot = { banner: 'https://example.com/park.jpg', tags: ['outdoors'] }
    const { container } = render(<SpotImage spot={spot} className="h-40 w-full" />)
    expect(container.querySelector('img').getAttribute('src')).toBe('https://example.com/park.jpg')
})

test('shows the icon for the main tag when there is no photo', () => {
    const spot = { banner: null, tags: ['outdoors', 'history'] }
    const { container } = render(<SpotImage spot={spot} className="h-40 w-full" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg.lucide-trees')).not.toBeNull() // outdoors = trees
})

test('shows a map pin when the spot has no tags', () => {
    const spot = { banner: null, tags: [] }
    const { container } = render(<SpotImage spot={spot} className="h-40 w-full" />)
    expect(container.querySelector('svg.lucide-map-pin')).not.toBeNull()
})

test('switches to the icon when the photo fails to load', () => {
    const spot = { banner: 'https://example.com/broken.jpg', tags: ['food-and-drink'] }
    const { container } = render(<SpotImage spot={spot} className="h-40 w-full" />)

    fireEvent.error(container.querySelector('img')) // pretend the photo didn't load

    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg.lucide-utensils-crossed')).not.toBeNull()
})