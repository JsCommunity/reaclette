# reaclette [![Build Status](https://travis-ci.org/julien-f/reaclette.png?branch=master)](https://travis-ci.org/julien-f/reaclette)

> Inspired by Freactal, but better :wink:

Differences with [freactal](https://github.com/FormidableLabs/freactal/):

- `props` are available both in effects and computed values
- computed values are available in the `state` in effects
- `finalize` effect is triggered on unmount (symmetry with `initialize`)
- easy async effects
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
import { injectState, provideState } from "reaclette";

const wrapComponentWithState = provideState({
  initialState: () => ({ counter: 0 }),
  effects: {
    addOne: () => (state, props) => ({ counter: state.counter + 1 }),
  },
  computed: {
    square: (state, props) => state.counter * state.counter,
  },
});

const Parent = wrapComponentWithState(() => <Child />);

const Child = injectState(({ effects, state }) => (
  <div>
    <p>Out counter is at: {state.counter}</p>
    <p>
      <button onClick={effects.addOne}>Add one</button>
    </p>
  </div>
));

render(<Parent />, document.body);
```

## API

```js
import { provideState, injectState } from "reaclette";
```

### `provideState(options) => (Component => Component)`

Create a decorator that associates a React component with a store.

`options` is an object which can contain the following properties.

#### `initialState(props) => object`

This function returns the initial state of store, which can be computed from the properties of the decorated component.

```js
{
  initialState: (props) => ({ counter: 0 }),
}
```

#### `effects: { [string]: Effect }`

These functions can be called from application code (see `injectState`) and can do side-effects and/or mutate the state.

When called, an effect is provided with one or more arguments: a reference to other effects and any arguments passed to the effect from the application code.

An effect can return:

1. nothing (`undefined` or `null`)
2. an object containing new properties to merge in the state
3. a promise resolving to one of the above
4. a function which receives the state and the props then returns one of the above

```js
{
  effects: {
    incrementCounter: (effects) => (state, props) => ({ counter: state.counter + 1 }),
    onInputChange: (effects, event) => ({ counter: +event.target.value }),
  }
}
```

Effects can also access effects, state (read and write) and props via `this`, which is extremely
handy for async effects:

```js
provideState({
  initialState: () => ({
    data: undefined,
    loading: false,
  }),
  effects: {
    loadData: async function() {
      const { state } = this;
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
});
```

#### `computed: { [string]: Compute }`

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
const CitySelector = provideState({
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
})(
  injectState(({ onChange, state, effects, value }) => (
    <select onChange={onChange} value={value}>
      {state.cities !== undefined
        ? state.cites.map(city => <option>{city}</option>)
        : null}
    </select>
  ))
);
```

Even though computed can use state and props, they don't have to:

```js
  computed: {
    // this id will be generated only once for the life of the component
    formId: () => `i${Math.random().toString(36).slice(2)}`,
  }
}
```

### `injectState(Component) => Component`

Makes

## Recipes

### Usage with PReact

```js
/** @jsx Preact.h */
import Preact, { render } from "preact";
import factory from "reaclette/factory";

const { injectState, provideState } = factory(Preact);

// The rest is the same.
```

### Testing

> This example comes from the excellent [Freactal documentation](https://github.com/FormidableLabs/freactal/#testing).

`App.js`:

```js
import React from "react";
import { injectState, provideState } from "reaclette";

export default provideState({
  initialState: () => ({
    givenName: "Walter",
    familyName: "Harriman",
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
          Enter your given name:{" "}
          <input
            id="given"
            onChange={effects.onChangeGiven}
            value={state.givenName}
          />
        </label>
      </p>
      <p>
        <label>
          Enter your family name:{" "}
          <input
            id="family"
            onChange={effects.onChangeFamily}
            value={state.familyName}
          />
        </label>
      </p>
    </div>
  ))
);
```

`App.spec.js`:

```js
import React from "react";
import Adapter from "enzyme-adapter-react-16";
import { configure, mount } from "enzyme";

configure({ adapter: new Adapter() });

import AppWithState from "./App.js";

describe("my app", () => {
  // From the decorated component you can obtained the plain version
  // directly.
  const App = AppWithState.WrappedComponent;

  // We'll be re-using these values, so let's put it here for convenience.
  const state = {
    givenName: "Charlie",
    familyName: "In-the-box",
    fullName: "Charlie In-the-box",
    greeting: "Howdy there, kid!",
  };

  it("displays a greeting to the user", () => {
    // This test should be easy - all we have to do is ensure that
    // the string that is passed in is displayed correctly!

    // We're not doing anything with effects here, so let's not bother
    // setting them for now...
    const effects = {};

    // First, we mount the component, providing the expected state and effects.
    const el = mount(<App state={state} effects={effects} />);

    // And then we can make assertions on the output.
    expect(el.find("#greeting").text()).toBe("Howdy there, kid!");
  });

  it("accepts changes to the given name", () => {
    // Next we're testing the conditions under which our component might
    // interact with the provided effects.
    const effects = {
      onChangeGiven: jest.fn(),
      onChangeFamily: jest.fn(),
    };

    const el = mount(<App state={state} effects={effects} />);

    // We don't expect our effect to be invoked when the component
    // mounts, so let's make that assertion here.
    expect(effects.onChangeGiven).not.toHaveBeenCalled();

    // Next, we can simulate a input-box value change.
    el.find("input#given").simulate("change", {
      target: { value: "Eric" },
    });

    // And finally, we can assert that the effect - or, rather, the Sinon
    // spy that is standing in for the effect - was invoked with the expected
    // value.
    expect(effects.onChangeGiven).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: "Eric",
        },
      })
    );
  });
});

describe("my app state", () => {
  // From the decorated component you can obtained the decorator
  // providing the state directly.
  const { wrapComponentWithState } = AppWithState;

  it("supports fullName", async () => {
    // Normally, you'd pass a component as the first argument to your
    // state template.  However, if you pass no argument to the state
    // template, you'll get back a test instance that you can extract
    // `state` and `effects` from.  Just don't try to render the thing!
    const { effects, getState } = wrapComponentWithState();

    expect(getState().fullName).toBe("Walter Harriman");

    await effects.onChangeGiven({ target: { value: "Alfred" } });
    expect(getState().fullName).toBe("Alfred Harriman");

    await effects.onChangeFamily({ target: { value: "Hitchcock" } });
    expect(getState().fullName).toBe("Alfred Hitchcock");
  });

  // You could write similar assertions here
  it("supports a greeting");
});
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

- report any [issue](https://github.com/julien-f/reaclette/issues)
  you've encountered;
- fork and create a pull request.

## License

ISC © [Julien Fontanet](https://github.com/julien-f)
