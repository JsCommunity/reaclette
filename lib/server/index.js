"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.captureState = exports.initialize = undefined;

var _partialRender = require("./partial-render");

var _resolvePromiseTree = require("./resolve-promise-tree");

var _capture = require("./capture");

var initialize = exports.initialize = function initialize(rootNode) {
  var _constructCapture = (0, _capture.constructCapture)(),
      state = _constructCapture.state,
      context = _constructCapture.context;

  return (0, _resolvePromiseTree.resolvePromiseTree)((0, _partialRender.partialRender)(rootNode, context)).then(function (vdom) {
    return { vdom: vdom, state: state };
  });
};

exports.captureState = _capture.captureState;