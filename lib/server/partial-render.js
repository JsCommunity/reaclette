"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.partialRender = undefined;

var _context = require("./context");

var _setState = require("./set-state");

var isReactComponent = function isReactComponent(node) {
  return node && typeof node.type === "function";
};
var isReactVdom = function isReactVdom(node) {
  return node && typeof node.type === "string";
};

var partialRender = exports.partialRender = function partialRender(node, context) {
  if (isReactComponent(node)) {
    return renderComponent(node, context);
  } else if (isReactVdom(node)) {
    return partiallyRenderVdom(node, context);
  } else {
    return node;
  }
};

var isStatefulComponent = function isStatefulComponent(node) {
  return node.type.prototype && node.type.prototype.isReactComponent;
};

var renderComponent = function renderComponent(node, context) {
  var componentContext = (0, _context.getContext)(node.type, context);

  if (!isStatefulComponent(node)) {
    // Vanilla SFC.
    return partialRender(node.type(node.props, componentContext), context);
  } else {
    // eslint-disable-next-line new-cap
    var instance = new node.type(node.props, componentContext);

    if (typeof instance.componentWillMount === "function") {
      instance.setState = _setState.syncSetState;
      instance.componentWillMount();
    }

    var renderInstance = function renderInstance() {
      var childContext = (0, _context.getChildContext)(node.type, instance, context);
      return partialRender(instance.render(), childContext);
    };

    return instance.effects && typeof instance.effects.initialize === "function" ? instance.effects.initialize().then(renderInstance) : renderInstance();
  }
};

var assign = Object.assign;

var partiallyRenderVdom = function partiallyRenderVdom(node, context) {
  if (node.props.children) {
    var children = Array.isArray(node.props.children) ? node.props.children.map(function (child) {
      return partialRender(child, context);
    }) : partialRender(node.props.children, context);

    node = assign({}, node, {
      props: assign({}, node.props, { children: children })
    });
  }
  return node;
};