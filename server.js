'use strict';
var net = require('net');
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

function addRec(rec) {
    var json;
    if (isValidRecord(rec) && levelsFromLevel[rec.level]) {
        json = JSON.stringify(rec) + '\n';
        levelsFromLevel[rec.level].forEach(function (lvl) {
            var records = recordsFromLevel[lvl];
            records.push(json);
            while (records.length > RECORDS_LENGTH) {
                records.shift();
            }
        });
        ee.emit('record', rec.level, json);
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
        var index, buf, obj;
        while ((index = data.indexOf(10)) > -1) {
            buf = Buffer.concat(bufs.concat([data.slice(0, index)]));
            data = data.slice(index + 1);
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
        }
        if (data.length) {
            bufs.push(data);
        }
    });
    socket.on('end', function () {
        var data = Buffer.concat(bufs);
        var obj;
        try {
            obj = JSON.parse(data.toString('utf-8'));
        } finally {
            if (!obj || (firstJson && !obj.cmd)) {
                socket.end();
                return;
            }
        }
        if (firstJson) {
            run(obj);
        } else {
            addRec(obj);
        }
    });

    function run(obj) {
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
        if (obj.cmd === 'publish') {
            return; // do nothing
        }
        if (obj.cmd === 'subscribe') {
            subscribe(obj);
            return;
        }
    }

    function subscribe(opts) {
        var lvl = levelsFromLevel[opts.level] ? ~~opts.level : 10;
        var recListener = function (level, json) {
            if (level >= lvl) {
                socket.write(json);
            }
        };
        if (opts.history) {
            var time = parseInt(opts.time, 10);
            if (isNaN(time)) time = false;
            if (!time) {
                socket.write(recordsFromLevel[lvl].join(''));
            } else {
                var historyLogs = recordsFromLevel[lvl]
                    .filter(function (json) {
                        if (((new Date(JSON.parse(json).time)).valueOf() >=
                            ((new Date(time)).valueOf()))) {
                            return true;
                        }
                        return false;
                    });
                if (historyLogs.length) {
                    socket.write(historyLogs.join(''));
                }
            }
        }
        ee.on('record', recListener);
        socket.on('end', ee.removeListener.bind(ee, 'record', recListener));
    }
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
