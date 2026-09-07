// Kunci rumus tunggakan SPP (model LEVEL 5-bulan, Interpretasi A) — INVARIAN
// KEUANGAN. _sppLevelInfo dipakai bersama api-staff (admin) & api-murid (murid);
// test ini mengekstrak fungsi ASLI dari supabase-core.js (tak bisa drift) lalu
// mengunci output-nya, DAN memverifikasi kedua portal benar-benar memakainya.
'use strict';
var fs = require('fs');
var path = require('path');
var H = require('./_harness');
var eq = H.eq, ok = H.ok, describe = H.describe, it = H.it;

var CORE = path.join(H.ROOT, 'supabase', 'supabase-core.js');
var _sppLevelInfo = H.extractFn(CORE, '_sppLevelInfo');

describe('SPP _sppLevelInfo — rumus tunggakan (keuangan)', function () {

  // count -> [level_selesai, level_berjalan, progress_level, tunggakan]
  var TABEL = {
    0:  [0, 1, 0, 5],
    1:  [0, 1, 1, 4],
    4:  [0, 1, 4, 1],
    5:  [0, 1, 5, 0],   // 1 level tuntas tepat di batas → tunggakan 0
    6:  [1, 2, 1, 4],   // masuk level 2
    9:  [1, 2, 4, 1],
    10: [1, 2, 5, 0],   // 2 level tuntas
    11: [2, 3, 1, 4],
    12: [2, 3, 2, 3],   // contoh RENCANA: level 3, tunggakan 3
    24: [4, 5, 4, 1],
    25: [4, 5, 5, 0]
  };

  Object.keys(TABEL).forEach(function (k) {
    var c = Number(k), exp = TABEL[k];
    it('count=' + c + ' → selesai/berjalan/progress/tunggakan', function () {
      var r = _sppLevelInfo(c);
      eq([r.level_selesai, r.level_berjalan, r.progress_level, r.tunggakan], exp);
      eq(r.lunas_count, c, 'lunas_count');
    });
  });

  it('invarian: progress_level + tunggakan === 5', function () {
    for (var c = 0; c <= 60; c++) {
      var r = _sppLevelInfo(c);
      eq(r.progress_level + r.tunggakan, 5, 'count=' + c);
    }
  });

  it('invarian: tunggakan 0..5 & level_berjalan = level_selesai+1', function () {
    for (var c = 0; c <= 60; c++) {
      var r = _sppLevelInfo(c);
      ok(r.tunggakan >= 0 && r.tunggakan <= 5, 'tunggakan range count=' + c);
      eq(r.level_berjalan, r.level_selesai + 1, 'berjalan count=' + c);
    }
  });

  it('input kotor dinormalisasi (negatif/NaN/null/float/string)', function () {
    eq(_sppLevelInfo(-3).lunas_count, 0);
    eq(_sppLevelInfo(NaN).lunas_count, 0);
    eq(_sppLevelInfo(null).lunas_count, 0);
    eq(_sppLevelInfo(undefined).lunas_count, 0);
    eq(_sppLevelInfo(3.9).lunas_count, 3);   // floor
    eq(_sppLevelInfo('7').tunggakan, _sppLevelInfo(7).tunggakan); // string angka
  });

  it('paritas admin↔murid: KEDUA portal memakai _sppLevelInfo', function () {
    var staff = fs.readFileSync(path.join(H.ROOT, 'supabase', 'api-staff.js'), 'utf8');
    var murid = fs.readFileSync(path.join(H.ROOT, 'supabase', 'api-murid.js'), 'utf8');
    ok(/_sppLevelInfo\s*\(/.test(staff), 'api-staff.js harus memakai _sppLevelInfo');
    ok(/_sppLevelInfo\s*\(/.test(murid), 'api-murid.js harus memakai _sppLevelInfo');
  });
});
