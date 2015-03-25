# bunyan-hub

A centralized bunyan log aggregator.

[bunyan](https://github.com/trentm/node-bunyan) is a simple and powerful log module for node.js. This program is a server which collecting log events from all local node service. It simply start a tcp server on 28692 (BUNYA on phonepad) and waiting other node program to send new-line determined JSON string to it. You can use [bunyan-hub-logger](https://www.npmjs.com/package/bunyan-hub-logger) (or [bunyan-pub-stream](https://www.npmjs.com/package/bunyan-pub-stream) + bunyan) to push log to it and use [bunyan-sub](https://www.npmjs.com/package/bunyan-sub) cli tool to subcribes to it with specified conditions. or use [bunyan-sub-stream](https://www.npmjs.com/package/bunyan-sub-stream) api for programing use.

I'm also planning develop a web dashboad for it like [logio](http://logio.org/) and then it would a killer app for having a local centralized log aggregator.

## install

```bash
npm i -g bunyan-hub
```

## usage

```bash
bunyanhub start
bunyanhub stop
```

## protocol
once connected to localhost:28692 which bunyan-hub listening, you could write a JSON with `cmd` property ending with `\n` or FIN.

`{"cmd":"stop"}\n` will stop the server.
`{"cmd":"version"}\n` will give you bunyah-hub version back.
`{"cmd":"publish"}\n` will return you nothing, but expect you to further sending more JSON string which is in bunyan record format.
`{"cmd":"subscribe"}\n` will turn you tcp client into subscription mode, bunyan-hub will send you bunyan records in new-line determined JSON string.

usually you don't need to use raw TCP connection you self, instead using high level modules mentioned in the top section of this readme document.

## license
MIT
