
/**
 * Module dependencies.
 */

var crank = require('crank')
  , should = require('should');

module.exports = {
  'test .version': function(){
    crank.version.should.match(/^\d+\.\d+\.\d+$/);
  }
};