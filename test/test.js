var async = require('async'),
	express = require('express'),
	sbot = require('sbot'),
	giver = require('../lib/giver');

var giver_port = 40000;
var test_ports = [40001,40002];
var http_servers = [];
var bot = new sbot();
var mappings = {
	"/test": test_ports.map(function(port) { return 'http://localhost:' + port + '/path'; }),
	"/test2": test_ports.map(function(port) { return 'http://localhost:' + port + '/path2'; })
};

var giver_instance = new giver({
	port: giver_port,
	mappings: mappings
});

var create_server = function(port) {
	var app = express();
	app.get('/path', function(req, res) { 
		res.send("Ok");
		console.warn("GOT GET", port)
	});
	app.post('/path2', function(req, res) {
		res.send("Ok");
		console.warn("GOT POST", port);
		req.on('readable', function() {
			var chunk = req.read();
			console.warn("GOT BODY CHUNK:", chunk.toString());
		});
		req.on('end', function() {
			console.warn("POST ENDED", port, req.path);
		});
	});
	app.listen(port);
};

var send_test = function(time, callback) {
	bot.fetch_text(
		'http://localhost:' + giver_port + '/test', 
		{}, 
		function(error, text) {
			bot.fetch_text(
				'http://localhost:' + giver_port + '/test2',
				{ 
					body: "SAMPLE POST",
					method: "POST"
				},
				function(error, data) {
					return process.nextTick(callback);
				}
			);
		}
	);
};

var done = function(error) {
	console.warn("DONE:", error);
};

test_ports.forEach(create_server);
async.times(10, send_test, done);
