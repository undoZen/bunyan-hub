'use strict';
var tape = require('tape');
var co = require('co');
var utils = require('./utils');
var net = require('net');

var run = utils.run();
tape('get server version', co.wrap(function * (test) {
    test.plan(2);
    yield run.ready;
    var buf = new Buffer(0);
    var socket = yield utils.connect(28692);
    process.nextTick(socket.write.bind(socket,
        '{"cmd":"version"}\nblahblah'));
    var obj = yield utils.respond(socket);
    test.equal(typeof obj.version, 'string');
    console.log(obj);
    test.ok(obj.version.match(/^\d+\.\d+\.\d+/));
}));

tape('server could be stopped', co.wrap(function * (test) {
    test.plan(1);
    var buf = new Buffer(0);
    var socket = yield utils.connect(28692);
    socket.end('{"cmd":"stop"}');
    yield utils.sleep(500);
    var socket = net.connect(28692);
    socket.on('error', function (err) {
        test.equal(err.code, 'ECONNREFUSED');
    });
}));
