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

import {updateActiveKeys} from './routes/api';
import {
  getDatabaseConnection,
  getAllTransferData,
  updateTransferData,
} from './db';
import {logError, logMessage, formatMilliseconds} from './util';

const cron = require('cron');
const dateFormat = require('dateformat');
const fs = require('fs-extra');

// Set of cron jobs running
const cronJobs = {};

// How long before a transfer should become invalid
const TRANSFER_TIME_TO_LIVE = 60 * 60 * 1000;

/**
 * Creates a cron job and adds it to the active jobs.
 */
function createJob(name, job) {
  cronJobs[name] = job;
  job.job._callbacks[0]();
  job.job.start();
}

/**
 * Starts a cron job and adds it to the active cron jobs.
 */
function initializeJob(name) {
  logMessage(`Running job ${name}`);
  cronJobs[name].lastStartTime = Date.now();
  cronJobs[name].lastRunTime = 0;
}

/**
 * Callback for when a cron job finishes to update stats.
 */
function jobFinished(name) {
  const runTime = Date.now() - cronJobs[name].lastStartTime;
  logMessage(`Finished running job ${name} in ${runTime}ms`);
  cronJobs[name].lastRunTime = runTime;
}

/**
 * Cron job that runs every hour to clear out transfer data
 */
async function cleanup() {
  initializeJob('cleanup');
  const currentTime = Date.now();

  async function cleanupTransfer(transfer) {
    if (transfer == null || transfer.time + TRANSFER_TIME_TO_LIVE > currentTime) {
      return null;
    }

    try {
      await fs.remove(transfer.location);
      logMessage(`Successfully deleted file ${transfer.location}`);
      return transfer;
    } catch (removeErr) {
      logError(`Error removing file ${transfer.location}`);
      logError(removeErr);
      return null;
    }
  }

  let db = null;
  try {
    db = await getDatabaseConnection();
    const transfers = await getAllTransferData(db, false);
    const cleanupResults = await Promise.all(transfers.map((transfer) => {
      return cleanupTransfer(transfer);
    }));

    cleanupResults.forEach(async (transfer) => {
      if (transfer == null) {
        return;
      }

      transfer.removed = true;
      await updateTransferData(db, transfer);
    });

    updateActiveKeys();
  } catch (err) {
    logError('Error running cleanup');
    logError(err);
  }

  if (db) {
    db.close();
  }

  jobFinished('cleanup');
}

/**
 * Sets up all cron jobs required for the app.
 */
export default function setup() {
  const cleanupJob = {
    job: new cron.CronJob({
      cronTime: '0 0 * * * *',
      onTick: () => cleanup(),
      start: false,
      timeZone: 'America/New_York',
    }),
    lastStartTime: null,
    lastRunTime: null,
  };

  createJob('cleanup', cleanupJob);
}

/**
 * Returns an object containing data about the various cron jobs running.
 */
export function getCronStatus() {
  const status = [];
  for (const job in cronJobs) {
    if (cronJobs.hasOwnProperty(job)) {
      status.push({
        name: job,
        lastStartTime: dateFormat(new Date(cronJobs[job].lastStartTime), 'yyyy/mm/dd HH:MM:ss'),
        lastRunTime: formatMilliseconds(cronJobs[job].lastRunTime),
      });
    }
  }

  return status;
}
