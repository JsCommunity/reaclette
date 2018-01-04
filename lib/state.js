"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.hydrate = exports.StateContainer = exports.graftParentState = undefined;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _common = require("./common");

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var graftParentState = exports.graftParentState = function graftParentState(state, parentState) {
  if (parentState) {
    Object.keys(parentState).forEach(function (parentKey) {
      if (parentKey in state) {
        return;
      }
      Object.defineProperty(state, parentKey, {
        enumerable: true,
        get: function get() {
          return parentState[parentKey];
        }
      });
    });
  }
  return state;
};

var StateContainer = exports.StateContainer = function () {
  // eslint-disable-next-line max-params
  function StateContainer(initialState, computed, pushUpdate) {
    _classCallCheck(this, StateContainer);

    this.state = initialState;

    this.cachedState = Object.create(null);
    this.computedDependants = Object.create(null);

    this.computed = computed;
    this.pushUpdate = pushUpdate;

    this.getTrackedState = this.getTrackedState.bind(this);
  }

  _createClass(StateContainer, [{
    key: "getTrackedState",
    value: function getTrackedState(computedKey, stateWithComputed, accessibleKeys) {
      var computedDependants = this.computedDependants,
          state = this.state;

      var stateProxy = Object.create(null);

      accessibleKeys.forEach(function (key) {
        Object.defineProperty(stateProxy, key, {
          get: function get() {
            computedDependants[key] = computedDependants[key] || Object.create(null);
            computedDependants[key][computedKey] = true;
            return key in state ? state[key] : stateWithComputed[key];
          }
        });
      });

      return stateProxy;
    }
  }, {
    key: "defineComputedStateProperties",
    value: function defineComputedStateProperties(stateWithComputed, parentKeys) {
      var cachedState = this.cachedState,
          getTrackedState = this.getTrackedState,
          computed = this.computed;


      var computedKeys = Object.keys(computed);
      var accessibleKeys = [].concat(computedKeys, Object.keys(stateWithComputed), parentKeys);

      computedKeys.forEach(function (computedKey) {
        var trackedState = getTrackedState(computedKey, stateWithComputed, accessibleKeys);

        Object.defineProperty(stateWithComputed, computedKey, {
          enumerable: true,
          get: function get() {
            if (computedKey in cachedState) {
              return cachedState[computedKey];
            }
            return cachedState[computedKey] = computed[computedKey](trackedState);
          }
        });
      });
    }
  }, {
    key: "getState",
    value: function getState(parentKeys) {
      parentKeys = parentKeys || [];
      var stateWithComputed = Object.create(null);
      Object.assign(stateWithComputed, this.state);
      this.defineComputedStateProperties(stateWithComputed, parentKeys);
      return stateWithComputed;
    }
  }, {
    key: "invalidateCache",
    value: function invalidateCache(key) {
      var _this = this;

      var valuesDependingOnKey = Object.keys(this.computedDependants[key] || {});

      valuesDependingOnKey.forEach(function (dependantKey) {
        delete _this.cachedState[dependantKey];
        _this.invalidateCache(dependantKey);
      });
    }
  }, {
    key: "set",
    value: function set(key, newVal) {
      var oldVal = this.state[key];

      if (oldVal === newVal) {
        return;
      }

      this.invalidateCache(key);
      this.state[key] = newVal;
    }
  }, {
    key: "setState",
    value: function setState(newState) {
      var _this2 = this;

      var allKeys = Object.keys(Object.assign({}, this.state, newState));
      var changedKeys = Object.create(null);

      allKeys.forEach(function (key) {
        var oldValue = _this2.state[key];
        _this2.set(key, newState[key]);
        if (oldValue !== newState[key]) {
          changedKeys[key] = true;
        }
      });

      return this.pushUpdate(changedKeys);
    }
  }]);

  return StateContainer;
}();

var hydrate = exports.hydrate = function hydrate(bootstrapState) {
  return function (props, context) {
    if (context.freactal && context.freactal.getNextContainerState) {
      return context.freactal.getNextContainerState();
    }

    var containerIdx = 1;
    return Object.assign(_defineProperty({}, _common.HYDRATE, function () {
      return bootstrapState[containerIdx++];
    }), bootstrapState[0]);
  };
};