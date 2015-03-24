#!/usr/bin/env node

'use strict';
var path = require('path');
var net = require('net');
var destroy = require('destroy');
var spawn = require('child_process').spawn;

if (process.argv[2] === 'stop') {
    stop();
} else if (process.argv[2] === 'start') {
    start();
} else {
    help();
}

function help() {
    console.log('\nbunyanhub: a centralized log hub for bunyan\n');
    console.log('usage: bunyanhub [start|stop]\n');
    console.log('    bunyanhub start: start the server');
    console.log('        it will start a tcp server at 127.0.0.1:28692');
    console.log('        waiting other node process to send bunyan format');
    console.log('        logs to it.\n');
    console.log('    bunyanhub stop: stop the server\n');
    console.log('    more information: http://undozen.github.io/bunyan-hub/\n');
}

function stop() {
    net.connect(28692, function () {
        console.log('sending stop command to bunyan-hub...');
        this.end('{"cmd":"stop"}');
    });
    return;
}

function start() {
    var socket = net.connect(28692, function () {
        socket.end('{"cmd":"version"}');
        var bufs = [];
        socket.on('data', bufs.push.bind(bufs));
        socket.on('end', function () {
            var data = Buffer.concat(bufs);
            var obj;
            try {
                obj = JSON.parse(data.toString('utf-8'));
            } finally {
                if (obj.version.match(/^\d+\.\d+\.\d+/)) {
                    console.log('bunyan-hub already running.');
                } else {
                    console.log(
                        'Error: tcp port 28692 already used but it seems' +
                        ' not a bunyan-hub server.');
                }
                destroy(socket);
            }
        });
    });
    socket.on('error', function (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('bunyan-hub will be started...');
            spawn(process.execPath, [path.join(__dirname, 'run.js')], {
                cwd: __dirname,
                env: process.env,
                silent: true,
                detached: true,
                stdio: ['ignore', 'ignore', 'ignore']
            }).unref();
            return;
        }
    });
}
