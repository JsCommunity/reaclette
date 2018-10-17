# reaclette [![Build Status](https://travis-ci.org/julien-f/reaclette.png?branch=master)](https://travis-ci.org/julien-f/reaclette)

> Inspired by Freactal, but better :wink:

Differences with [freactal](https://github.com/FormidableLabs/freactal/):

- `props` are available both in effects and computed values
- computed values are available in the `state` in effects
- `finalize` effect is triggered on unmount (symmetry with `initialize`)
- easy [async effects](#async-effects)
- update state by default: no need for `Object.assign()` and `{...state}`
- no [helper functions](https://github.com/FormidableLabs/freactal#helper-functions) (not necessary)
- no [hydrate support](https://github.com/FormidableLabs/freactal#hydrate-and-initialize)
- no [middlewares support](https://github.com/FormidableLabs/freactal/#middleware)

## Install

Installation of the [npm package](https://npmjs.org/package/reaclette):

```
> npm install --save reaclette
```

## Usage

### With React

```js
import React from 'react'
import { render } from 'react-dom'
import { injectState, provideState } from 'reaclette'

const wrapComponentWithState = provideState({
  initialState: () => ({ counter: 0 }),
  effects: {
    addOne: () => (state, props) => ({ counter: state.counter + 1 }),
  },
  computed: {
    square: (state, props) => state.counter * state.counter,
  },
})

const Parent = wrapComponentWithState(() => <Child />)

const Child = injectState(({ effects, state }) => (
  <div>
    <p>Out counter is at: {state.counter}</p>
    <p>
      <button onClick={effects.addOne}>Add one</button>
    </p>
  </div>
))

render(<Parent />, document.body)
```

### With PReact

```js
/** @jsx Preact.h */
import Preact, { render } from 'preact'
import factory from 'reaclette/factory'

const { injectState, provideState } = factory(Preact)

// The rest is the same.
```

### Async effects

Effects can access the state through `this`, for reading and writing, which is
very convenient when the state needs to be updated multiple times.

```js
provideState({
  initialState: () => ({
    data: undefined,
    loading: false,
  }),
  effects: {
    loadData: async function () {
      const { state } = this
      if (state.data !== undefined || state.loading) {
        return
      }

      state.loading = true
      try {
        state.data = await fetchData()
      } finally {
        state.loading = false
      }
    }
  }
})
```

###

### Testing

> This example comes from the excellent [Freactal documentation](https://github.com/FormidableLabs/freactal/#testing).

`App.js`:

```js
import React from 'react'
import { injectState, provideState } from 'reaclette'

export default provideState({
  initialState: () => ({
    givenName: 'Walter',
    familyName: 'Harriman',
  }),
  effects: {
    onChangeGiven: (_, { target: { value } }) => state => ({
      givenName: value,
    }),
    onChangeFamily: (_, { target: { value } }) => state => ({
      familyName: value,
    }),
  },
  computed: {
    fullName: ({ givenName, familyName }) => `${givenName} ${familyName}`,
    greeting: ({ fullName }) => `Hi, ${fullName}, and welcome!`,
  },
})(
  injectState(({ state, effects }) => (
    <div>
      <p id="greeting">{state.greeting}</p>
      <p>
        <label>
          Enter your given name:{' '}
          <input
            id="given"
            onChange={effects.onChangeGiven}
            value={state.givenName}
          />
        </label>
      </p>
      <p>
        <label>
          Enter your family name:{' '}
          <input
            id="family"
            onChange={effects.onChangeFamily}
            value={state.familyName}
          />
        </label>
      </p>
    </div>
  ))
)
```

`App.spec.js`:

```js
import React from 'react'
import Adapter from 'enzyme-adapter-react-16'
import { configure, mount } from 'enzyme'

configure({ adapter: new Adapter() })

import AppWithState from './App.js'

describe('my app', () => {
  // From the decorated component you can obtained the plain version
  // directly.
  const App = AppWithState.WrappedComponent

  // We'll be re-using these values, so let's put it here for convenience.
  const state = {
    givenName: 'Charlie',
    familyName: 'In-the-box',
    fullName: 'Charlie In-the-box',
    greeting: 'Howdy there, kid!',
  }

  it('displays a greeting to the user', () => {
    // This test should be easy - all we have to do is ensure that
    // the string that is passed in is displayed correctly!

    // We're not doing anything with effects here, so let's not bother
    // setting them for now...
    const effects = {}

    // First, we mount the component, providing the expected state and effects.
    const el = mount(<App state={state} effects={effects} />)

    // And then we can make assertions on the output.
    expect(el.find('#greeting').text()).toBe('Howdy there, kid!')
  })

  it('accepts changes to the given name', () => {
    // Next we're testing the conditions under which our component might
    // interact with the provided effects.
    const effects = {
      onChangeGiven: jest.fn(),
      onChangeFamily: jest.fn(),
    }

    const el = mount(<App state={state} effects={effects} />)

    // We don't expect our effect to be invoked when the component
    // mounts, so let's make that assertion here.
    expect(effects.onChangeGiven).not.toHaveBeenCalled()

    // Next, we can simulate a input-box value change.
    el.find('input#given').simulate('change', {
      target: { value: 'Eric' },
    })

    // And finally, we can assert that the effect - or, rather, the Sinon
    // spy that is standing in for the effect - was invoked with the expected
    // value.
    expect(effects.onChangeGiven).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: 'Eric',
        },
      })
    )
  })
})

describe('my app state', () => {
  // From the decorated component you can obtained the decorator
  // providing the state directly.
  const { wrapComponentWithState } = AppWithState

  it('supports fullName', async () => {
    // Normally, you'd pass a component as the first argument to your
    // state template.  However, if you pass no argument to the state
    // template, you'll get back a test instance that you can extract
    // `state` and `effects` from.  Just don't try to render the thing!
    const { effects, getState } = wrapComponentWithState()

    expect(getState().fullName).toBe('Walter Harriman')

    await effects.onChangeGiven({ target: { value: 'Alfred' } })
    expect(getState().fullName).toBe('Alfred Harriman')

    await effects.onChangeFamily({ target: { value: 'Hitchcock' } })
    expect(getState().fullName).toBe('Alfred Hitchcock')
  })

  // You could write similar assertions here
  it('supports a greeting')
})
```

## Development

```
# Install dependencies
> yarn

# Run the tests
> yarn test

# Continuously compile
> yarn dev

# Continuously run the tests
> yarn dev-test

# Build for production
> yarn build
```

## Contributions

Contributions are *very* welcomed, either on the documentation or on
the code.

You may:

- report any [issue](https://github.com/julien-f/reaclette/issues)
  you've encountered;
- fork and create a pull request.

## License

ISC © [Julien Fontanet](https://github.com/julien-f)
