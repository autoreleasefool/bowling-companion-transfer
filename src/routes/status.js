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

import {getDatabaseConnection} from '../db';
import {logError} from '../util';

const router = require('express').Router();

const availableClass = 'available';
const unavailableClass = 'unavailable';

const availableText = 'Available';
const unavailableText = 'Unavailable';

/**
 * Apply the router to an app, under the '/' directory.
 */
export default function applyRouter(app) {
  app.use('/', router);
}

/**
 * GET /, GET /status
 *
 * Renders the status page
 */
router.get(['/', '/status'], (req, res) => {
  let endpointsAvailableClass = unavailableClass;
  let endpointsAvailableText = unavailableText;

  let mongoAvailableClass = unavailableClass;
  let mongoAvailableText = unavailableText;

  getDatabaseConnection()
    .then((db) => {
      if (db != null) {
        mongoAvailableClass = availableClass;
        mongoAvailableText = availableText;
      }

      res.render('status', {
        title: '5 Pin Bowling Companion | API status',
        endpointsAvailableClass,
        endpointsAvailableText,
        mongoAvailableClass,
        mongoAvailableText,
        completed: true,
      });
      return null;
    })
    .catch((err) => {
      logError('Error determining API status.');
      logError(err);
      res.render('status', {
        title: '5 Pin Bowling Companion | API status',
        endpointsAvailableClass,
        endpointsAvailableText,
        mongoAvailableClass,
        mongoAvailableText,
        completed: false,
      });
    });
});
