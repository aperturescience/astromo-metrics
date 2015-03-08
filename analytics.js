'use strict';

var _          = require('lodash-node');
var onFinished = require('on-finished');

var analytics;

function Analytics(client, options) {
  this.client = client;

  _.assign(this, options);
}

/**
 * Calculates hrtime difference between the start and end of a request.
 * Both in nanoseconds and milliseconds
 */
Analytics.prototype.responseTime = function(req) {

  var diff = process.hrtime(req._startAt);

  var ns   = diff[0] * 1e9 + diff[1];
  var ms   = diff[0] * 1e3 + diff[1] * 1e-6;

  return {
    ns: ns,
    ms: ms.toFixed(3)
  };

};

/**
 * Analytics middleware request handler
 */
Analytics.prototype.handler = function(req, res, next) {

  // If we're not using Morgan, add the timings ourself
  if (!req.hasOwnProperty('_startAt'))
    req._startAt = process.hrtime();

  // Wait for Express to send the response back to the client
  onFinished(res, function(err, res) {
    var delay = analytics.responseTime(req);
    analytics.client.log.info('delay: %d%s', delay.ns, 'ns');
  });

  next();
};

module.exports = function(client, options) {
  options = options || {};
  analytics = new Analytics(client, options);
  return analytics;
};