"use strict";

const CircularComputedError = require("./_CircularComputedError");

const {
  create,
  defineProperty,
  freeze,
  keys,
  prototype: { hasOwnProperty },
  seal,
} = Object;

const EMPTY_A = freeze([]);
const EMPTY_O = freeze({ __proto__: null });
const noop = Function.prototype;

class Spy {
  constructor(keys, accessor) {
    this._accessor = accessor;
    this._keys = keys;
    this.reset();

    const descriptors = {};
    keys.forEach(key => {
      descriptors[key] = {
        get: () => {
          const accessed = this._accessed;
          let value = accessed[key];
          if (value === undefined && !hasOwnProperty.call(accessed, key)) {
            value = accessed[key] = accessor(key);
          }
          return value;
        },
      };
    });
    this.proxy = create(null, descriptors);
  }

  isUpToDate() {
    const accessed = this._accessed;
    const accessor = this._accessor;
    return keys(accessed).every(key => accessed[key] === accessor(key));
  }

  reset() {
    this._accessed = { __proto__: null };
  }
}

module.exports = ({ Component, PureComponent = Component }) => {
  function withStore({ computed, effects, initialState }, fn) {
    const computedKeys = computed === undefined ? EMPTY_A : keys(computed);
    const effectsKeys = effects === undefined ? EMPTY_A : keys(effects);

    return class Decorated extends PureComponent {
      constructor(props) {
        super(props);

        const stateProxyDescriptors = {};

        let state = initialState === undefined ? EMPTY_O : initialState(props);
        const stateKeys = keys(state);
        // entries are non enumerable to discourage spreading
        stateKeys.forEach(key => {
          stateProxyDescriptors[key] = {
            get: () => state[key],
          };
        });

        if (computedKeys.length !== 0) {
          const fullStateKeys = stateKeys.concat(computedKeys);
          const propsAccessor = k => this.props[k];
          const propsKeys = keys(props);
          const stateAccessor = k => stateProxy[k];

          computedKeys.forEach(key => {
            if (hasOwnProperty.call(state, key)) {
              throw new TypeError(
                `conflict: "${key}" is defined both in state and computed`
              );
            }

            const c = computed[key];
            let promise, propsSpy, stateSpy, value;
            stateProxyDescriptors[key] = {
              get: () => {
                do {
                  if (propsSpy === undefined) {
                    propsSpy = new Spy(propsKeys, propsAccessor);
                    seal(propsSpy.proxy);
                    stateSpy = new Spy(
                      fullStateKeys.filter(_ => _ !== key),
                      stateAccessor
                    );
                    seal(
                      defineProperty(stateSpy.proxy, key, {
                        get() {
                          throw new CircularComputedError(key);
                        },
                      })
                    );
                  } else if (propsSpy.isUpToDate() && stateSpy.isUpToDate()) {
                    break;
                  }

                  propsSpy.reset();
                  stateSpy.reset();

                  try {
                    value = c(stateSpy.proxy, propsSpy.proxy);
                  } catch (error) {
                    if (error instanceof CircularComputedError) {
                      throw error;
                    }

                    console.warn(`computed "${key}" thrown`, error);
                    break;
                  }

                  if (value == null) {
                    break;
                  }

                  if (typeof value.then === "function") {
                    promise = value;
                    value = undefined;

                    // rejections are explicitly not handled
                    const p = promise;
                    promise.then(v => {
                      if (promise === p) {
                        promise = undefined;
                        value = v;
                        this.forceUpdate();
                      }
                    });
                  }
                } while (false);

                return value;
              },
            };
          });
        }

        const stateProxy = seal(create(null, stateProxyDescriptors));

        const resetState = () => {
          // TODO: check new state has the same keys
          state = initialState(this.props);
          this.forceUpdate();

          return Promise.resolve();
        };

        let wrappedEffects;
        if (effectsKeys.length === 0) {
          wrappedEffects = EMPTY_O;
        } else {
          const descriptors = {};
          effectsKeys.forEach(key => {
            const effect = effects[key];

            descriptors[key] = {
              value: function() {
                try {
                  return Promise.resolve(effect.apply(store, arguments)).then(
                    noop
                  );
                } catch (error) {
                  return Promise.reject(error);
                }
              },
            };
          });
          wrappedEffects = seal(create(null, descriptors));

          const stateProxyDescriptors = {};
          stateKeys.forEach(key => {
            stateProxyDescriptors[key] = {
              get: () => state[key],
              set: value => {
                state[key] = value;
                this.forceUpdate();
              },
            };
          });

          const store = seal(
            defineProperty(
              {
                effects: wrappedEffects,
                resetState,
                state: seal(create(stateProxy, stateProxyDescriptors)),
              },
              "props",
              {
                get: () => this.props,
              }
            )
          );
        }

        this._store = seal({
          effects: wrappedEffects,
          resetState,
          state: stateProxy,
        });
      }

      render() {
        return fn(this._store, this.props);
      }
    };
  }
  return { withStore };
};
