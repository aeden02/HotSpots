import { cities, spots } from '../data/mockSpots'

// Flip to false once Christian's endpoints are running.
const USE_MOCK = true

export class NotFoundError extends Error {}

// Fake network delay so you can see loading states while using mock data.
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function request(path) {
  const res = await fetch(path)
  if (res.status === 404) throw new NotFoundError('Not found')
  if (!res.ok) throw new Error(`Request failed (${res.status})`)
  return res.json()
}

export async function getCities() {
  if (USE_MOCK) {
    await wait(400)
    return cities
  }
  return request('/api/cities')
}

export async function getSpots(cityId) {
  if (USE_MOCK) {
    await wait(400)
    return spots.filter((spot) => spot.city === cityId)
  }
  return request(`/api/spots?city=${encodeURIComponent(cityId)}`)
}

export async function getSpot(spotId) {
  if (USE_MOCK) {
    await wait(400)
    const spot = spots.find((s) => s._id === spotId)
    if (!spot) throw new NotFoundError('Spot not found')
    return spot
  }
  return request(`/api/spots/${encodeURIComponent(spotId)}`)
}