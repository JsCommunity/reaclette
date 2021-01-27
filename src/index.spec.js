/* eslint-env jest */
import CircularComputedError from "./_CircularComputedError";
import InvalidEntryError from "./_InvalidEntryError";

require("raf/polyfill");
const { createElement } = require("react");
const { configure, mount } = require("enzyme");

const { injectState, provideState } = require("./");

configure({ adapter: new (require("enzyme-adapter-react-16"))() });

const makeTestInstance = (opts, props) => {
  let renderCount = 0;
  const Child = () => {
    ++renderCount;
    return null;
  };
  const parent = mount(
    createElement(
      provideState({
        ...opts,
        effects: {
          ...opts.effects,
          _setState: (_, props) => (_) => props,
        },
      })(injectState(Child)),
      props
    )
  );
  const child = parent.find(Child);
  return {
    effects: child.prop("effects"),
    getInjectedState: () => child.prop("state"),
    getParentState: () => parent.instance()._state,
    getParentProps: () => parent.instance().props,
    getRenderCount: () => renderCount,
    resetState: child.prop("resetState"),
    setParentProps: parent.setProps.bind(parent),
  };
};

const noop = () => {};

describe("provideState", () => {
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
        ).getInjectedState()
      ).toEqual({ foo: "bar" });
    });
  });

  describe("resetState", () => {
    it("is called to reset the state to its initial values in effects", async () => {
      const props = { bar: "baz" };
      const { effects, getInjectedState } = makeTestInstance(
        {
          initialState: () => ({
            foo: "bar",
          }),
          effects: {
            changeState(_, value) {
              return { foo: value };
            },
            async reset() {
              await this.resetState();
            },
          },
        },
        props
      );
      await effects.changeState("foo");
      expect(getInjectedState()).toEqual({ foo: "foo" });
      await effects.reset();
      expect(getInjectedState()).toEqual({ foo: "bar" });
    });

    it("is called to reset the state to its initial values in child", async () => {
      const props = { bar: "baz" };
      const { effects, getInjectedState, resetState } = makeTestInstance(
        {
          initialState: () => ({
            foo: "bar",
          }),
          effects: {
            changeState(_, value) {
              return { foo: value };
            },
          },
        },
        props
      );

      await effects.changeState("foo");
      expect(getInjectedState()).toEqual({ foo: "foo" });
      await resetState();
      expect(getInjectedState()).toEqual({ foo: "bar" });
    });
  });

  describe("effects", () => {
    it("are called with other effects followed by arguments", () => {
      const args = ["bar", "baz"];
      const { effects } = makeTestInstance({
        effects: {
          foo: (first, ...rest) => {
            expect(first).toBe(effects);
            expect(rest).toEqual(args);
          },
        },
      });
      return effects.foo(...args);
    });

    describe("this.state", () => {
      it.todo("can access parent state entries");
    });

    it("are called with effects, props and state in context", () => {
      const { effects, getParentProps } = makeTestInstance({
        initialState: () => ({ foo: "bar" }),
        effects: {
          foo() {
            expect(this.effects).toBe(effects);
            expect(this.props).toBe(getParentProps());
            expect(this.state).toEqual({ foo: "bar" });
          },
        },
      });
      return effects.foo();
    });

    it("always returns a Promise to undefined", () => {
      const { effects } = makeTestInstance({
        effects: {
          foo: () => {},
        },
      });
      return effects.foo().then((value) => {
        expect(value).toBe(undefined);
      });
    });

    it("throws if an invalid state entry is assigned", () => {
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
      const { effects, getInjectedState, getRenderCount } = makeTestInstance({
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
      expect(getInjectedState().foo).toBe(0);

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
    const { effects, getInjectedState, setParentProps } = makeTestInstance(
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
      getInjectedState();
      expect(sum).not.toHaveBeenCalled();
    });

    it("returns the result of the computation", () => {
      expect(getInjectedState().sum).toBe(4);
      expect(sum).toHaveBeenCalledTimes(1);
    });

    it("is not recomputed when its inputs do not change ", () => {
      setParentProps({ baz: 5 });
      return effects._setState({ qux: 3 }).then(() => {
        noop(getInjectedState().sum);
        expect(sum).toHaveBeenCalledTimes(1);
      });
    });

    it("is recomputed when its state inputs change", () => {
      return effects._setState({ foo: 2 }).then(() => {
        expect(getInjectedState().sum).toBe(5);
        expect(sum).toHaveBeenCalledTimes(2);
      });
    });

    it("is recomputed when its props inputs change", () => {
      setParentProps({ bar: 4 });
      expect(getInjectedState().sum).toBe(6);
      expect(sum).toHaveBeenCalledTimes(3);
    });

    it("throws when a computed calls its self", () => {
      expect(() => {
        return getInjectedState().circularComputed;
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
      const res = getInjectedState().throwComputed;
      expect(res).toBe(undefined);
    });

    it("returns previous value when a computed throws", () => {
      setParentProps({ baz: 5 });
      expect(getInjectedState().throwComputed).toBe(10);
      setParentProps({ baz: 21 });
      expect(getInjectedState().throwComputed).toBe(10);
    });

    it("can returns a promise", async () => {
      let promise, resolve;
      const reset = () => {
        // eslint-disable-next-line promise/param-names
        promise = new Promise((resolve_) => {
          resolve = resolve_;
        });
      };
      reset();

      const { getInjectedState, setParentProps } = makeTestInstance(
        {
          computed: { value: (_, { foo }) => promise },
        },
        { foo: 1 }
      );

      // trigger a first computation
      expect(getInjectedState().value).toBe(undefined);

      const prevPromise = promise;
      const prevResolve = resolve;

      // trigger a second computation
      reset();
      setParentProps({ foo: 2 });
      expect(getInjectedState().value).toBe(undefined);

      // resolve them in reverse order
      resolve("bar");
      await promise;
      prevResolve("foo");
      await prevPromise;

      // the last computation should win
      expect(getInjectedState().value).toBe("bar");
    });

    it("can have a placeholder", async () => {
      const { getInjectedState } = makeTestInstance({
        computed: {
          value: {
            get: () => Promise.resolve(1),
            placeholder: 0,
          },
        },
      });

      expect(getInjectedState().value).toBe(0);

      await Promise.resolve();

      expect(getInjectedState().value).toBe(1);
    });
  });
});
