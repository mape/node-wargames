# node-wargames

Visualization of an IRC channel in a wargame theme.

<img src = "http://mape.me/wargamez.png" border = "0"/>

## Get it working

### Dependencies
* [request](https://github.com/mikeal/node-utils/tree/master/request/) (npm install request)
* [socket.io](https://github.com/learnboost/socket.io-node/) (npm install socket.io)
* [node-irc](http://github.com/martynsmith/node-irc/) (npm install irc)

### Create your war
Change the port on line 43 in server.js

Alter the options at the bottom of server.js to decide what channel/network to join.

### To enable persistant storage

If you want persistant storage a cache path in the app settings.