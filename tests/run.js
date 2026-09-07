// Runner test — `node tests/run.js` (atau `npm test`).
// Menjalankan seluruh *.test.js di folder ini lalu exit(1) bila ada yg gagal.
'use strict';
var fs = require('fs');
var path = require('path');
var H = require('./_harness');

fs.readdirSync(__dirname)
  .filter(function (f) { return /\.test\.js$/.test(f); })
  .sort()
  .forEach(function (f) { require(path.join(__dirname, f)); });

H.run();
