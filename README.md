# jison-semi-passive

Make Jison parser to semi-passive.  
The passive parser can be used to parse streaming input.  
But because lexer of jison is using JavaScript's builtin regexp functions instead of own NFA/DFA, generated parser can't be 'passive'.  
(might there be some solution, may be lexer's error correction or something can help this problem)  
But applying some restrictions, they can be passive.  
These restrictions, is the reason why this is 'semi' passive.  

The restrictions are..

1. Tokens can't be scanned passively, that means a token can't be divided into 2 or more parse calls.  
   You may be able to use Newline character to devide the input.
2. Never define a token which includes EOF at the end.
(Though I've never seen such a definitions)

About original Jison, please refer to http://zaach.github.io/jison/.  

## Getting Started
Install the module with: `npm install kurohara/jison-semi-passive`

1. Generate parser just like as Jison.
2. Pass extra argument for holding parser states, so than you can call parse method continuously.

```javascript
var fs = require('fs');
var jisonmod = require('./jison-semi-passive');

var syntax = fs.readFileSync('grammer.jison', 'utf8');
var parser = new jisonmod.Parser(syntax);

var state = {iseof: false};
parser.parse("some input...");
parser.parse("some input...");
parser.parse("some input...");
/* set iseof to true when the input has really ended. */
state.iseof = true;
parser.parse("some input...");
```

## Documentation
_(Coming soon)_

## Examples
_(Coming soon)_

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
0.1.0 10/19/2015 initial release

## License
Copyright (c) 2015 Hiroyoshi Kurohara  
Licensed under the MIT license.
