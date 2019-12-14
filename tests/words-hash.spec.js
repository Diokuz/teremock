const { humanize } = require('../src/words-hash')

it('Generates same words for same hash', () => {
  const hash = 'a6bf1757fff057f266b697df9cf176fd'
  const words1 = humanize(hash)
  const words2 = humanize(hash)

  expect(words1).toBe(words2)
})

it('Three words by default', () => {
  const hash = 'a6bf1757fff057f266b697df9cf176fd'
  const words = humanize(hash)
  const len = words.split('-').length

  expect(len).toBe(3)
})

it('All words must be changed when one symbol in string changes', () => {
  const str1 = 'a-qwertyuiop[]'
  const str2 = 'b-qwertyuiop[]'
  const words1 = humanize(str1)
  const words2 = humanize(str2)

  expect(words1).toBe('grey-texas-summer')
  expect(words2).toBe('goby-sodium-ack')
})

it('Empty string', () => {
  const words = humanize('')

  expect(words).toBe('batman-tel-pluto')
})

it('Not a string must throw', () => {
  expect(() => humanize()).toThrow()
})
