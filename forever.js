'use strict';
var path = require('path');
var forever = require('forever-monitor');
var child = new(forever.Monitor)(path.join(__dirname, 'server.js'), {
    max: 5,
    silent: true,
    args: []
});

child.start();
