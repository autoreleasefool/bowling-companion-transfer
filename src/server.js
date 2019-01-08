/**
 *
 * @license
 * Copyright (C) 2016 Joseph Roque
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author Joseph Roque
 * @created 2016-12-18
 * @file server.js
 * @description Initial script starting point for server.
 *
 */

// Imports
import applyRouters from './router';
import startCronJob from './cron';
import {logError, logMessage, isValidAuthenticationKey} from './util';
import {isHTTPS, sslCertificateLocation, sslKeyLocation} from './secret';

const express = require('express');
const fs = require('fs');
const https = require('https');
const http = require('http');
const path = require('path');

/* eslint-disable no-console */

// Print out startup time to default logs
console.log('--------------------');
console.log('Starting new instance of server.');
console.log(new Date());
console.log('--------------------');

// Print out startup time to error
console.error('--------------------');
console.error('Starting new instance of server.');
console.error(new Date());
console.error('--------------------');

/* eslint-enable no-console */

// App setup
const app = express();
const port = isHTTPS ? 8443 : 8080;
app.set('port', port);

// Log each request made to the server
app.use((req, res, next) => {
  let validAuth = isValidAuthenticationKey(req.headers.authorization) ? 'AUTH' : 'INVD';
  logMessage(`(${validAuth}) ${req.method} from ${req.ip}: ${req.originalUrl}`);
  next();
});

// Set up credentials for HTTPS server
var options = isHTTPS ? {
  key: fs.readFileSync(sslKeyLocation).toString(),
  cert: fs.readFileSync(sslCertificateLocation).toString(),
} : {};

// Create HTTP server
const server = isHTTPS ? https.createServer(options, app) : http.createServer(app);
server.on('listening', () => {
  const addr = server.address();
  const bind = typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
  logMessage(`HTTPS is ${isHTTPS ? 'enabled' : 'disabled'}`);
  logMessage(`Listening on ${bind}`);
});
server.on('error', (error) => {
  if (error.syscall !== 'listen') {
    throw error;
  }

  const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      logError(`${bind} requires elevated privileges`);
      process.exit(1);
      break;
    case 'EADDRINUSE':
      logError(`${bind} is already in use`);
      process.exit(1);
      break;
    default:
      throw error;
  }
});
server.listen(port);

// Setup routes
app.use(express.static(path.join(__dirname, 'assets')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
applyRouters(app);

// Serve favicon
app.use(require('serve-favicon')(path.join(__dirname, 'assets', 'favicon.ico')));

// Setup cron job
startCronJob();
