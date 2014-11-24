# sails-dynamodb

A [Waterline](https://github.com/balderdashy/waterline) adapter for DynamoDB. May be used in a [Sails](https://github.com/balderdashy/sails) app or anything using Waterline for the ORM.


> _**Note:** This adapter support the Sails.js v0.10.x. check 0.9 branch if you use before v0.10

## Install

Install is through NPM.

```bash
$ sails new project && cd project
$ npm install git://github.com/dohzoh/sails-dynamodb.git
$ cp node_modules/sails-dynamodb/credentials.example.json ./credentials.json  # & put your amazon keys
```
Todo: to npm package


## Configuration

The following config options are available along with their default values:

config/connection.js
```javascript
module.exports.adapters = {

  // If you leave the adapter config unspecified 
  // in a model definition, 'default' will be used.
  localDiskDb: {
    adapter: 'sails-disk'
  },
  
  dynamoDb: {
    adapter: "sails-dynamodb"
  },
  
};
```

config/models.js
```javascript
module.exports.adapters = {

  // If you leave the adapter config unspecified 
  // in a model definition, 'default' will be used.
  connection: 'dynamoDb'
  
};
```

## Testing

Test are written with mocha. Integration tests are handled by the [waterline-adapter-tests](https://github.com/balderdashy/waterline-adapter-tests) project, which tests adapter methods against the latest Waterline API.

To run tests:

```bash
$ npm test
```


## About Sails.js and Waterline
http://sailsjs.org

Waterline is a new kind of storage and retrieval engine for Sails.js.  It provides a uniform API for accessing stuff from different kinds of databases, protocols, and 3rd party APIs.  That means you write the same code to get users, whether they live in mySQL, LDAP, MongoDB, or Facebook.


![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png) 

## License

The MIT License (MIT)

Copyright (c) 2014 Ripplation Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
