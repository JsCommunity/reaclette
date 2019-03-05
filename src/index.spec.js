/* eslint-env jest */
import CircularComputedError from './_CircularComputedError'

require('raf/polyfill')
const { createElement } = require('react')
const { configure, mount } = require('enzyme')

const { injectState, provideState } = require('./')

configure({ adapter: new (require('enzyme-adapter-react-16'))() })

const makeTestInstance = (opts, props) => {
  let renderCount = 0
  const Child = () => {
    ++renderCount
    return null
  }
  const parent = mount(createElement(provideState({
    ...opts,
    effects: {
      ...opts.effects,
      _setState: (_, props) => _ => props,
    },
  })(injectState(Child)), props))
  const child = parent.find(Child)
  return {
    effects: child.prop('effects'),
    getInjectedState: () => child.prop('state'),
    getParentState: () => parent.instance()._state,
    getParentProps: () => parent.instance().props,
    getRenderCount: () => renderCount,
    resetState: child.prop('resetState'),
    setParentProps: parent.setProps.bind(parent),
  }
}

const noop = () => {}

describe('provideState', () => {
  describe('initialState', () => {
    it('is called with the props to create the initial state', () => {
      const props = { bar: 'baz' }
      expect(makeTestInstance(
        {
          initialState: (...args) => {
            expect(args).toEqual([ props ])
            return { foo: 'bar' }
          },
        },
        props
      ).getInjectedState()).toEqual({ foo: 'bar' })
    })
  })

  describe('resetState', () => {
    it('is called to reset the state to its initial values in effects', async () => {
      const props = { bar: 'baz' }
      const { effects, getInjectedState } = makeTestInstance(
        {
          initialState: () => ({
            foo: 'bar',
          }),
          effects: {
            changeState (_, value) {
              return { foo: value }
            },
            async reset () {
              await this.resetState()
            },
          },
        },
        props
      )
      await effects.changeState('foo')
      expect(getInjectedState()).toEqual({ foo: 'foo' })
      await effects.reset()
      expect(getInjectedState()).toEqual({ foo: 'bar' })
    })

    it('is called to reset the state to its initial values in child', async () => {
      const props = { bar: 'baz' }
      const { effects, getInjectedState, resetState } = makeTestInstance(
        {
          initialState: () => ({
            foo: 'bar',
          }),
          effects: {
            changeState (_, value) {
              return { foo: value }
            },
          },
        },
        props
      )

      await effects.changeState('foo')
      expect(getInjectedState()).toEqual({ foo: 'foo' })
      await resetState()
      expect(getInjectedState()).toEqual({ foo: 'bar' })
    })
  })

  describe('effects', () => {
    it('are called with other effects followed by arguments', () => {
      const args = ['bar', 'baz']
      const { effects } = makeTestInstance({
        effects: {
          foo: (first, ...rest) => {
            expect(first).toBe(effects)
            expect(rest).toEqual(args)
          },
        },
      })
      return effects.foo(...args)
    })

    it('are called with effects, props and state in context', () => {
      const { effects, getParentProps, getParentState } = makeTestInstance({
        effects: {
          foo () {
            expect(this.effects).toBe(effects)
            expect(this.props).toBe(getParentProps())
            expect(this.state).toBe(getParentState())
          },
        },
      })
      return effects.foo()
    })

    it('always returns a Promise to undefined', () => {
      const { effects } = makeTestInstance({
        effects: {
          foo: () => {},
        },
      })
      return effects.foo().then(value => {
        expect(value).toBe(undefined)
      })
    })

    it('sync state changes are batched', async () => {
      const { effects, getInjectedState, getRenderCount } = makeTestInstance({
        initialState: () => ({ foo: 0 }),
        effects: { foo () {
          this.state.foo = 1
          this.state.foo = 2
        } },
      })

      expect(getRenderCount()).toBe(1)

      // access this state to make sure children is rerendered when it changes
      expect(getInjectedState().foo).toBe(0)

      await effects.foo()

      expect(getRenderCount()).toBe(2)
    })
  })

  describe('computed', () => {
    const sum = jest.fn(({ foo }, { bar }) => foo + bar)
    const circularComputed = jest.fn(({ circularComputed }) => {})
    const throwComputed = jest.fn(() => {
      throw new Error()
    })
    const { effects, getInjectedState, setParentProps } = makeTestInstance({
      initialState: () => ({ foo: 1, qux: 2 }),
      computed: {
        sum,
        circularComputed,
        throwComputed,
      },
    }, { bar: 3, baz: 4 })

    it('is not computed before access', () => {
      getInjectedState()
      expect(sum).not.toHaveBeenCalled()
    })

    it('returns the result of the computation', () => {
      expect(getInjectedState().sum).toBe(4)
      expect(sum).toHaveBeenCalledTimes(1)
    })

    it('is not recomputed when its inputs do not change ', () => {
      setParentProps({ baz: 5 })
      return effects._setState({ qux: 3 }).then(() => {
        noop(getInjectedState().sum)
        expect(sum).toHaveBeenCalledTimes(1)
      })
    })

    it('is recomputed when its state inputs change', () => {
      return effects._setState({ foo: 2 }).then(() => {
        expect(getInjectedState().sum).toBe(5)
        expect(sum).toHaveBeenCalledTimes(2)
      })
    })

    it('is recomputed when its props inputs change', () => {
      setParentProps({ bar: 4 })
      expect(getInjectedState().sum).toBe(6)
      expect(sum).toHaveBeenCalledTimes(3)
    })

    it('throws when a computed calls its self', () => {
      expect(() => {
        return getInjectedState().circularComputed
      }).toThrowError(new CircularComputedError('circularComputed'))
    })

    it('does not trigger a render when a computed throws', () => {
      const previousState = { ...getInjectedState() }
      const res = getInjectedState().throwComputed
      expect(res).toBe(undefined)
      expect(getInjectedState()).toEqual(previousState)
    })

    it('can returns a promise', async () => {
      let promise, resolve
      const reset = () => {
        // eslint-disable-next-line promise/param-names
        promise = new Promise(resolve_ => {
          resolve = resolve_
        })
      }
      reset()

      const { getInjectedState, setParentProps } = makeTestInstance({
        computed: { value: (_, { foo }) => promise },
      }, { foo: 1 })

      // trigger a first computation
      expect(getInjectedState().value).toBe(undefined)

      const prevPromise = promise
      const prevResolve = resolve

      // trigger a second computation
      reset()
      setParentProps({ foo: 2 })
      expect(getInjectedState().value).toBe(undefined)

      // resolve them in reverse order
      resolve('bar')
      await promise
      prevResolve('foo')
      await prevPromise

      // the last computation should win
      expect(getInjectedState().value).toBe('bar')
    })
  })
})
