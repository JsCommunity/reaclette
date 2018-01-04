"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.captureState = exports.constructCapture = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _context = require("../context");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var constructCapture = exports.constructCapture = function constructCapture() {
  var state = [];
  var context = {
    freactal: { captureState: function captureState(containerState) {
        return state.push(containerState);
      } }
  };
  return { state: state, context: context };
};

var CaptureState = function (_Component) {
  _inherits(CaptureState, _Component);

  function CaptureState() {
    _classCallCheck(this, CaptureState);

    return _possibleConstructorReturn(this, (CaptureState.__proto__ || Object.getPrototypeOf(CaptureState)).apply(this, arguments));
  }

  _createClass(CaptureState, [{
    key: "getChildContext",
    value: function getChildContext() {
      return this.props.capture.context;
    }
  }, {
    key: "render",
    value: function render() {
      return this.props.children;
    }
  }]);

  return CaptureState;
}(_react.Component);

CaptureState.childContextTypes = _context.contextTypes;

var captureState = exports.captureState = function captureState(rootComponent) {
  var capture = constructCapture();

  var Captured = _react2.default.createElement(
    CaptureState,
    { capture: capture },
    rootComponent
  );

  return {
    state: capture.state,
    Captured: Captured
  };
};