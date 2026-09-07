// ============================================================
//  Portal Admin — Guru & Halaqah Module
//  Modularized from admin/index.html
// ============================================================
(function() {
  "use strict";

  // --- Guru & Halaqah Management ---

// Peta warna badge Observasi Guru -- dipakai bareng oleh tabel ringkas
// (filterObservasiTable) & modal detail (lihatObsDetail). Sebelumnya
// didefinisikan ulang identik di kedua fungsi (bug hunt Fase 12).
var COND_COLOR = { 'Kondusif':'b-green', 'Kurang Kondusif':'b-amber', 'Tidak Kondusif':'b-red' };
var WAKTU_COLOR = { 'Tepat Waktu':'b-green', 'Guru Terlambat':'b-red', 'Diakhiri Lebih Awal':'b-amber', 'Keduanya':'b-red' };
var KAMERA_COLOR = { 'Sebagian Besar Terbuka':'b-green', 'Campuran':'b-amber', 'Sebagian Besar Tertutup':'b-red' };

// ══════════════════════════════════════════
//  APP START
// ══════════════════════════════════════════
async function startApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  const nama = currentUser.nama || currentUser.id_user;
  document.getElementById('sbName').textContent  = nama || 'Admin';
  document.getElementById('greet').textContent   = 'Dashboard — ' + nama;

  // Status bendahara dibaca dari kolom DB users.is_bendahara (lewat login response)
  // — BUKAN ditebak dari pola id_user (rapuh: bisa salah kira admin biasa sbg
  // bendahara, atau bendahara sungguhan malah dapat akses penuh).
  var isBendahara = currentUser.role === 'admin' && currentUser.is_bendahara === true;

  if (isBendahara) {
    document.querySelectorAll('.sb-nav button').forEach(function(btn) {
      var p = btn.getAttribute('data-p');
      if (!['dashboard', 'spp'].includes(p)) {
        btn.style.display = 'none';
      }
    });
    document.querySelectorAll('.sb-sec').forEach(function(sec) {
      sec.style.display = 'none';
    });
    var sbRole = document.getElementById('sbRole');
    if (sbRole) sbRole.textContent = 'Bendahara';
  } else if (currentUser.role === 'superadmin') {
    document.querySelectorAll('.nav-superadmin').forEach(function(el) {
      el.style.display = '';
    });
    var sbRole = document.getElementById('sbRole');
    if (sbRole) sbRole.textContent = 'Super Admin';
  }

  await loadMasterData();
  
  if (isBendahara) {
    goPage('spp');
  } else {
    loadDashboard();
  }
  startAdminAutoRefresh();
  resetAdminSession();
}

async function loadMasterData() {
  try {
    const [periodeRes, halaqahRes, usersRes] = await Promise.all([
      window.HQ.AdminAPI.getAllPeriode(),
      window.HQ.AdminAPI.getAllHalaqah(),
      window.HQ.AdminAPI.getAllUsers(),
    ]);
    allPeriode  = periodeRes.data  || [];
    allHalaqah  = halaqahRes.data  || [];
    allUsers    = usersRes.data    || [];
  } catch(e) { console.error('loadMasterData:', e); }
}

// ══════════════════════════════════════════
//  NAVIGASI
// ══════════════════════════════════════════
function goPage(name) {
  // Tutup modal yang mungkin masih terbuka + lepas kunci scroll saat pindah halaman
  document.querySelectorAll('.overlay.open, .modal-overlay.open').forEach(o => o.classList.remove('open'));
  document.body.style.overflow = '';
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('page-'+name)?.classList.add('active');
  document.querySelectorAll('[data-p="'+name+'"]').forEach(b => b.classList.add('active'));
  document.getElementById('pageTitle').textContent = PAGE_TITLES[name] || name;
  closeSB();
  const loaders = {
    dashboard : loadDashboard,
    periode   : loadPeriode,
    users     : () => loadUsers(currentUserTab),
    halaqah   : loadHalaqah,
    anggota   : () => { populateSel('anggotaHalaqahSel', allHalaqah, true); loadAnggota(); },
    pengganti : loadKelasPengganti,
    'kelompok-qiyam' : loadKelompokQiyam,
    'kelompok-belajar' : loadKelompokBelajar,
    komponen  : () => { populatePeriodeSel('komponenPeriodeSel'); if (typeof window.loadKomponen === 'function') window.loadKomponen(); },
    nilai     : () => { populatePeriodeSel('nilaiPeriodeSel'); populateSel('nilaiHalaqahSel', allHalaqah); if (typeof window.loadNilaiSetup === 'function') window.loadNilaiSetup(); },
    raport    : () => { populatePeriodeSel('raportPeriodeSel'); if (typeof window.loadRaportList === 'function') window.loadRaportList(); },
    laporan   : loadLaporan,
    absensi   : () => { populateSel('absensiHalaqahSel', allHalaqah, true); loadAbsensi(); },
    'absensi-guru' : loadAbsensiGuru,
    spp       : function(){ if (window.populateSPPPeriodeFilter) window.populateSPPPeriodeFilter(); if (window._restoreSPPCards) window._restoreSPPCards(); loadSPPAdmin(); },
    pengumuman: loadPengumuman,
    observasi : loadObservasi,
    kepatuhan : loadKepatuhan,
    audit     : loadAudit,
    level    : loadLevel,
    template : loadTemplate,
    arsip    : loadArsipPage,
    materi   : loadMateriAdmin,
    push     : loadPushAdmin,
    saran    : loadSaranPage,
    soal     : loadBankSoalAdmin,
    maze     : loadMazeAdmin,
    run      : loadRunAdmin,
    'indikator-daurah' : () => { if(window.loadIndikatorDaurah) window.loadIndikatorDaurah(); },
    'pengembangan-pengajar' : () => { if(window.loadPengembanganPengajar) window.loadPengembanganPengajar(); }
  };
  loaders[name]?.();
}

function openSB()  { document.getElementById('sidebar').classList.add('open'); document.getElementById('sbOverlay').classList.add('show'); }
function closeSB() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sbOverlay').classList.remove('show'); }

async function refreshPage() {
  const btn = document.getElementById('refreshBtn');
  if (btn) { btn.style.transform = 'rotate(360deg)'; btn.style.transition = 'transform 0.6s'; }
  setTimeout(() => { if(btn){btn.style.transform='';btn.style.transition='';} }, 700);
  try {
    if (window.HQ && window.HQ.cache && window.HQ.cache.clear) {
      window.HQ.cache.clear();
    }
    await loadMasterData();
    // Fix: variable 'id' tidak terdefinisi — ambil dari element id
    const activePage = document.querySelector('.page.active');
    const activeName = activePage ? activePage.id.replace('page-','') : '';
    if (activeName) goPage(activeName);
  } catch(e) { toast('Gagal refresh: ' + e.message, 'err'); }
}

// ══════════════════════════════════════════
//  DASHBOARD
// ══════════════════════════════════════════
async function loadDashboard() {
  showLoad('Bismillah, memulai perjuangan menjadi sahabat Al-Qur\'an...');
  try {
    const [r, kepatuhanRes] = await Promise.all([
      window.HQ.AdminAPI.getDashboard(),
      window.HQ.AdminAPI.getKepatuhanRekap()
    ]);
    
    const d = r.data;
    const p = d.periode_aktif;
    document.getElementById('periodeInfo').textContent =
      (p && p.nama_periode) ? 'Periode Aktif: ' + p.nama_periode : 'Belum ada periode aktif';
    document.getElementById('st-murid').textContent   = d.total_murid;
    document.getElementById('st-guru').textContent    = d.total_guru;
    document.getElementById('st-halaqah').textContent = d.total_halaqah;
    document.getElementById('st-kbm').textContent     = d.kbm_bulan_ini;
    document.getElementById('st-nilai').textContent   = d.pct_nilai_terisi + '%';
    document.getElementById('st-nilai-bar').style.width = d.pct_nilai_terisi + '%';

    // ── Populate Action Inbox (Opsi 1) ──
    // Saran
    const actSaran = document.getElementById('act-saran');
    const actSaranDesc = document.getElementById('act-saran-desc');
    if (d.saran_pending_count > 0) {
      actSaran.className = 'action-card ac-amber';
      actSaranDesc.textContent = `${d.saran_pending_count} saran masuk belum ditanggapi`;
    } else {
      actSaran.className = 'action-card ac-green';
      actSaranDesc.textContent = 'Semua saran selesai ditindaklanjuti';
    }

    // SPP
    const actSpp = document.getElementById('act-spp');
    const actSppDesc = document.getElementById('act-spp-desc');
    if (d.spp_pending_count > 0) {
      actSpp.className = 'action-card ac-blue';
      actSppDesc.textContent = `${d.spp_pending_count} transfer manual menunggu konfirmasi`;
    } else {
      actSpp.className = 'action-card ac-green';
      actSppDesc.textContent = 'Tidak ada verifikasi pending';
    }

    // Kelas Pengganti
    const actPengganti = document.getElementById('act-pengganti');
    const actPenggantiDesc = document.getElementById('act-pengganti-desc');
    if (d.total_hutang_pengganti > 0) {
      actPengganti.className = 'action-card ac-purple';
      actPenggantiDesc.textContent = `${d.total_hutang_pengganti} sesi libur belum diganti`;
    } else {
      actPengganti.className = 'action-card ac-green';
      actPenggantiDesc.textContent = 'Semua sesi libur telah diganti';
    }

    // ── Populate Halaqah (Opsi 2 - Urut Kehadiran Terendah) ──
    const sortedHalaqah = (d.halaqah || []).slice().sort((a, b) => (a.pct_hadir || 0) - (b.pct_hadir || 0));
    const tbody = document.getElementById('dashHalaqahTbl');
    tbody.innerHTML = sortedHalaqah.map(h => `<tr>
      <td><strong>${esc(h.nama_halaqah)}</strong></td>
      <td>${esc(h.nama_guru)}</td>
      <td><span class="badge b-blue">${esc(h.level)}</span></td>
      <td>${h.total_murid}</td>
      <td>${h.total_sesi}</td>
      <td>${nilaiLabel(h.avg_nilai)}</td>
      <td>${pctBar(h.pct_hadir||0)}</td>
    </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-3)">Belum ada data</td></tr>';

    // ── Populate Compliance Warnings (Opsi 2) ──
    const kList = kepatuhanRes.data || [];
    const warnTbody = document.getElementById('dashWarnList');
    const criticalHalaqahs = kList.filter(h => h.total_kritis > 0);
    if (criticalHalaqahs.length) {
      warnTbody.innerHTML = criticalHalaqahs.map(h => `
        <div class="warn-item">
          <div>
            <span class="warn-name">${esc(h.nama_halaqah)}</span>
            <div class="warn-meta">Guru: ${esc(h.nama_guru)} &middot; Ketua: ${esc(h.nama_ketua)}</div>
          </div>
          <span class="warn-badge" style="background:var(--red-bg);color:var(--red-txt)">${h.total_kritis} Murid Kritis</span>
        </div>
      `).join('');
    } else {
      warnTbody.innerHTML = `<div style="text-align:center;padding:12px;color:var(--green-txt);font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px">${svgIcon('ok',15)}Semua halaqah kondusif (0 kritis)</div>`;
    }

    // ── Populate Financial (Opsi 3) ──
    const fin = d.financial_overview || {};
    const pctSppLunas = fin.spp_target_nominal > 0 ? Math.min(Math.round(fin.spp_lunas_nominal / fin.spp_target_nominal * 100), 100) : 0;
    
    document.getElementById('finSppPercent').textContent = pctSppLunas + '%';
    document.getElementById('finSppBar').style.width = pctSppLunas + '%';
    document.getElementById('finSppRatio').textContent = `Rp ${Number(fin.spp_lunas_nominal || 0).toLocaleString('id-ID')} / Rp ${Number(fin.spp_target_nominal || 0).toLocaleString('id-ID')}`;
    
    document.getElementById('finInfaqNominal').textContent = 'Rp ' + Number(fin.infaq_nominal || 0).toLocaleString('id-ID');
    document.getElementById('finIhsanNominal').textContent = 'Rp ' + Number(fin.ihsan_nominal || 0).toLocaleString('id-ID');
    document.getElementById('finGatewayNominal').textContent = 'Rp ' + Number(fin.gateway_nominal || 0).toLocaleString('id-ID');
    document.getElementById('finManualNominal').textContent = 'Rp ' + Number(fin.manual_nominal || 0).toLocaleString('id-ID');
    document.getElementById('finTotalMasuk').textContent = 'Rp ' + Number(fin.total_masuk || 0).toLocaleString('id-ID');

  } catch(e) { toast('Gagal: '+e.message,'err'); }
  finally { hideLoad(); }
}

  // --- Observasi KBM Guru Superadmin ---

// ══ OBSERVASI GURU (superadmin) ══════════════════════
// ══ OBSERVASI GURU (superadmin) ══════════════════════
var _obsData  = [];
var _obsStats = [];
var _obsDataFiltered = [];

async function loadObservasi() {
  var idGuru    = document.getElementById('obsFilterGuru').value;
  var idHalaqah = document.getElementById('obsFilterHalaqah').value;
  var tglDari   = document.getElementById('obsDateFrom') ? document.getElementById('obsDateFrom').value : '';
  var tglSampai = document.getElementById('obsDateTo')   ? document.getElementById('obsDateTo').value   : '';
  showLoad('Memuat observasi...');
  try {
    var params = {};
    if (idGuru)    params.id_guru    = idGuru;
    if (idHalaqah) params.id_halaqah = idHalaqah;
    if (tglDari)   params.tgl_dari   = tglDari;
    if (tglSampai) params.tgl_sampai = tglSampai;
    var [rDet, rStat] = await Promise.all([
      window.HQ.SuperAdminAPI.getObservasiKBM(params),
      window.HQ.SuperAdminAPI.getObservasiStats(params),
    ]);
    _obsData  = rDet.data   || [];
    _obsStats = rStat.data  || [];

    // Populate filter guru
    var guruSel = document.getElementById('obsFilterGuru');
    var existing = new Set(Array.from(guruSel.options).map(o=>o.value).filter(v=>v));
    _obsData.forEach(function(r) {
      if (r.id_guru && !existing.has(r.id_guru)) {
        var o = document.createElement('option'); o.value = r.id_guru; o.textContent = r.nama_guru || r.id_guru;
        guruSel.appendChild(o); existing.add(r.id_guru);
      }
    });

    renderObsStats();
    filterObservasiTable();
  } catch(e) { toast('Gagal: ' + e.message, 'err'); }
  finally { hideLoad(); }
}

// Ambang jumlah sesi minimal supaya persentase dianggap representatif —
// di bawah ini, warna merah/kuning diredam jadi netral & ditandai "data masih sedikit"
var OBS_MIN_SAMPLE = 3;

function renderObsStats() {
  var el = document.getElementById('obsStatsWrap');
  if (!_obsStats.length) { el.innerHTML = ''; return; }

  var sortBy = document.getElementById('obsStatSort') ? document.getElementById('obsStatSort').value : 'total_desc';
  var stats = _obsStats.slice().sort(function(a, b) {
    if (sortBy === 'total_desc')        return b.total - a.total;
    if (sortBy === 'total_asc')         return a.total - b.total;
    if (sortBy === 'kondusif_asc')      return a.pct_kondusif - b.pct_kondusif;
    if (sortBy === 'tepat_waktu_asc')   return a.pct_tepat_waktu - b.pct_tepat_waktu;
    if (sortBy === 'nama_asc')          return (a.nama_guru||'').localeCompare(b.nama_guru||'');
    return 0;
  });

  el.innerHTML = '<div class="section-title" style="font-size:14px;margin-bottom:10px">Rekap per Guru</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:16px">'
    + stats.map(function(g) {
      var sedikit   = g.total < OBS_MIN_SAMPLE;
      var netral    = 'var(--text-2)';
      var cKondusif = sedikit ? netral : (g.pct_kondusif >= 80 ? 'var(--green-txt)' : g.pct_kondusif >= 60 ? 'var(--amber-txt)' : 'var(--red-txt)');
      var cWaktu    = sedikit ? netral : (g.pct_tepat_waktu >= 90 ? 'var(--green-txt)' : g.pct_tepat_waktu >= 70 ? 'var(--amber-txt)' : 'var(--red-txt)');
      var cLatihan  = sedikit ? netral : (g.pct_ada_latihan >= 70 ? 'var(--green-txt)' : g.pct_ada_latihan >= 50 ? 'var(--amber-txt)' : 'var(--red-txt)');
      var badgeSedikit = sedikit
        ? '<span class="badge b-gray" style="font-size:9.5px;font-weight:700;display:inline-flex;align-items:center;gap:3px" title="Persentase dari sampel kecil belum tentu mencerminkan performa keseluruhan — tunggu lebih banyak data observasi sebelum menyimpulkan">'+svgIcon('clipboard',11)+'Data masih sedikit (n='+g.total+')</span>'
        : '';
      return '<div class="card" style="padding:16px;cursor:pointer" onclick="filterObsByGuru(\''+esc(g.id_guru||'')+'\',\''+escJs(g.nama_guru||'')+'\')" title="Klik untuk lihat detail observasi guru ini">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px">'
        + '<div style="font-size:14px;font-weight:800;color:var(--text)">'+esc(g.nama_guru)+'</div>'
        + badgeSedikit
        + '</div>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">'
        + '<div><div style="color:var(--text-3);font-weight:600">Kondisi Kondusif</div><div style="font-size:20px;font-weight:900;color:'+cKondusif+'">'+g.pct_kondusif+'%</div><div style="color:var(--text-3);font-size:10.5px">'+g.kondusif+' dari '+g.total+' sesi</div></div>'
        + '<div><div style="color:var(--text-3);font-weight:600">Tepat Waktu</div><div style="font-size:20px;font-weight:900;color:'+cWaktu+'">'+g.pct_tepat_waktu+'%</div><div style="color:var(--text-3);font-size:10.5px">Terlambat: '+g.terlambat+'× rata '+g.rata_menit_telat+' mnt</div></div>'
        + '<div><div style="color:var(--text-3);font-weight:600">Ada Latihan</div><div style="font-size:20px;font-weight:900;color:'+cLatihan+'">'+g.pct_ada_latihan+'%</div><div style="color:var(--text-3);font-size:10.5px">'+g.ada_latihan+' dari '+g.total+' sesi</div></div>'
        + '<div><div style="color:var(--text-3);font-weight:600">Kamera Terbuka</div><div style="font-size:20px;font-weight:900;color:var(--blue)">'+g.kamera_sebagian_besar_terbuka+'</div><div style="color:var(--text-3);font-size:10.5px">Campuran: '+g.kamera_campuran+' | Tertutup: '+g.kamera_sebagian_besar_tertutup+'</div></div>'
        + '</div></div>';
    }).join('') + '</div>';
}

// Klik kartu rekap → filter tabel detail ke guru tsb & scroll ke sana
function filterObsByGuru(idGuru, namaGuru) {
  var sel = document.getElementById('obsFilterGuru');
  if (sel && idGuru) {
    var hasOpt = Array.from(sel.options).some(function(o){ return o.value === idGuru; });
    if (!hasOpt) {
      var o = document.createElement('option'); o.value = idGuru; o.textContent = namaGuru || idGuru;
      sel.appendChild(o);
    }
    sel.value = idGuru;
  }
  var search = document.getElementById('obsSearchInput');
  if (search) search.value = idGuru ? '' : (namaGuru || '');
  loadObservasi();
  var anchor = document.getElementById('obsDetailAnchor');
  if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function filterObservasiTable() {
  const search = (document.getElementById('obsSearchInput')?.value || '').trim().toLowerCase();
  const kondisi = document.getElementById('obsFilterKondisi')?.value || '';
  const sortBy = document.getElementById('obsSort')?.value || 'tanggal_desc';

  _obsDataFiltered = _obsData.filter(r => {
    if (search) {
      const guru = (r.nama_guru || r.id_guru || '').toLowerCase();
      const halaqah = (r.nama_halaqah || r.id_halaqah || '').toLowerCase();
      const catatan = (r.catatan_lain || '').toLowerCase();
      if (!guru.includes(search) && !halaqah.includes(search) && !catatan.includes(search)) {
        return false;
      }
    }
    if (kondisi) {
      if (r.kondisi_kelas !== kondisi) return false;
    }
    return true;
  });

  _obsDataFiltered.sort((a, b) => {
    if (sortBy === 'tanggal_desc') {
      return new Date(b.tanggal || 0) - new Date(a.tanggal || 0);
    } else if (sortBy === 'tanggal_asc') {
      return new Date(a.tanggal || 0) - new Date(b.tanggal || 0);
    } else if (sortBy === 'guru_asc') {
      return (a.nama_guru || '').localeCompare(b.nama_guru || '');
    } else if (sortBy === 'halaqah_asc') {
      return (a.nama_halaqah || '').localeCompare(b.nama_halaqah || '');
    }
    return 0;
  });

  var tbody = document.getElementById('obsDetailTbl');
  if (!_obsDataFiltered.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-3)">Belum ada data observasi sesuai filter</td></tr>';
    return;
  }
  tbody.innerHTML = _obsDataFiltered.map(function(r, idx) {
    var menitInfo = r.estimasi_menit > 0 ? ' ('+r.estimasi_menit+' mnt)' : '';
    return '<tr>'
      + '<td>'+fmtDate(r.tanggal)+'<br><small style="color:var(--text-3)">ke-'+esc(String(r.pertemuan_ke||''))+'</small></td>'
      + '<td>'+esc(r.nama_halaqah||r.id_halaqah)+'</td>'
      + '<td style="font-weight:700">'+esc(r.nama_guru||r.id_guru)+'</td>'
      + '<td><span class="badge '+(COND_COLOR[r.kondisi_kelas]||'b-gray')+'" style="font-size:10.5px">'+esc(r.kondisi_kelas||'-')+'</span></td>'
      + '<td><span class="badge '+(r.ada_latihan==='Ya'?'b-green':'b-red')+'" style="font-size:10.5px">'+esc(r.ada_latihan||'-')+'</span></td>'
      + '<td><span class="badge '+(WAKTU_COLOR[r.ketepatan_waktu]||'b-gray')+'" style="font-size:10.5px">'+esc(r.ketepatan_waktu||'-')+menitInfo+'</span></td>'
      + '<td><span class="badge '+(KAMERA_COLOR[r.kamera_peserta]||'b-gray')+'" style="font-size:10.5px">'+esc(r.kamera_peserta||'-')+'</span></td>'
      + '<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11.5px" title="' + esc(r.catatan_lain || '–') + '">'+esc(r.catatan_lain||'–')+'</td>'
      + '<td><button class="btn btn-ghost btn-sm" onclick="lihatObsDetail('+idx+')" title="Lihat detail lengkap sesi ini" style="display:inline-flex;align-items:center;gap:5px">'+svgIcon('eye',13)+'Detail</button></td>'
      + '</tr>';
  }).join('');
}

function lihatObsDetail(idx) {
  var r = _obsDataFiltered[idx];
  if (!r) return;
  var menitInfo = r.estimasi_menit > 0 ? ' ('+r.estimasi_menit+' menit)' : '';
  var rows = [
    ['Tanggal', fmtDate(r.tanggal) + ' &bull; Pertemuan ke-' + esc(String(r.pertemuan_ke||'-'))],
    ['Halaqah', esc(r.nama_halaqah||r.id_halaqah)],
    ['Guru', esc(r.nama_guru||r.id_guru)],
    ['Kondisi Kelas', '<span class="badge '+(COND_COLOR[r.kondisi_kelas]||'b-gray')+'">'+esc(r.kondisi_kelas||'-')+'</span>'],
    ['Ada Latihan', '<span class="badge '+(r.ada_latihan==='Ya'?'b-green':'b-red')+'">'+esc(r.ada_latihan||'-')+'</span>'],
    ['Ketepatan Waktu', '<span class="badge '+(WAKTU_COLOR[r.ketepatan_waktu]||'b-gray')+'">'+esc(r.ketepatan_waktu||'-')+menitInfo+'</span>'],
    ['Kamera Peserta', '<span class="badge '+(KAMERA_COLOR[r.kamera_peserta]||'b-gray')+'">'+esc(r.kamera_peserta||'-')+'</span>']
  ];
  var html = '<div style="display:grid;grid-template-columns:140px 1fr;gap:10px 14px;font-size:13px">'
    + rows.map(function(row) {
        return '<div style="color:var(--text-3);font-weight:600">'+row[0]+'</div><div>'+row[1]+'</div>';
      }).join('')
    + '</div>'
    + '<div style="margin-top:16px">'
    + '<div style="color:var(--text-3);font-weight:600;font-size:13px;margin-bottom:6px">Catatan Lain</div>'
    + '<div style="white-space:pre-wrap;font-size:13px;line-height:1.6;background:var(--bg-2);border-radius:8px;padding:12px">'+esc(r.catatan_lain || '– Tidak ada catatan –')+'</div>'
    + '</div>';
  document.getElementById('obsDetailModalBody').innerHTML = html;
  openModal('modalObsDetail');
}

function fmtAuditWaktu(v) {
  if (!v) return '–';
  const dt = new Date(v);
  if (isNaN(dt)) return esc(String(v));
  return dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' +
         dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function fmtAuditDetail(d) {
  if (d === null || d === undefined || d === '') return '<span style="color:var(--text-3)">–</span>';
  let obj = d;
  if (typeof d === 'string') {
    try { obj = JSON.parse(d); } catch(_) { return esc(d); }
  }
  if (typeof obj !== 'object') return esc(String(obj));
  const parts = Object.keys(obj).map(function(k){
    let val = obj[k];
    if (val !== null && typeof val === 'object') val = JSON.stringify(val);
    return '<b style="color:var(--text-2)">' + esc(k) + ':</b> ' + esc(String(val));
  });
  return parts.length ? parts.join('<span style="opacity:.4"> &bull; </span>') : '<span style="color:var(--text-3)">–</span>';
}

async function loadAudit() {
  showLoad('Bismillah, memproses...');
  try {
    const r = await window.HQ.SuperAdminAPI.getAuditLog();
    const tbody = document.getElementById('auditTbl');
    tbody.innerHTML = (r.data||[]).map(l=>`<tr>
      <td style="font-size:12px;white-space:nowrap">${fmtAuditWaktu(l.created_at)}</td>
      <td><code style="font-size:11px">${l.user_id ? esc(l.user_id) : '<span style="color:var(--text-3)">sistem</span>'}</code></td>
      <td><span class="badge b-blue">${esc(l.action)}</span></td>
      <td style="font-size:12px;color:var(--text-3)">${fmtAuditDetail(l.detail)}</td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--text-3)">Belum ada log</td></tr>';
  } catch(e) {}
  finally { hideLoad(); }
}

function miniPctBar(pct, color) {
  return '<div style="display:inline-flex;align-items:center;justify-content:center;gap:6px;margin:2px 0">'
    + '<div style="width:45px;height:5px;background:var(--border);border-radius:100px;overflow:hidden;flex-shrink:0">'
      + '<div style="height:100%;background:'+color+';width:'+Math.min(pct,100)+'%"></div>'
    + '</div>'
    + '<span style="font-size:11px;font-weight:700;color:'+color+';flex-shrink:0;min-width:30px;text-align:right">'+pct+'%</span>'
    + '</div>';
}

async function loadKepatuhan() {
  showLoad('Memuat data kepatuhan...');
  try {
    var res = await window.HQ.AdminAPI.getKepatuhanRekap();
    var list = res.data || [];
    var globalKritis = 0;
    var globalGuruFollowup = 0;
    var globalCompletedKbm = 0;
    var globalCompletedObs = 0;
    list.forEach(function(h) {
      globalKritis += h.total_kritis;
      globalGuruFollowup += h.guru_followed_up;
      globalCompletedKbm += h.total_kbm;
      globalCompletedObs += h.total_obs;
    });
    var guruRate = globalKritis > 0 ? Math.round((globalGuruFollowup / globalKritis) * 100) : 100;
    var ketuaRate = globalCompletedKbm > 0 ? Math.round((globalCompletedObs / globalCompletedKbm) * 100) : 100;
    document.getElementById('kepatuhanTotalKritis').textContent = globalKritis;
    document.getElementById('kepatuhanGuruRate').textContent = guruRate + '%';
    document.getElementById('kepatuhanKetuaRate').textContent = ketuaRate + '%';
    var tbody = document.getElementById('kepatuhanTbl');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="align-center" style="padding:32px;color:var(--text-3)">Belum ada data halaqah aktif</td></tr>';
      return;
    }
    
    // Sort by: lowest KBM observation percentage first. If tie, sort by highest total_kritis first.
    list.sort(function(a, b) {
      var diff = a.pct_obs - b.pct_obs;
      if (diff !== 0) return diff;
      return b.total_kritis - a.total_kritis;
    });

    tbody.innerHTML = list.map(function(h) {
      var cGuru = h.pct_guru_followup >= 80 ? 'var(--green)' : h.pct_guru_followup >= 50 ? 'var(--amber-txt)' : 'var(--red)';
      var cKetua = h.pct_ketua_followup >= 80 ? 'var(--green)' : h.pct_ketua_followup >= 50 ? 'var(--amber-txt)' : 'var(--red)';
      var cObs = h.pct_obs >= 80 ? 'var(--green)' : h.pct_obs >= 50 ? 'var(--amber-txt)' : 'var(--red)';
      return '<tr>'
        + '<td><strong>' + esc(h.nama_halaqah) + '</strong></td>'
        + '<td>' + esc(h.nama_guru) + '</td>'
        + '<td>' + esc(h.nama_ketua) + '</td>'
        + '<td class="align-center"><span class="badge ' + (h.total_kritis > 0 ? 'b-red' : 'b-gray') + '" style="min-width:28px;justify-content:center">' + h.total_kritis + '</span></td>'
        + '<td class="align-center">'
          + miniPctBar(h.pct_guru_followup, cGuru)
          + '<br><small style="color:var(--text-3);font-size:10px">' + h.guru_followed_up + ' dari ' + h.total_kritis + '</small>'
        + '</td>'
        + '<td class="align-center">'
          + miniPctBar(h.pct_ketua_followup, cKetua)
          + '<br><small style="color:var(--text-3);font-size:10px">' + h.ketua_followed_up + ' dari ' + h.total_kritis + '</small>'
        + '</td>'
        + '<td class="align-center"><span class="badge b-gray" style="font-variant-numeric:tabular-nums">' + h.total_obs + ' / ' + h.total_kbm + '</span></td>'
        + '<td class="align-center">'
          + miniPctBar(h.pct_obs, cObs)
        + '</td>'
        + '</tr>';
    }).join('');
  } catch(e) {
    toast('Gagal memuat rekap kepatuhan: ' + e.message, 'err');
  } finally {
    hideLoad();
  }
}

