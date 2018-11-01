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

import {isApiAvailable} from './api';
import {getCronStatus} from '../cron';
import {getDatabaseConnection} from '../db';
import {logError} from '../util';

const router = require('express').Router();

// Class values for available/unavailable services
const availableClass = 'available';
const unavailableClass = 'unavailable';

// Text values for available/unavailable services
const availableText = 'Available';
const unavailableText = 'Unavailable';

/**
 * Apply the router to an app, under the '/' directory.
 */
export default function applyRouter(app) {
  app.use('/', router);
}

/**
 * GET /
 *
 * Renders the status page
 */
router.get(['/'], (req, res) => {
  let endpointsAvailableClass = unavailableClass;
  let endpointsAvailableText = unavailableText;

  let mongoAvailableClass = unavailableClass;
  let mongoAvailableText = unavailableText;

  let cronAvailableClass = unavailableClass;
  let cronAvailableText = unavailableText;
  let cronJobs = [];

  const dbPromise = getDatabaseConnection()
    .then((db) => {
      if (db != null) {
        mongoAvailableClass = availableClass;
        mongoAvailableText = availableText;
      }
    }).catch((err) => {
      logError('Error determining DB status.', err);
      mongoAvailableClass = unavailableClass;
      mongoAvailableText = unavailableText;
    });

  const apiPromise = isApiAvailable()
    .then((available) => {
      if (available) {
        endpointsAvailableClass = availableClass;
        endpointsAvailableText = availableText;
      }
    })
    .catch((err) => {
      logError('Error determining API status.', err);
      endpointsAvailableClass = unavailableClass;
      endpointsAvailableText = unavailableText;
    })

  cronAvailableClass = availableClass;
  cronAvailableText = availableText;
  cronJobs = getCronStatus();

  const render = () => {
    res.render('status', {
      title: '5 Pin Bowling Companion | API status',
      endpointsAvailableClass,
      endpointsAvailableText,
      mongoAvailableClass,
      mongoAvailableText,
      cronAvailableClass,
      cronAvailableText,
      cronJobs,
      completed: true,
    });
  };

  Promise.all([dbPromise, apiPromise])
    .then(render)
    .catch(render);
});

/**
 * GET /api
 *
 * Gets the API status and sends a JSON response.
 */
router.get(['/api'], (req, res) => {
  let dbStatus = false;
  let apiStatus = false;
  let cronStatus = false;

  const dbPromise = getDatabaseConnection()
    .then((db) => dbStatus = (db != null))
    .catch((err) => {
      logError('Error getting database connection', err);
      dbStatus = false;
    });

  const apiPromise = isApiAvailable()
    .then((available) => apiStatus = available)
    .catch((err) => {
      logError('Error getting API status', err);
      apiStatus = false
    });

  cronStatus = getCronStatus().length > 0

  const render = () => {
    res.json([
      { name: 'API Endpoints', status: apiStatus },
      { name: 'MongoDB', status: dbStatus },
      { name: 'Cron', status: cronStatus },
    ]);
  };

  Promise.all([dbPromise, apiPromise])
    .then(render)
    .catch(render);
});
