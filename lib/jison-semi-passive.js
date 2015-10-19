
var jison = require('jison');


function traceParseError (err, hash) {
    this.trace(err);
}

function parseError (str, hash) {
    if (hash.recoverable) {
        this.trace(str);
    } else {
        throw new Error(str);
    }
}

var stmpl = {
  stack: [0],
  tstack: [], // token stack
  vstack: [null], // semantic value stack
  lstack: [], // location stack
  recovering: 0,
  lexer: null,
  sharedState: null,
  iseof: true,
};

function parse(input, state) {
  var self = this;
  var table = this.table,
      TERROR = 2,
      EOF = 1;
  var s = Object.create(stmpl);
  if (state) {
    if (! state.state) {
      state.state = s;
    } else {
      s = state.state;
    }
    s.iseof = state.iseof;
  }

  // var args = lstack.slice.call(arguments, 1);
  var args = [];

  //this.reductionCount = this.shiftCount = 0;

  if (! s.lexer) {
    // first time
    s.lexer = Object.create(this.lexer);
  }
  if (! s.sharedState) {
    s.sharedState = { yy: {} };
    // copy state
    for (var k in this.yy) {
      if (Object.prototype.hasOwnProperty.call(this.yy, k)) {
        s.sharedState.yy[k] = this.yy[k];
      }
    }
  }

  s.lexer.setInput(input, s.sharedState.yy);
  s.sharedState.yy.lexer = s.lexer;
  s.sharedState.yy.parser = this;
  s.sharedState.yy.iseof = s.iseof;
  if (typeof s.lexer.yylloc == 'undefined') {
    s.lexer.yylloc = {};
  }
  var yytext = '';
  var yylineno = s.lexer.yylineno;
  var yyleng = s.lexer.yyleng;
  var yyloc = s.lexer.yylloc;
  s.lstack.push(yyloc);

  var ranges = s.lexer.options && s.lexer.options.ranges;

  if (typeof s.sharedState.yy.parseError === 'function') {
    this.parseError = s.sharedState.yy.parseError;
  } else {
    this.parseError = Object.getPrototypeOf(this).parseError;
  }

  function popStack (n) {
    s.stack.length = s.stack.length - 2 * n;
    s.vstack.length = s.vstack.length - n;
    s.lstack.length = s.lstack.length - n;
  }

  _token_stack:
  function lex() {
    var token;
    token = s.lexer.lex() || EOF;
    // if token isn't its numeric value, convert
    if (typeof token !== 'number') {
      token = self.symbols_[token] || token;
    }
    return token;
  }

  var symbol, preErrorSymbol, state, action, a, r, yyval = {}, p, len, newState, expected;
  while (true) {
    // retreive state number from top of stack
    state = s.stack[s.stack.length - 1];

    // use default actions if available
    if (this.defaultActions[state]) {
      action = this.defaultActions[state];
    } else {
      if (symbol === null || typeof symbol == 'undefined') {
        symbol = lex();
      }
      if (symbol === EOF && ! s.iseof) {
	return;
      }
      // read action for current state and first input
      action = table[state] && table[state][symbol];
    }
    if (symbol === EOF && ! s.iseof) {
      return;
    }

    _handle_error:
    // handle parse error
    if (typeof action === 'undefined' || !action.length || !action[0]) {
      var error_rule_depth;
      var errStr = '';

      // Return the rule stack depth where the nearest error rule can be found.
      // Return FALSE when no error recovery rule was found.
      function locateNearestErrorRecoveryRule(state) {
        var stack_probe = s.stack.length - 1;
        var depth = 0;

        // try to recover from error
        for(;;) {
          // check for error recovery rule in this state
          if ((TERROR.toString()) in table[state]) {
            return depth;
          }
          if (state === 0 || stack_probe < 2) {
            return false; // No suitable error recovery rule available.
          }
          stack_probe -= 2; // popStack(1): [symbol, action]
          state = s.stack[stack_probe];
          ++depth;
        }
      }

      if (!s.recovering) {
        // first see if there's any chance at hitting an error recovery rule:
        error_rule_depth = locateNearestErrorRecoveryRule(state);

        // Report error
        expected = [];
        for (p in table[state]) {
          if (this.terminals_[p] && p > TERROR) {
            expected.push("'"+this.terminals_[p]+"'");
          }
        }
        if (s.lexer.showPosition) {
          errStr = 'Parse error on line '+(yylineno+1)+":\n"+s.lexer.showPosition()+"\nExpecting "+expected.join(', ') + ", got '" + (this.terminals_[symbol] || symbol)+ "'";
        } else {
          errStr = 'Parse error on line '+(yylineno+1)+": Unexpected " +
            (symbol == EOF ? "end of input" :
             ("'"+(this.terminals_[symbol] || symbol)+"'"));
        }
        this.parseError(errStr, {
          text: s.lexer.match,
          token: this.terminals_[symbol] || symbol,
          line: s.lexer.yylineno,
          loc: yyloc,
          expected: expected,
          recoverable: (error_rule_depth !== false)
        });
      } else if (preErrorSymbol !== EOF) {
        error_rule_depth = locateNearestErrorRecoveryRule(state);
      }

      // just recovered from another error
      if (recovering == 3) {
        if (symbol === EOF || preErrorSymbol === EOF) {
          throw new Error(errStr || 'Parsing halted while starting to recover from another error.');
        }

        // discard current lookahead and grab another
        yyleng = s.lexer.yyleng;
        yytext = s.lexer.yytext;
        yylineno = s.lexer.yylineno;
        yyloc = s.lexer.yylloc;
        symbol = lex();
      }

      // try to recover from error
      if (error_rule_depth === false) {
        throw new Error(errStr || 'Parsing halted. No suitable error recovery rule available.');
      }
      popStack(error_rule_depth);

      preErrorSymbol = (symbol == TERROR ? null : symbol); // save the lookahead token
      symbol = TERROR;         // insert generic error symbol as new lookahead
      state = s.stack[s.stack.length-1];
      action = table[state] && table[state][TERROR];
      s.recovering = 3; // allow 3 real symbols to be shifted before reporting a new error
    }

    // this shouldn't happen, unless resolve defaults are off
    if (action[0] instanceof Array && action.length > 1) {
      throw new Error('Parse Error: multiple actions possible at state: '+state+', token: '+symbol);
    }

    switch (action[0]) {
    case 1: // shift
      //this.shiftCount++;

      s.stack.push(symbol);
      s.vstack.push(s.lexer.yytext);
      s.lstack.push(s.lexer.yylloc);
      s.stack.push(action[1]); // push state
      symbol = null;
      if (!preErrorSymbol) { // normal execution/no error
        yyleng = s.lexer.yyleng;
        yytext = s.lexer.yytext;
        yylineno = s.lexer.yylineno;
        yyloc = s.lexer.yylloc;
        if (s.recovering > 0) {
          s.recovering--;
        }
      } else {
        // error just occurred, resume old lookahead f/ before error
        symbol = preErrorSymbol;
        preErrorSymbol = null;
      }
      break;

    case 2:
      // reduce
      //this.reductionCount++;

      len = this.productions_[action[1]][1];

      // perform semantic action
      yyval.$ = s.vstack[s.vstack.length-len]; // default to $$ = $1
      // default location, uses first token for firsts, last for lasts
      yyval._$ = {
        first_line: s.lstack[s.lstack.length-(len||1)].first_line,
        last_line: s.lstack[s.lstack.length-1].last_line,
        first_column: s.lstack[s.lstack.length-(len||1)].first_column,
        last_column: s.lstack[s.lstack.length-1].last_column
      };
      if (ranges) {
        yyval._$.range = [s.lstack[s.lstack.length-(len||1)].range[0], s.lstack[s.lstack.length-1].range[1]];
      }
      r = this.performAction.apply(yyval, [yytext, yyleng, yylineno, s.sharedState.yy, action[1], s.vstack, s.lstack].concat(args));

      if (typeof r !== 'undefined') {
        return r;
      }

      // pop off stack
      if (len) {
        s.stack = s.stack.slice(0,-1*len*2);
        s.vstack = s.vstack.slice(0, -1*len);
        s.lstack = s.lstack.slice(0, -1*len);
      }

      s.stack.push(this.productions_[action[1]][0]);    // push nonterminal (reduce)
      s.vstack.push(yyval.$);
      s.lstack.push(yyval._$);
      // goto new state = table[STATE][NONTERMINAL]
      newState = table[s.stack[s.stack.length-2]][s.stack[s.stack.length-1]];
      s.stack.push(newState);
      break;

    case 3:
      // accept
      return true;
    }

  }

  return true;
}

module.exports.Parser = function Parser(grammer, opt) {
  var p = jison.Parser.apply(this, arguments);
  // modify lexer here.
  p.lexer._test_match = p.lexer.test_match;
  p.lexer.test_match = function(match, indexed_rule) {
    if (match[0] !== '' || this.yy.iseof) {
      return this._test_match(match, indexed_rule);
    } else {
      return this.EOF;
    }
  };
  // replace parse method.
  p.parse = parse;
  return p;
};