// ══════════════════════════════════════════
//  SARAN & MASUKAN ADMIN PAGE
// ══════════════════════════════════════════
let allSaranData = [];

async function loadSaranPage() {
  showLoad('Bismillah, memuat daftar saran & masukan...');
  try {
    const res = await window.HQ.AdminAPI.getAllSaran();
    allSaranData = res.data || [];
    calculateSaranStats();
    filterSaran();
  } catch (e) {
    toast('Gagal memuat saran: ' + e.message, 'err');
  } finally {
    hideLoad();
  }
}

function calculateSaranStats() {
  const total = allSaranData.length;
  const pending = allSaranData.filter(s => s.status === 'pending' || s.status === 'dibaca').length;
  
  // Calculate average rating
  let sumGuru = 0, countGuru = 0;
  let sumMateri = 0, countMateri = 0;
  
  allSaranData.forEach(s => {
    if (s.rating_guru !== null && s.rating_guru !== undefined) {
      sumGuru += s.rating_guru;
      countGuru++;
    }
    if (s.rating_materi !== null && s.rating_materi !== undefined) {
      sumMateri += s.rating_materi;
      countMateri++;
    }
  });
  
  const avgGuru = countGuru > 0 ? (sumGuru / countGuru).toFixed(1) : '–';
  const avgMateri = countMateri > 0 ? (sumMateri / countMateri).toFixed(1) : '–';
  
  document.getElementById('saranStatTotal').textContent = total;
  document.getElementById('saranStatPending').textContent = pending;
  document.getElementById('saranStatAvgGuru').textContent = avgGuru === '–' ? '–' : avgGuru;
  document.getElementById('saranStatAvgMateri').textContent = avgMateri === '–' ? '–' : avgMateri;
}

