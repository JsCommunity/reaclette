/* eslint-env jest */

const { createElement } = require("react");
const { configure, mount } = require("enzyme");

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

const isReadOnly = object =>
  !Object.isExtensible(object) &&
  Object.getOwnPropertyNames(object).every(name => {
    const descriptor = Object.getOwnPropertyDescriptor(object, name);
    return (
      !descriptor.configurable &&
      (descriptor.set === undefined || !descriptor.writable)
    );
  });

describe("withStore", () => {
  describe("render function", () => {
    it("returns readOnly state, effects, props and resetState func", async () => {
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
      expect(isReadOnly(store));

      const { effects, resetState, state } = store;

      expect(isReadOnly(effects));
      expect(Object.getOwnPropertyNames(effects)).toEqual([
        "myEffect",
        "_setState",
      ]);

      expect(typeof resetState).toBe("function");

      expect(isReadOnly(state));
      expect(Object.getOwnPropertyNames(state)).toEqual(["myEntry"]);

      const props = renderArgs[1];
      expect(isReadOnly(props));
      expect(Object.getOwnPropertyNames(props)).toEqual(["bar"]);
    });
  });
});
