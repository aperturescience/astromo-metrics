'use strict';

var _          = require('lodash-node');
var WebSocket  = require('ws');
var bunyan     = require('bunyan');
var onFinished = require('on-finished');

var log;

function Metrics(client, options) {
  var self = this;

  this.client = client;

  // defaults
  this.gatewayUrl = 'ws://localhost:8081';
  this.debug      = false;

  _.assign(this, options);

  // Create Bunyan logger
  self.log = log = bunyan.createLogger({
    name  : 'astromo.metrics',
    level : self.debug ? bunyan.DEBUG : bunyan.INFO
  });

  self.connect(function() {
    log.debug('Successfully connected');
  });
}

/**
 * Connect to Metrics endpoint
 */
Metrics.prototype.connect = function(callback) {
  var self = this;

  var ws = this.ws = new WebSocket(this.gatewayUrl);

  ws.on('error', self.onError);

  ws.on('open', callback || _.noop);

  ws.on('message', function(data, flags) {
    try {
      self.parseMessage(data, flags);
    } catch(ex) {
      self.onError(ex);
    }
  });
};

/**
 * Parse message from WS connection
 */
Metrics.prototype.parseMessage = function(data, flags) {
  data = JSON.parse(data);

  if (data.type === 'WELCOME') {
    log.debug('Successfully authenticated');
  } else {
    log.warn('Received incorrect welcome message');
  }

};

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
 * Metrics middleware request handler
 */
Metrics.prototype.handler = function(req, res, next) {
  var self = this;

  var metrics = self.parseRequest(req);

  // If we're not using Morgan, add the timings ourself
  if (!req.hasOwnProperty('_startAt'))
    req._startAt = process.hrtime();

  // Wait for Express to send the response back to the client
  onFinished(res, function(err, res) {

    if (err)
      return self.onError(err);

    // add response data to metrics payload
    metrics = _.assign(metrics, self.parseResponse(res));

    self.sendMetrics(metrics);
  });

  next();
};

/**
 * Capture incoming request data metrics
 */
Metrics.prototype.parseRequest = function(req) {

  var self = this;

  if (!self.hostname)
    self.hostname = req.hostname;

  return {
    '_meta' : {
      'host' : self.hostname
    },
    'req': {
      'href' : req.protocol + '://' + self.hostname + req.path,
      'path' : req.originalUrl || req.url
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
 * Send metrics over WS to the gateway
 */
Metrics.prototype.sendMetrics = function(metrics) {

  var self = this,
        ws = this.ws;

  if (!ws)
    return log.warn('No WebSocket connection found, aborting.');

  if (ws.readyState !== WebSocket.OPEN) {
    log.warn('WebSocket connection is not open, aborting.');
    return self.connect();
  }

  log.debug('response code was %s', metrics.res.statusCode);

  if (metrics.res.contentLength)
    log.debug('Payload size was %s bytes', metrics.res.contentLength);

  log.debug('delay: %d%s', metrics.res.delay.ms, 'ms');
  log.debug('Will report %j to %s', metrics, metrics.req.path);

  ws.send(JSON.stringify(metrics));
};

module.exports = function(client, opts) {
  return new Metrics(client, opts);
};