function filterSaran() {
  const searchVal = document.getElementById('saranSearchInput').value.toLowerCase().trim();
  const catVal = document.getElementById('saranFilterKategori').value;
  const statusVal = document.getElementById('saranFilterStatus').value;
  
  const filtered = allSaranData.filter(s => {
    // Search filter
    const sender = (s.nama_pengirim || 'anonim').toLowerCase();
    const content = (s.isi_masukan || '').toLowerCase();
    const matchSearch = !searchVal || sender.includes(searchVal) || content.includes(searchVal);
    
    // Category filter
    const matchCat = !catVal || s.kategori_utama === catVal;
    
    // Status filter
    const matchStatus = !statusVal || s.status === statusVal;
    
    return matchSearch && matchCat && matchStatus;
  });
  
  renderSaranTable(filtered);
}

function renderSaranTable(list) {
  const tbody = document.getElementById('saranTbl');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="align-center" style="padding:32px;color:var(--text-3)">Tidak ada data saran yang cocok</td></tr>';
    return;
  }
  
  tbody.innerHTML = list.map(s => {
    // Format Date
    let dateStr = '–';
    if (s.created_at) {
      const dt = new Date(s.created_at);
      dateStr = dt.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + 
                dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    
    // Sender Name
    const trueName = (!s.is_anonymous && s.users && s.users.nama_lengkap) ? s.users.nama_lengkap : s.nama_pengirim;
    const senderHtml = s.is_anonymous 
      ? '<span class="badge b-red" style="display:inline-flex;align-items:center;gap:3px">'+svgIcon('lock',11)+'Anonim</span>'
      : `<strong>${esc(trueName || 'Siswa')}</strong>`;

    // Category Badge
    const catBadge = s.kategori_utama === 'portal'
      ? '<span class="badge b-purple" style="display:inline-flex;align-items:center;gap:3px">'+svgIcon('monitor',11)+'Portal & Teknis</span>'
      : '<span class="badge b-blue" style="display:inline-flex;align-items:center;gap:3px">'+svgIcon('book',11)+'Program Kelas</span>';
      
    // Sub-category badge
    const subCatLabel = `<br><small style="color:var(--text-3)">${esc(s.sub_kategori)}</small>`;
    
    // Text Snippet
    const cleanText = esc(s.isi_masukan);
    const shortText = cleanText.length > 70 ? cleanText.substring(0, 70) + '...' : cleanText;
    
    // Rating
    let ratingHtml = '<span style="color:var(--text-3)">–</span>';
    if (s.kategori_utama === 'program') {
      const starGuru = s.rating_guru ? `${svgIcon('star',11)}${s.rating_guru} (G)` : '';
      const starMateri = s.rating_materi ? `${svgIcon('star',11)}${s.rating_materi} (M)` : '';
      ratingHtml = [starGuru, starMateri].filter(Boolean).join('<br>');
    }
    
    // Status Badge
    let statusClass = 'b-amber';
    const statusVal = s.status || 'pending';
    if (statusVal === 'dibaca') statusClass = 'b-blue';
    if (statusVal === 'tindakan') statusClass = 'b-purple';
    if (statusVal === 'selesai') statusClass = 'b-green';
    if (statusVal === 'arsip') statusClass = 'b-teal';
    const statusBadge = `<span class="badge ${statusClass}">${esc(statusVal.toUpperCase())}</span>`;
    
    return `<tr>
      <td style="font-variant-numeric:tabular-nums;white-space:nowrap">${dateStr}</td>
      <td>${senderHtml}</td>
      <td>${catBadge}${subCatLabel}</td>
      <td style="max-width:300px;word-break:break-word">${shortText}</td>
      <td class="align-center" style="white-space:nowrap;font-size:11px">${ratingHtml}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-primary btn-sm" onclick="showSaranDetail('${s.id}')" style="display:inline-flex;align-items:center;gap:5px">${svgIcon('eye',13)}Detail / Aksi</button>
      </td>
    </tr>`;
  }).join('');
}

function showSaranDetail(id) {
  const s = allSaranData.find(x => x.id === id);
  if (!s) return;
  
  // Set hidden id
  document.getElementById('saranDetId').value = s.id;
  
  // Set Date
  let dateStr = '–';
  if (s.created_at) {
    const dt = new Date(s.created_at);
    dateStr = dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + 
              dt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  }
  document.getElementById('saranDetTanggal').textContent = dateStr;
  
  // Set Sender
  if (s.is_anonymous) {
    document.getElementById('saranDetPengirim').innerHTML = '<span class="badge b-red" style="display:inline-flex;align-items:center;gap:3px">'+svgIcon('lock',11)+'Anonim</span>';
  } else {
    const trueName = (s.users && s.users.nama_lengkap) ? s.users.nama_lengkap : s.nama_pengirim;
    document.getElementById('saranDetPengirim').textContent = trueName || 'Siswa';
  }
  
  // Set Kategori & Sub
  const categoryLabel = s.kategori_utama === 'portal' ? 'Portal & Aplikasi' : 'Program Kelas';
  document.getElementById('saranDetKategori').textContent = categoryLabel + ' (' + s.sub_kategori + ')';
  
  // Set Halaqah
  if (s.kategori_utama === 'program' && s.halaqah) {
    document.getElementById('saranDetHalaqah').textContent = `${s.halaqah.nama_halaqah || '–'} (Guru: ${s.halaqah.nama_guru || '–'})`;
  } else {
    document.getElementById('saranDetHalaqah').textContent = '–';
  }
  
  // Set Ratings
  const wrapGuru = document.getElementById('saranDetRatingGuruWrap');
  const wrapMateri = document.getElementById('saranDetRatingMateriWrap');
  if (s.kategori_utama === 'program') {
    wrapGuru.style.display = s.rating_guru ? 'block' : 'none';
    if (s.rating_guru) document.getElementById('saranDetRatingGuru').textContent = s.rating_guru + ' / 5';
    wrapMateri.style.display = s.rating_materi ? 'block' : 'none';
    if (s.rating_materi) document.getElementById('saranDetRatingMateri').textContent = s.rating_materi + ' / 5';
  } else {
    wrapGuru.style.display = 'none';
    wrapMateri.style.display = 'none';
  }
  
  // Set Isi
  document.getElementById('saranDetIsi').textContent = s.isi_masukan;
  
  // Set Status
  document.getElementById('saranDetStatus').value = s.status || 'pending';
  
  // Set Tanggapan & Catatan
  document.getElementById('saranDetTanggapan').value = s.tanggapan || '';
  document.getElementById('saranDetCatatanInternal').value = s.catatan_internal || '';
  
  openModal('modalSaranDetail');
}

async function simpanTanggapanSaran() {
  const id = document.getElementById('saranDetId').value;
  const status = document.getElementById('saranDetStatus').value;
  const tanggapan = document.getElementById('saranDetTanggapan').value.trim();
  const catatan_internal = document.getElementById('saranDetCatatanInternal').value.trim();
  
  if (!id) return;
  
  showLoad('Bismillah, menyimpan tanggapan...');
  try {
    const updates = {
      status: status,
      tanggapan: tanggapan || null,
      catatan_internal: catatan_internal || null,
      ditanggapi_at: new Date().toISOString(),
      ditanggapi_oleh: currentUser ? (currentUser.nama_lengkap || currentUser.nama || 'Admin') : 'Admin'
    };
    
    const s = allSaranData.find(x => x.id === id);
    await window.HQ.AdminAPI.updateSaran(id, updates, s ? s.id_murid : null);
    closeModal('modalSaranDetail');
    toast('Tanggapan berhasil disimpan!', 'ok');
    
    // Reload suggestions list
    await loadSaranPage();
  } catch (e) {
    toast('Gagal menyimpan tanggapan: ' + e.message, 'err');
  } finally {
    hideLoad();
  }
}

// ══════════════════════════════════════════
//  BANK SOAL ADMIN & IMPORT SOAL CSV
// ══════════════════════════════════════════
let _adminBankFilterText = '';
let _adminBankFilterLevel = '';
let _adminBankFilterPertemuan = '';
let _allAdminBankSoalRaw = [];
let _parsedImportSoal = [];

