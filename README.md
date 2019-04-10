# reaclette

[![Package Version](https://badgen.net/npm/v/reaclette)](https://npmjs.org/package/reaclette) [![Build Status](https://travis-ci.org/JsCommunity/reaclette.png?branch=master)](https://travis-ci.org/JsCommunity/reaclette) [![BundlePhobia](https://badgen.net/bundlephobia/minzip/reaclette)](https://bundlephobia.com/result?p=reaclette) [![Latest Commit](https://badgen.net/github/last-commit/JsCommunity/reaclette)](https://github.com/JsCommunity/reaclette/commits/master)

> Inspired by Freactal, but better :wink:

Differences with [freactal](https://github.com/FormidableLabs/freactal/):

- `props` are available both in effects and computed values
- computed values are available in the `state` in effects
- `finalize` effect is triggered on unmount (symmetry with `initialize`)
- easy async effects
- no state and effects injection (replace with [React context](https://reactjs.org/docs/context.html))
- async computed support
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

```js
import React from "react";
import { render } from "react-dom";
import { withStore } from "reaclette";

const Component = withStore(
  {
    initialState: props => ({ counter: 0 }),
    effects: {
      addOne() {
        this.state.counter += 1;
      },
    },
    computed: {
      square: (state, props) => state.counter * state.counter,
    },
  },
  (store, props) => (
    <div>
      <p>Our counter is at: {store.state.counter}</p>
      <p>Its squared value is: {store.state.square}</p>
      <p>
        <button onClick={store.effects.addOne}>Add one</button>
      </p>
    </div>
  )
);

render(<Component />, document.body);
```

## API

```js
import { withStore } from "reaclette";
```

### `withStore(options, renderFunction)`

Create a decorator that associates a React component with a store.

`renderFunction`

A function that receives `store` and `props` in parameters and returns a `React node` like so:

```js
(store, props) => ReactNode;
```

- `store`
  Is an object containing the following properties:

  - `state`
  - [`effects`](#effects)
  - [`resetState`](#reset-state)

- `props`
  Passed inputs to React node

`options`

Is an object which can contain the following properties:

#### Initial state

`initialState(props) => object`

This function returns the initial state of store, which can be computed from the properties of the decorated component.

```js
{
  initialState: (props) => ({ counter: 0 }),
}
```

#### Effects

`effects: { [string]: Effect }`

These functions can be called from application code and can do side-effects and/or mutate the state.

When called, an effect is provided with one or more arguments: a reference to other effects and any arguments passed to the effect from the application code.

Effects can access effects, state (read and write) and props (at the time the effect was called) via `this`, which is extremely
handy for async effects:

```js
const Component = withStore(
  {
    initialState: () => ({
      data: undefined,
      loading: false,
    }),
    effects: {
      loadData: async function() {
        const { state } = this;
        const { effects } = this;
        if (state.data !== undefined || state.loading) {
          return;
        }

        state.loading = true;
        try {
          state.data = await fetchData();
        } finally {
          state.loading = false;
        }
      },
    },
  },
  (store, props) => (
    <div>
      {store.state.loading ? (
        "Loading..."
      ) : (
        <pre>{JSON.stringify(store.state.data, null, " ")}</pre>
      )}
    </div>
  )
);

render(<Component />, document.body);
```

Effects are always asynchronous; therefore, they must always be awaited.

```js
const Component = withStore(
  {
    initialState: props => ({ counter: 0 }),
    effects: {
      async addOne() {
        const { state } = this;
        const { effects } = this;
        state.counter += 1;
        if (state.counter > 5) {
          await effects.addBonus();
        }
      },
      addBonus() {
        this.state.counter += 5;
      },
    },
  },
  (store, props) => (
    <div>
      <p>Our counter is at: {store.state.counter}</p>
      <p>
        <button onClick={store.effects.addOne}>Add one</button>
      </p>
    </div>
  )
);

render(<Component />, document.body);
```

There are two special effects:

- `initialize`: automatically called just after the component is mounted;
- `finalize`: automatically called just before the component is unmounted.

Note that these effects are **not called** on server side!

#### Computed

`computed: { [string]: Compute }`

_Computeds_ are lazy values derived from the state and the properties of the decorated component.

They are automatically (re-)computed when necessary.

```js
{
  computed: {
    fullName: (state, props) => `${props.firstName} ${props.lastName}`,
  }
}
```

> Note: you should avoid accessing state/props entries that you are not using (even via destructuring) because it will make Reaclette think that you are using them and might trigger unnecessary recomputations.

Compute functions can be async which is extremely useful to fetch data:

```js
const CitySelector = withStore(
  {
    computed: {
      // the computed is undefined in the render before the promise settles
      //
      // rejections are not handled and will possibly trigger an
      // unhandledRejection event on the window object, the computed will stay
      // undefined
      async cities({ country }) {
        const response = await fetch(`/countries/${state.country}/cities`);
        return response.json();
      },
    },
  },
  (store, props) => (
    <select onChange={props.onChange} value={props.value}>
      {store.state.cities !== undefined
        ? store.state.cites.map(city => <option>{city}</option>)
        : null}
    </select>
  )
);

render(<CitySelector />, document.body);
```

Even though computed can use state and props, they don't have to:

```js
  computed: {
    // this id will be generated only once for the life of the component
    formId: () => `i${Math.random().toString(36).slice(2)}`,
  }
}
```

#### Reset state

This function resets the state by calling `initialState` with the current properties of the decorated component.

> It is very similar to an effect in that it update the state and returns a promise.

This pseudo-effect is passed as a property by `injectState`:

```js
const Component = withStore(
  {
    initialState: () => ({}),
    effects: {},
  },
  (store, props) => <form onReset={store.resetState}>{/* ... */}</form>
);
```

And also available from effects via their context:

```js
const Component = withStore(
  {
    // ...
    effects: {
      async myEffect() {
        await this.resetState();
      },
    },
  },
  (store, props) => <button onClick={store.effects.myEffect}>Reset</button>
);
```

## Recipes

### Usage with PReact

```js
/** @jsx Preact.h */
import Preact, { render } from "preact";
import factory from "reaclette/factory";

const { withStore } = factory(Preact);

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

# Build for production
> yarn build
```

## Contributions

Contributions are _very_ welcomed, either to the documentation or to
the code.

You may:

- report any [issue](https://github.com/JsCommunity/reaclette/issues)
  you've encountered;
- fork and create a pull request.

## License

ISC © [Julien Fontanet](https://github.com/julien-f)
