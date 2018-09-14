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
const MONGO_URL = 'mongodb://localhost:27017/bowling_companion';

/**
 * Returns a promise which resolves with a connection to the database, or null
 * if a connection could not be made.
 *
 * @return {Promise<DB>} connection to the database, or null
 */
export async function getDatabaseConnection() {
  try {
    const client = await MongoClient.connect(MONGO_URL, {useNewUrlParser: true});
    return await client.db();
  } catch (ex) {
    logError('Error establishing database connection.');
    logError(ex);
    throw ex;
  }
}

/**
 * Returns all transfer data in the database.
 *
 * @param {DB}      db      connection to the database
 * @param {boolean} removed true for only removed transfers, false for only transfers not removed, null for all
 * @return {Array<Object>} list of transfer details
 */
export async function getAllTransferData(db, removed) {
  return db.collection('transfers')
    .find(removed == null ? {} : {removed})
    .toArray();
}

/**
 * Returns details for a transfer key.
 *
 * @param {DB}     db          connection to the database
 * @param {string} transferKey key to get details for
 * @return {Object} transfer details
 */
export async function getTransferData(db, transferKey) {
  return db.collection('transfers')
    .findOne({key: transferKey});
}

/**
 * Saves transfer data in the database.
 *
 * @param {DB}     db           connection to the database
 * @param {Object} transferData data to store
 */
export async function saveTransferData(db, transferData) {
  return db.collection('transfers')
    .insertOne(transferData)
    .then((result) => {
      return result.insertedCount === 1;
    });
}

/**
 * Updates transfer data in the database.
 *
 * @param {DB}     db           connection to the database
 * @param {Object} transferData data to update
 */
export async function updateTransferData(db, transferData) {
  db.collection('transfers')
    .updateOne({_id: transferData._id}, {$set: {...transferData}})
    .then((result) => {
      return result.insertedCount === 1;
    });
}

