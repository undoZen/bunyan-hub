'use strict';
var path = require('path');
var fork = require('child_process').fork;

forkServer();

function forkServer() {
    var child = fork(path.join(__dirname, 'server.js'), {
        cwd: __dirname,
        env: process.env,
        execPath: process.execPath,
    })
    child.on('error', console.log.bind(console, 'error'));
    child.on('exit', restart);

    function restart() {
        process.nextTick(forkServer);
    };
    var timer;
    child.on('close', function () {
        clearTimeout(timer);
    });

    var pong = false;
    child.on('message', function (msg) {
        if (!msg || !msg.type) return;
        if (msg.type === 'pong') {
            pong = true;
        } else if (msg.type === 'stop') {
            child.removeListener('exit', restart);
            clearTimeout(timer);
            child.send({
                type: 'stopReady'
            });
        }
    });
    child.send({
        type: 'ping'
    });
    timer = setTimeout(ping, 1000);

    function ping() {
        if (!pong) {
            console.log('server no response, restarting...');
            child.kill();
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
