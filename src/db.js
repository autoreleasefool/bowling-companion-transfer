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

import {logError} from './util';

const mongodb = require('mongodb');

// MongoDB
const MongoClient = mongodb.MongoClient;
// Local URL of the mongo database.
const MONGO_URL = 'mongodb://localhost:27017/bowlingdata';

export function getDatabaseConnection() {
  return new Promise((resolve) => {
    MongoClient.connect(MONGO_URL, (err, db) => {
      if (err) {
        logError('Error establishing database connection.');
        logError(err);
        resolve(null);
      } else {
        resolve(db);
      }
    });
  });
}
