module.exports = {
  /**
   * helpers = {
   *   options: kaj.options,
   *   Tnode: kaj.Tnode,
   *   blockLexer: (blockLexer),
   *   BlockLexer: kaj.BlockLexer,
   *   inlineLexer: (inlineLexer),
   *   InlineLexer: kaj.InlineLexer,
   *   Renderer: kaj.Renderer,
   *   ltrimTextBlock: ltrimTextBlock,
   *   rtrimTextBlock: rtrimTextBlock,
   *   mergeClasses: mergeClasses,
   *   parseOptions: parseOptions,
   *   throwError: throwError,
   *   getIndent: getIndent,
   *   trim: trim,
   *   pad: pad
   * }
   */

  // before inline-lexing
  before: {
    /**
     * Does auto indexing for titles with directive "contents".
     */
    '#section': function (node, root, helpers) {
      var depth = 6;
      var modify = function (node) {
        if (node === this.root) { return; }
        if (node.type !== 'b_section') { return true; }
        if (node.size > depth) { return false; }
        var section = node;
        var size = section.size;
        var counters = this.counters;
        if (size > counters.length) {
          counters[size-1] = 0;
        }
        counters[size-1] += 1;
        var name = counters.slice(0, size).join('-');
        section.id = 'kaj-section-' + name;
        if (section.childNodes && (size < depth)) {
          section.traverse(modify.bind({
            root: section,
            counters: counters.slice(0, size)  // copy
          }), true);
        }
        return true;
      };
      root.traverse(modify.bind({
        root: root,
        counters: []
      }), true);
    },
    /**
     * Defines a simple text role.
     * Syntax:
     *   .. role{role name}
     *      :id:
     *      :class:
     *      :style:
     *      :title:
     *      :wrapper: span
     */
    'role': function (node, root, helpers) {
      node.parentNode.removeNode(node);
      var name = node.args;
      if (!name || /^[ \t\f~]|[ \t\f~]$/.test(name)) {
        helpers.throwError('Directive "role": invalid role name');
      }
      var opts = node.opts;
      var wrapper = opts.wrapper || 'span';
      // http://www.w3.org/html/wg/drafts/html/master/syntax.html#data-state
      if (/^!--|[<>\/?\x00]/.test(wrapper)) {
        helpers.throwError(
            'Directive "role": invalid value for option "wrapper"');
      }
      var className = opts.class;
      if (className) {
        className = className.split(/[ \t\f]+/);
      }
      var roles = helpers.options.roles;
      roles[name] = function (node, root, helpers) {
        return helpers.Renderer.getSpan(wrapper, {
          id: opts.id || node.$id,
          class: helpers.mergeClasses(className, node.$class),
          style: (opts.style ? (opts.style + ';') : '') + node.$style,
          title: opts.title || node.$title
        }, node.text);
      };
    }
  },

  immediate: {
    /**
     * Sets metadata on root.
     * Syntax:
     *   .. @{table name}
     *      :key1: value1
     *      :key2: value2
     *      :keyN: valueN
     */
    '@': function (node, root) {
      var args = node.args;
      var opts = node.opts;
      if (args) {
        var key = '#' + args;
        root[key] = {};
        for (var k in opts) {
          if (Object.prototype.hasOwnProperty.call(opts, k)) {
            root[key][k] = opts[k];
          }
        }
      }
      node.parentNode.removeNode(node);
    },
    /**
     * Inserts raw code to the output.
     * Syntax:
     *   .. raw{html} body
     */
    raw: function (node, root, helpers) {
      var format = node.args;
      if (format === 'html') {
        node.parentNode.replaceNode(node, new helpers.Tnode({
          type: 'b_raw',
          text: helpers.ltrimTextBlock(node.text)
        }));
      } else {
        node.parentNode.removeNode(node);
      }
    },
    /**
     * Inserts comments.
     * Syntax:
     *   .. comments line 1
     *      comments line 2
     *
     *   .. comment{true} comments
     */
    comment: function (node, root, helpers) {
      if (node.args === 'true') {
        var ltrimTextBlock = helpers.ltrimTextBlock;
        node.parentNode.replaceNode(node, new helpers.Tnode({
          type: 'b_raw',
          text: ltrimTextBlock(node.text).split('\n').map(function (line, i) {
            line = line.replace(/-->/g, '- ->');
            if (i > 0) {
              return line ? ('     ' + line) : '';
            }
            return '<!-- ' + line;
          }).join('\n') + ' -->'
        }));
      } else {
        node.parentNode.removeNode(node);
      }
    },
    /**
     * Makes an alias for a role or a directive.
     * Syntax:
     *   .. alias{role} old name
     *      :to: new name
     *
     *   .. alias{directive} old name
     *      :to: new name
     */
    'alias': function (node, root, helpers) {
      node.parentNode.removeNode(node);
      if (!node.isOneliner) {
        helpers.throwError('Directive "alias": invalid syntax');
      }
      var oldName = node.text;
      if (!oldName || /^[# \t\f~]|[ \t\f~]$/.test(oldName)) {
        helpers.throwError('Directive "alias": invalid old name');
      }
      var newName = node.opts.to;
      if (!newName || /^[# \t\f]|[ \t\f]$/.test(newName) ||
          /[{}]/.test(newName)) {
        helpers.throwError('Directive "alias": invalid new name');
      }
      var type = node.args;
      if (type === 'role') {
        var roles = helpers.options.roles;
        roles[newName] = roles[oldName];
      } else if (type === 'directive') {
        var directives = helpers.options.directives;
        var directive;
        if (directives['before'][oldName]) {
          directive = directives['before'][newName] = directives['before'][oldName];
          helpers.blockLexer.registerDirective('before', newName, directive);
        } else if (directives['immediate'][oldName]) {
          directive = directives['immediate'][newName] = directives['immediate'][oldName];
          helpers.blockLexer.registerDirective('immediate', newName, directive);
        } else if (directives['after'][oldName]) {
          directive = helpers.options.directives['after'][newName] = directives['after'][oldName];
          helpers.blockLexer.registerDirective('after', newName, directive);
        }
      }
    },
    /**
     * Adds one class to the nodes.
     * Syntax:
     *   .. class{class names} text
     *
     *   .. class{class names}
     *      nodes...
     */
    class: function (node, root, helpers) {
      var Tnode = helpers.Tnode;
      var opts = node.opts;
      var className = opts.class || node.args;
      var row = node.row + Object.keys(node.opts).length + 1;
      var indent = node.indent + 3;
      var parentNode = node.parentNode;
      if (className) {
        className = className.split(/[ \t\f]+/);
      }
      if (!node.isOneliner) {
        var newNode = new Tnode({type: ''}, true);
        newNode.parentNode = parentNode;
        helpers.blockLexer.tokenize(newNode, row, indent);
        var nodes = newNode.childNodes;
        for (var i = 0, l = nodes.length; i < l; i++) {
          if (className) {
            nodes[i].$class = nodes[i].$class ?
                helpers.mergeClasses(nodes[i].$class, className) : className;
          }
          if (opts.id) {
            nodes[i].$id = opts.id;
            opts.id = null;
          }
          if (opts.style) {
            nodes[i].$style += (nodes[i].$style ? ';' : '') + opts.style;
          }
          if (opts.title) {
            nodes[i].$title = opts.title;
          }
        }
        parentNode.replaceNode(node, nodes);
      } else {
        node.text = helpers.ltrimTextBlock(node.text);
        var newNode = new Tnode({
          type: 'div',
          isSpan: true,
          $id: opts.id,
          $class: className,
          $style: opts.style,
          $title: opts.title
        }, new Tnode({type: '_fragment_', text: node.text}));
        parentNode.replaceNode(node, newNode);
      }
    },
    /**
     * Wraps the nodes with a block node.
     * Syntax:
     *   .. block{class names} text
     *
     *   .. block{class names}
     *      nodes...
     */
    block: function (node, root, helpers) {
      var Tnode = helpers.Tnode;
      var opts = node.opts;
      var className = opts.class || node.args;
      if (className) {
        className = className.split(/[ \t\f]+/);
      }
      var newNode = new Tnode({
        type: 'div',
        $id: opts.id,
        $class: className,
        $style: opts.style,
        $title: opts.title
      }, true);
      if (!node.isOneliner) {
        newNode.parentNode = node.parentNode;
        helpers.blockLexer.tokenize(
            newNode, node.row + Object.keys(opts).length + 1, node.indent + 3);
        node.parentNode.replaceNode(node, newNode);
      } else {
        node.text = helpers.ltrimTextBlock(node.text);
        newNode.isSpan = true;
        newNode.addNode(new Tnode({type: '_fragment_', text: node.text}));
        node.parentNode.replaceNode(node, newNode);
      }
    },
    /**
     * Wraps the nodes in a block node.
     * Syntax:
     *   .. header{} text
     *
     *   .. header{}
     *      nodes...
     */
    header: function (node, root, helpers) {
      var Tnode = helpers.Tnode;
      var opts = node.opts;
      var className = opts.class;
      if (className) {
        className = className.split(/[ \t\f]+/);
      }
      var newNode = new Tnode({
        type: 'header',
        $id: opts.id,
        $class: className,
        $style: opts.style,
        $title: opts.title
      }, true);
      if (!node.isOneliner) {
        newNode.parentNode = node.parentNode;
        helpers.blockLexer.tokenize(
            newNode, node.row + Object.keys(opts).length + 1, node.indent + 3);
        node.parentNode.replaceNode(node, newNode);
      } else {
        node.text = helpers.ltrimTextBlock(node.text);
        if (node.text) {
          newNode.isSpan = true;
          newNode.addNode(new Tnode({type: '_fragment_', text: node.text}));
          node.parentNode.replaceNode(node, newNode);
        } else {
          node.parentNode.removeNode(node);
        }
      }
    },
    /**
     * Wraps the nodes in a block node.
     * Syntax:
     *   .. footer{} text
     *
     *   .. footer{}
     *      nodes...
     */
    footer: function (node, root, helpers) {
      var Tnode = helpers.Tnode;
      var opts = node.opts;
      var className = opts.class;
      if (className) {
        className = className.split(/[ \t\f]+/);
      }
      var newNode = new Tnode({
        type: 'footer',
        $id: opts.id,
        $class: className,
        $style: opts.style,
        $title: opts.title
      }, true);
      if (!node.isOneliner) {
        newNode.parentNode = node.parentNode;
        helpers.blockLexer.tokenize(
            newNode, node.row + Object.keys(opts).length + 1, node.indent + 3);
        node.parentNode.replaceNode(node, newNode);
      } else {
        if (node.text) {
          node.text = helpers.ltrimTextBlock(node.text);
          newNode.isSpan = true;
          newNode.addNode(new Tnode({type: '_fragment_', text: node.text}));
          node.parentNode.replaceNode(node, newNode);
        } else {
          node.parentNode.removeNode(node);
        }
      }
    },
    /**
     * Inserts an image.
     * Syntax:
     *   .. image{format} src or srcset
     *      :alt: alternative text
     *      :caption: a caption for the figure
     *      :link: URI
     *      :lazyload: true or false
     */
    image: function (node, root, helpers) {
      var Tnode = helpers.Tnode;
      var mergeClasses = helpers.mergeClasses;
      var format = node.args.replace(/[ \t\f]+/g, '-');
      var srcset = helpers.ltrimTextBlock(node.text);
      var opts = node.opts;
      var className = opts.class;
      if (className) {
        className = className.split(/[ \t\f]+/);
      }
      opts.id = opts.id || '';
      opts.class = opts.class || '';
      opts.style = opts.style || '';
      opts.title = opts.title || '';
      opts.caption = opts.caption || '';
      var isSimple = (opts.simple === 'true');
      className = format ? mergeClasses('kaj-image-' + format, className)
                         : className;
      var newNode = new Tnode({
        type: 'img',
        isClosed: true,
        $id: isSimple ? opts.id : '',
        $class: isSimple ? className : '',
        $style: opts.style,
        $title: isSimple ? opts.title : '',
        $alt: opts.alt
      }, false);
      var valSrc = encodeURI(srcset.split(/  */, 1)[0]);
      var valSrcSet = / /.test(srcset) &&
          srcset.split(/ *,  */).map(function (src) {
            var parts = src.split(/  */);
            parts[0] = encodeURI(parts[0]);
            return parts.join(' ');
          }).join(', ');
      var keySrc, keySrcSet;
      if (opts.lazyload !== 'true') {
        keySrc = '$src';
        keySrcSet = '$srcset';
      } else {
        keySrc = '$data-src';
        keySrcSet = '$data-srcset';
      }
      newNode[keySrc] = valSrc;
      newNode[keySrcSet] = valSrcSet;
      if (opts.link) {
        newNode = new Tnode({
          type: 'a',
          isSpan: true,
          $href: encodeURI(opts.link)
        }, newNode);
      }
      if (!isSimple) {
        newNode = new Tnode({
          type: 'figure',
          $id: opts.id,
          $class: className,
          $title: opts.title
        }, newNode);
        if (opts.caption) {
          newNode.addNode(new Tnode({
            type: 'figcaption',
            isSpan: true
          }, new Tnode({type: '_fragment_', text: opts.caption})));
        }
      }
      node.parentNode.replaceNode(node, newNode);
    },
    /**
     * Inserts a note.
     * Syntax:
     *   .. note{Note Number or Citation Name}
     *      nodes...
     */
    note: function (node, root, helpers) {
      var defName = node.args;
      if (!defName) {
        node.parentNode.removeNode(node);
        return;
      }
      var Tnode = helpers.Tnode;
      var defText = helpers.ltrimTextBlock(node.text);
      var opts = node.opts;
      var className = opts.class;
      if (className) {
        className = className.split(/[ \t\f]+/);
      }
      var isCitation = !/^\d\d*$/.test(defName);
      var newNode = new Tnode({type: '_fragment_'}, true);
      if (!node.isOneliner) {
        newNode.parentNode = node.parentNode;
        helpers.blockLexer.tokenize(
            newNode, node.row + Object.keys(opts).length + 1, node.indent + 3);
      } else {
        newNode.text = defText;
        newNode.childNodes = null;
      }
      newNode = new Tnode({type: 'tr'}, [
        new Tnode({
          type: 'td',
          isSpan: true,
          $class: 'kaj-label',
          text: '[' + defName + ']'
        }),
        new Tnode({type: 'td', isSpan: node.isOneliner}, newNode)
      ]);
      newNode = new Tnode({
        type: 'table',
        $class: helpers.mergeClasses(
            'kaj-' + (isCitation ? 'cite-def' : 'note-def'), className),
        $id: opts.id || ('kaj-' + (isCitation ? 'cite-def-' : 'note-def-') +
            encodeURI(defName))
      }, newNode);
      node.parentNode.replaceNode(node, newNode);
    },
    /**
     * Inserts a Comma-Separated-Values table.
     * Syntax:
     *   .. csv-table{Caption}
     *      :header: true|false true|false (has Header Row?) (has Header Column?)
     *      :delimiter: , (used to indicate columns, default: ",")
     *      :linebreak: (used to indicate linebreaks in a cell, default:)
     *      r1-c1 , r1-c2 , r1-c3
     *      r2-c1 , r2-c2 , r2-c3
     *      r3-c1 , r3-c2 , r3-c3
     */
    'csv-table': function (node, root, helpers) {
      var Tnode = helpers.Tnode;
      var ltrimTextBlock = helpers.ltrimTextBlock;
      var caption = node.args;
      var opts = node.opts;
      var className = opts.class;
      if (className) {
        className = className.split(/[ \t\f]+/);
      }
      var headerFlags = (opts.header || '').split(/[ \t]+/, 2).map(function (v) {
        return v === 'true';
      });
      var delimiter = opts.delimiter || ',';
      var linebreak = opts.linebreak || false;
      var rows = ltrimTextBlock(node.text).split('\n').map(function (line) {
        return line.split(delimiter);
      }).filter(function (cells) {
        return cells.length;
      });
      var newNode = new Tnode({
        type: 'table',
        $id: opts.id,
        $class: className,
        $style: opts.style,
        $title: opts.title
      }, caption ? new Tnode({type: 'caption', isSpan: true, text: caption}) : true);
      if (linebreak) {
        linebreak = new RegExp('[ \\t]*' +
            linebreak.replace(/([.\\+*?\^\[\]$(){}])/g, '\\$1') + '[ \\t]*', 'g');
      }
      var cell, row;
      if (headerFlags[0]) {
        var header = false;
        if (row = rows.shift()) {
          header = new Tnode({type: 'tr'}, true);
          for (var i = 0, l = row.length; i < l; i++) {
            text = helpers.trim(row[i]);
            if (linebreak) {
              text = text.replace(linebreak, '{{<br>}}');
            }
            header.addNode(new Tnode({type: 'th', isSpan: true}, new Tnode({
              type: '_fragment_',
              text: text
            })));
          }
        }
        newNode.addNode(new Tnode({type: 'thead'}, header));
      }
      var body = new Tnode({type: 'tbody'}, true);
      for (var i = 0, m = rows.length; i < m; i++) {
        row = rows[i];
        var tableRow = new Tnode({type: 'tr'}, true);
        for (var j = 0, n = row.length; j < n; j++) {
          text = helpers.trim(row[j]);
          if (linebreak) {
            text = text.replace(linebreak, '{{<br>}}');
          }
          tableRow.addNode(new Tnode({
            type: ((j === 0) && headerFlags[1]) ? 'th' : 'td',
            isSpan: true
          }, new Tnode({
            type: '_fragment_',
            text: text
          })));
        }
        body.addNode(tableRow);
      }
      newNode.addNode(body);
      node.parentNode.replaceNode(node, newNode);
    //},
    ///**
    // * Display some math!
    // * Syntax:
    // *   .. math{latex}
    // *      your equations
    // */
    //math: function (node, root, helpers) {
    //  var format = node.args;
    //  node.text = helpers.ltrimTextBlock(node.text);
    //  if (format === 'latex') {
    //    var opts = node.opts;
    //    var className = opts.class;
    //    if (className) {
    //      className = className.split(/[ \t\f]+/);
    //    }
    //    var preview = new helpers.Tnode({
    //      type: 'pre',
    //        $id: opts.id,
    //        $class: helpers.mergeClasses('MathJax_Preview', className),
    //        $style: opts.style,
    //        $title: opts.title,
    //        text: node.text
    //    });
    //    var newNode = new helpers.Tnode({
    //      type: 'script',
    //        $type: 'math/tex; mode=display',
    //        text: node.text
    //    });
    //    node.parentNode.replaceNode(node, new helpers.Tnode({
    //      type: '_fragment_',
    //    }, [preview, newNode]));
    //  } else {
    //    node.parentNode.removeNode(node);
    //  }
    }
  },

  // after inline-lexing
  after: {
    /**
     * Adds a link address to the text.
     * Syntax:
     *   .. link{name} URI
     */
    link: function (node, root, helpers) {
      node.parentNode.removeNode(node);
      node.text = helpers.ltrimTextBlock(node.text);
      var defName = node.args.toLowerCase();
      var defLink = node.text;
      if (!defLink || !defName) {
        return;
      }
      var opts = node.opts;
      root.traverse(function (node) {
        if (node.type !== 'i_link') {
          return;
        }
        if (node.link) {
          var matches = /^\{(.+)\}$/.exec(node.link);
          if (!matches || (matches[1].toLowerCase() !== defName)) {
            return;
          }
        } else {
          if (node.text.toLowerCase() !== defName) {
            return;
          }
        }
        node.link = defLink;
        if (opts.id) {
          node.$id = opts.id;
          opts.id = null;
        }
        if (opts.class) {
          var className = opts.class;
          if (className) {
            className = className.split(/[ \t\f]+/);
          }
          node.$class = node.$class ?
              helpers.mergeClasses(node.$class, className) : className;
        }
        if (opts.style) {
          node.$style += (node.$style ? ';' : '') + opts.style;
        }
        if (opts.title) {
          nodes.$title = opts.title;
        }
      });
    },
    /**
     * Replaces a pipe with an image.
     * Syntax:
     *   .. pipe-image{name} URI
     *      :format: format
     *      :option of image directive: value
     */
    'pipe-image': function (node, root, helpers) {
      node.parentNode.removeNode(node);
      var defName = node.args;
      var defText = helpers.ltrimTextBlock(node.text);
      if (!defName || !defText) {
        return;
      }
      var opts = node.opts;
      opts.simple = 'true';
      root.traverse(function (node) {
        if ((node.type !== 'i_pipe') || (node.name !== defName)) {
          return;
        }
        node.args = opts.format || '';
        node.opts = opts;
        node.text = defText;
        helpers.options.directives.immediate.image(node, root, helpers);
      });
    },
    /**
     * Transform a pipe into text and adds title to it.
     * Syntax:
     *   .. pipe-abbr{name} title
     */
    'pipe-abbr': function (node, root, helpers) {
      node.parentNode.removeNode(node);
      var defName = node.args;
      var defText = helpers.ltrimTextBlock(node.text);
      if (!defName || !defText) {
        return;
      }
      var opts = node.opts;
      var className = opts.class;
      if (className) {
        className = className.split(/[ \t\f]+/);
      }
      root.traverse(function (node) {
        if ((node.type !== 'i_pipe') || (node.name !== defName)) {
          return;
        }
        var newNode = new helpers.Tnode({
          type: 'abbr',
          isSpan: true,
          text: defName,
          $title: opts.title || defText,
          $id: opts.id,
          $class: className,
          $style: opts.style
        });
        node.parentNode.replaceNode(node, newNode);
      });
    },
    /**
     * Replaces a pipe with some text.
     * Syntax:
     *   .. pipe-text{} text
     *      :format: raw (inserted as raw HTML code? defaut:)
     */
    'pipe-text': function (node, root, helpers) {
      node.parentNode.removeNode(node);
      var defName = node.args;
      var defText = helpers.ltrimTextBlock(node.text);
      if (!defName || !defText) {
        return;
      }
      var opts = node.opts;
      var format = (opts.format === 'raw') ? 'i_raw' : 'i_text';
      root.traverse(function (node) {
        if ((node.type !== 'i_pipe') || (node.name !== defName)) {
          return;
        }
        var newNode = new helpers.Tnode({
          type: format,
          text: defText
        });
        node.parentNode.replaceNode(node, newNode);
      });
    },
    /**
     * Inserts a table of contents.
     * It must works with directive "#section".
     * Syntax:
     *   .. contents{Caption}
     *      :depth: 3 (1-6, default: 3)
     */
    contents: function (node, root, helpers) {
      var Tnode = helpers.Tnode;
      var caption = node.args;
      var opts = node.opts;
      var className = opts.class;
      if (className) {
        className = className.split(/[ \t\f]+/);
      }
      var depth = parseInt(opts.depth, 10);
      depth = ((depth >= 1) && (depth <= 6)) ? depth : 3;
      var newNode = new Tnode({
        type: 'div',
        $id: opts.id || 'kaj-contents',
        $class: className,
        $style: opts.style,
        $title: opts.title
      }, true);
      if (caption) {
        newNode.addNode(
          new Tnode({
            type: 'div',
            $class: 'kaj-contents-title'
          }, new Tnode({type: 'span', isSpan: true, text: caption}))
        );
      }
      var listNode = new Tnode({type: 'ul'}, true);
      root.traverse(function (node) {
        if (node === root) { return; }  // avoids infinite recursion
        if (node.type !== 'b_section') { return true; }
        if (node.size > depth) { return false; }  // stops breadth-first-search
        var section = node;
        if (!section.id) { return true; }
        var size = section.size;
        var heading = section.getNthNode(1);
        if (heading.type !== 'b_heading') {
          heading = {};
        }
        heading.link = '#kaj-contents';
        var indexes = section.id.replace(/^kaj-section-/, '').
            split('-', size).
            map(function (n) {
              return parseInt(n, 10);
            });
        var paren = listNode.getNthNode(indexes[0]);
        if (!paren) {
          paren = new Tnode({type: 'li'}, new Tnode({
            type: 'a',
            isSpan: true,
            $href: '#' + section.id,
            text: heading.text
          }));
          listNode.addNode(paren);
        }
        var child;
        for (var i = 1, l = indexes.length; i < l; i++) {
          if (!(child = paren.getNthNode(2))) {
            child = new Tnode({type: 'ul'}, true);
            paren.addNode(child);
          }
          paren = child;
          if (!(child = paren.getNthNode(indexes[i]))) {
            child = new Tnode({type: 'li'}, new Tnode({
              type: 'a',
              isSpan: true,
              $href: '#' + section.id,
              text: heading.text
            }));
            paren.addNode(child);
          }
          paren = child;
        }
      }, true);
      if (listNode.childNodes.length) {
        newNode.addNode(listNode);
        node.parentNode.replaceNode(node, newNode);
      } else {
        node.parentNode.removeNode(node);
      }
    }
  }

};
