'use strict';
global.Promise = require('bluebird');
var net = require('net');
var run = require('../../run');

exports.ready = run.ready;

exports.sleep = function sleep(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve.bind(null, true), ms);
    });
};

exports.connect = function connect(opts) {
    return new Promise(function (resolve, reject) {
        var socket = net.connect(opts, function () {
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
