#!/usr/bin/env node

'use strict';
var path = require('path');
var dnode = require('dnode');
var net = require('net');
var destroy = require('destroy');
var spawn = require('child_process').spawn;
global.Promise = require('bluebird');

new Promise(function (resolve, reject) {
    var d = dnode();
    var listening;
    d.on('error', function (err) {
        if (err.code === 'ECONNREFUSED') {
            resolve(true);
        } else {
            reject(new Error('Error: something wrong'));
        }
        destroy(d);
    });
    d.on('end', function () {
        if (!listening) {
            return reject(new Error(
                'Error: tcp port 28692 already used but it seems' +
                ' not a dnode rpc server.'));
        }
        resolve(true);
    });
    d.on('remote', function (remote) {
        listening = true;
        if (typeof remote.version !== 'function') {
            return reject(new Error(
                'Error: tcp port 28692 already used but it seems' +
                ' not a bunyan-hub server.'));
        }
        remote.version(function (version) {
            reject(new Error('bunyan-hub already running.'));
            d.end();
            destory(d);
        });
    });
    d.connect(28692);
}).then(function (available) {
    if (available) {
        console.log('bunyan-hub will be started...');
        spawn(process.execPath, [path.join(__dirname, 'forever.js')], {
            cwd: __dirname,
            env: process.env,
            silent: true,
            detached: true,
            stdio: ['ignore', 'ignore', 'ignore']
        }).unref();
    }
})
    .catch(function (err) {
        console.log(err.message);
    });
