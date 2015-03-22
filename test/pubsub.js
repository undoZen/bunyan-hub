'use strict';
global.Promise = require('bluebird');
var tape = require('tape');
var co = require('co');
var utils = require('./utils');
var xtend = require('xtend');

var minValidRecord = {
    v: 0, //TODO: get this from bunyan.LOG_VERSION
    level: 30,
    name: 'name',
    hostname: 'hostname',
    pid: 123,
    time: Date.now(),
    msg: 'msg'
};

var time0 = 1400000000000;
var rec1 = xtend(minValidRecord, {
    time: time0 + 1000,
});
var rec2 = xtend(minValidRecord, {
    level: 10,
    time: time0 + 2000,
})
var rec3 = xtend(minValidRecord, {
    level: 20,
    time: time0 + 3000,
})

tape('publish and subscribe to hub', co.wrap(function * (test) {
    test.plan(4);
    yield utils.ready;
    var socket = yield utils.connect(28692);
    var sub = yield utils.connect(28692);
    var sub30 = yield utils.connect(28692);
    socket.write('{"cmd":"publish"}\n');
    sub.write('{"cmd":"subscribe"}\n');
    sub30.write('{"cmd":"subscribe","level":30}\n');
    sub30.ee.on('record', function (rec) {
        test.deepEqual(rec, rec1);
    });
    sub.ee.on('record', function (rec) {
        test.deepEqual(rec, rec1);
    });
    yield utils.sleep(200);
    socket.write(JSON.stringify(rec1) + '\n');
    yield utils.sleep(200);
    sub.ee.removeAllListeners('record');
    sub.ee.on('record', function (rec) {
        test.deepEqual(rec, rec2);
    });
    socket.write(JSON.stringify(rec2) + '\n');
    yield utils.sleep(200);
    sub.ee.removeAllListeners('record');
    sub.ee.on('record', function (rec) {
        test.deepEqual(rec, rec3);
    });
    socket.write(
        '{"v":0,"level":20,"name":"name","hostname":"hostname",');
    yield utils.sleep(200);
    socket.write('"pid":123,"time":' + (time0 + 3000) + ',"msg":"msg"}');
    sub.end();
    sub30.end();
    /*
    yield utils.sleep(200);
    socket.write(rec4);
    socket.write(rec5);
    socket.write(rec6);
    socket.write(rec7);
    */
    socket.end();
}));

tape('got history by level', co.wrap(function * (test) {
    test.plan(6);
    var sub = yield utils.connect(28692);
    sub.write('{"cmd":"subscribe","history":true}\n');
    var records = [];
    sub.ee.on('record', records.push.bind(records));
    yield utils.sleep(500);
    sub.end();
    test.equal(records.length, 3);
    var sub = yield utils.connect(28692);
    sub.write('{"cmd":"subscribe","history":true,"level":20}\n');
    var records = [];
    sub.ee.on('record', records.push.bind(records));
    yield utils.sleep(500);
    sub.end();
    test.equal(records.length, 2);
    test.deepEqual(records[0], rec1);
    test.deepEqual(records[1], rec3);
    var sub = yield utils.connect(28692);
    sub.write('{"cmd":"subscribe","history":true,"level":20,"time":' +
        rec2.time + '}\n');
    var records = [];
    sub.ee.on('record', records.push.bind(records));
    yield utils.sleep(500);
    sub.end();
    test.equal(records.length, 1);
    test.deepEqual(records[0], rec3);
}));

tape('server could be stopped', co.wrap(function * (test) {
    test.plan(1);
    yield utils.ready;
    var socket = yield utils.connect(28692);
    process.nextTick(socket.end.bind(socket, '{"cmd":"stop"}'));
    var obj = yield utils.respond(socket);
    test.ok(obj.stopped);
}));
