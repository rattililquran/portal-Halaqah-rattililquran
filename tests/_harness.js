// ============================================================
//  Harness test ringan — NOL dependensi (cukup `node tests/run.js`).
//  Untuk mengunci logika INTI (murni) portal: rumus tunggakan SPP,
//  parser/validator editor soal, dll. Bukan test end-to-end.
//
//  Filosofi: test membaca SUMBER ASLI (mis. supabase-core.js) lalu
//  meng-eval fungsi murni yang diekstrak → tak pernah drift dari kode
//  produksi. Fungsi yang bergantung DOM/Supabase tidak dites di sini.
// ============================================================
'use strict';
var fs = require('fs');
var path = require('path');

var _suites = [];
var _cur = null;

function describe(name, fn) {
  _cur = { name: name, tests: [] };
  _suites.push(_cur);
  fn();
  _cur = null;
}

function it(name, fn) {
  if (!_cur) throw new Error('it() harus di dalam describe()');
  _cur.tests.push({ name: name, fn: fn });
}

function eq(actual, expected, msg) {
  var a = JSON.stringify(actual);
  var e = JSON.stringify(expected);
  if (a !== e) throw new Error((msg ? msg + ': ' : '') + 'expected ' + e + ' got ' + a);
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg || 'expected truthy, got ' + cond);
}

// Ekstrak satu deklarasi `function <name>(...) { ... }` dari teks sumber via
// pencocokan kurung kurawal, lalu kembalikan fungsinya (dievaluasi terisolasi
// dengan `scope` opsional untuk shim helper eksternal seperti esc/svgIcon).
// Cocok untuk fungsi MURNI yang tak menyentuh var modul lain.
function extractFn(absFile, fnName, scope) {
  var src = fs.readFileSync(absFile, 'utf8');
  var marker = 'function ' + fnName + '(';
  var start = src.indexOf(marker);
  if (start < 0) throw new Error('Fungsi tak ditemukan: ' + fnName + ' di ' + absFile);
  var braceStart = src.indexOf('{', start);
  var depth = 0, end = -1;
  for (var i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('Kurung tak seimbang untuk ' + fnName);
  var code = src.slice(start, end + 1);
  scope = scope || {};
  var names = Object.keys(scope);
  var vals = names.map(function (n) { return scope[n]; });
  // Function.apply → argumen ter-spread (new Function(arr) salah: array jadi body).
  var factory = Function.apply(null, names.concat([code + '\nreturn ' + fnName + ';']));
  return factory.apply(null, vals);
}

// Muat berkas IIFE yang mengekspor ke window (mis. assets/soal-core.js) dengan
// window shim, kembalikan window-nya.
function loadWindowModule(absFile, extraGlobals) {
  var win = {};
  var sandbox = Object.assign({ window: win }, extraGlobals || {});
  var names = Object.keys(sandbox);
  var vals = names.map(function (n) { return sandbox[n]; });
  var src = fs.readFileSync(absFile, 'utf8');
  Function.apply(null, names.concat([src])).apply(null, vals);
  return win;
}

function run() {
  var pass = 0, fail = 0, failures = [];
  _suites.forEach(function (s) {
    console.log('\n• ' + s.name);
    s.tests.forEach(function (t) {
      try {
        t.fn();
        pass++;
        console.log('  ✓ ' + t.name);
      } catch (e) {
        fail++;
        failures.push({ suite: s.name, name: t.name, err: e });
        console.log('  ✗ ' + t.name + '\n      ' + (e && e.message));
      }
    });
  });
  console.log('\n' + '='.repeat(48));
  console.log(pass + ' PASS, ' + fail + ' FAIL  (' + _suites.length + ' suite)');
  if (fail > 0) {
    console.log('❌ ADA KEGAGALAN');
    process.exit(1);
  } else {
    console.log('✅ SEMUA LOLOS');
  }
}

module.exports = {
  describe: describe, it: it, eq: eq, ok: ok,
  extractFn: extractFn, loadWindowModule: loadWindowModule, run: run,
  ROOT: path.resolve(__dirname, '..')
};
