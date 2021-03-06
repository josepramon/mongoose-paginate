'use strict';

/*
 * @list dependencies
 */

var async = require('async');
var Promise = require('bluebird');

/*
 * @method paginate
 * @param {Object} query
 * @param {Object} pagination options
 * @param {Function} [callback]
 * Extend Mongoose Models to paginate queries
 */

function paginate(q, options, callback) {
  /*jshint validthis:true */
  var query, skipFrom, sort, columns, populate, lean, model = this;
  columns = options.columns || null;
  sort = options.sort || options.sortBy || null; // todo: get rid of sortBy in major version
  populate = options.populate || null;
  var lean = options.lean || false;
  var pageNumber = options.page || 1;
  var resultsPerPage = options.limit || 10;
  skipFrom = (pageNumber * resultsPerPage) - resultsPerPage;
  
  var opts = {};
  if(options.score) {
    opts.score = options.score;
  }
  query = model.find(q, opts);

  if (columns !== null) {
    query = query.select(options.columns);
  }
  query = query.skip(skipFrom).limit(resultsPerPage);
  if (sort !== null) {
    query.sort(sort);
  }
  if (populate) {
    if (Array.isArray(populate)) {
      populate.forEach(function(field) {
        query = query.populate(field);
      });
    } else {
      query = query.populate(populate);
    }
  }
  if (lean) {
    query.lean();
  }

  if (typeof callback === 'function') {
    return handleCallback(query, q, model, resultsPerPage, callback);
  } else {
    return handlePromise(query, q, model, resultsPerPage);
  }
}

/**
 * Return a promise with results
 *
 * @method handlePromise
 * @param {Object} query - mongoose query object
 * @param {Object} q - query
 * @param {Object} model - mongoose model
 * @param {Number} resultsPerPage
 * @returns {Promise}
 */

function handlePromise(query, q, model, resultsPerPage) {
  return Promise.all([
    query.exec(),
    model.count(q).exec()
  ]).spread(function(results, count) {
    return [
      results,
      Math.ceil(count / resultsPerPage) || 1,
      count
    ]
  });
}

/**
 * Call callback function passed with results
 *
 * @method handleCallback
 * @param {Object} query - mongoose query object
 * @param {Object} q - query
 * @param {Object} model - mongoose model
 * @param {Number} resultsPerPage
 * @param {Function} callback
 * @returns {void}
 */

function handleCallback(query, q, model, resultsPerPage, callback) {
  return async.parallel({
    results: function(callback) {
      query.exec(callback);
    },
    count: function(callback) {
      model.count(q, function(err, count) {
        callback(err, count);
      });
    }
  }, function(error, data) {
    if (error) {
      return callback(error);
    }
    callback(null, data.results, Math.ceil(data.count / resultsPerPage) || 1, data.count);
  });
}

module.exports = function(schema) {
  schema.statics.paginate = paginate;
};
