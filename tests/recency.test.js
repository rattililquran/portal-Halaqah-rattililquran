// Kunci logika sinyal recency SPP (_sppRecency, Fase 4) — ambang 60 hari,
// "belum pernah setor" untuk null, "" untuk tanggal invalid. Ekstrak fungsi
// asli dari admin/spp-keuangan-module.js dgn shim esc (identity).
'use strict';
var path = require('path');
var H = require('./_harness');
var eq = H.eq, ok = H.ok, describe = H.describe, it = H.it;

var FILE = path.join(H.ROOT, 'admin', 'spp-keuangan-module.js');
var _sppRecency = H.extractFn(FILE, '_sppRecency', { esc: function (x) { return String(x == null ? '' : x); } });

function daysAgo(n) {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

describe('SPP _sppRecency — sinyal terakhir bayar (Fase 4)', function () {
  it('null → "belum pernah setor" (amber)', function () {
    var h = _sppRecency(null);
    ok(/belum pernah setor/.test(h), h);
    ok(/amber/.test(h), 'harus amber');
  });

  it('tanggal invalid → string kosong', function () {
    eq(_sppRecency('bukan-tanggal'), '');
  });

  it('10 hari lalu → "terakhir setor" (netral, bukan peringatan)', function () {
    var h = _sppRecency(daysAgo(10));
    ok(/terakhir setor/.test(h), h);
    ok(!/⚠/.test(h), 'belum lewat ambang, tak boleh ada ⚠');
  });

  it('90 hari lalu → "⚠ belum setor ~N bln"', function () {
    var h = _sppRecency(daysAgo(90));
    ok(/⚠/.test(h), h);
    ok(/belum setor ~\d+ bln/.test(h), h);
  });

  it('ambang 60 hari: 59 hari netral, 60 hari peringatan', function () {
    ok(!/⚠/.test(_sppRecency(daysAgo(59))), '59 hari harus netral');
    ok(/⚠/.test(_sppRecency(daysAgo(60))), '60 hari harus peringatan');
  });
});
