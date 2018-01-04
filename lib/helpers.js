"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var warningShown = false;
var displayDeprecationMessage = function displayDeprecationMessage() {
  if (warningShown) {
    return;
  }
  warningShown = true;
  // eslint-disable-next-line no-console
  console.log("Both `hardUpdate` and `softUpdate` are deprecated.  Please use `update` instead.");
};

var hardUpdate = exports.hardUpdate = function hardUpdate(newState) {
  var showWarning = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

  if (showWarning) {
    displayDeprecationMessage();
  }
  return function () {
    return function (state) {
      return Object.assign({}, state, newState);
    };
  };
};

var softUpdate = exports.softUpdate = function softUpdate(fn) {
  var showWarning = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

  if (showWarning) {
    displayDeprecationMessage();
  }
  return function (effects) {
    for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      args[_key - 1] = arguments[_key];
    }

    return function (state) {
      return Object.assign({}, state, fn.apply(undefined, [state].concat(args)));
    };
  };
};

var update = exports.update = function update(fnOrNewState) {
  if (typeof fnOrNewState === "function") {
    return softUpdate(fnOrNewState, false);
  }

  if ((typeof fnOrNewState === "undefined" ? "undefined" : _typeof(fnOrNewState)) === "object") {
    return hardUpdate(fnOrNewState, false);
  }

  throw new Error("update must receive a reducer function or object to merge as its argument.");
};

var mergeIntoState = exports.mergeIntoState = function mergeIntoState(dataToMerge) {
  return function (state) {
    return Object.assign({}, state, dataToMerge);
  };
};