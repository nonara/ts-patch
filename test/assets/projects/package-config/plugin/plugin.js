const transformer1Factory = require('./transformers/transformer1');
const transformer2Factory = require('./transformers/transformer2');

module.exports = function(...args) {
  return {
    before: [transformer1Factory(...args), transformer2Factory(...args)],
    after: () => { throw new Error('after should be unreachable') }
  }
}
