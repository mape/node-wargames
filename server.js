process.title = 'node-wargames';
process.addListener('uncaughtException', function (err, stack) {
	console.log('Caught exception: ' + err);
	console.log(err.stack.split('\n'));
});
var connect = require('connect');
var assetManager = require('connect-assetmanager');
var assetHandler = require('connect-assetmanager-handlers');
var express = require('express');
var assets = assetManager({
	'js': {
		'route': /\/static\/js\/[0-9]+\/.*\.js/
		, 'path': './public/js/'
		, 'dataType': 'js'
		, 'files': [
			'http://code.jquery.com/jquery-latest.js'
			, 'http://cdn.socket.io/stable/socket.io.js'
			, 'raphael.js'
			, 'map.js'
			, 'jquery.wargames.js'
		]
		, 'preManipulate': {
			'^': [
				function (file, path, index, isLast, callback) {
					if (path.match(/jquery.wargames/)) {
						callback(file.replace(/'#socketIoPort#'/, port));
					} else {
						callback(file);
					}
				}
			]
		}
	}, 'css': {
		'route': /\/static\/css\/[0-9]+\/.*\.css/
		, 'path': './public/css/'
		, 'dataType': 'css'
		, 'files': [
			'wargames.css'
		]
	}
});

var port = 5656;
var app = module.exports = express.createServer();

app.configure(function() {
	app.set('view engine', 'ejs');
	app.set('views', __dirname + '/views');
});

app.configure(function() {
	app.use(connect.logger({ format: ':req[x-real-ip]\t:status\t:method\t:url\t' }));
	app.use(assets);
	app.use(connect.static(__dirname + '/public'));
});

app.dynamicHelpers({
	'cacheTimeStamps': function(req, res) {
		return assets.cacheTimestamps;
	}
});
app.get(/.*/, function(req, res) {
	res.render('layout');
});

app.listen(port, null);

var Wargames = require(__dirname+'/lib/wargames');
new Wargames(app, {
	ircNetwork: 'irc.freenode.net'
	, ircChannel: '#Node.js'
	, ircBotNick: 'MrWarGames'
	, ircUserName: 'MrWarGames'
	, ircRealName: 'MrWarGames'
	, cachePath: '/tmp/cache.json'
});
