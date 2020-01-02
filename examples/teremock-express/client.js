import teremock from '../../dist/express'

async function run() {
  await teremock.start({
    // It is important to pass `node.__dirname: true` to webpack.config, if you want custom relative wd
    wd: [__dirname, '__teremocks__'],
  })

  const remove = await teremock.add({
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

  setTimeout(() => {
    remove()
    suggest.innerText = `inline mock for 'ab' removed!`
  }, 5 * 1000)
}

run()
