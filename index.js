
/**
 * Module Dependencies
 */
// ...
// e.g.
// var _ = require('lodash');
// var mysql = require('node-mysql');
// ...

var Vogels = require('vogels');
var AWS = Vogels.AWS;
var _ = require('lodash');
var https = require('https');
var DynamoDB = false;

/**
 * Sails Boilerplate Adapter
 *
 * Most of the methods below are optional.
 * 
 * If you don't need / can't get to every method, just implement
 * what you have time for.  The other methods will only fail if
 * you try to call them!
 * 
 * For many adapters, this file is all you need.  For very complex adapters, you may need more flexiblity.
 * In any case, it's probably a good idea to start with one file and refactor only if necessary.
 * If you do go that route, it's conventional in Node to create a `./lib` directory for your private submodules
 * and load them at the top of the file with other dependencies.  e.g. var update = `require('./lib/update')`;
 */
module.exports = (function () {

    // Hold connections for this adapter
    var connections = {};

    // You'll want to maintain a reference to each collection
    // (aka model) that gets registered with this adapter.
    var _modelReferences = {};

    var _definedTables = {};

    // You may also want to store additional, private data
    // per-collection (esp. if your data store uses persistent
    // connections).
    //
    // Keep in mind that models can be configured to use different databases
    // within the same app, at the same time.
    // 
    // i.e. if you're writing a MariaDB adapter, you should be aware that one
    // model might be configured as `host="localhost"` and another might be using
    // `host="foo.com"` at the same time.  Same thing goes for user, database, 
    // password, or any other config.
    //
    // You don't have to support this feature right off the bat in your
    // adapter, but it ought to get done eventually.
    // 
    // Sounds annoying to deal with...
    // ...but it's not bad.  In each method, acquire a connection using the config
    // for the current model (looking it up from `_modelReferences`), establish
    // a connection, then tear it down before calling your method's callback.
    // Finally, as an optimization, you might use a db pool for each distinct
    // connection configuration, partioning pools for each separate configuration
    // for your adapter (i.e. worst case scenario is a pool for each model, best case
    // scenario is one single single pool.)  For many databases, any change to 
    // host OR database OR user OR password = separate pool.
    var _dbPools = {};

    var adapter = {
        identity: 'sails-dynamodb',
        keyId: "id",
        indexPrefix: "-Index",

        // Set to true if this adapter supports (or requires) things like data types, validations, keys, etc.
        // If true, the schema for models using this adapter will be automatically synced when the server starts.
        // Not terribly relevant if your data store is not SQL/schemaful.
        syncable: true,


        // Default configuration for collections
        // (same effect as if these properties were included at the top level of the model definitions)
        defaults: {
            configFile: '../../sails-dynamodb-config.json',
            config: null,
            credentialsFilePath: './credentials.json',
            // For example:
            // port: 3306,
            // host: 'localhost',
            // schema: true,
            // ssl: false,
            // customThings: ['eh']

            // If setting syncable, you should consider the migrate option, 
            // which allows you to set how the sync will be performed.
            // It can be overridden globally in an app (config/adapters.js)
            // and on a per-model basis.
            // 
            // IMPORTANT:
            // `migrate` is not a production data migration solution!
            // In production, always use `migrate: safe`
            //
            // drop   => Drop schema and data, then recreate it
            // alter  => Drop/add columns as necessary.
            // safe   => Don't change anything (good for production DBs)
            migrate: 'safe'
            //      , schema: false
        },



        _getModel: function (collectionName) {

            var collection = _modelReferences[collectionName];
            //console.log("currenct collection.definition", collection.definition);
            //console.log(collection);

            /*
            currenct collection
            { 
            keyId: 'id',
            indexPrefix: '-Index',
            syncable: true,
            defaults: 
            { accessKeyId: null,
            secretAccessKey: null,
            region: 'us-west-1',
            credentialsFilePath: './credentials.json',
            migrate: 'alter',
            adapter: 'sails-dynamodb' },
            _getModel: [Function],
            _getPrimaryKeys: [Function],
            registerCollection: [Function],
            teardown: [Function],
            define: [Function],
            describe: [Function],
            drop: [Function],
            find: [Function],
            _searchCondition: [Function],
            create: [Function],
            update: [Function],
            destroy: [Function],
            _setColumnType: [Function],
            _resultFormat: [Function],
            config: 
            { accessKeyId: null,
            secretAccessKey: null,
            region: 'us-west-1',
            credentialsFilePath: './credentials.json',
            migrate: 'alter',
            adapter: 'sails-dynamodb' },
            definition: 
            { user_id: { primaryKey: true, unique: true },
            name: { type: 'string', index: true },
            password: { type: 'string', index: true },
            email: { type: 'string', index: true },
            activated: { type: 'boolean', defaultsTo: false },
            activationToken: { type: 'string' },
            isSocial: { type: 'boolean' },
            socialActivated: { type: 'boolean' },
            createdAt: { type: 'datetime', default: 'NOW' },
            updatedAt: { type: 'datetime', default: 'NOW' } },
            identity: 'user' }
            */
            if(_definedTables[collectionName] !== undefined){
                return _definedTables[collectionName];
            }

            var tableName = adapter.defaults.config + collectionName;
            var primaryKeys = require("lodash").where(collection.definition, { primaryKey: true });
            //console.log("primaryKeys", primaryKeys);

            return Vogels.define(tableName, function (schema) {
                //console.log("_getModel", collectionName);
                var columns = collection.definition;
                var primaryKeys = []
                var indexes = [];
                // set columns
                for(var columnName in columns){
                    var attributes = columns[columnName];

                    //                console.log(columnName+":", attributes);
                    if(typeof attributes !== "function"){
                        adapter._setColumnType(schema, columnName, attributes);
                        // search primarykey
                        //                    if("primaryKey" in attributes)primaryKeys.push( columnName );
                        // search index
                        if("index" in attributes) indexes.push(columnName);
                    }
                }
                // set primary key
                var primaryKeys = adapter._getPrimaryKeys(collectionName);
                var primaryKeys = require("lodash").difference(primaryKeys, ["id"]); // ignore "id"
                //            console.log("collection.definition", collection.definition);
                if(primaryKeys.length < 1){
                    schema.UUID( adapter.keyId, {hashKey: true});
                } else{
                    if (!require("lodash").isUndefined(primaryKeys[0])) {
                        adapter._setColumnType(schema, primaryKeys[0], columns[primaryKeys[0]], {hashKey: true});
                        if (!require("lodash").isUndefined(primaryKeys[1])) {
                            adapter._setColumnType(schema, primaryKeys[1], columns[primaryKeys[1]], {rangeKey: true});
                        }
                    }
                }
                //                  schema.String( primaryKey, {hashKey: true});
                for(var i = 0; i < indexes.length; i++){
                    var key = indexes[i];
                    schema.globalIndex(key + adapter.indexPrefix, { hashKey: key});
                }

                schema.Date('createdAt', {default: Date.now});
                schema.Date('updatedAt', {default: Date.now});
            });
        },

        _getPrimaryKeys: function (collectionName) {
            var lodash = require("lodash");
            var collection = _modelReferences[collectionName];

            var maps = lodash.mapValues(collection.definition, "primaryKey");
            //            console.log(results);
            var list = lodash.pick(maps, function (value, key) {
                return typeof value !== "undefined";
            });
            var primaryKeys = lodash.keys(list);
            return primaryKeys;
        },

        /**
        * 
        * This method runs when a model is initially registered
        * at server-start-time.  This is the only required method.
        * 
        * @param  string   collection [description]
        * @param  {Function} cb         [description]
        * @return {[type]}              [description]
        */
        registerConnection: function (connection, collections, cb) {
            //var sails = require("sails");
            //console.log("load registerConnection");
            //console.log("::connection",connection);
            //console.log("::collections",collections);
            if(!connection.identity) return cb(Errors.IdentityMissing);
            if(connections[connection.identity]) return cb(Errors.IdentityDuplicate);

            adapter.defaults.config = require(adapter.defaults.configFile);
            var config = adapter.defaults.config;
            var credentialsPath = adapter.defaults.credentialsFilePath;
            var ddb_maxSockets = config.ddb_maxSockets;
            var ddb_apiVersion = config.ddb_apiVersion;
            var error = null;
            try{
                AWS.config.loadFromPath(credentialsPath);
                var ddbAgent = new https.Agent({maxSockets: ddb_maxSockets});
                adapter.ddb = new AWS.DynamoDB({apiVersion: ddb_apiVersion, httpOptions: {agent: ddbAgent}});
                Vogels.dynamoDriver(adapter.ddb);
            } catch (e) {
                e.message = e.message + ". Please create credentials.json on your sails project root and restart node";
                error = e;
            }
            // Keep a reference to this collection
            _modelReferences = collections;
            cb(error);
        }

        /**
        * Fired when a model is unregistered, typically when the server
        * is killed. Useful for tearing-down remaining open connections,
        * etc.
        * 
        * @param  {Function} cb [description]
        * @return {[type]}      [description]
        */
        , teardown: function(connection, cb) {
            cb();
        },



        /**
        * 
        * REQUIRED method if integrating with a schemaful
        * (SQL-ish) database.
        * 
        * @param  {[type]}   collectionName [description]
        * @param  {[type]}   definition     [description]
        * @param  {Function} cb             [description]
        * @return {[type]}                  [description]
        */
        define: function(connection, collectionName, definition, cb) {
            //console.info("adaptor::define");
            //console.info("::collectionName", collectionName);
            //console.info("::definition", definition);
            //console.info("::model", adapter._getModel(collectionName));

            // If you need to access your private data for this collection:
            var collection = _modelReferences[collectionName];

            if(! _definedTables[collectionName] ){
                var table = adapter._getModel(collectionName);
                var tableName = table.tableName();

                _definedTables[collectionName] = table;
                Vogels.createTables({
                    tableName: {readCapacity: 1, writeCapacity: 1}
                    // collectionName: {readCapacity: 1, writeCapacity: 1}
                }, function (err) {
                    if(err) {
                        console.warn('Error creating tables', err);
                        cb(err);
                    } else {
                        //                    console.log('table are now created and active');
                        cb();
                    }
                });
            }
            else{
                cb();
            }

            // Define a new "table" or "collection" schema in the data store
        },

        /**
        *
        * REQUIRED method if integrating with a schemaful
        * (SQL-ish) database.
        * 
        * @param  {[type]}   collectionName [description]
        * @param  {Function} cb             [description]
        * @return {[type]}                  [description]
        */
        describe: function(connection, collectionName, cb) {
            //console.info("adaptor::describe");
            //console.log("::connection",connection);
            //console.log("::collection",collectionName);

            // If you need to access your private data for this collection:
            var collection = _modelReferences[collectionName];
            //console.log("::collection.definition",collection.definition);

            // Respond with the schema (attributes) for a collection or table in the data store
            var attributes = {};

            // get model
            var model = adapter._getModel(collectionName);
            model.describeTable(function(err, res){
                if (err) {
                    if('code' in err && err['code'] === 'ResourceNotFoundException'){
                        console.error(JSON.stringify(err));
                        cb(err);
                    } else {
                        console.warn('Error describe tables'+__filename, err);
                        cb(err);
                    }
                } else {
                    console.log("success", adapter._resultFormat(res));
                    adapter._valueDecode(collection.definition,res.attrs);
                    cb(null, adapter._resultFormat(res));
                }
            });
        },


        /**
        *
        *
        * REQUIRED method if integrating with a schemaful
        * (SQL-ish) database.
        * 
        * @param  {[type]}   collectionName [description]
        * @param  {[type]}   relations      [description]
        * @param  {Function} cb             [description]
        * @return {[type]}                  [description]
        */
        drop: function(connection, collectionName, relations, cb) {
            //console.info("adaptor::drop", collectionName);
            // If you need to access your private data for this collection:
            var collection = _modelReferences[collectionName];
            //console.warn('drop: not supported')
            // Drop a "table" or "collection" schema from the data store
            cb();
        },




        // OVERRIDES NOT CURRENTLY FULLY SUPPORTED FOR:
        // 
        // alter: function (collectionName, changes, cb) {},
        // addAttribute: function(collectionName, attrName, attrDef, cb) {},
        // removeAttribute: function(collectionName, attrName, attrDef, cb) {},
        // alterAttribute: function(collectionName, attrName, attrDef, cb) {},
        // addIndex: function(indexName, options, cb) {},
        // removeIndex: function(indexName, options, cb) {},



        /**
        * 
        * REQUIRED method if users expect to call Model.find(), Model.findOne(),
        * or related.
        * 
        * You should implement this method to respond with an array of instances.
        * Waterline core will take care of supporting all the other different
        * find methods/usages.
        * 
        * @param  {[type]}   collectionName [description]
        * @param  {[type]}   options        [description]
        * @param  {Function} cb             [description]
        * @return {[type]}                  [description]
        */
        find: function(connection, collectionName, options, cb) {
            //console.info("adaptor::find", collectionName);
            //console.info("::option", options);

            var collection = _modelReferences[collectionName];
            // Options object is normalized for you:
            //
            // options.where
            // options.limit
            // options.skip
            // options.

            // Filter, paginate, and sort records from the datastore.
            // You should end up w/ an array of objects as a result.
            // If no matches were found, this will be an empty array.

            if ('limit' in options && options.limit < 2 ){
                // query mode
                // get primarykeys
                var primaryKeys = adapter._getPrimaryKeys(collectionName);
                // get current condition
                var wheres = require("lodash").keys(options.where);
                // compare both of keys
                var primaryQuery = require("lodash").intersection(primaryKeys, wheres);
                // get model
                var model = adapter._getModel(collectionName);
                if (primaryQuery.length < 1) {  // secondary key search
                    var hashKey = wheres[0];
                    var query = model.query(options.where[hashKey]).usingIndex(wheres[0] + adapter.indexPrefix)
                } else {  // primary key search
                    var hashKey = primaryKeys[0];
                    var query = model.query(options.where[hashKey]);
                }
            } else {
                // scan mode
                var query = adapter._getModel(collectionName).scan();
                // If you need to access your private data for this collection:

                if ('where' in options && !options.where){
                    for(var key in options['where']){
                        query = query.where(key).contains(options['where'][key]);
                    }
                    query = adapter._searchCondition(query, options);
                } else {
                    query = adapter._searchCondition(query, options);
                }
            }

            query.exec( function(err, res){
                if(!err){
                    console.log("success", adapter._resultFormat(res));
                    adapter._valueDecode(collection.definition,res.attrs);
                    cb(null, adapter._resultFormat(res));
                } else {
                    console.warn('Error exec query:'+__filename, err);
                    cb(err);
                }
            });

            // Respond with an error, or the results.
            //      cb(null, []);
        },
        /**
        * search condition
        * @param query
        * @param options
        * @returns {*}
        * @private
        */
        _searchCondition: function(query, options){
            if ('limit' in options){
            //            query = query.limit(1);
            }

            if ('skip' in options){
            }

            if ('sort' in options){
            }

            return query
        },


        /**
        *
        * REQUIRED method if users expect to call Model.create() or any methods
        *
        * @param  {[type]}   collectionName [description]
        * @param  {[type]}   values         [description]
        * @param  {Function} cb             [description]
        * @return {[type]}                  [description]
        */
        create: function(connection, collectionName, values, cb) {
            //console.info("adaptor::create", collectionName);
            //console.info("values", values);
            //console.log("collection", _modelReferences[collectionName]);

            var Model = adapter._getModel(collectionName);

            // If you need to access your private data for this collection:
            var collection = _modelReferences[collectionName];
            adapter._valueEncode(collection.definition,values);

            // Create a single new model (specified by `values`)
            var current = Model.create(values, function(err, res){
                if(err) {
                    console.warn(__filename+", create error:", err);
                    cb(err);
                } else {
                    adapter._valueDecode(collection.definition,res.attrs);
                    //                console.log('add model data',res.attrs);
                    // Respond with error or the newly-created record.
                    cb(null, res.attrs);
                }
            });
        },



        //

        /**
        *
        *
        * REQUIRED method if users expect to call Model.update()
        *
        * @param  {[type]}   collectionName [description]
        * @param  {[type]}   options        [description]
        * @param  {[type]}   values         [description]
        * @param  {Function} cb             [description]
        * @return {[type]}                  [description]
        */
        update: function(connection, collectionName, options, values, cb) {
            //console.info("adaptor::update", collectionName);
            //console.info("::options", options);
            //console.info("::values", values);
            var Model = adapter._getModel(collectionName);

            // If you need to access your private data for this collection:
            var collection = _modelReferences[collectionName];
            adapter._valueEncode(collection.definition,values);

            // id filter (bug?)
            if (adapter.keyId in values && typeof values[adapter.keyId] === 'number'){
                if ('where' in options && adapter.keyId in options.where){
                    values[adapter.keyId] = options.where[adapter.keyId];
                }
            }

            // 1. Filter, paginate, and sort records from the datastore.
            //    You should end up w/ an array of objects as a result.
            //    If no matches were found, this will be an empty array.
            //    
            // 2. Update all result records with `values`.
            // 
            // (do both in a single query if you can-- it's faster)
            var updateValues = require("lodash").assign(options.where, values);
            //console.log(updateValues);
            var current = Model.update(updateValues, function (err, res) {
                if(err) {
                    console.warn('Error update data'+__filename, err);
                    cb(err);
                } else {
                    //                console.log('add model data',res.attrs);
                    adapter._valueDecode(collection.definition,res.attrs);
                    // Respond with error or the newly-created record.
                    cb(null, [res.attrs]);
                }
            });

            // Respond with error or an array of updated records.
            //      cb(null, []);
        },

        /**
        *
        * REQUIRED method if users expect to call Model.destroy()
        * 
        * @param  {[type]}   collectionName [description]
        * @param  {[type]}   options        [description]
        * @param  {Function} cb             [description]
        * @return {[type]}                  [description]
        */
        destroy: function(connection, collectionName, options, cb) {
            //console.info("adaptor::destory", collectionName);
            //console.info("options", options);
            var Model = adapter._getModel(collectionName);

            // If you need to access your private data for this collection:
            var collection = _modelReferences[collectionName];


            // 1. Filter, paginate, and sort records from the datastore.
            //    You should end up w/ an array of objects as a result.
            //    If no matches were found, this will be an empty array.
            //    
            // 2. Destroy all result records.
            // 
            // (do both in a single query if you can-- it's faster)

            // Return an error, otherwise it's declared a success.
            if ('where' in options){
                var values = options.where;
                var current = Model.destroy(values, function(err, res){
                    if(err) {
                        console.warn('Error destory data'+__filename, err);
                        cb(err);
                    } else {
                        //                    console.log('add model data',res.attrs);
                        // Respond with error or the newly-created record.
                        cb();
                    }
                });
            } else {
                cb();
            }
        }



        /*
        **********************************************
        * Optional overrides
        **********************************************

        // Optional override of built-in batch create logic for increased efficiency
        // (since most databases include optimizations for pooled queries, at least intra-connection)
        // otherwise, Waterline core uses create()
        createEach: function (collectionName, arrayOfObjects, cb) { cb(); },

        // Optional override of built-in findOrCreate logic for increased efficiency
        // (since most databases include optimizations for pooled queries, at least intra-connection)
        // otherwise, uses find() and create()
        findOrCreate: function (collectionName, arrayOfAttributeNamesWeCareAbout, newAttributesObj, cb) { cb(); },
        */


        /*
        **********************************************
        * Custom methods
        **********************************************

        ////////////////////////////////////////////////////////////////////////////////////////////////////
        //
        // > NOTE:  There are a few gotchas here you should be aware of.
        //
        //    + The collectionName argument is always prepended as the first argument.
        //      This is so you can know which model is requesting the adapter.
        //
        //    + All adapter functions are asynchronous, even the completely custom ones,
        //      and they must always include a callback as the final argument.
        //      The first argument of callbacks is always an error object.
        //      For core CRUD methods, Waterline will add support for .done()/promise usage.
        //
        //    + The function signature for all CUSTOM adapter methods below must be:
        //      `function (collectionName, options, cb) { ... }`
        //
        ////////////////////////////////////////////////////////////////////////////////////////////////////


        // Custom methods defined here will be available on all models
        // which are hooked up to this adapter:
        //
        // e.g.:
        //
        foo: function (collectionName, options, cb) {
        return cb(null,"ok");
        },
        bar: function (collectionName, options, cb) {
        if (!options.jello) return cb("Failure!");
        else return cb();
        }

        // So if you have three models:
        // Tiger, Sparrow, and User
        // 2 of which (Tiger and Sparrow) implement this custom adapter,
        // then you'll be able to access:
        //
        // Tiger.foo(...)
        // Tiger.bar(...)
        // Sparrow.foo(...)
        // Sparrow.bar(...)


        // Example success usage:
        //
        // (notice how the first argument goes away:)
        Tiger.foo({}, function (err, result) {
        if (err) return console.error(err);
        else console.log(result);

        // outputs: ok
        });

        // Example error usage:
        //
        // (notice how the first argument goes away:)
        Sparrow.bar({test: 'yes'}, function (err, result){
        if (err) console.error(err);
        else console.log(result);

        // outputs: Failure!
        })




        */

        /**
        * set column attributes
        * @param schema  vogels::define return value
        * @param name    column name
        * @param attr    columns detail
        * @private
        */
        , _setColumnType: function(schema, name, attr, options){
            options = (typeof options !== 'undefined') ? options : {};

            // set columns
            //          console.log("name:", name);
            //          console.log("attr:", attr);
            var type = (require("lodash").isString(attr)) ? attr : attr.type;

            switch (type){
                case "date":
                case "time":
                case "datetime":
                    //                  console.log("Set Date:", name);
                    schema.Date(name, options);
                    break;

                case "integer":
                case "float":
                    //                  console.log("Set Number:", name);
                    schema.Number(name, options);
                    break;

                case "boolean":
                    //                  console.log("Set Boolean:", name);
                    schema.Boolean(name, options);
                    break;

                case "array":  // not support
                    schema.StringSet(name, options);
                    break;

                //              case "json":
                //              case "string":
                //              case "binary":
                default:
                    //                  console.log("Set String", name);
                    schema.String(name, options);
                    break;
            }
        },

        /**
        * From Object to Array
        * @param results response data
        * @returns {Array} replaced array
        * @private
        */
        _resultFormat: function(results){
            var items = [];

            for(var i in results.Items){
                items.push(results.Items[i].attrs);
            }

            return items;
        },


        /*
        collection.definition;
        { user_id: { primaryKey: true, unique: true, type: 'string' },
        range: { primaryKey: true, unique: true, type: 'integer' },
        title: { type: 'string' },
        chart1: { type: 'json' },
        chart2: { type: 'json' },
        chart3: { type: 'json' },
        createdAt: { type: 'datetime' },
        updatedAt: { type: 'datetime' } },
        */
        /**
        * convert values
        * @param definition
        * @param values
        * @private
        */
        _valueEncode: function(definition, values){
            adapter._valueConvert(definition, values, true);
        },
        _valueDecode: function(definition, values){
            adapter._valueConvert(definition, values, false);
        },
        _valueConvert: function(definition, values, encode){
            for(var key in definition){
                var type = definition[key].type;

                if(require("lodash").has(values, key)){
                    switch(type){
                        case "json":
                            if(!encode) values[key] = JSON.parse(values[key]);
                            else values[key] = JSON.stringify(values[key]);
                            break;
                        default :
                            break;
                    }
                }
            }
        }
    };


    // Expose adapter definition
    return adapter;

})();

