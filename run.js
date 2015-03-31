'use strict';
var path = require('path');
var fork = require('child_process').fork;

forkServer();

function forkServer() {
    exports.stop = stop;
    var ready = false;
    var readyCb;
    exports.ready = function (cb) { // for test
        if (ready) cb(null);
        else readyCb = cb;
    };

    var child = fork(path.join(__dirname, 'server.js'), ['--ping-pong'], {
        cwd: __dirname,
        env: process.env,
        execPath: process.execPath,
    })

    var timer;
    child.on('close', function () {
        clearTimeout(timer);
    });

    child.on('error', console.error.bind(console, 'error'));
    child.on('exit', restart);

    function restart() {
        process.nextTick(forkServer);
    };

    var pong = false;
    child.on('message', function (msg) {
        if (!msg || !msg.type) return;
        if (msg.type === 'pong') {
            pong = true;
            if (!ready) {
                ready = true;
                if (readyCb) readyCb(null);
            }
        } else if (msg.type === 'stop') {
            stop();
        }
    });

    function stop(cb) {
        child.removeListener('exit', restart);
        child.on('exit', function () {
            console.log('exited');
            if (typeof cb === 'function') cb(true);
        });
        clearTimeout(timer);
        child.send({
            type: 'stopReady'
        });
    }
    timer = setTimeout(ping, 1000);

    function ping() {
        if (!pong) {
            console.log('server no response, restarting...');
            child.kill();
            return;
        }
        pong = false;
        try {
            child.send({
                type: 'ping'
            });
        } catch (e) {
            child.kill();
        }
        timer = setTimeout(ping, 1000);
    }
    console.log('server started, pid:', child.pid);
}
