// TODO: add syntax checker

var clone = require('clone');
var extend = require('extend');
var roles = require('./utils/roles.js');
var directives = require('./utils/directives.js');
var Renderer = require('./utils/class-renderer.js');
var BlockLexer = require('./utils/class-blocklexer.js');
var InlineLexer = require('./utils/class-inlinelexer.js');
var Tnode = require('./utils/class-tnode.js');

var kaj = function (src, opts) {
  var options = opts ? extend(true, clone(kaj.options), opts) : kaj.options;
  return Renderer.render(BlockLexer.lex(src, options), options);
};
kaj.lex = function (src, opts) {
  var options = opts ? extend(true, clone(kaj.options), opts) : kaj.options;
  return BlockLexer.lex(src, options);
};
kaj.render = function (ast, opts) {
  var options = opts ? extend(true, clone(kaj.options), opts) : kaj.options;
  return Renderer.render(ast, options);
};

kaj.InlineLexer = InlineLexer;
kaj.BlockLexer = BlockLexer;
kaj.Renderer = Renderer;
kaj.Tnode = Tnode;

kaj.setDirective = function (queue, name, callback) {
  if (!name || /^[ \t\f\{]|[ \t\f]$/.test(name || '')) {
    throw new Error('Directive name is invalid.');
  }
  var type = typeof callback;
  var queue = kaj.options.directives[queue];
  if (type === 'string') {
    queue[name] = queue[callback];  // alias
  } else if (type === 'function') {
    queue[name] = callback;
  } else {
    delete queue[name];
  }
};
kaj.setRole = function (name, callback) {
  if (!name || /^[ \t\f~]|[ \t\f~]$/.test(name || '')) {
    throw new Error('Role name is invalid.');
  }
  var type = typeof callback;
  if (type === 'string') {
    kaj.options.roles[name] = kaj.options.roles[callback];  // alias
  } else if (type === 'function') {
    kaj.options.roles[name] = callback;
  } else {
    delete kaj.options.roles[name];
  }
};

kaj.options = {
  directives: directives,
  roles: roles,
  highlight: null,
  cwd: './'
};

var noop_directive = function (node, root, helpers) {
  node.parentNode.remove(node);
};
kaj.setDirective('immediate', '@include', noop_directive);
kaj.setDirective('immediate', '@embed', noop_directive);

window.kaj = kaj;