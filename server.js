'use strict';
global.Promise = require('bluebird');
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

var server = net.createServer({
    allowHalfOpen: true
}, function (socket) {
    openingConnections.push(socket);
    var _end = socket.end;
    socket.end = function () {
        for (var oc, i = -1; oc = openingConnections[++i];) {
            if (oc === socket) {
                openingConnections.splice(i, 1);
                break;
            }
        }
        process.nextTick(destroy.bind(null, socket));
        return _end.apply(this, arguments);
    };
    var bufs = [];
    var firstMsg = true;
    var firstJson = true;
    socket.on('data', function (data) {
        if (firstMsg) {
            if (data.toString('utf-8')[0] !== '{') {
                socket.removeAllListeners('end');
                socket.end();
                return;
            }
            firstMsg = false;
        }
        var index;
        if ((index = data.indexOf(10)) === -1) {
            bufs.push(data);
            return;
        }
        var buf = Buffer.concat(bufs.concat([data.slice(0, index)]));
        bufs.push(data.slice(index + 1));
        var obj;
        try {
            obj = JSON.parse(buf.toString('utf-8'));
        } finally {
            if (firstJson) {
                if (!obj) {
                    socket.removeAllListeners('end');
                    socket.end();
                    return;
                }
                firstJson = false;
                run(obj);
            } else if (obj) {
                addRec(obj);
            }
        }
    });
    socket.on('end', function () {
        if (!firstJson) return; // already run
        var data = Buffer.concat(bufs);
        var obj;
        try {
            obj = JSON.parse(data.toString('utf-8'));
        } finally {
            if (!obj || !obj.cmd) {
                socket.end();
                return;
            }
        }
        run(obj);
    });

    function run(obj) {
        if (obj.cmd === 'publish') {
            return; // do nothing
        }
        if (obj.cmd === 'version') {
            socket.end(JSON.stringify({
                version: VERSION
            }));
            return;
        }
        if (obj.cmd === 'reset') {
            recordsFromLevel = {
                10: [],
                20: [],
                30: [],
                40: [],
                50: [],
                60: [],
            };
            socket.end(JSON.stringify({
                reset: true
            }));
            return;
        }
        if (obj.cmd === 'stop') {
            process.send({
                type: 'stop'
            });
            socket.end(JSON.stringify({
                stopped: true
            }));
            return;
        }
    }

    return;
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
                            if ((new Date(rec.time)).valueOf() >=
                                ((new Date(opts.historyStartTime))
                                    .valueOf())) {
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
    server.listen(28692, function () {
        process.send({
            type: 'pong'
        });
    });
}
