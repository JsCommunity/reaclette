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

describe("withStore", () => {
  describe("render function", () => {
    it("receives the store as first param with effects, state and resetState", async () => {
      const { getRenderArgs } = makeTestInstance({
        initialState: () => ({}),
        effects: {},
      });

      expect(getRenderArgs()[0]).toHaveProperty("effects");
      expect(getRenderArgs()[0]).toHaveProperty("resetState");
      expect(getRenderArgs()[0]).toHaveProperty("state");
    });

    it("receives the props as second param", () => {
      const props = { bar: "baz" };
      const { getRenderArgs } = makeTestInstance(
        {
          initialState: () => ({}),
          effects: {},
        },
        props
      );
      expect(getRenderArgs()[1]).toHaveProperty("bar");
    });
  });
});
