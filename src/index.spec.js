/* eslint-env jest */

require("raf/polyfill");
const { createElement } = require("react");
const { configure, mount } = require("enzyme");

const { withStore } = require("./");
const CircularComputedError = require("./_CircularComputedError");

configure({ adapter: new (require("enzyme-adapter-react-16"))() });

const makeTestInstance = (opts, props) => {
  let renderCount = 0;
  let renderArgs;
  const parent = mount(
    createElement(
      withStore(
        {
          ...opts,
          effects: {
            ...opts.effects,
            _setState(props) {
              Object.assign(this.state, props);
            },
          },
        },
        (...args) => {
          ++renderCount;
          renderArgs = args;
          return null;
        }
      ),
      props
    )
  );
  return {
    effects: renderArgs[0].effects,
    getParentProps: () => parent.instance().props,
    getRenderArgs: () => renderArgs,
    getRenderCount: () => renderCount,
    getState: () => renderArgs[0].state,
    setParentProps: parent.setProps.bind(parent),
  };
};

const noop = () => {};

describe("withStore", () => {
  describe("initialState", () => {
    it("is called with the props to create the initial state", () => {
      const props = { bar: "baz" };
      expect(
        makeTestInstance(
          {
            initialState: (...args) => {
              expect(args).toEqual([props]);
              return { foo: "bar" };
            },
          },
          props
        ).getState()
      ).toEqual({ foo: "bar" });
    });
  });

  describe("resetState", () => {
    it("resets the state by calling initialState from effects", async () => {
      const props = { bar: "baz" };
      const { effects, getState } = makeTestInstance(
        {
          initialState: () => ({
            foo: "bar",
          }),
          effects: {
            changeState(value) {
              this.state.foo = value;
            },
            async reset() {
              await this.resetState();
            },
          },
        },
        props
      );
      await effects.changeState("foo");
      expect(getState()).toEqual({ foo: "foo" });
      await effects.reset();
      expect(getState()).toEqual({ foo: "bar" });
    });

    it("resets the state by calling initialState from child", async () => {
      const props = { bar: "baz" };
      const { effects, getState, getRenderArgs } = makeTestInstance(
        {
          initialState: () => ({
            foo: "bar",
          }),
          effects: {
            changeState(value) {
              this.state.foo = value;
            },
          },
        },
        props
      );

      await effects.changeState("foo");
      expect(getState()).toEqual({ foo: "foo" });
      await getRenderArgs()[0].resetState();
      expect(getState()).toEqual({ foo: "bar" });
    });
  });

  describe("effects", () => {
    it("are called with arguments", () => {
      const args = ["bar", "baz"];
      const { effects } = makeTestInstance({
        effects: {
          foo: (...rest) => {
            expect(rest).toEqual(args);
          },
        },
      });
      return effects.foo(...args);
    });

    it("are called with effects, props and state in context", () => {
      const state = { foo: "bar" };
      const { effects, getParentProps } = makeTestInstance({
        initialState: () => state,
        effects: {
          foo() {
            expect(this.effects).toBe(effects);
            expect(this.props).toBe(getParentProps());
            expect(state).toEqual(this.state);
          },
        },
      });
      return effects.foo();
    });

    it("always returns a Promise to undefined", () => {
      const { effects } = makeTestInstance({
        effects: {
          foo: () => "foo",
        },
      });
      return effects.foo().then(value => {
        expect(value).toBe(undefined);
      });
    });

    // FIXME: for the new implementation
    it.skip("throws if an invalid state entry is assigned", () => {
      const { effects } = makeTestInstance({
        initialState: () => ({}),
        effects: {
          foo() {
            return { qux: 3 };
          },
        },
      });

      return expect(effects.foo()).rejects.toThrowError(
        new InvalidEntryError("qux")
      );
    });

    it("sync state changes are batched", async () => {
      const { effects, getState, getRenderCount } = makeTestInstance({
        initialState: () => ({ foo: 0 }),
        effects: {
          foo() {
            this.state.foo = 1;
            this.state.foo = 2;
          },
        },
      });

      expect(getRenderCount()).toBe(1);

      // access this state to make sure children is rerendered when it changes
      expect(getState().foo).toBe(0);

      await effects.foo();

      expect(getRenderCount()).toBe(2);
    });
  });

  describe("computed", () => {
    const sum = jest.fn(({ foo }, { bar }) => foo + bar);
    const circularComputed = jest.fn(({ circularComputed }) => {});
    const throwComputed = jest.fn((_, { baz }) => {
      if (baz > 20) {
        throw new Error("Not supported value");
      }
      return baz * 2;
    });
    const { effects, getState, setParentProps } = makeTestInstance(
      {
        initialState: () => ({ foo: 1, qux: 2 }),
        computed: {
          sum,
          circularComputed,
          throwComputed,
        },
      },
      { bar: 3, baz: 4 }
    );

    it("is not computed before access", () => {
      expect(sum).not.toHaveBeenCalled();
    });

    it("returns the result of the computation", () => {
      expect(getState().sum).toBe(4);
      expect(sum).toHaveBeenCalledTimes(1);
    });

    it("is not recomputed when its inputs do not change ", () => {
      setParentProps({ baz: 5 });
      return effects._setState({ qux: 3 }).then(() => {
        noop(getState().sum);
        expect(sum).toHaveBeenCalledTimes(1);
      });
    });

    it("is recomputed when its state inputs change", () => {
      return effects._setState({ foo: 2 }).then(() => {
        expect(getState().sum).toBe(5);
        expect(sum).toHaveBeenCalledTimes(2);
      });
    });

    it("is recomputed when its props inputs change", () => {
      setParentProps({ bar: 4 });
      expect(getState().sum).toBe(6);
      expect(sum).toHaveBeenCalledTimes(3);
    });

    it("throws when a computed calls its self", () => {
      expect(() => {
        return getState().circularComputed;
      }).toThrowError(new CircularComputedError("circularComputed"));
    });

    it("throws when a computed is defined both in state and computed", () => {
      expect(() => {
        makeTestInstance({
          initialState: () => ({ foo: 0 }),
          computed: {
            foo: () => {},
          },
        });
      }).toThrowError(
        new TypeError(`conflict: "foo" is defined both in state and computed`)
      );
    });

    it("returns undefined when a computed throws on the first call", () => {
      setParentProps({ baz: 21 });
      const res = getState().throwComputed;
      expect(res).toBe(undefined);
    });

    it("returns previous value when a computed throws", () => {
      setParentProps({ baz: 5 });
      expect(getState().throwComputed).toBe(10);
      setParentProps({ baz: 21 });
      expect(getState().throwComputed).toBe(10);
    });

    it("can returns a promise", async () => {
      let promise, resolve;
      const reset = () => {
        // eslint-disable-next-line promise/param-names
        promise = new Promise(resolve_ => {
          resolve = resolve_;
        });
      };
      reset();

      const { getState, setParentProps } = makeTestInstance(
        {
          computed: { value: (_, { foo }) => promise },
        },
        { foo: 1 }
      );

      // trigger a first computation
      expect(getState().value).toBe(undefined);

      const prevPromise = promise;
      const prevResolve = resolve;

      // trigger a second computation
      reset();
      setParentProps({ foo: 2 });
      expect(getState().value).toBe(undefined);

      // resolve them in reverse order
      resolve("bar");
      await promise;
      prevResolve("foo");
      await prevPromise;

      // the last computation should win
      expect(getState().value).toBe("bar");
    });
  });
});
