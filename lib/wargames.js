var io = require('socket.io'),
	irc = require('irc'),
	fs = require('fs'),
	http = require('http'),
	dns = require('dns'),
	request = require('request');

process.addListener('uncaughtException', function (err, stack) {
	console.log('Caught exception: ' + err);
	console.log(err.stack);
});

function Wargames(app, options) {
	var self = this;

	if (!app) {
		throw new Error('You must pass the express instance.');
	}
	['ircBotNick', 'ircNetwork', 'ircChannel'].forEach(function (required) {
		if (!options[required]) {
			throw new Error('You must configure ' + required + ' in your options.');
		}
	});

	self.settings = {
		ircNetwork: options.ircNetwork,
		ircChannel: options.ircChannel,
		ircBotNick: options.ircBotNick,
		ircUserName: options.ircUserName || 'node-wargames-bot',
		ircRealName: options.ircRealName || 'node-wargames-bot',
		cachePath: options.cachePath || './cache.js',
		userRemoveTimeout: options.userRemoveTimeout || 2400000,
		maxMessageCount: options.maxMessageCount || 5
	};
	self.app = app;
	self.users = {};
	self.messageCount = 0;
	self.messages = [];

	self.initiateCaching(function () {
		self.bot = self.initiateIrcBot();
		self.server = self.initiateWebsocketServer();
	});
};

Wargames.prototype.fetchHosts = function () {
	var self = this;

	Object.keys(self.users).forEach(function (name) {
		var user = self.users[name];
		if (user.host === undefined) {
			user.host = null;
			self.bot.send('WHOIS ' + name);
		}
	});
};

Wargames.prototype.fetchIps = function () {
	var self = this;

	Object.keys(self.users).forEach(function (name) {
		var user = self.users[name];
		if (user.host && user.ip === undefined) {
			user.ip = null;

			var ipMatch = user.host.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);
			if (ipMatch) {
				user.ip = ipMatch[1];
				self.fetchPositions();
			}
			else {
				(function (user) {
					dns.resolve4(user.host, function (err, addresses) {
						if (!err && addresses) {
							user.ip = addresses[0];
							self.fetchPositions();
						}
					});
				})(user);
			}
		}
	});
};

Wargames.prototype.fetchPositions = function () {
	var self = this;

	Object.keys(self.users).forEach(function (name) {
		var user = self.users[name];
		if (user.lat === undefined && user.ip) {
			(function (user) {
				var ip = user.ip;
				user.lat = null;
				user.lng = null;

				console.log('Fetching position for ' + user.name + '@' + user.ip);
				var lat,lng;
				request({'uri': 'http://geoip.stagas.com/?ip='+user.ip}, function(err, res, body) {
					try {
						var geoInfo = JSON.parse(body);
						lat = geoInfo.latitude;
						lng = geoInfo.longitude;
					} catch(e){}

					if (lat && lng) {
						user.lat = lat;
						user.lng = lng;
						self.sendUpdate(user, true);
					}
				});
			})(user);
		}
	});
};

Wargames.prototype.getPublicUserInfo = function (user) {
	return {
		'name': user.name,
		'lng': user.lng,
		'lat': user.lat,
		'lastActivity': user.lastActivity
	};
};

Wargames.prototype.sendUpdate = function (from, silent) {
	var self = this;

	if (from && from.lat) {
		var returnObj = {
			'action': 'newMessage',
			'from': self.getPublicUserInfo(from),
			'messageCount': self.messageCount
		};

		if (!silent) {
			if (self.messages.length) {
				returnObj.messages = [self.messages[self.messages.length - 1]];
			}
			else {
				returnObj.messages = [];
			}
		}

		self.server.broadcast(JSON.stringify(returnObj));
	}
	else {
		console.log('Failed update, ' + from.name + ' lacks coordinates.');
	}
};

