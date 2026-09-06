// ============================================================
//  Portal Admin — Murid & Import Integrated Module
//  Modularized from admin/index.html
// ============================================================
(function() {
  "use strict";

  // --- Murid & Import 3 Tahap ---

// ══════════════════════════════════════════
//  PERIODE
// ══════════════════════════════════════════
async function loadPeriode() {
  showLoad('Bismillah, memuat data periode...');
  try {
    const [rp, rh] = await Promise.all([
      window.HQ.AdminAPI.getAllPeriode(),
      window.HQ.AdminAPI.getAllHalaqah(),   // utk hitung isi tiap periode (fresh)
    ]);
    allPeriode = rp.data || [];
    allHalaqah = rh.data || allHalaqah || [];
    renderPeriodeTable();
  } catch(e) { toast('Gagal: '+e.message,'err'); }
  finally { hideLoad(); }
}

function renderPeriodeTable() {
  const tbody = document.getElementById('periodeTbl');
  if (!tbody) return;
  const n = allPeriode.length;
  const _mv = (id, dir, disabled) => `<button class="btn btn-ghost btn-sm" style="padding:2px 5px" title="${dir<0?'Naik':'Turun'}" ${disabled?'disabled style="opacity:.3;padding:2px 5px"':''} onclick="movePeriode('${esc(id)}',${dir})"><svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="${dir<0?'18 15 12 9 6 15':'6 9 12 15 18 9'}"/></svg></button>`;
  // Hitung isi tiap periode dari allHalaqah (punya id_periode + total_murid aktif)
  const _statPer = {};
  (allHalaqah || []).forEach(h => {
    const k = h.id_periode; if (!k) return;
    if (!_statPer[k]) _statPer[k] = { hal: 0, murid: 0 };
    _statPer[k].hal += 1;
    _statPer[k].murid += (h.total_murid || 0);
  });
  tbody.innerHTML = allPeriode.map((p, i) => {
    const st = _statPer[p.id_periode] || { hal: 0, murid: 0 };
    const cHal = st.hal ? `<strong>${st.hal}</strong>` : '<span style="color:var(--text-3)">—</span>';
    const cMur = st.hal ? `<strong>${st.murid}</strong>` : '<span style="color:var(--text-3)">—</span>';
    return `<tr>
    <td style="white-space:nowrap"><span style="display:inline-flex;flex-direction:column;gap:1px">${_mv(p.id_periode,-1,i===0)}${_mv(p.id_periode,1,i===n-1)}</span></td>
    <td><strong>${esc(p.nama_periode)}</strong>${p.deskripsi?`<br><small style="color:var(--text-3)">${esc(p.deskripsi)}</small>`:''}</td>
    <td class="align-center">${cHal}</td>
    <td class="align-center">${cMur}</td>
    <td>${p.tanggal_mulai||'–'}</td>
    <td>${p.tanggal_selesai||'–'}</td>
    <td>${p.status==='aktif'?'<span class="badge b-green">Aktif</span>':'<span class="badge b-gray">Non-aktif</span>'}</td>
    <td style="display:flex;gap:6px">
      <button class="btn btn-ghost btn-sm" onclick="editPeriode('${esc(p.id_periode)}')">${svgIcon('edit',14)}</button>
      ${p.status!=='aktif'?`<button class="btn btn-green btn-sm" onclick="aktivasiPeriode('${esc(p.id_periode)}')">${svgIcon('play',14)} Aktifkan</button>`:''}
    </td>
  </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--text-3)">Belum ada periode</td></tr>';

  // Catatan: halaqah aktif yang belum ditandai ke periode mana pun
  const note = document.getElementById('periodeUntaggedNote');
  if (note) {
    const untag = (allHalaqah || []).filter(h => !h.id_periode && h.status === 'aktif');
    if (untag.length) {
      const uMur = untag.reduce((s, h) => s + (h.total_murid || 0), 0);
      note.textContent = '⚠ ' + untag.length + ' halaqah aktif (' + uMur + ' murid) belum ditandai ke periode mana pun — gunakan "Set Periode Massal" di halaman Halaqah.';
      note.style.display = '';
    } else { note.style.display = 'none'; }
  }
}

// Ubah urutan tampil periode (dipakai di SEMUA dropdown periode). Butuh kolom
// periode.urutan (patch_102) — kalau belum ada, updatePeriode akan error jelas.
async function movePeriode(id, dir) {
  const arr = allPeriode.slice();
  const idx = arr.findIndex(p => p.id_periode === id);
  const j = idx + dir;
  if (idx < 0 || j < 0 || j >= arr.length) return;
  const tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
  showLoad('Menyimpan urutan...');
  try {
    for (let k = 0; k < arr.length; k++) {
      const want = (k + 1) * 10;
      if (arr[k].urutan !== want) {
        await window.HQ.AdminAPI.updatePeriode({ id_periode: arr[k].id_periode, urutan: want });
      }
    }
    await loadMasterData();
    loadPeriode();
    toast('Urutan periode diperbarui', 'ok');
  } catch(e) {
    toast('Gagal mengurutkan: ' + friendlyError(e) + ' (jalankan patch_102 dulu?)', 'err');
  } finally { hideLoad(); }
}

function openModalPeriode(id) {
  document.getElementById('prdId').value = '';
  document.getElementById('prdNama').value = '';
  document.getElementById('prdMulai').value = '';
  document.getElementById('prdSelesai').value = '';
  document.getElementById('prdDesc').value = '';
  document.getElementById('prdStatus').value = 'nonaktif';
  openModal('modalPeriode');
}

function editPeriode(id) {
  const p = allPeriode.find(x => x.id_periode === id);
  if (!p) return;
  document.getElementById('prdId').value      = p.id_periode;
  document.getElementById('prdNama').value    = p.nama_periode;
  document.getElementById('prdMulai').value   = p.tanggal_mulai;
  document.getElementById('prdSelesai').value = p.tanggal_selesai;
  document.getElementById('prdDesc').value    = p.deskripsi;
  document.getElementById('prdStatus').value  = p.status;
  openModal('modalPeriode');
}

async function aktivasiPeriode(id) {
  showLoad('Bismillah, mengaktifkan periode...');
  try {
    await window.HQ.AdminAPI.updatePeriode({ id_periode: id, status: 'aktif' });
    toast('Periode diaktifkan!','ok');
    await loadMasterData(); loadPeriode();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

async function savePeriode() {
  const id   = document.getElementById('prdId').value;
  const data = {
    nama_periode   : document.getElementById('prdNama').value.trim(),
    tanggal_mulai  : document.getElementById('prdMulai').value,
    tanggal_selesai: document.getElementById('prdSelesai').value,
    deskripsi      : document.getElementById('prdDesc').value,
    status         : document.getElementById('prdStatus').value,
  };
  if (!data.nama_periode) return toast('Nama periode wajib diisi','err');
  if (!id) {
    var tahun = (data.tanggal_mulai ? new Date(data.tanggal_mulai).getFullYear() : new Date().getFullYear());
    var prefix = 'P' + tahun + '-';
    // Ambil seq tertinggi yg sudah ada utk prefix ini lalu +1, DAN pastikan tak
    // menabrak id mana pun (termasuk nomor bolong akibat hapus/manual). Pola sama
    // dgn suggestUsrIdUser — cegah tabrakan PK saat ada gap / dua admin bareng.
    var taken = {}, maxSeq = 0;
    (allPeriode || []).forEach(function(p){
      var pid = p && p.id_periode ? String(p.id_periode) : '';
      if (!pid) return;
      taken[pid] = 1;
      if (pid.indexOf(prefix) === 0) {
        var n = parseInt(pid.slice(prefix.length), 10);
        if (!isNaN(n) && n > maxSeq) maxSeq = n;
      }
    });
    var seq = maxSeq + 1;
    while (taken[prefix + seq]) seq++;
    data.id_periode = prefix + seq;
  }
  showLoad('Bismillah, menyimpan...');
  try {
    if (id) { data.id_periode = id; await window.HQ.AdminAPI.updatePeriode(data); }
    else await window.HQ.AdminAPI.createPeriode(data);
    closeModal('modalPeriode');
    toast('Periode disimpan!','ok');
    await loadMasterData(); loadPeriode();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

// ══════════════════════════════════════════
//  USERS
// ══════════════════════════════════════════
function switchUserTab(tab) {
  currentUserTab = tab;
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', ['guru','murid','semua'][i]===tab));
  const titles = { guru:'Daftar Guru', murid:'Daftar Murid', semua:'Semua User' };
  document.getElementById('userTabTitle').textContent = titles[tab];

  // Show/hide Halaqah column + filter for Guru tab
  var showHalaqahCol = tab === 'guru';
  var halaqahFilterEl = document.getElementById('userHalaqahFilter');
  var halaqahTh = document.getElementById('usrHalaqahTh');
  if (halaqahFilterEl) {
    halaqahFilterEl.style.display = showHalaqahCol ? '' : 'none';
    if (showHalaqahCol) {
      halaqahFilterEl.innerHTML = '<option value="">— Semua Halaqah —</option>'
        + (allHalaqah || []).filter(function(h){ return h.id_guru; })
          .map(function(h){ return '<option value="' + esc(h.id_guru) + '">' + esc(h.nama_halaqah) + '</option>'; }).join('');
    }
  }
  if (halaqahTh) halaqahTh.style.display = showHalaqahCol ? '' : 'none';

  // Reset filters on tab switch
  var searchEl = document.getElementById('userSearchInput');
  if (searchEl) searchEl.value = '';
  var statusEl = document.getElementById('userStatusFilter');
  if (statusEl) statusEl.value = '';
  if (halaqahFilterEl) halaqahFilterEl.value = '';
  var tipeMuridEl = document.getElementById('userTipeMuridFilter');
  if (tipeMuridEl) tipeMuridEl.value = '';

  // Render dari cache -- allUsers sudah dimuat penuh oleh loadMasterData() saat
  // halaman dibuka pertama kali (goPage('users') -> loadUsers()) & setiap mutasi
  // user. Ganti tab (guru/murid/semua) HANYA memfilter ulang di klien, tanpa
  // fetch network + loader fullscreen -- lihat RENCANA_fix_search_manajemen_user.md
  // Reset batas "load more" tiap ganti tab -- mulai lagi dari 50 baris teratas.
  _usersRenderLimit = 50;
  renderUsersTable(tab);
}

async function loadUsers(role) {
  var tb = document.getElementById('usersTbl');
  if (tb) tb.innerHTML = [1,2,3,4].map(function(){
    return '<tr><td><span class="skel skel-text short"></span></td>'
      + '<td><span class="skel skel-text"></span></td>'
      + '<td><span class="skel skel-text short"></span></td>'
      + '<td><span class="skel skel-text short"></span></td>'
      + '<td><span class="skel skel-text short"></span></td></tr>';
  }).join('');
  showLoad('Bismillah, memuat data pengguna...');
  try {
    const r = await window.HQ.AdminAPI.getAllUsers();
    allUsers = r.data || [];
    renderUsersTable(role);
  } catch(e) { toast('Gagal: '+e.message,'err'); }
  finally { hideLoad(); }
}

// ── Sortable table headers (generic, reusable) ──
var _tblSort = {};
function toggleSort(tableKey, col, renderFn) {
  var st = _tblSort[tableKey] || (_tblSort[tableKey] = { col: null, dir: 1 });
  if (st.col === col) st.dir = -st.dir; else { st.col = col; st.dir = 1; }
  renderFn();
}
function applySort(tableKey, rows, getters) {
  var st = _tblSort[tableKey];
  if (!st || !st.col || !getters[st.col]) return rows;
  var get = getters[st.col], dir = st.dir;
  return rows.slice().sort(function(a, b) {
    var va = get(a), vb = get(b);
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return -dir;
    if (va > vb) return dir;
    return 0;
  });
}
function updateSortIndicators(tableKey) {
  var st = _tblSort[tableKey];
  document.querySelectorAll('[data-sort-tbl="' + tableKey + '"]').forEach(function(el) {
    var col = el.getAttribute('data-sort-col');
    var active = st && st.col === col;
    el.textContent = active ? (st.dir === 1 ? ' ▲' : ' ▼') : ' ⇅';
    el.style.opacity = active ? '1' : '.3';
  });
}

// Cache guruMap (id_guru -> list halaqah): rebuild hanya saat allHalaqah berganti
// referensi (selalu reassign, tak pernah mutasi in-place) -- lihat RENCANA_fix_search_manajemen_user.md
var _guruMapCache = null, _guruMapSrc = null;
function getGuruMap() {
  if (_guruMapSrc !== allHalaqah) {
    _guruMapSrc = allHalaqah;
    _guruMapCache = {};
    (allHalaqah || []).forEach(function(h) {
      if (!h.id_guru) return;
      if (!_guruMapCache[h.id_guru]) _guruMapCache[h.id_guru] = [];
      _guruMapCache[h.id_guru].push(h);
    });
  }
  return _guruMapCache;
}

// String pencarian per-user, dihitung lazy & di-cache di objeknya sendiri.
// LAZY (bukan precompute di loadUsers()) supaya tetap benar walau allUsers
// direassign dari luar loadUsers() -- mis. startAdminAutoRefresh() background.
function _userHay(u) {
  if (u._hay === undefined) {
    u._hay = ((u.id_user||'') + ' ' + (u.nama_lengkap||'') + ' ' + (u.no_hp||'') + ' ' + (u.email||'')).toLowerCase();
  }
  return u._hay;
}

// Inisial untuk avatar tabel -- buang gelar ("Al-Ustadz/Ustadzah") lalu ambil
// huruf awal kata pertama + kata terakhir supaya seragam & mudah dibedakan.
function _userInitials(nama) {
  var n = String(nama||'').replace(/^\s*(al-?\s*)?(ustadz(ah)?|ust)\s+/i, '').trim();
  var parts = n.split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Batas baris yang benar-benar di-render ke DOM sekaligus ("load more"),
// BUKAN paginasi bernomor -- reset ke default tiap ganti tab/filter/cari
// (lihat switchUserTab & filterUsersTable), TIDAK direset saat sort/klik
// "muat lagi". Alasan: profiling (console.time) menunjukkan JS murni sudah
// cepat (<75ms bahkan 458 baris), tapi layout+paint browser dari SEMUA baris
// itu tetap ~1.6-2 DETIK karena jumlah node DOM total (bukan soal search/tab
// lagi) -- lihat RENCANA_fix_search_manajemen_user.md (Adendum 4).
var _usersRenderLimit = 50;

function renderUsersTable(role) {
  var q = (document.getElementById('userSearchInput') ? document.getElementById('userSearchInput').value : '').trim().toLowerCase();
  var statusF = document.getElementById('userStatusFilter') ? document.getElementById('userStatusFilter').value : '';
  var halaqahF = document.getElementById('userHalaqahFilter') ? document.getElementById('userHalaqahFilter').value : '';
  var tipeMuridF = document.getElementById('userTipeMuridFilter') ? document.getElementById('userTipeMuridFilter').value : '';

  var guruMap = getGuruMap();

  var filtered = (allUsers || []).filter(function(u) {
    if (role === 'guru'  && u.role !== 'guru')  return false;
    if (role === 'murid' && u.role !== 'murid') return false;
    if (statusF && u.status !== statusF) return false;
    if (tipeMuridF && (u.tipe_murid||'reguler') !== tipeMuridF) return false;
    if (halaqahF && role === 'guru' && u.id_user !== halaqahF) return false;
    if (q && _userHay(u).indexOf(q) === -1) return false;
    return true;
  });

  filtered = applySort('users', filtered, {
    id_user:      function(u){ return u.id_user||''; },
    nama_lengkap: function(u){ return u.nama_lengkap||''; },
    role:         function(u){ return u.role||''; },
    no_hp:        function(u){ return u.no_hp||''; },
    email:        function(u){ return u.email||''; },
    status:       function(u){ return u.status||''; }
  });

  var showHalaqahCol = role === 'guru';
  // Sinkronkan visibilitas header "Halaqah / Ketua" dgn body DI SINI -- jangan
  // andalkan switchUserTab() yang hanya jalan saat tab di-klik. Saat halaman
  // pertama dibuka, loadUsers('guru') -> renderUsersTable('guru') menambah
  // sel hqCell ke body sementara header <th id="usrHalaqahTh"> masih
  // display:none -> jumlah kolom body(9) != header(8) -> seluruh baris body
  // geser 1 kolom & kolom Aksi meluber keluar tabel.
  var _hqTh = document.getElementById('usrHalaqahTh');
  if (_hqTh) _hqTh.style.display = showHalaqahCol ? '' : 'none';
  // +1 kolom "No." -- dibangun langsung di sini (bukan disisipkan belakangan
  // oleh setupTableObserver global) supaya tabel Users PUNYA header "No."
  // sendiri: hasOriginalNo di updateTableNumbers() jadi true -> observer
  // langsung return, tak ada insertBefore per baris / mutation cascade sama
  // sekali utk tabel ini. Lihat RENCANA_fix_search_manajemen_user.md (Adendum 3).
  var colCount = (showHalaqahCol ? 8 : 7) + 1;
  var tbody = document.getElementById('usersTbl');

  // Hanya render 50 (bertambah tiap klik "muat lagi") ke DOM sekaligus --
  // idx tetap mewakili posisi asli di `filtered` karena slice mulai dari 0.
  var visibleRows = filtered.slice(0, _usersRenderLimit);

  tbody.innerHTML = visibleRows.map(function(u, idx) {
    var hqList = guruMap[u.id_user] || [];
    var hqCell = '';
    if (showHalaqahCol) {
      if (!hqList.length) {
        hqCell = '<td style="color:var(--text-3);font-size:12px">—</td>';
      } else {
        var items = hqList.map(function(h) {
          var kl = h.nama_ketua
            ? '<span class="u-hq-kt">' + svgIcon('award',11) + esc(h.nama_ketua) + '</span>'
            : '<span class="u-hq-kt none">belum ada ketua</span>';
          return '<div class="u-hq-row"><span class="badge b-blue">'
            + esc(h.nama_halaqah) + '</span>' + kl + '</div>';
        }).join('');
        hqCell = '<td><div class="u-hq">' + items + '</div></td>';
      }
    }
    var btnDel = (u.id_user !== 'USR-ADMIN-001')
      ? '<button class="u-ibtn d1" onclick="deleteUser(\'' + esc(u.id_user) + '\',\'' + escJs(u.nama_lengkap) + '\')" title="Nonaktifkan akun (bisa dipulihkan)">' + svgIcon('delete',14) + '</button>'
      : '';
    // Hapus permanen: hanya superadmin (membebaskan ID + hapus akun login).
    // Ikon-only bertint merah pekat -- klik membuka modal ketik-ID, jadi aman.
    if (currentUser && currentUser.role === 'superadmin' && (u.role === 'murid' || u.role === 'guru')) {
      var _hdFn = u.role === 'guru' ? 'hardDeleteGuru' : 'hardDeleteMurid';
      var _hdTitle = u.role === 'guru' ? 'Hapus PERMANEN guru: hapus halaqah yang diampu + seluruh riwayat + akun login' : 'Hapus PERMANEN: hapus data, bebaskan ID, hapus akun login';
      btnDel += '<button class="u-ibtn d2" onclick="' + _hdFn + '(\'' + esc(u.id_user) + '\',\'' + escJs(u.nama_lengkap) + '\')" title="' + _hdTitle + '">' + svgIcon('warn',14) + '</button>';
    }
    return '<tr>'
      + '<td class="u-no">' + (idx+1) + '</td>'
      + '<td><code class="nis">' + esc(u.id_user) + '</code></td>'
      + '<td><div class="u-ident"><span class="u-ava r-' + esc(u.role||'') + '">' + esc(_userInitials(u.nama_lengkap)) + '</span>'
        + '<span class="u-name">' + esc(u.nama_lengkap) + '</span></div></td>'
      + '<td>' + roleBadge(u.role) + '</td>'
      + (showHalaqahCol ? hqCell : '')
      + '<td>' + (u.no_hp
          ? '<span class="hp-copy" title="Klik untuk salin nomor" onclick="salinNoHp(this,\'' + escJs(u.no_hp) + '\')" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px">'
            + '<span>' + esc(u.no_hp) + '</span><span class="hp-copy-ico" style="opacity:.5;display:inline-flex">' + svgIcon('clipboard',12) + '</span></span>'
          : '–') + '</td>'
      + '<td>' + esc(u.email||'–') + '</td>'
      + '<td>' + (u.status==='aktif' ? '<span class="badge b-green">Aktif</span>' : '<span class="badge b-gray">Non-aktif</span>')
        + ((u.tipe_murid||'reguler')==='alumni' ? ' <span class="badge" style="background:#d1fae5;color:#065f46;font-size:10px">Alumni</span>' : '')
      + '</td>'
      + '<td class="u-act"><div class="u-actions"><button class="u-ibtn" onclick="editUser(\'' + esc(u.id_user) + '\')" title="Edit data">' + svgIcon('edit',14) + '</button>' + btnDel + '</div></td>'
      + '</tr>';
  }).join('') || '<tr><td colspan="' + colCount + '" style="text-align:center;padding:32px;color:var(--text-3)">Tidak ada data ditemukan</td></tr>';

  if (filtered.length > visibleRows.length) {
    tbody.innerHTML += '<tr><td colspan="' + colCount + '" style="text-align:center;padding:14px">'
      + '<button class="btn btn-ghost btn-sm" onclick="loadMoreUsers()">'
      + svgIcon('download',14) + ' Muat ' + Math.min(50, filtered.length - visibleRows.length) + ' lagi ('
      + (filtered.length - visibleRows.length) + ' tersisa)</button></td></tr>';
  }

  var total = (allUsers||[]).filter(function(u){
    if (role==='guru' && u.role!=='guru') return false;
    if (role==='murid' && u.role!=='murid') return false;
    return true;
  }).length;
  var badge = document.getElementById('userCountBadge');
  if (badge) badge.textContent = (visibleRows.length < filtered.length
    ? 'Menampilkan ' + visibleRows.length + ' dari ' + filtered.length + ' cocok'
    : filtered.length + ' dari ' + total + ' pengguna');
  updateSortIndicators('users');
}

function loadMoreUsers() {
  _usersRenderLimit += 50;
  renderUsersTable(currentUserTab);
}

function salinNoHp(el, hp) {
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    toast('Browser tidak mendukung salin otomatis', 'warn');
    return;
  }
  navigator.clipboard.writeText(hp).then(function() {
    toast('Nomor ' + hp + ' disalin!', 'ok');
    var ico = el.querySelector('.hp-copy-ico');
    if (ico) {
      var orig = ico.innerHTML;
      ico.innerHTML = svgIcon('ok',12);
      setTimeout(function(){ ico.innerHTML = orig; }, 1500);
    }
  }).catch(function() {
    toast('Gagal menyalin nomor', 'err');
  });
}

function filterUsersTable() {
  // Cari/filter baru -- mulai lagi dari 50 baris teratas hasil yang cocok.
  _usersRenderLimit = 50;
  renderUsersTable(currentUserTab);
}

// Debounce khusus kotak cari (oninput, per-keystroke) -- dropdown filter (onchange)
// tetap panggil filterUsersTable() langsung, tak perlu didebounce.
var _userSearchTimer = null;
function filterUsersTableDebounced() {
  clearTimeout(_userSearchTimer);
  _userSearchTimer = setTimeout(filterUsersTable, 220);
}

function toggleUsrBendahara() {
  var wrap = document.getElementById('usrBendaharaWrap');
  if (wrap) wrap.style.display = (document.getElementById('usrRole').value === 'admin') ? '' : 'none';
}

function openModalUser() {
  document.getElementById('modalUserTitle').textContent = 'User Baru';
  ['usrNama','usrHp','usrEmail','usrAlamat','usrCatatan','usrIdUser','usrPassword'].forEach(id => document.getElementById(id).value='');
  document.getElementById('usrRole').value = 'murid';
  document.getElementById('usrStatus').value = 'aktif';
  document.getElementById('usrId').value = '';
  document.getElementById('usrIsBendahara').checked = false;
  document.getElementById('usrIdUser').disabled = false;
  delete document.getElementById('usrIdUser').dataset.manual;
  document.getElementById('usrPasswordWrap').style.display = '';
  document.getElementById('usrPasswordLabel').textContent = 'Password Awal';
  document.getElementById('usrPassword').placeholder = 'Minimal 6 karakter';
  toggleUsrBendahara();
  openModal('modalUser');
}

// Saran ID User otomatis dari Nama Lengkap (hanya saat tambah user baru,
// dan hanya jika user belum mengetik manual di kolom ID User).
// Cek tabrakan dgn user yang sudah ada (termasuk yang nonaktif) → tambah angka.
function suggestUsrIdUser() {
  var idField = document.getElementById('usrIdUser');
  if (idField.disabled || idField.dataset.manual === '1') return;
  var nama = document.getElementById('usrNama').value || '';
  var base = nama.replace(/^(al-|al\s|ustadz\s|ustadzah\s)/gi, '')
    .split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, '').substring(0, 6);
  if (!base) { idField.value = ''; return; }
  var taken = {};
  (window.allUsers || []).forEach(function(u){ if (u && u.id_user) taken[String(u.id_user).toUpperCase()] = 1; });
  var cand = base, n = 1;
  while (taken[cand]) { n++; cand = base + n; }
  idField.value = cand;
}

function editUser(id) {
  const u = allUsers.find(x => x.id_user === id);
  if (!u) return;
  document.getElementById('modalUserTitle').textContent = 'Edit User';
  document.getElementById('usrId').value      = u.id_user;
  document.getElementById('usrNama').value    = u.nama_lengkap;
  document.getElementById('usrRole').value    = u.role;
  document.getElementById('usrHp').value      = u.no_hp || '';
  document.getElementById('usrEmail').value   = u.email || '';
  document.getElementById('usrAlamat').value  = u.alamat || '';
  document.getElementById('usrStatus').value  = u.status;
  if (document.getElementById('usrTipeMurid'))
    document.getElementById('usrTipeMurid').value = u.tipe_murid || 'reguler';
  document.getElementById('usrCatatan').value = u.catatan || '';
  document.getElementById('usrIsBendahara').checked = !!u.is_bendahara;
  document.getElementById('usrIdUser').value  = u.id_user;
  document.getElementById('usrIdUser').disabled = true;
  document.getElementById('usrPasswordWrap').style.display = '';
  document.getElementById('usrPasswordLabel').textContent = 'Reset Password (opsional)';
  document.getElementById('usrPassword').placeholder = 'Kosongkan jika tidak diubah';
  document.getElementById('usrPassword').value = '';
  toggleUsrBendahara();
  openModal('modalUser');
}

async function saveUser() {
  const id   = document.getElementById('usrId').value;
  const role = document.getElementById('usrRole').value;
  const data = {
    nama_lengkap: document.getElementById('usrNama').value.trim(),
    role        : role,
    no_hp       : document.getElementById('usrHp').value,
    email       : document.getElementById('usrEmail').value,
    alamat      : document.getElementById('usrAlamat').value,
    status      : document.getElementById('usrStatus').value,
    tipe_murid  : document.getElementById('usrTipeMurid') ? (document.getElementById('usrTipeMurid').value || 'reguler') : 'reguler',
    catatan     : document.getElementById('usrCatatan').value,
    is_bendahara: role === 'admin' ? document.getElementById('usrIsBendahara').checked : false,
  };
  if (!data.nama_lengkap) return toast('Nama wajib diisi','err');
  var password = '';
  if (!id) {
    var idUser = document.getElementById('usrIdUser').value.trim().toUpperCase();
    if (!idUser) return toast('ID User wajib diisi','err');
    if (!/^[A-Z0-9_-]+$/.test(idUser)) return toast('ID User hanya boleh huruf, angka, - dan _','err');
    // Cegah tabrakan primary key (termasuk user nonaktif) sebelum kirim
    if ((window.allUsers || []).some(function(u){ return u && String(u.id_user).toUpperCase() === idUser; })) {
      toast('ID User / NIS "' + idUser + '" sudah dipakai user lain (termasuk yang nonaktif). Cek di Manajemen User, atau ganti ID User.', 'err');
      var _f = document.getElementById('usrIdUser'); _f.dataset.manual = '1'; _f.focus(); _f.select();
      return;
    }
    data.id_user = idUser;
    password = document.getElementById('usrPassword').value.trim();
    if (!password) return toast('Password awal wajib diisi','err');
    if (password.length < 6) return toast('Password awal minimal 6 karakter','err');
  } else {
    password = document.getElementById('usrPassword').value.trim();
    if (password && password.length < 6) return toast('Password baru minimal 6 karakter','err');
  }
  showLoad('Bismillah, menyimpan...');
  try {
    if (id) {
      data.id_user = id;
      await window.HQ.AdminAPI.updateUser(data);
      if (password) await window.HQ.AdminAPI.resetPassword(data.id_user, password);
    } else {
      await window.HQ.AdminAPI.createUser(data);
      await window.HQ.AdminAPI.resetPassword(data.id_user, password);
    }
    closeModal('modalUser');
    toast(id ? 'User diperbarui!' : 'User baru dibuat!', 'ok');
    await loadMasterData(); loadUsers(currentUserTab);
  } catch(e) {
    var _m = (e && e.message) ? String(e.message) : '';
    if (/duplicate key|users_pkey|unique constraint|already exists/i.test(_m))
      toast('ID User / NIS "' + (data.id_user || '') + '" sudah dipakai. Ganti ID User lalu simpan lagi.', 'err');
    else
      toast(friendlyError(e),'err');
  }
  finally { hideLoad(); }
}

async function deleteUser(id, nama) {
  toast('Nonaktifkan akun ' + nama + '?', 'warn');
  document.getElementById('notifBtn').textContent = 'Ya, Nonaktifkan';
  document.getElementById('notifBtn').onclick = async () => {
    closeNotif();
    showLoad('Bismillah, memproses...');
    try {
      await window.HQ.AdminAPI.deleteUser(id);
      toast(nama + ' dinonaktifkan','ok');
      await loadMasterData(); loadUsers(currentUserTab);
    } catch(e) { toast(friendlyError(e),'err'); }
    finally { hideLoad(); }
  };
}

function hardDeleteMurid(id, nama) {
  if (!currentUser || currentUser.role !== 'superadmin') return toast('Hanya superadmin yang dapat menghapus permanen','err');
  var existing = document.getElementById('_hardDelOverlay');
  if (existing) existing.remove();

  var ov = document.createElement('div');
  ov.id = '_hardDelOverlay';
  ov.className = 'overlay open';
  ov.innerHTML = `
    <div class="modal" style="max-width:440px" onclick="event.stopPropagation()">
      <div class="modal-head">
        <div class="modal-title" style="color:#b91c1c;display:flex;align-items:center;gap:6px">${svgIcon('warn',16)} Hapus Murid Permanen</div>
        <button class="modal-x" onclick="document.getElementById('_hardDelOverlay').remove()">${svgIcon('close',16)}</button>
      </div>
      <div class="modal-body">
        <div style="background:rgba(127,29,29,.08);border:1px solid rgba(127,29,29,.25);border-radius:10px;padding:12px;font-size:12.5px;color:var(--text-2);line-height:1.6;margin-bottom:14px">
          Tindakan ini <strong>TIDAK BISA dibatalkan</strong>. Untuk <strong>${esc(nama)}</strong> (<code>${esc(id)}</code>) akan:
          <ul style="margin:6px 0 0;padding-left:18px">
            <li>Menghapus semua data: keanggotaan, nilai, setoran, raport, SPP, dll.</li>
            <li>Membebaskan ID <code>${esc(id)}</code> agar bisa dipakai ulang.</li>
            <li>Menghapus akun login murid secara permanen.</li>
          </ul>
        </div>
        <div class="fg"><label>Ketik ID murid <code>${esc(id)}</code> untuk konfirmasi</label>
          <input id="_hardDelConfirm" class="fc" placeholder="${esc(id)}" autocomplete="off" oninput="document.getElementById('_hardDelBtn').disabled = (this.value.trim().toUpperCase() !== '${esc(id)}'.toUpperCase())">
        </div>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('_hardDelOverlay').remove()">Batal</button>
        <button id="_hardDelBtn" class="btn btn-red btn-sm" disabled onclick="confirmHardDeleteMurid('${esc(id)}','${escJs(nama)}')">${svgIcon('delete',14)} Hapus Permanen</button>
      </div>
    </div>`;
  ov.addEventListener('click', function(){ ov.remove(); });
  document.body.appendChild(ov);
  document.getElementById('_hardDelConfirm').focus();
}

async function confirmHardDeleteMurid(id, nama) {
  var inp = document.getElementById('_hardDelConfirm');
  if (!inp || inp.value.trim().toUpperCase() !== id.toUpperCase()) return toast('Ketik ID murid dengan benar untuk konfirmasi','err');
  document.getElementById('_hardDelOverlay').remove();
  showLoad('Bismillah, menghapus permanen...');
  try {
    await window.HQ.AdminAPI.hardDeleteMurid(id);
    toast(nama + ' dihapus permanen','ok');
    await loadMasterData(); loadUsers(currentUserTab);
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

// ── Hard delete GURU & HALAQAH (superadmin) — modal ketik-ID untuk konfirmasi ──
function _hardDelModal(title, warnHtml, id, confirmFn, nama) {
  if (!currentUser || currentUser.role !== 'superadmin') return toast('Hanya superadmin yang dapat menghapus permanen','err');
  var existing = document.getElementById('_hardDelOverlay'); if (existing) existing.remove();
  var ov = document.createElement('div');
  ov.id = '_hardDelOverlay'; ov.className = 'overlay open';
  ov.innerHTML =
    '<div class="modal" style="max-width:460px" onclick="event.stopPropagation()">'
    + '<div class="modal-head"><div class="modal-title" style="color:#b91c1c;display:flex;align-items:center;gap:6px">' + title + '</div>'
    + '<button class="modal-x" onclick="document.getElementById(\'_hardDelOverlay\').remove()">' + svgIcon('close',16) + '</button></div>'
    + '<div class="modal-body">'
    + '<div style="background:rgba(127,29,29,.08);border:1px solid rgba(127,29,29,.25);border-radius:10px;padding:12px;font-size:12.5px;color:var(--text-2);line-height:1.6;margin-bottom:14px">' + warnHtml + '</div>'
    + '<div class="fg"><label>Ketik ID <code>' + esc(id) + '</code> untuk konfirmasi</label>'
    + '<input id="_hardDelConfirm" class="fc" placeholder="' + esc(id) + '" autocomplete="off" oninput="document.getElementById(\'_hardDelBtn\').disabled=(this.value.trim().toUpperCase()!==\'' + esc(id) + '\'.toUpperCase())"></div>'
    + '</div><div class="modal-foot">'
    + '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'_hardDelOverlay\').remove()">Batal</button>'
    + '<button id="_hardDelBtn" class="btn btn-red btn-sm" disabled onclick="' + confirmFn + '(\'' + esc(id) + '\',\'' + escJs(nama) + '\')">' + svgIcon('delete',14) + ' Hapus Permanen</button>'
    + '</div></div>';
  ov.addEventListener('click', function(){ ov.remove(); });
  document.body.appendChild(ov);
  document.getElementById('_hardDelConfirm').focus();
}

function hardDeleteGuru(id, nama) {
  _hardDelModal(svgIcon('warn',16) + ' Hapus Guru Permanen',
    'Tindakan ini <strong>TIDAK BISA dibatalkan</strong>. Untuk <strong>' + esc(nama) + '</strong> (<code>' + esc(id) + '</code>) akan:'
    + '<ul style="margin:6px 0 0;padding-left:18px">'
    + '<li>Menghapus <strong>halaqah yang ia ampu</strong> beserta SELURUH riwayatnya (anggota, KBM, nilai, raport, absensi).</li>'
    + '<li>Menghapus data pembinaan (kompetensi, tashih, evaluasi, mutaba\'ah, apresiasi).</li>'
    + '<li>Menghapus akun login guru secara permanen.</li>'
    + '<li>Murid <strong>tidak</strong> ikut terhapus (hanya keanggotaannya di halaqah itu).</li></ul>',
    id, 'confirmHardDeleteGuru', nama);
}
async function confirmHardDeleteGuru(id, nama) {
  var inp = document.getElementById('_hardDelConfirm');
  if (!inp || inp.value.trim().toUpperCase() !== id.toUpperCase()) return toast('Ketik ID guru dengan benar untuk konfirmasi','err');
  document.getElementById('_hardDelOverlay').remove();
  showLoad('Bismillah, menghapus permanen...');
  try {
    await window.HQ.AdminAPI.hardDeleteGuru(id);
    toast(nama + ' dihapus permanen','ok');
    await loadMasterData(); loadUsers(currentUserTab);
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

function hardDeleteHalaqah(id, nama) {
  _hardDelModal(svgIcon('warn',16) + ' Hapus Halaqah Permanen',
    'Tindakan ini <strong>TIDAK BISA dibatalkan</strong>. Halaqah <strong>' + esc(nama) + '</strong> (<code>' + esc(id) + '</code>) beserta <strong>SELURUH riwayatnya</strong> akan dihapus: keanggotaan murid, semua sesi KBM, nilai, raport, observasi, dll. Murid tetap ada (hanya keanggotaannya di halaqah ini yang hilang).',
    id, 'confirmHardDeleteHalaqah', nama);
}
async function confirmHardDeleteHalaqah(id, nama) {
  var inp = document.getElementById('_hardDelConfirm');
  if (!inp || inp.value.trim().toUpperCase() !== id.toUpperCase()) return toast('Ketik ID halaqah dengan benar untuk konfirmasi','err');
  document.getElementById('_hardDelOverlay').remove();
  showLoad('Bismillah, menghapus permanen...');
  try {
    await window.HQ.AdminAPI.hardDeleteHalaqah(id);
    toast('Halaqah ' + nama + ' dihapus permanen','ok');
    await loadMasterData(); if (typeof loadHalaqah === 'function') loadHalaqah(); else renderHalaqahTable();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

// ══════════════════════════════════════════
//  IMPORT CSV TERINTEGRASI
// ══════════════════════════════════════════
var importedUsers = [];

function openBulkImport() {
  importedUsers = [];
  var dz = document.getElementById('dropZone');
  if (dz) {
    dz.style.background = '';
    dz.style.borderColor = 'var(--border)';
    dz.innerHTML = '<div style="margin-bottom:8px;display:flex;justify-content:center;color:var(--text-3)">' + svgIcon('cloud',36) + '</div>'
      + '<div style="font-weight:700;font-size:14px;color:var(--text-2)">Drag file CSV ke sini atau klik untuk pilih</div>'
      + '<div style="font-size:12px;color:var(--text-3);margin-top:4px">Format: .csv (UTF-8) — support hingga 500 baris</div>';
  }
  var el;
  el = document.getElementById('importPreviewBox'); if(el) el.style.display='none';
  el = document.getElementById('importValidasi');   if(el) el.style.display='none';
  el = document.getElementById('importProgress');   if(el) el.style.display='none';
  el = document.getElementById('btnImport');        if(el) el.disabled=true;
  el = document.getElementById('csvFileInput');     if(el) el.value='';
  el = document.getElementById('btnBatalImport');   if(el) el.disabled=false;
  openModal('modalImport');
}

function downloadTemplate() {
  var header = 'NIS;password;nama_lengkap;role;no_hp;email;alamat;nama_halaqah;level;nama_guru;jadwal_hari;jam_mulai;jam_selesai';
  var sample = [
    ';guru123;Ustadzah Siti Aminah;guru;08120001;siti@email.com;;;;;;;',
    ';guru123;Ustadz Ahmad Fauzi;guru;08120002;ahmad@email.com;;;;;;;',
    ';murid123;Abdullah Azzam;murid;08130001;azzam@email.com;;Halaqah Al-Fatihah;Level 1;Ustadzah Siti Aminah;Senin Rabu;08:00;09:30',
    ';murid123;Bilal Ibrahim;murid;08130002;;;Halaqah Al-Fatihah;Level 1;Ustadzah Siti Aminah;;;',
    ';murid123;Chairul Amin;murid;08130003;;;Halaqah Al-Baqarah;Level 2;Ustadz Ahmad Fauzi;Selasa Kamis;09:00;10:30',
    ';murid123;Daud Salman;murid;08130004;;;Halaqah Al-Baqarah;Level 2;Ustadz Ahmad Fauzi;;;',
  ].join('\n');
  var blob = new Blob([header + '\n' + sample], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url; a.download = 'template_import_rattil.csv';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function handleFileDrop(e) {
  e.preventDefault();
  var dz = document.getElementById('dropZone');
  dz.style.borderColor = 'var(--border)'; dz.style.background = '';
  var file = e.dataTransfer.files[0];
  if (file) parseCSVFile(file);
}
function handleFileSelect(e) {
  var file = e.target.files[0];
  if (file) parseCSVFile(file);
}
function parseCSVFile(file) {
  if (!file.name.endsWith('.csv')) return toast('File harus berformat .csv','err');
  var reader = new FileReader();
  reader.onload = function(e) { processCSV(e.target.result); };
  reader.readAsText(file, 'UTF-8');
}

function _splitCSVRow(row, delimiter) {
  delimiter = delimiter || ',';
  var result = [], cur = '', inQ = false;
  for (var i = 0; i < row.length; i++) {
    var c = row[i];
    if (c === '"') {
      if (inQ && row[i + 1] === '"') { cur += '"'; i++; }  // "" di dalam kutip → satu " literal
      else { inQ = !inQ; }
    }
    else if (c === delimiter && !inQ) { result.push(cur.trim()); cur = ''; }
    else { cur += c; }
  }
  result.push(cur.trim());
  return result;
}

function processCSV(text) {
  var rows    = text.split('\n').map(function(r){return r.trim();}).filter(function(r){return r;});
  if (rows.length < 2) return toast('File CSV kosong atau hanya berisi header','err');
  
  // Deteksi delimiter secara dinamis
  var commaCount = (rows[0].match(/,/g) || []).length;
  var semiCount = (rows[0].match(/;/g) || []).length;
  var delimiter = semiCount > commaCount ? ';' : ',';

  var headers = _splitCSVRow(rows[0], delimiter).map(function(h){return h.toLowerCase();});
  var dataRows = rows.slice(1);

  importedUsers = dataRows.map(function(row) {
    var cols = _splitCSVRow(row, delimiter);
    var obj  = {};
    headers.forEach(function(h,i){ obj[h] = cols[i] || ''; });
    return {
      nis          : obj['nis'] || obj['id_user'] || '',
      password     : obj['password'] || '',
      nama_lengkap : obj['nama_lengkap'] || obj['nama'] || '',
      role         : obj['role'] || 'murid',
      no_hp        : obj['no_hp'] || obj['no_wa'] || '',
      email        : obj['email'] || '',
      alamat       : obj['alamat'] || '',
      nama_halaqah : obj['nama_halaqah'] || obj['halaqah'] || '',
      level        : obj['level'] || 'Level 1',
      nama_guru    : obj['nama_guru'] || obj['guru'] || '',
      jadwal_hari  : obj['jadwal_hari'] || '',
      jam_mulai    : obj['jam_mulai'] || '',
      jam_selesai  : obj['jam_selesai'] || '',
    };
  }).filter(function(u){return u.nama_lengkap;});

  if (!importedUsers.length) return toast('Tidak ada data valid di CSV','err');

  // Tampilkan preview
  var box  = document.getElementById('importPreviewBox');
  var info = document.getElementById('importPreviewInfo');
  var head = document.getElementById('importPreviewHead');
  var body = document.getElementById('importPreviewBody');
  var muridCount = importedUsers.filter(function(u){return u.role==='murid';}).length;
  var guruCount  = importedUsers.filter(function(u){return u.role==='guru';}).length;
  var halaqahSet = new Set(importedUsers.filter(function(u){return u.nama_halaqah;}).map(function(u){return u.nama_halaqah;}));

  if (info) info.innerHTML = '<span style="color:var(--green);display:inline-flex;align-items:center;gap:5px">' + svgIcon('ok',14) + ' ' + importedUsers.length + ' baris siap diimport</span>'
    + ' — ' + muridCount + ' murid, ' + guruCount + ' guru, ' + halaqahSet.size + ' halaqah';
  if (head) head.innerHTML = '<tr>' + ['NIS','Nama','Role','Halaqah','Level'].map(function(h){
    return '<th style="padding:6px 8px;background:#f8fafc;border:1px solid var(--border);font-size:10.5px;white-space:nowrap">' + h + '</th>';
  }).join('') + '</tr>';
  if (body) body.innerHTML = importedUsers.slice(0,5).map(function(u){
    return '<tr>'
      + '<td style="padding:5px 8px;border:1px solid var(--border);font-size:11px;color:var(--text-3)">' + esc(u.nis||'auto') + '</td>'
      + '<td style="padding:5px 8px;border:1px solid var(--border);font-size:11.5px;font-weight:600">' + esc(u.nama_lengkap) + '</td>'
      + '<td style="padding:5px 8px;border:1px solid var(--border)">' + roleBadge(u.role) + '</td>'
      + '<td style="padding:5px 8px;border:1px solid var(--border);font-size:11px">' + esc(u.nama_halaqah||'–') + '</td>'
      + '<td style="padding:5px 8px;border:1px solid var(--border);font-size:11px">' + esc(u.level||'–') + '</td>'
      + '</tr>';
  }).join('')
  + (importedUsers.length > 5 ? '<tr><td colspan="5" style="padding:5px 8px;text-align:center;font-size:11px;color:var(--text-3)">...dan ' + (importedUsers.length-5) + ' baris lainnya</td></tr>' : '');

  if (box) box.style.display = 'block';
  var btn = document.getElementById('btnImport');
  if (btn) btn.disabled = false;

  // Update dropzone
  var dz = document.getElementById('dropZone');
  if (dz) {
    dz.style.background = 'var(--green-l)';
    dz.style.borderColor = 'var(--green)';
    dz.innerHTML = '<div style="margin-bottom:6px;display:flex;justify-content:center;color:var(--green)">' + svgIcon('ok',28) + '</div>'
      + '<div style="font-weight:700;font-size:14px;color:var(--green)">' + importedUsers.length + ' baris siap diimport</div>'
      + '<div style="font-size:12px;color:#0a6b4e;margin-top:2px;cursor:pointer">Klik untuk ganti file</div>';
  }
}

// ── IMPORT TERINTEGRASI — 3 TAHAP ──
async function doImportTerintegrasi() {
  if (!importedUsers.length) return toast('Upload file CSV dulu','err');

  var total = importedUsers.length;
  var batchSize = 10; // Batasi ukuran batch agar payload aman

  // Disable tombol
  var btn = document.getElementById('btnImport');
  var btnBatal = document.getElementById('btnBatalImport');
  if (btn) btn.disabled = true;
  if (btnBatal) btnBatal.disabled = true;

  // Tampilkan progress
  var progBox   = document.getElementById('importProgress');
  var progLabel = document.getElementById('importProgressLabel');
  var progBar   = document.getElementById('importProgressBar');
  var progDetail = document.getElementById('importProgressDetail');
  if (progBox) progBox.style.display = 'block';

  function setProgress(pct, label, detail) {
    if (progBar)   progBar.style.width = pct + '%';
    if (progLabel) progLabel.textContent = label;
    if (progDetail) progDetail.textContent = detail || '';
  }

  var rekap = { halaqah_baru:0, user_berhasil:0, user_duplikat:0, user_gagal:[], assigned:0, not_found:[] };

  try {
    // ── TAHAP 1: Halaqah ──
    setProgress(5, 'Tahap 1/3: Memproses halaqah...', '');
    var halaqahUnik = [];
    var halaqahSet = {};
    importedUsers.forEach(function(u) {
      if (u.nama_halaqah && !halaqahSet[u.nama_halaqah]) {
        halaqahSet[u.nama_halaqah] = true;
        halaqahUnik.push({
          nama_halaqah : u.nama_halaqah,
          nama_guru    : u.nama_guru,
          level        : u.level || 'Level 1',
          jadwal_hari  : u.jadwal_hari,
          jam_mulai    : u.jam_mulai,
          jam_selesai  : u.jam_selesai,
        });
      }
    });
    if (halaqahUnik.length) {
      var halaqahMin = halaqahUnik.map(function(h){
        return {nama_halaqah:h.nama_halaqah,nama_guru:h.nama_guru,
          level:h.level||'Level 1',jadwal_hari:h.jadwal_hari||'',jam_mulai:h.jam_mulai||'',jam_selesai:h.jam_selesai||''};
      });
      var r1 = await window.HQ.AdminAPI.importTahap1({ halaqah: halaqahMin });
      rekap.halaqah_baru = (r1.dibuat || []).length;
      rekap.halaqah_skipped = r1.skipped || [];
      setProgress(15, 'Tahap 1/3: ' + rekap.halaqah_baru + ' halaqah baru dibuat', r1.message);
    } else {
      setProgress(15, 'Tahap 1/3: Tidak ada halaqah baru', '');
    }

    // ── TAHAP 2: Users — batch per 50 ──
    var offset = 0;
    var batchNum = 0;
    var totalBatches = Math.ceil(total / batchSize);
    while (offset < total) {
      batchNum++;
      var pct = 15 + Math.round((offset/total) * 55);
      setProgress(pct,
        'Tahap 2/3: Simpan user (batch ' + batchNum + '/' + totalBatches + ')...',
        'Memproses baris ' + (offset+1) + '–' + Math.min(offset+batchSize, total) + ' dari ' + total
      );
      // Kirim HANYA field minimal — kurangi ukuran payload
      var batchSlice = importedUsers.slice(offset, offset + batchSize).map(function(u) {
        return { nis:u.nis, password:u.password, nama_lengkap:u.nama_lengkap,
          role:u.role, no_hp:u.no_hp, email:u.email, alamat:u.alamat,
          nama_guru:u.nama_guru, nama_halaqah:u.nama_halaqah };
      });
      var r2 = await window.HQ.AdminAPI.importTahap2({ users: batchSlice });
      rekap.user_berhasil += (r2.berhasil || []).length;
      rekap.user_duplikat += (r2.duplikat || 0);
      if (r2.gagal && r2.gagal.length) rekap.user_gagal = rekap.user_gagal.concat(r2.gagal);
      offset += batchSlice.length;
      if (offset >= total) break;
      // Delay kecil antar batch untuk stabilitas proses database
      await new Promise(function(res){setTimeout(res, 500);});
    }
    setProgress(70, 'Tahap 2/3: ' + rekap.user_berhasil + ' user disimpan', '');

    // Tautkan halaqah -> guru yang id_guru-nya masih kosong (halaqah dibuat
    // di Tahap 1 sebelum guru-nya ada di tabel users)
    var rLink = await window.HQ.AdminAPI.linkHalaqahGuru();
    rekap.guru_linked = rLink.linked || 0;

    // ── TAHAP 3: Anggota — batch per 50 ──
    var anggotaList = importedUsers.filter(function(u){ return u.nama_halaqah && u.role === 'murid'; });
    if (anggotaList.length) {
      offset = 0; batchNum = 0;
      var totalBatches3 = Math.ceil(anggotaList.length / batchSize);
      while (offset < anggotaList.length) {
        batchNum++;
        var pct3 = 70 + Math.round((offset/anggotaList.length) * 25);
        setProgress(pct3,
          'Tahap 3/3: Daftarkan ke halaqah (batch ' + batchNum + '/' + totalBatches3 + ')...',
          'Mendaftarkan ' + (offset+1) + '–' + Math.min(offset+batchSize, anggotaList.length) + ' murid'
        );
        // Kirim hanya field anggota yang minimal
        var anggotaSlice = anggotaList.slice(offset, offset + batchSize).map(function(u) {
          return { nis:u.nis, nama_murid:u.nama_lengkap, nama_halaqah:u.nama_halaqah, level:u.level };
        });
        var r3 = await window.HQ.AdminAPI.importTahap3({ anggota: anggotaSlice });
        rekap.assigned += (r3.assigned || 0);
        if (r3.not_found) rekap.not_found = rekap.not_found.concat(r3.not_found);
        offset += anggotaSlice.length;
        if (offset >= anggotaList.length) break;
        await new Promise(function(res){setTimeout(res, 500);});
      }
    }

    setProgress(100, 'Import selesai!', '');

    // Rekap akhir
    var msg = 'Import selesai!\n'
      + 'Halaqah baru: ' + rekap.halaqah_baru + '\n'
      + 'User berhasil: ' + rekap.user_berhasil + '\n'
      + (rekap.guru_linked ? 'Halaqah ditautkan ke guru: ' + rekap.guru_linked + '\n' : '')
      + 'Didaftarkan ke halaqah: ' + rekap.assigned + '\n'
      + (rekap.user_duplikat ? 'Duplikat diskip: ' + rekap.user_duplikat + '\n' : '')
      + (rekap.user_gagal.length ? 'Gagal: ' + rekap.user_gagal.length + '\n' : '')
      + (rekap.halaqah_skipped && rekap.halaqah_skipped.length ? 'Halaqah gagal dibuat: ' + rekap.halaqah_skipped.join('; ') + '\n' : '')
      + (rekap.not_found.length ? [...new Set(rekap.not_found)].join('; ') : '');

    setTimeout(function() {
      closeModal('modalImport');
      importedUsers = [];
      toast(msg, 'ok');
      loadMasterData().then(function(){ loadUsers(currentUserTab); });
    }, 800);

  } catch(e) {
    setProgress(0, 'Import gagal!', '');
    toast('Import gagal: ' + e.message, 'err');
    if (btn) btn.disabled = false;
    if (btnBatal) btnBatal.disabled = false;
  }
}

//  HALAQAH
// ══════════════════════════════════════════
async function loadHalaqah() {
  showLoad('Bismillah, memuat data halaqah...');
  try {
    const r = await window.HQ.AdminAPI.getAllHalaqah();
    allHalaqah = r.data || [];
    renderHalaqahTable();
  } catch(e) { toast('Gagal: '+e.message,'err'); }
  finally { hideLoad(); }
}

function renderHalaqahTable() {
  var q = (document.getElementById('halaqahSearchInput') ? document.getElementById('halaqahSearchInput').value : '').trim().toLowerCase();
  var levelF  = document.getElementById('halaqahLevelFilter')  ? document.getElementById('halaqahLevelFilter').value  : '';
  var statusF = document.getElementById('halaqahStatusFilter') ? document.getElementById('halaqahStatusFilter').value : '';

  var rows = (allHalaqah || []).filter(function(h) {
    if (levelF  && h.level  !== levelF)  return false;
    if (statusF && h.status !== statusF) return false;
    if (q) {
      var hay = [h.nama_halaqah||'', h.nama_guru||'', h.nama_ketua||'', h.lokasi||'', h.jadwal_hari||''].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  rows = applySort('halaqah', rows, {
    nama_halaqah: function(h){ return h.nama_halaqah||''; },
    nama_guru:    function(h){ return h.nama_guru||''; },
    level:        function(h){ return h.level||''; },
    nama_ketua:   function(h){ return h.nama_ketua||''; },
    lokasi:       function(h){ return h.lokasi||''; },
    total_murid:  function(h){ return h.total_murid||0; },
    status:       function(h){ return h.status||''; }
  });

  var tbody = document.getElementById('halaqahTbl');
  tbody.innerHTML = rows.map(function(h) {
    var ketuaCell = h.nama_ketua
      ? '<span style="font-weight:700;color:var(--amber-txt);display:inline-flex;align-items:center;gap:4px">' + svgIcon('award',13) + ' ' + esc(h.nama_ketua) + '</span>'
      : '<span style="color:var(--text-3);font-size:11px">Belum diatur</span>';
    var perNama = _periodeNama(h.id_periode);
    var perCell = perNama
      ? '<span class="badge b-purple" style="font-size:10px">' + esc(perNama) + '</span>'
      : '<span style="color:var(--text-3);font-size:11px;font-style:italic">— belum —</span>';
    return '<tr>'
      + '<td><strong>' + esc(h.nama_halaqah) + '</strong></td>'
      + '<td>' + esc(h.nama_guru) + '</td>'
      + '<td><span class="badge b-blue">' + esc(h.level) + '</span></td>'
      + '<td>' + perCell + '</td>'
      + '<td>' + ketuaCell + '</td>'
      + '<td>' + esc(h.jadwal_hari||'–') + '<br><small style="color:var(--text-3)">' + esc(h.jam_mulai||'') + (h.jam_selesai ? '–' + esc(h.jam_selesai) : '') + '</small></td>'
      + '<td>' + esc(h.lokasi||'–') + '</td>'
      + '<td>' + (h.total_murid||0) + '</td>'
      + '<td>' + (h.status==='aktif' ? '<span class="badge b-green">Aktif</span>' : '<span class="badge b-gray">Non-aktif</span>') + '</td>'
      + '<td style="display:flex;gap:5px">'
      + '<button class="btn btn-ghost btn-sm" onclick="editHalaqah(\'' + esc(h.id_halaqah) + '\')">' + svgIcon('edit',14) + '</button>'
      + '<button class="btn btn-red btn-sm" onclick="hapusHalaqah(\'' + esc(h.id_halaqah) + '\',\'' + escJs(h.nama_halaqah) + '\')" title="Nonaktifkan (reversible)">' + svgIcon('delete',14) + '</button>'
      + ((currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin'))
          ? ' <button class="btn btn-sm" style="background:rgba(5,150,105,.12);color:#065f46;border:1px solid rgba(5,150,105,.3);font-size:10.5px;padding:3px 8px" onclick="wisudaSemuaHalaqah(\'' + esc(h.id_halaqah) + '\',\'' + escJs(h.nama_halaqah) + '\',' + (h.total_murid||0) + ')" title="Jadikan semua anggota alumni">Wisuda</button>'
          : '')
      + ((currentUser && currentUser.role === 'superadmin')
          ? '<button class="btn btn-sm" style="background:rgba(127,29,29,.12);color:#7f1d1d;border:1px solid rgba(127,29,29,.3);font-size:10.5px;padding:3px 8px" onclick="hardDeleteHalaqah(\'' + esc(h.id_halaqah) + '\',\'' + escJs(h.nama_halaqah) + '\')" title="Hapus PERMANEN: halaqah + seluruh riwayat KBM/nilai/raport">' + svgIcon('warn',14) + '</button>'
          : '')
      + '</td></tr>';
  }).join('') || '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-3)">Tidak ada halaqah ditemukan</td></tr>';

  var badge = document.getElementById('halaqahCountBadge');
  if (badge) badge.textContent = rows.length + ' dari ' + (allHalaqah||[]).length + ' halaqah';
  updateSortIndicators('halaqah');
}

function filterHalaqahTable() { renderHalaqahTable(); }

// ── Nama periode dari id (map allPeriode) ──
function _periodeNama(id) {
  if (!id) return '';
  var p = (allPeriode || []).find(function(x){ return x.id_periode === id; });
  return p ? p.nama_periode : id;
}

// ══ Set Periode Massal (Halaqah) — migrasi data ke rekap per-periode ══
function bukaBulkPeriodeHalaqah() {
  var sel = document.getElementById('bpPeriode');
  sel.innerHTML = (allPeriode || []).map(function(p){
    return '<option value="' + esc(p.id_periode) + '"' + (p.status === 'aktif' ? ' selected' : '') + '>'
      + esc(p.nama_periode) + (p.status === 'aktif' ? ' (Aktif)' : '') + '</option>';
  }).join('');
  if (!sel.options.length) { toast('Belum ada periode. Buat dulu di menu Periode / Semester.', 'warn'); return; }
  document.getElementById('bpErr').style.display = 'none';
  document.getElementById('bpHanyaKosong').checked = true;
  var _ps = document.getElementById('bpPindahSemua'); if (_ps) _ps.checked = false;
  renderBulkPeriodeList();
  openModal('modalBulkPeriodeHalaqah');
}

function renderBulkPeriodeList() {
  var hanyaKosong = document.getElementById('bpHanyaKosong').checked;
  var list = (allHalaqah || []).filter(function(h){ return h.status === 'aktif'; });
  if (hanyaKosong) list = list.filter(function(h){ return !h.id_periode; });
  list.sort(function(a,b){ return (a.nama_halaqah||'').localeCompare(b.nama_halaqah||''); });
  var wrap = document.getElementById('bpList');
  if (!list.length) { wrap.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-3);font-size:12px">Tidak ada halaqah.</div>'; return; }
  wrap.innerHTML = list.map(function(h){
    var per = _periodeNama(h.id_periode);
    return '<label style="display:flex;align-items:center;gap:9px;padding:7px 8px;border-radius:6px;cursor:pointer;font-size:12.5px" onmouseover="this.style.background=\'var(--bg-2,#f6f7f9)\'" onmouseout="this.style.background=\'\'">'
      + '<input type="checkbox" class="bp-chk" value="' + esc(h.id_halaqah) + '" checked>'
      + '<span style="flex:1;font-weight:600;color:var(--text)">' + esc(h.nama_halaqah) + '</span>'
      + '<span style="font-size:10.5px;color:var(--text-3)">' + esc(h.nama_guru || '') + '</span>'
      + (per ? '<span class="badge b-purple" style="font-size:9.5px">' + esc(per) + '</span>' : '')
      + '</label>';
  }).join('');
}

function bpToggleAll(on) {
  document.querySelectorAll('#bpList .bp-chk').forEach(function(c){ c.checked = !!on; });
}

async function terapkanBulkPeriodeHalaqah() {
  var id_periode = document.getElementById('bpPeriode').value;
  var ids = Array.from(document.querySelectorAll('#bpList .bp-chk:checked')).map(function(c){ return c.value; });
  var err = document.getElementById('bpErr');
  if (!ids.length) { err.textContent = 'Pilih minimal 1 halaqah.'; err.style.display = ''; return; }
  var repointAll = !!(document.getElementById('bpPindahSemua') && document.getElementById('bpPindahSemua').checked);
  var nama = _periodeNama(id_periode);
  var _msg = 'Tandai ' + ids.length + ' halaqah ke periode "' + nama + '"?\n\n'
    + (repointAll
        ? 'SEMUA transaksi SPP/Infaq halaqah tsb (termasuk yang sudah ber-periode lain) dipindah ke periode ini.'
        : 'Transaksi SPP/Infaq halaqah tsb yang belum berperiode ikut ditandai.');
  if (!confirm(_msg)) return;
  var btn = document.getElementById('bpApplyBtn');
  btn.disabled = true;
  showLoad('Menandai periode...');
  try {
    var r = await window.HQ.AdminAPI.bulkSetHalaqahPeriode({ halaqah_ids: ids, id_periode: id_periode, backfill_spp: true, repoint_all: repointAll });
    toast(r.halaqah + ' halaqah ditandai' + (r.spp_backfilled ? ' · ' + r.spp_backfilled + ' transaksi SPP' + (r.repoint_all ? ' dipindah' : ' ikut ditandai') : ''), 'ok');
    closeModal('modalBulkPeriodeHalaqah');
    await loadMasterData();
    renderHalaqahTable();
  } catch(e) {
    err.textContent = 'Gagal: ' + friendlyError(e); err.style.display = '';
  } finally {
    btn.disabled = false; hideLoad();
  }
}

async function wisudaSemuaHalaqah(id_halaqah, nama_halaqah, total_murid) {
  if (!confirm(
    'Wisuda semua murid dari halaqah "' + nama_halaqah + '"?\n\n'
    + '(' + total_murid + ' murid akan ditandai sebagai alumni)\n\n'
    + 'Yang terjadi:\n'
    + '- Murid masih bisa login dan lihat riwayat belajar\n'
    + '- Murid tidak dihitung sebagai murid aktif\n'
    + '- Murid tidak muncul di dropdown tambah anggota halaqah baru\n'
    + '- Berlaku GLOBAL jika murid terdaftar di halaqah lain\n\n'
    + 'Bisa dibalik: edit data murid, ubah tipe kembali ke Reguler.\n\nLanjutkan?'
  )) return;
  showLoad('Mewisuda murid...');
  try {
    var r = await window.HQ.AdminAPI.bulkWisudaHalaqah(id_halaqah, nama_halaqah);
    toast(r.jumlah + ' murid diwisuda dari "' + nama_halaqah + '"', 'ok');
    await loadMasterData();
    renderHalaqahTable();
  } catch(e) { toast(friendlyError(e), 'err'); }
  finally { hideLoad(); }
}

// ══════════════════════════════════════════
//  KELAS PENGGANTI
// ══════════════════════════════════════════
let _sisaPenggantiData = {};

async function loadKelasPengganti() {
  populateSel('penggantiHalaqahSel', allHalaqah, true);
  await Promise.all([loadHariLiburResmi(), loadSisaPenggantiSummary(), loadRiwayatPengganti()]);
}

// ══════════════════════════════════════════
//  KELOMPOK PARTNER QIYAM
// ══════════════════════════════════════════
// State bersama dgn kelompok-module.js (IIFE terpisah) → wajib global, bukan var lokal.
window._kqData = window._kqData || { id_halaqah: null, kelompok: [], murid: [] };

async function loadKelompokQiyam() {
  const qiyamHalaqah = allHalaqah.filter(h => h.level === 'Level Qiyam');
  populateSel('kqHalaqahSel', qiyamHalaqah);
  const sel = document.getElementById('kqHalaqahSel');
  if (sel && !sel.value && qiyamHalaqah.length === 1) sel.value = qiyamHalaqah[0].id_halaqah;
  await onKqHalaqahChange();
}

async function onKqHalaqahChange() {
  const id_halaqah = document.getElementById('kqHalaqahSel').value;
  const newCard  = document.getElementById('kqNewCard');
  const listWrap = document.getElementById('kqListWrap');
  if (!id_halaqah) {
    listWrap.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-3)">Pilih halaqah</div>';
    newCard.style.display = 'none';
    return;
  }
  listWrap.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-3)">Memuat...</div>';
  newCard.style.display = 'none';
  try {
    const [resM, resK] = await Promise.all([
      window.HQ.AdminAPI.getMuridQiyam(id_halaqah),
      window.HQ.AdminAPI.getKelompokPartnerHalaqah(id_halaqah),
    ]);
    // Denyut anggota (pantau) — non-fatal: kalau RPC belum ada/gagal, kelola tetap jalan
    let pantauMap = {};
    try {
      const resP = await window.HQ.AdminAPI.getPantauKelompokPartner(id_halaqah);
      (resP.data || []).forEach(p => { pantauMap[p.id_murid] = p; });
    } catch(e) { pantauMap = {}; }
    window._kqData = { id_halaqah, kelompok: (resK.data||[]).filter(k => k.status === 'aktif'), murid: resM.data||[], pantau: pantauMap };
    _kqRenderList();
    _kqRenderNewForm();
    _kqRenderMenunggu();
    newCard.style.display = '';
  } catch(e) {
    listWrap.innerHTML = '<div style="text-align:center;padding:20px;color:var(--red)">Gagal memuat data</div>';
    toast('Gagal: '+e.message,'err');
  }
}

// id_murid yang sudah jadi anggota kelompok aktif lain (selain id_kelompok yang dikecualikan)
function _kqAssignedMurid(excludeKelompok) {
  const ids = {};
  window._kqData.kelompok.forEach(k => {
    if (k.id_kelompok === excludeKelompok) return;
    (k.anggota_kelompok_partner||[]).forEach(a => { ids[a.id_murid] = true; });
  });
  return ids;
}

function _kqRenderList() {
  const listWrap = document.getElementById('kqListWrap');
  if (!window._kqData.kelompok.length) {
    listWrap.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-3)">Belum ada kelompok partner di halaqah ini</div>';
    return;
  }
  listWrap.innerHTML = window._kqData.kelompok.map(k => {
    const anggota = k.anggota_kelompok_partner || [];
    const chips = anggota.map(a =>
      `<span style="display:inline-flex;align-items:center;gap:5px;background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;padding:4px 9px;border-radius:100px;margin:0 4px 4px 0">`
        + esc(a.nama_murid || a.id_murid)
        + `<button onclick="kqRemoveAnggota('${esc(k.id_kelompok)}','${esc(a.id_murid)}')" style="border:none;background:none;color:#1d4ed8;cursor:pointer;padding:0;line-height:1;display:inline-flex" title="Hapus dari kelompok">${svgIcon('close',12)}</button>`
      + `</span>`
    ).join('');

    const assigned  = _kqAssignedMurid(k.id_kelompok);
    const available = window._kqData.murid.filter(m =>
      !anggota.some(a => a.id_murid === m.id_murid) && !assigned[m.id_murid]
    );
    const addOpts = '<option value="">+ Tambah anggota...</option>' + available.map(m =>
      `<option value="${esc(m.id_murid)}" data-nama="${esc(m.nama_murid)}">${esc(m.nama_murid)}</option>`
    ).join('');

    // Denyut anggota: tanggal setoran mandiri terakhir + status aktif/mandek + ingatkan WA
    const denyutRows = anggota.map(a => _kqDenyutRow(a)).join('');
    const denyutBlock = anggota.length
      ? `<div style="border-top:1px dashed var(--border,#e5e7eb);margin-top:8px;padding-top:8px">`
        + `<div style="font-size:10px;font-weight:800;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px">Denyut Setoran Partner</div>`
        + denyutRows
      + `</div>`
      : '';

    // Lini Masa Kelompok: toggle + tambah milestone (lazy-load)
    const liniBlock = `<div style="border-top:1px dashed var(--border,#e5e7eb);margin-top:8px;padding-top:8px">`
      + `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">`
        + `<button onclick="kqToggleLiniMasa('${esc(k.id_kelompok)}')" style="background:rgba(13,148,136,.1);color:#0f766e;border:none;border-radius:7px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px">${svgIcon('calendar',12)} Lini Masa</button>`
        + `<button onclick="kqAddMilestone('${esc(k.id_kelompok)}')" style="background:var(--bg-2,#f3f4f6);color:var(--text-1,#374151);border:none;border-radius:7px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer">+ Milestone</button>`
        + `<button onclick="kqToggleTarget('${esc(k.id_kelompok)}')" style="background:rgba(245,158,11,.12);color:#b45309;border:none;border-radius:7px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px">${svgIcon('target',12)} Target</button>`
      + `</div>`
      + `<div id="kqLini_${esc(k.id_kelompok)}" style="display:none;margin-top:8px"></div>`
      + `<div id="kqTarget_${esc(k.id_kelompok)}" style="display:none;margin-top:8px"></div>`
    + `</div>`;

    return `<div style="background:var(--bg-1,#fff);border:1px solid var(--border,#e5e7eb);border-radius:14px;overflow:hidden;margin-bottom:10px">`
      + `<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-2,#f9fafb);border-bottom:1px solid var(--border,#f0f0f0)">`
        + `<input type="text" class="fc" value="${esc(k.nama_kelompok||'')}" placeholder="Nama kelompok" style="flex:1;font-size:12px;padding:5px 9px;font-weight:700" onchange="kqRenameKelompok('${esc(k.id_kelompok)}',this.value)">`
        + `<button onclick="kqDeleteKelompok('${esc(k.id_kelompok)}')" style="width:32px;height:32px;border-radius:7px;border:none;background:#fee2e2;color:#dc2626;cursor:pointer;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center" title="Hapus Kelompok">${svgIcon('delete',14)}</button>`
      + `</div>`
      + `<div style="padding:10px 12px">`
        + (chips || '<div style="font-size:11px;color:var(--text-3)">Belum ada anggota</div>')
        + (available.length ? `<div style="margin-top:6px"><select class="fc" style="font-size:11px;padding:5px 9px" onchange="kqAddAnggota('${esc(k.id_kelompok)}',this)">${addOpts}</select></div>` : '')
        + denyutBlock
        + liniBlock
      + `</div>`
    + `</div>`;
  }).join('');
}


  // Export functions to window
  if (typeof window !== "undefined") {
    window.loadPeriode = loadPeriode;
    window.renderPeriodeTable = renderPeriodeTable;
    window.openModalPeriode = openModalPeriode;
    window.editPeriode = editPeriode;
    window.aktivasiPeriode = aktivasiPeriode;
    window.movePeriode = movePeriode;
    window.savePeriode = savePeriode;
    window.switchUserTab = switchUserTab;
    window.loadUsers = loadUsers;
    window.toggleSort = toggleSort;
    window.applySort = applySort;
    window.updateSortIndicators = updateSortIndicators;
    window.renderUsersTable = renderUsersTable;
    window.salinNoHp = salinNoHp;
    window.filterUsersTable = filterUsersTable;
    window.loadMoreUsers = loadMoreUsers;
    window.filterUsersTableDebounced = filterUsersTableDebounced;
    window.toggleUsrBendahara = toggleUsrBendahara;
    window.openModalUser = openModalUser;
    window.suggestUsrIdUser = suggestUsrIdUser;
    window.editUser = editUser;
    window.saveUser = saveUser;
    window.deleteUser = deleteUser;
    window.hardDeleteMurid = hardDeleteMurid;
    window.confirmHardDeleteMurid = confirmHardDeleteMurid;
    window.hardDeleteGuru = hardDeleteGuru;
    window.confirmHardDeleteGuru = confirmHardDeleteGuru;
    window.hardDeleteHalaqah = hardDeleteHalaqah;
    window.confirmHardDeleteHalaqah = confirmHardDeleteHalaqah;
    window.openBulkImport = openBulkImport;
    window.downloadTemplate = downloadTemplate;
    window.handleFileDrop = handleFileDrop;
    window.handleFileSelect = handleFileSelect;
    window.parseCSVFile = parseCSVFile;
    window._splitCSVRow = _splitCSVRow;
    window.processCSV = processCSV;
    window.doImportTerintegrasi = doImportTerintegrasi;
    window.loadHalaqah = loadHalaqah;
    window.renderHalaqahTable = renderHalaqahTable;
    window.filterHalaqahTable = filterHalaqahTable;
    window.wisudaSemuaHalaqah = wisudaSemuaHalaqah;
    window.bukaBulkPeriodeHalaqah = bukaBulkPeriodeHalaqah;
    window.renderBulkPeriodeList = renderBulkPeriodeList;
    window.bpToggleAll = bpToggleAll;
    window.terapkanBulkPeriodeHalaqah = terapkanBulkPeriodeHalaqah;
    window.loadKelasPengganti = loadKelasPengganti;
    window.loadKelompokQiyam = loadKelompokQiyam;
    window.onKqHalaqahChange = onKqHalaqahChange;
    window._kqAssignedMurid = _kqAssignedMurid;
    window._kqRenderList = _kqRenderList;
  }
})();
