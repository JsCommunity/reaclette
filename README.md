# @julien-f/freactal [![Build Status](https://travis-ci.org/${pkg.shortGitHubPath}.png?branch=master)](https://travis-ci.org/${pkg.shortGitHubPath})

> ${pkg.description}

Differences with [freactal](https://github.com/FormidableLabs/freactal/):

- `props` are available both in effects and computed values
- computed values are available in the `state` in effects
- `finalize` effect is triggered on unmount (symmetry with `initialize`)
- no [helper functions](https://github.com/FormidableLabs/freactal#helper-functions) (not necessary)
- no [hydrate support](https://github.com/FormidableLabs/freactal#hydrate-and-initialize)
- no [middlewares support](https://github.com/FormidableLabs/freactal/#middleware)
- no [test instances support](https://github.com/FormidableLabs/freactal/#state-and-effects)

## Install

Installation of the [npm package](https://npmjs.org/package/@julien-f/freactal):

```
> npm install --save @julien-f/freactal
```

## Usage

### With React

```js
import React from 'react'
import { render } from 'react-dom'
import { injectState, provideState } from '@julien-f/freactal'

const wrapComponentWithState = provideState({
  initialState: () => ({ counter: 0 }),
  effects: {
    addOne: () => (state, props) => ({ ...state, counter: state.counter + 1 }),
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
import factory from '@julien-f/freactal/factory'

const { injectState, provideState } = factory(Preact)

// The rest is the same.
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

# Build for production (automatically called by npm install)
> yarn build
```

## Contributions

Contributions are *very* welcomed, either on the documentation or on
the code.

You may:

- report any [issue](${pkg.bugs})
  you've encountered;
- fork and create a pull request.

## License

ISC © [Julien Fontanet](https://github.com/julien-f)
