var _         = require('lodash-node');
var WebSocket = require('ws');

var Cerberus = function(options) {
  var self = this;

  this.gatewayUrl = 'ws://localhost:8081';
  this._debug     = false;

  _.assign(this, options);

  // create websocket connection to Cerberus Analytics API
  var ws = this.ws = new WebSocket(this.gatewayUrl);

  ws.on('error', self.onError);

  if (self._debug) {
    self.debug();
  }

};

/**
 * Add debug message handlers
 */
Cerberus.prototype.debug = function() {

  if (!this.ws)
    console.warn('No WebSocket connection initialized');

  this.ws.on('open', function() {
    console.info('Successfully connected to Analytics Gateway');
  });

  this.ws.on('message', function(data, flags) {
    data = JSON.parse(data);

    if (data.type === 'WELCOME') {
      console.info('Successfully authenticated with Analytics Gateway');
    }

  });

};

/**
 * onError handler, don't throw an error! We still want the API to work even if
 * it's not aggregating data
 */
Cerberus.prototype.onError = function(err) {
  console.error(err);
};

Cerberus.prototype.Analytics = require('./analytics');

module.exports = function(options) {
  return new Cerberus(options);
};