"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getChildContext = getChildContext;
exports.getContext = getContext;
exports.getRootContext = getRootContext;
/**
 * Code originally borrowed from the Rapscallion project:
 * https://github.com/FormidableLabs/rapscallion/blob/44014d86a0855f7c3e438e6a9ee1e2ca07ff2cbe/src/render/context.js
 */

var EMPTY_CONTEXT = Object.freeze({});

function getChildContext(componentPrototype, instance, context) {
  if (componentPrototype.childContextTypes) {
    return Object.assign(Object.create(null), context, instance.getChildContext());
  }
  return context;
}

function getContext(componentPrototype, context) {
  if (componentPrototype.contextTypes) {
    var contextTypes = componentPrototype.contextTypes;
    return Object.keys(context).reduce(function (memo, contextKey) {
      if (contextKey in contextTypes) {
        memo[contextKey] = context[contextKey];
      }
      return memo;
    }, Object.create(null));
  }
  return EMPTY_CONTEXT;
}

function getRootContext() {
  return Object.create(null);
}