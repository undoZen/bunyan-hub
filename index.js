'use strict';
var net = require('net');
var dnode = require('dnode');
var destroy = require('destroy');
var EventEmitter = require('eventemitter3');
var ee = new EventEmitter();

// records kept in memory;
var RECORDS_LENGTH = 500;

// Levels
var TRACE = 10;
var DEBUG = 20;
var INFO = 30;
var WARN = 40;
var ERROR = 50;
var FATAL = 60;
var levelFromName = {
    'trace': TRACE,
    'debug': DEBUG,
    'info': INFO,
    'warn': WARN,
    'error': ERROR,
    'fatal': FATAL
};
var nameFromLevel = {};
var upperNameFromLevel = {};
var upperPaddedNameFromLevel = {};
var recordsFromLevel = {};
Object.keys(levelFromName).forEach(function (name) {
    var lvl = levelFromName[name];
    nameFromLevel[lvl] = name;
    upperNameFromLevel[lvl] = name.toUpperCase();
    upperPaddedNameFromLevel[lvl] = (
        name.length === 4 ? ' ' : '') + name.toUpperCase();
    recordsFromLevel[lvl] = [];
});
var levelsFromLevel = {
    10: [10],
    20: [10, 20],
    30: [10, 20, 30],
    40: [10, 20, 30, 40],
    50: [10, 20, 30, 40, 50],
    60: [10, 20, 30, 40, 50, 60],
};

/**
 * Is this a valid Bunyan log record.
 */
function isValidRecord(rec) {
    if (rec.v == null ||
        rec.level == null ||
        rec.name == null ||
        rec.hostname == null ||
        rec.pid == null ||
        rec.time == null ||
        rec.msg == null) {
        // Not valid Bunyan log.
        return false;
    } else {
        return true;
    }
}

var server = net.createServer(function (c) {
    var historyDone = false;
    var d = dnode({
        log: function (rec, cb) {
            if (isValidRecord(rec) && levelsFromLevel[rec.level]) {
                levelsFromLevel[rec.level].forEach(function (lvl) {
                    var records = recordsFromLevel[lvl];
                    records.push(rec);
                    while (records.length > RECORDS_LENGTH) {
                        records.shift();
                    }
                    ee.emit('record', rec);
                });
            }
        }
    });
    d.on('remote', function (remote) {
        var lvl = 30;
        if (typeof remote.log === 'function') {
            var recListener = function (rec) {
                if (rec.level >= lvl) {
                    remote.log(rec);
                }
            };
            ee.on('record', recListener);
            d.on('end', ee.removeListener.bind(ee, 'record', recListener));
        }
        if (typeof remote.getOptions === 'function') {
            remote.getOptions(function (opts) {
                var level = opts.level;
                if (typeof opts.level === 'string') {
                    level = levelFromName[opts.level.toLowerCase()];
                }
                if (nameFromLevel[level]) {
                    lvl = level;
                }
                if (opts.history) {
                    recordsFromLevel[lvl].forEach(function (rec) {
                        remote.log(rec);
                    });
                }
                historyDone = true;
            });
        } else {
            historyDone = true;
        }
    });
    d.on('fail', console.log.bind(console, 'fail'));
    d.on('error', console.log.bind(console, 'error'));
    d.on('end', function () {
        d.end();
        destroy(d);
        destroy(c);
    });
    c.pipe(d).pipe(c);
});
server.listen(28692); // 'BUNYA' on phone pad
