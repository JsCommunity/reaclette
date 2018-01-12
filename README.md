# freactal2 [![Build Status](https://travis-ci.org/${pkg.shortGitHubPath}.png?branch=master)](https://travis-ci.org/${pkg.shortGitHubPath})

> ${pkg.description}

Differences with [freactal](https://github.com/FormidableLabs/freactal/):

- `props` are available both in effects and computed values
- computed values are available in the `state` in effects
- effects returns updated properties, not a complete new state, i.e. you don't need to merge the previous state yourself

## Install

Installation of the [npm package](https://npmjs.org/package/freactal2):

```
> npm install --save freactal2
```

## Usage

### With React

```js
import React from 'react'
import { render } from 'react-dom'
import { injectState, provideState } from 'freactal2'

const wrapComponentWithState = provideState({
  initialState: () => ({ counter: 0 }),
  effects: {
    addOne: () => (state, props) => ({ counter: state.counter + 1 }),
  },
  computed: {
    square: (state, props) => state.counter * state.counter,
  }
})

const Parent = wrapComponentWithState(() =>
  <Child />
)

const Child = injecState(({ effects, state }) =>
  <div>
    Out counter is at: {state.counter}
    <button onClick={effects.addOne}>Add one</button>
  </div>
)

render(<Parent />, document.body)
```

### With PReact

```js
/** @jsx Preact.h */
import Preact, { render } from 'preact'
import factory from 'freactal2/factory'

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
