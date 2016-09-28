var giver = require('../lib/giver'),
	commander = require('commander');

commander
	.option('-c, --config <config>', 'Config File', String, '/etc/giver.json')
	.parse(process.argv);

var config = require(commander.config); 

var giver_instance = new giver(config);
console.warn("Running on ", config.port);
