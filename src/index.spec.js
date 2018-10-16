/* eslint-env jest */

require('raf/polyfill')
const { createElement } = require('react')
const { configure, mount } = require('enzyme')

const { injectState, provideState } = require('./')

configure({ adapter: new (require('enzyme-adapter-react-16'))() })

const makeTestInstance = (opts, props) => {
  const Child = () => null
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
  })

  describe('computed', () => {
    const sum = jest.fn(({ foo }, { bar }) => foo + bar)
    const { effects, getInjectedState, setParentProps } = makeTestInstance({
      initialState: () => ({ foo: 1, qux: 2 }),
      computed: {
        sum,
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
  })
})