async function loadBankSoalAdmin() {
  showLoad('Bismillah, memuat daftar bank soal...');
  try {
    const res = await window.HQ.QuizAPI.getBankSoal(
      null, 
      null, 
      _adminBankFilterLevel || null, 
      _adminBankFilterPertemuan || null
    );
    _allAdminBankSoalRaw = res.data || [];
    filterAndRenderAdminBankList();
  } catch (err) {
    toast('Gagal memuat bank soal: ' + err.message, 'err');
  } finally {
    hideLoad();
  }
}

function onAdminBankSearchInput(val) {
  _adminBankFilterText = val;
  filterAndRenderAdminBankList();
}

async function onAdminBankLevelFilterChange(val) {
  _adminBankFilterLevel = val;
  await loadBankSoalAdmin();
}

async function onAdminBankPertemuanFilterChange(val) {
  _adminBankFilterPertemuan = val;
  await loadBankSoalAdmin();
}

function getTipeSoalLabelAdmin(tipe) {
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

// ── Helper: kelompokkan & urutkan soal per level lalu per pertemuan ──
const ADMIN_LEVEL_ORDER = ['Level 1', 'Level 2', 'Level 3', 'Level Qiyam', 'Micro Teaching', 'Tahsin Al-Fatihah'];

function _adminLevelRank(lvl) {
  const i = ADMIN_LEVEL_ORDER.indexOf(lvl);
  return i === -1 ? ADMIN_LEVEL_ORDER.length : i;
}

// Level utama sebuah soal = level tercentang yang paling awal di urutan kurikulum.
function _adminPrimaryLevel(s) {
  const lvls = (s.levels || []).slice();
  if (!lvls.length) return null;
  lvls.sort((a, b) => _adminLevelRank(a) - _adminLevelRank(b));
  return lvls[0];
}

// Bagi daftar soal menjadi seksi per-level (urut kurikulum, "Tanpa Level" di akhir),
// isi tiap seksi diurutkan naik berdasarkan rekomendasi pertemuan (null di bawah).
function groupAdminSoalByLevel(list) {
  const groups = {};
  list.forEach(s => {
    const key = _adminPrimaryLevel(s) || '__none__';
    (groups[key] = groups[key] || []).push(s);
  });
  return Object.keys(groups).sort((a, b) => {
    if (a === '__none__') return 1;
    if (b === '__none__') return -1;
    const ra = _adminLevelRank(a), rb = _adminLevelRank(b);
    return ra !== rb ? ra - rb : a.localeCompare(b);
  }).map(k => {
    const items = groups[k].slice().sort((x, y) => {
      const px = x.rekomendasi_pertemuan_ke, py = y.rekomendasi_pertemuan_ke;
      const nx = (px === null || px === undefined), ny = (py === null || py === undefined);
      if (nx && ny) return 0;
      if (nx) return 1;
      if (ny) return -1;
      return px - py;
    });
    return { level: k === '__none__' ? null : k, items };
  });
}

function adminLevelSectionHeader(level, count) {
  const label = level || 'Tanpa Level';
  const chip = level
    ? 'background:rgba(16,185,129,0.12);color:#059669;'
    : 'background:var(--bg-2);color:var(--text-3);';
  return `
    <div style="display:flex;align-items:center;gap:8px;margin:18px 0 8px;grid-column:1/-1;">
      <span style="font-size:12px;font-weight:800;${chip}padding:4px 12px;border-radius:100px;white-space:nowrap;display:inline-flex;align-items:center;gap:5px">${svgIcon('book',13)}${esc(label)}</span>
      <span style="font-size:10.5px;font-weight:700;color:var(--text-3);white-space:nowrap;">${count} soal</span>
      <div style="flex:1;height:1px;background:var(--border);"></div>
    </div>`;
}

function adminBankCardHtml(s, num) {
    const authorName = s.users ? s.users.nama_lengkap : 'Pengajar';
    const typeLabel = getTipeSoalLabelAdmin(s.tipe_soal);
    const dateStr = s.created_at ? new Date(s.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'}) : '–';
    
    // Levels badges
    const levelsHtml = (s.levels || []).map(lvl => 
      `<span style="font-size:10px;font-weight:800;background:rgba(16,185,129,0.1);color:#059669;padding:2px 8px;border-radius:100px;">${esc(lvl)}</span>`
    ).join(' ');

    // Rekomendasi badge
    const rekHtml = s.rekomendasi_pertemuan_ke 
      ? `<span style="font-size:10px;font-weight:800;background:rgba(245,158,11,0.1);color:var(--amber);padding:2px 8px;border-radius:100px;display:inline-flex;align-items:center;gap:4px">${svgIcon('pin',11)}Pertemuan ${s.rekomendasi_pertemuan_ke}</span>`
      : '';

    return `
      <div class="admin-soal-card" style="background:var(--card-solid);border-radius:var(--r-lg);padding:18px;border:1px solid var(--border);box-shadow:var(--shadow);transition:all 0.25s ease;display:flex;flex-direction:column;justify-content:space-between;gap:12px;position:relative;">
        <div>
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
            <div style="display:flex;flex-direction:column;gap:6px;min-width:0;flex:1;">
              <!-- Badges -->
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span style="font-size:10px;font-weight:800;background:var(--blue-l);color:var(--blue-d);padding:2px 8px;border-radius:100px;text-transform:uppercase;letter-spacing:0.02em;">
                  ${typeLabel}
                </span>
                ${levelsHtml}
                ${rekHtml}
              </div>
              <!-- Question text -->
              <div style="font-size:13.5px;font-weight:700;color:var(--text);line-height:1.45;margin-top:4px;word-break:break-word;">
                ${num}. ${esc(s.teks_soal)}
              </div>
            </div>

            <!-- Actions -->
            <div style="display:flex;gap:4px;flex-shrink:0;">
              <button onclick="openModalEditSoalAdmin('${escJs(s.id_soal)}')" class="btn-edit-soal-admin" style="background:var(--blue-l);color:var(--blue-d);border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;" title="Edit Soal">
                ${svgIcon('edit',15)}
              </button>
              <button onclick="hapusSoalAdmin('${escJs(s.id_soal)}')" class="btn-delete-soal-admin" style="background:var(--red-l);color:var(--red);border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;" title="Hapus Soal">
                ${svgIcon('delete',15)}
              </button>
            </div>
          </div>
        </div>

        <!-- Footer Meta Info -->
        <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:10px;font-size:10.5px;color:var(--text-3);">
          <span>Oleh: <strong>${esc(authorName)}</strong></span>
          <span>Dibuat: ${dateStr}</span>
        </div>
      </div>
    `;
}

function filterAndRenderAdminBankList() {
  const container = document.getElementById('adminBankSoalListContainer');
  if (!container) return;

  const filtered = _allAdminBankSoalRaw.filter(s => {
    if (!_adminBankFilterText) return true;
    const term = _adminBankFilterText.toLowerCase();
    const matchText = (s.teks_soal || '').toLowerCase().includes(term);
    const matchAuthor = (s.users && s.users.nama_lengkap || '').toLowerCase().includes(term);
    return matchText || matchAuthor;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<div style="background:var(--card-solid);padding:40px;border-radius:var(--r-lg);text-align:center;color:var(--text-3);border:1px dashed var(--border);grid-column: 1 / -1;">Tidak ada soal yang cocok dengan filter pencarian.</div>';
    return;
  }

  let html = '';
  groupAdminSoalByLevel(filtered).forEach(g => {
    html += adminLevelSectionHeader(g.level, g.items.length);
    g.items.forEach((s, idx) => {
      html += adminBankCardHtml(s, idx + 1);
    });
  });
  container.innerHTML = html;
}

// ══════════════════════════════════════════
//  EDITOR BANK SOAL (ADMIN) — parity penuh editor guru, memakai updateSoalFull
// ══════════════════════════════════════════
function closeAdminSoalModal() {
  var modalEl = document.getElementById('adminSoalEditModalContainer');
  if (modalEl) modalEl.innerHTML = '';
}

async function openModalEditSoalAdmin(id_soal) {
  var modalEl = document.getElementById('adminSoalEditModalContainer');
  if (!modalEl) return;

  var editingSoal = null;
  try {
    showLoad('Memuat detail soal...');
    var res = await window.HQ.QuizAPI.getSoalDetail(id_soal);
    editingSoal = res.data;
  } catch (err) {
    hideLoad();
    toast('Gagal memuat detail soal: ' + friendlyError(err), 'err');
    return;
  }
  hideLoad();
  if (!editingSoal) { toast('Soal tidak ditemukan', 'err'); return; }

  var t = editingSoal.tipe_soal;
  var sel = function(v) { return t === v ? 'selected' : ''; };

  modalEl.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeAdminSoalModal()">
      <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="font-size:16px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:7px">${svgIcon('edit',15)}Edit Soal (Bank Soal)</h3>
          <button onclick="closeAdminSoalModal()" style="background:none;border:none;cursor:pointer;color:var(--text-3);display:flex;align-items:center">${svgIcon('close',18)}</button>
        </div>

        <form onsubmit="submitFormEditSoalAdmin(event, '${escJs(editingSoal.id_soal)}')">
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">TIPE SOAL *</label>
            <select id="csTipe" disabled style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
              <option value="pilihan_ganda" ${sel('pilihan_ganda')}>Pilihan Ganda</option>
              <option value="benar_salah" ${sel('benar_salah')}>Benar / Salah</option>
              <option value="matching" ${sel('matching')}>Matching (Menjodohkan)</option>
              <option value="audio" ${sel('audio')}>Audio / Suara</option>
              <option value="teks_arab" ${sel('teks_arab')}>Teks Arab</option>
              <option value="isian_singkat" ${sel('isian_singkat')}>Isian Singkat</option>
            </select>
          </div>

          <!-- Levels Checkboxes -->
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">LEVEL HALAQAH *</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--bg-2);padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);">
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Level 1"> Level 1</label>
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Level 2"> Level 2</label>
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Level 3"> Level 3</label>
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Level Qiyam"> Level Qiyam</label>
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Micro Teaching"> Micro Teaching</label>
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" class="csLevelCheck" value="Tahsin Al-Fatihah"> Tahsin Al-Fatihah</label>
            </div>
          </div>

          <!-- Rekomendasi Pertemuan Ke- -->
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">REKOMENDASI PERTEMUAN KE (OPSIONAL)</label>
            <input type="number" id="csRekomendasiPertemuan" placeholder="Contoh: 23" min="1" value="${editingSoal.rekomendasi_pertemuan_ke ? editingSoal.rekomendasi_pertemuan_ke : ''}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
          </div>

          <!-- Default Durasi & Poin -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DEFAULT DURASI (DETIK)</label>
              <input type="number" id="csDurasiDefault" placeholder="Kosongkan jika default kuis" min="0" value="${editingSoal.durasi_detik_default !== null && editingSoal.durasi_detik_default !== undefined ? editingSoal.durasi_detik_default : ''}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DEFAULT POIN</label>
              <input type="number" id="csPoinDefault" placeholder="Default: 10" min="0" value="${editingSoal.bobot_poin_default !== null && editingSoal.bobot_poin_default !== undefined ? editingSoal.bobot_poin_default : '10'}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
            </div>
          </div>

          <!-- Boleh dimainkan di Rattil Maze (Petualangan) -->
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg-2);padding:11px;border-radius:var(--r-sm);border:1px solid var(--border);">
              <input type="checkbox" id="csBolehMaze" ${editingSoal.boleh_maze ? 'checked' : ''}>
              <span style="flex:1;display:flex;align-items:center;gap:6px">${svgIcon('gamepad',15)}Boleh dimainkan di <b>Rattil Maze</b> (Petualangan)</span>
            </label>
            <div style="font-size:10.5px;color:var(--text-3);margin-top:4px;line-height:1.5;">Efektif untuk tipe <b>Pilihan Ganda</b>, <b>Benar/Salah</b>, atau <b>Audio</b> dengan opsi pendek (≤4 opsi, tiap opsi ≤14 karakter). Tipe lain diabaikan di maze.</div>
          </div>

          <!-- Boleh dimainkan di Rattil Run (Lari) -->
          <div style="margin-bottom:12px;">
            <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg-2);padding:11px;border-radius:var(--r-sm);border:1px solid var(--border);">
              <input type="checkbox" id="csBolehRun" ${editingSoal.boleh_run ? 'checked' : ''}>
              <span style="flex:1;display:flex;align-items:center;gap:6px">${svgIcon('run',15)}Boleh dimainkan di <b>Rattil Run</b> (Lari)</span>
            </label>
            <div style="font-size:10.5px;color:var(--text-3);margin-top:4px;line-height:1.5;">Efektif untuk tipe <b>Pilihan Ganda</b> atau <b>Benar/Salah</b> dengan opsi pendek (ideal ≤3 opsi, tiap opsi ≤14 karakter). Tipe lain diabaikan di Run.</div>
          </div>

          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">TEKS PERTANYAAN (LATIN) *</label>
            <textarea id="csTeksSoal" required rows="2" placeholder="Ketik pertanyaan di sini..." style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;resize:vertical;">${esc(editingSoal.teks_soal)}</textarea>
          </div>

          <div id="csTeksArabWrap" style="display:none;margin-bottom:12px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <label style="font-size:11px;font-weight:700;color:var(--text-2);">TEKS ARAB</label>
              <button type="button" onclick="adminApplyTajwidHighlight()" style="font-size:10.5px;font-weight:800;color:var(--blue-d);background:var(--blue-l);border:none;padding:3px 8px;border-radius:100px;cursor:pointer;display:inline-flex;align-items:center;gap:4px">${svgIcon('star',11)}Tandai Highlight Tajwid</button>
            </div>
            <textarea id="csTeksArab" rows="2" oninput="adminUpdateTeksArabPreview(this.value)" placeholder="Gunakan {[...]} untuk highlight kata/hukum tajwid" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:'Amiri',serif;font-size:18px;direction:rtl;outline:none;resize:vertical;">${editingSoal.teks_arab ? esc(editingSoal.teks_arab) : ''}</textarea>
            <div style="margin-top:6px;">
              <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:2px;">Pratinjau Teks Arab:</div>
              <div id="csTeksArabPreview" style="font-family:'Amiri',serif;font-size:22px;direction:rtl;text-align:center;padding:12px;background:var(--bg-2);border-radius:var(--r-sm);border:1px solid var(--border);min-height:48px;word-break:break-word;">
                <span style="color:var(--text-3);">–</span>
              </div>
            </div>
          </div>

          <div id="csAudioWrap" style="display:none;margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">URL AUDIO (GDrive / YouTube / MP3 Direct)</label>
            <input type="url" id="csAudioUrl" value="${editingSoal.audio_url ? esc(editingSoal.audio_url) : ''}" placeholder="https://..." style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
          </div>

          <!-- Options Container Dynamic -->
          <div id="csDynamicOptions" style="margin-bottom:14px;"></div>

          <div style="display:flex;gap:10px;margin-top:18px;">
            <button type="button" onclick="closeAdminSoalModal()" style="flex:1;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;">Batal</button>
            <button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">Simpan Perubahan</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Prefill level checkboxes
  var lvls = editingSoal.levels || [];
  document.querySelectorAll('.csLevelCheck').forEach(function(cb) {
    cb.checked = lvls.indexOf(cb.value) !== -1;
  });

  // Render dynamic options for this type
  adminOnTipeSoalChange(t);

  // Prefill answers
  if (t === 'pilihan_ganda' || t === 'audio' || t === 'teks_arab') {
    var pils = editingSoal.soal_pilihan || [];
    var pilInputs = document.querySelectorAll('.csPil');
    var radioInputs = document.querySelectorAll('input[name="csBenar"]');
    pils.forEach(function(p, i) {
      if (pilInputs[i]) pilInputs[i].value = p.teks_pilihan || '';
      if (radioInputs[i]) radioInputs[i].checked = !!p.is_benar;
    });
  } else if (t === 'benar_salah') {
    var pilsBs = editingSoal.soal_pilihan || [];
    var trueBenar = pilsBs.some(function(p) { return p.teks_pilihan === 'Benar' && p.is_benar; });
    var bsInputs = document.querySelectorAll('input[name="csBsBenar"]');
    if (bsInputs[0]) bsInputs[0].checked = trueBenar;
    if (bsInputs[1]) bsInputs[1].checked = !trueBenar;
  } else if (t === 'matching') {
    var pas = editingSoal.soal_pasangan || [];
    var kiriInputs = document.querySelectorAll('.csMatchKiri');
    var kananInputs = document.querySelectorAll('.csMatchKanan');
    pas.forEach(function(p, i) {
      if (kiriInputs[i]) kiriInputs[i].value = p.teks_kiri || '';
      if (kananInputs[i]) kananInputs[i].value = p.teks_kanan || '';
    });
  } else if (t === 'isian_singkat') {
    var kun = editingSoal.soal_kunci_isian || [];
    var keys = kun.map(function(k) { return k.teks_kunci; }).join(', ');
    var inputKunci = document.getElementById('csIsianKunci');
    if (inputKunci) inputKunci.value = keys;
  }

  if (editingSoal.teks_arab) {
    adminUpdateTeksArabPreview(editingSoal.teks_arab);
  }
}

function adminOnTipeSoalChange(tipe) {
  var arabWrap = document.getElementById('csTeksArabWrap');
  var audioWrap = document.getElementById('csAudioWrap');
  var optionsDiv = document.getElementById('csDynamicOptions');

  if (arabWrap) arabWrap.style.display = (tipe === 'teks_arab') ? 'block' : 'none';
  if (audioWrap) audioWrap.style.display = (tipe === 'audio') ? 'block' : 'none';

  if (!optionsDiv) return;

  if (tipe === 'pilihan_ganda' || tipe === 'audio' || tipe === 'teks_arab') {
    optionsDiv.innerHTML = `
      <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">OPSI PILIHAN (Pilih Kunci Jawaban Benar):</label>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="0" checked> <input type="text" class="csPil" required placeholder="Pilihan A" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="1"> <input type="text" class="csPil" required placeholder="Pilihan B" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="2"> <input type="text" class="csPil" placeholder="Pilihan C (Opsional)" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        <div style="display:flex;align-items:center;gap:8px;"><input type="radio" name="csBenar" value="3"> <input type="text" class="csPil" placeholder="Pilihan D (Opsional)" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
      </div>
    `;
  } else if (tipe === 'benar_salah') {
    optionsDiv.innerHTML = `
      <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">KUNCI JAWABAN BENAR:</label>
      <div style="display:flex;gap:16px;">
        <label style="font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><input type="radio" name="csBsBenar" value="benar" checked> ${svgIcon('ok',13)}Benar</label>
        <label style="font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><input type="radio" name="csBsBenar" value="salah"> ${svgIcon('err',13)}Salah</label>
      </div>
    `;
  } else if (tipe === 'matching') {
    optionsDiv.innerHTML = `
      <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px;">PASANGAN (TEKS KIRI ↔ TEKS KANAN):</label>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;gap:8px;"><input type="text" class="csMatchKiri" required placeholder="Teks Kiri 1" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"> <input type="text" class="csMatchKanan" required placeholder="Teks Kanan 1" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        <div style="display:flex;gap:8px;"><input type="text" class="csMatchKiri" required placeholder="Teks Kiri 2" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"> <input type="text" class="csMatchKanan" required placeholder="Teks Kanan 2" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
        <div style="display:flex;gap:8px;"><input type="text" class="csMatchKiri" placeholder="Teks Kiri 3" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"> <input type="text" class="csMatchKanan" placeholder="Teks Kanan 3" style="flex:1;padding:8px;border-radius:6px;border:1px solid var(--border);"></div>
      </div>
    `;
  } else if (tipe === 'isian_singkat') {
    optionsDiv.innerHTML = `
      <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">VARIAN KUNCI JAWABAN (Pisahkan dengan koma):</label>
      <input type="text" id="csIsianKunci" required placeholder="mis. Idgham Bighunnah, idgham bighunnah" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
    `;
  }
}

function adminApplyTajwidHighlight() {
  var el = document.getElementById('csTeksArab');
  if (!el) return;
  var start = el.selectionStart;
  var end = el.selectionEnd;
  var val = el.value;
  if (start === end) {
    alert('Silakan blok/seleksi beberapa huruf atau kata Arab terlebih dahulu untuk ditandai!');
    return;
  }
  var selected = val.substring(start, end);
  el.value = val.substring(0, start) + '{[' + selected + ']}' + val.substring(end);
  el.dispatchEvent(new Event('input'));
  el.focus();
}

function adminUpdateTeksArabPreview(val) {
  var previewEl = document.getElementById('csTeksArabPreview');
  if (!previewEl) return;
  if (!val) {
    previewEl.innerHTML = '<span style="color:var(--text-3); font-size:14px;">–</span>';
    return;
  }
  var html = esc(val).replace(/\{\[(.*?)\]\}/g, function(match, content) {
    return `<span style="background:rgba(239,68,68,0.15); border-bottom:2px solid #ef4444; border-radius:4px; padding:2px 4px; font-weight:800; color:var(--text);">${content}</span>`;
  });
  previewEl.innerHTML = html;
}

async function submitFormEditSoalAdmin(e, id_soal) {
  e.preventDefault();
  // Payload dikumpulkan modul bersama (SoalCore) — sumber tunggal bentuk data
  // (kunci_isian string, delimiter, is_benar). Return null bila level kosong.
  var payload = window.SoalCore.collectFormPayload();
  if (!payload) return;

  try {
    showLoad('Menyimpan perubahan soal...');
    await window.HQ.QuizAPI.updateSoalFull(id_soal, payload);
    hideLoad();
    closeAdminSoalModal();
    toast('Soal berhasil diperbarui di Bank Soal!', 'ok');
    await loadBankSoalAdmin();
  } catch (err) {
    hideLoad();
    toast('Gagal menyimpan soal: ' + friendlyError(err), 'err');
  }
}

async function hapusSoalAdmin(id_soal) {
  if (!confirm('Apakah Anda yakin ingin menghapus soal ini dari Bank Soal?')) return;
  showLoad('Menghapus soal...');
  try {
    await window.HQ.QuizAPI.deleteSoal(id_soal);
    toast('Soal berhasil dihapus!', 'ok');
    await loadBankSoalAdmin();
  } catch (err) {
    toast('Gagal menghapus soal: ' + err.message, 'err');
  } finally {
    hideLoad();
  }
}

function bukaModalImportSoal() {
  _parsedImportSoal = [];
  const dz = document.getElementById('dropZoneSoal');
  if (dz) {
    dz.style.background = '';
    dz.style.borderColor = 'var(--border)';
    dz.innerHTML = '<div style="margin-bottom:8px;display:flex;justify-content:center;color:var(--text-3)">' + svgIcon('cloud',36) + '</div>'
      + '<div style="font-weight:700;font-size:13.5px;color:var(--text-2)">Drag berkas CSV Soal ke sini atau klik untuk memilih</div>'
      + '<div style="font-size:11px;color:var(--text-3);margin-top:4px">Format berkas: .csv (UTF-8) — Maksimal 200 soal per unggahan</div>';
  }
  document.getElementById('importPreviewBoxSoal').style.display = 'none';
  document.getElementById('importProgressSoal').style.display = 'none';
  document.getElementById('btnImportSoal').disabled = true;
  document.getElementById('csvFileInputSoal').value = '';
  document.getElementById('btnBatalImportSoal').disabled = false;
  openModal('modalImportSoal');
}

function downloadTemplateSoal() {
  window.SoalCore.downloadTemplate('template_import_soal_rattil.csv');
}

function handleFileSelectSoal(e) {
  const file = e.target.files[0];
  if (!file) return;
  parseCSVSoal(file);
}

// Drag & drop logic setup
window.addEventListener('DOMContentLoaded', () => {
  const dz = document.getElementById('dropZoneSoal');
  if (!dz) return;
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.style.borderColor = 'var(--blue)'; dz.style.background = 'rgba(56,189,248,.05)'; });
  dz.addEventListener('dragleave', e => { e.preventDefault(); dz.style.borderColor = 'var(--border)'; dz.style.background = ''; });
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.style.borderColor = 'var(--border)'; dz.style.background = '';
    const file = e.dataTransfer.files[0];
    if (file) parseCSVSoal(file);
  });
});

