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
        initialState: () => ({}),
        computed: {
          circularComputed: ({ circularComputed }) => {},
        },
      });

      expect(() => {
        return getState().circularComputed;
      }).toThrow(CircularComputedError);
    });
  });
});
