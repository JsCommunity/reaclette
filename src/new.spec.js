/* eslint-env jest */

const assert = require("assert");
const { createElement } = require("react");
const { configure, mount } = require("enzyme");

const CircularComputedError = require("./_CircularComputedError");
const { withStore } = require("./");

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

const ownProps = Object.getOwnPropertyNames;

const isReadOnly = object =>
  !Object.isExtensible(object) &&
  ownProps(object).every(name => {
    const descriptor = Object.getOwnPropertyDescriptor(object, name);
    return (
      !descriptor.configurable &&
      (descriptor.set === undefined || !descriptor.writable)
    );
  });

describe("withStore", () => {
  describe("render function", () => {
    it("receives readOnly store and props", async () => {
      const _props = { bar: "baz" };
      const { getRenderArgs } = makeTestInstance(
        {
          initialState: () => ({ myEntry: "bar" }),
          effects: {
            myEffect() {
              this.state.myEntry = "baz";
            },
          },
        },
        _props
      );

      const renderArgs = getRenderArgs();

      const store = renderArgs[0];
      assert(isReadOnly(store));

      const { effects, resetState, state } = store;

      assert(isReadOnly(effects));
      expect(ownProps(effects)).toEqual(["myEffect", "_setState"]);

      expect(typeof resetState).toBe("function");

      assert(isReadOnly(state));
      expect(ownProps(state)).toEqual(["myEntry"]);

      const props = renderArgs[1];
      assert(isReadOnly(props));
      expect(ownProps(props)).toEqual(["bar"]);
    });
  });

  describe("computed", () => {
    it("receive read-only state and props", () => {
      const props = { qux: "qux" };
      const { getState } = makeTestInstance(
        {
          initialState: () => ({
            foo: "foo",
          }),
          computed: {
            bar: () => "bar",
            baz(state, props) {
              assert(isReadOnly(state));
              assert(isReadOnly(props));

              expect(state.foo).toBe("foo");
              expect(state.bar).toBe("bar");
              expect(props.qux).toBe("qux");

              return "baz";
            },
          },
        },
        props
      );

      expect(getState().baz).toBe("baz");
    });

    it("cannot access itself", () => {
      const { getState } = makeTestInstance({
        computed: {
          circular: ({ circular }) => {},
        },
      });

      expect(() => getState().circular).toThrow(CircularComputedError);
    });

    it("are not called when its state/props dependencies do not change", async () => {
      const sum = jest.fn(({ a }, { b }) => a + b);
      const props = { b: 2, c: 9 };
      const { effects, getState, setParentProps } = makeTestInstance(
        {
          initialState: () => ({ a: 1, d: 4 }),
          computed: {
            sum,
          },
        },
        props
      );

      expect(getState().sum).toBe(3);
      expect(sum.mock.calls.length).toBe(1);

      setParentProps({ c: 8 });
      await effects._setState({ d: 8 });

      expect(getState().sum).toBe(3);
      expect(sum.mock.calls.length).toBe(1);
    });

    it("is called when its state/props dependencies change", async () => {
      const sum = jest.fn(({ a }, { b }) => a + b);
      const props = { b: 2, c: 9 };
      const { effects, getState, setParentProps } = makeTestInstance(
        {
          initialState: () => ({ a: 1, d: 4 }),
          computed: {
            sum,
          },
        },
        props
      );

      expect(getState().sum).toBe(3);
      expect(sum.mock.calls.length).toBe(1);

      await effects._setState({ a: 2 });

      expect(getState().sum).toBe(4);
      expect(sum.mock.calls.length).toBe(2);

      setParentProps({ b: 3 });

      expect(getState().sum).toBe(5);
      expect(sum.mock.calls.length).toBe(3);
    });

    describe("async", () => {
      let promise, resolve;
      const reset = () => {
        // eslint-disable-next-line promise/param-names
        promise = new Promise(resolve_ => {
          resolve = resolve_;
        });
      };

      let getState, setParentProps;
      beforeEach(() => {
        ({ getState, setParentProps } = makeTestInstance(
          {
            computed: { value: (_, { foo }) => promise },
          },
          { foo: 1 }
        ));
      });

      it("returns undefined before fulfilment then fulfilment value", async () => {
        reset();

        expect(getState().value).toBe(undefined);

        resolve("foo");
        await promise;

        expect(getState().value).toBe("foo");
      });

      it("follows the latest computation when dependencies change", async () => {
        // trigger computed
        reset();
        expect(getState().value).toBe(undefined);

        const prevPromise = promise;
        const prevResolve = resolve;

        reset();
        setParentProps({ foo: 2 });
        expect(getState().value).toBe(undefined);

        prevResolve("foo");
        await prevPromise;

        expect(getState().value).toBe(undefined);

        resolve("baz");
        await promise;

        expect(getState().value).toBe("baz");
      });
    });
  });

  describe("effects", () => {
    it("receives the passed arguments", () => {
      const args = ["bar", "baz"];
      const { effects } = makeTestInstance({
        effects: {
          foo(...rest) {
            expect(rest).toEqual(args);
          },
        },
      });
      return effects.foo(...args);
    });

    it("are called with read-only effects and props and resetState and writable state in context", () => {
      const { effects, getParentProps } = makeTestInstance({
        initialState: () => ({ myEntry: "bar" }),
        effects: {
          myEffect() {
            assert(isReadOnly(this));

            assert(isReadOnly(this.effects));
            expect(ownProps(this.effects)).toEqual(["myEffect", "_setState"]);

            expect(typeof this.resetState).toBe("function");
            this.state.myEntry = "thud";
            this.resetState();
            expect(this.state.myEntry).toBe("bar");

            expect(ownProps(this.state)).toEqual(["myEntry"]);
            expect(this.state.myEntry).toBe("bar");
            this.state.myEntry = "baz";
            expect(this.state.myEntry).toBe("baz");

            assert(isReadOnly(this.props));
            expect(this.props).toBe(getParentProps());
          },
        },
      });
      return effects.myEffect();
    });

    it("can use other effects", () => {
      const { effects } = makeTestInstance({
        initialState: () => ({ qux: "qux" }),
        effects: {
          async foo() {
            await this.effects.bar();
            expect(this.state.qux).toBe("fred");
          },
          bar() {
            this.state.qux = "fred";
          },
        },
      });
      return effects.foo();
    });
  });
});
