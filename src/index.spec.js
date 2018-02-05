// eslint-env jest

import {configure} from 'enzyme'
import Adapter from 'enzyme-adapter-react-16'

import { injectState, provideState } from './'

configure({ adapter: new Adapter() })

describe('@julien-f/freactal', () => {

})
