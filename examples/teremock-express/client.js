import teremock from '../../dist/express'

teremock.start({
  wd: __dirname + '/__teremocks__',
})

teremock.add({
  query: { q: 'ab' },
  response: {
    body: { suggest: 'Congrat!!! This is inline (not a file) mock for q=ab' }
  }
})

const suggest = document.querySelector('#suggest')
document.querySelector('#input').addEventListener('keyup', (e) => {
  const query = e.target.value

  fetch(`/api?q=${query}`)
    .then(async (re) => {
      const j = await re.json()
      const { status } = re

      suggest.innerText = `${status} ${j.suggest}`
    })
})
