'use strict';
var net = require('net');
var dnode = require('dnode');
var destroy = require('destroy');
var EventEmitter = require('eventemitter3');
var ee = new EventEmitter();
var VERSION = require('./package.json').version;

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

var openingConnections = [];

var server = net.createServer(function (c) {
    var historyDone = false;
    var d = dnode({
        reset: function (cb) {
            recordsFromLevel = {
                10: [],
                20: [],
                30: [],
                40: [],
                50: [],
                60: [],
            };
            if (typeof cb === 'function') {
                cb(true);
            }
        },
        stop: function () {
            process.on('message', function (msg) {
                if (!msg || !msg.type) return;
                if (msg.type === 'stopReady') {
                    console.log('got stopReady');
                    server.on('close', process.exit.bind(process, 0));
                    server.on('close', console.log.bind(console,
                        'closed'));
                    server.close();
                    openingConnections.forEach(function (oc) {
                        oc.end();
                    });
                }
            });
            process.send({
                type: 'stop'
            });
        },
        version: function (cb) {
            cb(VERSION);
        },
        log: function (rec, cb) {
            if (typeof rec === 'string') {
                try {
                    rec = JSON.parse(rec);
                } catch (e) {}
            }
            if (isValidRecord(rec) && levelsFromLevel[rec.level]) {
                levelsFromLevel[rec.level].forEach(function (lvl) {
                    var records = recordsFromLevel[lvl];
                    records.push(rec);
                    while (records.length > RECORDS_LENGTH) {
                        records.shift();
                    }
                });
                ee.emit('record', rec);
            }
        }
    });
    d.on('remote', function (remote) {
        if (typeof remote.getOptions === 'function') {
            remote.getOptions(function (opts) {
                var lvl = opts.minLevel;
                if (typeof lvl === 'string') {
                    lvl = levelFromName[lvl.toLowerCase()];
                }
                if (!nameFromLevel[lvl]) { // make sure lvl value valid
                    lvl = INFO;
                }
                if (opts.readHistory) {
                    recordsFromLevel[lvl].forEach(function (rec) {
                        if (opts.historyStartTime) {
                            if (rec.time >= opts.historyStartTime) {
                                remote.log(rec);
                            }
                        } else {
                            remote.log(rec);
                        }
                    });
                }
                historyDone = true;
                addListener(lvl);
            });
        } else {
            historyDone = true;
            addListener(INFO);
        }

        function addListener(lvl) {
            if (typeof remote.log === 'function') {
                var recListener = function (rec) {
                    if (rec.level >= lvl) {
                        remote.log(rec);
                    }
                }
                ee.on('record', recListener);
                d.on('end', function () {
                    ee.removeListener('record', recListener);
                });
            }
        };
    });
    d.on('fail', console.log.bind(console, 'fail'));
    d.on('error',
        console.log.bind(console, 'error'));
    d.on('end', function () {
        for (var oc, i = -1; oc = openingConnections[++i];) {
            if (oc === c) {
                openingConnections.splice(i, 1);
                break;
            }
        }
        d.end();
        destroy(d);
        destroy(c);
    });
    openingConnections.push(c);
    c.pipe(d).pipe(c);
});
module.exports = server;
server.records = recordsFromLevel;
if (require.main === module) {
    process.on('message', function (msg) {
        if (!msg) return;
        if (msg.type === 'ping') {
            process.send({
                type: 'pong'
            });
        }
    });
    server.listen(28692);
}
