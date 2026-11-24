'use strict';
// minimist: parse command-line options, e.g. `node src/server.js --port 8080`
const minimist = require('minimist');
const { createServer } = require('./app');

const argv = minimist(process.argv.slice(2), {
  default: { port: process.env.PORT || 3000, host: '0.0.0.0' },
});

const server = createServer();
server.listen(Number(argv.port), argv.host, () => {
  console.log(`demo-vulnerable-app listening on http://${argv.host}:${argv.port}`);
});
