
var processor = require("uglify-js").uglify;

var MAP = processor.MAP;

function slice(a, start) {
  return Array.prototype.slice.call(a, start || 0);
};

function HOP(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
};

var callCount = {};
global.callCount = callCount;
function count(name, fn){
  callCount[name] = 0;
  return function(){
    callCount[name]++;
    return fn.apply(this, arguments);
  }
}

function $self(){
  return this;
}


function ast_walker() {
        function _vardefs(defs) {
                return [ this[0], MAP(defs, function(def){
                        var a = [ def[0] ];
                        if (def.length > 1)
                                a[1] = walk(def[1]);
                        return a;
                }) ];
        };
        function _block(statements) {
                var out = [ this[0] ];
                if (statements != null)
                        out.push(MAP(statements, walk));
                return out;
        };
        var walkers = {
                "string": $self || function(str) {
                        return [ this[0], str ];
                },
                "num": $self || function(num) {
                        return [ this[0], num ];
                },
                "name": $self || function(name) {
                        return [ this[0], name ];
                },
                "toplevel": function(statements) {
                        return [ this[0], MAP(statements, walk) ];
                },
                "block": _block,
                "splice": _block,
                "var": _vardefs,
                "const": _vardefs,
                "try": function(t, c, f) {
                        return [
                                this[0],
                                MAP(t, walk),
                                c != null ? [ c[0], MAP(c[1], walk) ] : null,
                                f != null ? MAP(f, walk) : null
                        ];
                },
                "throw": function(expr) {
                        return [ this[0], walk(expr) ];
                },
                "new": function(ctor, args) {
                        return [ this[0], walk(ctor), MAP(args, walk) ];
                },
                "switch": function(expr, body) {
                        return [ this[0], walk(expr), MAP(body, function(branch){
                                return [ branch[0] ? walk(branch[0]) : null,
                                         MAP(branch[1], walk) ];
                        }) ];
                },
                "break": $self || function(label) {
                        return [ this[0], label ];
                },
                "continue": $self || function(label) {
                        return [ this[0], label ];
                },
                "conditional": function(cond, t, e) {
                        return [ this[0], walk(cond), walk(t), walk(e) ];
                },
                "assign": function(op, lvalue, rvalue) {
                        return [ this[0], op, walk(lvalue), walk(rvalue) ];
                },
                "dot": function(expr) {
                        this[1] = walk(this[1]);
                        return this;
                        //return [ this[0], walk(expr) ].concat(slice(arguments, 1));
                },
                "call": function(expr, args) {
                        return [ this[0], walk(expr), MAP(args, walk) ];
                },
                "function": function(name, args, body) {
                        return [ this[0], name, args.slice(), MAP(body, walk) ];
                },
                "debugger": function() {
                        return [ this[0] ];
                },
                "defun": function(name, args, body) {
                        return [ this[0], name, args.slice(), MAP(body, walk) ];
                },
                "if": function(conditional, t, e) {
                        return [ this[0], walk(conditional), walk(t), walk(e) ];
                },
                "for": function(init, cond, step, block) {
                        return [ this[0], walk(init), walk(cond), walk(step), walk(block) ];
                },
                "for-in": function(vvar, key, hash, block) {
                        return [ this[0], walk(vvar), walk(key), walk(hash), walk(block) ];
                },
                "while": function(cond, block) {
                        return [ this[0], walk(cond), walk(block) ];
                },
                "do": function(cond, block) {
                        return [ this[0], walk(cond), walk(block) ];
                },
                "return": function(expr) {
                        return [ this[0], walk(expr) ];
                },
                "binary": function(op, left, right) {
                        return [ this[0], op, walk(left), walk(right) ];
                },
                "unary-prefix": function(op, expr) {
                        return [ this[0], op, walk(expr) ];
                },
                "unary-postfix": function(op, expr) {
                        return [ this[0], op, walk(expr) ];
                },
                "sub": function(expr, subscript) {
                        return [ this[0], walk(expr), walk(subscript) ];
                },
                "object": function(props) {
                        return [ this[0], MAP(props, function(p){
                                return p.length == 2
                                        ? [ p[0], walk(p[1]) ]
                                        : [ p[0], walk(p[1]), p[2] ]; // get/set-ter
                        }) ];
                },
                "regexp": $self || function(rx, mods) {
                        return [ this[0], rx, mods ];
                },
                "array": function(elements) {
                        return [ this[0], MAP(elements, walk) ];
                },
                "stat": function(stat) {
                        return [ this[0], walk(stat) ];
                },
                "seq": function() {
                        return [ this[0] ].concat(MAP(slice(arguments), walk));
                },
                "label": function(name, block) {
                        return [ this[0], name, walk(block) ];
                },
                "with": function(expr, block) {
                        return [ this[0], walk(expr), walk(block) ];
                },
                "atom": $self || function(name) {
                        return [ this[0], name ];
                },
                "directive": $self || function(dir) {
                        return [ this[0], dir ];
                }
        };

        var user = {};
        var stack = [];
        function walk(ast) {
        callCount['walk']++;

                if (ast == null)
                        return null;
                //try {
                        stack.push(ast);
                        var type = ast[0];

                        if (!callCount['type-' + type])
                          callCount['type-' + type] = 1;
                        else
                          callCount['type-' + type]++;

                        var gen = user[type];
                        if (gen)
                        {
                                var ret = gen.apply(ast, ast.slice(1));
                                if (ret != null)
                                {
                                        stack.pop();
                                        return ret;
                                }
                        }
                        gen = walkers[type];
                        stack.pop();
                        return gen.apply(ast, ast.slice(1));
                //} finally {
                //        stack.pop();
                //}
        };

        function dive(ast) {
        callCount['dive']++;
                if (ast == null)
                        return null;

                try {
                        stack.push(ast);
                        return walkers[ast[0]].apply(ast, ast.slice(1));
                } finally {
                        stack.pop();
                }
        };

        function with_walkers(walkers, cont){
                var save = {}, i;
                for (i in walkers) if (HOP(walkers, i)) {
                        save[i] = user[i];
                        user[i] = walkers[i];
                }
                var ret = cont();
                for (i in save) if (HOP(save, i)) {
                        if (!save[i]) delete user[i];
                        else user[i] = save[i];
                }
                return ret;
        };

        return {
                walk: count('walk', walk),
                dive: count('dive', dive),
                with_walkers: count('with_walkers', with_walkers),
                parent: count('parent', function() {
                        return stack[stack.length - 2]; // last one is current node
                }),
                stack: count('stack', function() {
                        return stack;
                })
        };
};

exports.ast_walker = ast_walker;