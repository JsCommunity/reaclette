import CircularComputedError from './_CircularComputedError'

// React does not support symbols :/
const TAG = 'reaclette'

const call = f => f()
const isPromise = v => v != null && typeof v.then === 'function'
const noop = Function.prototype
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

const defaultEffects = {
  linkState: (_, { target }) => () => ({
    [target.name]: target.nodeName.toLowerCase() === 'input' &&
      target.type.toLowerCase() === 'checkbox'
      ? target.checked
      : target.value,
  }),
  toggleState: (_, { currentTarget: { name } }) => state => ({ [name]: !state[name] }),
}

defaultEffects.linkState.trim = (_, { target }) => state => {
  const { name } = target
  if (target.nodeName.toLowerCase() === 'input' &&
    target.type.toLowerCase() === 'checkbox') {
    return {
      [name]: target.checked,
    }
  }

  const { value } = target
  return {
    [name]: typeof value === 'string' ? value.trim() : value,
  }
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
      static WrappedComponent = ChildComponent;

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
          resetState: this.context[TAG].resetState,
          state: this._stateProxy,
        })
      }
    }

  const provideState = ({ computed, effects, initialState }) => {
    const wrapComponentWithState = ChildComponent => {
      class StateProvider extends Component {
        static WrappedComponent = (ChildComponent != null &&
          ChildComponent.WrappedComponent) ||
          ChildComponent;
        static wrapComponentWithState = wrapComponentWithState;

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

          const stateDescriptors = create(null)

          if (computed !== undefined) {
            const propsKeys = keys(props)
            const propsAccessor = k => this.props[k]
            const stateAccessor = k => completeState[k]

            keys(computed).forEach(k => {
              const c = computed[k]
              let previousValue, propsProxy, propsSpy, stateProxy, stateSpy
              stateDescriptors[k] = {
                get: () => {
                  if (propsProxy === undefined) {
                    [propsProxy, propsSpy] = makeSpy(propsKeys, propsAccessor);
                    [stateProxy, stateSpy] = makeSpy(
                      completeStateKeys.filter(key => key !== k),
                      stateAccessor
                    )

                    Object.defineProperty(stateProxy, k, {
                      get () {
                        throw new CircularComputedError(k)
                      },
                    })
                  } else if (propsSpy.upToDate() && stateSpy.upToDate()) {
                    return isPromise(previousValue) ? undefined : previousValue
                  }

                  propsSpy.clear()
                  stateSpy.clear()
                  previousValue = c(stateProxy, propsProxy)
                  if (!isPromise(previousValue)) {
                    return previousValue
                  }

                  // rejections are explicitly not handled
                  const promise = previousValue
                  previousValue.then(
                    value => {
                      if (previousValue === promise) {
                        previousValue = value
                        dispatch()
                      }
                    }
                  )
                },
              }
            })
          }

          let state
          if (initialState !== undefined) {
            state = initialState(props)
            effects = { ...defaultEffects, ...effects }

            keys(state).forEach(k => {
              if (!(k in stateDescriptors)) {
                // only local, non-computed state entries are enumerable
                stateDescriptors[k] = {
                  enumerable: true,
                  get: () => state[k],
                  set: value => {
                    state = { ...state, [k]: value }
                    dispatch()
                  },
                }
              }
            })
          }

          let parentEffects = null
          let parentState = null
          let parentStateKeys = []
          {
            const parent = context[TAG]
            if (parent !== undefined) {
              parentEffects = parent.effects
              parentState = parent.state
              parentStateKeys = parent.stateKeys
            }
          }

          const completeState = (this._state = create(
            parentState,
            stateDescriptors
          ))
          const completeStateKeys = (this._stateKeys = keys(stateDescriptors))

          this._resetState = () => {
            state = initialState(this.props)
            dispatch()
            return Promise.resolve()
          }

          parentStateKeys.forEach(k => {
            if (!(k in stateDescriptors)) {
              completeStateKeys.push(k)
            }
          })

          let effectsDescriptors
          if (effects !== undefined) {
            const setState = newState => {
              if (newState == null) {
                return
              }

              if (typeof newState === 'function') {
                return setState(newState(completeState, this.props))
              }

              const { then } = newState
              if (typeof then === 'function') {
                return then.call(newState, setState)
              }

              state = { ...state, ...newState }
              dispatch()
            }

            effectsDescriptors = create(null)
            keys(effects).forEach(k => {
              const e = effects[k]
              const wrappedEffect = (...args) => {
                try {
                  return Promise.resolve(setState(e.call({
                    effects: this._effects,
                    props: this.props,
                    resetState: this._resetState,
                    state: completeState,
                  }, this._effects, ...args)))
                } catch (error) {
                  return Promise.reject(error)
                }
              }

              // this special effects are not callable manually and not inheritable
              if (k === 'initialize' || k === 'finalize') {
                this[k] = wrappedEffect
              } else {
                effectsDescriptors[k] = {
                  enumerable: true,
                  value: wrappedEffect,
                }
              }
            })
          }
          this._effects = create(parentEffects, effectsDescriptors)
        }

        _unsubscribe = noop;

        componentDidMount () {
          const parent = this.context[TAG]
          if (parent !== undefined) {
            this._unsubscribe = parent.subscribe(this._dispatch)
          }

          const { initialize } = this
          if (initialize !== undefined) {
            initialize()
          }
        }

        componentDidUpdate () {
          this._dispatch()
        }

        componentWillUnmount () {
          const { finalize } = this
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
              resetState: this._resetState,
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

      if (ChildComponent === undefined) {
        const stateProvider = new StateProvider({}, {})
        return {
          getState: () => stateProvider._state,
          effects: stateProvider._effects,
        }
      }
      return StateProvider
    }
    return wrapComponentWithState
  }

  return { injectState, provideState }
}
