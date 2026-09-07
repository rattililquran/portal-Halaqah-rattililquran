// ============================================================
//  Portal Admin — SPP, Keuangan, & Kas Module
//  Modularized from admin/index.html
// ============================================================
(function() {
  "use strict";

  // --- SPP, Infaq, Kas Beasiswa & Operasional ---

// ── Metode Bayar (rekening/QRIS) — dikelola lewat modal, dibuka dari tombol
//    kecil di header halaman SPP. Jarang diubah → tak makan tempat sbg kartu.
function bukaKelolaMetode() {
  document.getElementById('modalMetodeKelola').classList.add('open');
  document.body.style.overflow = 'hidden';
  loadMetodeBayarAdmin();
}
function tutupKelolaMetode() {
  document.getElementById('modalMetodeKelola').classList.remove('open');
  document.body.style.overflow = '';
}
async function loadMetodeBayarAdmin() {
  var el = document.getElementById('sppMetodeAdminList');
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:14px;color:var(--text-3);font-size:12px">Memuat…</div>';
  try {
    var r = await window.HQ.AdminAPI.getMetodeBayar();
    var list = r.data || [];
    if (!list.length) {
      el.innerHTML = '<div style="padding:14px;background:var(--bg-2, #f8fafc);border-radius:10px;border:1px dashed var(--border);text-align:center;color:var(--text-3, #94a3b8);font-size:13px">Belum ada metode. Klik "+ Tambah" untuk menambahkan rekening atau QRIS.</div>';
      return;
    }
    el.innerHTML = list.map(function(m) {
      var _mid = escJs(m.id);
      var _safeQr = (m.qris_url && /^https?:\/\//i.test(m.qris_url)) ? m.qris_url : '';
      var detail = m.jenis==='qris'
        ? '<span style="font-size:11px;color:var(--blue-txt, #0369a1);display:inline-flex;align-items:center;gap:4px">'+svgIcon('smartphone',12)+' QRIS ' + (_safeQr?'· <a href="'+esc(_safeQr)+'" target="_blank" rel="noopener noreferrer" style="color:var(--blue-txt, #0369a1)">Lihat QR</a>':'· belum ada gambar') + '</span>'
        : '<span style="font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--text)">'+esc(m.nomor||'—')+'</span><span style="font-size:11px;color:var(--text-2, #64748b);margin-left:8px">a/n '+esc(m.atas_nama||'')+'</span>';
      return '<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--bg-2, #f8fafc);border:1px solid var(--border);border-radius:10px">'
        + '<div style="width:36px;height:36px;background:'+(m.jenis==='qris'?'var(--blue-bg, #e0f2fe)':'var(--green-bg, #f0fdf4)')+';border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:'+(m.jenis==='qris'?'var(--blue-txt, #0369a1)':'var(--green-txt, #1a5c3a)')+'">'+(m.jenis==='qris'?svgIcon('smartphone',18):svgIcon('bank',18))+'</div>'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-size:13px;font-weight:700;color:var(--text)">'+esc(m.bank&&m.bank!==m.nama?m.bank+' · ':'')+esc(m.nama)+'</div>'
        + '<div style="margin-top:2px">'+detail+'</div>'
        + '</div>'
        + '<div style="display:flex;gap:6px;flex-shrink:0">'
        + '<button class="btn btn-outline btn-sm" onclick="editMetode(\''+_mid+'\')">Edit</button>'
        + '<button class="btn btn-sm" style="background:var(--red-bg, #fee2e2);color:var(--red-txt, #991b1b);border:1px solid var(--red-l, #fca5a5);font-size:11px" onclick="hapusMetode(\''+_mid+'\',\''+escJs(m.nama)+'\')">Hapus</button>'
        + '</div></div>';
    }).join('');
  } catch(e) { if (el) el.innerHTML = '<div style="color:var(--red);padding:12px">Gagal: '+esc(friendlyError(e))+'</div>'; }
}


function bukaFormMetode(data) {
  var isEdit = !!data;
  document.getElementById('modalMetodeTitle').textContent = isEdit ? 'Edit Metode Bayar' : 'Tambah Metode Bayar';
  document.getElementById('metodeId').value         = (data && data.id) || '';
  document.getElementById('metodeNama').value       = (data && data.nama) || '';
  document.getElementById('metodeBank').value       = (data && data.bank) || '';
  document.getElementById('metodeNomor').value      = (data && data.nomor) || '';
  document.getElementById('metodeAtasNama').value   = (data && data.atas_nama) || '';
  document.getElementById('metodeAtasNamaQris').value = (data && data.atas_nama) || '';
  document.getElementById('metodeQrisUrl').value    = (data && data.qris_url) || '';
  document.getElementById('metodeUrutan').value     = (data && data.urutan) || 1;
  var jenis = (data && data.jenis) || 'rekening';
  document.getElementById('metodeJenis').value = jenis;
  var tabs = document.querySelectorAll('#metodeJenisTabs > div');
  tabs[0].style.borderColor = jenis==='rekening'?'var(--green, #1a5c3a)':'var(--border)';
  tabs[0].style.background  = jenis==='rekening'?'var(--green-bg, #f0fdf4)':'var(--bg-2, #fff)';
  tabs[0].style.color       = jenis==='rekening'?'var(--green-txt, #1a5c3a)':'var(--text-2)';
  tabs[1].style.borderColor = jenis==='qris'?'var(--blue, #0369a1)':'var(--border)';
  tabs[1].style.background  = jenis==='qris'?'var(--blue-bg, #f0f9ff)':'var(--bg-2, #fff)';
  tabs[1].style.color       = jenis==='qris'?'var(--blue-txt, #0369a1)':'var(--text-2)';
  document.getElementById('metodeRekeningFields').style.display = jenis==='rekening'?'':'none';
  document.getElementById('metodeQrisFields').style.display     = jenis==='qris'?'':'none';
  document.getElementById('modalMetode').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function tutupFormMetode() {
  document.getElementById('modalMetode').classList.remove('open');
  // modal daftar mungkin masih terbuka di belakang → jangan lepas kunci scroll
  var kelola = document.getElementById('modalMetodeKelola');
  if (!(kelola && kelola.classList.contains('open'))) document.body.style.overflow = '';
}
function setMetodeJenis(jenis, el) {
  document.getElementById('metodeJenis').value = jenis;
  var tabs = document.querySelectorAll('#metodeJenisTabs > div');
  tabs[0].style.borderColor = jenis==='rekening'?'var(--green, #1a5c3a)':'var(--border)';
  tabs[0].style.background  = jenis==='rekening'?'var(--green-bg, #f0fdf4)':'var(--bg-2, #fff)';
  tabs[0].style.color       = jenis==='rekening'?'var(--green-txt, #1a5c3a)':'var(--text-2)';
  tabs[1].style.borderColor = jenis==='qris'?'var(--blue, #0369a1)':'var(--border)';
  tabs[1].style.background  = jenis==='qris'?'var(--blue-bg, #f0f9ff)':'var(--bg-2, #fff)';
  tabs[1].style.color       = jenis==='qris'?'var(--blue-txt, #0369a1)':'var(--text-2)';
  document.getElementById('metodeRekeningFields').style.display = jenis==='rekening'?'':'none';
  document.getElementById('metodeQrisFields').style.display     = jenis==='qris'?'':'none';
}
async function editMetode(id) {
  try {
    var r = await window.HQ.AdminAPI.getMetodeBayar();
    var m = (r.data||[]).find(function(x){return String(x.id)===String(id);});
    if (m) bukaFormMetode(m);
    else { toast('Metode tak ditemukan — mungkin sudah dihapus. Muat ulang.', 'warn'); loadMetodeBayarAdmin(); }
  } catch(e) { toast(friendlyError(e),'err'); }
}
async function hapusMetode(id, nama) {
  toast('Hapus "'+nama+'"?', 'warn');
  document.getElementById('notifBtn').textContent = 'Ya, Hapus';
  document.getElementById('notifBtn').onclick = async () => {
    closeNotif();
    showLoad('Bismillah, memproses...');
    try { await window.HQ.AdminAPI.deleteMetodeBayar(id); toast('Dihapus','ok'); loadMetodeBayarAdmin(); }
    catch(e) { toast(friendlyError(e),'err'); }
    finally { hideLoad(); }
  };
}
async function simpanMetode() {
  var jenis = document.getElementById('metodeJenis').value;
  var d = {
    id        : document.getElementById('metodeId').value || undefined,
    nama      : document.getElementById('metodeNama').value.trim(),
    jenis,
    bank      : jenis==='rekening' ? document.getElementById('metodeBank').value.trim() : null,
    nomor     : jenis==='rekening' ? document.getElementById('metodeNomor').value.trim() : null,
    atas_nama : jenis==='rekening' ? document.getElementById('metodeAtasNama').value.trim() : document.getElementById('metodeAtasNamaQris').value.trim(),
    qris_url  : jenis==='qris'     ? document.getElementById('metodeQrisUrl').value.trim() : null,
    urutan    : Number(document.getElementById('metodeUrutan').value)||1,
    aktif     : true,
  };
  if (!d.nama) { showAlertModal('Nama harus diisi', { title: 'Validasi' }); return; }
  try { await window.HQ.AdminAPI.saveMetodeBayar(d); toast('Tersimpan','ok'); tutupFormMetode(); loadMetodeBayarAdmin(); }
  catch(e) { toast(friendlyError(e),'err'); }
}

// ── Kartu bisa diciutkan (.pcard) — default tertutup, ingat pilihan ──
function togglePcard(head) {
  var card = head && head.closest ? head.closest('.pcard') : null;
  if (!card) return;
  var wasCollapsed = card.hasAttribute('data-collapsed');
  card.toggleAttribute('data-collapsed', !wasCollapsed);
  head.setAttribute('aria-expanded', String(wasCollapsed));
  if (card.id) { try { localStorage.setItem('pcard:' + card.id, wasCollapsed ? '1' : '0'); } catch(e) {} }
  if (wasCollapsed) {  // baru dibuka → muat kontennya bila perlu
    var fn = card.getAttribute('data-load');
    if (fn && typeof window[fn] === 'function') window[fn]();
  }
  _syncToggleAllBtn();
}
// Buka / tutup SEMUA kartu sekaligus. Kalau ada yg tertutup → buka semua;
// kalau semua terbuka → tutup semua. Status tetap disimpan per kartu.
function toggleAllSPPCards() {
  var cards = [].slice.call(document.querySelectorAll('#page-spp .pcard[id]'));
  if (!cards.length) return;
  var anyCollapsed = cards.some(function(c){ return c.hasAttribute('data-collapsed'); });
  var collapse = !anyCollapsed;
  cards.forEach(function(card) {
    card.toggleAttribute('data-collapsed', collapse);
    var head = card.querySelector('.pcard-head');
    if (head) head.setAttribute('aria-expanded', String(!collapse));
    if (card.id) { try { localStorage.setItem('pcard:' + card.id, collapse ? '0' : '1'); } catch(e) {} }
    if (!collapse) {
      var fn = card.getAttribute('data-load');
      if (fn && typeof window[fn] === 'function') window[fn]();
    }
  });
  _syncToggleAllBtn();
}
function _syncToggleAllBtn() {
  var btn = document.getElementById('sppToggleAllBtn');
  if (!btn) return;
  var cards = document.querySelectorAll('#page-spp .pcard[id]');
  var allOpen = cards.length > 0 && [].every.call(cards, function(c){ return !c.hasAttribute('data-collapsed'); });
  btn.textContent = allOpen ? 'Tutup semua' : 'Buka semua';
}

// Empty state seragam.
var _SPP_EMPTY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-6l-2-2H5a2 2 0 0 0-2 2z"/><line x1="9" y1="13" x2="15" y2="13"/></svg>';
function _sppEmptyBox(msg) {
  return '<div class="spp-empty">' + _SPP_EMPTY_SVG + '<span>' + esc(msg) + '</span></div>';
}
function _sppEmptyRow(cols, msg) {
  return '<tr><td colspan="' + cols + '"><div class="spp-empty">' + _SPP_EMPTY_SVG + '<span>' + esc(msg) + '</span></div></td></tr>';
}

// Drill-down dari kartu KPI → pindah tab + buka kartu terkait + set filter.
function _sppOpenCard(id) {
  var c = document.getElementById(id);
  if (!c) return;
  if (c.hasAttribute('data-collapsed')) { var h = c.querySelector('.pcard-head'); if (h) togglePcard(h); }
  setTimeout(function(){ c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
}
function sppKpiDrill(target) {
  switch (target) {
    case 'lunas':
    case 'menunggak':
      switchSPPTab('spp');
      _sppSPPView = 'tunggakan';
      try { localStorage.setItem('hq_spp_view', 'tunggakan'); } catch(e) {}
      var st = document.getElementById('sppFilterStatus');
      if (st) st.value = (target === 'lunas' ? 'lunas' : 'menunggak');
      _sppOpenCard('sppRekapCard');
      filterSPPTable();
      break;
    case 'spp-tx':
      switchSPPTab('spp');
      if (!_sppTunggakanDisabled) {
        _sppSPPView = 'transaksi';
        try { localStorage.setItem('hq_spp_view', 'transaksi'); } catch(e) {}
      }
      _sppOpenCard('sppRekapCard');
      filterSPPTable();
      break;
    case 'infaq':
      switchSPPTab('infaq');
      _sppOpenCard('sppRekapCard');
      break;
    case 'ihsan':
      switchSPPTab('kas');
      _sppOpenCard('sppRekapCard');
      break;
    case 'kas':
      switchSPPTab('kas');
      _sppOpenCard('sppArusKasCard');
      break;
  }
}
document.addEventListener('click', function(e) {
  var k = e.target && e.target.closest ? e.target.closest('#page-spp .spp-kpi[data-drill]') : null;
  if (k) sppKpiDrill(k.getAttribute('data-drill'));
});
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  var k = e.target && e.target.closest ? e.target.closest('#page-spp .spp-kpi[data-drill]') : null;
  if (k) { e.preventDefault(); sppKpiDrill(k.getAttribute('data-drill')); }
});

// Pulihkan status ciut tiap kartu di halaman SPP (dipanggil saat masuk halaman).
function _restoreSPPCards() {
  document.querySelectorAll('#page-spp .pcard[id]').forEach(function(card) {
    var open = false;
    try { open = localStorage.getItem('pcard:' + card.id) === '1'; } catch(e) {}
    card.toggleAttribute('data-collapsed', !open);
    var head = card.querySelector('.pcard-head');
    var body = card.querySelector('.pcard-body');
    if (head) {
      head.setAttribute('aria-expanded', String(open));
      if (body) { if (!body.id) body.id = card.id + '-body'; head.setAttribute('aria-controls', body.id); }
    }
    if (open) {
      var fn = card.getAttribute('data-load');
      if (fn && typeof window[fn] === 'function') window[fn]();
    }
  });
  _syncToggleAllBtn();
}

// Batas render tabel Rekap SPP/Infaq/Ihsan -- dipakai bersama ketiga
// sub-tampilan (dropdown "jenis": spp/infaq/ihsan) karena cuma satu yang
// tampil di satu waktu (satu <tbody> yang sama). Direset ke 50 tiap filter
// berubah, TIDAK direset saat "muat lagi" (lihat loadMoreSPP). Perf fix:
// lihat RENCANA_fix_lambat_spp.md.
var _sppRenderLimit = 50;
function loadMoreSPP() {
  _sppRenderLimit += 50;
  filterSPPTable(true); // true = pertahankan limit saat ini, jangan reset ke 50
}

// ══ Fase 3 — Kelola Transaksi (edit / hapus / tandai periode) ══
var _sppListData = [];          // rekap.spp_list (SPP Pribadi per transaksi)
var _sppListFiltered = [];
var _sppSPPView = localStorage.getItem('hq_spp_view') || 'tunggakan';  // 'tunggakan' | 'transaksi' (khusus tab SPP)
var _sppEditCtx = null;         // {jenisKey, row}
var _sppLastRekap = null;       // rekap utama terakhir (utk lazy-load tab Kas)
var _sppKasLoaded = false;      // sudah fetch data Kas/Beasiswa siklus ini?
var _sppRekonLoaded = false;    // sudah fetch Rekonsiliasi siklus ini?
var _sppTunggakanDisabled = false; // "Semua Tahun + Seluruh Periode" → tunggakan mati

function _txPeriodeBadge(idPeriode) {
  if (!idPeriode) return '<span style="font-size:10px;color:var(--amber-txt);font-style:italic">tanpa periode</span>';
  var nm = (typeof allPeriode !== 'undefined' ? allPeriode : []).find(function(p){ return p.id_periode === idPeriode; });
  return '<span class="badge b-purple" style="font-size:9.5px">' + esc(nm ? nm.nama_periode : idPeriode) + '</span>';
}
function _txAksiCell(idSpp, jenisKey) {
  var j = escJs(idSpp);  // arg dlm string JS di dalam atribut onclick → wajib escJs (esc tak escape kutip tunggal)
  return '<div style="display:inline-flex;gap:5px">'
    + '<button class="btn btn-ghost btn-sm" style="padding:3px 7px" title="Edit" onclick="bukaEditSPPRow(\'' + j + '\',\'' + jenisKey + '\')">' + svgIcon('edit',13) + '</button>'
    + '<button class="btn btn-sm" style="padding:3px 7px;background:var(--red-bg,#fee2e2);color:var(--red-txt,#991b1b);border:1px solid rgba(239,68,68,.25)" title="Hapus" onclick="hapusSPPRowLangsung(\'' + j + '\',\'' + jenisKey + '\')">' + svgIcon('delete',13) + '</button>'
    + '</div>';
}
// Baris "muat lagi" — colspan mengikuti jumlah kolom aktual
function _txMoreRow(dataLen, visLen, cols) {
  if (dataLen <= visLen) return '';
  return '<tr><td colspan="' + cols + '" style="text-align:center;padding:14px">'
    + '<button class="btn btn-ghost btn-sm" onclick="loadMoreSPP()">' + svgIcon('download',14)
    + ' Muat ' + Math.min(50, dataLen - visLen) + ' lagi (' + (dataLen - visLen) + ' tersisa)</button></td></tr>';
}

// ── Nilai filter periode & tahun halaman SPP ──
function _sppPeriodeVal() { var el = document.getElementById('sppFilterPeriode'); return el ? el.value : ''; }
function _sppTahunVal()   { var el = document.getElementById('sppFilterTahun');   return el ? el.value : String(new Date().getFullYear()); }
var _sppTab = localStorage.getItem('hq_spp_tab') || 'spp';

// Isi dropdown periode halaman SPP (dipanggil saat masuk halaman).
function populateSPPPeriodeFilter() {
  var sel = document.getElementById('sppFilterPeriode');
  if (!sel) return;
  var saved = localStorage.getItem('hq_spp_periode') || '';
  var opts = '<option value="">Seluruh Periode</option>';
  (typeof allPeriode !== 'undefined' ? allPeriode : []).forEach(function(p) {
    var lbl = p.nama_periode + (p.status === 'aktif' ? ' (Aktif)' : '');
    opts += '<option value="' + esc(p.id_periode) + '">' + esc(lbl) + '</option>';
  });
  opts += '<option value="__tanpa__">— Tanpa Periode —</option>';
  sel.innerHTML = opts;
  if (saved && sel.querySelector('option[value="' + (window.CSS && CSS.escape ? CSS.escape(saved) : saved) + '"]')) sel.value = saved;
  // Sinkronkan tahun tersimpan
  var savedTh = localStorage.getItem('hq_spp_tahun');
  var thSel = document.getElementById('sppFilterTahun');
  if (thSel && savedTh && thSel.querySelector('option[value="' + savedTh + '"]')) thSel.value = savedTh;
  _syncSPPTahunEnabled();
}

// Saat periode spesifik dipilih → tahun jadi "Semua Tahun" & di-disable
// (periode punya rentang tanggalnya sendiri). "Seluruh Periode" → tahun aktif kembali.
function _syncSPPTahunEnabled() {
  var per = _sppPeriodeVal();
  var thSel = document.getElementById('sppFilterTahun');
  if (!thSel) return;
  if (per && per !== '__tanpa__') {
    // Simpan tahun "asli" — JANGAN timpa dgn 'semua' bila fungsi dipanggil
    // ulang saat sudah mode periode (bug: prev jadi 'semua' → tahun ngunci).
    if (thSel.value !== 'semua') thSel.dataset.prev = thSel.value;
    thSel.value = 'semua';
    thSel.disabled = true;
    thSel.style.opacity = '0.55';
  } else {
    thSel.disabled = false;
    thSel.style.opacity = '';
    // Kembali ke "Seluruh Periode" / "Tanpa Periode": pulihkan tahun asli bila
    // sebelumnya sempat dipaksa 'semua' oleh mode periode. Kalau user memang
    // memilih "Semua Tahun" sendiri (dan tak ada prev), biarkan — mode ini
    // kini mendukungnya penuh.
    if (thSel.value === 'semua' && thSel.dataset.prev && thSel.dataset.prev !== 'semua') {
      thSel.value = thSel.dataset.prev;
      delete thSel.dataset.prev;
    }
  }
}

function onSPPPeriodeChange() {
  localStorage.setItem('hq_spp_periode', _sppPeriodeVal());
  _syncSPPTahunEnabled();
  localStorage.setItem('hq_spp_tahun', _sppTahunVal());
  loadSPPAdmin();
}
function onSPPTahunChange() {
  localStorage.setItem('hq_spp_tahun', _sppTahunVal());
  loadSPPAdmin();
}
function sppLihatTanpaPeriode() {
  var sel = document.getElementById('sppFilterPeriode');
  if (sel) { sel.value = '__tanpa__'; }
  if (_sppTab === 'spp') { _sppSPPView = 'transaksi'; localStorage.setItem('hq_spp_view', 'transaksi'); }  // orphan lebih jelas di daftar transaksi
  onSPPPeriodeChange();
}

// Panel Rekonsiliasi — hanya di tab "Kas & Ihsan" + mode "Seluruh Periode".
async function loadRekonsiliasi() {
  var card = document.getElementById('sppRekonsiliasiCard');
  if (!card) return;
  var show = (_sppTab === 'kas' && !_sppPeriodeVal());
  card.style.display = show ? '' : 'none';
  if (!show) return;
  if (_sppRekonLoaded) return;   // lazy — sudah dimuat siklus ini
  _sppRekonLoaded = true;
  var th = _sppTahunVal();
  var body = document.getElementById('sppRekonBody');
  body.innerHTML = '<tr><td colspan="5" class="align-center" style="padding:16px;color:var(--text-3)">Memuat…</td></tr>';
  try {
    var r = await window.HQ.AdminAPI.getRekonsiliasiSPP({ tahun: th });
    var d = r.data || {};
    document.getElementById('sppRekonTahun').textContent = d.semua_tahun ? '(semua tahun)' : ('tahun ' + (d.tahun || th));
    var _rp = function(n){ return 'Rp ' + Math.round(Number(n)||0).toLocaleString('id-ID'); };
    body.innerHTML = (d.metrik || []).map(function(m) {
      var ok = m.cocok;
      var totalKartu = (m.total_kartu !== undefined) ? m.total_kartu : m.total;
      var beda = Math.abs(Number(m.total||0) - Number(totalKartu||0)) >= 1;
      return '<tr>'
        + '<td style="font-weight:600">' + esc(m.label) + '</td>'
        + '<td class="align-right" style="font-variant-numeric:tabular-nums">' + _rp(m.sigma_periode) + '</td>'
        + '<td class="align-right" style="font-variant-numeric:tabular-nums;color:' + (m.tanpa > 0 ? 'var(--amber-txt)' : 'var(--text-3)') + '">' + _rp(m.tanpa) + '</td>'
        + '<td class="align-right" style="font-variant-numeric:tabular-nums;font-weight:700">' + _rp(totalKartu)
          + (beda ? '<br><span style="font-size:9.5px;color:var(--red-txt);font-weight:600">rekon: ' + _rp(m.total) + '</span>' : '') + '</td>'
        + '<td class="align-center">' + (ok
            ? '<span style="color:var(--green-txt);font-weight:800">✓</span>'
            : '<span style="color:var(--red-txt);font-weight:800" title="Σ per periode + Tanpa Periode tidak sama dengan Total di kartu">✗</span>') + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="5" class="align-center" style="padding:16px;color:var(--text-3)">Tak ada data.</td></tr>';
    if (!d.acuan_kartu) {
      body.innerHTML += '<tr><td colspan="5" style="padding:8px 12px;font-size:10.5px;color:var(--amber-txt)">⚠ Acuan kartu gagal dimuat — kolom Cocok? hanya mengecek partisi internal.</td></tr>';
    }
  } catch(e) {
    _sppRekonLoaded = false;  // biar bisa dicoba lagi
    body.innerHTML = '<tr><td colspan="5" style="padding:14px;color:var(--red);font-size:12px">Gagal: ' + esc(friendlyError(e)) + '</td></tr>';
  }
}

// Ganti tab SPP / Infaq / Kas & Ihsan.
//  silent=true → hanya sinkronkan tampilan (dipanggil dari loadSPPAdmin), tak reload.
function switchSPPTab(tab, silent) {
  if (['spp','infaq','kas'].indexOf(tab) < 0) tab = 'spp';
  _sppTab = tab;
  localStorage.setItem('hq_spp_tab', tab);
  document.querySelectorAll('.tab-btn[data-spptab]').forEach(function(b) {
    b.classList.toggle('active', b.getAttribute('data-spptab') === tab);
  });
  document.querySelectorAll('#page-spp [data-spptab]').forEach(function(el) {
    if (el.classList.contains('tab-btn')) return;
    if (el.getAttribute('data-spptab') !== tab) { el.style.display = 'none'; return; }
    // Kartu .stat pakai display:flex inline — jangan dikosongkan (jadi block → layout rusak)
    el.style.display = el.classList.contains('stat') ? 'flex' : '';
  });
  // Jenis tabel Rekap mengikuti tab
  var jenis = tab === 'infaq' ? 'infaq' : (tab === 'kas' ? 'ihsan' : 'spp');
  var jenisEl = document.getElementById('sppFilterJenis');
  if (jenisEl) jenisEl.value = jenis;
  // Kontrol yang cuma relevan utk tab SPP
  var statusEl = document.getElementById('sppFilterStatus');
  var btnSalin = document.getElementById('btnSalinTagihan');
  var viewTog  = document.getElementById('sppViewToggle');
  if (statusEl) statusEl.style.display = (tab === 'spp' && _sppSPPView === 'tunggakan' && !_sppTunggakanDisabled) ? '' : 'none';
  if (btnSalin) btnSalin.style.display = (tab === 'spp' && _sppSPPView === 'tunggakan' && !_sppTunggakanDisabled) ? '' : 'none';
  if (viewTog)  viewTog.style.display  = (tab === 'spp' && !_sppTunggakanDisabled) ? '' : 'none';
  if (viewTog)  viewTog.classList.toggle('btn-primary', tab === 'spp' && _sppSPPView === 'transaksi' && !_sppTunggakanDisabled);

  // Filter Halaqah cuma berlaku di tab SPP (Kas/Operasional/Ihsan tak per-halaqah).
  // Di luar tab SPP → sembunyikan & kosongkan; kalau tadinya terisi, muat ulang
  // supaya kartu Pemasukan/Saldo kembali se-lembaga.
  var hqFilt = document.getElementById('sppFilterHalaqah');
  if (hqFilt) {
    hqFilt.style.display = (tab === 'spp') ? '' : 'none';
    if (tab !== 'spp' && hqFilt.value) {
      hqFilt.value = '';
      _sppKasLoaded = false; _sppRekonLoaded = false;
      if (!silent) return loadSPPAdmin();
    }
  }
  // Lazy-load: data Kas/Beasiswa hanya di-fetch saat tab "Kas & Ihsan" dibuka.
  if (tab === 'kas' && !_sppKasLoaded) {
    _sppKasLoaded = true;
    if (typeof loadKasBeasiswa === 'function') loadKasBeasiswa(_sppLastRekap);
    if (typeof loadArusKas === 'function') loadArusKas();
  }
  if (typeof loadRekonsiliasi === 'function') loadRekonsiliasi();
  if (!silent) filterSPPTable();
}

// Ringkasan GLOBAL (semua periode & tahun) — strip padat di bawah judul,
// TERPISAH dari kartu KPI (yg ikut filter). Angka global TIDAK berubah saat
// filter periode/tahun diganti → cache 20 dtk supaya ganti-filter beruntun
// tak spam query berat (getArusKas 'semua'). `force` utk sesudah input/validasi.
var _sppGlobalTs = 0;
async function loadSPPGlobalStrip(force) {
  var el = document.getElementById('sppGlobalStrip');
  if (!el) return;
  if (!force && el.style.display !== 'none' && (Date.now() - _sppGlobalTs) < 20000) return;
  try {
    var res = await window.HQ.AdminAPI.getRekapGlobal();
    var g = res.data || {};
    var rp = function(n){ return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); };
    var rpShort = function(n){
      n = Math.round(Number(n) || 0); var neg = n < 0 ? '−' : ''; n = Math.abs(n);
      if (n >= 1e9)  return neg + 'Rp ' + (n / 1e9).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' M';
      if (n >= 1e6)  return neg + 'Rp ' + (n / 1e6).toLocaleString('id-ID', { maximumFractionDigits: 1 }) + ' jt';
      if (n >= 1e3)  return neg + 'Rp ' + Math.round(n / 1e3) + ' rb';
      return neg + 'Rp ' + n;
    };
    var cell = function(lbl, val, sub, cls, split){
      return '<div class="gg-cell' + (split ? ' gg-split' : '') + '">'
        + '<div class="gg-lbl">' + lbl + '</div>'
        + '<div class="gg-val' + (cls ? ' ' + cls : '') + '">' + val + '</div>'
        + (sub ? '<div class="gg-sub">' + sub + '</div>' : '')
        + '</div>';
    };
    var totalMurid = (Number(g.murid_non_beasiswa) || 0) + Number(g.beasiswa || 0);
    var sldNeg = Number(g.saldo) < 0;
    el.innerHTML =
      '<div class="gg-hd">'
      +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
      +   '<span class="gg-t">Ringkasan Global</span>'
      +   '<span class="gg-note">semua periode &amp; tahun · ' + totalMurid + ' murid</span>'
      + '</div>'
      + '<div class="gg-body">'
      +   cell('Total Masuk', rp(g.total_masuk), 'SPP ' + rpShort(g.spp) + ' · Infaq ' + rpShort(g.infaq))
      +   cell('Ihsan Guru', rp(g.ihsan), 'gaji guru terbayar')
      +   cell('Saldo (Net)', (sldNeg ? '−' : '') + rp(Math.abs(Number(g.saldo) || 0)), 'setelah ihsan', sldNeg ? 'gg-neg' : 'gg-ok', true)
      +   cell('Lunas', g.lunas, 'dari ' + (Number(g.murid_non_beasiswa) || 0) + ' murid', 'gg-ok')
      +   cell('Menunggak', g.menunggak, 'belum tertagih ' + rpShort(g.belum_tertagih), 'gg-warn')
      +   cell('Beasiswa', g.beasiswa, 'SPP dibebaskan')
      + '</div>';
    el.style.display = 'block';
    _sppGlobalTs = Date.now();
  } catch (e) {
    console.warn('loadSPPGlobalStrip', e);
    el.style.display = 'none';
  }
}

async function loadSPPAdmin() {
  loadSPPGlobalStrip(); // fire-and-forget, tak memblokir render utama
  var periode   = _sppPeriodeVal();          // '' | '<id>' | '__tanpa__'
  var tahun     = _sppTahunVal();            // 'semua' | 'NNNN'
  // Filter halaqah hanya dihormati di tab SPP (di tab lain angka Kas/Ihsan
  // se-lembaga — mencampur 1-halaqah SPP dgn Kas global itu menyesatkan).
  var idHalaqah = (_sppTab === 'spp') ? (document.getElementById('sppFilterHalaqah').value || '') : '';
  // Filter berubah / ada aksi validasi → data turunan wajib di-fetch ulang
  _sppKasLoaded = false;
  _sppRekonLoaded = false;
  _sppRiwayatLoaded = false;
  showLoad('Memuat data SPP...');
  try {
    // Isi dropdown halaqah jika belum
    var hqSel = document.getElementById('sppFilterHalaqah');
    if (hqSel.options.length <= 1) {
      var hqRes = await window.HQ.AdminAPI.getAllHalaqah();
      (hqRes.data||[]).forEach(function(h) {
        var opt = document.createElement('option');
        opt.value = h.id_halaqah; opt.textContent = h.nama_halaqah;
        hqSel.appendChild(opt);
      });
    }

    // ── Load pending (independent) ──
    try {
      var pendingRes = await window.HQ.AdminAPI.getSPPPending();
      var pending  = pendingRes.data || [];
      var pendSec  = document.getElementById('sppPendingSection');
      var pendList = document.getElementById('sppPendingList');
      var pendBadge = document.getElementById('sppPendingBadge');
      if (pendBadge) pendBadge.textContent = pending.length;
      // Tint header amber saat ada antrian → tak terlewat
      if (pendSec) pendSec.classList.toggle('pcard-alert', pending.length > 0);
      if (pending.length) {
        pendSec.style.display = '';
        // Auto-buka HANYA bila user belum pernah set preferensi kartu ini
        // (sekali ditutup/dibuka manual → keputusan user dihormati, tak disimpan di sini).
        var _pendPref = null;
        try { _pendPref = localStorage.getItem('pcard:sppPendingSection'); } catch(e) {}
        if (_pendPref === null) {
          pendSec.removeAttribute('data-collapsed');
          var _pendHead = pendSec.querySelector('.pcard-head');
          if (_pendHead) _pendHead.setAttribute('aria-expanded', 'true');
        }
        pendList.innerHTML = pending.map(function(p) {
          var nominal = p.nominal ? 'Rp '+Number(p.nominal).toLocaleString('id-ID') : '—';
          var jenisTag = p.jenis === 'SPP Pribadi'
            ? '<span class="spp-tag t-green">SPP Pribadi</span>'
            : '<span class="spp-tag t-amber">Infaq</span>';
          var isGateway = p.metode_bayar === 'gateway';
          var bukti = isGateway ? ''
            : (p.bukti_url
                ? '<button type="button" class="spp-link" onclick="openSppLightbox(\''+escJs(p.bukti_url)+'\')">'+svgIcon('link',12)+' Lihat bukti</button>'
                : '<span style="font-size:11px;color:var(--text-3)">Tidak ada bukti</span>');
          var _idj = escJs(p.id_spp);
          var actionBtns = '<div class="spp-pend-acts">'
            + (isGateway ? '<span class="spp-gw-chip">'+svgIcon('zap',12)+' Otomatis via Gateway</span>' : '')
            + (isGateway
                ? '<button class="spp-abtn spp-abtn-ok" onclick="konfirmasiManualGateway(\''+_idj+'\',\''+escJs(p.nama_murid||p.id_murid)+'\',\''+escJs((p.bulan!=='-'?p.bulan+' ':'')+(p.tahun||''))+'\')">'+svgIcon('ok',14)+' Konfirmasi Manual</button>'
                : '<button class="spp-abtn spp-abtn-ok" onclick="validasiSPP(\''+_idj+'\',\'lunas\')">'+svgIcon('ok',14)+' Konfirmasi</button>')
            + '<button class="spp-abtn spp-abtn-no" onclick="validasiSPP(\''+_idj+'\',\'ditolak\')">'+svgIcon('close',14)+' Tolak</button>'
            + '</div>';
          return '<div class="spp-row">'
            + '<div class="spp-row-main">'
            + '<div class="spp-row-name">'+esc(p.nama_murid||p.id_murid)+'</div>'
            + '<div class="spp-row-meta">'+jenisTag
              +'<span>'+esc((p.bulan!=='-'?p.bulan+' ':'')+(p.tahun||''))+'</span>'
              +'<span>·</span><strong>'+nominal+'</strong>'
              +(p.metode_transfer?'<span class="spp-tag">'+esc(p.metode_transfer)+'</span>':'')+'</div>'
            + (p.catatan ? '<div class="spp-row-note">'+esc(p.catatan)+'</div>' : '')
            + (bukti ? '<div style="margin-top:5px">'+bukti+'</div>' : '')
            + '</div>'
            + actionBtns
            + '</div>';
        }).join('');
      } else {
        pendSec.style.display = 'none';
      }
    } catch(ePend) {
      console.error('getSPPPending error:', ePend);
      toast('Gagal memuat pending: '+ePend.message, 'err');
    }

    // ── Load rekap (independent) ──
    try {
      var rekapRes = await window.HQ.AdminAPI.getSPPRekap({
        tahun: tahun, id_periode: periode || undefined, id_halaqah: idHalaqah||undefined
      });
      var rekap = rekapRes.data || {};
      _sppLastRekap = rekap;
      _sppRekapData = rekap.murid_list || [];
      _sppInfaqData = rekap.infaq_list || [];
      _sppIhsanData = rekap.ihsan_list || [];
      _sppListData  = rekap.spp_list || [];
      _sppTunggakanDisabled = !!rekap.tunggakan_disabled;
      // Kombo "Seluruh Periode + Semua Tahun": tunggakan tak bermakna → paksa
      // tampilan "Per pembayaran" & sembunyikan toggle/filter tunggakan.
      if (_sppTunggakanDisabled) _sppSPPView = 'transaksi';

      // Update Dashboard Kinerja SPP Bulanan
      var totalMurid = (rekap.lunas || 0) + (rekap.menunggak || 0);
      var pctLunas = totalMurid > 0 ? Math.round((rekap.lunas || 0) / totalMurid * 100) : 0;
      var totalTunggakanBulan = 0;
      _sppRekapData.forEach(function(m) {
        totalTunggakanBulan += (m.tunggakan || 0);
      });
      var belumTertagih = totalTunggakanBulan * SPP_NOMINAL_BULANAN;

      document.getElementById('sppStatLunas').textContent   = _sppTunggakanDisabled ? '—' : (rekap.lunas || 0);
      document.getElementById('sppStatLunasSub').textContent = _sppTunggakanDisabled ? 'pilih tahun spesifik utk lihat tunggakan' : (pctLunas + '% dari ' + totalMurid + ' murid');
      document.getElementById('sppStatTunggak').textContent  = _sppTunggakanDisabled ? '—' : (rekap.menunggak || 0);
      document.getElementById('sppStatTunggakSub').textContent  = _sppTunggakanDisabled ? 'tunggakan tak dihitung utk "Semua Tahun"' : ('Belum tertagih: Rp ' + belumTertagih.toLocaleString('id-ID'));
      document.getElementById('sppStatTotal').textContent   = 'Rp ' + (rekap.total_nominal||0).toLocaleString('id-ID');
      document.getElementById('sppStatTotalSub').innerHTML = 'Gateway: Rp ' + (rekap.spp_gateway_nominal||0).toLocaleString('id-ID') + ' (' + (rekap.spp_gateway_count||0) + 'x)<br>Manual: Rp ' + (rekap.spp_manual_nominal||0).toLocaleString('id-ID') + ' (' + (rekap.spp_manual_count||0) + 'x)';
      document.getElementById('sppStatInfaq').textContent   = 'Rp ' + (rekap.total_infaq||0).toLocaleString('id-ID');
      document.getElementById('sppStatInfaqSub').innerHTML = 'Gateway: Rp ' + (rekap.infaq_gateway_nominal||0).toLocaleString('id-ID') + ' (' + (rekap.infaq_gateway_count||0) + 'x)<br>Manual: Rp ' + (rekap.infaq_manual_nominal||0).toLocaleString('id-ID') + ' (' + (rekap.infaq_manual_count||0) + 'x)';

      // ── Kartu tab "Kas & Ihsan" — dari keuangan (satu sumber kebenaran) ──
      var keu = rekap.keuangan || { pemasukan:{total:0}, pengeluaran:{ihsan:0,operasional:0,total:0}, saldo:0 };
      var _rp = function(n){ return 'Rp ' + Math.round(Number(n)||0).toLocaleString('id-ID'); };
      var _rpSigned = function(n){ n = Math.round(Number(n)||0); return (n<0 ? '−Rp '+Math.abs(n).toLocaleString('id-ID') : 'Rp '+n.toLocaleString('id-ID')); };
      document.getElementById('sppStatMasuk').textContent   = _rp(keu.pemasukan.total);
      document.getElementById('sppStatMasukSub').innerHTML  = 'SPP ' + _rp(keu.pemasukan.spp) + ' · Infaq ' + _rp(keu.pemasukan.infaq) + (keu.pemasukan.kas_lain ? ' · Kas ' + _rp(keu.pemasukan.kas_lain) : '');
      document.getElementById('sppStatIhsan').textContent   = _rp(keu.pengeluaran.ihsan);
      document.getElementById('sppStatIhsanSub').innerHTML  = 'Pengeluaran total ' + _rp(keu.pengeluaran.total) + (keu.pengeluaran.operasional ? ' (Operasional ' + _rp(keu.pengeluaran.operasional) + ')' : '');
      var netEl = document.getElementById('sppStatNet');
      netEl.textContent = _rpSigned(keu.saldo);
      // Angka netral; merah HANYA bila saldo negatif (isyarat akuntansi)
      netEl.style.color = (keu.saldo < 0) ? 'var(--red-txt)' : '';
      document.getElementById('sppStatNetSub').textContent = 'Pemasukan − Pengeluaran';

      // Ember ketiga + kartu Kas Beasiswa
      document.getElementById('sppStatBeasiswa').textContent = rekap.beasiswa_count || 0;

      // ── Label scope + badge "Tanpa Periode" ──
      var scopeEl = document.getElementById('sppScopeLabel');
      if (scopeEl) {
        var tScope = (tahun === 'semua') ? 'semua tahun' : 'tahun ' + tahun;
        scopeEl.textContent = rekap.periode_nama
          ? (rekap.mode === 'tanpa_periode' ? 'Transaksi belum berperiode · ' + tScope
             : 'Periode: ' + rekap.periode_nama + (rekap.periode_range && rekap.periode_range.mulai ? ' (' + rekap.periode_range.mulai + ' – ' + rekap.periode_range.selesai + ')' : ''))
          : 'Semua periode · ' + tScope;
        scopeEl.style.color = 'var(--text-3)';
      }
      var tpBadge = document.getElementById('sppTanpaPeriodeBadge');
      if (tpBadge) {
        var tpN = rekap.tanpa_periode_count || 0;
        if (tpN > 0 && periode !== '__tanpa__') {
          tpBadge.style.display = ''; tpBadge.textContent = '⚠ ' + tpN + ' transaksi tanpa periode';
        } else { tpBadge.style.display = 'none'; }
      }

      // Kas/Beasiswa/Rekonsiliasi lazy-load — switchSPPTab yang fetch saat tab
      // "Kas & Ihsan" dibuka (hindari 3-4 call sia-sia di tab SPP/Infaq).
      switchSPPTab(_sppTab, true);
      filterSPPTable();
      // Kartu Riwayat sedang terbuka → segarkan (mungkin barusan ada aksi validasi)
      if (document.querySelector('#sppRiwayatCard:not([data-collapsed])')) loadSPPRiwayat(true);
    } catch(eRekap) {
      console.error('getSPPRekap error:', eRekap);
      document.getElementById('sppRekapBody').innerHTML = '<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--red);font-size:12px">Gagal memuat rekap: '+esc(eRekap.message)+'</td></tr>';
    }

  } catch(e) { toast('Gagal: '+e.message,'err'); }
  finally { hideLoad(); }
}

// ── Kas Beasiswa & Operasional ─────────────────────────────
var BULAN_LIST = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
var _kasOpItems = [];

function ensureKasBulanOptions() {
  var sel = document.getElementById('kasBeasiswaBulan');
  if (sel && !sel.options.length) {
    sel.innerHTML = BULAN_LIST.map(function(b){ return '<option value="'+b+'">'+b+'</option>'; }).join('');
    sel.value = BULAN_LIST[new Date().getMonth()];
  }
}

function renderKasRingkasan(rekap) {
  var fmt = function(n){ return 'Rp ' + (Number(n)||0).toLocaleString('id-ID'); };
  document.getElementById('kasInfaq').textContent = fmt(rekap.beasiswa_infaq_bulanan);
  document.getElementById('kasOperasional').textContent = fmt(rekap.beasiswa_operasional);
  var sisa = Number(rekap.beasiswa_sisa)||0;
  var sisaEl = document.getElementById('kasSisa');
  sisaEl.textContent = (sisa < 0 ? '−Rp ' + Math.abs(sisa).toLocaleString('id-ID') : fmt(sisa));
  sisaEl.style.color = sisa < 0 ? 'var(--red-txt)' : '';   // netral; merah hanya bila minus
  document.getElementById('kasBagian').textContent = fmt(rekap.beasiswa_bagian_per_guru);
  var gc = rekap.beasiswa_guru_count || 0;
  document.getElementById('kasBagianSub').textContent = gc ? ('dibagi rata ' + gc + ' guru') : 'belum ada guru beasiswa';
}

function renderKasOperasionalList(items) {
  var wrap = document.getElementById('kasOperasionalList');
  if (!items || !items.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-3);font-size:12px">Belum ada pengeluaran operasional untuk bulan ini.</div>';
    return;
  }
  wrap.innerHTML = items.map(function(it){
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-2,#f8fafc);border:1px solid var(--border);border-radius:8px">'
      + '<div style="min-width:0"><div style="font-size:12px;font-weight:700;color:var(--text)">'+esc(it.keterangan)+'</div>'
      + (it.catatan ? '<div style="font-size:10.5px;color:var(--text-3)">'+esc(it.catatan)+'</div>' : '')
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:8px;flex-shrink:0">'
      + '<span style="font-size:12px;font-weight:800;color:var(--red-txt)">Rp '+(Number(it.nominal)||0).toLocaleString('id-ID')+'</span>'
      + '<button class="btn btn-ghost btn-sm" style="padding:3px 7px" onclick="editOperasional(\''+esc(it.id_operasional)+'\')">'+svgIcon('edit',13)+'</button>'
      + '<button class="btn btn-red btn-sm" style="padding:3px 7px" onclick="hapusOperasionalItem(\''+esc(it.id_operasional)+'\',\''+escJs(it.keterangan)+'\')">'+svgIcon('delete',13)+'</button>'
      + '</div></div>';
  }).join('');
}

async function loadKasBeasiswa(rekapPrefetch) {
  ensureKasBulanOptions();
  var _thRaw = (document.getElementById('sppFilterTahun') && document.getElementById('sppFilterTahun').value) || '';
  var tahun = (_thRaw && _thRaw !== 'semua') ? Number(_thRaw) : new Date().getFullYear();
  var idHalaqah = (document.getElementById('sppFilterHalaqah') && document.getElementById('sppFilterHalaqah').value) || '';
  var bulan = document.getElementById('kasBeasiswaBulan').value;
  try {
    var rekap;
    if (rekapPrefetch && rekapPrefetch.beasiswa_bulan === bulan) {
      rekap = rekapPrefetch;
    } else {
      var rr = await window.HQ.AdminAPI.getSPPRekap({ tahun: tahun, bulan: bulan, id_halaqah: idHalaqah||undefined });
      rekap = rr.data || {};
    }
    renderKasRingkasan(rekap);
    var opRes = await window.HQ.AdminAPI.getOperasional({ tahun: tahun, bulan: bulan });
    _kasOpItems = opRes.data || [];
    renderKasOperasionalList(_kasOpItems);
  } catch(e) { console.error('loadKasBeasiswa', e); }
}

// Isi <select> periode dari allPeriode (pakai helper global populatePeriodeSel).
// selected: id_periode terpilih | '' (Tanpa periode) | undefined (biar aktif terpilih).
function _isiPeriodeSel(selId, selected) {
  if (typeof window.populatePeriodeSel === 'function') window.populatePeriodeSel(selId);
  var el = document.getElementById(selId);
  if (!el) return;
  if (el.options[0] && el.options[0].value === '') el.options[0].textContent = '— Tanpa periode —';
  if (selected !== undefined) el.value = selected || '';
}

function bukaFormOperasional(item) {
  var selB = document.getElementById('opBulan');
  if (!selB.options.length) selB.innerHTML = BULAN_LIST.map(function(b){ return '<option value="'+b+'">'+b+'</option>'; }).join('');
  var selT = document.getElementById('opTahun');
  if (!selT.options.length) {
    var yNow = new Date().getFullYear(); var ys = [];
    for (var y=yNow-1; y<=yNow+1; y++) ys.push('<option value="'+y+'">'+y+'</option>');
    selT.innerHTML = ys.join('');
  }
  document.getElementById('opErr').style.display = 'none';
  if (item) {
    document.getElementById('modalOperasionalTitle').textContent = 'Edit Operasional';
    document.getElementById('opId').value = item.id_operasional;
    selB.value = item.bulan; selT.value = item.tahun;
    document.getElementById('opKeterangan').value = item.keterangan || '';
    document.getElementById('opNominal').value = item.nominal || '';
    document.getElementById('opCatatan').value = item.catatan || '';
    _isiPeriodeSel('opPeriode', item.id_periode || '');
  } else {
    document.getElementById('modalOperasionalTitle').textContent = 'Tambah Operasional';
    document.getElementById('opId').value = '';
    selB.value = (document.getElementById('kasBeasiswaBulan') && document.getElementById('kasBeasiswaBulan').value) || BULAN_LIST[new Date().getMonth()];
    selT.value = (document.getElementById('sppFilterTahun') && document.getElementById('sppFilterTahun').value) || new Date().getFullYear();
    document.getElementById('opKeterangan').value = '';
    document.getElementById('opNominal').value = '';
    document.getElementById('opCatatan').value = '';
    _isiPeriodeSel('opPeriode');
  }
  document.getElementById('modalOperasional').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function tutupFormOperasional() { document.getElementById('modalOperasional').classList.remove('open'); document.body.style.overflow=''; }

function editOperasional(id) {
  var it = (_kasOpItems||[]).find(function(x){ return x.id_operasional === id; });
  if (it) bukaFormOperasional(it);
}

async function simpanOperasional() {
  var id = document.getElementById('opId').value;
  var bulan = document.getElementById('opBulan').value;
  var tahun = document.getElementById('opTahun').value;
  var keterangan = document.getElementById('opKeterangan').value.trim();
  var nominal = document.getElementById('opNominal').value;
  var catatan = document.getElementById('opCatatan').value.trim();
  var id_periode = (document.getElementById('opPeriode') && document.getElementById('opPeriode').value) || null;
  var err = document.getElementById('opErr');
  if (!keterangan) { err.textContent='Keterangan wajib diisi.'; err.style.display=''; return; }
  if (!nominal || Number(nominal) <= 0) { err.textContent='Nominal harus lebih dari 0.'; err.style.display=''; return; }
  try {
    if (id) await window.HQ.AdminAPI.updateOperasional({ id_operasional:id, bulan:bulan, tahun:tahun, keterangan:keterangan, nominal:nominal, catatan:catatan, id_periode:id_periode });
    else    await window.HQ.AdminAPI.tambahOperasional({ bulan:bulan, tahun:tahun, keterangan:keterangan, nominal:nominal, catatan:catatan, id_periode:id_periode });
    tutupFormOperasional();
    toast('Operasional tersimpan','ok');
    var kasSel = document.getElementById('kasBeasiswaBulan'); if (kasSel) kasSel.value = bulan;
    loadKasBeasiswa();
  } catch(e) { err.textContent='Gagal: '+(e.message||e); err.style.display=''; }
}

async function hapusOperasionalItem(id, nama) {
  if (!confirm('Hapus operasional "'+nama+'"?')) return;
  try { await window.HQ.AdminAPI.hapusOperasional(id); toast('Operasional dihapus','ok'); loadKasBeasiswa(); }
  catch(e) { toast('Gagal: '+(e.message||e),'err'); }
}

// ── Buku Kas / Arus Kas (pemasukan & pengeluaran umum) ─────
// Additive: kas umum di tabel `kas`; kategori 'Operasional' (keluar) dirutekan
// ke tabel operasional lama agar perhitungan beasiswa & transparansi murid
// tetap konsisten. getArusKas menggabungkan SPP/Infaq/Ihsan + kas + operasional.
// Kategori kas kini dari tabel kas_kategori (patch_078). DEFAULT dipakai sbg
// fallback bila tabel belum ada (patch belum dijalankan) agar form tak rusak.
// Catatan: 'Honor Guru' sengaja TIDAK ada — honor diinput lewat tombol "Ihsan
// Guru" (melacak per-guru per-bulan); Buku Kas hanya menampilkannya di laporan.
var DEFAULT_KAS_KATEGORI = {
  masuk:  ['Donasi', 'Hibah', 'Saldo Awal', 'Lainnya'],
  keluar: ['Operasional', 'Langganan', 'ATK', 'Lainnya'],
};
var _kasKategoriRows = null; // cache baris kas_kategori; null = belum/ gagal load
var _arusKasRows = [];

async function loadKasKategori(force) {
  if (_kasKategoriRows && !force) return _kasKategoriRows;
  try {
    var r = await window.HQ.AdminAPI.getKasKategori();
    _kasKategoriRows = r.data || [];
  } catch(e) {
    console.warn('kas_kategori belum tersedia — pakai default', e && e.message);
    _kasKategoriRows = null;
  }
  return _kasKategoriRows;
}
function kasKategoriNames(arah) {
  if (_kasKategoriRows) {
    var names = _kasKategoriRows.filter(function(k){ return k.arah === arah; }).map(function(k){ return k.nama; });
    if (names.length) return names;
  }
  return DEFAULT_KAS_KATEGORI[arah] || DEFAULT_KAS_KATEGORI.keluar;
}

function ensureArusKasBulanOptions() {
  // Default rentang = SETAHUN penuh (Jan–Des) supaya angka Buku Kas cocok dgn
  // kartu "Pemasukan/Pengeluaran/Saldo" (yang bersumber getSPPRekap → scope tahun).
  // User bisa persempit ke "Bulan Ini" lewat tombol preset.
  ['arusKasBulanStart','arusKasBulanEnd'].forEach(function(id, i){
    var sel = document.getElementById(id);
    if (sel && !sel.options.length) {
      sel.innerHTML = BULAN_LIST.map(function(b){ return '<option value="'+b+'">'+b+'</option>'; }).join('');
      sel.value = i === 0 ? BULAN_LIST[0] : BULAN_LIST[11];
    }
  });
}
function arusKasPreset(mode) {
  var s = document.getElementById('arusKasBulanStart');
  var e = document.getElementById('arusKasBulanEnd');
  if (!s || !e) return;
  if (mode === 'tahun') { s.value = BULAN_LIST[0]; e.value = BULAN_LIST[11]; }
  else { var now = BULAN_LIST[new Date().getMonth()]; s.value = now; e.value = now; }
  loadArusKas();
}

function renderArusKasBreakdown(containerId, items, arah) {
  var wrap = document.getElementById(containerId);
  if (!wrap) return;
  if (!items || !items.length) {
    wrap.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text-3);font-size:11.5px">Belum ada '+(arah==='masuk'?'pemasukan':'pengeluaran')+'.</div>';
    return;
  }
  var max = items.reduce(function(m,it){ return Math.max(m, Number(it.nominal)||0); }, 0) || 1;
  var barColor = arah==='masuk' ? 'var(--green, #1a5c3a)' : 'var(--red-txt, #b91c1c)';
  var trackBg  = arah==='masuk' ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)';
  wrap.innerHTML = items.map(function(it){
    var n = Number(it.nominal)||0;
    var pct = Math.max(4, Math.round(n / max * 100));
    return '<div style="display:flex;flex-direction:column;gap:3px">'
      + '<div style="display:flex;justify-content:space-between;gap:8px;font-size:11.5px">'
      +   '<span style="color:var(--text-2);font-weight:600">'+esc(it.kategori)+'</span>'
      +   '<span style="color:var(--text);font-weight:800;font-variant-numeric:tabular-nums">Rp '+n.toLocaleString('id-ID')+'</span>'
      + '</div>'
      + '<div style="height:8px;border-radius:5px;background:'+trackBg+';overflow:hidden">'
      +   '<div style="height:100%;width:'+pct+'%;border-radius:5px;background:'+barColor+'"></div>'
      + '</div></div>';
  }).join('');
}

function renderArusKasRiwayat(rows) {
  var wrap = document.getElementById('arusKasRiwayat');
  if (!wrap) return;
  if (!rows || !rows.length) {
    wrap.innerHTML = _sppEmptyBox("Belum ada transaksi pada rentang ini.");
    return;
  }
  var srcLabel = { kas:'Kas', operasional:'Operasional', ihsan:'Honor Guru', spp:'SPP', infaq:'Infaq' };
  wrap.innerHTML = rows.map(function(r){
    var masuk = r.arah === 'masuk';
    var sign = masuk ? '+' : '−';
    var col  = masuk ? 'var(--green-txt)' : 'var(--red-txt)';
    var editable = r.source === 'kas';
    var tgl = r.tanggal ? esc(r.tanggal) : '—';
    var badge = '<span style="font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:6px;background:var(--bg,#f1f5f9);color:var(--text-2)">'+esc(srcLabel[r.source]||r.source)+'</span>';
    return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;background:var(--bg-2,#f8fafc);border:1px solid var(--border);border-radius:9px">'
      + '<div style="flex:1;min-width:0">'
      +   '<div style="font-size:12.5px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+esc(r.keterangan||r.kategori)+'</div>'
      +   '<div style="font-size:10.5px;color:var(--text-3);margin-top:2px;display:flex;gap:6px;align-items:center;flex-wrap:wrap">'+badge+'<span>'+esc(r.kategori)+'</span><span>· '+tgl+'</span>'+(r.penerima?'<span>· '+esc(r.penerima)+'</span>':'')+'</div>'
      + '</div>'
      + '<div style="font-size:12.5px;font-weight:900;color:'+col+';font-variant-numeric:tabular-nums;white-space:nowrap">'+sign+'Rp '+(Number(r.nominal)||0).toLocaleString('id-ID')+'</div>'
      + (editable
          ? '<div style="display:flex;gap:4px;flex-shrink:0">'
            + '<button class="btn btn-ghost btn-sm" style="padding:3px 7px" onclick="editKasItem(\''+esc(r.id)+'\')">'+svgIcon('edit',13)+'</button>'
            + '<button class="btn btn-red btn-sm" style="padding:3px 7px" onclick="hapusKasItem(\''+esc(r.id)+'\',\''+escJs(r.keterangan||r.kategori)+'\')">'+svgIcon('delete',13)+'</button>'
            + '</div>'
          : '')
      + '</div>';
  }).join('');
}

async function loadArusKas() {
  ensureArusKasBulanOptions();
  if (!document.getElementById('arusKasBulanStart')) return;
  var periode = (typeof _sppPeriodeVal === 'function') ? _sppPeriodeVal() : '';
  var thRaw = (document.getElementById('sppFilterTahun') && document.getElementById('sppFilterTahun').value) || String(new Date().getFullYear());
  var isSemuaTh = thRaw === 'semua';
  var tahun = isSemuaTh ? new Date().getFullYear() : Number(thRaw);
  var bulanStart = document.getElementById('arusKasBulanStart').value;
  var bulanEnd   = document.getElementById('arusKasBulanEnd').value;
  // Pemilih bulan Dari/s/d tak relevan di mode periode ATAU "Semua Tahun"
  var perMode = !!(periode && periode !== '__tanpa__');
  var lockBulan = perMode || (isSemuaTh && periode !== '__tanpa__');
  ['arusKasBulanStart','arusKasBulanEnd'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) { el.disabled = lockBulan; el.style.opacity = lockBulan ? '0.5' : ''; }
  });
  try {
    var arg = perMode
      ? { id_periode: periode }
      : periode === '__tanpa__'
        ? { id_periode: '__tanpa__', tahun: isSemuaTh ? 'semua' : tahun }
        : isSemuaTh
          ? { tahun: 'semua' }
          : { tahun: tahun, bulanStart: bulanStart, bulanEnd: bulanEnd };
    var res = await window.HQ.AdminAPI.getArusKas(arg);
    var d = res.data || {};
    _arusKasRows = d.riwayat || [];
    var lbl = document.getElementById('arusKasPeriodeLabel');
    if (lbl) {
      lbl.textContent = d.periode_nama
        ? d.periode_nama
        : ((d.bulan_start === d.bulan_end ? d.bulan_start : d.bulan_start + '–' + d.bulan_end) + ' ' + (d.tahun || tahun));
    }
    var fmt = function(n){ return 'Rp ' + (Number(n)||0).toLocaleString('id-ID'); };
    document.getElementById('arusKasMasuk').textContent  = fmt(d.total_masuk);
    document.getElementById('arusKasKeluar').textContent = fmt(d.total_keluar);
    var saldo = Number(d.saldo)||0;
    var sEl = document.getElementById('arusKasSaldo');
    sEl.textContent = (saldo < 0 ? '−Rp ' + Math.abs(saldo).toLocaleString('id-ID') : fmt(saldo));
    sEl.style.color = saldo < 0 ? 'var(--red-txt)' : '';   // netral; merah hanya bila minus
    renderArusKasBreakdown('arusKasBdMasuk',  d.breakdown_masuk,  'masuk');
    renderArusKasBreakdown('arusKasBdKeluar', d.breakdown_keluar, 'keluar');
    renderArusKasRiwayat(_arusKasRows);
  } catch(e) {
    console.error('loadArusKas', e);
    var w = document.getElementById('arusKasRiwayat');
    if (w) w.innerHTML = '<div style="color:var(--red);padding:12px;font-size:12px">Gagal memuat arus kas: '+esc(friendlyError(e))+'</div>';
  }
}

function fillKasKategoriOptions(arah, selected) {
  var sel = document.getElementById('kasKategori');
  var opts = kasKategoriNames(arah).slice();
  // Pastikan kategori lama (mungkin sudah dihapus) tetap muncul saat edit
  if (selected && opts.indexOf(selected) < 0) opts.unshift(selected);
  sel.innerHTML = opts.map(function(k){ return '<option value="'+esc(k)+'"'+(k===selected?' selected':'')+'>'+esc(k)+'</option>'; }).join('');
}
function updateKasOperasionalHint() {
  var arah = document.getElementById('kasArah').value;
  var kat  = document.getElementById('kasKategori').value;
  var hint = document.getElementById('kasOpHint');
  if (hint) hint.style.display = (arah==='keluar' && kat==='Operasional') ? '' : 'none';
}
function onKasArahChange() {
  var arah = document.getElementById('kasArah').value;
  fillKasKategoriOptions(arah);
  updateKasOperasionalHint();
}
function onKasKategoriChange() { updateKasOperasionalHint(); }

async function bukaFormKas(item) {
  await loadKasKategori();
  document.getElementById('kasErr').style.display = 'none';
  var arah = (item && item.arah) || 'keluar';
  document.getElementById('modalKasTitle').textContent = item ? 'Edit Transaksi Kas' : 'Catat Transaksi Kas';
  document.getElementById('kasId').value        = (item && item.id) || '';
  document.getElementById('kasArah').value       = arah;
  fillKasKategoriOptions(arah, item && item.kategori);
  document.getElementById('kasTanggal').value    = (item && item.tanggal) || new Date().toISOString().slice(0,10);
  document.getElementById('kasNominal').value     = (item && item.nominal) || '';
  document.getElementById('kasKeterangan').value = (item && item.keterangan) || '';
  document.getElementById('kasPenerima').value   = (item && item.penerima) || '';
  document.getElementById('kasMetode').value      = (item && item.metode) || '';
  document.getElementById('kasCatatan').value    = (item && item.catatan) || '';
  _isiPeriodeSel('kasPeriode', item ? (item.id_periode || '') : undefined);
  updateKasOperasionalHint();
  document.getElementById('modalKas').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function tutupFormKas() { document.getElementById('modalKas').classList.remove('open'); document.body.style.overflow=''; }

function editKasItem(id) {
  var it = (_arusKasRows||[]).find(function(x){ return x.source==='kas' && x.id === id; });
  if (it) bukaFormKas(it);
}
async function hapusKasItem(id, nama) {
  if (!confirm('Hapus transaksi kas "'+nama+'"?')) return;
  try { await window.HQ.AdminAPI.hapusKas(id); toast('Transaksi kas dihapus','ok'); loadArusKas(); }
  catch(e) { toast('Gagal: '+(e.message||e),'err'); }
}

async function simpanKas() {
  var id         = document.getElementById('kasId').value;
  var arah       = document.getElementById('kasArah').value;
  var kategori   = document.getElementById('kasKategori').value;
  var tanggal    = document.getElementById('kasTanggal').value;
  var nominal    = document.getElementById('kasNominal').value;
  var keterangan = document.getElementById('kasKeterangan').value.trim();
  var penerima   = document.getElementById('kasPenerima').value.trim();
  var metode     = document.getElementById('kasMetode').value;
  var catatan    = document.getElementById('kasCatatan').value.trim();
  var id_periode = (document.getElementById('kasPeriode') && document.getElementById('kasPeriode').value) || null;
  var err = document.getElementById('kasErr');
  var fail = function(m){ err.textContent = m; err.style.display = ''; };
  if (!tanggal)                       return fail('Tanggal wajib diisi.');
  if (!keterangan)                    return fail('Keterangan wajib diisi.');
  if (!nominal || Number(nominal)<=0) return fail('Nominal harus lebih dari 0.');
  // Edit entri kas TIDAK boleh dipindah ke kategori Operasional (dikelola tabel terpisah)
  if (id && arah==='keluar' && kategori==='Operasional')
    return fail('Kategori Operasional dikelola di kartu "Kas Beasiswa & Operasional". Batalkan, lalu catat di sana.');
  try {
    if (arah==='keluar' && kategori==='Operasional') {
      // Routing: pengeluaran Operasional → tabel operasional lama (baris baru)
      var parts = tanggal.split('-');
      var bulanName = BULAN_LIST[(Number(parts[1])||1) - 1];
      var tahunVal  = Number(parts[0]) || new Date().getFullYear();
      await window.HQ.AdminAPI.tambahOperasional({ bulan: bulanName, tahun: tahunVal, keterangan: keterangan, nominal: nominal, catatan: catatan, id_periode: id_periode });
      if (typeof loadKasBeasiswa === 'function') loadKasBeasiswa();
    } else {
      var payload = { arah: arah, kategori: kategori, tanggal: tanggal, nominal: nominal,
        keterangan: keterangan, penerima: penerima||null, metode: metode||null, catatan: catatan||null, id_periode: id_periode };
      if (id) { payload.id_kas = id; await window.HQ.AdminAPI.updateKas(payload); }
      else    { await window.HQ.AdminAPI.tambahKas(payload); }
    }
    tutupFormKas();
    toast('Transaksi kas tersimpan','ok');
    loadArusKas();
  } catch(e) { fail('Gagal: '+(e.message||e)); }
}

// ── Kelola Kategori Kas (patch_078) ────────────────────────
async function bukaKelolaKategori() {
  document.getElementById('modalKasKategori').classList.add('open');
  document.body.style.overflow = 'hidden';
  var wrapM = document.getElementById('kkList_masuk');
  var wrapK = document.getElementById('kkList_keluar');
  var loadingHtml = '<div style="color:var(--text-3);font-size:12px;padding:8px">Memuat...</div>';
  if (wrapM) wrapM.innerHTML = loadingHtml;
  if (wrapK) wrapK.innerHTML = loadingHtml;
  await loadKasKategori(true);
  renderKelolaKategori();
}
function tutupKelolaKategori() {
  document.getElementById('modalKasKategori').classList.remove('open');
  document.body.style.overflow = '';
  // Segarkan dropdown form kas bila terbuka & selectors di form beasiswa
  if (document.getElementById('kasArah')) fillKasKategoriOptions(document.getElementById('kasArah').value, document.getElementById('kasKategori').value);
}
function renderKelolaKategori() {
  ['masuk','keluar'].forEach(function(arah){
    var wrap = document.getElementById('kkList_'+arah);
    if (!wrap) return;
    var rows = (_kasKategoriRows||[]).filter(function(k){ return k.arah === arah; });
    if (!rows.length) {
      wrap.innerHTML = '<div style="color:var(--text-3);font-size:11.5px;padding:8px">Belum ada (memakai default). Tambah kategori baru di bawah.</div>';
      return;
    }
    wrap.innerHTML = rows.map(function(k){
      var locked = !!k.kunci;
      return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--bg-2,#f8fafc);border:1px solid var(--border);border-radius:8px">'
        + '<span style="flex:1;min-width:0;font-size:12.5px;font-weight:700;color:var(--text)">'+esc(k.nama)+(locked?' <span title="Kategori sistem (terkunci)" style="display:inline-flex;vertical-align:middle;opacity:.6">'+svgIcon('lock',12)+'</span>':'')+'</span>'
        + (locked
            ? '<span style="font-size:10px;color:var(--text-3)">sistem</span>'
            : '<button class="btn btn-ghost btn-sm" style="padding:3px 7px" onclick="renameKategoriKas(\''+escJs(k.id_kk)+'\',\''+escJs(k.nama)+'\')">'+svgIcon('edit',13)+'</button>'
              + '<button class="btn btn-red btn-sm" style="padding:3px 7px" onclick="hapusKategoriKas(\''+escJs(k.id_kk)+'\',\''+escJs(k.nama)+'\')">'+svgIcon('delete',13)+'</button>')
        + '</div>';
    }).join('');
  });
}
async function tambahKategoriKas(arah) {
  var input = document.getElementById('kkInput_'+arah);
  var nama = (input.value||'').trim();
  if (!nama) { input.focus(); return; }
  try {
    await window.HQ.AdminAPI.tambahKasKategori({ arah: arah, nama: nama, urutan: 50 });
    input.value = '';
    await loadKasKategori(true);
    renderKelolaKategori();
    toast('Kategori "'+nama+'" ditambah','ok');
  } catch(e) { toast(friendlyError(e),'err'); }
}
async function renameKategoriKas(id_kk, oldNama) {
  var nama = prompt('Ubah nama kategori:', oldNama);
  if (nama === null) return;
  nama = nama.trim();
  if (!nama || nama === oldNama) return;
  try {
    await window.HQ.AdminAPI.updateKasKategori({ id_kk: id_kk, nama: nama });
    await loadKasKategori(true);
    renderKelolaKategori();
    toast('Kategori diubah','ok');
  } catch(e) { toast(friendlyError(e),'err'); }
}
async function hapusKategoriKas(id_kk, nama) {
  if (!confirm('Hapus kategori "'+nama+'"?\nTransaksi lama yang memakai kategori ini tetap tersimpan.')) return;
  try {
    await window.HQ.AdminAPI.hapusKasKategori(id_kk);
    await loadKasKategori(true);
    renderKelolaKategori();
    toast('Kategori dihapus','ok');
  } catch(e) { toast(friendlyError(e),'err'); }
}

async function toggleTipeSpp(id_anggota, current, nama) {
  var next = current === 'beasiswa' ? 'reguler' : 'beasiswa';
  var label = next === 'beasiswa' ? 'Beasiswa Penuh (SPP Pribadi dibebaskan)' : 'Reguler (SPP Pribadi berbayar)';
  if (!confirm('Ubah tipe SPP ' + nama + ' menjadi:\n' + label + ' ?')) return;
  try {
    await window.HQ.AdminAPI.updateAnggota({ id_anggota: id_anggota, tipe_spp: next });
    var row = (window._anggotaAllRows||[]).find(function(r){ return r.id_anggota === id_anggota; });
    if (row) row.tipe_spp = next;
    renderAnggotaTable();
    toast(nama + ' → ' + label, 'ok');
  } catch(e) { toast('Gagal: ' + (e.message||e), 'err'); }
}

// Pesan WA pengingat SPP -- dibangun HANYA saat tombol WA diklik (bukan
// eager per-baris saat render). Sama persis isinya dgn sebelumnya, cuma
// waktu eksekusinya dipindah. Perf fix: lihat RENCANA_fix_lambat_spp.md.
function sppKirimWAReminder(id_murid) {
  var m = (_sppRekapData || []).find(function(x) { return x.id_murid === id_murid; });
  if (!m || !m.no_hp) return;
  var num = m.no_hp.replace(/\D/g, '');
  if (num.startsWith('0')) num = '62' + num.slice(1);
  else if (!num.startsWith('62')) num = '62' + num;
  var nominal = m.tunggakan * SPP_NOMINAL_BULANAN;
  var msg = 'Assalamualaikum ' + m.nama_murid + ',\n\n'
    + 'Izin Kami ingatkan kembali perihal pembayaran SPP yang belum tertunaikan:\n\n'
    + 'Jumlah : ' + m.tunggakan + ' bulan\n'
    + 'Total : Rp ' + nominal.toLocaleString('id-ID') + '\n\n'
    + 'Cara pembayaran:\n'
    + '1. Buka Portal Rattililqur\'an → menu *SPP* → *Konfirmasi SPP* (info rekening/QRIS terbaru ada di sana)\n'
    + '2. Transfer sesuai nominal, lalu pilih bulan & metode bayar dan upload bukti transfer\n\n'
    + 'Jika ada kendala teknis ataupun finansial, jangan ragu hubungi kami. Semoga Allah mudahkan. Jazakumullahu khairan. 🤲\n\n'
    + '-Data ini direkap otomatis melalui portal Rattililqur\'an, jika ada ketidak cocokan data mohon untuk konfirmasi-';
  window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(msg), '_blank');
}

function filterSPPTable(keepLimit) {
  var jenis = document.getElementById('sppFilterJenis')?.value || 'spp';
  var statusFilter = document.getElementById('sppFilterStatus')?.value || '';
  var bulanFilter = document.getElementById('sppFilterBulan').value;
  var modeLunasBulan = jenis !== 'infaq' && !_sppTunggakanDisabled && !!bulanFilter && statusFilter === 'lunas';

  var sppTxMode = (jenis === 'spp' && (_sppSPPView === 'transaksi' || _sppTunggakanDisabled));

  // Toggle visibilitas kontrol yang hanya relevan untuk SPP Pribadi
  var statusSel = document.getElementById('sppFilterStatus');
  var btnSalin  = document.getElementById('btnSalinTagihan');
  var subtitle  = document.getElementById('sppRekapSubtitle');
  if (statusSel) statusSel.style.display = (jenis === 'infaq' || jenis === 'ihsan' || sppTxMode) ? 'none' : '';
  if (btnSalin)  btnSalin.style.display  = (jenis === 'infaq' || jenis === 'ihsan' || sppTxMode) ? 'none' : '';
  if (subtitle)  subtitle.textContent    = jenis === 'infaq'
    ? 'Daftar pembayaran Infaq/Operasional yang sudah lunas'
    : jenis === 'ihsan'
      ? 'Daftar pembayaran Ihsan Guru (Gaji)'
      : sppTxMode
        ? 'Daftar transaksi SPP Pribadi per pembayaran' + (_sppTunggakanDisabled ? ' (semua tahun)' : '')
      : modeLunasBulan
        ? 'Murid yang sudah membayar SPP Pribadi ' + bulanFilter
        : 'Rekap tunggakan SPP Pribadi per bulan';

  // (sppTxMode dihitung di atas)
  // Bar tandai periode massal + info baris (mode transaksi / infaq / ihsan)
  _updateSPPBulkBar(jenis, sppTxMode);

  // Ganti header tabel sesuai jenis
  var thead = document.getElementById('sppRekapHead');
  thead.innerHTML = jenis === 'infaq'
    ? '<tr><th>Nama Murid</th><th>Halaqah</th><th>Bulan/Thn</th><th>Periode</th><th class="align-right">Nominal</th><th class="align-center">Aksi</th></tr>'
    : jenis === 'ihsan'
      ? '<tr><th>Nama Guru</th><th>Status</th><th>Bulan/Thn</th><th>Periode</th><th class="align-right">Nominal / Ket.</th><th class="align-center">Aksi</th></tr>'
      : sppTxMode
        ? '<tr><th>Nama Murid</th><th>Halaqah</th><th>Bulan/Thn</th><th>Periode</th><th class="align-right">Nominal</th><th class="align-center">Aksi</th></tr>'
      : modeLunasBulan
        ? '<tr><th>Nama Murid</th><th>Halaqah</th><th class="align-center">Tunggakan</th><th>Status ' + bulanFilter + '</th><th class="align-center">Reminder</th></tr>'
        : '<tr><th>Nama Murid</th><th>Halaqah</th><th class="align-center">Tunggakan</th><th>Bulan Belum Lunas</th><th class="align-center">Reminder</th></tr>';

  if (jenis === 'infaq') return filterInfaqTable(keepLimit);
  if (jenis === 'ihsan') return filterIhsanTable(keepLimit);
  if (sppTxMode) return _renderSPPTxTable(keepLimit);
  if (!keepLimit) _sppRenderLimit = 50;

  var searchVal   = (document.getElementById('sppSearchInput')?.value || '').toLowerCase().trim();
  var tbody = document.getElementById('sppRekapBody');

  var data = _sppRekapData;

  // Kombinasi "Bulan" + "Lunas" → tampilkan murid yang SUDAH membayar
  // bulan tersebut (bukan "tunggakan 0 secara keseluruhan").
  if (modeLunasBulan) {
    data = data.filter(function(m) {
      return (m.lunas_bulan||[]).includes(bulanFilter);
    });
  } else {
    // 1. Filter bulan (default: murid yang PUNYA tunggakan & BELUM bayar bulan tsb).
    //    Pakai lunas_bulan langsung — bukan bulan_belum — supaya murid yg belum
    //    pernah bayar sama sekali (bulan_belum kosong) tetap ikut tersaring.
    if (bulanFilter) {
      data = data.filter(function(m) {
        return m.tunggakan > 0 && !(m.lunas_bulan || []).includes(bulanFilter);
      });
    }

    // 2. Filter status pembayaran
    if (statusFilter) {
      if (statusFilter === 'lunas') {
        data = data.filter(function(m) { return m.tunggakan === 0; });
      } else if (statusFilter === 'menunggak') {
        data = data.filter(function(m) { return m.tunggakan > 0; });
      } else if (statusFilter === 'tunggakan_berat') {
        data = data.filter(function(m) { return m.tunggakan >= 3; });
      }
    }
  }

  // 3. Filter pencarian teks (Nama, NIS, Halaqah, Level)
  if (searchVal) {
    data = data.filter(function(m) {
      var namaMatch  = (m.nama_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var idMatch    = (m.id_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var halaqahMatch = (m.nama_halaqah || m.id_halaqah || '').toLowerCase().indexOf(searchVal) !== -1;
      var levelMatch = (m.level || '').toLowerCase().indexOf(searchVal) !== -1;
      return namaMatch || idMatch || halaqahMatch || levelMatch;
    });
  }

  // Simpan data terfilter ke variabel global untuk proses ekspor
  _sppRekapDataFiltered = data;

  if (!data.length) {
    tbody.innerHTML = _sppEmptyRow(5, "Belum ada data untuk filter ini.");
    return;
  }

  var visibleRows = data.slice(0, _sppRenderLimit);
  tbody.innerHTML = visibleRows.map(function(m) {
    var badgeClass = m.tunggakan===0
      ? 'badge b-green'
      : m.tunggakan>=3
      ? 'badge b-red'
      : 'badge b-amber';
    var bulanBelum;
    if (modeLunasBulan) {
      bulanBelum = '<span class="badge b-green" style="display:inline-flex;align-items:center;gap:3px">'+svgIcon('ok',11)+' Lunas '+esc(bulanFilter)+'</span>';
    } else if (m.tunggakan === 0) {
      bulanBelum = '<span class="badge b-green" style="display:inline-flex;align-items:center;gap:3px">'+svgIcon('ok',11)+' Lunas</span>';
    } else {
      // bulan_belum dipensiunkan (2ae457f) — tampilan tunggakan SELALU count-based.
      bulanBelum = '<span class="tag-spp-belum">'+m.tunggakan+' bulan belum lunas</span>';
    }
    var waLink = (m.no_hp && m.tunggakan > 0)
      ? '<button onclick="sppKirimWAReminder(\''+esc(m.id_murid)+'\')" style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;background:#25D366;color:#fff;border:none;border-radius:8px;font-size:10.5px;font-weight:700;cursor:pointer">'+svgIcon('message',12)+' WA</button>'
      : '';
    return '<tr>'
      + '<td><div style="font-size:13px;font-weight:700;color:var(--text)">'+esc(m.nama_murid)+'</div>'
      + '<div style="font-size:11px;color:var(--text-3)">'+esc(m.id_murid)+' · '+esc(m.level||'')+'</div></td>'
      + '<td><div style="font-weight:600;color:var(--text-2)">'+esc(m.nama_halaqah||m.id_halaqah||'—')+'</div></td>'
      + '<td class="align-center"><span class="'+badgeClass+'" style="min-width:28px;justify-content:center">'+m.tunggakan+'</span></td>'
      + '<td>'+bulanBelum+'</td>'
      + '<td class="align-center">'+waLink+'</td>'
      + '</tr>';
  }).join('');
  if (data.length > visibleRows.length) {
    tbody.innerHTML += '<tr><td colspan="5" style="text-align:center;padding:14px">'
      + '<button class="btn btn-ghost btn-sm" onclick="loadMoreSPP()">'
      + svgIcon('download',14) + ' Muat ' + Math.min(50, data.length - visibleRows.length) + ' lagi ('
      + (data.length - visibleRows.length) + ' tersisa)</button></td></tr>';
  }
}

// Debounce khusus kotak cari (oninput, per-keystroke) -- dropdown filter
// (jenis/status/bulan, onchange) tetap panggil filterSPPTable() langsung,
// tak perlu didebounce. Perf fix: lihat RENCANA_fix_lambat_spp.md.
var _sppSearchTimer = null;
function filterSPPTableDebounced() {
  clearTimeout(_sppSearchTimer);
  _sppSearchTimer = setTimeout(function(){ filterSPPTable(); }, 220);
}

function filterInfaqTable(keepLimit) {
  var searchVal = (document.getElementById('sppSearchInput')?.value || '').toLowerCase().trim();
  var bulanFilter = document.getElementById('sppFilterBulan').value;
  var tbody = document.getElementById('sppRekapBody');

  var data = _sppInfaqData;

  // Filter bulan
  if (bulanFilter) {
    data = data.filter(function(r) { return r.bulan === bulanFilter; });
  }

  // Filter pencarian teks (Nama, NIS, Halaqah, Level)
  if (searchVal) {
    data = data.filter(function(r) {
      var namaMatch  = (r.nama_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var idMatch    = (r.id_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var halaqahMatch = (r.nama_halaqah || r.id_halaqah || '').toLowerCase().indexOf(searchVal) !== -1;
      var levelMatch = (r.level || '').toLowerCase().indexOf(searchVal) !== -1;
      return namaMatch || idMatch || halaqahMatch || levelMatch;
    });
  }

  _sppInfaqDataFiltered = data;
  if (!keepLimit) _sppRenderLimit = 50;

  if (!data.length) {
    tbody.innerHTML = _sppEmptyRow(6, "Belum ada transaksi Infaq pada filter ini.");
    return;
  }

  var visibleRows = data.slice(0, _sppRenderLimit);
  tbody.innerHTML = visibleRows.map(function(r) {
    var metodeBadge = r.metode_bayar === 'gateway'
      ? '<span style="background:linear-gradient(135deg,#e0f2fe,#bae6fd);color:#0369a1;padding:1px 7px;border-radius:6px;font-size:10px;font-weight:700;display:inline-flex;align-items:center;gap:3px">'+svgIcon('zap',10)+' Gateway</span>'
      : '<span style="background:var(--bg, #f1f5f9);color:var(--text-2, #64748b);padding:1px 7px;border-radius:6px;font-size:10px;font-weight:700">Manual</span>';
    return '<tr>'
      + '<td><div style="font-size:13px;font-weight:700;color:var(--text)">'+esc(r.nama_murid)+'</div>'
      + '<div style="font-size:11px;color:var(--text-3)">'+esc(r.id_murid)+' · '+esc(r.level||'')+'</div></td>'
      + '<td><div style="font-weight:600;color:var(--text-2)">'+esc(r.nama_halaqah||r.id_halaqah||'—')+'</div></td>'
      + '<td>'+esc(r.bulan||'')+' '+esc(String(r.tahun||''))+'<br><span style="font-size:10px;color:var(--text-3)">'+esc(r.tanggal_bayar||'—')+'</span></td>'
      + '<td>'+_txPeriodeBadge(r.id_periode)+'</td>'
      + '<td class="align-right"><strong>Rp '+Number(r.nominal||0).toLocaleString('id-ID')+'</strong><br>'+metodeBadge+'</td>'
      + '<td class="align-center">'+_txAksiCell(r.id_spp,'infaq')+'</td>'
      + '</tr>';
  }).join('');
  tbody.innerHTML += _txMoreRow(data.length, visibleRows.length, 6);
}

function filterIhsanTable(keepLimit) {
  var searchVal = (document.getElementById('sppSearchInput')?.value || '').toLowerCase().trim();
  var bulanFilter = document.getElementById('sppFilterBulan').value;
  var tbody = document.getElementById('sppRekapBody');

  var data = _sppIhsanData;

  // Filter bulan
  if (bulanFilter) {
    data = data.filter(function(r) { return r.bulan === bulanFilter; });
  }

  // Filter pencarian teks (Nama Guru, ID Guru, Catatan)
  if (searchVal) {
    data = data.filter(function(r) {
      var namaMatch  = (r.nama_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var idMatch    = (r.id_murid || '').toLowerCase().indexOf(searchVal) !== -1;
      var catatanMatch = (r.catatan || '').toLowerCase().indexOf(searchVal) !== -1;
      return namaMatch || idMatch || catatanMatch;
    });
  }

  _sppIhsanDataFiltered = data;
  if (!keepLimit) _sppRenderLimit = 50;

  if (!data.length) {
    tbody.innerHTML = _sppEmptyRow(6, "Belum ada pembayaran Ihsan Guru pada filter ini.");
    return;
  }

  var visibleRows = data.slice(0, _sppRenderLimit);
  tbody.innerHTML = visibleRows.map(function(r) {
    var stBadge = r.status === 'menunggu' ? '<span class="badge b-amber" style="font-size:10.5px">Menunggu</span>'
      : r.status === 'ditolak' ? '<span class="badge b-gray" style="font-size:10.5px">Ditolak</span>'
      : '<span class="badge b-green" style="font-size:10.5px">Lunas</span>';
    return '<tr>'
      + '<td><div style="font-size:13px;font-weight:700;color:var(--text)">'+esc(r.nama_murid)+'</div>'
      + '<div style="font-size:11px;color:var(--text-3)">'+esc(r.id_murid)+' · Guru</div></td>'
      + '<td>'+stBadge+'</td>'
      + '<td>'+esc(r.bulan||'')+' '+esc(String(r.tahun||''))+'<br><span style="font-size:10px;color:var(--text-3)">'+esc(r.tanggal_bayar||'—')+'</span></td>'
      + '<td>'+_txPeriodeBadge(r.id_periode)+'</td>'
      + '<td class="align-right"><strong>Rp '+Number(r.nominal||0).toLocaleString('id-ID')+'</strong><br><span style="font-size:10.5px;color:var(--text-3)">'+esc(r.catatan||'Gaji Guru')+'</span></td>'
      + '<td class="align-center">'+_txAksiCell(r.id_spp,'ihsan')+'</td>'
      + '</tr>';
  }).join('');
  tbody.innerHTML += _txMoreRow(data.length, visibleRows.length, 6);
}

// Tabel SPP Pribadi per transaksi (mode "Per pembayaran" di tab SPP)
function _renderSPPTxTable(keepLimit) {
  var searchVal = (document.getElementById('sppSearchInput')?.value || '').toLowerCase().trim();
  var bulanFilter = document.getElementById('sppFilterBulan').value;
  var tbody = document.getElementById('sppRekapBody');
  var data = (_sppListData || []).slice();
  if (bulanFilter) data = data.filter(function(r){ return r.bulan === bulanFilter; });
  if (searchVal) data = data.filter(function(r){
    return (r.nama_murid||'').toLowerCase().indexOf(searchVal) !== -1
      || (r.id_murid||'').toLowerCase().indexOf(searchVal) !== -1
      || (r.nama_halaqah||r.id_halaqah||'').toLowerCase().indexOf(searchVal) !== -1;
  });
  _sppListFiltered = data;
  if (!keepLimit) _sppRenderLimit = 50;
  if (!data.length) { tbody.innerHTML = _sppEmptyRow(6, "Belum ada transaksi SPP pada filter ini."); return; }
  var vis = data.slice(0, _sppRenderLimit);
  tbody.innerHTML = vis.map(function(r) {
    return '<tr>'
      + '<td><div style="font-size:13px;font-weight:700;color:var(--text)">'+esc(r.nama_murid)+'</div>'
      + '<div style="font-size:11px;color:var(--text-3)">'+esc(r.id_murid)+'</div></td>'
      + '<td><div style="font-weight:600;color:var(--text-2)">'+esc(r.nama_halaqah||r.id_halaqah||'—')+'</div></td>'
      + '<td>'+esc(r.bulan||'')+' '+esc(String(r.tahun||''))+'<br><span style="font-size:10px;color:var(--text-3)">'+esc(r.tanggal_bayar||'—')+'</span></td>'
      + '<td>'+_txPeriodeBadge(r.id_periode)+'</td>'
      + '<td class="align-right"><strong>Rp '+Number(r.nominal||0).toLocaleString('id-ID')+'</strong></td>'
      + '<td class="align-center">'+_txAksiCell(r.id_spp,'spp')+'</td>'
      + '</tr>';
  }).join('');
  tbody.innerHTML += _txMoreRow(data.length, vis.length, 6);
}

// Isi <select> periode untuk bar bulk + modal edit.
function _isiSPPBulkPeriodeSel(selId, includeFromHalaqah, selected) {
  var sel = document.getElementById(selId);
  if (!sel) return;
  var opts = '<option value="">— Tanpa periode —</option>';
  if (includeFromHalaqah) opts += '<option value="from_halaqah">Ikut periode halaqah (otomatis)</option>';
  (typeof allPeriode !== 'undefined' ? allPeriode : []).forEach(function(p) {
    opts += '<option value="' + esc(p.id_periode) + '">' + esc(p.nama_periode) + (p.status === 'aktif' ? ' (Aktif)' : '') + '</option>';
  });
  sel.innerHTML = opts;
  if (selected !== undefined) sel.value = selected || '';
}

// Perbarui bar "tandai periode massal" + jumlah baris tampil.
function _updateSPPBulkBar(jenis, sppTxMode) {
  var bar = document.getElementById('sppBulkPeriodeBar');
  if (!bar) return;
  var show = (jenis === 'infaq' || jenis === 'ihsan' || sppTxMode);
  bar.style.display = show ? 'flex' : 'none';
  if (!show) return;
  // Repopulasi tiap kali — opsi "Ikut periode halaqah" hanya relevan utk
  // SPP/Infaq (bkn Ihsan). Pertahankan pilihan yg sedang dipilih.
  var _bs = document.getElementById('sppBulkPeriodeSel');
  _isiSPPBulkPeriodeSel('sppBulkPeriodeSel', jenis !== 'ihsan', _bs ? _bs.value : undefined);
  // info diisi setelah render (filter*Table mengisi _spp*Filtered) — pakai timeout mikro
  setTimeout(function() {
    var arr = jenis === 'infaq' ? _sppInfaqDataFiltered
            : jenis === 'ihsan' ? _sppIhsanDataFiltered
            : _sppListFiltered;
    var n = (arr || []).length;
    var el = document.getElementById('sppBulkPeriodeInfo');
    if (el) el.textContent = n + ' transaksi tampil';
  }, 0);
}

function _sppBulkJenisKey() {
  var j = document.getElementById('sppFilterJenis')?.value || 'spp';
  return j === 'infaq' ? 'infaq' : (j === 'ihsan' ? 'ihsan' : 'spp');
}

async function sppBulkSetPeriode() {
  var key = _sppBulkJenisKey();
  var arr = key === 'infaq' ? _sppInfaqDataFiltered : (key === 'ihsan' ? _sppIhsanDataFiltered : _sppListFiltered);
  var ids = (arr || []).map(function(r){ return r.id_spp; }).filter(Boolean);
  if (!ids.length) { toast('Tidak ada transaksi tampil.', 'warn'); return; }
  var sel = document.getElementById('sppBulkPeriodeSel');
  var idPer = sel.value;
  var label = idPer === '' ? 'Tanpa periode' : (idPer === 'from_halaqah' ? 'periode halaqah masing-masing' : (sel.options[sel.selectedIndex].text));
  if (!confirm('Tandai ' + ids.length + ' transaksi (' + key.toUpperCase() + ') → ' + label + '?')) return;
  showLoad('Menandai periode...');
  try {
    var r = await window.HQ.AdminAPI.bulkAssignPeriode({ table: 'spp_pembayaran', ids: ids, id_periode: idPer });
    toast((r.updated || ids.length) + ' transaksi ditandai', 'ok');
    loadSPPAdmin();
  } catch(e) { toast('Gagal: ' + friendlyError(e), 'err'); }
  finally { hideLoad(); }
}

function toggleSPPView() {
  if (_sppTunggakanDisabled) return;  // "Semua Tahun": hanya mode transaksi
  _sppSPPView = (_sppSPPView === 'transaksi') ? 'tunggakan' : 'transaksi';
  localStorage.setItem('hq_spp_view', _sppSPPView);
  var btn = document.getElementById('sppViewToggle');
  if (btn) btn.classList.toggle('btn-primary', _sppSPPView === 'transaksi');
  filterSPPTable();
}

// ── Modal Edit Transaksi ──
function bukaEditSPPRow(idSpp, jenisKey) {
  var arr = jenisKey === 'infaq' ? _sppInfaqData : (jenisKey === 'ihsan' ? _sppIhsanData : _sppListData);
  var row = (arr || []).find(function(r){ return r.id_spp === idSpp; });
  if (!row) { toast('Baris tak ditemukan, muat ulang halaman.', 'err'); return; }
  _sppEditCtx = { jenisKey: jenisKey, row: row };
  document.getElementById('esrErr').style.display = 'none';
  document.getElementById('esrId').value = idSpp;
  var _isGw = row.metode_bayar === 'gateway';
  document.getElementById('esrMurid').innerHTML = esc((jenisKey === 'ihsan' ? 'Guru: ' : 'Murid: ') + (row.nama_murid || row.id_murid)
    + (row.nama_halaqah ? ' · ' + row.nama_halaqah : ''))
    + (_isGw ? '<div style="margin-top:6px;color:var(--red-txt);font-weight:700;display:flex;gap:5px;align-items:flex-start">'
        + svgIcon('warn',13) + '<span>Transaksi <b>Gateway (Mayar)</b>. Mengubah/menghapus di sini TIDAK menyesuaikan data di Mayar — rekonsiliasi jadi tanggung jawab Anda.</span></div>' : '');
  document.getElementById('esrJenis').value = jenisKey === 'infaq' ? 'Infaq/Operasional' : (jenisKey === 'ihsan' ? 'Ihsan Guru' : 'SPP Pribadi');
  document.getElementById('esrStatus').value = row.status || 'lunas';
  document.getElementById('esrBulan').value = row.bulan || '-';
  document.getElementById('esrTahun').value = row.tahun || new Date().getFullYear();
  document.getElementById('esrNominal').value = row.nominal || 0;
  document.getElementById('esrTanggal').value = row.tanggal_bayar || '';
  document.getElementById('esrCatatan').value = row.catatan || '';
  _isiSPPBulkPeriodeSel('esrPeriode', jenisKey !== 'ihsan', row.id_periode || '');
  openModal('modalEditSPPRow');
}
function tutupEditSPPRow() { closeModal('modalEditSPPRow'); _sppEditCtx = null; }

async function simpanEditSPPRow() {
  var id = document.getElementById('esrId').value;
  var err = document.getElementById('esrErr');
  var nominal = Number(document.getElementById('esrNominal').value);
  if (!(nominal >= 0)) { err.textContent = 'Nominal tak boleh negatif.'; err.style.display = ''; return; }
  var fields = {
    jenis: document.getElementById('esrJenis').value,
    status: document.getElementById('esrStatus').value,
    bulan: document.getElementById('esrBulan').value,
    tahun: Number(document.getElementById('esrTahun').value),
    nominal: nominal,
    tanggal_bayar: document.getElementById('esrTanggal').value || null,
    catatan: document.getElementById('esrCatatan').value.trim() || null,
    id_periode: document.getElementById('esrPeriode').value,
  };
  var btn = document.getElementById('esrSaveBtn');
  btn.disabled = true;
  showLoad('Menyimpan...');
  try {
    await window.HQ.AdminAPI.updateSPPRow(id, fields);
    toast('Transaksi diperbarui', 'ok');
    tutupEditSPPRow();
    loadSPPAdmin();
  } catch(e) {
    err.textContent = 'Gagal: ' + friendlyError(e); err.style.display = '';
  } finally { btn.disabled = false; hideLoad(); }
}

// Hapus dari dalam modal edit
function hapusSPPRow() {
  var id = document.getElementById('esrId').value;
  if (id) _hapusSPPRowInti(id, _sppEditCtx && _sppEditCtx.row);
}
// Hapus dari tombol di baris tabel
function hapusSPPRowLangsung(idSpp, jenisKey) {
  var arr = jenisKey === 'infaq' ? _sppInfaqData : (jenisKey === 'ihsan' ? _sppIhsanData : _sppListData);
  var row = (arr || []).find(function(r){ return r.id_spp === idSpp; });
  _hapusSPPRowInti(idSpp, row);
}
async function _hapusSPPRowInti(idSpp, row) {
  // row null (data tak ketemu di cache) → jangan longgarkan gerbang: anggap lunas.
  var lunas = !row || row.status === 'lunas';
  var label = row ? ((row.nama_murid || idSpp) + ' — ' + (row.bulan || '') + ' ' + (row.tahun || '') + ' — Rp ' + Number(row.nominal || 0).toLocaleString('id-ID')) : idSpp;
  var gwNote = (row && row.metode_bayar === 'gateway') ? '\n\n⚠ Transaksi GATEWAY (Mayar) — penghapusan tidak menyesuaikan Mayar.' : '';
  if (lunas) {
    var ket = prompt('HAPUS PERMANEN transaksi LUNAS ini?\n\n' + label + gwNote + '\n\nKetik HAPUS untuk konfirmasi:');
    if ((ket || '').trim().toUpperCase() !== 'HAPUS') { if (ket !== null) toast('Dibatalkan (konfirmasi tak cocok).', 'warn'); return; }
  } else {
    if (!confirm('Hapus transaksi ini?\n\n' + label)) return;
  }
  showLoad('Menghapus...');
  try {
    await window.HQ.AdminAPI.deleteSPPRow(idSpp);
    toast('Transaksi dihapus', 'ok');
    closeModal('modalEditSPPRow');
    loadSPPAdmin();
  } catch(e) { toast('Gagal: ' + friendlyError(e), 'err'); }
  finally { hideLoad(); }
}

// Cegah CSV/Formula Injection: jika nilai diawali =,+,-,@ (atau tab/CR),
// Excel/Sheets bisa menafsirkannya sebagai formula saat file dibuka.
// Beri prefiks tanda kutip tunggal agar dibaca sebagai teks biasa.
function _csvSafe(val) {
  var s = String(val == null ? '' : val).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return s;
}

function eksporSPP() {
  var jenis = document.getElementById('sppFilterJenis')?.value || 'spp';
  var tahun = document.getElementById('sppFilterTahun').value;
  var _perSel = document.getElementById('sppFilterPeriode');
  var perLabel = _perSel && _perSel.value
    ? (_perSel.value === '__tanpa__' ? 'TanpaPeriode' : (_perSel.options[_perSel.selectedIndex].text || _perSel.value).replace(/[^A-Za-z0-9]+/g,'-'))
    : 'SemuaPeriode';
  tahun = perLabel + '_' + tahun;
  var halaqahVal = document.getElementById('sppFilterHalaqah').value || 'Semua-Halaqah';
  var bulanVal = document.getElementById('sppFilterBulan').value || 'Semua-Bulan';

  var csv, namaFile;
  if (jenis === 'infaq') {
    var infaqList = _sppInfaqDataFiltered || [];
    if (!infaqList.length) {
      showAlertModal('Tidak ada data Infaq untuk diekspor.', { title: 'Ekspor Infaq' });
      return;
    }
    csv = 'ID Murid;Nama Murid;Halaqah;Level;Bulan;Tahun;Tanggal Bayar;Nominal;Metode\r\n';
    infaqList.forEach(function(r) {
      var nama = _csvSafe(r.nama_murid || '');
      var hal = _csvSafe(r.nama_halaqah || r.id_halaqah || '—');
      var lvl = _csvSafe(r.level || '');
      var metode = _csvSafe(r.metode_bayar === 'gateway' ? 'Gateway' : 'Manual');
      csv += '"' + _csvSafe(r.id_murid) + '";"' + nama + '";"' + hal + '";"' + lvl + '";"' + _csvSafe(r.bulan) + '";' + r.tahun + ';"' + _csvSafe(r.tanggal_bayar||'') + '";' + Number(r.nominal||0) + ';"' + metode + '"\r\n';
    });
    namaFile = 'rekap_infaq_' + tahun + '_' + halaqahVal + '_' + bulanVal + '.csv';
  } else if (jenis === 'ihsan') {
    var ihsanList = _sppIhsanDataFiltered || [];
    if (!ihsanList.length) {
      showAlertModal('Tidak ada data Ihsan Guru untuk diekspor.', { title: 'Ekspor Ihsan Guru' });
      return;
    }
    csv = 'ID Guru;Nama Guru;Bulan;Tahun;Tanggal Bayar;Nominal;Catatan\r\n';
    ihsanList.forEach(function(r) {
      var nama = _csvSafe(r.nama_murid || '');
      csv += '"' + _csvSafe(r.id_murid) + '";"' + nama + '";"' + _csvSafe(r.bulan) + '";' + r.tahun + ';"' + _csvSafe(r.tanggal_bayar||'') + '";' + Number(r.nominal||0) + ';"' + _csvSafe(r.catatan||'') + '"\r\n';
    });
    namaFile = 'rekap_ihsan_guru_' + tahun + '_' + bulanVal + '.csv';
  } else {
    var list = _sppRekapDataFiltered || [];
    if (!list.length) {
      showAlertModal('Tidak ada data SPP untuk diekspor.', { title: 'Ekspor SPP' });
      return;
    }
    var statusVal = document.getElementById('sppFilterStatus').value || 'Semua-Status';
    csv = 'ID Murid;Nama Murid;Halaqah;Level;Tunggakan Bulan;Bulan Belum Lunas;No HP\r\n';
    list.forEach(function(m) {
      var nama = _csvSafe(m.nama_murid || '');
      var hal = _csvSafe(m.nama_halaqah || m.id_halaqah || '—');
      var lvl = _csvSafe(m.level || '');
      var bln = _csvSafe(m.tunggakan === 0 ? 'Lunas' : (m.tunggakan + ' bulan belum lunas'));
      var hp  = _csvSafe(m.no_hp || '');
      csv += '"' + _csvSafe(m.id_murid) + '";"' + nama + '";"' + hal + '";"' + lvl + '";' + m.tunggakan + ';"' + bln + '";"' + hp + '"\r\n';
    });
    namaFile = 'rekap_spp_' + tahun + '_' + halaqahVal + '_' + bulanVal + '_' + statusVal + '.csv';
  }

  // UTF-8 BOM agar terbaca dengan benar di Excel (Indonesian locale)
  var blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');

  a.href   = url;
  a.download = namaFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function salinTagihanMassal() {
  var list = _sppRekapDataFiltered || [];
  var menunggakList = list.filter(function(m) { return m.tunggakan > 0; });
  if (!menunggakList.length) {
    showAlertModal('Tidak ada data murid yang menunggak untuk disalin.', { title: 'Salin Tagihan' });
    return;
  }
  
  var tahun = document.getElementById('sppFilterTahun').value;
  var bulanVal = document.getElementById('sppFilterBulan').value;
  var halaqahVal = document.getElementById('sppFilterHalaqah').value;
  var namaHalaqah = '';
  if (halaqahVal) {
    var hq = (allHalaqah||[]).find(h => h.id_halaqah === halaqahVal);
    namaHalaqah = hq ? hq.nama_halaqah : halaqahVal;
  }
  
  var txt = '*REKAP TAGIHAN SPP RATTILILQUR\'AN*\n'
    + (namaHalaqah ? '📚 Kelas: *' + namaHalaqah + '*\n' : '')
    + (bulanVal ? '📅 Acuan Bulan: *' + bulanVal + '*\n' : '')
    + '📅 Tahun: *' + tahun + '*\n\n'
    + 'Mohon kerja samanya untuk menyelesaikan amanah SPP:\n\n';
    
  menunggakList.forEach(function(m, idx) {
    var nominal = m.tunggakan * SPP_NOMINAL_BULANAN;
    txt += (idx + 1) + '. *' + m.nama_murid + '* (' + m.id_murid + ')\n'
      + '   • Tunggakan: *' + m.tunggakan + ' bulan*\n'
      + '   • Total Tagihan: *Rp ' + nominal.toLocaleString('id-ID') + '*\n\n';
  });
  
  txt += 'Pembayaran dapat ditransfer ke rekening resmi lembaga. Semoga Allah mudahkan rezeki Bapak/Ibu sekalian. Jazakumullahu khairan 🤲';
  
  navigator.clipboard.writeText(txt).then(function() {
    toast('Teks rekap tagihan disalin ke clipboard!', 'ok');
  }).catch(function() {
    // Fallback
    var el = document.createElement('textarea');
    el.value = txt;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    toast('Teks rekap tagihan disalin ke clipboard!', 'ok');
  });
}

async function konfirmasiManualGateway(id_spp, namaMurid, bulanTahun) {
  var msg = '<div style="display:flex;align-items:flex-start;gap:6px">'+svgIcon('warn',16)+'<span>Baris ini adalah tagihan <strong>Gateway (Mayar)</strong> yang BELUM otomatis lunas.</span></div><br>'
    + 'Sebelum konfirmasi manual, pastikan Anda sudah <strong>cek riwayat transaksi di Mayar Dashboard</strong> dan '
    + esc(namaMurid) + ' <strong>BENAR-BENAR SUDAH MEMBAYAR</strong> SPP ' + esc(bulanTahun) + '.<br><br>'
    + 'Jika belum dibayar, klik <strong>Batal</strong> — konfirmasi yang salah akan membuat status "Lunas" padahal belum dibayar.';
  var ok = await showConfirm('', { html: msg, title: 'Double Check: Sudah Dibayar?', okText: 'Ya, Sudah Saya Cek & Lunas', danger: true });
  if (!ok) return;
  validasiSPP(id_spp, 'lunas');
}

var _sppRiwayatLoaded = false;
// force=true → paksa fetch ulang (mis. setelah aksi validasi / batal).
// Tanpa force → skip kalau sudah dimuat siklus ini (hindari fetch berulang
// dari _restoreSPPCards / expand-collapse berkali-kali).
async function loadSPPRiwayat(force) {
  var listEl = document.getElementById('sppRiwayatSection');
  if (!listEl) return;
  if (_sppRiwayatLoaded && !force) return;
  listEl.innerHTML = '<div style="text-align:center;padding:12px;color:#94a3b8;font-size:13px">Memuat...</div>';
  try {
    var res = await window.HQ.AdminAPI.getSPPRecentValidasi();
    _sppRiwayatLoaded = true;
    var rows = res.data || [];
    if (!rows.length) {
      listEl.innerHTML = _sppEmptyBox("Belum ada konfirmasi / penolakan terbaru.");
      return;
    }
    listEl.innerHTML = rows.map(function(p) {
      var nominal = p.nominal ? 'Rp '+Number(p.nominal).toLocaleString('id-ID') : '—';
      var isGateway  = p.metode_bayar === 'gateway' && !p.validated_by;
      var bulanTahun = (p.bulan!=='-'?p.bulan+' ':'')+(p.tahun||'');
      var statusTag = p.status === 'lunas'
        ? '<span class="spp-tag t-green">Lunas</span>'
        : '<span class="spp-tag t-red">Ditolak</span>';
      var sumberTag = isGateway
        ? '<span class="spp-tag t-gw">'+svgIcon('zap',10)+' Gateway</span>'
        : '<span class="spp-tag">Manual Admin</span>';
      var when = fmtDate(p.validated_at || p.tanggal_bayar);
      var _idj = escJs(p.id_spp);
      return '<div class="spp-row">'
        + '<div class="spp-row-main">'
        + '<div class="spp-row-name">'+esc(p.nama_murid||p.id_murid)+'</div>'
        + '<div class="spp-row-meta">'+statusTag+sumberTag
          +'<span>'+esc(bulanTahun)+'</span>'
          +'<span>·</span><strong>'+nominal+'</strong>'
          +'<span>·</span><span style="color:var(--text-3)">'+esc(when)+'</span></div>'
        + '</div>'
        + '<button type="button" class="spp-undo-btn" '
          + 'onclick="batalkanKonfirmasi(\''+_idj+'\',\''+escJs(p.nama_murid||p.id_murid)+'\',\''+escJs(bulanTahun)+'\',\''+escJs(p.status)+'\')">'+svgIcon('undo',13)+' Batalkan</button>'
        + '</div>';
    }).join('');
  } catch(e) {
    listEl.innerHTML = '<div class="spp-empty" style="color:var(--red-txt)">Gagal memuat riwayat: ' + esc(friendlyError(e)) + '</div>';
  }
}

async function batalkanKonfirmasi(id_spp, namaMurid, bulanTahun, statusSebelumnya) {
  var aksiLabel = statusSebelumnya === 'lunas' ? 'LUNAS' : 'DITOLAK';
  var msg = '<div style="display:flex;align-items:flex-start;gap:6px">'+svgIcon('warn',16)+'<span>Anda akan membatalkan konfirmasi <strong>' + aksiLabel + '</strong> untuk '
    + esc(namaMurid) + ' — SPP ' + esc(bulanTahun) + '.</span></div><br>'
    + 'Status akan dikembalikan ke <strong>"Menunggu Validasi"</strong> agar bisa dikonfirmasi/ditolak ulang dengan benar.<br><br>'
    + 'Pastikan ini memang salah konfirmasi sebelum lanjut.';
  var ok = await showConfirm('', { html: msg, title: 'Batalkan Konfirmasi?', okText: 'Ya, Batalkan', danger: true });
  if (!ok) return;
  showLoad('Membatalkan...');
  try {
    var r = await window.HQ.AdminAPI.batalkanValidasiSPP(id_spp);
    if (r && r.status === 'error') {
      toast(r.message || 'Gagal membatalkan.', 'warn');
    } else {
      toast('Konfirmasi dibatalkan, status kembali ke Menunggu', 'ok');
    }
    _sppRiwayatLoaded = false;
    loadSPPRiwayat();
    loadSPPAdmin();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

async function validasiSPP(id_spp, aksi) {
  showLoad(aksi==='lunas'?'Mengkonfirmasi...':'Menolak...');
  try {
    var r = await window.HQ.AdminAPI.validasiSPP(id_spp, aksi);
    if (r && r.status === 'error') {
      toast(r.message || 'Pengajuan ini sudah divalidasi sebelumnya.', 'warn');
    } else {
      toast(aksi==='lunas'?'Pembayaran dikonfirmasi':'Pembayaran ditolak', aksi==='lunas'?'ok':'warn');
    }
    loadSPPAdmin();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

// ══════════════════════════════════════════
//  INPUT SPP MANUAL OLEH ADMIN
// ══════════════════════════════════════════
var _sppManualMuridCache = [];
var _sppManualGuruCache = [];
var _sppManualSessionCount = 0;
var _sppManualBulanLunas = [];
var _sppManualBulanMenunggu = [];
var BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

async function bukaModalInputSPPManual(defaultJenis) {
  _sppManualSessionCount = 0;
  document.getElementById('sppManualCounter').textContent = '';
  document.getElementById('sppManualMuridSearch').value = '';
  document.getElementById('sppManualMuridId').value = '';
  document.getElementById('sppManualMuridInfo').style.display = 'none';
  document.getElementById('sppManualErr').style.display = 'none';
  document.getElementById('sppManualNominal').value = '';
  document.getElementById('sppManualNominalHint').textContent = '';
  var jenis = defaultJenis || 'SPP Pribadi';
  document.getElementById('sppManualCatatan').value = jenis === 'Ihsan Guru' ? 'Ihsan Guru' : 'Sinkronisasi data lama';
  // Default tahun dari filter SPP jika ada
  var filterTahun = document.getElementById('sppFilterTahun');
  if (filterTahun) document.getElementById('sppManualTahun').value = filterTahun.value;
  // Reset jenis ke default
  setSPPManualJenis(jenis, null);
  // Reset bulan grid
  renderSPPManualBulanGrid([], []);
  // Load murid list (cache)
  if (!_sppManualMuridCache.length) {
    try {
      var r = await window.HQ.AdminAPI.getAllAnggota();
      _sppManualMuridCache = (r.data||[]).filter(function(a){ return a.status === 'aktif'; });
      // Sort by tunggakan (dari _sppRekapData jika sudah loaded)
      if (_sppRekapData && _sppRekapData.length) {
        var tunggakMap = {};
        _sppRekapData.forEach(function(m){ tunggakMap[m.id_murid] = m.tunggakan || 0; });
        _sppManualMuridCache.sort(function(a,b){
          var tA = tunggakMap[a.id_murid] || 0;
          var tB = tunggakMap[b.id_murid] || 0;
          return tB - tA || (a.nama_murid||'').localeCompare(b.nama_murid||'');
        });
      } else {
        _sppManualMuridCache.sort(function(a,b){ return (a.nama_murid||'').localeCompare(b.nama_murid||''); });
      }
    } catch(e) { toast('Gagal memuat daftar murid: '+friendlyError(e), 'err'); }
  }
  document.getElementById('modalInputSPPManual').classList.add('open');
  document.body.style.overflow = 'hidden';
  // Focus search
  setTimeout(function(){ document.getElementById('sppManualMuridSearch').focus(); }, 150);
}

function tutupModalInputSPPManual() {
  document.getElementById('modalInputSPPManual').classList.remove('open');
  document.body.style.overflow = '';
  document.getElementById('sppManualMuridDropdown').style.display = 'none';
  // Jika ada data yang diinput, refresh halaman SPP
  if (_sppManualSessionCount > 0) loadSPPAdmin();
}

function filterMuridSPPManual() {
  var jenis = document.getElementById('sppManualJenis').value;
  var q = (document.getElementById('sppManualMuridSearch').value || '').toLowerCase().trim();
  var dd = document.getElementById('sppManualMuridDropdown');
  
  if (jenis === 'Ihsan Guru') {
    var list = _sppManualGuruCache;
    if (q) {
      list = list.filter(function(a) {
        return (a.nama_lengkap||'').toLowerCase().indexOf(q) !== -1
          || (a.id_user||'').toLowerCase().indexOf(q) !== -1;
      });
    }
    if (!list.length) {
      dd.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-3);font-size:12px">Tidak ditemukan</div>';
      dd.style.display = '';
      return;
    }
    dd.innerHTML = list.slice(0, 30).map(function(a) {
      return '<div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;display:flex;align-items:center;justify-content:space-between" '
        + 'onmousedown="pilihMuridSPPManual(\''+esc(a.id_user)+'\',\''+escJs(a.nama_lengkap||'')+'\',\'Guru\')">'
        + '<div><span style="font-weight:700;color:var(--text)">'+esc(a.nama_lengkap)+'</span>'
        + '<span style="font-size:11px;color:var(--text-3);margin-left:6px">'+esc(a.id_user)+'</span></div>'
        + '</div>';
    }).join('');
    dd.style.display = '';
  } else {
    var list = _sppManualMuridCache;
    if (q) {
      list = list.filter(function(a) {
        return (a.nama_murid||'').toLowerCase().indexOf(q) !== -1
          || (a.id_murid||'').toLowerCase().indexOf(q) !== -1;
      });
    }
    if (!list.length) {
      dd.innerHTML = '<div style="padding:12px;text-align:center;color:var(--text-3);font-size:12px">Tidak ditemukan</div>';
      dd.style.display = '';
      return;
    }
    // Get tunggakan info
    var tunggakMap = {};
    if (_sppRekapData && _sppRekapData.length) {
      _sppRekapData.forEach(function(m){ tunggakMap[m.id_murid] = m.tunggakan || 0; });
    }
    dd.innerHTML = list.slice(0, 30).map(function(a) {
      var t = tunggakMap[a.id_murid] || 0;
      var badge = t > 0
        ? '<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:var(--red-bg,#fee2e2);color:var(--red-txt,#991b1b);font-weight:700;margin-left:6px">' + t + ' bln tunggak</span>'
        : '<span style="font-size:10px;padding:1px 6px;border-radius:6px;background:var(--green-bg,#f0fdf4);color:var(--green-txt,#065f46);font-weight:700;margin-left:6px">Lunas</span>';
      return '<div style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px;display:flex;align-items:center;justify-content:space-between" '
        + 'onmousedown="pilihMuridSPPManual(\''+esc(a.id_murid)+'\',\''+escJs(a.nama_murid||'')+'\',\''+escJs((a.halaqah&&a.halaqah.nama_halaqah)||a.id_halaqah||'')+'\')">'
        + '<div><span style="font-weight:700;color:var(--text)">'+esc(a.nama_murid||a.id_murid)+'</span>'
        + '<span style="font-size:11px;color:var(--text-3);margin-left:6px">'+esc(a.id_murid)+'</span></div>'
        + badge + '</div>';
    }).join('');
    dd.style.display = '';
  }
}

async function pilihMuridSPPManual(id_murid, nama, halaqah) {
  document.getElementById('sppManualMuridSearch').value = nama;
  document.getElementById('sppManualMuridId').value = id_murid;
  document.getElementById('sppManualMuridDropdown').style.display = 'none';
  var info = document.getElementById('sppManualMuridInfo');
  info.textContent = nama + (halaqah ? ' · ' + halaqah : '');
  info.style.display = '';
  
  // Load status SPP/Ihsan bulan
  var tahun = document.getElementById('sppManualTahun').value;
  var jenis = document.getElementById('sppManualJenis').value;
  
  try {
    if (jenis === 'Ihsan Guru') {
      var r = await window.HQ.AdminAPI.getIhsanStatusGuru(id_murid, Number(tahun));
      _sppManualBulanLunas = r.data.lunas || [];
      _sppManualBulanMenunggu = [];
    } else {
      var r = await window.HQ.AdminAPI.getSPPStatusMurid(id_murid, Number(tahun));
      _sppManualBulanLunas = r.data.lunas || [];
      _sppManualBulanMenunggu = r.data.menunggu || [];
    }
  } catch(e) { 
    _sppManualBulanLunas = []; 
    _sppManualBulanMenunggu = []; 
  }
  
  renderSPPManualBulanGrid(_sppManualBulanLunas, _sppManualBulanMenunggu);
  hitungNominalSPPManual();
}

function renderSPPManualBulanGrid(lunas, menunggu) {
  var jenis = document.getElementById('sppManualJenis').value;
  var isInfaq = jenis === 'Infaq/Operasional';
  var grid = document.getElementById('sppManualBulanGrid');
  grid.innerHTML = BULAN_NAMES.map(function(b) {
    var isLunas = !isInfaq && lunas.includes(b);
    var isMenunggu = !isInfaq && menunggu.includes(b);
    var disabled = isLunas ? 'pointer-events:none;opacity:0.5;' : '';
    var label = isLunas ? svgIcon('ok',12) + ' ' + b : isMenunggu ? svgIcon('clock',12) + ' ' + b : b;
    var bgChecked = isLunas
      ? 'background:var(--green-bg,#f0fdf4);border-color:var(--green,#1a5c3a);color:var(--green-txt,#065f46);'
      : isMenunggu
        ? 'background:var(--amber-bg,#fffbeb);border-color:#fcd34d;color:var(--amber-txt,#92400e);'
        : '';
    return '<label style="display:flex;align-items:center;gap:6px;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;user-select:none;transition:all .15s;'+disabled+bgChecked+'" '
      + 'onchange="hitungNominalSPPManual()">'
      + '<input type="checkbox" name="sppManualBulan" value="'+b+'" '+(isLunas?'disabled checked':'')+' style="accent-color:var(--green,#1a5c3a)">'
      + label + '</label>';
  }).join('');
}

function hitungNominalSPPManual() {
  var jenis = document.getElementById('sppManualJenis')?.value || 'SPP Pribadi';
  var hint = document.getElementById('sppManualNominalHint');
  if (jenis !== 'SPP Pribadi') {
    if (hint) hint.textContent = 'Masukkan nominal secara manual';
    return;
  }
  var checked = document.querySelectorAll('input[name=sppManualBulan]:checked:not(:disabled)');
  var count = checked.length;
  var nominal = count * SPP_NOMINAL_BULANAN;
  document.getElementById('sppManualNominal').value = nominal;
  if (hint) {
    if (count > 0) {
      hint.textContent = count + ' bulan × Rp ' + SPP_NOMINAL_BULANAN.toLocaleString('id-ID') + ' = Rp ' + nominal.toLocaleString('id-ID');
    } else {
      hint.textContent = 'Pilih bulan terlebih dahulu';
    }
  }
}

function pilihSemuaBelumLunas() {
  var boxes = document.querySelectorAll('input[name=sppManualBulan]:not(:disabled)');
  var allChecked = Array.from(boxes).every(function(b){ return b.checked; });
  boxes.forEach(function(b){ b.checked = !allChecked; });
  hitungNominalSPPManual();
}

function setSPPManualJenis(jenis, el) {
  document.getElementById('sppManualJenis').value = jenis;
  var tabs = document.querySelectorAll('#sppManualJenisTabs > div');
  if (tabs.length === 3) {
    // Reset all tabs
    tabs.forEach(function(t) {
      t.style.borderColor = 'var(--border)';
      t.style.background  = 'var(--bg-2,#fff)';
      t.style.color       = 'var(--text-2)';
    });
    // Highlight selected tab
    if (jenis === 'SPP Pribadi') {
      tabs[0].style.borderColor = 'var(--green,#1a5c3a)';
      tabs[0].style.background  = 'var(--green-bg,#f0fdf4)';
      tabs[0].style.color       = 'var(--green-txt,#1a5c3a)';
    } else if (jenis === 'Infaq/Operasional') {
      tabs[1].style.borderColor = 'var(--amber,#f59e0b)';
      tabs[1].style.background  = 'var(--amber-bg,#fffbeb)';
      tabs[1].style.color       = 'var(--amber-txt,#92400e)';
    } else if (jenis === 'Ihsan Guru') {
      tabs[2].style.borderColor = 'var(--red,#ef4444)';
      tabs[2].style.background  = 'var(--red-bg,#fee2e2)';
      tabs[2].style.color       = 'var(--red-txt,#991b1b)';
    }
  }

  // Update label & placeholder
  var modalEl = document.getElementById('modalInputSPPManual');
  var labelMurid = modalEl ? modalEl.querySelector('label') : null;
  var searchInput = document.getElementById('sppManualMuridSearch');
  
  if (labelMurid && searchInput) {
    if (jenis === 'Ihsan Guru') {
      labelMurid.textContent = 'Penerima (Guru)';
      searchInput.placeholder = 'Ketik nama guru...';
    } else {
      labelMurid.textContent = 'Murid';
      searchInput.placeholder = 'Ketik nama murid...';
    }
  }

  // Kosongkan selection jika berganti jenis
  if (el) {
    searchInput.value = '';
    document.getElementById('sppManualMuridId').value = '';
    document.getElementById('sppManualMuridInfo').style.display = 'none';
    _sppManualBulanLunas = [];
    _sppManualBulanMenunggu = [];
  }

  // Load daftar guru jika belum ada & memilih Ihsan Guru
  if (jenis === 'Ihsan Guru' && !_sppManualGuruCache.length) {
    showLoad('Memuat daftar guru...');
    window.HQ.AdminAPI.getAllUsers('guru').then(function(r) {
      _sppManualGuruCache = (r.data || []).filter(function(u) { return u.status === 'aktif'; });
      _sppManualGuruCache.sort(function(a,b){ return (a.nama_lengkap||'').localeCompare(b.nama_lengkap||''); });
      hideLoad();
    }).catch(function(e) {
      toast('Gagal memuat daftar guru: ' + e.message, 'err');
      hideLoad();
    });
  }

  // Re-render bulan grid (infaq & ihsan: semua bisa dipilih, SPP: pakai lunas state)
  if (jenis === 'Infaq/Operasional' || jenis === 'Ihsan Guru') {
    renderSPPManualBulanGrid([], []);
  } else {
    renderSPPManualBulanGrid(_sppManualBulanLunas, _sppManualBulanMenunggu);
  }
  hitungNominalSPPManual();

  // Tombol pilih semua hanya untuk SPP
  var btnAll = document.getElementById('btnPilihSemuaBelum');
  if (btnAll) btnAll.style.display = (jenis === 'SPP Pribadi') ? '' : 'none';

  // Periode: hanya relevan untuk Ihsan Guru (SPP/Infaq ikut periode halaqah).
  var perWrap = document.getElementById('sppManualPeriodeWrap');
  if (perWrap) {
    if (jenis === 'Ihsan Guru') {
      perWrap.style.display = '';
      _isiPeriodeSel('sppManualPeriode');
    } else {
      perWrap.style.display = 'none';
    }
  }
}

async function onSPPManualTahunChange() {
  var id_murid = document.getElementById('sppManualMuridId').value;
  if (!id_murid) return;
  var tahun = document.getElementById('sppManualTahun').value;
  try {
    var r = await window.HQ.AdminAPI.getSPPStatusMurid(id_murid, Number(tahun));
    _sppManualBulanLunas = r.data.lunas || [];
    _sppManualBulanMenunggu = r.data.menunggu || [];
  } catch(e) { _sppManualBulanLunas = []; _sppManualBulanMenunggu = []; }
  renderSPPManualBulanGrid(_sppManualBulanLunas, _sppManualBulanMenunggu);
  hitungNominalSPPManual();
}

async function submitInputSPPManual() {
  var errEl = document.getElementById('sppManualErr');
  errEl.style.display = 'none';
  var id_murid = document.getElementById('sppManualMuridId').value;
  var jenis = document.getElementById('sppManualJenis').value;
  if (!id_murid) {
    errEl.textContent = jenis === 'Ihsan Guru' ? 'Pilih guru terlebih dahulu.' : 'Pilih murid terlebih dahulu.';
    errEl.style.display = '';
    return;
  }
  var checkedBoxes = document.querySelectorAll('input[name=sppManualBulan]:checked:not(:disabled)');
  var bulanArr = Array.from(checkedBoxes).map(function(b){ return b.value; });
  if (!bulanArr.length) { errEl.textContent = 'Pilih minimal 1 bulan.'; errEl.style.display = ''; return; }
  var nominal = Number(document.getElementById('sppManualNominal').value);
  if (!nominal || nominal <= 0) { errEl.textContent = 'Nominal harus lebih dari 0.'; errEl.style.display = ''; return; }

  showLoad('Menyimpan pembayaran...');
  try {
    var r = await window.HQ.AdminAPI.inputSPPManual({
      id_murid: id_murid,
      bulan: bulanArr,
      tahun: document.getElementById('sppManualTahun').value,
      jenis: jenis,
      nominal: nominal,
      catatan: document.getElementById('sppManualCatatan').value.trim(),
      // Ihsan Guru: tandai ke periode (SPP/Infaq ikut periode halaqah di backend)
      id_periode: jenis === 'Ihsan Guru'
        ? ((document.getElementById('sppManualPeriode') && document.getElementById('sppManualPeriode').value) || null)
        : undefined,
    });
    if (r.count === 0) {
      toast(r.message || 'Sudah lunas sebelumnya.', 'warn');
    } else {
      _sppManualSessionCount += 1;
      toast(r.message || 'Berhasil disimpan', 'ok');
      var entriLabel = jenis === 'Ihsan Guru' ? 'transaksi ihsan' : 'murid';
      document.getElementById('sppManualCounter').textContent = _sppManualSessionCount + ' ' + entriLabel + ' sudah diinput sesi ini';
    }
    // Stay open: reset form untuk murid berikutnya
    document.getElementById('sppManualMuridSearch').value = '';
    document.getElementById('sppManualMuridId').value = '';
    document.getElementById('sppManualMuridInfo').style.display = 'none';
    document.getElementById('sppManualNominal').value = '';
    document.getElementById('sppManualNominalHint').textContent = '';
    _sppManualBulanLunas = [];
    _sppManualBulanMenunggu = [];
    renderSPPManualBulanGrid([], []);
    // Focus kembali ke search
    setTimeout(function(){ document.getElementById('sppManualMuridSearch').focus(); }, 100);
  } catch(e) {
    errEl.textContent = 'Gagal: ' + friendlyError(e);
    errEl.style.display = '';
  } finally { hideLoad(); }
}

// Close dropdown saat klik di luar
document.addEventListener('click', function(e) {
  var dd = document.getElementById('sppManualMuridDropdown');
  var search = document.getElementById('sppManualMuridSearch');
  if (dd && search && !dd.contains(e.target) && e.target !== search) {
    dd.style.display = 'none';
  }
});

// ══════════════════════════════════════════
//  PENGUMUMAN
// ══════════════════════════════════════════
async function loadPengumuman() {
  showLoad('Bismillah, memproses...');
  try {
    const r = await window.HQ.AdminAPI.getAllPengumuman();
    const tbody = document.getElementById('pengumumanTbl');
    tbody.innerHTML = (r.data||[]).map(p=>`<tr>
      <td>${esc(p.tanggal)}</td>
      <td><strong>${esc(p.judul)}</strong></td>
      <td><span class="badge b-blue">${esc(p.target)}</span></td>
      <td>${esc(p.nama_pembuat)}</td>
    </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-3)">Belum ada pengumuman</td></tr>';
  } catch(e) {}
  finally { hideLoad(); }
}

async function doKirimPengumuman() {
  const judul  = document.getElementById('pngJudul').value.trim();
  const isi    = document.getElementById('pngIsi').value.trim();
  const target = document.getElementById('pngTarget').value;
  if (!judul || !isi) return toast('Judul dan isi wajib diisi','err');
  showLoad('Bismillah, mengirim pengumuman...');
  try {
    await window.HQ.AdminAPI.buatPengumuman({ judul, isi, target });
    document.getElementById('pngJudul').value = '';
    document.getElementById('pngIsi').value   = '';
    toast('Pengumuman terkirim!','ok');
    loadPengumuman();
  } catch(e) { toast(friendlyError(e),'err'); }
  finally { hideLoad(); }
}

// ══════════════════════════════════════════
//  AUDIT LOG

  // Export functions to window
  if (typeof window !== "undefined") {
    window.bukaKelolaMetode = bukaKelolaMetode;
    window.tutupKelolaMetode = tutupKelolaMetode;
    window.loadMetodeBayarAdmin = loadMetodeBayarAdmin;
    window.bukaFormMetode = bukaFormMetode;
    window.tutupFormMetode = tutupFormMetode;
    window.setMetodeJenis = setMetodeJenis;
    window.editMetode = editMetode;
    window.hapusMetode = hapusMetode;
    window.simpanMetode = simpanMetode;
    window.loadSPPAdmin = loadSPPAdmin;
    window.loadSPPGlobalStrip = loadSPPGlobalStrip;
    window.switchSPPTab = switchSPPTab;
    window.onSPPPeriodeChange = onSPPPeriodeChange;
    window.onSPPTahunChange = onSPPTahunChange;
    window.sppLihatTanpaPeriode = sppLihatTanpaPeriode;
    window.populateSPPPeriodeFilter = populateSPPPeriodeFilter;
    window.toggleSPPView = toggleSPPView;
    window.loadRekonsiliasi = loadRekonsiliasi;
    window.sppBulkSetPeriode = sppBulkSetPeriode;
    window.bukaEditSPPRow = bukaEditSPPRow;
    window.tutupEditSPPRow = tutupEditSPPRow;
    window.simpanEditSPPRow = simpanEditSPPRow;
    window.hapusSPPRow = hapusSPPRow;
    window.hapusSPPRowLangsung = hapusSPPRowLangsung;
    window.ensureKasBulanOptions = ensureKasBulanOptions;
    window.renderKasRingkasan = renderKasRingkasan;
    window.renderKasOperasionalList = renderKasOperasionalList;
    window.loadKasBeasiswa = loadKasBeasiswa;
    window.bukaFormOperasional = bukaFormOperasional;
    window.tutupFormOperasional = tutupFormOperasional;
    window.editOperasional = editOperasional;
    window.simpanOperasional = simpanOperasional;
    window.hapusOperasionalItem = hapusOperasionalItem;
    window.ensureArusKasBulanOptions = ensureArusKasBulanOptions;
    window.arusKasPreset = arusKasPreset;
    window.loadArusKas = loadArusKas;
    window.bukaFormKas = bukaFormKas;
    window.tutupFormKas = tutupFormKas;
    window.onKasArahChange = onKasArahChange;
    window.onKasKategoriChange = onKasKategoriChange;
    window.editKasItem = editKasItem;
    window.hapusKasItem = hapusKasItem;
    window.simpanKas = simpanKas;
    window.loadKasKategori = loadKasKategori;
    window.bukaKelolaKategori = bukaKelolaKategori;
    window.tutupKelolaKategori = tutupKelolaKategori;
    window.tambahKategoriKas = tambahKategoriKas;
    window.renameKategoriKas = renameKategoriKas;
    window.hapusKategoriKas = hapusKategoriKas;
    window.toggleTipeSpp = toggleTipeSpp;
    window.filterSPPTable = filterSPPTable;
    window.filterSPPTableDebounced = filterSPPTableDebounced;
    window.filterInfaqTable = filterInfaqTable;
    window.filterIhsanTable = filterIhsanTable;
    window.loadMoreSPP = loadMoreSPP;
    window.sppKirimWAReminder = sppKirimWAReminder;
    window._csvSafe = _csvSafe;
    window.eksporSPP = eksporSPP;
    window.salinTagihanMassal = salinTagihanMassal;
    window.konfirmasiManualGateway = konfirmasiManualGateway;
    window.loadSPPRiwayat = loadSPPRiwayat;
    window.togglePcard = togglePcard;
    window.toggleAllSPPCards = toggleAllSPPCards;
    window._restoreSPPCards = _restoreSPPCards;
    window.batalkanKonfirmasi = batalkanKonfirmasi;
    window.validasiSPP = validasiSPP;
    window.bukaModalInputSPPManual = bukaModalInputSPPManual;
    window.tutupModalInputSPPManual = tutupModalInputSPPManual;
    window.filterMuridSPPManual = filterMuridSPPManual;
    window.pilihMuridSPPManual = pilihMuridSPPManual;
    window.renderSPPManualBulanGrid = renderSPPManualBulanGrid;
    window.hitungNominalSPPManual = hitungNominalSPPManual;
    window.pilihSemuaBelumLunas = pilihSemuaBelumLunas;
    window.setSPPManualJenis = setSPPManualJenis;
    window.onSPPManualTahunChange = onSPPManualTahunChange;
    window.submitInputSPPManual = submitInputSPPManual;
    window.loadPengumuman = loadPengumuman;
    window.doKirimPengumuman = doKirimPengumuman;
  }
})();