function parseCSVSoal(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    // Parse & validasi = SoalCore (sumber tunggal, sadar-kutip, kunci_isian string).
    const res = window.SoalCore.parseCSV(e.target.result);
    if (res.empty) {
      toast('Berkas CSV kosong atau tidak memiliki baris data!', 'err');
      return;
    }
    if (res.headerError) {
      toast('Header CSV tidak cocok dengan template! Gunakan separator titik koma (;)', 'err');
      return;
    }

    _parsedImportSoal = res.items;
    const validCount = res.validCount;

    // Render preview dari item hasil SoalCore (markup identik dgn sebelumnya).
    const tbody = document.getElementById('importPreviewTbodySoal');
    tbody.innerHTML = res.items.map(function(item) {
      const statusHtml = item.error
        ? `<span style="color:var(--red);font-weight:700;display:inline-flex;align-items:center;gap:4px">${svgIcon('err',12)}${esc(item.error)}</span>`
        : `<span style="color:var(--green);font-weight:700;display:inline-flex;align-items:center;gap:4px">${svgIcon('ok',12)}Valid</span>`;
      return `
        <tr>
          <td><span class="badge b-blue" style="font-size:9px">${esc(getTipeSoalLabelAdmin(item.tipe_soal))}</span></td>
          <td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(item.teks_soal)}">${esc(item.teks_soal)}</td>
          <td>${(item.levels || []).map(l => `<span class="badge b-green" style="font-size:9px">${esc(l)}</span>`).join(' ') || '–'}</td>
          <td class="align-center">${item.rekomendasi_pertemuan_ke || '–'}</td>
          <td>${statusHtml}</td>
        </tr>
      `;
    }).join('');

    document.getElementById('previewCountSoal').textContent = _parsedImportSoal.length;
    document.getElementById('importPreviewBoxSoal').style.display = 'block';
    
    const dropZone = document.getElementById('dropZoneSoal');
    dropZone.style.borderColor = validCount === _parsedImportSoal.length ? 'var(--green)' : 'var(--amber)';
    dropZone.innerHTML = `<div style="display:flex;justify-content:center;color:var(--text-3)">${svgIcon('folder',32)}</div>`
      + `<div style="font-weight:700;font-size:13.5px;color:var(--text-2)">Berkas: ${esc(file.name)}</div>`
      + `<div style="font-size:11px;color:var(--text-3);margin-top:4px">${validCount} dari ${_parsedImportSoal.length} soal valid dan siap diimpor.</div>`;

    document.getElementById('btnImportSoal').disabled = validCount === 0;
  };
  reader.readAsText(file);
}

