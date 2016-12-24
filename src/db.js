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

/**
 * Returns a promise which resolves with a connection to the database, or null
 * if a connection could not be made.
 *
 * @return {Promise<DB>} connection to the database, or null
 */
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

/**
 * Returns all transfer data in the database.
 *
 * @param {DB} db connection to the database
 * @return {Array<Object>} list of transfer details
 */
export function getAllTransferData(db) {
  return new Promise((resolve, reject) => {
    db.collection('transfers')
      .find()
      .toArray()
      .then((data) => resolve(data))
      .catch((err) => reject(err));
  });
}

/**
 * Returns details for a transfer key.
 *
 * @param {DB}     db          connection to the database
 * @param {string} transferKey key to get details for
 * @return {Object} transfer details
 */
export function getTransferData(db, transferKey) {
  return new Promise((resolve, reject) => {
    db.collection('transfers')
      .findOne({key: transferKey})
      .then((data) => {
        return resolve(data);
      })
      .catch((err) => reject(err));
  });
}

/**
 * Saves transfer data in the database.
 *
 * @param {DB}     db           connection to the database
 * @param {Object} transferData data to store
 */
export function saveTransferData(db, transferData) {
  return new Promise((resolve, reject) => {
    db.collection('transfers')
      .insert(transferData)
      .then((result) => {
        return resolve(result.insertedCount === 1);
      })
      .catch((err) => reject(err));
  });
}
