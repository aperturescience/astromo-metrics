'use strict';

var _          = require('lodash');
var bunyan     = require('bunyan');
var onFinished = require('on-finished');
var url        = require('url');
var influx     = require('./db');

var log;

function Metrics(options) {

  var self = this;

  var defaults = {
    metricsUrl : 'http://127.0.0.1:8086',
    debug      : false
  };

  self.options = options = _.assign(defaults, options);

  // Create Bunyan logger
  self.log = log = bunyan.createLogger({
    name  : 'astromo.metrics',
    level : options.debug ? bunyan.DEBUG : bunyan.INFO
  });

  var influxOpts = url.parse(options.metricsUrl);

  this.influxClient = new influx({
    host : influxOpts.hostname,
    port : influxOpts.port,
    ssl  : influxOpts.protocol === 'https'
  });

}

/**
 * /!\ Don't throw an error when something goes wrong!
 * We still want the API to work even if it's not aggregating data
 */
Metrics.prototype.onError = function(err) {
  log.error(err);
};

/**
 * Calculates hrtime difference between then and now
 * Both in nanoseconds and milliseconds
 */
Metrics.prototype.responseTime = function(hrtime) {

  var diff = process.hrtime(hrtime);

  var ns   = diff[0] * 1e9 + diff[1];
  var ms   = diff[0] * 1e3 + diff[1] * 1e-6;

  return {
    ns: ns,
    ms: ms.toFixed(3)
  };

};

/**
 * Capture incoming request data metrics
 */
Metrics.prototype.parseRequest = function(req) {

  var self = this;

  var host   = self.options.host;
  var path   = req._parsedUrl.pathname;
  var search = req._parsedUrl.search;

  if (!host)
    log.error('No hostname was configured for this proxy.');

  return {
    '_meta' : {
      'host' : host
    },
    'req': {
      'href'   : host + path,
      'path'   : path,
      'search' : search
    }
  };

};

/**
 * Capture response data metrics
 */
Metrics.prototype.parseResponse = function(res) {

  var delay = this.responseTime(res.req._startAt);
  var statusCode = res._header ? res.statusCode : null;

  return {
    'res': {
      'contentLength' : res._headers['content-length'],
      'delay'         : delay,
      'statusCode'    : statusCode,
    }
  };

};

/**
 * Assemble correct data structure
 */
Metrics.prototype.assemble = function(metrics) {

  var host = url.parse(metrics._meta.host).host;

  return {
    'database': 'test',
    'tags': {
      'host'   : host,
      'path'   : metrics.req.path,
      'search' : metrics.req.search
    },
    'points': [
      {
        'name': 'latency',
        'timestamp': metrics.timestamp,
        'fields': {
          'ms': parseFloat(metrics.res.delay.ms),
          'ns': metrics.res.delay.ns
        }
      }
    ]
  };

};

/**
 * Send metrics to the metrics aggregator
 */
Metrics.prototype.sendMetrics = function(metrics) {

  log.debug('response code was %s', metrics.res.statusCode);

  if (metrics.res.contentLength)
    log.debug('Payload size was %s bytes', metrics.res.contentLength);

  log.debug('delay: %d%s', metrics.res.delay.ms, 'ms');

  metrics = this.assemble(metrics);

  this.influxClient.write(metrics);
};

module.exports = function(options) {

  var instance = new Metrics(options);

  return function(req, res, next) {

    res.req = req; // inject the request into the response

    var metrics = instance.parseRequest(req);

    // add the start timings
    if (!req.hasOwnProperty('_startAt'))
      req._startAt = process.hrtime();

    // Wait for Express to send the response back to the client
    onFinished(res, function(err, res) {

      if (err)
        return instance.onError(err);

      // add response data to metrics payload
      metrics = _.assign(metrics, instance.parseResponse(res));

      // add timestamp for reporting
      metrics.timestamp = new Date().toISOString();

      log.debug('Collected %j', metrics);

      instance.sendMetrics(metrics);
    });

    next();
  };

};