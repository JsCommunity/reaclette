"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var symbolSupported = typeof Symbol === "function";

var HYDRATE = exports.HYDRATE = symbolSupported ? Symbol("__hydrate__") : "__hydrate__";