// ============================================================
//  SoalCore — logika editor Bank Soal BERSAMA (portal admin + guru)
//  Satu sumber untuk: pemecah CSV sadar-kutip, parse+validasi CSV,
//  pengumpulan payload form manual, label tipe, & template CSV.
//  Tujuan: cegah bug editor soal berulang di dua portal (lihat
//  RENCANA_dedup-editor-soal-admin-guru.md). Behaviour-preserving —
//  logika identik dengan admin/guru-module.js & guru/quiz-module.js
//  pasca-commit 57fc251.
//
//  KONTRAK BENTUK (dikunci di sini, jangan diulang di pemanggil):
//   - kunci_isian = array STRING (backend createSoal map String(k).trim()).
//   - pemisah kunci isian = /[|,]/ (terima ',' & '|').
//   - pemisah pilihan/pasangan = '|'; '*' menandai kunci benar; 'Kiri:Kanan'.
//   - parseCSV memakai splitRow (sadar-kutip), BUKAN split(';') mentah.
// ============================================================
(function () {
  "use strict";
  if (window.SoalCore) return;

  var CSV_HEADER = 'tipe_soal;teks_soal;teks_arab;audio_url;pilihan;pasangan;kunci_isian;levels;rekomendasi_pertemuan_ke;durasi_detik_default;bobot_poin_default';
  var CSV_SAMPLE = [
    'pilihan_ganda;Huruf manakah yang keluar dari Wasatul Halq?;Wakqul Halq;;ع*|غ|ء|ق;;;Level 1,Level 2;23;15;10',
    'benar_salah;Huruf Ghain dan Kha keluar dari ujung tenggorokan (Adnal Halq).;;;Benar*|Salah;;;Level 1;23;30;10',
    'isian_singkat;Berapakah total huruf hijaiyah makhraj Al-Halq?;;;;;6|enam;Level 1;23;20;15',
    'matching;Jodohkan bagian Al-Halq dengan hurufnya;;;;Aqshal:Hamzah|Wasatul:Ain|Adnal:Ghain;Level 1,Tahsin Al-Fatihah;;;10'
  ];
  var TIPE_VALID = ['pilihan_ganda', 'benar_salah', 'matching', 'audio', 'teks_arab', 'isian_singkat'];
  var EXPECTED = ['tipe_soal', 'teks_soal', 'teks_arab', 'audio_url', 'pilihan', 'pasangan', 'kunci_isian', 'levels', 'rekomendasi_pertemuan_ke'];

  function tipeLabel(tipe) {
    switch (tipe) {
      case 'pilihan_ganda': return 'Pilihan Ganda';
      case 'benar_salah': return 'Benar / Salah';
      case 'matching': return 'Menjodohkan';
      case 'audio': return 'Audio / Suara';
      case 'teks_arab': return 'Teks Arab';
      case 'isian_singkat': return 'Isian Singkat';
      default: return 'Soal';
    }
  }

  // Pemecah CSV sadar-kutip (delimiter ';'): '""' di dalam kutip -> '"' literal,
  // ';' di dalam kutip tak menggeser kolom. Tiap sel di-trim (perilaku lama).
  function splitRow(rowStr) {
    rowStr = String(rowStr == null ? '' : rowStr);
    var out = [], cur = '', inQ = false;
    for (var i = 0; i < rowStr.length; i++) {
      var c = rowStr[i];
      if (c === '"') {
        if (inQ && rowStr[i + 1] === '"') { cur += '"'; i++; }
        else { inQ = !inQ; }
      } else if (c === ';' && !inQ) { out.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    out.push(cur.trim());
    return out;
  }

  function csvTemplate() { return CSV_HEADER + '\n' + CSV_SAMPLE.join('\n'); }

  function downloadTemplate(filename) {
    var blob = new Blob([csvTemplate()], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename || 'template_import_soal_rattil.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Parse + validasi teks CSV -> { items, validCount, headerError, empty }.
  // MURNI (tanpa DOM). item.error != '' menandai baris invalid; pemanggil yang
  // merender preview & memuat item valid ke backend.
  function parseCSV(text) {
    var lines = String(text == null ? '' : text).split(/\r?\n/)
      .map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length < 2) return { items: [], validCount: 0, headerError: false, empty: true };

    var header = splitRow(lines[0].toLowerCase());
    if (!EXPECTED.every(function (col) { return header.indexOf(col) !== -1; })) {
      return { items: [], validCount: 0, headerError: true, empty: false };
    }
    var colIndex = {};
    header.forEach(function (name, idx) { colIndex[name] = idx; });

    var items = [], validCount = 0;
    for (var i = 1; i < lines.length; i++) {
      var row = splitRow(lines[i]);
      if (row.length < EXPECTED.length) continue;
      var getValue = function (colName) { return (row[colIndex[colName]] || '').trim(); };

      var tipe = getValue('tipe_soal').toLowerCase();
      var teks_soal = getValue('teks_soal');
      var pilihanRaw = getValue('pilihan');
      var pasanganRaw = getValue('pasangan');
      var kunciRaw = getValue('kunci_isian');
      var levelsRaw = getValue('levels');
      var rekRaw = getValue('rekomendasi_pertemuan_ke');
      var durRaw = header.indexOf('durasi_detik_default') !== -1 ? getValue('durasi_detik_default') : '';
      var poinRaw = header.indexOf('bobot_poin_default') !== -1 ? getValue('bobot_poin_default') : '';

      var item = {
        tipe_soal: tipe,
        teks_soal: teks_soal,
        teks_arab: getValue('teks_arab') || null,
        audio_url: getValue('audio_url') || null,
        pilihan: [], pasangan: [], kunci_isian: [], levels: [],
        rekomendasi_pertemuan_ke: null, durasi_detik_default: null,
        bobot_poin_default: 10, error: ''
      };

      if (!tipe) item.error = 'Tipe soal kosong';
      else if (TIPE_VALID.indexOf(tipe) === -1) item.error = "Tipe '" + tipe + "' tidak valid";

      if (!teks_soal && !item.error) item.error = 'Teks soal wajib diisi';

      if (['pilihan_ganda', 'benar_salah', 'audio', 'teks_arab'].indexOf(tipe) !== -1 && !item.error) {
        if (!pilihanRaw) item.error = 'Kolom pilihan wajib diisi untuk tipe ini';
        else {
          var pils = pilihanRaw.split('|').map(function (p) { return p.trim(); }).filter(Boolean);
          if (pils.length < 2) item.error = 'Minimal harus ada 2 pilihan jawaban';
          else {
            var correctCount = 0;
            pils.forEach(function (p, idx) {
              var isCorrect = p.endsWith('*');
              var cleanText = isCorrect ? p.slice(0, -1).trim() : p;
              if (isCorrect) correctCount++;
              item.pilihan.push({ teks_pilihan: cleanText, is_benar: isCorrect, urutan: idx + 1 });
            });
            if (correctCount === 0) item.error = 'Tidak ada pilihan jawaban benar (akhiri dengan *)';
            else if (correctCount > 1) item.error = 'Ada lebih dari 1 pilihan jawaban benar';
          }
        }
      }

      if (tipe === 'matching' && !item.error) {
        if (!pasanganRaw) item.error = 'Kolom pasangan wajib diisi untuk tipe matching';
        else {
          var pairs = pasanganRaw.split('|').map(function (p) { return p.trim(); }).filter(Boolean);
          if (pairs.length < 2) item.error = 'Minimal harus ada 2 pasangan menjodohkan';
          else pairs.forEach(function (p, idx) {
            var parts = p.split(':');
            if (parts.length !== 2) item.error = 'Format pasangan salah (Gunakan Kiri:Kanan)';
            else item.pasangan.push({ teks_kiri: parts[0].trim(), teks_kanan: parts[1].trim(), urutan: idx + 1 });
          });
        }
      }

      if (tipe === 'isian_singkat' && !item.error) {
        if (!kunciRaw) item.error = 'Kunci isian wajib diisi untuk isian singkat';
        else {
          var kuncis = kunciRaw.split(/[|,]/).map(function (k) { return k.trim(); }).filter(Boolean);
          if (kuncis.length === 0) item.error = 'Kunci isian kosong';
          // string mentah (bukan {teks_kunci}) — backend map String(k).trim().
          else kuncis.forEach(function (k) { item.kunci_isian.push(k); });
        }
      }

      if (levelsRaw) item.levels = levelsRaw.split(',').map(function (l) { return l.trim(); }).filter(Boolean);
      if (rekRaw) { var nr = parseInt(rekRaw); if (!isNaN(nr) && nr > 0) item.rekomendasi_pertemuan_ke = nr; }
      if (durRaw) { var nd = parseInt(durRaw); if (!isNaN(nd) && nd >= 0) item.durasi_detik_default = nd; }
      if (poinRaw) { var np = parseInt(poinRaw); if (!isNaN(np) && np >= 0) item.bobot_poin_default = np; }

      if (!item.error) validCount++;
      items.push(item);
    }
    return { items: items, validCount: validCount, headerError: false, empty: false };
  }

  // Kumpulkan payload dari form editor manual (DOM id cs* — identik di kedua
  // portal). Return null (setelah alert) bila level belum dipilih.
  function collectFormPayload() {
    var tipe = document.getElementById('csTipe').value;
    var teksSoal = document.getElementById('csTeksSoal').value.trim();
    var selectedLevels = Array.prototype.slice.call(document.querySelectorAll('.csLevelCheck:checked'))
      .map(function (cb) { return cb.value; });
    if (selectedLevels.length === 0) { alert('Pilih minimal satu level halaqah!'); return null; }

    var rekomendasiPertemuan = document.getElementById('csRekomendasiPertemuan').value;
    var durasiDefault = document.getElementById('csDurasiDefault').value;
    var poinDefault = document.getElementById('csPoinDefault').value;

    var payload = {
      tipe_soal: tipe,
      teks_soal: teksSoal,
      teks_arab: document.getElementById('csTeksArab') ? document.getElementById('csTeksArab').value.trim() : null,
      audio_url: document.getElementById('csAudioUrl') ? document.getElementById('csAudioUrl').value.trim() : null,
      levels: selectedLevels,
      rekomendasi_pertemuan_ke: rekomendasiPertemuan || null,
      durasi_detik_default: durasiDefault !== '' ? parseInt(durasiDefault) : null,
      bobot_poin_default: poinDefault !== '' ? parseInt(poinDefault) : 10,
      boleh_maze: document.getElementById('csBolehMaze') ? document.getElementById('csBolehMaze').checked : false,
      boleh_run: document.getElementById('csBolehRun') ? document.getElementById('csBolehRun').checked : false,
      pilihan: [], pasangan: [], kunci_isian: []
    };

    if (tipe === 'pilihan_ganda' || tipe === 'audio' || tipe === 'teks_arab') {
      var pilInputs = Array.prototype.slice.call(document.querySelectorAll('.csPil'));
      var selectedBenarIdx = parseInt(document.querySelector('input[name="csBenar"]:checked').value);
      payload.pilihan = pilInputs.map(function (inp, idx) {
        if (!inp.value.trim()) return null;
        return { teks_pilihan: inp.value.trim(), is_benar: idx === selectedBenarIdx };
      }).filter(Boolean);
    } else if (tipe === 'benar_salah') {
      var isBenarSelected = document.querySelector('input[name="csBsBenar"]:checked').value === 'benar';
      payload.pilihan = [
        { teks_pilihan: 'Benar', is_benar: isBenarSelected },
        { teks_pilihan: 'Salah', is_benar: !isBenarSelected }
      ];
    } else if (tipe === 'matching') {
      var kiriInputs = Array.prototype.slice.call(document.querySelectorAll('.csMatchKiri'));
      var kananInputs = Array.prototype.slice.call(document.querySelectorAll('.csMatchKanan'));
      payload.pasangan = kiriInputs.map(function (kInp, idx) {
        var kiriText = kInp.value.trim();
        var kananText = kananInputs[idx] ? kananInputs[idx].value.trim() : '';
        if (!kiriText || !kananText) return null;
        return { teks_kiri: kiriText, teks_kanan: kananText };
      }).filter(Boolean);
    } else if (tipe === 'isian_singkat') {
      var rawKunci = document.getElementById('csIsianKunci').value;
      payload.kunci_isian = rawKunci.split(/[|,]/).map(function (k) { return k.trim(); }).filter(Boolean);
    }
    return payload;
  }

  window.SoalCore = {
    CSV_HEADER: CSV_HEADER,
    TIPE_VALID: TIPE_VALID,
    tipeLabel: tipeLabel,
    splitRow: splitRow,
    csvTemplate: csvTemplate,
    downloadTemplate: downloadTemplate,
    parseCSV: parseCSV,
    collectFormPayload: collectFormPayload
  };
})();
