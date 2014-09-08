var rtrimTextBlock = require('./helpers.js').rtrimTextBlock;

var Tnode = function (attrs, children) {
  this.id = this.class = this.style = '';
  var keys = Object.keys(attrs);
  for (var i = 0, l = keys.length; i < l; i++) {
    var k = keys[i];
    if (attrs[k] !== undefined) { this[k] = attrs[k]; }
  }
  this.text = this.text || '';
  this.$id = this.$id || '';
  this.$title = this.$title || '';
  this.$style = this.$style || '';
  this.$class = this.$class || '';
  this.childNodes = children ? [] : null;
  if (children instanceof Tnode) {
    this.addNode(children);
  } else if (Array.isArray(children)) {
    this.addNodes(children);
  }
  this.parentNode = null;
};

Tnode.prototype.addNode = function (node) {
  this.childNodes.push(node);
  node.parentNode = this;
};

Tnode.prototype.addNodes = function (nodes) {
  for (var i = 0, l = nodes.length; i < l; i++) {
    this.addNode(nodes[i]);
  }
};

Tnode.prototype.replaceNode = function (oldNode, newNode) {
  var index = this.childNodes.indexOf(oldNode);
  if (index >= 0) {
    if (!Array.isArray(newNode)) {
      this.childNodes[index] = newNode;
      newNode.parentNode = this;
    } else {
      this.insertNode(index, newNode);
      oldNode.parentNode.removeNode(oldNode);
    }
    oldNode.parentNode = null;
  }
};

Tnode.prototype.insertNode = function (index, newNode) {
  if (!Array.isArray(newNode)) {
    this.childNodes.splice(index, 0, newNode);
    newNode.parentNode = this;
  } else {
    this.childNodes.splice.apply(this.childNodes, [index, 0].concat(newNode));
    for (var i = 0, l = newNode.length; i < l; i++) {
      newNode[i].parentNode = this;
    }
  }
};

Tnode.prototype.getNthNode = function (n) {
  return this.childNodes[n-1] || null;
};

Tnode.prototype.getTextFromNodes = function (attr, delimiter) {
  var children = this.childNodes || [];
  var length = children.length;
  var result = [];
  for (var i = 0; i < length; i++) {
    result.push(children[i][attr] || '');
  }
  return rtrimTextBlock(result.join(delimiter));
};

Tnode.prototype.removeNode = function (node) {
  var index = this.childNodes.indexOf(node);
  if (index >= 0) {
    this.childNodes.splice(index, 1);
  }
  node.parentNode = null;
};

Tnode.prototype.remove = function () {
  this.parentNode.removeNode(this);
};

Tnode.prototype.replace = function (node) {
  this.parentNode.replaceNode(this, node);
};

Tnode.prototype.traverse = function (callback, bfs) {
  if (!bfs) {
    if (this.childNodes) {
      var children = this.childNodes;
      LOOP_DFS:
      for (var i = 0, l = children.length; i < l; i++) {
        if (children[i]) {
          switch (children[i].traverse(callback, bfs)) {
            case false: return false;   // cancels traversing
            case true: break LOOP_DFS;  // checks the next sibling
            default: break;             // checks the next child
          }
        }
      }
    }
    return callback(this);
  } else {
    var t = callback(this);
    if ((t === true) || (t === false)) {
      return t;
    }
    if (this.childNodes) {
      var nextChildren = [];
      var children = this.childNodes;
      do {
        LOOP_BFS:
        for (var i = 0, l = children.length; i < l; i++) {
          if (children[i]) {
            switch (callback(children[i])) {
              case false: return false;      // cancels traversing
              case true: continue LOOP_BFS;  // drop the rest of this branch
              default: break;                // drop this node
            }
            if (children[i].childNodes) {
              nextChildren = nextChildren.concat(children[i].childNodes);
            }
          }
        }
        children = nextChildren;
        nextChildren = [];
      } while (children.length);
    }
  }
};

module.exports = Tnode;
