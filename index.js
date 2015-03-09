'use strict';

var _         = require('lodash-node');
var WebSocket = require('ws');

var bunyan    = require('bunyan');
var log;

var Metrics = require('./metrics');

function Cerberus(options) {
  var self = this;

  // defaults
  this.gatewayUrl = 'ws://localhost:8081';
  this.debug      = false;

  _.assign(this, options);

  // Create Bunyan logger
  this.log = log = bunyan.createLogger({
    name  : 'cerberus-middleware',
    level : self.debug ? bunyan.DEBUG : bunyan.INFO
  });

  // Cerberus sub-modules
  this.Metrics = new Metrics(this).handler;

  // Create websocket connection to Cerberus
  var ws = this.ws = new WebSocket(this.gatewayUrl);

  // Error handler
  ws.on('error', self.onError);

  self.openConnection();
}

/**
 * Add message handlers
 */
Cerberus.prototype.openConnection = function() {

  var ws = this.ws,
    self = this;

  if (!ws)
    log.warn('No WebSocket connection initialized');

  ws.on('open', function() {
    log.debug('[Cerberus] Successfully connected');
  });

  ws.on('message', self.parseMessage);
};

/**
 * Parse message from WS connection
 */
Cerberus.prototype.parseMessage = function(data, flags) {
  data = JSON.parse(data);

  if (data.type === 'WELCOME') {
    log.debug('[Cerberus] Successfully authenticated');
  }

};

/**
 * /!\ Don't throw an error when something goes wrong!
 * We still want the API to work even if it's not aggregating data
 */
Cerberus.prototype.onError = function(err) {
  log.error(err);
};

module.exports = function(options) {
  return new Cerberus(options);
};