// Kunci logika editor soal bersama (assets/soal-core.js) — mencegah kambuhnya
// G1 (kunci_isian jadi [object Object]), G2 (';' di dalam kutip menggeser kolom),
// G3 (pemisah kunci ',' vs '|'). Memuat berkas asli dgn window shim.
'use strict';
var path = require('path');
var H = require('./_harness');
var eq = H.eq, ok = H.ok, describe = H.describe, it = H.it;

var win = H.loadWindowModule(path.join(H.ROOT, 'assets', 'soal-core.js'));
var SC = win.SoalCore;

describe('SoalCore — kontrak & parse editor soal', function () {

  it('SoalCore ter-ekspor lengkap', function () {
    ['parseCSV', 'collectFormPayload', 'splitRow', 'csvTemplate', 'downloadTemplate', 'tipeLabel', 'CSV_HEADER'].forEach(function (k) {
      ok(typeof SC[k] !== 'undefined', 'SoalCore.' + k + ' ada');
    });
  });

  it('template CSV = 4 baris valid', function () {
    var r = SC.parseCSV(SC.csvTemplate());
    eq(r.items.length, 4);
    eq(r.validCount, 4);
    eq(r.headerError, false);
    eq(r.empty, false);
  });

  it('G1: kunci_isian = array STRING (bukan {teks_kunci}) → aman di backend', function () {
    var is = SC.parseCSV(SC.csvTemplate()).items[2];
    eq(is.tipe_soal, 'isian_singkat');
    eq(is.kunci_isian, ['6', 'enam']);
    // backend createSoal: String(k).trim() — harus tetap string bersih
    eq(is.kunci_isian.map(function (k) { return String(k).trim(); }), ['6', 'enam']);
  });

  it('pilihan_ganda: kunci benar dari akhiran *, urutan benar', function () {
    var pg = SC.parseCSV(SC.csvTemplate()).items[0];
    eq(pg.pilihan.length, 4);
    eq(pg.pilihan[0].teks_pilihan, 'ع');
    eq(pg.pilihan[0].is_benar, true);
    eq(pg.pilihan[1].is_benar, false);
    eq(pg.pilihan[0].urutan, 1);
  });

  it('matching: pasangan Kiri:Kanan', function () {
    var mt = SC.parseCSV(SC.csvTemplate()).items[3];
    eq(mt.pasangan.length, 3);
    eq([mt.pasangan[0].teks_kiri, mt.pasangan[0].teks_kanan], ['Aqshal', 'Hamzah']);
  });

  it('template isian: levels/rek/dur/poin sejajar (baris tak lagi malformed)', function () {
    var is = SC.parseCSV(SC.csvTemplate()).items[2];
    eq(is.levels, ['Level 1']);
    eq(is.rekomendasi_pertemuan_ke, 23);
    eq(is.durasi_detik_default, 20);
    eq(is.bobot_poin_default, 15);
  });

  it('G2: splitRow sadar-kutip — ";" di dalam kutip tak menggeser kolom', function () {
    eq(SC.splitRow('a;"b;c";d'), ['a', 'b;c', 'd']);
    var row = SC.parseCSV(SC.CSV_HEADER + '\n' + 'isian_singkat;"Hukum: a; b";;;;;alif;Level 1;;;').items[0];
    eq(row.error, '');
    eq(row.teks_soal, 'Hukum: a; b');
  });

  it('G2: splitRow unescape kutip ganda ("" → ")', function () {
    eq(SC.splitRow('"Tulis ""alif"""'), ['Tulis "alif"']);
  });

  it('G3: pemisah kunci terima "," maupun "|"', function () {
    var byPipe = SC.parseCSV(SC.CSV_HEADER + '\n' + 'isian_singkat;S;;;;;6|enam;Level 1;;;').items[0];
    var byComma = SC.parseCSV(SC.CSV_HEADER + '\n' + 'isian_singkat;S;;;;;"6,enam";Level 1;;;').items[0];
    eq(byPipe.kunci_isian, ['6', 'enam']);
    eq(byComma.kunci_isian, ['6', 'enam']);
  });

  it('validasi: pilihan tanpa * → error; >1 * → error', function () {
    var noKey = SC.parseCSV(SC.CSV_HEADER + '\n' + 'pilihan_ganda;S;;;a|b;;;Level 1;;;').items[0];
    ok(/Tidak ada pilihan jawaban benar/.test(noKey.error), noKey.error);
    var twoKey = SC.parseCSV(SC.CSV_HEADER + '\n' + 'pilihan_ganda;S;;;a*|b*;;;Level 1;;;').items[0];
    ok(/lebih dari 1/.test(twoKey.error), twoKey.error);
  });

  it('header salah → headerError; hanya header → empty', function () {
    eq(SC.parseCSV('a;b;c\n1;2;3').headerError, true);
    eq(SC.parseCSV('cuma-satu-baris').empty, true);
  });

  it('tipeLabel', function () {
    eq(SC.tipeLabel('isian_singkat'), 'Isian Singkat');
    eq(SC.tipeLabel('ngawur'), 'Soal');
  });
});