async function prosesImportSoal() {
  const validSoalList = _parsedImportSoal.filter(s => !s.error);
  if (validSoalList.length === 0) return;

  document.getElementById('btnImportSoal').disabled = true;
  document.getElementById('btnBatalImportSoal').disabled = true;
  
  const progBox = document.getElementById('importProgressSoal');
  const progBar = document.getElementById('importProgressBarSoal');
  const progText = document.getElementById('importProgressTextSoal');
  
  progBox.style.display = 'block';
  progBar.style.width = '0%';
  progText.textContent = '0%';

  let importedCount = 0;

  for (let i = 0; i < validSoalList.length; i++) {
    const s = validSoalList[i];
    try {
      const payload = {
        tipe_soal: s.tipe_soal,
        teks_soal: s.teks_soal,
        teks_arab: s.teks_arab,
        audio_url: s.audio_url,
        pilihan: s.pilihan,
        pasangan: s.pasangan,
        kunci_isian: s.kunci_isian,
        levels: s.levels,
        rekomendasi_pertemuan_ke: s.rekomendasi_pertemuan_ke,
        durasi_detik_default: s.durasi_detik_default,
        bobot_poin_default: s.bobot_poin_default
      };
      
      await window.HQ.QuizAPI.createSoal(payload);
      importedCount++;
    } catch (err) {
      console.error('prosesImportSoal failed row:', i, err);
    }
    
    const percent = Math.round(((i + 1) / validSoalList.length) * 100);
    progBar.style.width = percent + '%';
    progText.textContent = percent + '%';
  }

  toast(`Impor Selesai! ${importedCount} dari ${validSoalList.length} soal berhasil masuk ke Bank Soal.`, 'ok');
  closeModal('modalImportSoal');
  await loadBankSoalAdmin();
}

// ══════════════════════════════════════════
//  HELPERS UI
// ══════════════════════════════════════════
function populateSel(selId, list, addAll=false) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  const allOpt = addAll ? '<option value="">Semua Halaqah</option>' : '<option value="">— Pilih Halaqah —</option>';
  sel.innerHTML = allOpt + (list||allHalaqah).map(h =>
    `<option value="${esc(h.id_halaqah)}">${esc(h.nama_halaqah)}</option>`).join('');
}

function populatePeriodeSel(selId) {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = '<option value="">— Pilih Periode —</option>' +
    allPeriode.map(p => `<option value="${esc(p.id_periode)}" ${p.status==='aktif'?'selected':''}>${esc(p.nama_periode)}${p.status==='aktif'?' (Aktif)':''}</option>`).join('');
}

// ══════════════════════════════════════════
//  KELOLA MAZE (Rattil Maze Adventure) — admin
// ══════════════════════════════════════════
// Peta bawaan terverifikasi (nol jalan buntu) — sama dgn level demo patch_069.
const DEFAULT_MAZE_GRID = ['#############','#.....1.....#','#.#.##.#.##.#','#.#....#....#','#.#..#.#.##.#','#....#G.....#','#.##...##.#.#','#4....P...#2#','#.#.##.##...#','#.#.##......#','#...##.##.#.#','#.#.......#.#','#.#.##.#....#','#.....3.....#','#############'];
// Nilai level = string yg sama dgn Bank Soal & halaqah.level (biar filter cocok)
const MAZE_LEVEL_OPTS = ['Level 1','Level 2','Level 3','Level Qiyam','Micro Teaching','Tahsin Al-Fatihah'];
let _mazeQuizCache = [];
let _runQuizCache = [];

function _mazeBadge(text, color) {
  return `<span style="display:inline-block;font-size:9px;font-weight:800;padding:2px 7px;border-radius:100px;background:${color}1a;color:${color}">${esc(text)}</span>`;
}

async function loadMazeAdmin() {
  const box = document.getElementById('mazeLevelListContainer');
  if (box) box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-3);grid-column:1/-1">Memuat petualangan...</div>';
  try {
    const [lvRes, qzRes] = await Promise.all([
      window.HQ.AdminAPI.getMazeLevelsAdmin(),
      window.HQ.AdminAPI.getQuizListForMaze()
    ]);
    const levels = lvRes.data || [];
    _mazeQuizCache = qzRes.data || [];
    const quizMap = {};
    _mazeQuizCache.forEach(q => { quizMap[q.id_quiz] = q; });
    if (!box) return;
    if (!levels.length) {
      box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-3);grid-column:1/-1">Belum ada petualangan. Klik "Tambah Petualangan" untuk membuat.</div>';
      return;
    }
    box.innerHTML = levels.map(lv => {
      const q = lv.id_kuis ? quizMap[lv.id_kuis] : null;
      const sumber = lv.id_kuis
        ? (q ? `${svgIcon('link',12)} ${esc(q.judul)} ${_mazeBadge(q.status, q.status==='aktif'?'#16a34a':'#d97706')}`
             : _mazeBadge('quiz tak ditemukan', '#dc2626'))
        : _mazeBadge('Latihan bebas (tanpa quiz)', '#2563eb');
      return `
        <div style="background:var(--card-solid);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;box-shadow:var(--shadow)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
            <div>
              <div style="font-weight:800;color:var(--text);font-size:14.5px">${esc(lv.nama_level)}</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:2px">Urutan ${esc(lv.urutan)} · ${esc(lv.tingkat_kesulitan)} · ${esc(lv.jumlah_monster)} monster · ${svgIcon('zap',11)}${esc(lv.kecepatan_monster)}×</div>
            </div>
            ${_mazeBadge(lv.aktif?'Aktif':'Nonaktif', lv.aktif?'#16a34a':'#6b7280')}
          </div>
          <div style="font-size:11.5px;color:var(--text-2);margin-bottom:4px">Sumber soal: ${sumber}</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:12px">Audiens: ${(lv.target_levels && lv.target_levels.length) ? esc(lv.target_levels.join(', ')) : 'Semua level'}${lv.rekomendasi_pertemuan_ke ? ' · rekom. pertemuan ke-'+esc(lv.rekomendasi_pertemuan_ke) : ''}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="openMazeLevelModal('${escJs(lv.id_maze_level)}')" style="flex:1;background:var(--blue-l);color:var(--blue-d);border:none;padding:8px;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px">${svgIcon('edit',13)}Edit</button>
            <button onclick="toggleMazeAktifAdmin('${escJs(lv.id_maze_level)}', ${lv.aktif?'false':'true'})" style="flex:1;background:var(--bg-2);color:var(--text);border:none;padding:8px;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer">${lv.aktif?'Nonaktifkan':'Aktifkan'}</button>
            <button onclick="deleteMazeLevelConfirm('${escJs(lv.id_maze_level)}','${escJs(lv.nama_level)}')" style="background:#fee2e2;color:#dc2626;border:none;padding:8px 12px;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;display:inline-flex;align-items:center">${svgIcon('delete',13)}</button>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    if (box) box.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;grid-column:1/-1">Gagal memuat: ${esc(friendlyError(e))}</div>`;
  }
}

