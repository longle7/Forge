import { expect, it } from 'vitest'
import { fitWithin } from './photo'

it('fitWithin shrinks the longest side to 1,024 px, keeping the shape, and never enlarges', () => {
  expect(fitWithin(4032, 3024)).toEqual({ width: 1024, height: 768 }) // an iPhone photo, landscape
  expect(fitWithin(3024, 4032)).toEqual({ width: 768, height: 1024 }) // portrait
  expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
})
