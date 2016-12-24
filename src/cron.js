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
 * @created 2016-12-24
 * @file cron.js
 * @description Creates cron jobs
 *
 */

import {getDatabaseConnection, getAllTransferData} from './db';
import {logError, logMessage} from './util';

const cron = require('cron');
const fs = require('fs-extra');

// Set of cron jobs running
const cronJobs = {};

// How long before a transfer should become invalid
const TRANSFER_TIME_TO_LIVE = 60 * 60 * 1000;

/**
 * Starts a cron job and adds it to the active cron jobs.
 */
function initializeJob(name, cronJob) {
  cronJobs[name] = cronJob;
  cronJob.job._callbacks[0]();
  cronJob.job.start();
}

/**
 * Callback for when a cron job finishes to update stats.
 */
function jobFinished(name, startTime) {
  logMessage(`Finished running job ${name}`);
  cronJobs[name].lastStartTime = startTime;
  cronJobs[name].lastRunTime = Date.now() - startTime;
}

// Cron job that runs every hour to clear out transfer data
function cleanup(name) {
  logMessage(`Running ${name}`);

  const currentTime = Date.now();
  getDatabaseConnection()
    .then((db) => {
      if (db == null) {
        logMessage(`Failed to run ${name}`);
        return null;
      }
      logMessage(`${name} established database connection.`);

      return getAllTransferData(db);
    })
    .then((transfers) => {
      if (transfers == null) {
        logMessage('Eror retrieving documents.');
        return null;
      }

      for (let i = 0; i < transfers.length; i++) {
        const doc = transfers[i];
        if (doc != null) {
          if (doc.time + TRANSFER_TIME_TO_LIVE < currentTime) {
            fs.remove(doc.location, (removeErr) => {
              if (removeErr) {
                logError(`Error removing file ${doc.location}`);
                logError(removeErr);
              } else {
                logMessage(`Successfully deleted file ${doc.location}`);
              }
            });
          }
        }
      }

      jobFinished(name, currentTime);
      return null;
    })
    .catch((err) => {
      logError(`Error running ${name}`);
      logError(err);
    });
}

/**
 * Sets up all cron jobs required for the app.
 */
export default function setup() {
  const cleanupJob = {
    job: new cron.CronJob({
      cronTime: '0 0 * * * *',
      onTick: cleanup.bind(this, 'cleanup'),
      start: false,
      timeZone: 'America/New_York',
    }),
    lastStartTime: null,
    lastRunTime: null,
  };
  initializeJob('cleanup', cleanupJob);
}

/**
 * Returns an object containing data about the various cron jobs running.
 */
export function getCronStatus() {
  const status = {};
  for (const job in cronJobs) {
    if (cronJobs.hasOwnProperty(job)) {
      status[job] = {
        lastStartTime: cronJobs[job].lastStartTime,
        lastRunTime: cronJobs[job].lastRunTime,
      };
    }
  }

  return status;
}
