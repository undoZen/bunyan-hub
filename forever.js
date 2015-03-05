'use strict';
var path = require('path');
var forever = require('forever-monitor');
var child = new(forever.Monitor)(path.join(__dirname, 'run.js'), {
    max: 5,
    silent: true,
    args: [],
    pidFile: path.join(__dirname, 'hub.pid'),
    minUptime: 2000,
    spinSleepTime: 1000,
});

child.on('start', function () {
    console.log('bunyan-hub server.js started');
});

child.on('exit', function () {
    console.log('bunyan-hub server.js has exited after 5 restarts');
});

child.start();
