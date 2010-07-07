# node-wargames

Visualization of an IRC channel in a wargame theme.
<img src = "http://mape.me/wargamez.png" border = "0"/>

## Get it working

### Dependencies
 * [node-websocket-server](http://github.com/miksago/node-websocket-server/)
 * [node-irc](http://github.com/martynsmith/node-irc/)

### Create your app
Create an app.js file including the wargames module and enter your settings.

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

### To get the web page working

You need to alter the path in jquery.wargames.js to your new wargames server.

    new ircMap({
        server: 'ws://yourpage.td:1337'
    });

### To enable persistant storage

If you want persistant storage create a cache.json file and set the correct path in the app settings.


http://mape.me/wargames.png