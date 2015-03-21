'use strict';

var request = require('request'),
    _       = require('lodash');

function Influx(opts) {

  var defaults = {
    host : '127.0.0.1',
    port : 8086,
    ssl  : false
  };

  _.assign(defaults, opts);
  _.assign(this, defaults);

  this._protocol = this.ssl ? 'https://' : 'http://';
  this._writeUrl = this._protocol + this.host + ':' + this.port + '/write';
}

Influx.prototype.write = function(data) {
  var self = this;

  console.log('Going to write %j', data);

  request.post({
    url    : self._writeUrl,
    body   : data,
    json   : true
  }, function(err, res, body) {

    if (err)
      throw err;

    if (res.statusCode !== 200)
      console.warn('not ok', res.statusCode);

  });
};

module.exports = Influx;