async function openMazeLevelModal(id_maze_level) {
  const cont = document.getElementById('adminMazeModalContainer');
  if (!cont) return;
  let editing = null;
  try {
    if (id_maze_level) {
      showLoad('Memuat petualangan...');
      const lv = (await window.HQ.AdminAPI.getMazeLevelsAdmin()).data || [];
      editing = lv.find(x => x.id_maze_level === id_maze_level) || null;
    }
    if (!_mazeQuizCache.length) {
      _mazeQuizCache = (await window.HQ.AdminAPI.getQuizListForMaze()).data || [];
    }
    hideLoad();
  } catch (e) { hideLoad(); toast('Gagal memuat: ' + friendlyError(e), 'err'); return; }
  if (id_maze_level && !editing) { toast('Petualangan tidak ditemukan', 'err'); return; }

  const g = editing || {};
  const kesulitan = g.tingkat_kesulitan || 'mudah';
  const quizOpts = ['<option value="">— Latihan bebas (tanpa quiz) —</option>']
    .concat(_mazeQuizCache.map(q => `<option value="${esc(q.id_quiz)}" ${g.id_kuis===q.id_quiz?'selected':''}>${esc(q.judul)} (${esc(q.status)})</option>`))
    .join('');

  cont.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px" onclick="if(event.target===this)closeMazeModal()">
      <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="font-size:16px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:7px">${svgIcon('gamepad',15)}${editing?'Edit':'Tambah'} Petualangan</h3>
          <button onclick="closeMazeModal()" style="background:none;border:none;cursor:pointer;color:var(--text-3);display:flex;align-items:center">${svgIcon('close',18)}</button>
        </div>
        <form onsubmit="submitMazeLevel(event, ${editing?`'${escJs(editing.id_maze_level)}'`:'null'})">
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">NAMA PETUALANGAN *</label>
            <input id="mzNama" required value="${esc(g.nama_level||'')}" placeholder="Contoh: Petualangan 1 — Dasar" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">URUTAN</label>
              <input id="mzUrutan" type="number" min="0" value="${g.urutan!=null?esc(g.urutan):0}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">KESULITAN</label>
              <select id="mzKesulitan" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
                <option value="mudah" ${kesulitan==='mudah'?'selected':''}>Mudah</option>
                <option value="sedang" ${kesulitan==='sedang'?'selected':''}>Sedang</option>
                <option value="sulit" ${kesulitan==='sulit'?'selected':''}>Sulit</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">JUMLAH MONSTER (1–4)</label>
              <input id="mzMonster" type="number" min="1" max="4" value="${g.jumlah_monster!=null?esc(g.jumlah_monster):2}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">KECEPATAN (×)</label>
              <input id="mzKecepatan" type="number" min="0.5" max="2" step="0.1" value="${g.kecepatan_monster!=null?esc(g.kecepatan_monster):'1.0'}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
            </div>
          </div>
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">SUMBER SOAL (QUIZ)</label>
            <select id="mzKuis" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">${quizOpts}</select>
            <div style="font-size:10.5px;color:var(--text-3);margin-top:4px;line-height:1.5">Quiz = <b>sumber soal</b> game. Jika <b>Audiens (bawah) diisi</b> → quiz hanya sumber soal, audiens yang menentukan siapa melihat. Jika <b>Audiens kosong</b> → level ikut penugasan quiz (muncul setelah guru menugaskan + aktif). Kosong quiz + kosong audiens = latihan bebas semua murid.</div>
          </div>
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px">LEVEL HALAQAH (AUDIENS)</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--bg-2);padding:10px;border-radius:var(--r-sm);border:1px solid var(--border)">
              ${MAZE_LEVEL_OPTS.map(function(lv){ return `<label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="mzLevelCheck" value="${esc(lv)}" ${(g.target_levels||[]).indexOf(lv)>=0?'checked':''}> ${esc(lv)}</label>`; }).join('')}
            </div>
            <div style="font-size:10.5px;color:var(--text-3);margin-top:4px;line-height:1.5"><b>Diisi</b> → semua halaqah level itu <b>langsung melihat</b> game (tanpa perlu guru menugaskan quiz); quiz cuma sumber soal. <b>Kosong</b> → ikut penugasan quiz (guru). Untuk latihan bebas, soal ikut disaring ke level ini.</div>
          </div>
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">REKOMENDASI PERTEMUAN KE- (OPSIONAL)</label>
            <input id="mzPertemuan" type="number" min="1" value="${g.rekomendasi_pertemuan_ke!=null?esc(g.rekomendasi_pertemuan_ke):''}" placeholder="mis. 10" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
            <div style="font-size:10.5px;color:var(--text-3);margin-top:4px">Label rekomendasi saja (tidak memblokir), selaras Bank Soal.</div>
          </div>
          <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg-2);padding:11px;border-radius:var(--r-sm);border:1px solid var(--border);margin-bottom:8px">
            <input type="checkbox" id="mzAktif" ${(!editing || g.aktif)?'checked':''}>
            <span>Aktif (tampilkan ke murid)</span>
          </label>
          <div style="font-size:10.5px;color:var(--text-3);margin-bottom:16px">Peta: <b>bawaan terverifikasi</b> (bebas jalan buntu). Game memutar beberapa peta bawaan otomatis.</div>
          <div style="display:flex;gap:10px">
            <button type="button" onclick="closeMazeModal()" style="flex:1;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer">Batal</button>
            <button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;cursor:pointer">${editing?'Simpan Perubahan':'Simpan Petualangan'}</button>
          </div>
        </form>
      </div>
    </div>`;
}

function closeMazeModal() {
  const c = document.getElementById('adminMazeModalContainer');
  if (c) c.innerHTML = '';
}

async function submitMazeLevel(e, id_maze_level) {
  e.preventDefault();
  const nama = document.getElementById('mzNama').value.trim();
  if (!nama) { toast('Nama level wajib diisi', 'err'); return; }
  let monster = parseInt(document.getElementById('mzMonster').value);
  if (isNaN(monster) || monster < 1) monster = 1;
  if (monster > 4) monster = 4;
  let kecepatan = parseFloat(document.getElementById('mzKecepatan').value);
  if (isNaN(kecepatan) || kecepatan <= 0) kecepatan = 1.0;
  const target_levels = Array.from(document.querySelectorAll('.mzLevelCheck:checked')).map(function(cb){ return cb.value; });
  const pertemuanRaw = document.getElementById('mzPertemuan').value;
  const payload = {
    nama_level: nama,
    urutan: parseInt(document.getElementById('mzUrutan').value) || 0,
    tingkat_kesulitan: document.getElementById('mzKesulitan').value,
    jumlah_monster: monster,
    kecepatan_monster: kecepatan,
    id_kuis: document.getElementById('mzKuis').value || null,
    target_levels: target_levels,
    rekomendasi_pertemuan_ke: pertemuanRaw !== '' ? parseInt(pertemuanRaw) : null,
    aktif: document.getElementById('mzAktif').checked
  };
  try {
    showLoad('Menyimpan petualangan...');
    if (id_maze_level) {
      await window.HQ.AdminAPI.updateMazeLevel(id_maze_level, payload);
    } else {
      payload.map_data = { grid: DEFAULT_MAZE_GRID, seed: 40 };
      await window.HQ.AdminAPI.createMazeLevel(payload);
    }
    hideLoad();
    closeMazeModal();
    toast('Petualangan tersimpan!', 'ok');
    await loadMazeAdmin();
  } catch (err) {
    hideLoad();
    toast('Gagal menyimpan: ' + friendlyError(err), 'err');
  }
}

async function toggleMazeAktifAdmin(id_maze_level, aktif) {
  try {
    showLoad('Mengubah status...');
    await window.HQ.AdminAPI.setMazeLevelAktif(id_maze_level, aktif === 'true' || aktif === true);
    hideLoad();
    await loadMazeAdmin();
  } catch (err) {
    hideLoad();
    toast('Gagal: ' + friendlyError(err), 'err');
  }
}

async function deleteMazeLevelConfirm(id_maze_level, nama) {
  if (!confirm('Hapus petualangan "' + nama + '"?\n\nSemua progress/skor murid pada level ini ikut terhapus dan tidak bisa dibatalkan.')) return;
  try {
    showLoad('Menghapus petualangan...');
    await window.HQ.AdminAPI.deleteMazeLevel(id_maze_level);
    hideLoad();
    toast('Petualangan dihapus', 'ok');
    await loadMazeAdmin();
  } catch (err) {
    hideLoad();
    toast('Gagal menghapus: ' + friendlyError(err), 'err');
  }
}

// ═══════════════════════ RATTIL RUN (admin) ═══════════════════════
//  Mirror Kelola Maze; field khas Run (target_soal/kecepatan_awal/kepadatan_rintangan),
//  tanpa monster/peta. Reuse _mazeBadge & MAZE_LEVEL_OPTS.
async function loadRunAdmin() {
  const box = document.getElementById('runLevelListContainer');
  if (box) box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-3);grid-column:1/-1">Memuat level lari...</div>';
  try {
    const [lvRes, qzRes] = await Promise.all([
      window.HQ.AdminAPI.getRunLevelsAdmin(),
      window.HQ.AdminAPI.getQuizListForRun()
    ]);
    const levels = lvRes.data || [];
    _runQuizCache = qzRes.data || [];
    const quizMap = {};
    _runQuizCache.forEach(q => { quizMap[q.id_quiz] = q; });
    if (!box) return;
    if (!levels.length) {
      box.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-3);grid-column:1/-1">Belum ada level lari. Klik "Tambah Level" untuk membuat.</div>';
      return;
    }
    box.innerHTML = levels.map(lv => {
      const q = lv.id_kuis ? quizMap[lv.id_kuis] : null;
      const sumber = lv.id_kuis
        ? (q ? `${svgIcon('link',12)} ${esc(q.judul)} ${_mazeBadge(q.status, q.status==='aktif'?'#16a34a':'#d97706')}`
             : _mazeBadge('quiz tak ditemukan', '#dc2626'))
        : _mazeBadge('Latihan bebas (tanpa quiz)', '#2563eb');
      return `
        <div style="background:var(--card-solid);border:1px solid var(--border);border-radius:var(--r-lg);padding:16px;box-shadow:var(--shadow)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px">
            <div>
              <div style="font-weight:800;color:var(--text);font-size:14.5px;display:flex;align-items:center;gap:6px">${svgIcon('run',14)}${esc(lv.nama_level)}</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:2px">Urutan ${esc(lv.urutan)} · ${esc(lv.tingkat_kesulitan)} · ${svgIcon('target',11)}${esc(lv.target_soal)} soal · ${svgIcon('zap',11)}${esc(lv.kecepatan_awal)}× · rintangan ${esc(lv.kepadatan_rintangan)}×</div>
            </div>
            ${_mazeBadge(lv.aktif?'Aktif':'Nonaktif', lv.aktif?'#16a34a':'#6b7280')}
          </div>
          <div style="font-size:11.5px;color:var(--text-2);margin-bottom:4px">Sumber soal: ${sumber}</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:12px">Audiens: ${(lv.target_levels && lv.target_levels.length) ? esc(lv.target_levels.join(', ')) : 'Semua level'}${lv.rekomendasi_pertemuan_ke ? ' · rekom. pertemuan ke-'+esc(lv.rekomendasi_pertemuan_ke) : ''}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="openRunLevelModal('${escJs(lv.id_run_level)}')" style="flex:1;background:var(--blue-l);color:var(--blue-d);border:none;padding:8px;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:5px">${svgIcon('edit',13)}Edit</button>
            <button onclick="toggleRunAktifAdmin('${escJs(lv.id_run_level)}', ${lv.aktif?'false':'true'})" style="flex:1;background:var(--bg-2);color:var(--text);border:none;padding:8px;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer">${lv.aktif?'Nonaktifkan':'Aktifkan'}</button>
            <button onclick="deleteRunLevelConfirm('${escJs(lv.id_run_level)}','${escJs(lv.nama_level)}')" style="background:#fee2e2;color:#dc2626;border:none;padding:8px 12px;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;display:inline-flex;align-items:center">${svgIcon('delete',13)}</button>
          </div>
        </div>`;
    }).join('');
  } catch (e) {
    if (box) box.innerHTML = `<div style="text-align:center;padding:40px;color:#dc2626;grid-column:1/-1">Gagal memuat: ${esc(friendlyError(e))}</div>`;
  }
}

async function openRunLevelModal(id_run_level) {
  const cont = document.getElementById('adminRunModalContainer');
  if (!cont) return;
  let editing = null;
  try {
    if (id_run_level) {
      showLoad('Memuat level lari...');
      const lv = (await window.HQ.AdminAPI.getRunLevelsAdmin()).data || [];
      editing = lv.find(x => x.id_run_level === id_run_level) || null;
    }
    if (!_runQuizCache.length) {
      _runQuizCache = (await window.HQ.AdminAPI.getQuizListForRun()).data || [];
    }
    hideLoad();
  } catch (e) { hideLoad(); toast('Gagal memuat: ' + friendlyError(e), 'err'); return; }
  if (id_run_level && !editing) { toast('Level tidak ditemukan', 'err'); return; }

  const g = editing || {};
  const kesulitan = g.tingkat_kesulitan || 'mudah';
  const quizOpts = ['<option value="">— Latihan bebas (tanpa quiz) —</option>']
    .concat(_runQuizCache.map(q => `<option value="${esc(q.id_quiz)}" ${g.id_kuis===q.id_quiz?'selected':''}>${esc(q.judul)} (${esc(q.status)})</option>`))
    .join('');

  cont.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px" onclick="if(event.target===this)closeRunModal()">
      <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="font-size:16px;font-weight:800;color:var(--text);display:flex;align-items:center;gap:7px">${svgIcon('run',15)}${editing?'Edit':'Tambah'} Level Lari</h3>
          <button onclick="closeRunModal()" style="background:none;border:none;cursor:pointer;color:var(--text-3);display:flex;align-items:center">${svgIcon('close',18)}</button>
        </div>
        <form onsubmit="submitRunLevel(event, ${editing?`'${escJs(editing.id_run_level)}'`:'null'})">
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">NAMA LEVEL *</label>
            <input id="rnNama" required value="${esc(g.nama_level||'')}" placeholder="Contoh: Petualangan Lari 1 — Dasar" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">URUTAN</label>
              <input id="rnUrutan" type="number" min="0" value="${g.urutan!=null?esc(g.urutan):0}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">KESULITAN</label>
              <select id="rnKesulitan" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
                <option value="mudah" ${kesulitan==='mudah'?'selected':''}>Mudah</option>
                <option value="sedang" ${kesulitan==='sedang'?'selected':''}>Sedang</option>
                <option value="sulit" ${kesulitan==='sulit'?'selected':''}>Sulit</option>
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px">
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">TARGET SOAL (1–20)</label>
              <input id="rnTargetSoal" type="number" min="1" max="20" value="${g.target_soal!=null?esc(g.target_soal):8}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">KECEPATAN (×)</label>
              <input id="rnKecepatan" type="number" min="0.5" max="2" step="0.1" value="${g.kecepatan_awal!=null?esc(g.kecepatan_awal):'1.0'}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
            </div>
            <div>
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">RINTANGAN (×)</label>
              <input id="rnKepadatan" type="number" min="0.5" max="2" step="0.1" value="${g.kepadatan_rintangan!=null?esc(g.kepadatan_rintangan):'1.0'}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
            </div>
          </div>
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">SUMBER SOAL (QUIZ)</label>
            <select id="rnKuis" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">${quizOpts}</select>
            <div style="font-size:10.5px;color:var(--text-3);margin-top:4px;line-height:1.5">Quiz = <b>sumber soal</b> game. Jika <b>Audiens (bawah) diisi</b> → quiz hanya sumber soal, audiens yang menentukan siapa melihat. Jika <b>Audiens kosong</b> → level ikut penugasan quiz. Kosong quiz + kosong audiens = latihan bebas semua murid. (Hanya soal ber-flag <b>Boleh Rattil Run</b> yang tampil.)</div>
          </div>
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px">LEVEL HALAQAH (AUDIENS)</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;background:var(--bg-2);padding:10px;border-radius:var(--r-sm);border:1px solid var(--border)">
              ${MAZE_LEVEL_OPTS.map(function(lv){ return `<label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="rnLevelCheck" value="${esc(lv)}" ${(g.target_levels||[]).indexOf(lv)>=0?'checked':''}> ${esc(lv)}</label>`; }).join('')}
            </div>
            <div style="font-size:10.5px;color:var(--text-3);margin-top:4px;line-height:1.5"><b>Diisi</b> → semua halaqah level itu <b>langsung melihat</b> game; quiz cuma sumber soal. <b>Kosong</b> → ikut penugasan quiz. Untuk latihan bebas, soal ikut disaring ke level ini.</div>
          </div>
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px">REKOMENDASI PERTEMUAN KE- (OPSIONAL)</label>
            <input id="rnPertemuan" type="number" min="1" value="${g.rekomendasi_pertemuan_ke!=null?esc(g.rekomendasi_pertemuan_ke):''}" placeholder="mis. 10" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px">
            <div style="font-size:10.5px;color:var(--text-3);margin-top:4px">Label rekomendasi saja (tidak memblokir), selaras Bank Soal.</div>
          </div>
          <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg-2);padding:11px;border-radius:var(--r-sm);border:1px solid var(--border);margin-bottom:16px">
            <input type="checkbox" id="rnAktif" ${(!editing || g.aktif)?'checked':''}>
            <span>Aktif (tampilkan ke murid)</span>
          </label>
          <div style="display:flex;gap:10px">
            <button type="button" onclick="closeRunModal()" style="flex:1;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer">Batal</button>
            <button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;cursor:pointer">${editing?'Simpan Perubahan':'Simpan Level'}</button>
          </div>
        </form>
      </div>
    </div>`;
}

function closeRunModal() {
  const c = document.getElementById('adminRunModalContainer');
  if (c) c.innerHTML = '';
}

async function submitRunLevel(e, id_run_level) {
  e.preventDefault();
  const nama = document.getElementById('rnNama').value.trim();
  if (!nama) { toast('Nama level wajib diisi', 'err'); return; }
  let target = parseInt(document.getElementById('rnTargetSoal').value);
  if (isNaN(target) || target < 1) target = 1;
  if (target > 20) target = 20;
  let kecepatan = parseFloat(document.getElementById('rnKecepatan').value);
  if (isNaN(kecepatan) || kecepatan <= 0) kecepatan = 1.0;
  let kepadatan = parseFloat(document.getElementById('rnKepadatan').value);
  if (isNaN(kepadatan) || kepadatan <= 0) kepadatan = 1.0;
  const target_levels = Array.from(document.querySelectorAll('.rnLevelCheck:checked')).map(function(cb){ return cb.value; });
  const pertemuanRaw = document.getElementById('rnPertemuan').value;
  const payload = {
    nama_level: nama,
    urutan: parseInt(document.getElementById('rnUrutan').value) || 0,
    tingkat_kesulitan: document.getElementById('rnKesulitan').value,
    target_soal: target,
    kecepatan_awal: kecepatan,
    kepadatan_rintangan: kepadatan,
    id_kuis: document.getElementById('rnKuis').value || null,
    target_levels: target_levels,
    rekomendasi_pertemuan_ke: pertemuanRaw !== '' ? parseInt(pertemuanRaw) : null,
    aktif: document.getElementById('rnAktif').checked
  };
  try {
    showLoad('Menyimpan level lari...');
    if (id_run_level) {
      await window.HQ.AdminAPI.updateRunLevel(id_run_level, payload);
    } else {
      await window.HQ.AdminAPI.createRunLevel(payload);
    }
    hideLoad();
    closeRunModal();
    toast('Level lari tersimpan!', 'ok');
    await loadRunAdmin();
  } catch (err) {
    hideLoad();
    toast('Gagal menyimpan: ' + friendlyError(err), 'err');
  }
}

async function toggleRunAktifAdmin(id_run_level, aktif) {
  try {
    showLoad('Mengubah status...');
    await window.HQ.AdminAPI.setRunLevelAktif(id_run_level, aktif === 'true' || aktif === true);
    hideLoad();
    await loadRunAdmin();
  } catch (err) {
    hideLoad();
    toast('Gagal: ' + friendlyError(err), 'err');
  }
}

