'use strict';
var path = require('path');
var tape = require('tape');
var co = require('co');
var utils = require('./utils');
var xtend = require('xtend');
var spawnSync = require('child_process').spawnSync;
var PubStream, pubStream, sub;

tape('start bunyan-hub by command', function (test) {
    test.plan(1);
    var result = spawnSync(process.execPath, [path.join(__dirname,
        '..', 'cmd.js'), 'start']);
    test.ok(result.stdout.toString().match(/started/));
});

tape('get server version', co.wrap(function * (test) {
    test.plan(2);
    yield utils.sleep(800);
    var buf = new Buffer(0);
    var socket = yield utils.connect(28692);
    process.nextTick(socket.write.bind(socket,
        '{"cmd":"version"}\nblahblah'));
    var obj = yield utils.respond(socket);
    test.equal(typeof obj.version, 'string');
    console.log(obj);
    test.ok(obj.version.match(/^\d+\.\d+\.\d+/));
}));

tape('stop running by command', function (test) {
    test.plan(1);
    var result = spawnSync(process.execPath, [path.join(__dirname,
        '..', 'cmd.js'), 'stop']);
    test.ok(result.stdout.toString().match(/sending stop command/));
});
