var async = require('async'),
	http = require('http'),
	url = require('url'),
	https = require('https'),
	_ = require('underscore'),
	fast_bindall = require('fast_bindall'),
	express = require('express');

var Giver = function(options) {
	_.extend(this, options);
	fast_bindall(this);
	this.uri_options = {};
	if (!this.logger) {
		this.logger = console;
	}
	this.init();
};

_.extend(Giver.prototype, {
	init: function() {
		var self = this;
		this.app = express();
		this.app.use(require('connect-requestid'));
		if (!this.mappings) { 
			this.logger.warn("No mappings found!"); 
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
			this.logger.warn("No port found!");
			return process.exit();
		}
		if (this.ssl_config) {
			this.https_server = https.createServer(
				this.ssl_config,
				this.app
			);
			this.https_server.listen(this.port);
		}
		else {
			this.app.listen(this.port);
		}
	},
	handle_req: function(req, res) {
		var self = this;
		var map = this.mappings[req.path];
		if (!map) { return res.send('No Map'); }
		var request_route = req.route ? req.route.path : reqt.url;
		this.logger.info("receiving " + [req.id, req.method, req.url, request_route, req.headers.host].join(' '));
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
			options.headers.host = uri_opts.hostname;
			var proto = uri_opts.protocol === 'http:' ? http : https;
			self.logger.info("giving " + req.id + " " + JSON.stringify(options));
			var outgoing = proto.request(options, function(response) {
				self.logger.info("RESPONSE HEADERS:", response.req_id, JSON.stringify(response.headers));
				response.req_id = req.id;
				response.on('data', function(chunk) {
					// self.logger.info("RECEIVED DATA: " + endpoint, response.req_id, chunk.toString());
				});
				response.on('end', function() {
					// self.logger.info(endpoint, response.req_id);
				});
			});
			outgoing.on('error', function(error) {
				self.logger.warn("Outgoing error: " + endpoint, JSON.stringify(error));
			});
			outgoing.on('close', function(error) {
				self.logger.info("gift given " + req.id + " " + options.hostname);
			});
			return outgoing;
		});
		req.on('readable', function() {
			var chunk = req.read();
			if (chunk) {
				outgoings.forEach(function(outgoing) {
					if (outgoing) {
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
			res.sendStatus(200);
		});
	}
});

module.exports = Giver;
