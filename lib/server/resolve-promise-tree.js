"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var traverseTree = function traverseTree(obj, enter) {
  if (obj && obj.props && obj.props.children) {
    if (Array.isArray(obj.props.children)) {
      obj.props.children.forEach(function (child, idx) {
        return enter(obj.props.children, idx, child);
      });
    } else {
      enter(obj.props, "children", obj.props.children);
    }
  }
};

var resolvePromiseTree = exports.resolvePromiseTree = function resolvePromiseTree(obj) {
  if (obj && typeof obj.then === "function") {
    return obj.then(resolvePromiseTree);
  }

  var leavesToResolve = [];

  var visitor = function visitor(parent, key, node) {
    if (node && typeof node.then === "function") {
      leavesToResolve.push(node.then(function (resolvedValue) {
        parent[key] = resolvedValue;
        return resolvePromiseTree(resolvedValue);
      }));
    } else {
      traverseTree(node, visitor);
    }
  };

  traverseTree(obj, visitor);

  return Promise.all(leavesToResolve).then(function () {
    return obj;
  });
};