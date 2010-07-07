var Wargames = require('./lib/wargames');

new Wargames({
	websocketPort: 1337
	, ircNetwork: 'irc.freenode.net'
	, ircChannel: '#nodejs.bots'
	, ircBotNick: 'MrWarGames'
	, ircUserName: 'WargamesExample'
	, ircRealName: 'WargamesExample'
	, cachePath: './cache.json'
});