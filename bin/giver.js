#!/usr/bin/env node

const giver     = require('../lib/giver'),
      logger    = require('../lib/logger'),
	  commander = require('commander'),
	  cluster   = require('cluster');

commander
	.option('-c, --config <config>', 'Config File', String, '/etc/giver.json')
	.option('-d, --daemon', 'Shut off console logging')
	.parse(process.argv);

const config = require(commander.config); 
const giver_logger = new logger({
	filename: 'giver-%DATE%.log',
	console: commander.daemon === true ? false : true,
	dirname: config.log_dirname || ''
});
giver_logger.extend(console);
config.logger = giver_logger;

if (cluster.isMaster) {
	cluster.fork();
	cluster.on('exit', function(worker) {
		console.log('worker ' + worker.pin + ' died');
		cluster.fork();
	});
}
else {
	var giver_instance = new giver(config);
	console.log("TheGiver is recieving on " + config.port);
}

