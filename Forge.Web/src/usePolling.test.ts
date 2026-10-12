import { afterEach, describe, expect, it, vi } from 'vitest'
import { shared } from './usePolling'

describe('shared', () => {
  afterEach(() => vi.useRealTimers())

  it('joins a request for the same key started moments ago, not an older one', async () => {
    vi.useFakeTimers()
    let calls = 0
    const never = () => {
      calls++
      return new Promise<number>(() => {})
    }
    const first = shared('/workouts', never)
    expect(shared('/workouts', never)).toBe(first) // a card opening with its page
    expect(calls).toBe(1)
    shared('/plan', never)
    expect(calls).toBe(2) // another key
    vi.advanceTimersByTime(300)
    shared('/workouts', never)
    expect(calls).toBe(3) // started too long ago: may be from before a save
  })
})
