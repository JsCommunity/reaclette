/* eslint-env jest */

require('raf/polyfill')
const { createElement } = require('react')
const { configure, mount } = require('enzyme')

const { injectState, provideState } = require('./')

configure({ adapter: new (require('enzyme-adapter-react-16'))() })

const makeTestInstance = (opts, props) => {
  const Child = () => null
  const wrapper = mount(createElement(provideState({
    ...opts,
    effects: {
      ...opts.effects,
      _setState: (_, props) => _ => props,
    },
  })(injectState(Child)), props))
  return {
    effects: wrapper.find(Child).props().effects,
    getState: () => wrapper.find(Child).props().state,
    setProps: wrapper.setProps.bind(wrapper),
  }
}

const noop = () => {}

describe('provideState', () => {
  describe('initialState', () => {
    it('is called with the props to create the initial state', () => {
      const instance = makeTestInstance(
        {
          initialState: props => {
            expect(props).toEqual({ bar: 'baz' })
            return { foo: 'bar' }
          },
        },
        { bar: 'baz' }
      )
      expect(instance.getState()).toEqual({ foo: 'bar' })
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
      effects.foo('bar', 'baz')
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
    const { effects, getState, setProps } = makeTestInstance({
      initialState: () => ({ foo: 1, qux: 2 }),
      computed: {
        sum,
      },
    }, { bar: 3, baz: 4 })

    it('is not computed before access', () => {
      getState()
      expect(sum).not.toHaveBeenCalled()
    })

    it('returns the result of the computation', () => {
      expect(getState().sum).toBe(4)
      expect(sum).toHaveBeenCalledTimes(1)
    })

    it('is not recomputed when its inputs do not change ', () => {
      setProps({ baz: 5 })
      return effects._setState({ qux: 3 }).then(() => {
        noop(getState().sum)
        expect(sum).toHaveBeenCalledTimes(1)
      })
    })

    it('is recomputed when its state inputs change', () => {
      return effects._setState({ foo: 2 }).then(() => {
        expect(getState().sum).toBe(5)
        expect(sum).toHaveBeenCalledTimes(2)
      })
    })

    it('is recomputed when its props inputs change', () => {
      setProps({ bar: 4 })
      expect(getState().sum).toBe(6)
      expect(sum).toHaveBeenCalledTimes(3)
    })
  })
})
