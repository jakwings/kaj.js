var throwError = function (msg) {
  var errmsg = 'SyntaxError: ' + msg + '\n';
  throw new Error(errmsg);
};

var trim = function (s) {
  // http://www.w3.org/html/wg/drafts/html/master/infrastructure.html#space-character
  // [ \t\n\f\r] - [\n\r]
  return s.replace(/^[ \t\f]+|[ \t\f]+$/g, '');
};

var ltrimTextBlock = function (text) {
  return text.replace(/^(?: *\n)+/, '');
};

var rtrimTextBlock = function (text) {
  return text.replace(/(?:\n *)+$/, '');
};

var parseOptions = function (text) {
  var opts = {};
  var lines = text.split('\n');
  var i = 0;
  for (var line; line = lines[i]; i++) {
    var matches = /^:([^:][^:]*):(.*)$/.exec(line);
    if (!matches) {
      break;
    }
    var key = matches[1];
    var value = trim(matches[2]);
    opts[key] = value;
  }
  return {
    options: opts,
    optionText: lines.slice(0, i).join('\n'),
    normalText: lines.slice(i).join('\n')
  };
};

var pad = function (n) {
  var s = '';
  var c = '';
  while (n > 0) {
    c += (c || ' ');
    if ((n & 0x1) === 0x1) { s += c; }
    n >>>= 1;
  }
  return s;
};

var getIndent = function (line) {
  var index = line.search(/[^ ]/);
  if (index < 0) {
    return false;
  }
  return index;
};

var mergeClasses = function () {
  var classes = [].slice.call(arguments);
  var result = [];
  for (var i = 0, l = classes.length; i < l; i++) {
    result = result.concat(classes[i]);
  }
  return result;
};

module.exports = {
  throwError: throwError,
  trim: trim,
  ltrimTextBlock: ltrimTextBlock,
  rtrimTextBlock: rtrimTextBlock,
  parseOptions: parseOptions,
  mergeClasses: mergeClasses,
  getIndent: getIndent,
  pad: pad
};
