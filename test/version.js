'use strict';
global.Promise = require('bluebird');
var tape = require('tape');
var co = require('co');

tape('get server version', co.wrap(function * (test) {
    var utils = require('./utils');
    test.plan(3);
    yield utils.ready;
    var buf = new Buffer(0);
    var socket = yield utils.connect(28692);
    process.nextTick(socket.end.bind(socket, '{"cmd":"version"}'));
    var obj = yield utils.respond(socket);
    test.equal(typeof obj.version, 'string');
    console.log(obj);
    test.ok(obj.version.match(/^\d+\.\d+\.\d+/));
    utils.stop(test);
}));
