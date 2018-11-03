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
 * @file status.js
 * @description Routes for accessing status info of the API.
 *
 */

import {getDatabaseConnection, getAllTransferData, getTransferData, saveTransferData} from '../db';
import {generateId, logError, logMessage} from '../util';
import {isHTTPS, transferApiKey, serverUrl} from '../secret';

const archiver = require('archiver');
const formidable = require('formidable');
const fs = require('fs-extra');
const http = require('http');
const https = require('https');
const path = require('path');
const router = require('express').Router();

// Keys which have been issued
const activeKeys = {};

// Where user data should be stored
const USER_DATA_LOCATION = path.join(path.dirname(require.main.filename), '../user_backups');

/**
 * Apply the router to an app, under the '/' directory.
 */
export default function applyRouter(app) {
  app.use('/', router);
  loadActiveKeys();
}

/**
 * Refreshes the active keys and removes those which are no longer active.
 */
export async function updateActiveKeys() {
  try {
    const db = await getDatabaseConnection();
    const transfers = await getAllTransferData(db, true);
    transfers.forEach((transfer) => {
      if (!(transfer.key in activeKeys)) {
        return;
      }

      activeKeys[transfer.key] = false;
      logMessage(`Removed inactive key: ${transfer.key}`);
    });
  } catch (err) {
    logError('Could not update active keys.', err);
  }
}

/**
 * Loads the transfer keys which are still valid in the database.
 */
async function loadActiveKeys() {
  try {
    const db = await getDatabaseConnection();
    const transfers = await getAllTransferData(db, false);
    transfers.forEach((transfer) => {
      activeKeys[transfer.key] = true;
    });
  } catch (err) {
    logError('Could not load active keys.', err);
  }
}

/**
 * Polls the server to see if it's available.
 */
export function isApiAvailable() {
  return new Promise((resolve) => {
    const requester = isHTTPS ? https : http
    requester.get(`${serverUrl}/status`, (response) => {
      const statusCode = response.statusCode;
      const contentType = response.headers['content-type'];

      let error;
      if (statusCode !== 200) {
        error = new Error(`Request failed with status code ${statusCode}`);
      } else if (!/^text\/plain/.test(contentType)) {
        error = new Error(`Invalid content-type ${contentType}`);
      }
      if (error) {
        logError(error.message);
        response.resume();
        resolve(false);
        return;
      }

      let body = '';
      response.on('data', (data) => {
        body += data;
      });

      response.on('end', () => {
        if (body === 'OK') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    }).on('error', (err) => {
      logError('Received error checking api availability');
      logError(err);
      resolve(false);
    });
  });
}

/**
 * GET /status
 *
 * Responds with 'OK' if the API is not overloaded, otherwise responds with 'FULL'
 */
router.get('/status', (req, res) => {
  const response = 'OK';
  res.status(200);
  res.set('Content-Type', 'text/plain');
  res.send(response);
});

/**
 * GET /valid
 *
 * Validates a key.
 */
router.get('/valid', (req, res) => {
  const transferKey = req.query.key;
  let response = 'INVALID_KEY';
  logMessage(`Validating key: ${JSON.stringify(transferKey)}`);
  if (transferKey != null && transferKey in activeKeys) {
    response = 'VALID';
  }
  res.set('Content-Type', 'text/plain');
  res.send(response);
});

/**
 * GET /download
 *
 * Streams a user's data, corresponding to the provided key
 */
router.get('/download', async (req, res) => {
  const transferKey = req.query.key;
  let response = 'INVALID_KEY';
  logMessage(`Validating key: ${JSON.stringify(transferKey)}`);
  if (transferKey != null && transferKey in activeKeys) {
    response = 'VALID';
  }

  if (response === 'INVALID_KEY') {
    res.set('Content-Type', 'text/plain');
    res.send(response);
    return;
  }

  try {
    const db = await getDatabaseConnection();
    logMessage('Download established database connection.');

    const data = await getTransferData(db, transferKey);
    if (data == null) {
      res.set('Content-Type', 'text/plain');
      res.send('INVALID_KEY');
      return;
    }

    const stat = fs.statSync(data.location);
    res.set('Content-Type', 'application/octet-stream');
    res.set('Content-Length', stat.size);
    const stream = fs.createReadStream(data.location, {bufferSize: 32 * 1024});
    stream.pipe(res);
    logMessage(`Successfully fulfilled request for ${transferKey}`);
  } catch (err) {
    logError(err);
  }
});

/**
 * POST /upload
 *
 * Allows a user to transfer their data. Returns a key.
 */
router.post('/upload', (req, res) => {
  logMessage('Receiving upload request.');
  if (req.headers.authorization !== transferApiKey) {
    logMessage(`Invalid API key: ${req.headers.authorization}`);
    res.status(401);
    res.set('Content-Type', 'text/plain');
    res.send('Invalid API key.');
    res.end();
    return;
  }

  let requestId = generateId(5);
  while (requestId in activeKeys) {
    requestId = generateId(5);
  }
  activeKeys[requestId] = true;
  logMessage(`New request ID: ${requestId}`);

  logMessage('Initializing form.');
  const form = new formidable.IncomingForm();
  form.on('error', (err) => {
    logError('Error receiving file.');
    logError(err);
  });

  form.parse(req, () => {
    // Empty function required for parsing, for some reason
  });

  form.on('end', async function() {
    // Temporary location for uploaded file

    /* eslint-disable babel/no-invalid-this */
    /* `this` comes from context where callback is called from, only way to access openedFiles. */

    const tempPath = this.openedFiles[0].path;

    /* eslint-enable babel/no-invalid-this */

    const fileName = requestId;
    const permPath = path.join(USER_DATA_LOCATION, fileName);

    logMessage(`Transfer complete. File location: ${tempPath}`);

    async function completeUpload() {
      try {
        await fs.remove(tempPath);
        logMessage(`Successfully deleted temp file ${tempPath}`);

        const db = await getDatabaseConnection();
        const saveSuccess = await saveTransferData(db, {
          key: requestId,
          time: Date.now(),
          location: permPath,
          removed: false,
        });

        if (saveSuccess) {
          res.set('Content-Type', 'text/plain');
          res.send(`requestId:${requestId}`);
          res.end();
        } else {
          throw new Error('Failed to save to database.');
        }

      } catch (err) {
        logError('Error resolving upload.');
        logError(err);

        res.status(500);
        res.end();
      }
    }

    try {
      await fs.copy(tempPath, permPath);
      logMessage(`File copied successfuly. Location: ${permPath}`);
      const outputStream = fs.createWriteStream(`${permPath}.zip`);
      const zip = archiver('zip');

      outputStream.on('close', () => {
        logMessage(`Zipped file: ${zip.pointer()}`);
        completeUpload();
      });

      zip.on('error', (zipErr) => {
        logError('Error zipping data.');
        logError(zipErr);
      });

      zip.pipe(outputStream);
      zip.file(permPath, {name: fileName});
      zip.finalize();
    } catch (err) {
      logError('Error during upload.');
      logError(err);
    }
  });
});
