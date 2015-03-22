'use strict';
var net = require('net');
var run = require('../../run');
var EventEmitter = require('eventemitter3');

exports.ready = run.ready;

exports.sleep = function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve.bind(null, true), ms);
    });
};

exports.connect = function connect(opts) {
    return new Promise(function (resolve, reject) {
        var socket = net.connect(opts, function () {
            socket.ee = new EventEmitter();
            var bufs = [];
            socket.on('data', function (data) {
                var index, buf, obj;
                while ((index = data.indexOf(10)) > -1) {
                    buf = Buffer.concat(bufs.concat([data.slice(0,
                        index)]));
                    data = data.slice(index + 1);
                    try {
                        obj = JSON.parse(buf.toString('utf-8'));
                    } finally {
                        if (obj) {
                            socket.ee.emit('record', obj);
                        }
                    }
                }
                if (data.length) {
                    bufs.push(data);
                }
            });
            resolve(socket);
        });
        socket.on('error', reject);
    });
};

exports.stop = function (test) {
    run.stop(function (stopped) {
        test.ok(stopped);
    });
};

exports.respond = function (socket) {
    return new Promise(function (resolve, reject) {
        var bufs = [];
        socket.on('data', function (data) {
            bufs.push(data);
        });
        socket.on('end', function () {
            var data = Buffer.concat(bufs);
            var obj;
            try {
                obj = JSON.parse(data.toString('utf-8'));
            } catch (e) {
                reject(e);
                return;
            }
            resolve(obj);
        });
    });
}
