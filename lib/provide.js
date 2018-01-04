"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.provideState = exports.BaseStatefulComponent = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _react = require("react");

var _react2 = _interopRequireDefault(_react);

var _state = require("./state");

var _effects = require("./effects");

var _context = require("./context");

var _common = require("./common");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseStatefulComponent = exports.BaseStatefulComponent = function (_Component) {
  _inherits(BaseStatefulComponent, _Component);

  function BaseStatefulComponent() {
    _classCallCheck(this, BaseStatefulComponent);

    return _possibleConstructorReturn(this, (BaseStatefulComponent.__proto__ || Object.getPrototypeOf(BaseStatefulComponent)).apply(this, arguments));
  }

  _createClass(BaseStatefulComponent, [{
    key: "getChildContext",
    value: function getChildContext() {
      var parentContext = this.context.freactal || {};

      // Capture container state while server-side rendering.
      if (parentContext.captureState) {
        parentContext.captureState(this.stateContainer.state);
      }

      var localContext = this.buildContext();
      this.childContext = Object.assign({}, parentContext, localContext);

      // Provide context for sub-component state re-hydration.
      if (this.stateContainer.state[_common.HYDRATE]) {
        this.childContext.getNextContainerState = this.stateContainer.state[_common.HYDRATE];
        delete this.stateContainer.state[_common.HYDRATE];
      }

      return {
        freactal: this.childContext
      };
    }
  }, {
    key: "componentDidMount",
    value: function componentDidMount() {
      if (this.effects.initialize) {
        this.effects.initialize(this.props);
      }
      this.unsubscribe = this.context.freactal ? this.context.freactal.subscribe(this.relayUpdate.bind(this)) : function () {};
    }
  }, {
    key: "componentWillUnmount",
    value: function componentWillUnmount() {
      // this.unsubscribe may be undefined due to an error in child render
      if (this.unsubscribe) {
        this.unsubscribe();
      }
    }
  }, {
    key: "subscribe",
    value: function subscribe(onUpdate) {
      var _this2 = this;

      var subscriberId = this.nextSubscriberId++;
      this.subscribers[subscriberId] = onUpdate;
      return function () {
        _this2.subscribers[subscriberId] = null;
      };
    }
  }, {
    key: "buildContext",
    value: function buildContext() {
      var parentContext = this.context.freactal || {};
      var parentKeys = parentContext.state ? Object.keys(parentContext.state) : [];

      return this.middleware.reduce(function (memo, middlewareFn) {
        return middlewareFn(memo);
      }, {
        state: (0, _state.graftParentState)(this.stateContainer.getState(parentKeys), parentContext.state),
        effects: this.effects,
        subscribe: this.subscribe
      });
    }
  }, {
    key: "invalidateChanged",
    value: function invalidateChanged(changedKeys) {
      var _this3 = this;

      var relayedChangedKeys = Object.assign({}, changedKeys);

      var markedKeyAsChanged = function markedKeyAsChanged(key) {
        relayedChangedKeys[key] = true;
        Object.keys(_this3.stateContainer.computedDependants[key] || {}).forEach(markedKeyAsChanged);
      };

      Object.keys(changedKeys).filter(function (key) {
        return changedKeys[key];
      }).forEach(function (key) {
        _this3.stateContainer.invalidateCache(key);
        markedKeyAsChanged(key);
      });

      return relayedChangedKeys;
    }
  }, {
    key: "relayUpdate",
    value: function relayUpdate(changedKeys) {
      // When updates are relayed, the context needs to be updated here; otherwise, the state object
      // will refer to stale parent data when subscribers re-render.
      Object.assign(this.childContext, this.buildContext());
      var relayedChangedKeys = this.invalidateChanged(changedKeys);
      return Promise.all(this.subscribers.map(function (subscriber) {
        return subscriber && subscriber(relayedChangedKeys);
      }));
    }
  }, {
    key: "pushUpdate",
    value: function pushUpdate(changedKeys) {
      if (Object.keys(changedKeys).length === 0) {
        return Promise.resolve();
      }

      // In an SSR environment, the component will not yet have rendered, and the child
      // context will not yet be generated.  The subscribers don't need to be notified,
      // as they will contain correct context on their initial render.
      if (!this.childContext) {
        return Promise.resolve();
      }

      Object.assign(this.childContext, this.buildContext());
      var relayedChangedKeys = this.invalidateChanged(changedKeys);

      return Promise.all(this.subscribers.map(function (subscriber) {
        return subscriber && subscriber(relayedChangedKeys);
      }));
    }
  }, {
    key: "render",
    value: function render() {
      return _react2.default.createElement(this.StatelessComponent, this.props);
    }
  }]);

  return BaseStatefulComponent;
}(_react.Component);

var provideState = exports.provideState = function provideState(opts) {
  return function (StatelessComponent) {
    var _opts$initialState = opts.initialState,
        initialState = _opts$initialState === undefined ? null : _opts$initialState,
        _opts$effects = opts.effects,
        effects = _opts$effects === undefined ? {} : _opts$effects,
        _opts$computed = opts.computed,
        computed = _opts$computed === undefined ? {} : _opts$computed,
        _opts$middleware = opts.middleware,
        middleware = _opts$middleware === undefined ? [] : _opts$middleware;

    var StatefulComponent = function (_BaseStatefulComponen) {
      _inherits(StatefulComponent, _BaseStatefulComponen);

      function StatefulComponent() {
        var _ref;

        _classCallCheck(this, StatefulComponent);

        for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }

        var _this4 = _possibleConstructorReturn(this, (_ref = StatefulComponent.__proto__ || Object.getPrototypeOf(StatefulComponent)).call.apply(_ref, [this].concat(args)));

        _this4.StatelessComponent = StatelessComponent;
        _this4.middleware = middleware;

        _this4.stateContainer = new _state.StateContainer(initialState && initialState(_this4.props, _this4.context) || Object.create(null), computed, _this4.pushUpdate.bind(_this4));
        _this4.getState = _this4.stateContainer.getState.bind(_this4.stateContainer);

        var parentContext = _this4.context.freactal || {};
        _this4.effects = (0, _effects.getEffects)(_this4.stateContainer, effects, parentContext.effects);

        _this4.computed = computed;

        _this4.subscribe = _this4.subscribe.bind(_this4);
        _this4.nextSubscriberId = 0;
        _this4.subscribers = [];
        return _this4;
      }

      return StatefulComponent;
    }(BaseStatefulComponent);

    StatefulComponent.childContextTypes = _context.contextTypes;
    StatefulComponent.contextTypes = _context.contextTypes;

    // This provides a low-effort way to get at a StatefulComponent instance for testing purposes.
    if (!StatelessComponent) {
      return new StatefulComponent(null, {});
    }

    return StatefulComponent;
  };
};