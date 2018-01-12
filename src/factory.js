// React does not support symbols :/
const TAG = '@julien-f/freactal'

const call = f => f()
const noop = () => {}
const { create, keys } = Object

const makeSpy = (keys, accessor) => {
  const descriptors = create(null)
  const spy = new Map()
  keys.forEach(k => {
    descriptors[k] = {
      enumerable: true,
      get: () => {
        let v = spy.get(k)
        if (v === undefined && !spy.has(k)) {
          v = accessor(k)
          spy.set(k, v)
        }
        return v
      },
    }
  })
  spy.upToDate = () => {
    for (const [key, value] of spy) {
      if (accessor(key) !== value) {
        return false
      }
    }
    return true
  }
  return [create(null, descriptors), spy]
}

module.exports = ({ Component, createElement, PropTypes }) => {
  const contextTypes_ = {
    [TAG]:
      PropTypes !== undefined
        ? PropTypes.shape({
          effects: PropTypes.object.isRequired,
          state: PropTypes.object.isRequired,
          subscribe: PropTypes.func.isRequired,
        })
        : noop,
  }

  const injectState = ChildComponent =>
    class StateInjector extends Component {
      static contextTypes = contextTypes_;

      constructor (_, context) {
        super()

        const parent = context[TAG]
        if (parent === undefined) {
          throw new TypeError('missing state')
        }

        const { state } = parent;
        [this._stateProxy, this._stateSpy] = makeSpy(
          parent.stateKeys,
          k => state[k]
        )
      }

      componentDidMount () {
        const spy = this._stateSpy
        this.componentWillUnmount = this.context[TAG].subscribe(() => {
          if (!spy.upToDate()) {
            this.forceUpdate()
          }
        })
      }

      render () {
        this._stateSpy.clear()

        return createElement(ChildComponent, {
          ...this.props,
          effects: this.context[TAG].effects,
          state: this._stateProxy,
        })
      }
    }

  const provideState = ({
    computed,
    effects,
    initialState,
  }) => ChildComponent =>
    class StateProvider extends Component {
      static childContextTypes = contextTypes_;
      static contextTypes = contextTypes_;

      constructor (props, context) {
        super()

        const listeners = new Set()
        const dispatch = (this._dispatch = () => {
          // computedCache.clear()
          listeners.forEach(call)
        })
        this._subscribe = listener => {
          listeners.add(listener)
          return () => {
            listeners.delete(listener)
          }
        }

        let parentEffects, parentState
        {
          const parent = context[TAG]
          if (parent !== undefined) {
            parentEffects = parent.effects
            parentState = parent.state
          }
        }

        const stateDescriptors = create(null)

        let state
        if (initialState !== undefined) {
          state = initialState(props)

          keys(state).forEach(k => {
            stateDescriptors[k] = {
              enumerable: true,
              get: () => state[k],
            }
          })
        }

        if (computed !== undefined) {
          const propsKeys = keys(props)
          const propsAccessor = k => this.props[k]
          const stateAccessor = k => this._state[k]

          // computed properties are non-enumerable to behave with effects
          keys(computed).forEach(k => {
            const c = computed[k]
            let previousValue, propsProxy, propsSpy, stateProxy, stateSpy
            stateDescriptors[k] = {
              get: () => {
                if (propsProxy === undefined) {
                  [propsProxy, propsSpy] = makeSpy(propsKeys, propsAccessor);
                  [stateProxy, stateSpy] = makeSpy(this._stateKeys, stateAccessor)
                } else if (propsSpy.upToDate() && stateSpy.upToDate()) {
                  return previousValue
                }
                propsSpy.clear()
                stateSpy.clear()
                return (previousValue = c(stateProxy, propsProxy))
              },
            }
          })
        }

        this._stateKeys = Object.keys(stateDescriptors)
        const stateWrapper = (this._state = create(
          parentState || null,
          stateDescriptors
        ))

        let effectsDescriptors
        if (effects !== undefined) {
          const setState = updater => {
            if (updater !== undefined) {
              const newState = updater(stateWrapper, this.props)
              if (newState != null) {
                state = newState
                dispatch()
              }
            }
          }

          effectsDescriptors = create(null)
          keys(effects).forEach(k => {
            const e = effects[k]
            effectsDescriptors[k] = {
              enumerable: true,
              value: (...args) => {
                return new Promise(resolve =>
                  resolve(e(effects, ...args))
                ).then(setState)
              },
            }
          })
        }
        this._effects = create(parentEffects || null, effectsDescriptors)
      }

      _unsubscribe = noop;

      componentDidMount () {
        const parent = this.context[TAG]
        if (parent !== undefined) {
          this._unsubscribe = parent.subscribe(this._dispatch)
        }

        const { initialize } = this._effects
        if (initialize !== undefined) {
          initialize()
        }
      }

      componentDidUpdate () {
        this._dispatch()
      }

      componentWillUnmount () {
        const { finalize } = this._effects
        if (finalize !== undefined) {
          finalize()
        }

        this._unsubscribe()
        this._unsubscribe = noop
      }

      getChildContext () {
        return {
          [TAG]: {
            effects: this._effects,
            state: this._state,
            stateKeys: this._stateKeys,
            subscribe: this._subscribe,
          },
        }
      }

      render () {
        return createElement(ChildComponent, this.props)
      }
    }

  return { injectState, provideState }
}
