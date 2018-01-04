"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.injectState = exports.BaseInjectStateHoc = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _context = require("./context");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseInjectStateHoc = exports.BaseInjectStateHoc = function (_Component) {
  _inherits(BaseInjectStateHoc, _Component);

  function BaseInjectStateHoc() {
    _classCallCheck(this, BaseInjectStateHoc);

    return _possibleConstructorReturn(this, (BaseInjectStateHoc.__proto__ || Object.getPrototypeOf(BaseInjectStateHoc)).apply(this, arguments));
  }

  _createClass(BaseInjectStateHoc, [{
    key: "componentDidMount",
    value: function componentDidMount() {
      this.mounted = true;
      this.unsubscribe = this.context.freactal.subscribe(this.update.bind(this));
    }
  }, {
    key: "componentWillReceiveProps",
    value: function componentWillReceiveProps() {
      this.usedKeys = null;
    }
  }, {
    key: "componentWillUnmount",
    value: function componentWillUnmount() {
      this.mounted = false;
      // this.unsubscribe may be undefined due to an error in child render
      if (this.unsubscribe) {
        this.unsubscribe();
      }
    }
  }, {
    key: "update",
    value: function update(changedKeys) {
      var _this2 = this;

      return this.mounted && this.shouldUpdate(changedKeys, this.usedKeys) ? new Promise(function (resolve) {
        return _this2.forceUpdate(resolve);
      }) : Promise.resolve();
    }
  }, {
    key: "getTrackedState",
    value: function getTrackedState() {
      var state = this.context.freactal.state;
      var trackedState = Object.create(null);
      var usedKeys = this.usedKeys = Object.create(null);

      Object.keys(state).forEach(function (key) {
        usedKeys[key] = false;

        Object.defineProperty(trackedState, key, {
          enumerable: true,
          get: function get() {
            usedKeys[key] = true;
            return state[key];
          }
        });
      });

      return trackedState;
    }
  }, {
    key: "render",
    value: function render() {
      var _this3 = this;

      var props = Object.assign({}, this.props);
      if (this.keys) {
        this.keys.forEach(function (key) {
          return props[key] = _this3.context.freactal.state[key];
        });
      } else {
        props.state = this.getTrackedState();
      }

      return _react2.default.createElement(this.StatelessComponent, _extends({}, props, {
        effects: this.context.freactal.effects
      }));
    }
  }]);

  return BaseInjectStateHoc;
}(_react.Component);

var injectState = exports.injectState = function injectState(StatelessComponent) {
  var keys = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

  var shouldUpdate = keys ? function (changedKeys) {
    return keys.some(function (key) {
      return changedKeys[key];
    }, false);
  } : function (changedKeys, usedKeys) {
    return usedKeys ? Object.keys(usedKeys).some(function (key) {
      return usedKeys[key] && changedKeys[key];
    }) : true;
  };

  var InjectStateHoc = function (_BaseInjectStateHoc) {
    _inherits(InjectStateHoc, _BaseInjectStateHoc);

    function InjectStateHoc() {
      var _ref;

      _classCallCheck(this, InjectStateHoc);

      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      var _this4 = _possibleConstructorReturn(this, (_ref = InjectStateHoc.__proto__ || Object.getPrototypeOf(InjectStateHoc)).call.apply(_ref, [this].concat(args)));

      if (!_this4.context.freactal) {
        throw new Error("Attempted to inject state without parent Freactal state container.");
      }

      _this4.keys = keys;
      _this4.shouldUpdate = shouldUpdate;
      _this4.StatelessComponent = StatelessComponent;
      return _this4;
    }

    return InjectStateHoc;
  }(BaseInjectStateHoc);

  InjectStateHoc.contextTypes = _context.contextTypes;

  return InjectStateHoc;
};