async function deleteRunLevelConfirm(id_run_level, nama) {
  if (!confirm('Hapus level lari "' + nama + '"?\n\nSemua progress/skor murid pada level ini ikut terhapus dan tidak bisa dibatalkan.')) return;
  try {
    showLoad('Menghapus level lari...');
    await window.HQ.AdminAPI.deleteRunLevel(id_run_level);
    hideLoad();
    toast('Level lari dihapus', 'ok');
    await loadRunAdmin();
  } catch (err) {
    hideLoad();
    toast('Gagal menghapus: ' + friendlyError(err), 'err');
  }
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Infrastruktur icon SVG bersama (Fase 2 redesain minimalis) ──────────
// Lookup nama semantik -> path SVG (Feather-style, viewBox 24x24), dipakai
// lintas semua modul admin lewat window.svgIcon(). Diisi bertahap: status
// (dipakai toast() di bawah) + aksi umum yg sudah pasti dibutuhkan Fase
// 4-11 (edit/delete/close/add). Tambah entri baru di sini saat fase
// berikutnya menemukan konsep yang belum ada, jangan duplikat di file lain.
var ADMIN_ICON_PATHS = {
  ok:     '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 17.01"/>',
  err:    '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
  warn:   '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info:   '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  edit:   '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  delete: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  close:  '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  add:    '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  // Ditambah bertahap Fase 4 (konten-module.js) -- konsep baru yg ditemukan
  clock:      '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
  bell:       '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  user:       '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  users:      '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  book:       '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  clipboard:  '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  monitor:    '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  help:       '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  zap:        '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  // Ditambah bertahap Fase 5 (guru-module.js)
  eye:        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  lock:       '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  gamepad:    '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><line x1="15" y1="13" x2="15.01" y2="13"/><line x1="18" y1="11" x2="18.01" y2="11"/><rect x="2" y="6" width="20" height="12" rx="2"/>',
  link:       '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  pin:        '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  star:       '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  cloud:      '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  folder:     '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  target:     '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  run:        '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  // Ditambah bertahap Fase 3c (inline <script> admin/index.html)
  calendar:   '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  award:      '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
  graduation: '<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  message:    '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  refresh:    '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  save:       '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
  send:       '<line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>',
  // Ditambah bertahap Fase 6 (pengembangan-pengajar-module.js)
  'bar-chart':'<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
  tool:       '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  settings:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  sprout:     '<path d="M7 20h10"/><path d="M10 20c0-4 2-6 2-6s2 2 2 6"/><path d="M12 14c-3 0-6-2-6-6 4 0 6 2 6 6z"/><path d="M12 14c3 0 6-3 6-7-4 0-6 3-6 7z"/>',
  lightbulb:  '<line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/>',
  mic:        '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>',
  // Ditambah bertahap Fase 6b (temuan scan lanjutan admin/index.html)
  download:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  'trend-up':   '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  'trend-down': '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/>',
  chevron:    '<polyline points="9 18 15 12 9 6"/>',
  move:       '<polyline points="15 10 20 15 15 20"/><path d="M4 4v7a4 4 0 0 0 4 4h12"/>',
  // Ditambah bertahap Fase 7 (murid-module.js)
  play:       '<polygon points="5 3 19 12 5 21 5 3"/>',
  // Ditambah bertahap Fase 8 (spp-keuangan-module.js)
  bank:       '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  undo:       '<polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>',
  // Ditambah saat bug hunt Fase 1-8: dipakai KBA_JENIS_ICON (admin/index.html)
  // utk jenis aktivitas 'Doa-Doa Pilihan' -- sebelumnya menunjuk 'heart' yang
  // belum pernah didefinisikan di sini, jadi svgIcon() mengembalikan '' (kosong).
  heart:      '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>'
};
function svgIcon(name, size) {
  size = size || 16;
  var p = ADMIN_ICON_PATHS[name];
  if (!p) return '';
  return '<svg viewBox="0 0 24 24" width="'+size+'" height="'+size+'" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+p+'</svg>';
}

function toast(msg, type='') {
  const titles = {ok:'Berhasil',err:'Gagal',warn:'Perhatian','':'Info'};
  // Pertahanan: tipe tak dikenal (mis. typo 'error' alih-alih 'err') dulu bikin
  // svgIcon() diam-diam kembalikan '' (icon kosong) + judul salah -- ketahuan
  // saat bug hunt Fase 1-8. Normalisasi ke 'info' di sini supaya typo serupa
  // di masa depan tetap terlihat (bukan hilang tanpa jejak).
  if (type && !(type in titles)) type = 'info';
  const iconEl = document.getElementById('notifIcon');
  iconEl.innerHTML = svgIcon(type||'info', 40);
  iconEl.className = 'notif-icon ' + (type||'info');
  document.getElementById('notifTitle').textContent = titles[type]||'Info';
  document.getElementById('notifMsg').textContent   = msg;
  const btn = document.getElementById('notifBtn');
  btn.className = 'notif-btn '+(type||'info');
  btn.textContent = type==='err'?'Tutup':type==='warn'?'Mengerti':'OK';
  btn.onclick = closeNotif;
  document.getElementById('notifOverlay').classList.add('show');
}
function closeNotif() { document.getElementById('notifOverlay').classList.remove('show'); }

function showLoad(msg='Bismillah...') { document.getElementById('loaderTxt').textContent=msg; document.getElementById('loader').classList.add('show'); }
function hideLoad() { document.getElementById('loader').classList.remove('show'); }
function setBtn(id,dis,txt) { const el=document.getElementById(id); if(!el)return; el.disabled=dis; el.textContent=txt; }

function roleBadge(r) {
  const m={admin:'b-red',guru:'b-green',murid:'b-blue'};
  return `<span class="badge ${m[r]||'b-gray'}">${r}</span>`;
}
function predikatBadge(p) {
  const m={'Mumtaz':'b-green','Jayyid Jiddan':'b-blue','Jayyid':'b-amber','Maqbul':'b-red'};
  return p?`<span class="badge ${m[p]||'b-gray'}">${p}</span>`:'–';
}
function statusRaportBadge(s) {
  const m={draft:'b-amber',published:'b-blue',terkirim:'b-green'};
  return `<span class="badge ${m[s]||'b-gray'}">${s||'–'}</span>`;
}
function nilaiLabel(avg) {
  const n = Number(avg);
  if (!n) return '–';
  if (n>=3.5) return '<span class="badge b-green">Mumtaz</span>';
  if (n>=2.5) return '<span class="badge b-blue">Jayyid Jiddan</span>';
  if (n>=1.5) return '<span class="badge b-amber">Jayyid</span>';
  return '<span class="badge b-red">Maqbul</span>';
}
function nilaiNumLabel(avg) {
  const n = Number(avg);
  if (!n) return '–';
  return `<span style="font-weight:700">${n.toFixed(1)}</span>`;
}
function pctBar(pct) {
  const color = pct>=75?'var(--green)':pct>=50?'var(--amber)':'var(--red)';
  return `<div style="display:flex;align-items:center;gap:6px">
    <div style="flex:1;height:5px;background:var(--border);border-radius:100px;min-width:60px">
      <div style="height:5px;background:${color};border-radius:100px;width:${Math.min(pct,100)}%"></div>
    </div>
    <span style="font-size:11.5px;font-weight:700;color:${color};flex-shrink:0">${pct}%</span>
  </div>`;
}
function fmtDate(d) { if(!d) return '–'; return new Date(d).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'}); }
function esc(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// Ubah error teknis mentah menjadi pesan yang ramah & bisa dimengerti pengguna.
function friendlyError(e) {
  var m = (e && e.message) ? String(e.message) : (typeof e === 'string' ? e : '');
  if (!m) return 'Terjadi kesalahan. Silakan coba lagi.';
  var low = m.toLowerCase();
  if (low.indexOf('failed to fetch') >= 0 || low.indexOf('networkerror') >= 0 ||
      low.indexOf('network request failed') >= 0 || low.indexOf('load failed') >= 0)
    return 'Koneksi bermasalah. Periksa internet Anda lalu coba lagi.';
  if (low.indexOf('jwt') >= 0 || low.indexOf('unauthorized') >= 0 ||
      low.indexOf('not authenticated') >= 0 || low.indexOf('401') >= 0)
    return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
  if (low.indexOf('timeout') >= 0 || low.indexOf('timed out') >= 0)
    return 'Permintaan terlalu lama. Coba lagi sebentar.';
  if (low.indexOf('duplicate key') >= 0 || low.indexOf('unique constraint') >= 0 || low.indexOf('already exists') >= 0)
    return 'Data ini sudah ada (duplikat) — kemungkinan ID/NIS/nama sudah dipakai. Gunakan yang lain.';
  if (low.indexOf('relation') >= 0 || low.indexOf('column') >= 0 || low.indexOf('syntax') >= 0 ||
      low.indexOf('supabase') >= 0 || low.indexOf('pgrst') >= 0 || /[{}<>]/.test(m) || m.length > 120)
    return 'Gagal memuat data. Coba lagi sebentar.';
  return m;
}
// escJs: aman untuk teks yang ditaruh di dalam string ber-kutip-tunggal pada atribut onclick="...".
// esc() TIDAK escape kutip tunggal, sehingga nama ber-apostrof (mis. "Mu'adz") memutus string JS
// dan tombolnya mati. Urutan: entity HTML dulu, lalu escape backslash & kutip tunggal untuk JS.
function escJs(s) { return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\\/g,'\\\\').replace(/'/g,"\\'"); }


// ══════════════════════════════════════════
//  PUSH NOTIFIKASI ADMIN
// ══════════════════════════════════════════
async function loadPushAdmin() {
  try {
    var r = await window.HQ.AdminAPI.getPushStats();
    var d = r.data;
    document.getElementById('pushStatTotal').textContent = d.total;
    document.getElementById('pushStatMurid').textContent = d.murid;
    document.getElementById('pushStatGuru').textContent  = d.guru;
    document.getElementById('pushStatAdmin').textContent = d.admin;
    renderPushLog(d.logs);
  } catch(e) { console.warn('loadPushStats:', e); }
  try {
    var r2 = await window.HQ.AdminAPI.getPushConfig();
    renderPushConfig(r2.data);
  } catch(e) { console.warn('loadPushConfig:', e); }
  loadOnboarding();
  loadPopupNotif();
  // Load halaqah & level untuk dropdown target
  loadPushTargetOptions();
}

  // Export functions to window
  if (typeof window !== "undefined") {
    window.startApp = startApp;
    window.loadMasterData = loadMasterData;
    window.goPage = goPage;
    window.openSB = openSB;
    window.closeSB = closeSB;
    window.refreshPage = refreshPage;
    window.loadDashboard = loadDashboard;
    window.loadObservasi = loadObservasi;
    window.renderObsStats = renderObsStats;
    window.filterObsByGuru = filterObsByGuru;
    window.filterObservasiTable = filterObservasiTable;
    window.lihatObsDetail = lihatObsDetail;
    window.loadAudit = loadAudit;
    window.miniPctBar = miniPctBar;
    window.loadKepatuhan = loadKepatuhan;
    window.loadSaranPage = loadSaranPage;
    window.calculateSaranStats = calculateSaranStats;
    window.filterSaran = filterSaran;
    window.renderSaranTable = renderSaranTable;
    window.showSaranDetail = showSaranDetail;
    window.simpanTanggapanSaran = simpanTanggapanSaran;
    window.loadBankSoalAdmin = loadBankSoalAdmin;
    window.loadMazeAdmin = loadMazeAdmin;
    window.openMazeLevelModal = openMazeLevelModal;
    window.closeMazeModal = closeMazeModal;
    window.submitMazeLevel = submitMazeLevel;
    window.toggleMazeAktifAdmin = toggleMazeAktifAdmin;
    window.deleteMazeLevelConfirm = deleteMazeLevelConfirm;
    window.loadRunAdmin = loadRunAdmin;
    window.openRunLevelModal = openRunLevelModal;
    window.closeRunModal = closeRunModal;
    window.submitRunLevel = submitRunLevel;
    window.toggleRunAktifAdmin = toggleRunAktifAdmin;
    window.deleteRunLevelConfirm = deleteRunLevelConfirm;
    window.onAdminBankSearchInput = onAdminBankSearchInput;
    window.onAdminBankLevelFilterChange = onAdminBankLevelFilterChange;
    window.onAdminBankPertemuanFilterChange = onAdminBankPertemuanFilterChange;
    window.getTipeSoalLabelAdmin = getTipeSoalLabelAdmin;
    window.filterAndRenderAdminBankList = filterAndRenderAdminBankList;
    window.hapusSoalAdmin = hapusSoalAdmin;
    window.openModalEditSoalAdmin = openModalEditSoalAdmin;
    window.closeAdminSoalModal = closeAdminSoalModal;
    window.adminOnTipeSoalChange = adminOnTipeSoalChange;
    window.adminApplyTajwidHighlight = adminApplyTajwidHighlight;
    window.adminUpdateTeksArabPreview = adminUpdateTeksArabPreview;
    window.submitFormEditSoalAdmin = submitFormEditSoalAdmin;
    window.bukaModalImportSoal = bukaModalImportSoal;
    window.downloadTemplateSoal = downloadTemplateSoal;
    window.handleFileSelectSoal = handleFileSelectSoal;
    window.parseCSVSoal = parseCSVSoal;
    window.prosesImportSoal = prosesImportSoal;
    window.populateSel = populateSel;
    window.populatePeriodeSel = populatePeriodeSel;
    window.openModal = openModal;
    window.closeModal = closeModal;
    window.toast = toast;
    window.svgIcon = svgIcon;
    window.closeNotif = closeNotif;
    window.showLoad = showLoad;
    window.hideLoad = hideLoad;
    window.setBtn = setBtn;
    window.roleBadge = roleBadge;
    window.predikatBadge = predikatBadge;
    window.statusRaportBadge = statusRaportBadge;
    window.nilaiLabel = nilaiLabel;
    window.nilaiNumLabel = nilaiNumLabel;
    window.pctBar = pctBar;
    window.fmtDate = fmtDate;
    window.esc = esc;
    window.friendlyError = friendlyError;
    window.escJs = escJs;
    window.loadPushAdmin = loadPushAdmin;
  }
})();
