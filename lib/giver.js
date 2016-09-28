var async = require('async'),
	http = require('http'),
	url = require('url'),
	https = require('https'),
	_ = require('lodash'),
	fast_bindall = require('fast_bindall'),
	express = require('express');

var Giver = function(options) {
	_.extend(this, options);
	fast_bindall(this);
	this.uri_options = {};
	this.init();
};

_.extend(Giver.prototype, {
	init: function() {
		var self = this;
		this.app = express();
		if (!this.mappings) { 
			console.warn("No mappings found!"); 
			return process.exit();
		}
		Object.keys(this.mappings).forEach(function(path) {
			self.app.all(path, self.handle_req);
			self.mappings[path].forEach(function(uri) {
				if (!self.uri_options[uri]) {
					self.uri_options[uri] = url.parse(uri);
				}
			});
		});
		if (!this.port) { 
			console.warn("No port found!");
			return process.exit();
		}
		this.app.listen(this.port);
	},
	handle_req: function(req, res) {
		var self = this;
		var map = this.mappings[req.path];
		if (!map) { return res.send('No Map'); }
		var outgoings = map.map(function(endpoint) {
			var uri_opts = self.uri_options[endpoint];
			if (!uri_opts) {
				return null;
			}
			var options = {
				hostname: uri_opts.hostname,
				path: uri_opts.path,
				method: req.method,
				headers: req.headers
			};
			if (uri_opts.port) { 
				options.port = uri_opts.port;
			}
			var proto = uri_opts.protocol === 'http:' ? http : https;
			return proto.request(options);
		});
		req.on('readable', function() {
			var chunk = req.read();
			if (chunk) {
				outgoings.forEach(function(outgoing) {
					if (outgoing) {
						console.warn("WRITING CHUNCK");
						outgoing.write(chunk);
					}
				});
			}
		});
		req.on('end', function() {
			outgoings.forEach(function(outgoing) {
				if (outgoing) {
					outgoing.end();
				}
			});
			res.send('Ok');
		});
	}
});

module.exports = Giver;
