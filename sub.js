'use strict';
var net = require('net');
var xtend = require('xtend');
var dnode = require('dnode');
var destroy = require('destroy');

var d = dnode({
    log: function (rec) {
        console.log(JSON.stringify(rec));
    },
    getOptions: function (cb) {
        cb({
            readHistory: true,
            minLevel: 'fatal'
        });
    }
});
d.on('error', console.error.bind(console, 'error'));
d.connect(28692);
d.on('end', function () {
    d.end();
    destroy(d);
});
/*
var minValidRecord = {
    v: 0, //TODO: get this from bunyan.LOG_VERSION
    level: 30,
    name: 'name',
    hostname: 'hostname',
    pid: 123,
    msg: 'msg'
};
d.on('remote', function (remote) {
    remote.log(xtend(minValidRecord, {
        time: Date.now(),
        level: Math.floor(Math.random() * 6 + 1) * 10
    }));
    setInterval(function () {
        remote.log(xtend(minValidRecord, {
            time: Date.now(),
            level: Math.floor(Math.random() * 6) * 10
        }));
    }, 1000);
});
*/
