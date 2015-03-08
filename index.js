var _         = require('lodash-node');
var WebSocket = require('ws');

var bunyan    = require('bunyan');
var log;

var Cerberus = function(options) {
  var self = this;

  // defaults
  this.gatewayUrl = 'ws://localhost:8081';
  this.debug      = false;

  _.assign(this, options);

  // Create websocket connection to Cerberus
  var ws = this.ws = new WebSocket(this.gatewayUrl);

  // Error handler
  ws.on('error', self.onError);

  // Create Bunyan logger
  log = bunyan.createLogger({
    name  : 'cerberus-middleware',
    level : self.debug ? bunyan.DEBUG : bunyan.INFO
  });

  self.openConnection();
};

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

Cerberus.prototype.Analytics = require('./analytics');

module.exports = function(options) {
  return new Cerberus(options);
};