Wargames.prototype.sendLink = function (from, to, lastDitchEffort) {
	var self = this;

	if (from && to && from.lat && to.lat) {
		self.server.broadcast(JSON.stringify({
			'action': 'newLink',
			'from': self.getPublicUserInfo(from),
			'to': self.getPublicUserInfo(to)
		}));
	}
	else {
		console.log('Failed link, ' + from.name + ' (' + (from.lat || 'undefined') + ') or ' + to.name + ' (' + (to.lat || 'undefined') + ') lacks coordinates.');
		if (!lastDitchEffort) {
			setTimeout(function () {
				self.sendLink(from, to, true);
			}, 5000);
		}
	}
};

Wargames.prototype.sendStartupData = function (client) {
	var self = this;

	var activityLimit = new Date().getTime() - self.settings.userRemoveTimeout;
	var userList = {};

	Object.keys(self.users).forEach(function (name) {
		var user = self.users[name];
		if (user.lat && user.lastActivity > activityLimit) {
			userList[name] = self.getPublicUserInfo(user);
		}
	});

	client.send(JSON.stringify({
		'action': 'getUsers',
		'users': userList,
		'removeTimeout': self.settings.userRemoveTimeout,
		'channel': self.settings.ircChannel,
		'messages': self.messages,
		'messageCount': self.messageCount,
		'serverTime': new Date().getTime()
	}));
};

Wargames.prototype.escapeRegexp = function (s) {
	return s.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1');
};

Wargames.prototype.initiateCaching = function (callback) {
	var self = this;

	if (!self.settings.cachePath) {
		console.log('Path to cache file is not configured. Your data will not be persistant.');
		callback();
		return false;
	}

	fs.readFile(self.settings.cachePath, function (err, data) {
		if (err) {
			console.log('Your cache file could not be found or could not be read. Your data will not be persistant.');
		}

		var cacheData = {};

		try {
			cacheData = JSON.parse(data.toString());
		} catch (e) {
			console.log('Your cache file is not valid JSON. Could not recover any data.');
		}
		self.users = cacheData.users || {};
		self.messages = cacheData.messages || [];
		self.messageCount = cacheData.messageCount || 0;

		setInterval(function () {
			var cache = {
				users: self.users,
				messages: self.messages,
				messageCount: self.messageCount
			};
			fs.writeFile(self.settings.cachePath, JSON.stringify(cache), function (err) {});
		}, 10000);

		callback();
	});

	return true;
};

Wargames.prototype.initiateWebsocketServer = function () {
	var self = this;

	var socket = io.listen(self.app);
	socket.on('connection', function (client) {
		connected++;
		self.sendStartupData(client);

		client.on('disconnect', function () {
			connected--;
		});
	});

	var connected = 0;
	return socket;
};
Wargames.prototype.initiateIrcBot = function () {
	var self = this;

	var bot = new irc.Client(self.settings.ircNetwork, self.settings.ircBotNick, {
		'channels': [self.settings.ircChannel],
		'userName': self.settings.ircUserName,
		'realName': self.settings.ircRealName
	});

	bot.addListener('message', function (from, to, message) {
		if (!self.users[from]) {
			self.users[from] = {
				'name': from
			};
			self.fetchHosts();
		}

		self.users[from].lastActivity = new Date().getTime();

		self.messageCount++;
		setTimeout(function () {
			self.messageCount--;
		}, self.settings.userRemoveTimeout);

		self.messages.push({
			'user': from,
			'message': message
		});

		if (self.messages.length > self.settings.maxMessageCount) {
			self.messages.shift();
		}

		self.sendUpdate(self.users[from]);

		var userKeysEscaped = [];
		Object.keys(self.users).forEach(function (user) {
			userKeysEscaped.push(self.escapeRegexp(user));
		});

		var matches = message.match(new RegExp('(' + (userKeysEscaped.join('|') || '----') + ')'));
		if (matches) {
			to = matches[1];
			self.sendLink(self.users[from], self.users[to]);
		}
	});

	bot.addListener('join', function (channel, nick) {
		if (nick && !self.users[nick]) {
			self.users[nick] = {
				'name': nick,
				'lastActivity': new Date().getTime()
			};
			self.fetchHosts();
		}
	});

	// Handle whois data.
	bot.addListener('raw', function (message) {
		if (message.rawCommand == 311) {
			var host = message.args[3];
			self.users[message.args[1]].host = host;

			self.fetchIps();
		}
	});

	return bot;
};

module.exports = Wargames;