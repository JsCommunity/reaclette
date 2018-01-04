"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var getEffects = exports.getEffects = function getEffects(hocState, effectDefs, parentEffects) {
  var applyReducer = function applyReducer(reducer) {
    var result = reducer ? reducer(hocState.state) : null;
    if (result) {
      hocState.setState(result);
    }

    return result;
  };

  var effects = Object.keys(effectDefs).reduce(function (memo, effectKey) {
    var effectFn = effectDefs[effectKey];

    memo[effectKey] = function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return new Promise(function (resolve) {
        return resolve(effectFn.apply(undefined, [effects].concat(args)));
      }).then(applyReducer);
    };

    return memo;
  }, Object.assign({}, parentEffects, { initialize: null }));

  return effects;
};