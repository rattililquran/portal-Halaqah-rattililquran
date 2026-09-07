// ============================================================
//  API STAFF — GuruAPI + AdminAPI (dimuat portal guru & admin, TIDAK murid)
//  Hasil split supabase-client.js (2026-07-18). File ini KANONIK — edit di sini.
//  supabase-client.js lama disimpan sbg fallback rollback; boleh dihapus stlh live OK.
// ============================================================

// Hari sejak `tanggalStr` (YYYY-MM-DD) sampai HARI INI, dihitung dari
// kalender WIB (bukan UTC/timezone lokal browser) -- dipakai jg oleh
// guru/kbm-module.js (file ini dimuat lebih dulu, tanpa `defer`, jadi fungsi
// ini sudah pasti ada saat kbm-module.js jalan). Konsolidasi bug hunt
// susulan 2026-08-27 -- dulu duplikat persis di 2 file.
function hariSejakWIB(tanggalStr) {
  if (!tanggalStr) return null;
  var todayWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  var d1 = new Date(todayWIB + 'T00:00:00Z').getTime();
  var d2 = new Date(tanggalStr + 'T00:00:00Z').getTime();
  return Math.round((d1 - d2) / 86400000);
}

// ─────────────────────────────────────────────
//  GURU API
// ─────────────────────────────────────────────
var GuruAPI = {

  // ── Dashboard ──────────────────────────────
  getDashboard: async function() {
    var id_guru = _uid();
    var today   = _todayJakarta();   // L2: zona Asia/Jakarta, bukan UTC (hindari off-by-one < 07:00 WIB)
    var month   = today.slice(0, 7);

    var [hqRes, kbmHariRes, kbmBulanRes, draftRes, levelsRes] = await Promise.all([
      _sb.from('halaqah').select('*').eq('id_guru', id_guru).eq('status', 'aktif'),
      _sb.from('kbm_log').select('id_kbm').eq('id_guru', id_guru)
         .eq('status', 'selesai').eq('tanggal_pertemuan', today),
      _sb.from('kbm_log').select('id_kbm').eq('id_guru', id_guru)
         .eq('status', 'selesai').gte('tanggal_pertemuan', month + '-01'),
      // Defensif: pakai limit(1) (bukan maybeSingle) agar dashboard tetap load
      // walau terjadi anomali >1 draft (maybeSingle akan melempar error).
      _sb.from('kbm_log').select('*').eq('id_guru', id_guru).eq('status', 'draft')
         .order('tanggal_pertemuan', { ascending: false }).limit(1),
      _sb.from('level').select('nama_level, id_level, jumlah_pertemuan'),
    ]);

    var halaqah   = hqRes.data || [];
    var hqIds     = halaqah.map(function(h) { return h.id_halaqah; });
    // C7 fix (bug hunt 2026-08-18): dulu query ini ambil SEMUA anggota aktif
    // se-sekolah tanpa filter/limit -> bisa terpotong diam-diam oleh batas 1000
    // baris PostgREST begitu sekolah tumbuh, membuat total_murid/muridCount salah.
    // Sekarang di-scope ke halaqah milik guru ini saja (jumlahnya kecil, aman).
    var anggotaRes = hqIds.length
      ? await _sb.from('anggota').select('id_murid, id_halaqah').eq('status', 'aktif').in('id_halaqah', hqIds)
      : { data: [] };
    var muridSet  = new Set((anggotaRes.data || []).map(function(a) { return a.id_murid; }));

    // Hitung pertemuan_ke per halaqah per jenis_sesi secara terpisah
    var kbmCounts = {}; // { id_halaqah: { jenis_sesi: count } }
    if (hqIds.length > 0) {
      // H9 fix (bug hunt 2026-08-18): dulu tanpa paginasi -> guru senior dgn 1000+
      // log kbm_log selesai bisa kena batas diam-diam PostgREST, pertemuan_ke/
      // sisa_sesi jadi salah. _selectAllPaged menembus batas itu.
      var kbmAll = await _selectAllPaged('kbm_log', 'id_halaqah, jenis_sesi', function(q) {
        return q.in('id_halaqah', hqIds).eq('status', 'selesai').order('id_kbm');
      }, 'getDashboard.kbmAll');
      (kbmAll || []).forEach(function(k) {
        var jenis = k.jenis_sesi || 'KBM Reguler';
        if (!kbmCounts[k.id_halaqah]) kbmCounts[k.id_halaqah] = {};
        kbmCounts[k.id_halaqah][jenis] = (kbmCounts[k.id_halaqah][jenis] || 0) + 1;
      });
    }

    var targetSesiMap = {};
    (levelsRes.data || []).forEach(function(l) {
      if (l.nama_level) targetSesiMap[l.nama_level] = l.jumlah_pertemuan;
      if (l.id_level) targetSesiMap[l.id_level] = l.jumlah_pertemuan;
    });

    halaqah = halaqah.map(function(h) {
      var muridCount = (anggotaRes.data || []).filter(function(a) {
        return a.id_halaqah === h.id_halaqah;
      }).length;
      var counts = kbmCounts[h.id_halaqah] || {};
      var isQiyam = h.level === 'Level Qiyam';
      var regCount = counts['KBM Reguler'] || 0;
      var qiyamCount = counts['KBM Qiyam'] || 0;
      var mainCount = isQiyam ? qiyamCount : regCount;
      var targetSesi = targetSesiMap[h.level] || 40;
      return Object.assign({}, h, {
        total_murid  : muridCount,
        pertemuan_ke : mainCount + 1,
        sisa_sesi    : isQiyam ? 0 : Math.max(0, targetSesi - regCount),
        target_sesi  : isQiyam ? 0 : targetSesi,
        jam_mulai    : h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
        jam_selesai  : h.jam_selesai ? h.jam_selesai.substring(0, 5) : null,
      });
    });

    var draft = (draftRes.data && draftRes.data[0]) || null;
    if (draft) {
      draft.jam_mulai = draft.jam_mulai ? draft.jam_mulai.substring(0, 5) : null;
      draft.jam_selesai = draft.jam_selesai ? draft.jam_selesai.substring(0, 5) : null;
    }

    return {
      status: 'ok',
      data: {
        halaqah      : halaqah,
        total_halaqah: halaqah.length,
        total_murid  : muridSet.size,
        kbm_hari_ini : (kbmHariRes.data || []).length,
        kbm_bulan_ini: (kbmBulanRes.data || []).length,
        sesi_draft   : draft,
      }
    };
  },

  // ── Jadwal hari ini ────────────────────────
  getJadwalHariIni: async function() {
    var id_guru = _uid();
    var hari    = _hariIni();
    var today   = _todayJakarta();

    var [{ data: halaqah, error }, { data: liburResmi }, levelsRes] = await Promise.all([
      _sb.from('halaqah').select('*, anggota(count)')
        .eq('id_guru', id_guru).eq('status', 'aktif'),
      _sb.from('hari_libur_resmi').select('tanggal, keterangan').eq('tanggal', today).maybeSingle(),
      _sb.from('level').select('nama_level, id_level, jumlah_pertemuan'),
    ]);
    _check(error, 'getJadwalHariIni');

    // Hitung pertemuan_ke per halaqah — pisahkan Reguler dan Qiyam
    var hqIds = (halaqah || []).map(function(h) { return h.id_halaqah; });
    // Hitung pertemuan per jenis KBM — masing-masing punya counter sendiri
    var kbmByJenis       = {};  // { id_halaqah: { 'KBM Reguler': N (selesai), ... } }
    var liburByJenis     = {};  // { id_halaqah: { jenis: N (status='libur') } }
    var penggantiByJenis = {};  // { id_halaqah: { jenis: N (selesai & is_pengganti) } }
    var liburEntries     = {};  // { id_halaqah: { jenis: [{tanggal_pertemuan, keterangan_libur}, ...] } }
    if (hqIds.length > 0) {
      // H9 fix (bug hunt 2026-08-18): idem getDashboard -- paginasi agar tak
      // terpotong batas 1000-baris PostgREST utk guru dgn riwayat log panjang.
      var kbmAll = await _selectAllPaged('kbm_log',
        'id_halaqah, jenis_sesi, status, is_pengganti, tanggal_pertemuan, keterangan_libur',
        function(q) { return q.in('id_halaqah', hqIds).in('status', ['selesai', 'libur']).order('id_kbm'); },
        'getJadwalHariIni.kbmAll');
      (kbmAll || []).forEach(function(k) {
        var jenis = k.jenis_sesi || 'KBM Reguler';
        if (k.status === 'selesai') {
          if (!kbmByJenis[k.id_halaqah]) kbmByJenis[k.id_halaqah] = {};
          kbmByJenis[k.id_halaqah][jenis] = (kbmByJenis[k.id_halaqah][jenis] || 0) + 1;
          if (k.is_pengganti) {
            if (!penggantiByJenis[k.id_halaqah]) penggantiByJenis[k.id_halaqah] = {};
            penggantiByJenis[k.id_halaqah][jenis] = (penggantiByJenis[k.id_halaqah][jenis] || 0) + 1;
          }
        } else if (k.status === 'libur') {
          if (!liburByJenis[k.id_halaqah]) liburByJenis[k.id_halaqah] = {};
          liburByJenis[k.id_halaqah][jenis] = (liburByJenis[k.id_halaqah][jenis] || 0) + 1;
          if (!liburEntries[k.id_halaqah]) liburEntries[k.id_halaqah] = {};
          if (!liburEntries[k.id_halaqah][jenis]) liburEntries[k.id_halaqah][jenis] = [];
          liburEntries[k.id_halaqah][jenis].push({
            tanggal_pertemuan: k.tanggal_pertemuan,
            keterangan_libur: k.keterangan_libur || '',
          });
        }
      });
    }

    var targetSesiMap = {};
    if (levelsRes && levelsRes.data) {
      levelsRes.data.forEach(function(l) {
        if (l.nama_level) targetSesiMap[l.nama_level] = l.jumlah_pertemuan;
        if (l.id_level) targetSesiMap[l.id_level] = l.jumlah_pertemuan;
      });
    }

    var result = (halaqah || []).map(function(h) {
      // Balik ke includes() substring (spt semula) supaya toleran thd jadwal_hari
      // yg ada teks/tanda baca tambahan (mis. "Sabtu (ganjil)") -- TAPI dicek thd
      // SEMUA varian ejaan hari ini (_HARI_INDEX, mencakup "jumat"/"jum'at",
      // "minggu"/"ahad"), bukan cuma satu ejaan polos spt kode lama. Fix murni
      // exact-match sebelumnya kelewat ketat & sempat menghilangkan chip "Hari
      // ini" utk jadwal_hari yg formatnya di luar dugaan.
      var jadwalHariLower = (h.jadwal_hari || '').toLowerCase();
      var todayIdxJadwal  = _HARI_INDEX[hari.toLowerCase()];
      var isHariIni = Object.keys(_HARI_INDEX).some(function(k) {
        return _HARI_INDEX[k] === todayIdxJadwal && jadwalHariLower.includes(k);
      });
      var jenisCounts = kbmByJenis[h.id_halaqah] || {};
      var regCount    = jenisCounts['KBM Reguler']    || 0;
      var qiyamCount  = jenisCounts['KBM Qiyam']      || 0;
      var microCount  = jenisCounts['Micro Teaching']  || 0;
      var lainCount   = jenisCounts['Lainnya']          || 0;
      // sisa_pengganti per jenis_sesi = count(libur) - count(selesai & is_pengganti), clamp >= 0
      var liburCounts     = liburByJenis[h.id_halaqah] || {};
      var penggantiCounts = penggantiByJenis[h.id_halaqah] || {};
      var sisaPengganti = {};
      var penggantiPending = {};  // { jenis: [{tanggal_pertemuan, keterangan_libur}, ...] } -- reminder libur belum diganti
      var entriesByJenis = liburEntries[h.id_halaqah] || {};
      ['KBM Reguler', 'KBM Qiyam', 'Micro Teaching', 'Lainnya'].forEach(function(j) {
        var sisa = Math.max(0, (liburCounts[j] || 0) - (penggantiCounts[j] || 0));
        sisaPengganti[j] = sisa;
        if (sisa > 0) {
          var entries = (entriesByJenis[j] || []).slice().sort(function(a, b) {
            return (b.tanggal_pertemuan || '').localeCompare(a.tanggal_pertemuan || '');
          });
          penggantiPending[j] = entries.slice(0, sisa);
        }
      });
      var targetSesi = targetSesiMap[h.level] || 40;
      return {
        id_halaqah             : h.id_halaqah,
        nama_halaqah           : h.nama_halaqah,
        level                  : h.level,
        jadwal_hari            : h.jadwal_hari,
        jam_mulai              : h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
        jam_selesai            : h.jam_selesai ? h.jam_selesai.substring(0, 5) : null,
        lokasi                 : h.lokasi,
        total_murid            : h.anggota ? h.anggota[0].count : 0,
        pertemuan_ke           : (h.level === 'Level Qiyam' ? qiyamCount : regCount) + 1,       // backward compat
        pertemuan_ke_reguler   : regCount + 1,
        pertemuan_ke_qiyam     : qiyamCount + 1,
        pertemuan_ke_microteach: microCount + 1,
        pertemuan_ke_lainnya   : lainCount + 1,
        total_sesi             : regCount,           // hanya Reguler untuk progress 40
        sisa_sesi              : Math.max(0, targetSesi - regCount),
        target_sesi            : targetSesi,
        sisa_pengganti         : sisaPengganti,
        pengganti_pending      : penggantiPending,
        is_hari_ini            : isHariIni,
      };
    });

    result.sort(function(a, b) {
      if (a.is_hari_ini && !b.is_hari_ini) return -1;
      if (!a.is_hari_ini && b.is_hari_ini) return 1;
      return (a.jam_mulai || '').localeCompare(b.jam_mulai || '');
    });

    return { status: 'ok', data: result, hari_ini: hari, libur_resmi_hari_ini: liburResmi || null };
  },

  // ── Absensi Saya (transparansi kehadiran guru) ─────────────
  // Rekap kehadiran + durasi milik sendiri untuk satu bulan. Lihat RANCANGAN §6, §7.2.
  getAbsensiSaya: async function(p) {
    p = p || {};
    // M9 fix (bug hunt 2026-08-18): dulu default bulan/tahun dari new Date() device-
    // local -- di sekitar pergantian bulan, kalau timezone perangkat guru beda dari
    // WIB, laporan "bulan ini" bisa nyasar ke bulan yang salah. Pakai _todayJakarta().
    var todayJkt = _todayJakarta();
    var bulan = Number(p.bulan) || Number(todayJkt.slice(5, 7));
    var tahun = Number(p.tahun) || Number(todayJkt.slice(0, 4));
    var id_guru = _uid();
    if (!id_guru) return { status: 'error', message: 'Sesi telah berakhir. Silakan login ulang.' };

    var data  = await _fetchAbsensiData({ bulan: bulan, tahun: tahun, scope: 'guru', id_guru: id_guru });
    var rekap = _deriveRekapAbsensi(data);
    var me = rekap.guru.filter(function(g) { return g.id_guru === id_guru; })[0] || {
      id_guru: id_guru, nama_guru: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || '',
      H: 0, DS: 0, HP: 0, HP_penuh: 0, I: 0, A: 0, L: 0, perlu_ditutup: 0, cells: {},
      pct_kehadiran: null, pct_durasi: null, izin_diganti: 0, hutang: { izin_alpa: 0, diganti: 0, sisa: 0 },
    };
    return { status: 'ok', data: {
      bulan: bulan, tahun: tahun, ambang: rekap.ambang, ambang_wajar: rekap.ambang_wajar,
      tanggal_list: rekap.tanggal_list, rekap: me,
    } };
  },

  // ── Halaqah ────────────────────────────────
  getHalaqahSaya: async function() {
    var { data, error } = await _sb.from('halaqah')
      .select('*').eq('id_guru', _uid()).eq('status', 'aktif').order('nama_halaqah');
    _check(error, 'getHalaqahSaya');
    if (data) {
      data = data.map(function(h) {
        return Object.assign({}, h, {
          jam_mulai: h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
          jam_selesai: h.jam_selesai ? h.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data };
  },

  // ── Murid ──────────────────────────────────
  getMurid: async function(id_halaqah) {
    var [anggotaRes, nilaiAll, hqRes] = await Promise.all([
      _sb.from('anggota').select('*, users!anggota_id_murid_fkey(no_hp, email)')
        .eq('id_halaqah', id_halaqah).eq('status', 'aktif').order('nama_murid'),
      _selectAllPaged('nilai_kbm', 'id_nilai, id_murid, status_hadir, adab, kamera_murid',
        function(q){ return q.eq('id_halaqah', id_halaqah).order('id_nilai'); }, 'getMurid:nilai_kbm'),
      _sb.from('halaqah').select('level').eq('id_halaqah', id_halaqah).maybeSingle(),
    ]);
    _check(anggotaRes.error, 'getMurid');

    var targetSesi = 40;
    if (hqRes && hqRes.data && hqRes.data.level) {
      var { data: lvl } = await _sb.from('level').select('jumlah_pertemuan').or('id_level.eq.' + hqRes.data.level + ',nama_level.eq.' + hqRes.data.level).maybeSingle();
      if (lvl && lvl.jumlah_pertemuan) targetSesi = lvl.jumlah_pertemuan;
    }

    // KhatamKu: perlu daftar id_murid dari anggotaRes dulu (tabel ini tak
    // punya id_halaqah, tak bisa ikut Promise.all paralel di atas) -- 1
    // query tambahan, bukan N+1 (semua murid halaqah ini sekaligus).
    var idMuridList = (anggotaRes.data || []).map(function(a){ return a.id_murid; });
    var khatamkuMap = {};
    if (idMuridList.length) {
      var { data: khatamkuRows } = await _sb.from('khatamku_progress_cache')
        .select('id_user, streak_days, dzikir_streak, total_khatam, last_active_date').in('id_user', idMuridList);
      (khatamkuRows || []).forEach(function(k){ khatamkuMap[k.id_user] = k; });
    }

    return { status: 'ok', data: (anggotaRes.data || []).map(function(a) {
      var nm = nilaiAll.filter(function(n) { return n.id_murid === a.id_murid; });
      var hadir = nm.filter(function(n) { return ['H','T'].includes(n.status_hadir); });
      var adabData   = hadir.filter(function(n) { return n.adab; });
      var kameraData = hadir.filter(function(n) { return n.kamera_murid; });
      var hadirCount = hadir.length;
      return Object.assign({}, a, {
        no_hp         : a.users && a.users.no_hp,
        email         : a.users && a.users.email,
        jumlah_hadir  : hadirCount,
        total_hadir   : hadirCount,
        total_sesi    : nm.length,
        pct_hadir     : nm.length > 0 ? Math.round(hadirCount / nm.length * 100) : 0,
        skor_hadir_raw: hadirCount,
        skor_dari_40  : Math.min(Math.round(hadirCount / targetSesi * 100), 100),
        poin_adab     : adabData.length > 0 ? Math.round(adabData.filter(function(n){return n.adab==='Baik';}).length / adabData.length * 100) : 0,
        poin_kamera   : kameraData.length > 0 ? Math.round(kameraData.filter(function(n){return n.kamera_murid==='kamera terbuka';}).length / kameraData.length * 100) : 0,
        khatamku      : khatamkuMap[a.id_murid] || null,
      });
    })};
  },

  getMuridBelum: async function(id_halaqah) {
    // Ambil semua murid yang belum di halaqah ini
    var { data: sudah } = await _sb.from('anggota')
      .select('id_murid').eq('id_halaqah', id_halaqah);
    var sudahIds = (sudah || []).map(function(a) { return a.id_murid; });
    var q = _sb.from('users').select(USER_COLS_CLIENT).eq('role', 'murid').eq('status', 'aktif');
    if (sudahIds.length > 0) q = q.not('id_user', 'in', '(' + sudahIds.join(',') + ')');
    var { data, error } = await q.order('nama_lengkap');
    _check(error, 'getMuridBelum');
    return { status: 'ok', data };
  },

  addMuridByGuru: async function(d) {
    var user = await _sb.from('users').select('nama_lengkap').eq('id_user', d.id_murid).single();
    var { error } = await _sb.from('anggota').insert({
      id_halaqah: d.id_halaqah, id_murid: d.id_murid,
      nama_murid: user.data && user.data.nama_lengkap,
      level: d.level, target_level: d.target_level, status: 'aktif',
    });
    _check(error, 'addMuridByGuru');
    return { status: 'ok', message: 'Murid berhasil ditambahkan' };
  },

  updateCatatanMurid: async function(d) {
    var { error } = await _sb.from('anggota')
      .update({ catatan_guru: d.catatan_guru }).eq('id_anggota', d.id_anggota);
    _check(error, 'updateCatatanMurid');
    return { status: 'ok' };
  },

  // ── KBM ────────────────────────────────────
  bukaKBM: async function(d) {
    // Guard sesi: cek sesi Supabase ASLI (bukan _uid() yang baca cache hq_user —
    // di kondisi setengah-login cache tetap terisi & lolos). Cegah insert yang
    // pasti kena RLS + beri pesan jelas alih-alih popup teknis.
    var _sess = await _sb.auth.getSession();
    if (!_sess.data || !_sess.data.session) return { status: 'error', message: 'Sesi telah berakhir. Silakan login ulang.' };
    // Cek tidak ada draft aktif
    var { data: draft } = await _sb.from('kbm_log')
      .select('id_kbm').eq('id_guru', _uid()).eq('status', 'draft').maybeSingle();
    if (draft) return { status: 'error', message: 'Masih ada sesi yang belum ditutup: ' + draft.id_kbm };

    // Hitung pertemuan_ke — masing-masing jenis sesi dihitung secara terpisah
    var countQ = _sb.from('kbm_log').select('*', { count: 'exact', head: true })
      .eq('id_halaqah', d.id_halaqah).eq('status', 'selesai')
      .eq('jenis_sesi', d.jenis_sesi || 'KBM Reguler');
    var { count } = await countQ;

    var id_kbm = _genId('KBM');
    var { data, error } = await _sb.from('kbm_log').insert({
      id_kbm, id_halaqah: d.id_halaqah,
      id_guru  : _uid(), nama_guru: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || '',
      tanggal_pertemuan: d.tanggal_pertemuan,
      jam_mulai: d.jam_mulai, jenis_sesi: d.jenis_sesi || 'KBM Reguler',
      pertemuan_ke: d.pertemuan_ke_custom || ((count || 0) + 1),
      status: 'draft',
      is_pengganti: !!d.is_pengganti,
    }).select().single();
    // Unique partial index uniq_kbm_log_draft_per_guru menolak draft kedua
    // untuk guru yang sama secara atomik di level DB (cegah race condition
    // saat dua tab/perangkat membuka sesi hampir bersamaan)
    if (error && error.code === '23505') {
      return { status: 'error', message: 'Masih ada sesi yang belum ditutup. Silakan tutup sesi sebelumnya terlebih dahulu.' };
    }
    _check(error, 'bukaKBM');
    if (data) {
      data.jam_mulai = data.jam_mulai ? data.jam_mulai.substring(0, 5) : null;
      data.jam_selesai = data.jam_selesai ? data.jam_selesai.substring(0, 5) : null;
    }
    return { status: 'ok', message: 'Sesi KBM berhasil dibuka', data };
  },

  // ── Kelas Pengganti: Flow 1 — tandai sesi hari ini sebagai libur ──
  tandaiLibur: async function(d) {
    // Guard sesi (lihat catatan di bukaKBM) — cek sesi Supabase asli.
    var _sess = await _sb.auth.getSession();
    if (!_sess.data || !_sess.data.session) return { status: 'error', message: 'Sesi telah berakhir. Silakan login ulang.' };
    var keterangan = (d.keterangan_libur || '').trim();
    if (!keterangan) return { status: 'error', message: 'Alasan libur wajib diisi' };

    // Cek tidak ada draft aktif (harus diselesaikan dulu lewat Flow 5a/5b)
    var { data: draft } = await _sb.from('kbm_log')
      .select('id_kbm').eq('id_guru', _uid()).eq('status', 'draft').maybeSingle();
    if (draft) return { status: 'error', message: 'Masih ada sesi yang belum diselesaikan: ' + draft.id_kbm };

    // Cegah duplikat: sesi (halaqah + tanggal + jenis_sesi) sudah dicatat hari ini
    var { data: existing } = await _sb.from('kbm_log')
      .select('id_kbm').eq('id_halaqah', d.id_halaqah).eq('tanggal_pertemuan', d.tanggal_pertemuan)
      .eq('jenis_sesi', d.jenis_sesi || 'KBM Reguler').maybeSingle();
    if (existing) return { status: 'error', message: 'Sudah ada catatan KBM untuk halaqah dan tanggal ini' };

    var id_kbm = _genId('KBM');
    var { data, error } = await _sb.from('kbm_log').insert({
      id_kbm, id_halaqah: d.id_halaqah,
      id_guru: _uid(), nama_guru: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || '',
      tanggal_pertemuan: d.tanggal_pertemuan,
      jenis_sesi: d.jenis_sesi || 'KBM Reguler',
      status: 'libur',
      keterangan_libur: keterangan,
      pertemuan_ke: null,
      is_pengganti: false,
    }).select().single();
    // H1 fix (bug hunt 2026-08-18, patch_089): unique partial index
    // uniq_kbm_log_libur_per_hari menolak baris libur kedua utk
    // halaqah+tanggal+jenis_sesi yang sama secara atomik di level DB (cegah
    // race condition saat guru tandai libur dari 2 tab/perangkat hampir
    // bersamaan) -- cek check-then-insert di atas tak cukup sendirian.
    if (error && error.code === '23505') {
      return { status: 'error', message: 'Sudah ada catatan KBM untuk halaqah dan tanggal ini' };
    }
    _check(error, 'tandaiLibur');
    return { status: 'ok', message: 'Sesi ditandai libur', data };
  },

  // ── Kelas Pengganti: Flow 5b — batalkan draft aktif & tandai libur ──
  batalkanTandaiLibur: async function(d) {
    var keterangan = (d.keterangan_libur || '').trim();
    if (!keterangan) return { status: 'error', message: 'Alasan libur wajib diisi' };

    var { data: draft } = await _sb.from('kbm_log')
      .select('id_kbm').eq('id_guru', _uid()).eq('status', 'draft').maybeSingle();
    if (!draft) return { status: 'error', message: 'Tidak ada sesi draft yang aktif' };

    // Bersihkan presensi/nilai parsial yang sudah terlanjur diisi pada draft ini.
    // M1 fix (bug hunt 2026-08-18): dulu error delete ini tak dicek -- kalau gagal
    // diam-diam, sesi tetap ditandai libur di bawah padahal presensi/nilai draft
    // lama masih tersisa (data hantu yang kontradiktif dengan status libur).
    var { error: delNilaiErr } = await _sb.from('nilai_kbm').delete().eq('id_kbm', draft.id_kbm);
    _check(delNilaiErr, 'batalkanTandaiLibur:delete_nilai');

    var { data, error } = await _sb.from('kbm_log').update({
      status: 'libur',
      keterangan_libur: keterangan,
      pertemuan_ke: null,
      is_pengganti: false,
      jumlah_hadir: null,
      jumlah_alpa: null,
    }).eq('id_kbm', draft.id_kbm).select().single();
    _check(error, 'batalkanTandaiLibur');
    return { status: 'ok', message: 'Sesi dibatalkan dan ditandai libur', data };
  },

  simpanPresensi: async function(d) {
    var tanggal = d.tanggal || d.tanggal_pertemuan;
    var rows = d.presensi.map(function(p) { return {
      id_kbm: d.id_kbm, id_halaqah: d.id_halaqah, id_murid: p.id_murid,
      status_hadir: p.status_hadir,
      pertemuan_ke: d.pertemuan_ke, tanggal: tanggal,
      jenis_sesi: d.jenis_sesi || 'KBM Reguler',
    }; });
    var { error } = await _sb.from('nilai_kbm')
      .upsert(rows, { onConflict: 'id_kbm,id_murid' });
    _check(error, 'simpanPresensi');
    var hadir = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    // jumlah_alpa di kbm_log = "tidak hadir" (Izin + Alpa) agar hadir+alpa selalu = total murid di sesi
    var alpa  = d.presensi.filter(function(p) { return ['I','A'].includes(p.status_hadir); }).length;
    // BUG-011 fix: sync tanggal_pertemuan ke kbm_log jika guru mengubah tanggal
    var { error: kbmErr } = await _sb.from('kbm_log').update({
      jumlah_hadir: hadir,
      jumlah_alpa: alpa,
      tanggal_pertemuan: tanggal,  // sinkronkan tanggal agar konsisten
    }).eq('id_kbm', d.id_kbm);
    _check(kbmErr, 'simpanPresensi:kbm_log');
    return { status: 'ok', message: 'Presensi berhasil disimpan', jumlah_hadir: hadir };
  },

  simpanNilaiMurid: async function(d) {
    var { error } = await _sb.from('nilai_kbm').update({
      adab: d.adab, kamera_murid: d.kamera_murid,
      koreksi_tahsin: d.koreksi_tahsin, catatan_murid: d.catatan_murid,
      nilai: d.nilai || null,
    }).eq('id_kbm', d.id_kbm).eq('id_murid', d.id_murid);
    _check(error, 'simpanNilaiMurid');
    return { status: 'ok' };
  },

  // KBM Qiyam: koreksi & catatan per murid per sesi (gaya KBM Reguler).
  // HANYA sentuh 2 kolom ini -- adab/kamera_murid/nilai TIDAK diubah (kamera
  // Qiyam disinkron terpisah oleh addSetoranHafalan). Baris nilai_kbm sudah
  // dibuat saat simpanPresensi, jadi .update() aman.
  simpanKoreksiCatatanKbm: async function(d) {
    var { error } = await _sb.from('nilai_kbm')
      .update({ koreksi_tahsin: d.koreksi_tahsin || null, catatan_murid: d.catatan_murid || null })
      .eq('id_kbm', d.id_kbm).eq('id_murid', d.id_murid);
    _check(error, 'simpanKoreksiCatatanKbm');
    return { status: 'ok' };
  },

  simpanNilaiMuridBatch: async function(d) {
    var updates = (d.nilai_list || d.nilai || []).map(function(n) { return {
      id_kbm: d.id_kbm, id_halaqah: d.id_halaqah, id_murid: n.id_murid,
      adab: n.adab, kamera_murid: n.kamera_murid,
      koreksi_tahsin: n.koreksi_tahsin, catatan_murid: n.catatan_murid,
      // Bug hunt lanjutan (2026-08-18): `n.nilai || null` adalah jebakan falsy-zero
      // -- Micro Teaching sengaja push nilai:0 utk murid Alpa saat jadwal sendiri
      // (kbm-module.js doSelesaiKBM, cabang isMicroteachingSesi), tapi `0 || null`
      // = null di JS, jadi absen-bernilai-0 tersimpan sbg NULL (tak beda dgn
      // "belum dinilai"). Dampak nyata: _kalkulasiRaport (baris ~3396-3402)
      // MENGECUALIKAN baris nilai=null dari rata-rata komponen micro teaching --
      // murid yg BOLOS praktik mengajar jadi lolos tanpa nilai 0 yg semestinya
      // menekan rata-ratanya, bukannya dikecualikan. Fix: pertahankan 0 eksplisit,
      // biarkan null/undefined/string kosong tetap null spt semula (sesi lain --
      // KBM Reguler/Qiyam -- tak pernah kirim nilai berarti, field ini legacy utk itu).
      nilai: n.nilai === 0 ? 0 : (n.nilai || null),
    }; });
    if (!updates.length) return { status: 'ok' };
    var { error } = await _sb.from('nilai_kbm')
      .upsert(updates, { onConflict: 'id_kbm,id_murid' });
    _check(error, 'simpanNilaiMuridBatch');
    return { status: 'ok' };
  },

  simpanJurnalKBM: async function(d) {
    var { error } = await _sb.from('kbm_log').update({
      materi_belajar: d.materi_belajar, pencapaian_modul: d.pencapaian_modul,
      halaman_modul: d.halaman_modul, metode: d.metode, catatan_umum: d.catatan_umum,
      jam_selesai: d.jam_selesai, latihan_mandiri: d.latihan_mandiri,
      jenis_latihan: d.jenis_latihan || null, deadline_latihan: d.deadline_latihan || null,
      referensi_url: d.referensi_url || null,
    }).eq('id_kbm', d.id_kbm);
    _check(error, 'simpanJurnalKBM');
    return { status: 'ok', message: 'Jurnal KBM berhasil disimpan' };
  },

  getLastKbmWithPr: async function(id_halaqah) {
    var { data, error } = await _sb.from('kbm_log')
      .select('tanggal_pertemuan, latihan_mandiri')
      .eq('id_halaqah', id_halaqah)
      .not('latihan_mandiri', 'is', null)
      .neq('latihan_mandiri', '')
      .eq('status', 'selesai')
      .order('tanggal_pertemuan', { ascending: false })
      .limit(1);
    _check(error, 'getLastKbmWithPr');
    return { status: 'ok', data: data ? data[0] : null };
  },

  tutupKBM: async function(id_kbm) {
    var { count } = await _sb.from('nilai_kbm').select('*', { count: 'exact', head: true }).eq('id_kbm', id_kbm);
    if (count === null || count === 0) {
      // Tidak auto-delete — guru harus aktif memilih hapus via hapusKBM()
      return { status: 'error', message: 'Belum ada presensi murid. Isi presensi dulu atau hapus sesi secara manual.' };
    }
    var { data: kbm } = await _sb.from('nilai_kbm').select('status_hadir').eq('id_kbm', id_kbm);
    var hadir = (kbm || []).filter(function(n) { return ['H','T'].includes(n.status_hadir); }).length;
    // jumlah_alpa di kbm_log = "tidak hadir" (Izin + Alpa) agar hadir+alpa selalu = total murid di sesi
    var alpa  = (kbm || []).filter(function(n) { return ['I','A'].includes(n.status_hadir); }).length;
    var { error } = await _sb.from('kbm_log').update({
      status: 'selesai', jumlah_hadir: hadir, jumlah_alpa: alpa,
    }).eq('id_kbm', id_kbm);
    _check(error, 'tutupKBM');
    // Push setelah sesi ditutup (fire-and-forget, tidak blocking)
    (async function() {
      try {
        var { data: kbmData } = await _sb.from('kbm_log')
          .select('id_halaqah, pertemuan_ke, nama_guru, tanggal_pertemuan, materi_belajar, pencapaian_modul')
          .eq('id_kbm', id_kbm).single();
        if (!kbmData) return;

        // 1. Push ke ketua kelas — window observasi terbuka (+ rekap jika jurnal sudah diisi)
        var { data: anggota } = await _sb.from('anggota')
          .select('id_murid, is_ketua').eq('id_halaqah', kbmData.id_halaqah).eq('status','aktif');
        var ketuaIds = (anggota || []).filter(function(a){ return a.is_ketua; }).map(function(a){ return a.id_murid; });
        if (ketuaIds.length) {
          // Jurnal (materi_belajar/pencapaian_modul) baru terisi jika guru mengisi sebelum tutup sesi —
          // guru juga bisa "Tutup tanpa jurnal", jadi rekap hanya disebut kalau datanya sudah ada.
          var jurnalSudahAda = !!(kbmData.materi_belajar || kbmData.pencapaian_modul);
          var bodyMsg = 'Sesi pertemuan ke-' + (kbmData.pertemuan_ke || '') + ' selesai. Window observasi terbuka — isi sebelum guru mulai sesi berikutnya.';
          if (jurnalSudahAda) bodyMsg += ' Jangan lupa kirim Rekap Sesi ke grup WA juga ya.';
          _sendPushBg({
            user_ids: ketuaIds,
            title: '📋 Isi Observasi KBM Sekarang!',
            body : bodyMsg,
            url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
            tag  : 'observasi-window-' + id_kbm,
            data : { trigger: 'observasi_terbuka', id_kbm: id_kbm },
          });
        }

        // 2. Push ke murid yang ALPA — cek push_config.enabled dulu
        var { data: cfg } = await _sb.from('push_config').select('enabled').eq('key','kbm_absen').maybeSingle();
        var kbmAbsenEnabled = cfg ? cfg.enabled === true : true; // null/false → nonaktif; default aktif jika tidak ada row
        if (kbmAbsenEnabled) {
          var { data: alpaMurid } = await _sb.from('nilai_kbm')
            .select('id_murid').eq('id_kbm', id_kbm).eq('status_hadir', 'A');
          var alpaIds = (alpaMurid || []).map(function(r){ return r.id_murid; });
          if (alpaIds.length) {
            var tgl = kbmData.tanggal_pertemuan
              ? new Date(kbmData.tanggal_pertemuan + 'T00:00:00+07:00').toLocaleDateString('id-ID', {timeZone:'Asia/Jakarta', weekday:'long', day:'numeric', month:'long'})
              : 'hari ini';
            _sendPushBg({
              user_ids: alpaIds,
              title   : '🤲 Catatan Kehadiran KBM',
              body    : 'Qadarullah kami mendapati Anda absen di KBM ' + tgl + '. Semoga Anda baik saja dan mohon segera komunikasi kepada Guru Halaqah. Baarakallahu fiikum',
              url     : '/Portal-Halaqah-Rattililquran/murid/index.html',
              tag     : 'kbm-absen-' + id_kbm,
              data    : { trigger: 'kbm_absen', id_kbm: id_kbm },
            });
          }
        }
      } catch(e) {}
    })();
    return { status: 'ok', message: 'Sesi KBM berhasil ditutup. Jazakallah khairan!', data: { id_kbm, jumlah_hadir: hadir } };
  },

  hapusKBM: async function(id_kbm) {
    await _sb.from('nilai_kbm').delete().eq('id_kbm', id_kbm);
    var { error } = await _sb.from('kbm_log').delete().eq('id_kbm', id_kbm);
    _check(error, 'hapusKBM');
    return { status: 'ok', message: 'Sesi KBM berhasil dihapus' };
  },

  editPresensi: async function(d) {
    // L2 fix (bug hunt 2026-08-18): dulu payload upsert nilai_kbm tak menyertakan
    // tanggal/jenis_sesi -- kalau ada murid BARU (belum punya baris nilai_kbm utk
    // id_kbm ini) di antara yg diedit, insert-nya lahir dgn kolom itu NULL (kolom
    // denormalisasi ini dipakai getRiwayatMuridKoreksi utk filter langsung). Ambil
    // jenis_sesi dari kbm_log (tanggal_pertemuan sdh dikirim caller sbg d.tanggal_pertemuan).
    var { data: kbmRow } = await _sb.from('kbm_log').select('jenis_sesi').eq('id_kbm', d.id_kbm).maybeSingle();
    var jenisSesi = (kbmRow && kbmRow.jenis_sesi) || d.jenis_sesi || 'KBM Reguler';
    var rows = d.presensi.map(function(p) { return {
      id_kbm: d.id_kbm, id_halaqah: d.id_halaqah, id_murid: p.id_murid, status_hadir: p.status_hadir,
      tanggal: d.tanggal_pertemuan || undefined, jenis_sesi: jenisSesi,
    }; });
    var { error } = await _sb.from('nilai_kbm').upsert(rows, { onConflict: 'id_kbm,id_murid' });
    _check(error, 'editPresensi');
    var hadir = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    // jumlah_alpa di kbm_log = "tidak hadir" (Izin + Alpa) agar hadir+alpa selalu = total murid di sesi
    var alpa  = d.presensi.filter(function(p) { return ['I','A'].includes(p.status_hadir); }).length;
    var upd = { jumlah_hadir: hadir, jumlah_alpa: alpa };
    // Update tanggal & pertemuan_ke di kbm_log jika berubah
    if (d.tanggal_pertemuan) upd.tanggal_pertemuan = d.tanggal_pertemuan;
    if (d.pertemuan_ke)      upd.pertemuan_ke      = d.pertemuan_ke;
    var { error: kbmErr } = await _sb.from('kbm_log').update(upd).eq('id_kbm', d.id_kbm);
    _check(kbmErr, 'editPresensi:kbm_log');
    return { status: 'ok', message: 'Presensi berhasil diperbarui' };
  },

  getKBMByHalaqah: async function(id_halaqah, limit, offset) {
    var { data, error, count } = await _sb.from('kbm_log')
      .select('*', { count: 'exact' }).eq('id_halaqah', id_halaqah)
      .order('tanggal_pertemuan', { ascending: false })
      .range(offset || 0, (offset || 0) + (limit || 10) - 1);
    _check(error, 'getKBMByHalaqah');
    if (data) {
      data = data.map(function(k) {
        return Object.assign({}, k, {
          jam_mulai: k.jam_mulai ? k.jam_mulai.substring(0, 5) : null,
          jam_selesai: k.jam_selesai ? k.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data, total: count, has_more: (offset||0) + (limit||10) < count };
  },

  getNilaiByKBM: async function(id_kbm) {
    var [nilaiRes, kbmRes] = await Promise.all([
      _sb.from('nilai_kbm').select('*').eq('id_kbm', id_kbm),
      _sb.from('kbm_log').select('jenis_sesi').eq('id_kbm', id_kbm).maybeSingle()
    ]);
    _check(nilaiRes.error, 'getNilaiByKBM');
    var data = nilaiRes.data || [];
    var kbm = kbmRes.data || null;
    var jenisSesi = kbm ? kbm.jenis_sesi : 'KBM Reguler';

    // Ambil nama murid terpisah untuk hindari ambiguitas FK join
    var ids = data.map(function(r) { return r.id_murid; });
    var namaMap = {};
    if (ids.length > 0) {
      var { data: users } = await _sb.from('users').select('id_user, nama_lengkap').in('id_user', ids);
      (users || []).forEach(function(u) { namaMap[u.id_user] = u.nama_lengkap; });
    }

    var setoranMap = {};
    var setoranListMap = {};
    var setoranCount = {};
    if (jenisSesi === 'KBM Qiyam') {
      var { data: setoranData } = await _sb.from('setoran_hafalan').select('*').eq('id_kbm', id_kbm);
      (setoranData || []).forEach(function(s) {
        setoranMap[s.id_murid] = s;               // last-wins (dipertahankan untuk kompat pemanggil lama)
        if (!setoranListMap[s.id_murid]) setoranListMap[s.id_murid] = [];
        setoranListMap[s.id_murid].push(s);
        setoranCount[s.id_murid] = (setoranCount[s.id_murid] || 0) + 1;
      });
    }

    return { status: 'ok', data: data.map(function(r) {
      return Object.assign({}, r, {
        nama_murid: namaMap[r.id_murid] || r.id_murid,
        jenis_sesi: jenisSesi,
        hafalan: setoranMap[r.id_murid] || null,
        hafalan_list: setoranListMap[r.id_murid] || [],
        hafalan_count: setoranCount[r.id_murid] || 0
      });
    })};
  },

  getPresensiByKBM: async function(id_kbm) {
    var [nilaiRes, kbmRes] = await Promise.all([
      _sb.from('nilai_kbm').select('id_murid, status_hadir').eq('id_kbm', id_kbm),
      _sb.from('kbm_log').select('id_kbm, id_halaqah, tanggal_pertemuan, pertemuan_ke').eq('id_kbm', id_kbm).maybeSingle(),
    ]);
    _check(nilaiRes.error, 'getPresensiByKBM');
    var ids = (nilaiRes.data || []).map(function(r) { return r.id_murid; });
    var namaMap = {};
    if (ids.length > 0) {
      var { data: users } = await _sb.from('users').select('id_user, nama_lengkap').in('id_user', ids);
      (users || []).forEach(function(u) { namaMap[u.id_user] = u.nama_lengkap; });
    }
    return { status: 'ok', kbm: kbmRes.data || null, data: (nilaiRes.data || []).map(function(r) {
      return { id_murid: r.id_murid, status_hadir: r.status_hadir, nama_murid: namaMap[r.id_murid] || r.id_murid };
    })};
  },

  // Ambil field Jurnal & Latihan Mandiri sebuah sesi untuk fitur Edit KBM.
  // Field-field ini TIDAK memengaruhi kalkulasi raport (deskriptif), jadi aman
  // diedit kapan pun. pr_submitted_count dipakai guard: peringatkan guru bila
  // sudah ada murid yang mengumpulkan PR sebelum ia mengubah teks/jenis latihan.
  getJurnalByKBM: async function(id_kbm) {
    var [kbmRes, prRes] = await Promise.all([
      _sb.from('kbm_log').select('id_kbm, jenis_sesi, materi_belajar, pencapaian_modul, halaman_modul, metode, catatan_umum, jam_selesai, latihan_mandiri, jenis_latihan, deadline_latihan, referensi_url').eq('id_kbm', id_kbm).maybeSingle(),
      _sb.from('nilai_kbm').select('id_nilai', { count: 'exact', head: true }).eq('id_kbm', id_kbm).not('pr_submitted_at', 'is', null),
    ]);
    _check(kbmRes.error, 'getJurnalByKBM');
    var kbm = kbmRes.data || null;
    if (kbm && kbm.jam_selesai) kbm.jam_selesai = String(kbm.jam_selesai).substring(0, 5);
    return { status: 'ok', data: kbm, pr_submitted_count: prRes.count || 0 };
  },

  // Guard raport: raport adalah SNAPSHOT beku di tabel `raport` (bukan live),
  // jadi mengedit presensi/nilai setelah raport digenerate TIDAK otomatis
  // memperbarui raport. Fungsi ini mendeteksi apakah sesi (id_kbm) jatuh dalam
  // periode yang raportnya SUDAH dibuat untuk halaqah tsb — dipakai klien untuk
  // memperingatkan guru agar men-generate ulang. Baca-saja, tak mengubah apa pun.
  cekRaportTerdampak: async function(id_kbm) {
    var { data: kbm } = await _sb.from('kbm_log')
      .select('tanggal_pertemuan, id_halaqah').eq('id_kbm', id_kbm).maybeSingle();
    if (!kbm || !kbm.tanggal_pertemuan || !kbm.id_halaqah) return { status: 'ok', ada: false };
    var tgl = kbm.tanggal_pertemuan;
    // Periode yang rentang tanggalnya memuat tanggal sesi (abaikan periode tanpa rentang)
    var { data: periodes } = await _sb.from('periode')
      .select('id_periode, nama_periode')
      .not('tanggal_mulai', 'is', null).not('tanggal_selesai', 'is', null)
      .lte('tanggal_mulai', tgl).gte('tanggal_selesai', tgl);
    if (!periodes || !periodes.length) return { status: 'ok', ada: false };
    var periodeIds = periodes.map(function(p) { return p.id_periode; });
    // Raport halaqah ini di periode2 tsb (RLS guru_all_raport membatasi ke halaqah miliknya)
    var { data: raports } = await _sb.from('raport')
      .select('id_periode, status').eq('id_halaqah', kbm.id_halaqah).in('id_periode', periodeIds);
    if (!raports || !raports.length) return { status: 'ok', ada: false };
    var published = raports.some(function(r) { return r.status === 'published'; });
    var terdampak = {}; raports.forEach(function(r) { terdampak[r.id_periode] = 1; });
    var nama = periodes.filter(function(p) { return terdampak[p.id_periode]; })
      .map(function(p) { return p.nama_periode; }).join(', ');
    return { status: 'ok', ada: true, published: published, nama_periode: nama, jumlah: raports.length };
  },

  // ── Fase 2: server staging draft nilai KBM (kbm_draft) ──
  // JSON inert; TIDAK menggantikan commit final. Melempar error bila gagal
  // (mis. tabel belum dibuat) → pemanggil di klien menangkap & no-op (fallback
  // ke localStorage). Lihat patch_047_kbm_draft.sql.
  saveKbmDraftServer: async function(d) {
    var { error } = await _sb.from('kbm_draft').upsert({
      id_kbm     : d.id_kbm,
      id_guru    : _uid(),
      jenis_sesi : d.jenis_sesi || null,
      draft      : d.draft || {},
      updated_at : new Date().toISOString(),
    }, { onConflict: 'id_kbm' });
    _check(error, 'saveKbmDraftServer');
    return { status: 'ok' };
  },

  getKbmDraftServer: async function(id_kbm) {
    var { data, error } = await _sb.from('kbm_draft')
      .select('draft, updated_at, jenis_sesi').eq('id_kbm', id_kbm).maybeSingle();
    _check(error, 'getKbmDraftServer');
    return { status: 'ok', data: data || null };
  },

  clearKbmDraftServer: async function(id_kbm) {
    var { error } = await _sb.from('kbm_draft').delete().eq('id_kbm', id_kbm);
    _check(error, 'clearKbmDraftServer');
    return { status: 'ok' };
  },

  getRiwayatMuridKoreksi: async function(id_murid, limit) {
    var { data, error } = await _sb.from('nilai_kbm')
      .select('koreksi_tahsin, catatan_murid, adab, tanggal, pertemuan_ke, jenis_sesi')
      .eq('id_murid', id_murid).neq('koreksi_tahsin', '')
      .or('jenis_sesi.neq.Micro Teaching,jenis_sesi.is.null')
      .order('tanggal', { ascending: false }).limit(limit || 10);
    _check(error, 'getRiwayatMuridKoreksi');
    return { status: 'ok', data };
  },

  // ── Pengumuman ─────────────────────────────
  kirimPengumuman: async function(d) {
    var { data, error } = await _sb.from('pengumuman').insert({
      judul: d.judul, isi: d.isi,
      target: d.target || 'semua', id_halaqah: d.id_halaqah || null,
      dibuat_oleh: _uid(), nama_pembuat: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || 'Guru',
      tanggal: _localDate(), status: 'aktif',
    }).select().single();
    _check(error, 'kirimPengumuman');
    // Push: jika target = 'semua' → role_filter null (semua role)
    // jika target = id_halaqah → ambil dulu murid halaqah tersebut
    if (d.target === 'semua') {
      _sendPushBg({
        title: '📢 ' + (d.judul || 'Pengumuman Baru'),
        body : (d.isi || '').slice(0, 100),
        url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
        tag  : 'pengumuman-' + (data && data.id || Date.now()),
        data : { trigger: 'pengumuman' },
      });
    } else if (d.id_halaqah) {
      // Ambil murid halaqah tersebut secara async
      _sb.from('anggota').select('id_murid').eq('id_halaqah', d.id_halaqah).eq('status','aktif')
        .then(function(res) {
          var ids = (res.data || []).map(function(a){ return a.id_murid; });
          if (ids.length) _sendPushBg({
            user_ids: ids,
            title: '📢 ' + (d.judul || 'Pengumuman Baru'),
            body : (d.isi || '').slice(0, 100),
            url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
            tag  : 'pengumuman-' + (data && data.id || Date.now()),
            data : { trigger: 'pengumuman' },
          });
        }).catch(function(){});
    }
    return { status: 'ok', data };
  },

  // ── Template koreksi ───────────────────────
  getTemplateKoreksi: async function() {
    var { data, error } = await _sb.from('template_koreksi')
      .select('kategori, teks, urutan').eq('status', 'aktif').order('urutan');
    _check(error, 'getTemplateKoreksi');
    // Frontend expects: { 'Tajwid': [{teks:...}, ...], 'Makhraj': [...] }
    var grouped = {};
    (data || []).forEach(function(row) {
      if (!grouped[row.kategori]) grouped[row.kategori] = [];
      grouped[row.kategori].push({ teks: row.teks });
    });
    return { status: 'ok', data: grouped };
  },

  // ── Riwayat KBM ───────────────────────────
  getRiwayatKBM: async function(id_halaqah, limit, offset) {
    var q = _sb.from('kbm_log').select('*')
      .eq('id_halaqah', id_halaqah)
      .order('tanggal_pertemuan', { ascending: false })
      .limit(limit || 30);
    if (offset) q = q.range(offset, offset + (limit || 30) - 1);
    var { data, error } = await q;
    _check(error, 'getRiwayatKBM');
    if (data) {
      data = data.map(function(k) {
        return Object.assign({}, k, {
          jam_mulai: k.jam_mulai ? k.jam_mulai.substring(0, 5) : null,
          jam_selesai: k.jam_selesai ? k.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data: data || [] };
  },

  // ── Keaktifan ──────────────────────────────
  getKeaktifanAlerts: async function() {
    var { data, error } = await _sb.rpc('get_keaktifan_alerts', { p_id_guru: _uid() });
    _check(error, 'getKeaktifanAlerts');
    var raw = data || { alerts: [], summary: { kritis: 0, peringatan: 0, normal: 0 } };
    var alertList = raw.alerts || [];

    // Ambil no_hp dari users
    var hpMap = {};
    if (alertList.length) {
      var ids = alertList.map(function(m){ return m.id_murid; });
      var { data: users } = await _sb.from('users').select('id_user, no_hp').in('id_user', ids);
      (users || []).forEach(function(u){ hpMap[u.id_user] = u.no_hp; });
    }

    // Ambil riwayat 15 sesi terakhir — per murid secara paralel (bukan 1 query global)
    // Ini memastikan setiap murid benar-benar mendapat 15 baris, bukan terpotong limit global
    var riwayatMap = {};
    // Iterasi per pasangan (id_murid, id_halaqah) agar murid multi-halaqah tidak saling timpa
    var alertPairs = alertList.filter(function(m){ return m.status !== 'normal'; });
    var alertIds   = alertPairs.map(function(m){ return m.id_murid; }); // untuk followup query
    if (alertPairs.length) {
      // Batch paralel: ambil 15 sesi per pasangan sekaligus (maksimal 10 paralel)
      var BATCH = 10;
      for (var bi = 0; bi < alertPairs.length; bi += BATCH) {
        var batch = alertPairs.slice(bi, bi + BATCH);
        await Promise.all(batch.map(function(pair) {
          var id_murid   = pair.id_murid;
          var id_halaqah = pair.id_halaqah;
          return _sb.from('nilai_kbm')
            .select('id_murid, id_halaqah, status_hadir, kamera_murid, kbm_log!nilai_kbm_id_kbm_fkey(tanggal_pertemuan, jenis_sesi)')
            .eq('id_murid', id_murid)
            .eq('id_halaqah', id_halaqah)
            .order('id_kbm', { ascending: false })
            .limit(15)
            .then(function(res) {
              (res.data || []).forEach(function(s) {
                if (!s.kbm_log || s.kbm_log.jenis_sesi !== 'KBM Reguler') return;
                var key = s.id_murid + '_' + s.id_halaqah;
                if (!riwayatMap[key]) riwayatMap[key] = [];
                var warna = 'hijau';
                if (s.status_hadir === 'A') warna = 'merah';
                else if (s.status_hadir === 'I') warna = 'abu';
                else if (s.status_hadir === 'T') warna = 'kuning';
                else if (s.kamera_murid && (s.kamera_murid.includes('selalu') || s.kamera_murid.includes('sering'))) warna = 'coklat';
                riwayatMap[key].push({
                  tanggal     : (s.kbm_log && s.kbm_log.tanggal_pertemuan) || '-',
                  status_hadir: s.status_hadir || 'H',
                  kamera_murid: s.kamera_murid || 'kamera terbuka',
                  warna       : warna,
                });
              });
            });
        }));
      }
    }

    // Ambil data dismissal dari anggota untuk SEMUA murid di alerts
    // Key: id_murid + '_' + id_halaqah — satu murid bisa di banyak halaqah
    var followupMap = {};
    if (alertIds.length) {
      // M6 fix (bug hunt 2026-08-18): tambah kolom baseline followup_terlambat/
      // followup_kamera (lihat catatan di bawah) -- dulu cuma followup_alpa_kbm yg
      // dibaca, jadi flag "Sering Terlambat"/"Kamera Tertutup" tak pernah bisa
      // di-dismiss (selalu >= ambang selamanya, counter kumulatif tak pernah reset).
      var { data: followupRows } = await _sb.from('anggota')
        .select('id_murid, id_halaqah, followup_alpa_kbm, followup_terlambat, followup_kamera, followup_alpa_at, followup_at, followup_khatamku_at')
        .in('id_murid', alertIds);
      (followupRows || []).forEach(function(r) { followupMap[r.id_murid + '_' + r.id_halaqah] = r; });
    }

    var alerts = alertList.map(function(m) {
      var hariTakAktifKhatamku = hariSejakWIB(m.khatamku_last_active) || 0;
      var metrics = {
        absen           : m.alpa || 0,
        terlambat       : m.terlambat || 0,
        kamera_tertutup : m.kamera_buruk || 0,
        khatamku_hari_tidak_aktif: m.khatamku_tidak_aktif ? hariTakAktifKhatamku : 0,
      };
      // Compute flags dari metrics — filter yang sudah di-dismiss guru (persisten via DB)
      var dismissed   = followupMap[m.id_murid + '_' + m.id_halaqah] || {};
      var kbmBase       = dismissed.followup_alpa_kbm   || 0;
      var terlambatBase = dismissed.followup_terlambat  || 0;
      var kameraBase    = dismissed.followup_kamera     || 0;
      var flags = [];
      if (metrics.absen >= 1 && metrics.absen > kbmBase)
        flags.push({ tipe:'absen',    label:'Absen/Alpa',       detail: metrics.absen + 'x',           count: metrics.absen });
      if (metrics.terlambat >= 2 && metrics.terlambat > terlambatBase)
        flags.push({ tipe:'terlambat',label:'Sering Terlambat', detail: metrics.terlambat + 'x',       count: metrics.terlambat });
      if (metrics.kamera_tertutup >= 2 && metrics.kamera_tertutup > kameraBase)
        flags.push({ tipe:'kamera',   label:'Kamera Tertutup',  detail: metrics.kamera_tertutup + 'x', count: metrics.kamera_tertutup });
      // KhatamKu: BUKAN count-baseline (metrik ini bisa reset ke 0 kalau murid
      // baca lagi, beda dari 3 kriteria di atas yg cuma naik) -- dismiss pakai
      // cooldown 3 hari sejak followup_khatamku_at, bukan bandingkan angka.
      if (metrics.khatamku_hari_tidak_aktif >= 3) {
        var cooldownAktif = dismissed.followup_khatamku_at &&
          (Date.now() - new Date(dismissed.followup_khatamku_at).getTime()) < 3*24*60*60*1000;
        if (!cooldownAktif) {
          flags.push({ tipe:'khatamku', label:'Belum Baca KhatamKu', detail: metrics.khatamku_hari_tidak_aktif + ' hari', count: metrics.khatamku_hari_tidak_aktif });
        }
      }

      var riwayatKey = m.id_murid + '_' + m.id_halaqah;
      return {
        id_murid    : m.id_murid,
        nama_murid  : m.nama,
        no_hp       : hpMap[m.id_murid] || '',
        id_halaqah  : m.id_halaqah,
        nama_halaqah: m.nama_halaqah || '',
        level       : m.level || '',
        status      : m.status,
        metrics     : metrics,
        flags       : flags,
        riwayat     : (riwayatMap[riwayatKey] || []).slice().reverse(), // cronologis, slice() cegah mutasi
      };
    });
    return { status: 'ok', data: { alerts: alerts, summary: raw.summary } };
  },

  simpanFollowupKeaktifan: async function(d) {
    // Ambil baris anggota — filter per halaqah jika diketahui, hindari maybeSingle() crash multi-halaqah
    var q = _sb.from('anggota')
      .select('id_halaqah, catatan_guru, followup_alpa_kbm, followup_alpa_at')
      .eq('id_murid', d.id_murid).eq('status','aktif');
    if (d.id_halaqah) q = q.eq('id_halaqah', d.id_halaqah);
    var { data: rows, error: anggotaErr } = await q;
    _check(anggotaErr, 'simpanFollowupKeaktifan.fetch');
    var anggota = rows && rows[0];
    if (!anggota) return { status: 'ok' };
    var id_halaqah = anggota.id_halaqah;

    // Hitung alpa KBM dan At-Tibyan per halaqah sebagai baseline dismissal.
    // M6 fix (bug hunt 2026-08-18): tambah baseline terlambat & kamera_buruk (sama
    // predikat dgn get_keaktifan_alerts RPC: status_hadir='T', kamera_murid ilike
    // '%selalu%'/'%sering%') -- dulu HANYA alpa yg di-baseline, jadi flag "Sering
    // Terlambat"/"Kamera Tertutup" tak pernah bisa di-dismiss (counter kumulatif
    // tak pernah reset, selalu >= ambang selamanya walau guru sudah menghubungi).
    var [kbmRes, atRes, terlambatRes, kameraRes] = await Promise.all([
      _sb.from('nilai_kbm').select('*',{count:'exact',head:true}).eq('id_murid',d.id_murid).eq('id_halaqah',id_halaqah).eq('status_hadir','A'),
      _sb.from('at_tibyan_log').select('*',{count:'exact',head:true}).eq('id_murid',d.id_murid).eq('status_hadir','A'),
      _sb.from('nilai_kbm').select('*',{count:'exact',head:true}).eq('id_murid',d.id_murid).eq('id_halaqah',id_halaqah).eq('status_hadir','T'),
      _sb.from('nilai_kbm').select('*',{count:'exact',head:true}).eq('id_murid',d.id_murid).eq('id_halaqah',id_halaqah)
        .or('kamera_murid.ilike.%selalu%,kamera_murid.ilike.%sering%'),
    ]);
    var kbmAlpa   = kbmRes.count       || 0;
    var atAlpa    = atRes.count        || 0;
    var terlambat = terlambatRes.count || 0;
    var kamera    = kameraRes.count    || 0;

    // Simpan catatan — batasi 10 entri terakhir agar tidak tumbuh tak terbatas
    var tglStr = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' });
    var tambahan = d.catatan ? ' (' + d.catatan + ')' : '';
    var baris  = '[' + tglStr + '] Sudah dihubungi — ' + (d.tipe_alert||'keaktifan') + ' (' + (d.value||0) + 'x)' + tambahan;
    var existing = anggota.catatan_guru ? anggota.catatan_guru.split('\n').filter(Boolean) : [];
    existing.push(baris);
    var catatan = existing.slice(-10).join('\n'); // simpan maksimal 10 entri

    var { error } = await _sb.from('anggota').update({
      catatan_guru      : catatan,
      followup_alpa_kbm : kbmAlpa,
      followup_alpa_at  : atAlpa,
      followup_terlambat: terlambat,
      followup_kamera   : kamera,
      followup_at       : new Date().toISOString(),
      // followup_khatamku_at: pola BEDA drpd 4 kolom di atas (count-baseline) --
      // ini cooldown timestamp, krn metrik "hari tak aktif" bisa reset (murid
      // baca lagi), bukan monoton naik. Ikut ditulis di sini (dismiss semua
      // flag murid ini bersamaan) supaya konsisten dgn perilaku existing.
      followup_khatamku_at: new Date().toISOString(),
    }).eq('id_murid', d.id_murid).eq('id_halaqah', id_halaqah);
    _check(error, 'simpanFollowupKeaktifan');
    return { status: 'ok' };
  },

  // ── Assessment ─────────────────────────────
  getAssessmentRekap: async function(id_halaqah) {
    var { data: anggota } = await _sb.from('anggota').select('id_murid, nama_murid, level').eq('id_halaqah', id_halaqah).eq('status','aktif');
    if (!anggota || !anggota.length) return { status:'ok', data:[], total_items:0, level:'' };
    // M7 fix (bug hunt 2026-08-18): dulu level diambil dari anggota[0].level --
    // baris pertama dari urutan yang tak dijamin (arbitrary), jadi hasilnya bisa
    // beda tiap kali dipanggil kalau ada anomali murid ber-level beda dari
    // halaqah-nya sendiri. Level halaqah (tabel halaqah, sumber kebenaran
    // kurikulum kelas ini) jauh lebih deterministik drpd menebak dari anggota.
    var { data: hqRow } = await _sb.from('halaqah').select('level').eq('id_halaqah', id_halaqah).maybeSingle();
    var level    = (hqRow && hqRow.level) || anggota[0].level || 'Level 1';
    var muridIds = anggota.map(function(a){ return a.id_murid; });
    var [itemsRes, jawabanRes] = await Promise.all([
      _sb.from('assessment_items').select('id_item, kategori, teks_latin, teks_arab, keterangan, urutan').eq('level', level).eq('status','aktif').order('urutan'),
      _sb.from('assessment_murid').select('id_murid, id_item, status, status_guru, updated_at').in('id_murid', muridIds),
    ]);
    var items      = itemsRes.data  || [];
    var totalItems = items.length;
    var itemSet    = new Set(items.map(function(i){ return i.id_item; }));
    // Group jawaban per murid
    var jawabanMap = {};
    (jawabanRes.data || []).forEach(function(j) {
      if (!jawabanMap[j.id_murid]) jawabanMap[j.id_murid] = { items:{}, last_update: null };
      jawabanMap[j.id_murid].items[j.id_item] = { status: j.status, status_guru: j.status_guru };
      if (!jawabanMap[j.id_murid].last_update || j.updated_at > jawabanMap[j.id_murid].last_update)
        jawabanMap[j.id_murid].last_update = j.updated_at;
    });
    var data = anggota.map(function(m) {
      var mj = jawabanMap[m.id_murid] || { items:{}, last_update: null };
      var paham=0, ragu=0, belum=0, kosong=0;
      var detail = items.map(function(it) {
        var ans = mj.items[it.id_item] || { status: null, status_guru: null };
        var s = ans.status;
        if      (s === 'paham') paham++;
        else if (s === 'ragu' ) ragu++;
        else if (s === 'belum') belum++;
        else kosong++;
        return {
          id_item: it.id_item,
          kategori: it.kategori,
          teks_latin: it.teks_latin,
          teks_arab: it.teks_arab,
          keterangan: it.keterangan,
          urutan: it.urutan,
          jawaban: s,
          jawaban_guru: ans.status_guru
        };
      });
      return { 
        id_murid: m.id_murid, 
        nama_murid: m.nama_murid, 
        level: m.level || level,
        summary: { paham, ragu, belum, kosong }, 
        pct_paham: totalItems > 0 ? Math.round(paham / totalItems * 100) : 0, 
        last_update: mj.last_update,
        detail: detail
      };
    }).sort(function(a,b){ return a.pct_paham - b.pct_paham; });
    return { status:'ok', data, total_items: totalItems, level };
  },

  simpanVerifikasiGuru: async function(d) {
    var id_murid = d.id_murid;
    var id_item  = d.id_item;
    var status_guru = d.status_guru;
    var { error } = await _sb.from('assessment_murid').upsert({
      id_murid: id_murid,
      id_item: id_item,
      status_guru: status_guru,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id_murid,id_item' });
    _check(error, 'simpanVerifikasiGuru');
    return { status: 'ok' };
  },

  // ── At-Tibyan ──────────────────────────────
  getAllMuridAktif: async function() {
    var id_guru = _uid();
    var { data: hq } = await _sb.from('halaqah').select('id_halaqah').eq('id_guru', id_guru).eq('status', 'aktif');
    var hqIds = (hq || []).map(function(h) { return h.id_halaqah; });
    if (!hqIds.length) return { status: 'ok', data: [] };
    var { data, error } = await _sb.from('anggota')
      .select('id_murid, nama_murid, id_halaqah, level, halaqah(nama_halaqah)')
      .in('id_halaqah', hqIds).eq('status', 'aktif').order('nama_murid');
    _check(error, 'getAllMuridAktif');
    return { status: 'ok', data };
  },

  getAtTibyanMateriForForm: async function() {
    var {data} = await _sb.from('at_tibyan_materi').select('pertemuan_ke, materi_pembahasan, nasihat_aplikatif').order('pertemuan_ke');
    return { status:'ok', data: (data||[]).map(function(r){ return { pertemuan_ke: Number(r.pertemuan_ke), materi_pembahasan: r.materi_pembahasan||'', nasihat_aplikatif: r.nasihat_aplikatif||'' }; }) };
  },

  getAtTibyanSesi: async function() {
    var { data, error } = await _sb.from('at_tibyan_sesi')
      .select('*').eq('id_guru', _uid()).order('tanggal', { ascending: false }).limit(30);
    _check(error, 'getAtTibyanSesi');
    return { status: 'ok', data };
  },

  getAtTibyanDetail: async function(id_sesi) {
    var [sesiRes, logRes] = await Promise.all([
      _sb.from('at_tibyan_sesi').select('*').eq('id_sesi', id_sesi).single(),
      _sb.from('at_tibyan_log').select('*').eq('id_sesi', id_sesi).order('nama_murid'),
    ]);
    return { status: 'ok', data: { sesi: sesiRes.data, presensi: logRes.data || [] } };
  },

  getAtTibyanRekap: async function(id_halaqah) {
    var id_guru = _uid();
    var { data: sesiList } = await _sb.from('at_tibyan_sesi')
      .select('id_sesi').eq('id_guru', id_guru).eq('status', 'selesai');
    var sesiIds = (sesiList || []).map(function(s){ return s.id_sesi; });
    var totalSesi = sesiIds.length;
    if (!sesiIds.length) return { status: 'ok', data: [], total_sesi: 0, summary: { pct_keseluruhan: 0, total_murid: 0, total_hadir: 0, total_izin: 0, total_absen: 0 } };
    var data = await _selectAllPaged('at_tibyan_log',
      'id_log, id_murid, nama_murid, status_hadir, id_halaqah, nama_halaqah',
      function(q){ q = q.in('id_sesi', sesiIds); if (id_halaqah) q = q.eq('id_halaqah', id_halaqah); return q.order('id_log'); },
      'getAtTibyanRekap');
    var muridMap = {};
    (data || []).forEach(function(r) {
      if (!muridMap[r.id_murid]) muridMap[r.id_murid] = { id_murid: r.id_murid, nama_murid: r.nama_murid || '', nama_halaqah: r.nama_halaqah, level: '', hadir: 0, izin: 0, absen: 0, total: 0 };
      var m = muridMap[r.id_murid];
      m.total++;
      // Klasifikasi 3 kelompok eksplisit agar hadir+izin+absen selalu = total (status_hadir: H/T=hadir, I=izin, A=alpa)
      if (['H','T'].includes(r.status_hadir)) m.hadir++;
      else if (r.status_hadir === 'I') m.izin++;
      else if (r.status_hadir === 'A') m.absen++;
    });
    // Ambil nama_lengkap dari users & level dari anggota agar selalu akurat
    var muridIds = Object.keys(muridMap);
    if (muridIds.length) {
      var [usersRes, anggotaRes] = await Promise.all([
        _sb.from('users').select('id_user, nama_lengkap').in('id_user', muridIds),
        _sb.from('anggota').select('id_murid, level').in('id_murid', muridIds).eq('status', 'aktif'),
      ]);
      _check(usersRes.error, 'getAtTibyanRekap:users');
      _check(anggotaRes.error, 'getAtTibyanRekap:anggota');
      var users = usersRes.data || [];
      var members = anggotaRes.data || [];
      users.forEach(function(u) {
        if (muridMap[u.id_user]) {
          if (u.nama_lengkap) muridMap[u.id_user].nama_murid = u.nama_lengkap;
        }
      });
      members.forEach(function(m) {
        if (muridMap[m.id_murid]) {
          muridMap[m.id_murid].level = m.level || '';
        }
      });
    }
    var rows = Object.values(muridMap).map(function(m) {
      return Object.assign(m, { pct_hadir: m.total > 0 ? Math.round(m.hadir / m.total * 100) : 0 });
    }).sort(function(a,b){ return (a.nama_murid||'').localeCompare(b.nama_murid||''); });
    var totalHadir = rows.reduce(function(s,m){ return s+m.hadir; }, 0);
    var totalIzin  = rows.reduce(function(s,m){ return s+m.izin; }, 0);
    var totalAbsen = rows.reduce(function(s,m){ return s+m.absen; }, 0);
    var totalEntries = rows.reduce(function(s,m){ return s+m.total; }, 0);
    return { status: 'ok', data: rows, total_sesi: totalSesi,
      summary: { pct_keseluruhan: totalEntries > 0 ? Math.round(totalHadir/totalEntries*100) : 0, total_murid: rows.length, total_hadir: totalHadir, total_izin: totalIzin, total_absen: totalAbsen } };
  },

  getAtTibyanKeaktifan: async function() {
    var id_guru = _uid();
    var { data: sesiList } = await _sb.from('at_tibyan_sesi')
      .select('id_sesi').eq('id_guru', id_guru).eq('status', 'selesai');
    var sesiIds = (sesiList || []).map(function(s){ return s.id_sesi; });
    var totalSesi = sesiIds.length;
    if (!sesiIds.length) return { status: 'ok', data: { alerts: [], summary: { kritis: 0, peringatan: 0, normal: 0 } } };
    // BUG-015 fix: filter by sesiIds (sesi milik guru ini saja) agar murid cross-guru tidak dihitung ganda
    var data = await _selectAllPaged('at_tibyan_log',
      'id_log, id_murid, nama_murid, id_halaqah, nama_halaqah, status_hadir, tanggal',
      function(q){ return q.in('id_sesi', sesiIds).order('tanggal', { ascending: true }).order('id_log'); },
      'getAtTibyanKeaktifan');
    var muridMap = {};
    (data || []).forEach(function(r) {
      if (!muridMap[r.id_murid]) muridMap[r.id_murid] = {
        id_murid: r.id_murid, nama_murid: r.nama_murid, nama_halaqah: r.nama_halaqah,
        level: '', hadir: 0, absen: 0, total: 0, riwayat: []
      };
      var m = muridMap[r.id_murid]; m.total++;
      var hadir = ['H','T'].includes(r.status_hadir);
      if (hadir) m.hadir++; else if (r.status_hadir === 'A') m.absen++;
      // 'I' (Izin) ditandai abu-abu — bukan merah seperti Alpa — agar tidak terlihat sama spt absen
      var warna = hadir ? 'hijau' : (r.status_hadir === 'I' ? 'abu' : 'merah');
      m.riwayat.push({ warna: warna, tanggal: r.tanggal });
    });
    // Ambil nama_lengkap, no_hp dari users, dan level dari anggota agar selalu akurat
    var muridIds = Object.keys(muridMap);
    if (muridIds.length) {
      var [usersRes, anggotaRes] = await Promise.all([
        _sb.from('users').select('id_user, nama_lengkap, no_hp').in('id_user', muridIds),
        _sb.from('anggota').select('id_murid, level').in('id_murid', muridIds).eq('status', 'aktif'),
      ]);
      _check(usersRes.error, 'getAtTibyanKeaktifan:users');
      _check(anggotaRes.error, 'getAtTibyanKeaktifan:anggota');
      var users = usersRes.data || [];
      var members = anggotaRes.data || [];
      users.forEach(function(u) {
        if (muridMap[u.id_user]) {
          if (u.nama_lengkap) muridMap[u.id_user].nama_murid = u.nama_lengkap;
          muridMap[u.id_user].no_hp  = u.no_hp  || '';
        }
      });
      members.forEach(function(m) {
        if (muridMap[m.id_murid]) {
          muridMap[m.id_murid].level  = m.level  || '';
        }
      });
    }
    var summary = { kritis: 0, peringatan: 0, normal: 0 };
    var alerts = Object.values(muridMap).map(function(m) {
      var pct_hadir = m.total > 0 ? Math.round(m.hadir / m.total * 100) : 0;
      var status = m.absen >= 2 ? 'kritis' : m.absen === 1 ? 'peringatan' : 'normal';
      summary[status]++;
      return Object.assign(m, { pct_hadir, total_sesi: totalSesi, status });
    });
    return { status: 'ok', data: { alerts, summary } };
  },

  simpanAtTibyan: async function(d) {
    // BUG-M2 fix: cek duplikat pertemuan_ke sebelum insert
    // H6 fix (bug hunt 2026-08-18): dulu cek ini GLOBAL lintas-guru (tanpa
    // .eq('id_guru', _uid())), padahal nomor pertemuan dihitung per-guru
    // mandiri (attibyan-module.js: own count + 1). Akibatnya guru pertama yang
    // simpan "Pertemuan ke-N" memblokir semua guru lain bikin sesi ke-N milik
    // mereka sendiri -- rusak untuk hampir semua guru selain yang pertama.
    if (d.pertemuan_ke) {
      var { count: dupCount } = await _sb.from('at_tibyan_sesi')
        .select('*', { count: 'exact', head: true })
        .eq('pertemuan_ke', d.pertemuan_ke).eq('id_guru', _uid());
      if (dupCount > 0) {
        return { status: 'error', message: 'Pertemuan ke-' + d.pertemuan_ke + ' sudah ada. Gunakan fitur Edit untuk mengubahnya.' };
      }
    }
    var id_sesi = _genId('ATS');
    var hadirCount = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    var { error: errSesi } = await _sb.from('at_tibyan_sesi').insert({
      id_sesi, tanggal: d.tanggal, id_guru: _uid(),
      nama_guru: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || '',
      total_hadir: hadirCount, total_murid: d.presensi.length,
      status: 'selesai', pertemuan_ke: d.pertemuan_ke || 1,
    });
    _check(errSesi, 'simpanAtTibyan:sesi');
    var logRows = d.presensi.map(function(p) { return {
      id_sesi, id_murid: p.id_murid, nama_murid: p.nama_murid,
      id_halaqah: p.id_halaqah, nama_halaqah: p.nama_halaqah,
      status_hadir: p.status_hadir, tanggal: d.tanggal,
    }; });
    var { error: errLog } = await _sb.from('at_tibyan_log').insert(logRows);
    if (errLog) {
      await _sb.from('at_tibyan_sesi').delete().eq('id_sesi', id_sesi).catch(function(){});
      _check(errLog, 'simpanAtTibyan:log');
    }
    return { status: 'ok', message: 'Sesi At-Tibyan berhasil disimpan' };
  },

  editAtTibyan: async function(d) {
    // Ambil data lama dulu sebagai cadangan rollback
    var { data: sesiData } = await _sb.from('at_tibyan_sesi').select('tanggal, total_hadir').eq('id_sesi', d.id_sesi).single();
    var tanggal = (sesiData && sesiData.tanggal) || d.tanggal || null;
    var oldHadirCount = sesiData && sesiData.total_hadir;
    var { data: oldLogs } = await _sb.from('at_tibyan_log').select('*').eq('id_sesi', d.id_sesi);

    var hadirCount = d.presensi.filter(function(p) { return ['H','T'].includes(p.status_hadir); }).length;
    var logRows = d.presensi.map(function(p) { return {
      id_sesi: d.id_sesi, id_murid: p.id_murid, nama_murid: p.nama_murid,
      id_halaqah: p.id_halaqah, nama_halaqah: p.nama_halaqah || '',
      status_hadir: p.status_hadir, tanggal: tanggal,
    }; });

    // Cek error delete dulu (sebelum insert): kalau delete gagal diam-diam,
    // insert berikutnya akan menghasilkan baris log dobel.
    var { error: delErr } = await _sb.from('at_tibyan_log').delete().eq('id_sesi', d.id_sesi);
    _check(delErr, 'editAtTibyan:delete');

    var { error: insertErr } = await _sb.from('at_tibyan_log').insert(logRows);
    if (insertErr) {
      // Rollback: kembalikan data lama (delete sukses, insert gagal -> log kosong utk
      // id_sesi ini, aman utk restore tanpa bentrok unique constraint)
      if (oldLogs && oldLogs.length) {
        var rollbackRows = oldLogs.map(function(r) {
          var copy = Object.assign({}, r);
          delete copy.id_log; delete copy.created_at; // BUG-K1 fix: PK kolom adalah id_log, bukan id
          return copy;
        });
        await _sb.from('at_tibyan_log').insert(rollbackRows).catch(function(){});
      }
      _check(insertErr, 'editAtTibyan.insert');
    }

    // M4 fix (bug hunt 2026-08-18): total_hadir SEKARANG diupdate SETELAH insert log
    // sukses (bukan sebelumnya) -- dulu errornya tak dicek sama sekali, dan kalau
    // insert log gagal setelah update ini jalan, rollback log lama akan bentrok
    // dgn unique constraint karena log baru masih ada. total_hadir adalah kolom
    // turunan/denormalisasi (bukan data primer spt log), jadi kalau update ini
    // gagal cukup dilaporkan sbg warning, tak perlu rollback seluruh operasi.
    var { error: updHadirErr } = await _sb.from('at_tibyan_sesi').update({ total_hadir: hadirCount }).eq('id_sesi', d.id_sesi);
    var warning = updHadirErr ? ('Presensi tersimpan, tapi hitungan total hadir gagal diperbarui (' + updHadirErr.message + '). Muat ulang halaman untuk memeriksa.') : null;
    return { status: 'ok', warning: warning };
  },

  // ── Raport ─────────────────────────────────
  getAllPeriode: async function() {
    // Urut manual (kolom `urutan`, patch_102) → NULL di belakang → lalu tanggal_mulai.
    // Fallback ke created_at bila kolom `urutan` belum ada.
    var res = await _sb.from('periode').select('*')
      .order('urutan', { ascending: true, nullsFirst: false })
      .order('tanggal_mulai', { ascending: true, nullsFirst: false });
    if (res.error) {
      res = await _sb.from('periode').select('*').order('created_at', { ascending: false });
    }
    _check(res.error, 'getAllPeriode');
    return { status: 'ok', data: res.data };
  },

  getKomponenRaport: async function(id_periode) {
    var { data, error } = await _sb.from('komponen_raport')
      .select('*').eq('id_periode', id_periode).eq('status', 'aktif').order('urutan');
    _check(error, 'getKomponenRaport');
    return { status: 'ok', data };
  },

  getNilaiManual: async function(id_periode) {
    var { data, error } = await _sb.from('nilai_manual').select('*').eq('id_periode', id_periode);
    _check(error, 'getNilaiManual');
    return { status: 'ok', data };
  },

  saveNilaiManual: async function(d) {
    var { data, error } = await _sb.from('nilai_manual')
      .upsert(d, { onConflict: 'id_murid,id_periode,id_komponen' }).select().single();
    _check(error, 'saveNilaiManual');
    return { status: 'ok', data };
  },

  saveNilaiManualBatch: async function(d) {
    var rows = (d.nilai_list || []).map(function(n) { return Object.assign({}, n, {
      id_periode: d.id_periode, id_halaqah: d.id_halaqah,
    }); });
    var { error } = await _sb.from('nilai_manual')
      .upsert(rows, { onConflict: 'id_murid,id_periode,id_komponen' });
    _check(error, 'saveNilaiManualBatch');
    return { status: 'ok', message: rows.length + ' nilai disimpan' };
  },

  getRaportListGuru: async function(id_halaqah, id_periode) {
    var { data, error } = await _sb.from('raport')
      .select('*, users!raport_id_murid_fkey(nama_lengkap, email)')
      .eq('id_halaqah', id_halaqah).eq('id_periode', id_periode)
      .order('created_at', { ascending: false });
    _check(error, 'getRaportListGuru');
    return { status: 'ok', data: (data || []).map(function(r) { return Object.assign({}, r, {
      nama_murid: r.users && r.users.nama_lengkap,
      email     : r.users && r.users.email,
      detail    : r.detail_json ? (typeof r.detail_json === 'string' ? (function(){try{return JSON.parse(r.detail_json);}catch(e){return [];}})() : r.detail_json) : [],
    }); }) };
  },

  generateRaportHalaqah: async function(d) {
    // Kalkulasi raport semua murid di halaqah
    var { data: anggota, error: errAnggota } = await _sb.from('anggota').select('id_murid, nama_murid, level').eq('id_halaqah', d.id_halaqah).eq('status', 'aktif');
    _check(errAnggota, 'generateRaportHalaqah:anggota');
    if (!anggota || !anggota.length) return { status: 'error', message: 'Tidak ada murid aktif di halaqah ini.' };
    var ids = (anggota || []).map(function(a) { return a.id_murid; });
    var { data: komponen, error: errKomp } = await _sb.from('komponen_raport').select('*').eq('id_periode', d.id_periode).eq('status', 'aktif').order('urutan');
    _check(errKomp, 'generateRaportHalaqah:komponen');
    var hasNonDaurah = (anggota || []).some(function(a) { return a.level !== 'Tahsin Al-Fatihah'; });
    if (hasNonDaurah && (!komponen || !komponen.length)) {
      return { status: 'error', message: 'Komponen raport belum dikonfigurasi untuk periode ini.' };
    }

    // BUG-021 fix: baca threshold grade dari DB, bukan hardcode
    var { data: cfgRows } = await _sb.from('konfigurasi_raport').select('key, value');
    var cfgMap = {}; (cfgRows || []).forEach(function(r) { cfgMap[r.key] = r.value; });
    var gradeConfig = {
      mumtaz      : parseInt(cfgMap['grade_mumtaz']         || '90'),
      jayyidJiddan: parseInt(cfgMap['grade_jayyid_jiddan']  || '80'),
      jayyid      : parseInt(cfgMap['grade_jayyid']         || '70'),
      bonusPerfect: parseInt(cfgMap['bonus_perfect_attendance'] || '5'),
    };

    var hasDaurah = (anggota || []).some(function(a) { return a.level === 'Tahsin Al-Fatihah'; });
    var asmtItems = [], asmtMurid = [];

    var [nilaiManualRes, nilaiKBMRes, atLogRes, atSesiRes, catatanRes, periodeRes, asmtItemsRes, asmtMuridRes] = await Promise.all([
      _sb.from('nilai_manual').select('*').eq('id_periode', d.id_periode),
      _sb.from('nilai_kbm').select('*, kbm_log!nilai_kbm_id_kbm_fkey(jenis_sesi, status, tanggal_pertemuan)').eq('id_halaqah', d.id_halaqah),
      _sb.from('at_tibyan_log').select('id_murid, status_hadir').eq('id_halaqah', d.id_halaqah).in('id_murid', ids),
      _sb.from('at_tibyan_sesi').select('*', { count: 'exact', head: true }).eq('id_guru', d.id_guru || _uid()).eq('status', 'selesai'),
      _sb.from('catatan_raport').select('catatan').eq('id_halaqah', d.id_halaqah).maybeSingle(),
      _sb.from('periode').select('tanggal_mulai, tanggal_selesai').eq('id_periode', d.id_periode).maybeSingle(),
      hasDaurah ? _sb.from('assessment_items').select('*').eq('level', 'Tahsin Al-Fatihah').eq('status', 'aktif').order('urutan') : Promise.resolve({ data: [] }),
      hasDaurah ? _sb.from('assessment_murid').select('*').in('id_murid', ids) : Promise.resolve({ data: [] }),
    ]);
    var nilaiManual = nilaiManualRes.data;
    var nilaiKBM    = nilaiKBMRes.data;
    var atLog       = atLogRes.data;
    var totalAt     = atSesiRes.count || 0;
    var catatan     = catatanRes.data;
    asmtItems       = asmtItemsRes.data || [];
    asmtMurid       = asmtMuridRes.data || [];

    // Rentang periode untuk membatasi KBM yang dihitung (defensif: hanya bila
    // kedua tanggal terisi; periode lama tanpa tanggal → perilaku lama, tak difilter).
    var pr = periodeRes.data || {};
    var periodeRange = (pr.tanggal_mulai && pr.tanggal_selesai)
      ? { mulai: pr.tanggal_mulai, selesai: pr.tanggal_selesai } : null;

    var berhasil = [], gagal = [];
    for (var i = 0; i < (anggota || []).length; i++) {
      var m = anggota[i];
      try {
        var raportData = _kalkulasiRaport(m.id_murid, d.id_periode, d.id_halaqah,
          komponen, nilaiManual, nilaiKBM, atLog, totalAt, gradeConfig, m.level, periodeRange, asmtItems, asmtMurid);
        var detailJson = raportData.komponen;
        // C1 fix (bug hunt 2026-08-18): 'status' SENGAJA tidak disertakan di sini.
        // Kolom raport.status default 'draft' di DB (001_schema.sql:346), jadi baris
        // BARU tetap lahir 'draft' seperti sebelumnya -- tapi baris yang SUDAH 'published'
        // tidak lagi ikut ditimpa balik ke 'draft' setiap kali guru generate ulang halaqah
        // (dulu ini mem-unpublish SEMUA raport murid lain di halaqah/periode yang sama).
        var { error: upErr } = await _sb.from('raport')
          .upsert({
            id_murid: m.id_murid, id_periode: d.id_periode, id_halaqah: d.id_halaqah,
            nilai_akhir: raportData.nilai_akhir, predikat: raportData.predikat,
            detail_json: detailJson, tanggal_cetak: _localDate(),
          // MB7 fix (bug hunt 2026-08-27): dulu onConflict cuma (id_murid,id_periode)
          // -- murid yg aktif di 2 halaqah sekaligus (reguler + Level Qiyam) berebut
          // 1 baris fisik, guru halaqah kedua yg generate belakangan selalu gagal
          // (RLS guru_owns_halaqah menolak update baris berkepemilikan guru pertama).
          // Constraint unik DB juga sudah diperluas (id_murid,id_periode,id_halaqah)
          // via patch_096 -- sertakan id_halaqah di sini spy match constraint barunya.
          }, { onConflict: 'id_murid,id_periode,id_halaqah' });
        if (upErr) throw new Error(upErr.message);
        berhasil.push(Object.assign({ nama_murid: m.nama_murid, catatan_guru: catatan && catatan.catatan }, raportData));
      } catch(e) { gagal.push({ id_murid: m.id_murid, nama: m.nama_murid, alasan: e.message }); }
    }
    return { status: 'ok', message: berhasil.length + ' raport digenerate', data: { berhasil, gagal } };
  },

  publishAllRaportHalaqah: async function(d) {
    var { data: anggota } = await _sb.from('anggota').select('id_murid').eq('id_halaqah', d.id_halaqah).eq('status', 'aktif');
    var ids = (anggota || []).map(function(a) { return a.id_murid; });
    var { error } = await _sb.from('raport').update({ status: 'published', published_by: _uid(), published_at: new Date().toISOString() })
      .in('id_murid', ids).eq('id_periode', d.id_periode).eq('status', 'draft');
    _check(error, 'publishAllRaportHalaqah');
    // Auto-buat pengumuman
    await _sb.from('pengumuman').insert({
      judul: '[Raport] Raport sudah tersedia',
      isi: 'Assalamualaikum, raport halaqah Anda sudah dipublikasikan. Silakan cek di menu Raport.',
      target: d.id_halaqah, id_halaqah: d.id_halaqah,
      dibuat_oleh: _uid(), nama_pembuat: (_currentUser && (_currentUser.nama || _currentUser.nama_lengkap)) || 'Admin',
      tanggal: _localDate(), status: 'aktif',
    });
    // Push ke murid halaqah ini
    if (ids.length) {
      _sendPushBg({
        user_ids: ids,
        title : '📄 Raport Kamu Sudah Tersedia!',
        body  : 'Raport semester ini sudah dipublish. Ketuk untuk melihat nilai dan predikatmu.',
        url   : '/Portal-Halaqah-Rattililquran/murid/index.html',
        tag   : 'raport-published-' + d.id_halaqah,
        data  : { trigger: 'raport_published', id_halaqah: d.id_halaqah },
      });
    }
    return { status: 'ok', message: 'Raport berhasil dipublish' };
  },

  getCatatanHalaqah: async function(id_halaqah) {
    var { data } = await _sb.from('catatan_raport').select('catatan').eq('id_halaqah', id_halaqah).maybeSingle();
    return { status: 'ok', data: { catatan: data && data.catatan || '' } };
  },

  saveCatatanHalaqah: async function(d) {
    var { error } = await _sb.from('catatan_raport')
      .upsert({ id_halaqah: d.id_halaqah, catatan: d.catatan }, { onConflict: 'id_halaqah' });
    _check(error, 'saveCatatanHalaqah');
    return { status: 'ok', message: 'Catatan disimpan' };
  },



  // ── Password ───────────────────────────────
  changePassword: async function(d) { return Auth.changePassword(d); },

  // ── Rekap ──────────────────────────────────
  generateRekapPresensi: async function(id_halaqah) {
    return { status: 'ok', message: 'Rekap Presensi: fitur in progress' };
  },
  generateRekapNilai: async function(id_halaqah) {
    return { status: 'ok', message: 'Rekap Nilai: fitur in progress' };
  },

  // ── Tahfidz / Setoran Hafalan (Level Qiyam) ──────────────────────────
  // Ambil halaqah Level Qiyam milik guru yang sedang login
  getQiyamHalaqah: async function() {
    var { data, error } = await _sb.from('halaqah')
      .select('id_halaqah, nama_halaqah, level, jadwal_hari, jam_mulai, jam_selesai')
      .eq('id_guru', _uid())
      .eq('level', 'Level Qiyam')
      .eq('status', 'aktif')
      .order('nama_halaqah');
    _check(error, 'getQiyamHalaqah');
    if (data) {
      data = data.map(function(h) {
        return Object.assign({}, h, {
          jam_mulai: h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
          jam_selesai: h.jam_selesai ? h.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data: data || [] };
  },

  // Ambil daftar murid aktif di halaqah Qiyam tertentu (untuk dropdown form input)
  getMuridQiyam: async function(id_halaqah) {
    var { data, error } = await _sb.from('anggota')
      .select('id_murid, nama_murid')
      .eq('id_halaqah', id_halaqah)
      .eq('status', 'aktif')
      .order('nama_murid');
    _check(error, 'getMuridQiyam');
    return { status: 'ok', data: data || [] };
  },

  // Ambil riwayat setoran di halaqah Qiyam (bisa filter per murid)
  getSetoranHafalanGuru: async function(id_halaqah, id_murid, limit, offset) {
    var q = _sb.from('setoran_hafalan')
      .select('*', { count: 'exact' })
      .eq('id_halaqah', id_halaqah)
      .order('created_at', { ascending: false });
    if (id_murid) q = q.eq('id_murid', id_murid);
    var lim = limit || 20;
    q = q.range(offset || 0, (offset || 0) + lim - 1);
    var { data, error, count } = await q;
    _check(error, 'getSetoranHafalanGuru');
    return { status: 'ok', data: data || [], total: count || 0, has_more: (offset || 0) + lim < (count || 0) };
  },

  // Input setoran hafalan baru
  addSetoranHafalan: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_murid           : d.id_murid,
      nama_murid         : d.nama_murid || '',
      id_halaqah         : d.id_halaqah,
      id_kbm             : d.id_kbm    || null,
      id_guru            : _uid(),
      nama_guru          : (user && (user.nama_lengkap || user.nama)) || '',
      juz                : d.juz ? parseInt(d.juz) : null,
      surat              : d.surat,
      // Tahsin di sesi KBM tidak mengisi surat/ayat → parseInt jadi NaN.
      // Kolom ayat NOT NULL + CHECK (ayat_dari >= 1, ayat_sampai >= ayat_dari),
      // jadi coalesce ke 1 (bukan 0) agar insert tidak gagal.
      ayat_dari          : (parseInt(d.ayat_dari)   || 1),
      ayat_sampai        : (parseInt(d.ayat_sampai) || 1),
      jenis              : d.jenis || 'Ziyadah',
      nilai              : d.nilai,
      kelancaran         : d.kelancaran || null,
      kamera             : d.kamera    || null,
      catatan            : d.catatan   || null,
      target_surat       : d.target_surat       || null,
      target_ayat_dari   : d.target_ayat_dari   ? parseInt(d.target_ayat_dari)   : null,
      target_ayat_sampai : d.target_ayat_sampai ? parseInt(d.target_ayat_sampai) : null,
    };
    // Jika guru mengisi tanggal manual, gunakan sebagai created_at
    if (d.tanggal) {
      payload.created_at = new Date(d.tanggal + 'T12:00:00').toISOString();
    }
    var { data, error } = await _sb.from('setoran_hafalan').insert(payload).select().single();
    _check(error, 'addSetoranHafalan');

    // Auto-sync kamera to nilai_kbm for Qiyam sessions (only if d.kamera is non-empty)
    if (d.id_kbm && d.id_murid && d.kamera) {
      var { error: syncErr } = await _sb.from('nilai_kbm')
        .update({ kamera_murid: d.kamera })
        .eq('id_kbm', d.id_kbm)
        .eq('id_murid', d.id_murid);
      if (syncErr) {
        console.warn('Gagal sync kamera ke nilai_kbm:', syncErr.message);
      }
    }
    return { status: 'ok', data };
  },

  // Ambil data Ziyadah murid tertentu (untuk validasi range Murajaah)
  // includePartnerConfirmed: jika true, ikut sertakan setoran mandiri (sumber='partner')
  // yang sudah dikonfirmasi partner — dipakai validasi Murajaah mandiri murid (§3.8).
  // Default false: hanya sumber='guru' (perilaku lama, dipakai form guru).
  getZiyadahMurid: async function(id_halaqah, id_murid, includePartnerConfirmed) {
    var q = _sb.from('setoran_hafalan')
      .select('surat, juz, ayat_dari, ayat_sampai')
      .eq('id_halaqah', id_halaqah)
      .eq('id_murid', id_murid)
      .eq('jenis', 'Ziyadah');
    q = includePartnerConfirmed
      ? q.or('sumber.eq.guru,and(sumber.eq.partner,status_konfirmasi.eq.dikonfirmasi)')
      : q.eq('sumber', 'guru');
    var { data, error } = await q;
    _check(error, 'getZiyadahMurid');
    return { status: 'ok', data: data || [] };
  },

  // Hapus setoran (hanya yang dibuat guru sendiri)
  deleteSetoranHafalan: async function(id_setoran) {
    var { error } = await _sb.from('setoran_hafalan')
      .delete()
      .eq('id_setoran', id_setoran)
      .eq('id_guru', _uid());
    _check(error, 'deleteSetoranHafalan');
    return { status: 'ok' };
  },

  // Edit setoran (Paket 3c: Edit Nilai KBM Qiyam). Hanya field penilaian yang
  // diubah (nilai/kelancaran/kamera/catatan/jenis) — surat/ayat/juz/target tidak
  // disentuh. Guard id_guru = pemilik (selaras RLS guru_update_own_setoran).
  // `nilai` NOT NULL → pemanggil wajib mengirimnya. Efek samping kamera→nilai_kbm
  // direplikasi dari addSetoranHafalan agar konsisten.
  updateSetoranHafalan: async function(d) {
    var fields = {
      nilai      : d.nilai,
      kelancaran : d.kelancaran || null,
      kamera     : d.kamera     || null,
      catatan    : d.catatan    || null,
      updated_at : new Date().toISOString(),
    };
    if (d.jenis) fields.jenis = d.jenis;
    var { error } = await _sb.from('setoran_hafalan')
      .update(fields)
      .eq('id_setoran', d.id_setoran)
      .eq('id_guru', _uid());
    _check(error, 'updateSetoranHafalan');
    // Sync kamera ke nilai_kbm untuk sesi Qiyam (kamera_murid inilah yang dibaca
    // raport). Sinkronkan nilai APA ADANYA — termasuk saat dikosongkan (null) —
    // agar setoran_hafalan.kamera & nilai_kbm.kamera_murid tak desync. Hanya
    // dijalankan bila pemanggil memang menyertakan field kamera (key ada),
    // sehingga pemanggil yang tak menyentuh kamera tak ikut ternol.
    if (d.id_kbm && d.id_murid && d.kamera !== undefined) {
      var { error: syncErr } = await _sb.from('nilai_kbm')
        .update({ kamera_murid: d.kamera || null })
        .eq('id_kbm', d.id_kbm)
        .eq('id_murid', d.id_murid);
      if (syncErr) console.warn('Gagal sync kamera ke nilai_kbm:', syncErr.message);
    }
    return { status: 'ok' };
  },

  // ── Raport Tahfidz ─────────────────────────────────────────────────────
  // Ambil semua setoran hafalan dalam rentang tanggal (untuk raport)
  getRaportTahfidzData: async function(id_halaqah, id_murid, tgl_mulai, tgl_selesai) {
    var q = _sb.from('setoran_hafalan')
      .select('*')
      .eq('id_halaqah', id_halaqah)
      .eq('sumber', 'guru') // §3.7: raport resmi hanya hitung setoran guru
      .order('created_at', { ascending: true })
      .limit(500); // BUG-14 fix: cegah timeout untuk dataset besar
    if (id_murid)    q = q.eq('id_murid', id_murid);
    // M2 fix (bug hunt 2026-08-18): dulu string naive ('T00:00:00' tanpa offset)
    // dibandingkan ke created_at (timestamptz UTC asli) -- batas efektif geser
    // ~7 jam dari yang dimaksud. Sertakan offset WIB eksplisit (+07:00) supaya
    // batas hari benar-benar hari kalender Asia/Jakarta, bukan UTC.
    if (tgl_mulai)   q = q.gte('created_at', tgl_mulai + 'T00:00:00+07:00');
    if (tgl_selesai) q = q.lte('created_at', tgl_selesai + 'T23:59:59+07:00');

    // Koreksi & Catatan Tahsin KBM Qiyam disimpan per murid per sesi di nilai_kbm
    // (bukan di setoran_hafalan.catatan). Ambil untuk digabung ke daftar catatan raport.
    var kcQ = _sb.from('nilai_kbm')
      .select('id_murid, tanggal, koreksi_tahsin, catatan_murid')
      .eq('id_halaqah', id_halaqah).eq('jenis_sesi', 'KBM Qiyam')
      .or('koreksi_tahsin.not.is.null,catatan_murid.not.is.null')
      .order('tanggal', { ascending: true }).limit(500);
    if (id_murid)    kcQ = kcQ.eq('id_murid', id_murid);
    if (tgl_mulai)   kcQ = kcQ.gte('tanggal', tgl_mulai);
    if (tgl_selesai) kcQ = kcQ.lte('tanggal', tgl_selesai);

    var [{ data, error }, kcRes] = await Promise.all([q, kcQ]);
    _check(error, 'getRaportTahfidzData');
    return { status: 'ok', data: data || [], koreksi_catatan: (kcRes && kcRes.data) || [] };
  },

  // Konfigurasi penilaian hafalan (Kelancaran + Nilai Makhraj & Tajwid)

  savePenilaianHafalan: async function(config) {
    var { error } = await _sb.from('konfigurasi_penilaian_hafalan')
      .upsert({
        id         : 'global',
        kelancaran : config.kelancaran,
        nilai      : config.nilai,
        updated_by : _uid(),
      }, { onConflict: 'id' });
    _check(error, 'savePenilaianHafalan');
    return { status: 'ok' };
  },

  // Target terbaru per murid di halaqah Qiyam (untuk kartu pengingat guru)
  getTargetHafalanMurid: async function(id_halaqah, id_murids) {
    var q = _sb.from('setoran_hafalan')
      .select('id_murid, nama_murid, target_surat, target_ayat_dari, target_ayat_sampai, created_at, updated_at')
      .not('target_surat', 'is', null)
      .order('created_at', { ascending: false })
      .order('updated_at', { ascending: false });
    if (id_murids && id_murids.length) {
      q = q.in('id_murid', id_murids);
    } else {
      q = q.eq('id_halaqah', id_halaqah);
    }
    var { data, error } = await q;
    _check(error, 'getTargetHafalanMurid');
    // Deduplicate — ambil target terbaru per murid
    var seen = new Set();
    var result = (data || []).filter(function(r) {
      if (seen.has(r.id_murid)) return false;
      seen.add(r.id_murid);
      return true;
    });
    return { status: 'ok', data: result };
  },

  // ── Kelompok Partner Qiyam ───────────────────────────────────────────
  // Daftar kelompok + anggota di sebuah halaqah Qiyam
  getKelompokPartnerHalaqah: async function(id_halaqah) {
    var { data, error } = await _sb.from('kelompok_partner_qiyam')
      .select('*, anggota_kelompok_partner(*)')
      .eq('id_halaqah', id_halaqah)
      .order('created_at', { ascending: true });
    _check(error, 'getKelompokPartnerHalaqah');
    return { status: 'ok', data: data || [] };
  },

  // Pantau denyut tiap anggota kelompok partner di sebuah halaqah Qiyam
  // (tanggal setoran mandiri terakhir, jumlah menunggu/dikonfirmasi, no_hp)
  getPantauKelompokPartner: async function(id_halaqah) {
    var { data, error } = await _sb.rpc('get_pantau_kelompok_partner', { p_id_halaqah: id_halaqah });
    _check(error, 'getPantauKelompokPartner');
    return { status: 'ok', data: data || [] };
  },

  // ── Lini Masa Kelompok (Fase 3) untuk guru/admin (per kelompok) ──
  getLiniMasaSetoranKelompok: async function(id_kelompok) {
    var { data, error } = await _sb.rpc('get_lini_masa_setoran', { p_id_kelompok: id_kelompok });
    _check(error, 'getLiniMasaSetoranKelompok');
    return { status: 'ok', data: data || [] };
  },
  getMilestoneByKelompok: async function(id_kelompok) {
    var { data, error } = await _sb.from('milestone_kelompok_partner')
      .select('*').eq('id_kelompok', id_kelompok)
      .order('tanggal', { ascending: false }).order('created_at', { ascending: false });
    _check(error, 'getMilestoneByKelompok');
    return { status: 'ok', data: data || [] };
  },
  addMilestoneKelompok: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok  : d.id_kelompok,
      id_halaqah   : d.id_halaqah,
      judul        : d.judul,
      // L3 fix (bug hunt 2026-08-18): _localDate() device-local -> _todayJakarta()
      tanggal      : d.tanggal || _todayJakarta(),
      dibuat_oleh  : _uid(),
      nama_pembuat : (user && (user.nama_lengkap || user.nama)) || 'Ustadz',
    };
    var { data, error } = await _sb.from('milestone_kelompok_partner').insert(payload).select().single();
    _check(error, 'addMilestoneKelompok');
    return { status: 'ok', data: data };
  },
  deleteMilestoneKelompok: async function(id_milestone) {
    var { error } = await _sb.from('milestone_kelompok_partner').delete().eq('id_milestone', id_milestone);
    _check(error, 'deleteMilestoneKelompok');
    return { status: 'ok' };
  },

  // #3 Konfirmasi setoran partner oleh guru/admin (jalan keluar bila partner berhalangan)
  guruKonfirmasiSetoran: async function(id_setoran, kelancaran, catatan) {
    var logData = null;
    try {
      var { data } = await _sb.from('setoran_hafalan')
        .select('id_murid, jenis, surat, ayat_dari, ayat_sampai')
        .eq('id_setoran', id_setoran)
        .single();
      logData = data;
    } catch(e) {}

    var { error } = await _sb.rpc('guru_konfirmasi_setoran_partner', {
      p_id_setoran: id_setoran, p_kelancaran: kelancaran, p_catatan: catatan || null,
    });
    _check(error, 'guruKonfirmasiSetoran');

    if (logData && logData.id_murid) {
      _sendPushBg({
        user_ids: [logData.id_murid],
        title   : '✓ Setoran Dikonfirmasi (Guru)',
        body    : 'Setoran "' + logData.jenis + ' ' + logData.surat + ' Ayat ' + logData.ayat_dari + '-' + logData.ayat_sampai + '" kamu telah dikonfirmasi oleh Guru Halaqah!',
        url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=hafalan&tab=partner',
        tag     : 'partner-qiyam-konf-' + id_setoran,
        data    : { trigger: 'partner_qiyam_konf', id_setoran: id_setoran }
      });
    }

    return { status: 'ok' };
  },
  // Daftar setoran partner yang masih menunggu di sebuah halaqah (untuk guru konfirmasi)
  getSetoranPartnerMenungguHalaqah: async function(id_halaqah) {
    var { data, error } = await _sb.from('setoran_hafalan')
      .select('id_setoran, id_murid, nama_murid, jenis, surat, juz, ayat_dari, ayat_sampai, catatan, created_at, lampiran_url, audio_durasi_detik')
      .eq('id_halaqah', id_halaqah).eq('sumber', 'partner').eq('status_konfirmasi', 'menunggu')
      .order('created_at', { ascending: true });
    _check(error, 'getSetoranPartnerMenungguHalaqah');
    return { status: 'ok', data: data || [] };
  },

  // #4 Target bersama kelompok (guru/admin)
  getTargetByKelompok: async function(id_kelompok) {
    var res = await _sb.from('target_kelompok_partner')
      .select('*, target_partner_progress(id_murid, nama_murid)')
      .eq('id_kelompok', id_kelompok).order('created_at', { ascending: false });
    if (res.error) {
      var fb = await _sb.from('target_kelompok_partner')
        .select('*').eq('id_kelompok', id_kelompok).order('created_at', { ascending: false });
      _check(fb.error, 'getTargetByKelompok');
      return { status: 'ok', data: fb.data || [] };
    }
    return { status: 'ok', data: res.data || [] };
  },
  addTargetByKelompok: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok : d.id_kelompok,
      id_halaqah  : d.id_halaqah,
      judul       : d.judul,
      tanggal_target: d.tanggal_target || null,
      dibuat_oleh : _uid(),
      nama_pembuat: (user && (user.nama_lengkap || user.nama)) || 'Ustadz',
    };
    var { data, error } = await _sb.from('target_kelompok_partner').insert(payload).select().single();
    _check(error, 'addTargetByKelompok');
    return { status: 'ok', data: data };
  },
  updateTargetByKelompok: async function(id_target, updates) {
    // H4 fix (bug hunt 2026-08-18, patch_089): saat guru memaksa status jadi
    // 'tercapai' (override konsensus, mis. 1 anggota absen tapi lainnya selesai),
    // tandai dipaksa_guru=true supaya RPC tandai_progress_target_partner (dipicu
    // toggle progres murid yg wajar) berhenti menimpa keputusan guru itu balik ke
    // 'aktif'. Guru set balik ke 'aktif' -> lepas paksa, kembali ke konsensus normal.
    var payload = Object.assign({}, updates);
    if (updates && updates.status === 'tercapai') payload.dipaksa_guru = true;
    else if (updates && updates.status === 'aktif') payload.dipaksa_guru = false;
    var { error } = await _sb.from('target_kelompok_partner').update(payload).eq('id_target', id_target);
    _check(error, 'updateTargetByKelompok');
    return { status: 'ok' };
  },
  deleteTargetByKelompok: async function(id_target) {
    var { error } = await _sb.from('target_kelompok_partner').delete().eq('id_target', id_target);
    _check(error, 'deleteTargetByKelompok');
    return { status: 'ok' };
  },

  // Buat kelompok baru. anggota: [{id_murid, nama_murid}]
  // [Atomic] 1 transaksi via RPC agar tidak menyisakan kelompok kosong jika
  // insert anggota gagal (validasi roster/aktif atau koneksi putus)
  createKelompokPartner: async function(id_halaqah, nama_kelompok, anggota) {
    var rows = (anggota || []).map(function(a) {
      return { id_murid: a.id_murid, nama_murid: a.nama_murid || null };
    });
    var { data: id_kelompok, error } = await _sb.rpc('create_kelompok_partner', {
      p_id_halaqah: id_halaqah, p_nama_kelompok: nama_kelompok || null, p_anggota: rows
    });
    _check(error, 'createKelompokPartner');
    return { status: 'ok', data: { id_kelompok: id_kelompok } };
  },

  // Ubah nama/status kelompok
  updateKelompokPartner: async function(id_kelompok, updates) {
    var payload = { updated_at: new Date().toISOString() };
    if (updates.nama_kelompok !== undefined) payload.nama_kelompok = updates.nama_kelompok;
    if (updates.status !== undefined)        payload.status = updates.status;
    var { error } = await _sb.from('kelompok_partner_qiyam').update(payload).eq('id_kelompok', id_kelompok);
    _check(error, 'updateKelompokPartner');
    return { status: 'ok' };
  },

  // Ganti seluruh anggota kelompok (replace). anggota: [{id_murid, nama_murid}]
  // [Atomic] 1 transaksi via RPC agar tidak menyisakan kelompok tanpa
  // anggota jika insert pengganti gagal (validasi roster/aktif atau koneksi putus)
  setAnggotaKelompok: async function(id_kelompok, anggota) {
    var rows = (anggota || []).map(function(a) {
      return { id_murid: a.id_murid, nama_murid: a.nama_murid || null };
    });
    var { error } = await _sb.rpc('set_anggota_kelompok_partner', {
      p_id_kelompok: id_kelompok, p_anggota: rows
    });
    _check(error, 'setAnggotaKelompok');
    return { status: 'ok' };
  },

  // C3 fix (bug hunt 2026-08-18, patch_088): tambah/hapus 1 anggota tanpa
  // membangun ulang seluruh daftar dari cache klien -- setAnggotaKelompok
  // di atas rawan "stale read" (2 tab edit bersamaan bisa menghidupkan
  // kembali/menghapus anggota yang salah). Ini murni mutasi 1 baris.
  addAnggotaKelompok: async function(id_kelompok, id_murid, nama_murid) {
    var { error } = await _sb.rpc('add_anggota_kelompok_partner', {
      p_id_kelompok: id_kelompok, p_id_murid: id_murid, p_nama_murid: nama_murid || null
    });
    _check(error, 'addAnggotaKelompok');
    return { status: 'ok' };
  },
  removeAnggotaKelompok: async function(id_kelompok, id_murid) {
    var { error } = await _sb.rpc('remove_anggota_kelompok_partner', {
      p_id_kelompok: id_kelompok, p_id_murid: id_murid
    });
    _check(error, 'removeAnggotaKelompok');
    return { status: 'ok' };
  },

  // Hapus kelompok (anggota ikut terhapus via on delete cascade)
  deleteKelompokPartner: async function(id_kelompok) {
    var { error } = await _sb.from('kelompok_partner_qiyam').delete().eq('id_kelompok', id_kelompok);
    _check(error, 'deleteKelompokPartner');
    return { status: 'ok' };
  },

  // ── Kelompok Partner Belajar (Level 1-4, non-Qiyam) ──────────────────
  // Daftar nama_level dengan Partner Belajar aktif (untuk filter selector)
  getLevelBelajarEnabled: async function() {
    var data = await _belajarLevelNames();
    return { status: 'ok', data: data };
  },

  // Halaqah guru dengan level partner_belajar_enabled=true
  getBelajarHalaqah: async function() {
    var namaLevels = await _belajarLevelNames();
    if (!namaLevels.length) return { status: 'ok', data: [] };
    var { data, error } = await _sb.from('halaqah')
      .select('id_halaqah, nama_halaqah, level, jadwal_hari, jam_mulai, jam_selesai')
      .eq('id_guru', _uid())
      .in('level', namaLevels)
      .eq('status', 'aktif')
      .order('nama_halaqah');
    _check(error, 'getBelajarHalaqah');
    if (data) {
      data = data.map(function(h) {
        return Object.assign({}, h, {
          jam_mulai: h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
          jam_selesai: h.jam_selesai ? h.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data: data || [] };
  },

  // Murid aktif di halaqah Partner Belajar tertentu (untuk form kelompok)
  getMuridBelajar: async function(id_halaqah) {
    var { data, error } = await _sb.from('anggota')
      .select('id_murid, nama_murid')
      .eq('id_halaqah', id_halaqah)
      .eq('status', 'aktif')
      .order('nama_murid');
    _check(error, 'getMuridBelajar');
    return { status: 'ok', data: data || [] };
  },

  getKelompokBelajarHalaqah: async function(id_halaqah) {
    var { data, error } = await _sb.from('kelompok_partner_belajar')
      .select('*, anggota_kelompok_belajar(*)')
      .eq('id_halaqah', id_halaqah)
      .order('created_at', { ascending: true });
    _check(error, 'getKelompokBelajarHalaqah');
    return { status: 'ok', data: data || [] };
  },

  // Pantau denyut tiap anggota kelompok belajar di sebuah halaqah
  // (tanggal aktivitas terakhir, jumlah menunggu/dikonfirmasi, no_hp)
  getPantauKelompokBelajar: async function(id_halaqah) {
    var { data, error } = await _sb.rpc('get_pantau_kelompok_belajar', { p_id_halaqah: id_halaqah });
    _check(error, 'getPantauKelompokBelajar');
    return { status: 'ok', data: data || [] };
  },

  // ── Lini Masa Kelompok untuk guru/admin (per kelompok) ──
  getLiniMasaBelajarKelompok: async function(id_kelompok) {
    var { data, error } = await _sb.rpc('get_lini_masa_belajar', { p_id_kelompok: id_kelompok });
    _check(error, 'getLiniMasaBelajarKelompok');
    return { status: 'ok', data: data || [] };
  },
  getMilestoneBelajarByKelompok: async function(id_kelompok) {
    var { data, error } = await _sb.from('milestone_kelompok_belajar')
      .select('*').eq('id_kelompok', id_kelompok)
      .order('tanggal', { ascending: false }).order('created_at', { ascending: false });
    _check(error, 'getMilestoneBelajarByKelompok');
    return { status: 'ok', data: data || [] };
  },
  addMilestoneBelajarKelompok: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok  : d.id_kelompok,
      id_halaqah   : d.id_halaqah,
      judul        : d.judul,
      // L3 fix (bug hunt 2026-08-18): _localDate() device-local -> _todayJakarta()
      tanggal      : d.tanggal || _todayJakarta(),
      dibuat_oleh  : _uid(),
      nama_pembuat : (user && (user.nama_lengkap || user.nama)) || 'Ustadz',
    };
    var { data, error } = await _sb.from('milestone_kelompok_belajar').insert(payload).select().single();
    _check(error, 'addMilestoneBelajarKelompok');
    return { status: 'ok', data: data };
  },
  deleteMilestoneBelajarKelompok: async function(id_milestone) {
    var { error } = await _sb.from('milestone_kelompok_belajar').delete().eq('id_milestone', id_milestone);
    _check(error, 'deleteMilestoneBelajarKelompok');
    return { status: 'ok' };
  },

  // Konfirmasi aktivitas belajar oleh guru/admin (jalan keluar bila partner berhalangan)
  guruKonfirmasiLogBelajar: async function(id_log, kelancaran, catatan) {
    var logData = null;
    try {
      var { data } = await _sb.from('log_belajar_mandiri')
        .select('id_murid, jenis_aktivitas')
        .eq('id_log', id_log)
        .single();
      logData = data;
    } catch(e) {}

    var { error } = await _sb.rpc('guru_konfirmasi_log_belajar', {
      p_id_log: id_log, p_kelancaran: kelancaran, p_catatan: catatan || null,
    });
    _check(error, 'guruKonfirmasiLogBelajar');

    if (logData && logData.id_murid) {
      _sendPushBg({
        user_ids: [logData.id_murid],
        title   : '✓ Laporan Dikonfirmasi (Guru)',
        body    : 'Aktivitas "' + logData.jenis_aktivitas + '" kamu telah dikonfirmasi oleh Guru Halaqah!',
        url     : '/Portal-Halaqah-Rattililquran/murid/index.html?page=partner-belajar',
        tag     : 'partner-belajar-konf-' + id_log,
        data    : { trigger: 'partner_belajar_konf', id_log: id_log }
      });
    }

    return { status: 'ok' };
  },
  // Daftar aktivitas belajar yang masih menunggu di sebuah halaqah (untuk guru konfirmasi)
  getLogBelajarMenungguHalaqah: async function(id_halaqah) {
    var { data, error } = await _sb.from('log_belajar_mandiri')
      .select('id_log, id_murid, nama_murid, tanggal, jenis_aktivitas, deskripsi, durasi_menit, created_at')
      .eq('id_halaqah', id_halaqah).eq('status_konfirmasi', 'menunggu')
      .order('created_at', { ascending: true });
    _check(error, 'getLogBelajarMenungguHalaqah');
    return { status: 'ok', data: data || [] };
  },

  // Target bersama kelompok (guru/admin)
  getTargetBelajarByKelompok: async function(id_kelompok) {
    var res = await _sb.from('target_kelompok_belajar')
      .select('*, target_belajar_progress(id_murid, nama_murid)')
      .eq('id_kelompok', id_kelompok).order('created_at', { ascending: false });
    if (res.error) {
      var fb = await _sb.from('target_kelompok_belajar')
        .select('*').eq('id_kelompok', id_kelompok).order('created_at', { ascending: false });
      _check(fb.error, 'getTargetBelajarByKelompok');
      return { status: 'ok', data: fb.data || [] };
    }
    return { status: 'ok', data: res.data || [] };
  },
  addTargetBelajarByKelompok: async function(d) {
    var user = _currentUser || {};
    var payload = {
      id_kelompok : d.id_kelompok,
      id_halaqah  : d.id_halaqah,
      judul       : d.judul,
      tanggal_target: d.tanggal_target || null,
      dibuat_oleh : _uid(),
      nama_pembuat: (user && (user.nama_lengkap || user.nama)) || 'Ustadz',
    };
    var { data, error } = await _sb.from('target_kelompok_belajar').insert(payload).select().single();
    _check(error, 'addTargetBelajarByKelompok');
    return { status: 'ok', data: data };
  },
  updateTargetBelajarByKelompok: async function(id_target, updates) {
    // H4 fix (bug hunt 2026-08-18, patch_089): lihat catatan di updateTargetByKelompok
    // (versi Qiyam) -- mirror-nya utk Partner Belajar.
    var payload = Object.assign({}, updates);
    if (updates && updates.status === 'tercapai') payload.dipaksa_guru = true;
    else if (updates && updates.status === 'aktif') payload.dipaksa_guru = false;
    var { error } = await _sb.from('target_kelompok_belajar').update(payload).eq('id_target', id_target);
    _check(error, 'updateTargetBelajarByKelompok');
    return { status: 'ok' };
  },
  deleteTargetBelajarByKelompok: async function(id_target) {
    var { error } = await _sb.from('target_kelompok_belajar').delete().eq('id_target', id_target);
    _check(error, 'deleteTargetBelajarByKelompok');
    return { status: 'ok' };
  },

  // Buat kelompok baru (3-5 anggota). anggota: [{id_murid, nama_murid}]
  // [Atomic] 1 transaksi via RPC agar tidak menyisakan kelompok kosong jika
  // insert anggota gagal (validasi roster/aktif atau koneksi putus)
  createKelompokBelajar: async function(id_halaqah, nama_kelompok, anggota) {
    var rows = (anggota || []).map(function(a) {
      return { id_murid: a.id_murid, nama_murid: a.nama_murid || null };
    });
    var { data: id_kelompok, error } = await _sb.rpc('create_kelompok_belajar', {
      p_id_halaqah: id_halaqah, p_nama_kelompok: nama_kelompok || null, p_anggota: rows
    });
    _check(error, 'createKelompokBelajar');
    return { status: 'ok', data: { id_kelompok: id_kelompok } };
  },

  // Ubah nama/status kelompok
  updateKelompokBelajar: async function(id_kelompok, updates) {
    var payload = { updated_at: new Date().toISOString() };
    if (updates.nama_kelompok !== undefined) payload.nama_kelompok = updates.nama_kelompok;
    if (updates.status !== undefined)        payload.status = updates.status;
    var { error } = await _sb.from('kelompok_partner_belajar').update(payload).eq('id_kelompok', id_kelompok);
    _check(error, 'updateKelompokBelajar');
    return { status: 'ok' };
  },

  // Ganti seluruh anggota kelompok (replace, 3-5 anggota). anggota: [{id_murid, nama_murid}]
  // [Atomic] 1 transaksi via RPC agar tidak menyisakan kelompok tanpa
  // anggota jika insert pengganti gagal (validasi roster/aktif atau koneksi putus)
  setAnggotaKelompokBelajar: async function(id_kelompok, anggota) {
    var rows = (anggota || []).map(function(a) {
      return { id_murid: a.id_murid, nama_murid: a.nama_murid || null };
    });
    var { error } = await _sb.rpc('set_anggota_kelompok_belajar', {
      p_id_kelompok: id_kelompok, p_anggota: rows
    });
    _check(error, 'setAnggotaKelompokBelajar');
    return { status: 'ok' };
  },

  // C3 fix (bug hunt 2026-08-18, patch_088): lihat addAnggotaKelompok/
  // removeAnggotaKelompok (versi Qiyam) -- mirror-nya utk Partner Belajar.
  addAnggotaKelompokBelajar: async function(id_kelompok, id_murid, nama_murid) {
    var { error } = await _sb.rpc('add_anggota_kelompok_belajar', {
      p_id_kelompok: id_kelompok, p_id_murid: id_murid, p_nama_murid: nama_murid || null
    });
    _check(error, 'addAnggotaKelompokBelajar');
    return { status: 'ok' };
  },
  removeAnggotaKelompokBelajar: async function(id_kelompok, id_murid) {
    var { error } = await _sb.rpc('remove_anggota_kelompok_belajar', {
      p_id_kelompok: id_kelompok, p_id_murid: id_murid
    });
    _check(error, 'removeAnggotaKelompokBelajar');
    return { status: 'ok' };
  },

  // Hapus kelompok (anggota ikut terhapus via on delete cascade; log_belajar_mandiri
  // TIDAK ikut terhapus -- id_kelompok tanpa FK, riwayat aktivitas tetap utuh)
  deleteKelompokBelajar: async function(id_kelompok) {
    var { error } = await _sb.from('kelompok_partner_belajar').delete().eq('id_kelompok', id_kelompok);
    _check(error, 'deleteKelompokBelajar');
    return { status: 'ok' };
  },

  getHalaqahPRSubmissions: async function(id_halaqah) {
    // 1. Ambil list murid yang statusnya aktif di halaqah ini
    var { data: activeAnggota } = await _sb.from('anggota')
      .select('id_murid')
      .eq('id_halaqah', id_halaqah)
      .eq('status', 'aktif');
    
    var activeMuridIds = (activeAnggota || []).map(function(a) { return a.id_murid; });
    if (activeMuridIds.length === 0) {
      return { status: 'ok', data: [] };
    }

    // 2. Tarik log PR hanya untuk murid aktif di halaqah ini
    var { data, error } = await _sb.from('nilai_kbm')
      .select('id_nilai, id_murid, id_halaqah, tanggal, pertemuan_ke, status_hadir, pr_status, pr_catatan_murid, pr_lampiran_url, pr_submitted_at, pr_status_nilai, pr_catatan_guru, pr_lampiran_guru_url, users(nama_lengkap, no_hp), kbm_log!nilai_kbm_id_kbm_fkey(latihan_mandiri,deadline_latihan)')
      .eq('id_halaqah', id_halaqah)
      .in('id_murid', activeMuridIds)
      .not('kbm_log.latihan_mandiri', 'is', null)
      .order('tanggal', { ascending: false });
    _check(error, 'getHalaqahPRSubmissions');
    return { status: 'ok', data: (data || []).filter(function(d) {
      return d.kbm_log && d.kbm_log.latihan_mandiri;
    }).map(function(d) {
      return Object.assign({}, d, {
        nama_murid: d.users ? d.users.nama_lengkap : '',
        no_wa: d.users ? d.users.no_hp : ''
      });
    }) };
  },

  nilaiPR: async function(id_nilai, status_nilai, catatan_guru, lampiran_guru_url) {
    var { data, error } = await _sb.rpc('nilai_latihan_mandiri', {
      p_id_nilai: id_nilai,
      p_pr_status_nilai: status_nilai,
      p_pr_catatan_guru: catatan_guru,
      p_pr_lampiran_guru_url: lampiran_guru_url || null
    });
    _check(error, 'nilaiPR');
    return { status: 'ok', data: data };
  },

  // ── Quiz Management (Guru) ─────────────────
  getKuisList: async function() {
    var id_guru = _uid();
    var { data: kuisData, error } = await _sb.from('quiz')
      .select('*, quiz_halaqah(id_halaqah, halaqah(nama_halaqah)), quiz_soal(id_soal)')
      .eq('id_guru', id_guru)
      .order('created_at', { ascending: false });
    _check(error, 'getKuisList');
    
    var list = (kuisData || []).map(function(q) {
      return Object.assign({}, q, {
        total_soal: (q.quiz_soal || []).length,
        assigned_halaqah: (q.quiz_halaqah || []).map(function(qh) {
          return { id_halaqah: qh.id_halaqah, nama_halaqah: qh.halaqah ? qh.halaqah.nama_halaqah : '' };
        })
      });
    });
    return { status: 'ok', data: list };
  },

  // ── Rattil Maze (guru) — kelola level MILIK guru; RLS maze_level_write (id_guru=self) ──
  getMazeLevelsGuru: async function() {
    var { data, error } = await _sb.from('maze_level')
      .select('*').eq('id_guru', _uid()).order('urutan', { ascending: true });
    _check(error, 'getMazeLevelsGuru');
    return { status: 'ok', data: data || [] };
  },
  createMazeLevelGuru: async function(payload) {
    var row = {
      id_guru:           _uid(),
      nama_level:        payload.nama_level,
      urutan:            payload.urutan != null ? payload.urutan : 0,
      map_data:          payload.map_data,
      jumlah_monster:    payload.jumlah_monster != null ? payload.jumlah_monster : 2,
      kecepatan_monster: payload.kecepatan_monster != null ? payload.kecepatan_monster : 1.0,
      id_kuis:           payload.id_kuis || null,
      tingkat_kesulitan: payload.tingkat_kesulitan || 'mudah',
      target_halaqah:    payload.target_halaqah || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:             payload.aktif !== false
    };
    var { data, error } = await _sb.from('maze_level').insert([row]).select().single();
    _check(error, 'createMazeLevelGuru');
    if (!data) throw new Error('createMazeLevelGuru: 0 baris tersimpan (akses ditolak?).');
    return { status: 'ok', data: data };
  },
  updateMazeLevelGuru: async function(id_maze_level, payload) {
    var row = {
      nama_level:        payload.nama_level,
      urutan:            payload.urutan != null ? payload.urutan : 0,
      jumlah_monster:    payload.jumlah_monster != null ? payload.jumlah_monster : 2,
      kecepatan_monster: payload.kecepatan_monster != null ? payload.kecepatan_monster : 1.0,
      id_kuis:           payload.id_kuis || null,
      tingkat_kesulitan: payload.tingkat_kesulitan || 'mudah',
      target_halaqah:    payload.target_halaqah || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:             payload.aktif !== false
    };
    if (payload.map_data) row.map_data = payload.map_data;
    var { data, error } = await _sb.from('maze_level')
      .update(row).eq('id_maze_level', id_maze_level).select('id_maze_level');
    _check(error, 'updateMazeLevelGuru');
    if (!data || data.length === 0) throw new Error('Perubahan tidak tersimpan (0 baris — bukan level Anda / akses ditolak).');
    return { status: 'ok' };
  },
  setMazeLevelAktifGuru: async function(id_maze_level, aktif) {
    var { data, error } = await _sb.from('maze_level')
      .update({ aktif: !!aktif }).eq('id_maze_level', id_maze_level).select('id_maze_level');
    _check(error, 'setMazeLevelAktifGuru');
    if (!data || data.length === 0) throw new Error('Gagal mengubah status (0 baris).');
    return { status: 'ok' };
  },
  deleteMazeLevelGuru: async function(id_maze_level) {
    var { error } = await _sb.from('maze_level').delete().eq('id_maze_level', id_maze_level);
    _check(error, 'deleteMazeLevelGuru');
    return { status: 'ok' };
  },

  // ── Rattil Run (guru) — kelola level MILIK guru; RLS run_level_write (id_guru=self) ──
  getRunLevelsGuru: async function() {
    var { data, error } = await _sb.from('run_level')
      .select('*').eq('id_guru', _uid()).order('urutan', { ascending: true });
    _check(error, 'getRunLevelsGuru');
    return { status: 'ok', data: data || [] };
  },
  createRunLevelGuru: async function(payload) {
    var row = {
      id_guru:             _uid(),
      nama_level:          payload.nama_level,
      urutan:              payload.urutan != null ? payload.urutan : 0,
      target_soal:         payload.target_soal != null ? payload.target_soal : 8,
      kecepatan_awal:      payload.kecepatan_awal != null ? payload.kecepatan_awal : 1.0,
      kepadatan_rintangan: payload.kepadatan_rintangan != null ? payload.kepadatan_rintangan : 1.0,
      id_kuis:             payload.id_kuis || null,
      tingkat_kesulitan:   payload.tingkat_kesulitan || 'mudah',
      target_halaqah:      payload.target_halaqah || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:               payload.aktif !== false
    };
    var { data, error } = await _sb.from('run_level').insert([row]).select().single();
    _check(error, 'createRunLevelGuru');
    if (!data) throw new Error('createRunLevelGuru: 0 baris tersimpan (akses ditolak?).');
    return { status: 'ok', data: data };
  },
  updateRunLevelGuru: async function(id_run_level, payload) {
    var row = {
      nama_level:          payload.nama_level,
      urutan:              payload.urutan != null ? payload.urutan : 0,
      target_soal:         payload.target_soal != null ? payload.target_soal : 8,
      kecepatan_awal:      payload.kecepatan_awal != null ? payload.kecepatan_awal : 1.0,
      kepadatan_rintangan: payload.kepadatan_rintangan != null ? payload.kepadatan_rintangan : 1.0,
      id_kuis:             payload.id_kuis || null,
      tingkat_kesulitan:   payload.tingkat_kesulitan || 'mudah',
      target_halaqah:      payload.target_halaqah || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:               payload.aktif !== false
    };
    var { data, error } = await _sb.from('run_level')
      .update(row).eq('id_run_level', id_run_level).select('id_run_level');
    _check(error, 'updateRunLevelGuru');
    if (!data || data.length === 0) throw new Error('Perubahan tidak tersimpan (0 baris — bukan level Anda / akses ditolak).');
    return { status: 'ok' };
  },
  setRunLevelAktifGuru: async function(id_run_level, aktif) {
    var { data, error } = await _sb.from('run_level')
      .update({ aktif: !!aktif }).eq('id_run_level', id_run_level).select('id_run_level');
    _check(error, 'setRunLevelAktifGuru');
    if (!data || data.length === 0) throw new Error('Gagal mengubah status (0 baris).');
    return { status: 'ok' };
  },
  deleteRunLevelGuru: async function(id_run_level) {
    var { error } = await _sb.from('run_level').delete().eq('id_run_level', id_run_level);
    _check(error, 'deleteRunLevelGuru');
    return { status: 'ok' };
  },

  createKuis: async function(payload) {
    var id_guru = _uid();
    var id_quiz = 'QZ-' + _genId('');
    var kuisRow = {
      id_quiz: id_quiz,
      id_guru: id_guru,
      judul: payload.judul,
      deskripsi: payload.deskripsi || null,
      kategori: payload.kategori || 'Umum',
      mode: payload.mode || 'mandiri',
      status: payload.status || 'draft',
      durasi_per_soal_detik: payload.durasi_per_soal_detik !== undefined ? payload.durasi_per_soal_detik : 30,
      urutan_soal: payload.urutan_soal || 'berurutan',
      tampilkan_jawaban: payload.tampilkan_jawaban || 'setelah_submit',
      boleh_retake: payload.boleh_retake || false,
      tgl_mulai: payload.tgl_mulai || null,
      tgl_selesai: payload.tgl_selesai || null,
      anti_tab_aktif: payload.anti_tab_aktif !== undefined ? payload.anti_tab_aktif : true,
      maks_peringatan_tab: payload.maks_peringatan_tab || 2
    };

    var { data, error } = await _sb.from('quiz').insert([kuisRow]).select().single();
    _check(error, 'createKuis');

    if (payload.id_halaqah_list && payload.id_halaqah_list.length > 0) {
      var halaqahRows = payload.id_halaqah_list.map(function(hid) {
        return { id_quiz: id_quiz, id_halaqah: hid };
      });
      var { error: hqErr } = await _sb.from('quiz_halaqah').insert(halaqahRows);
      _check(hqErr, 'createKuis:quiz_halaqah');
    }

    return { status: 'ok', data: data };
  },

  updateKuis: async function(id_quiz, payload) {
    var kuisRow = {};
    if (payload.judul !== undefined) kuisRow.judul = payload.judul;
    if (payload.deskripsi !== undefined) kuisRow.deskripsi = payload.deskripsi;
    if (payload.kategori !== undefined) kuisRow.kategori = payload.kategori;
    if (payload.mode !== undefined) kuisRow.mode = payload.mode;
    if (payload.status !== undefined) kuisRow.status = payload.status;
    if (payload.durasi_per_soal_detik !== undefined) kuisRow.durasi_per_soal_detik = payload.durasi_per_soal_detik;
    if (payload.urutan_soal !== undefined) kuisRow.urutan_soal = payload.urutan_soal;
    if (payload.tampilkan_jawaban !== undefined) kuisRow.tampilkan_jawaban = payload.tampilkan_jawaban;
    if (payload.boleh_retake !== undefined) kuisRow.boleh_retake = payload.boleh_retake;
    if (payload.tgl_mulai !== undefined) kuisRow.tgl_mulai = payload.tgl_mulai;
    if (payload.tgl_selesai !== undefined) kuisRow.tgl_selesai = payload.tgl_selesai;
    if (payload.anti_tab_aktif !== undefined) kuisRow.anti_tab_aktif = payload.anti_tab_aktif;
    if (payload.maks_peringatan_tab !== undefined) kuisRow.maks_peringatan_tab = payload.maks_peringatan_tab;
    kuisRow.updated_at = new Date().toISOString();

    var { data, error } = await _sb.from('quiz').update(kuisRow).eq('id_quiz', id_quiz).select().single();
    _check(error, 'updateKuis');

    if (payload.id_halaqah_list !== undefined) {
      await _sb.from('quiz_halaqah').delete().eq('id_quiz', id_quiz);
      if (payload.id_halaqah_list.length > 0) {
        var halaqahRows = payload.id_halaqah_list.map(function(hid) {
          return { id_quiz: id_quiz, id_halaqah: hid };
        });
        var { error: hqErr } = await _sb.from('quiz_halaqah').insert(halaqahRows);
        _check(hqErr, 'updateKuis:quiz_halaqah');
      }
    }

    return { status: 'ok', data: data };
  },

  deleteKuis: async function(id_quiz) {
    var { error } = await _sb.from('quiz').delete().eq('id_quiz', id_quiz);
    _check(error, 'deleteKuis');
    return { status: 'ok' };
  },

  getBankSoal: async function(kategori, tipe_soal, level, pertemuan_ke) {
    var q = _sb.from('soal')
      .select('*, users!id_guru(nama_lengkap), soal_pilihan(*), soal_pasangan(*), soal_kunci_isian(*)')
      .order('created_at', { ascending: false });

    if (kategori) q = q.eq('kategori', kategori);
    if (tipe_soal) q = q.eq('tipe_soal', tipe_soal);
    if (level) q = q.contains('levels', [level]);
    if (pertemuan_ke !== undefined && pertemuan_ke !== null && pertemuan_ke !== '') {
      q = q.eq('rekomendasi_pertemuan_ke', parseInt(pertemuan_ke));
    }

    var { data, error } = await q;
    _check(error, 'getBankSoal');
    return { status: 'ok', data: data || [] };
  },

  createSoal: async function(payload) {
    try {
      var id_guru = _uid();
      var id_soal = 'SL-' + _genId('');
      var soalRow = {
        id_soal: id_soal,
        id_guru: id_guru,
        tipe_soal: payload.tipe_soal,
        teks_soal: payload.teks_soal,
        teks_arab: payload.teks_arab || null,
        highlight_markup: payload.highlight_markup || null,
        audio_url: payload.audio_url || null,
        audio_tipe: payload.audio_tipe || null,
        isian_case_sensitive: payload.isian_case_sensitive || false,
        isian_abaikan_tanda_baca: payload.isian_abaikan_tanda_baca || false,
        penjelasan: payload.penjelasan || null,
        levels: payload.levels || [],
        rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke !== undefined && payload.rekomendasi_pertemuan_ke !== null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
        durasi_detik_default: (payload.durasi_detik_default !== undefined && payload.durasi_detik_default !== null && payload.durasi_detik_default !== '') ? parseInt(payload.durasi_detik_default) : null,
        bobot_poin_default: (payload.bobot_poin_default !== undefined && payload.bobot_poin_default !== null && payload.bobot_poin_default !== '') ? parseInt(payload.bobot_poin_default) : 10,
        boleh_maze: !!payload.boleh_maze,
        boleh_run: !!payload.boleh_run
      };

      var { data: soalData, error } = await _sb.from('soal').insert([soalRow]).select().single();
      _check(error, 'createSoal');

      if (payload.pilihan && payload.pilihan.length > 0) {
        var pilihanRows = payload.pilihan.map(function(p, idx) {
          return {
            id_soal: id_soal,
            teks_pilihan: p.teks_pilihan,
            urutan: idx + 1,
            is_benar: !!p.is_benar
          };
        });
        var { error: pilErr } = await _sb.from('soal_pilihan').insert(pilihanRows);
        _check(pilErr, 'createSoal:pilihan');
      }

      if (payload.pasangan && payload.pasangan.length > 0) {
        var pasanganRows = payload.pasangan.map(function(p, idx) {
          return {
            id_soal: id_soal,
            teks_kiri: p.teks_kiri,
            teks_kanan: p.teks_kanan,
            urutan: idx + 1
          };
        });
        var { error: pasErr } = await _sb.from('soal_pasangan').insert(pasanganRows);
        _check(pasErr, 'createSoal:pasangan');
      }

      if (payload.kunci_isian && payload.kunci_isian.length > 0) {
        var kunciRows = payload.kunci_isian.map(function(k) {
          return {
            id_soal: id_soal,
            teks_kunci: String(k).trim()
          };
        });
        var { error: kunErr } = await _sb.from('soal_kunci_isian').insert(kunciRows);
        _check(kunErr, 'createSoal:kunci_isian');
      }

      return { status: 'ok', data: soalData };
    } catch (e) {
      if (e.message && (e.message.indexOf('Load failed') !== -1 || e.message.indexOf('Failed to fetch') !== -1)) {
        throw new Error('Gagal menyimpan soal. Pastikan database patch_062_quiz_bugfix.sql sudah dijalankan di Supabase SQL Editor.');
      }
      throw e;
    }
  },

  updateSoal: async function(id_soal, payload) {
    var { error } = await _sb.rpc('update_soal', {
      p_id_soal: id_soal,
      p_teks_soal: payload.teks_soal || null,
      p_penjelasan: payload.penjelasan || null,
      p_highlight: payload.highlight_markup || null
    });
    _check(error, 'updateSoal');
    return { status: 'ok' };
  },

  getSoalDetail: async function(id_soal) {
    var { data, error } = await _sb.from('soal')
      .select('*, soal_pilihan(*), soal_pasangan(*), soal_kunci_isian(*)')
      .eq('id_soal', id_soal)
      .single();
    _check(error, 'getSoalDetail');
    return { status: 'ok', data: data };
  },

  updateSoalFull: async function(id_soal, payload) {
    var soalRow = {
      tipe_soal: payload.tipe_soal,
      teks_soal: payload.teks_soal,
      teks_arab: payload.teks_arab || null,
      highlight_markup: payload.highlight_markup || null,
      audio_url: payload.audio_url || null,
      audio_tipe: payload.audio_tipe || null,
      isian_case_sensitive: payload.isian_case_sensitive || false,
      isian_abaikan_tanda_baca: payload.isian_abaikan_tanda_baca || false,
      penjelasan: payload.penjelasan || null,
      levels: payload.levels || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke !== undefined && payload.rekomendasi_pertemuan_ke !== null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      durasi_detik_default: (payload.durasi_detik_default !== undefined && payload.durasi_detik_default !== null && payload.durasi_detik_default !== '') ? parseInt(payload.durasi_detik_default) : null,
      bobot_poin_default: (payload.bobot_poin_default !== undefined && payload.bobot_poin_default !== null && payload.bobot_poin_default !== '') ? parseInt(payload.bobot_poin_default) : 10,
      boleh_maze: !!payload.boleh_maze,
      boleh_run: !!payload.boleh_run
    };

    // .select() agar bisa mendeteksi jumlah baris terupdate. Di bawah RLS, update yang
    // diblok (bukan pemilik/bukan admin) mengembalikan 0 baris TANPA error — kalau
    // tidak dicek, kita salah melapor "berhasil". Guard ini juga WAJIB sebelum delete
    // opsi di bawah, agar pilihan/pasangan/kunci tidak ikut terhapus saat soal-nya
    // sendiri gagal diperbarui.
    var { data: updatedRows, error: updateErr } = await _sb.from('soal')
      .update(soalRow).eq('id_soal', id_soal).select('id_soal');
    _check(updateErr, 'updateSoalFull:soal');
    if (!updatedRows || updatedRows.length === 0) {
      // L5 fix (bug hunt 2026-08-18): pesan lama menyalahkan "soal terkunci" (soal
      // dipakai kuis yg sudah dikerjakan murid) -- lock itu sudah DIHAPUS sejak
      // patch_068 begitu pola snapshot bank soal membuat riwayat kuis kebal thd
      // edit bank soal. Satu-satunya penyebab 0 baris yg tersisa adalah RLS/akses.
      throw new Error('Soal tidak bisa diedit: bukan milik Anda atau akses ditolak.');
    }

    // MB9 fix (bug hunt 2026-08-27): dulu tak satu pun dari 3 hasil delete ini
    // dicek errornya -- kalau salah satu gagal diam-diam (mis. RLS/network),
    // insert opsi baru di bawah tetap jalan di atas sisa opsi lama yg gagal
    // terhapus, mencampur opsi lama+baru di 1 soal Bank Soal bersama.
    var _delResults = await Promise.all([
      _sb.from('soal_pilihan').delete().eq('id_soal', id_soal),
      _sb.from('soal_pasangan').delete().eq('id_soal', id_soal),
      _sb.from('soal_kunci_isian').delete().eq('id_soal', id_soal)
    ]);
    _delResults.forEach(function(r) { _check(r.error, 'updateSoalFull:hapus_opsi_lama'); });

    if (payload.pilihan && payload.pilihan.length > 0) {
      var pilihanRows = payload.pilihan.map(function(p, idx) {
        return {
          id_soal: id_soal,
          teks_pilihan: p.teks_pilihan,
          urutan: idx + 1,
          is_benar: !!p.is_benar
        };
      });
      var { error: pilErr } = await _sb.from('soal_pilihan').insert(pilihanRows);
      _check(pilErr, 'updateSoalFull:pilihan');
    }

    if (payload.pasangan && payload.pasangan.length > 0) {
      var pasanganRows = payload.pasangan.map(function(p, idx) {
        return {
          id_soal: id_soal,
          teks_kiri: p.teks_kiri,
          teks_kanan: p.teks_kanan,
          urutan: idx + 1
        };
      });
      var { error: pasErr } = await _sb.from('soal_pasangan').insert(pasanganRows);
      _check(pasErr, 'updateSoalFull:pasangan');
    }

    if (payload.kunci_isian && payload.kunci_isian.length > 0) {
      var kunciRows = payload.kunci_isian.map(function(k) {
        return {
          id_soal: id_soal,
          teks_kunci: String(k).trim()
        };
      });
      var { error: kunErr } = await _sb.from('soal_kunci_isian').insert(kunciRows);
      _check(kunErr, 'updateSoalFull:kunci_isian');
    }

    return { status: 'ok' };
  },

  deleteSoal: async function(id_soal) {
    try {
      var { error } = await _sb.from('soal').delete().eq('id_soal', id_soal);
      if (error) {
        if (error.code === '23503') {
          throw new Error('Soal tidak bisa dihapus karena sedang digunakan dalam kuis.');
        }
        _check(error, 'deleteSoal');
      }
      return { status: 'ok' };
    } catch (e) {
      if (e.message && (e.message.indexOf('Load failed') !== -1 || e.message.indexOf('Failed to fetch') !== -1)) {
        throw new Error('Soal tidak bisa dihapus. Silakan pastikan kuis yang menggunakan soal ini sudah dihapus atau database patch_062_quiz_bugfix.sql sudah dijalankan.');
      }
      throw e;
    }
  },

  addSoalToKuis: async function(id_quiz, id_soal, urutan, bobot_poin, durasi_detik_override) {
    var finalPoin = bobot_poin;
    var finalDurasi = durasi_detik_override;

    if (finalPoin === undefined || finalPoin === null || finalDurasi === undefined || finalDurasi === null) {
      try {
        var { data: soalData } = await _sb.from('soal').select('durasi_detik_default, bobot_poin_default').eq('id_soal', id_soal).single();
        if (soalData) {
          if (finalPoin === undefined || finalPoin === null) {
            finalPoin = soalData.bobot_poin_default !== null && soalData.bobot_poin_default !== undefined ? soalData.bobot_poin_default : 10;
          }
          if (finalDurasi === undefined || finalDurasi === null) {
            finalDurasi = soalData.durasi_detik_default !== null && soalData.durasi_detik_default !== undefined ? soalData.durasi_detik_default : null;
          }
        }
      } catch (e) {
        console.warn('[Quiz] Failed to fetch soal defaults:', e);
      }
    }
    finalPoin = finalPoin !== undefined && finalPoin !== null ? finalPoin : 10;
    finalDurasi = finalDurasi || null;

    if (urutan === undefined || urutan === null) {
      // LB13 fix (bug hunt 2026-08-27): dulu SELECT max(urutan) lalu INSERT sbg 2
      // langkah terpisah -- 2 panggilan bersamaan (2 tab/guru menambah soal ke
      // kuis yg sama nyaris bersamaan) bisa membaca max yg sama & dpt urutan
      // kembar. RPC ini mengunci (advisory lock per id_quiz) + hitung max+1 +
      // insert dlm 1 transaksi atomik.
      var { error: rpcErr } = await _sb.rpc('add_soal_to_kuis_auto_urutan', {
        p_id_quiz: id_quiz, p_id_soal: id_soal,
        p_bobot_poin: finalPoin, p_durasi_detik_override: finalDurasi
      });
      _check(rpcErr, 'addSoalToKuis:auto_urutan');
      return { status: 'ok' };
    }

    var { error } = await _sb.from('quiz_soal').insert([{
      id_quiz: id_quiz,
      id_soal: id_soal,
      urutan: urutan,
      bobot_poin: finalPoin,
      durasi_detik_override: finalDurasi
    }]);
    _check(error, 'addSoalToKuis');
    return { status: 'ok' };
  },

  updateSoalKuisSetting: async function(id_quiz, id_soal, durasi_detik_override, bobot_poin) {
    var payload = {};
    if (durasi_detik_override !== undefined) payload.durasi_detik_override = durasi_detik_override ? parseInt(durasi_detik_override) : null;
    if (bobot_poin !== undefined) payload.bobot_poin = parseInt(bobot_poin) || 10;

    var { error } = await _sb.from('quiz_soal').update(payload).eq('id_quiz', id_quiz).eq('id_soal', id_soal);
    _check(error, 'updateSoalKuisSetting');
    return { status: 'ok' };
  },

  removeSoalFromKuis: async function(id_quiz, id_soal) {
    try {
      var { error } = await _sb.from('quiz_soal').delete().eq('id_quiz', id_quiz).eq('id_soal', id_soal);
      if (error) _check(error, 'removeSoalFromKuis');
      return { status: 'ok' };
    } catch (e) {
      if (e.message && (e.message.indexOf('Load failed') !== -1 || e.message.indexOf('Failed to fetch') !== -1)) {
        throw new Error('Gagal menghapus soal dari kuis. Pastikan database patch_062_quiz_bugfix.sql sudah dijalankan di Supabase SQL Editor.');
      }
      throw e;
    }
  },

  getHasilKuis: async function(id_quiz) {
    var [quizRes, hasilRes, jawabanRes] = await Promise.all([
      _sb.from('quiz').select('*, quiz_soal(*, soal(*))').eq('id_quiz', id_quiz).single(),
      _sb.from('hasil_quiz').select('*, users!hasil_quiz_id_murid_fkey(nama_lengkap, no_hp)').eq('id_quiz', id_quiz).order('skor_total', { ascending: false }),
      _sb.from('jawaban_murid').select('*').eq('id_quiz', id_quiz)
    ]);
    _check(quizRes.error, 'getHasilKuis:quiz');
    _check(hasilRes.error, 'getHasilKuis:hasil');
    // MB9 fix (bug hunt 2026-08-27): jawabanRes.error dulu diabaikan -- dipakai
    // jadi summary.jawaban_detail (dasar "Soal Tersulit" & rincian jawaban),
    // gagal diam2 bikin bagian itu kosong tanpa toast error apa pun.
    _check(jawabanRes.error, 'getHasilKuis:jawaban');

    // PATCH 066/067: tampilkan konten soal beku (snapshot). quiz_soal(*) sudah
    // membawa kolom snap_*, jadi timpa embed soal-nya langsung.
    if (quizRes.data && Array.isArray(quizRes.data.quiz_soal)) {
      quizRes.data.quiz_soal.forEach(function (qs) { _overrideSoalFromSnap(qs.soal, qs); });
    }

    var hasil = hasilRes.data || [];
    var totalMengerjakan = hasil.length;
    var totalSkor = hasil.reduce(function(acc, h) { return acc + (h.skor_total || 0); }, 0);
    var avgSkor = totalMengerjakan > 0 ? Math.round(totalSkor / totalMengerjakan) : 0;

    var muridSudah = new Set(hasil.map(function(h) { return h.id_murid; }));
    var belumMengerjakan = [];

    try {
      var { data: qhData } = await _sb.from('quiz_halaqah').select('id_halaqah').eq('id_quiz', id_quiz);
      if (qhData && qhData.length > 0) {
        var halaqahIds = qhData.map(function(qh) { return qh.id_halaqah; });
        var { data: angData } = await _sb.from('anggota')
          .select('id_murid, nama_murid, id_halaqah, users!anggota_id_murid_fkey(nama_lengkap, no_hp)')
          .in('id_halaqah', halaqahIds)
          .eq('status', 'aktif');
        
        if (angData) {
          var seenMurid = new Set();
          angData.forEach(function(a) {
            if (!seenMurid.has(a.id_murid)) {
              seenMurid.add(a.id_murid);
              if (!muridSudah.has(a.id_murid)) {
                belumMengerjakan.push({
                  id_murid: a.id_murid,
                  nama_lengkap: a.nama_murid || (a.users && a.users.nama_lengkap) || 'Murid',
                  no_hp: a.users ? a.users.no_hp : null
                });
              }
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Quiz] Failed to fetch non-completers:', e);
    }

    return {
      status: 'ok',
      quiz: quizRes.data,
      summary: {
        total_mengerjakan: totalMengerjakan,
        rata_rata_skor: avgSkor,
        hasil_murid: hasil,
        jawaban_detail: jawabanRes.data || [],
        belum_mengerjakan: belumMengerjakan
      }
    };
  },

  getAntrianReviewIsian: async function(id_quiz) {
    var id_guru = _uid();
    var selectStr = '*, users!jawaban_murid_id_murid_fkey(nama_lengkap), soal(*, soal_kunci_isian(*))';
    var userRole = _currentUser && _currentUser.role;
    var isAdmin = userRole === 'admin' || userRole === 'superadmin';

    var q;
    if (isAdmin) {
      q = _sb.from('jawaban_murid')
        .select(selectStr)
        .eq('status_review', 'menunggu_review')
        .order('created_at', { ascending: true });
    } else {
      q = _sb.from('jawaban_murid')
        .select(selectStr + ', quiz!inner(id_guru)')
        .eq('status_review', 'menunggu_review')
        .eq('quiz.id_guru', id_guru)
        .order('created_at', { ascending: true });
    }

    if (id_quiz) q = q.eq('id_quiz', id_quiz);

    var { data, error } = await q;
    _check(error, 'getAntrianReviewIsian');

    // PATCH 066/067: tampilkan teks soal beku (snapshot) di antrian review.
    var rows = data || [];
    if (rows.length) {
      var quizIds = Array.from(new Set(rows.map(function (r) { return r.id_quiz; })));
      var snapRes = await _sb.from('quiz_soal').select(_SNAP_COLS).in('id_quiz', quizIds);
      var snapMap = {};
      (snapRes.data || []).forEach(function (r) { snapMap[r.id_quiz + '|' + r.id_soal] = r; });
      rows.forEach(function (r) { _overrideSoalFromSnap(r.soal, snapMap[r.id_quiz + '|' + r.id_soal]); });
    }
    return { status: 'ok', data: rows };
  },

  reviewIsianSingkat: async function(id_jawaban, disetujui, simpan_sebagai_varian) {
    var { error } = await _sb.rpc('review_isian_singkat', {
      p_id_jawaban: id_jawaban,
      p_disetujui: !!disetujui,
      p_simpan_sebagai_varian: !!simpan_sebagai_varian
    });
    _check(error, 'reviewIsianSingkat');
    return { status: 'ok' };
  },

  getMutabaahDaurahGuru: async function(id_periode) {
    id_periode = id_periode || 'P-DAURAH-JULI-2026';
    var id_guru = _uid();
    var [periodeRes, halaqahRes, asmtItemRes] = await Promise.all([
      _sb.from('periode').select('id_periode, nama_periode, tanggal_mulai, tanggal_selesai').eq('id_periode', id_periode).maybeSingle(),
      _sb.from('halaqah').select('id_halaqah, nama_halaqah, nama_guru, id_guru, level, status').eq('id_guru', id_guru).eq('level','Tahsin Al-Fatihah').eq('status','aktif'),
      _sb.from('assessment_items').select('id_item, nama_item:teks_latin, urutan, kategori').eq('level','Tahsin Al-Fatihah').eq('status','aktif').order('urutan'),
    ]);
    _check(periodeRes.error, 'getMutabaahDaurahGuru.periode');
    _check(halaqahRes.error, 'getMutabaahDaurahGuru.halaqah');
    _check(asmtItemRes.error, 'getMutabaahDaurahGuru.items');

    var periode = periodeRes.data || { id_periode: id_periode, nama_periode: 'Daurah Al-Fatihah', tanggal_mulai: '2026-07-11', tanggal_selesai: '2026-07-18' };
    var indikator = asmtItemRes.data || [];
    // .order('urutan') di query hanya urut GLOBAL — indikator hari berbeda bisa
    // bercampur (Hari 2 urutan 1 muncul sebelum Hari 1 urutan 7). Urutkan ulang
    // per Hari (angka di kategori) lalu urutan, sama seperti fix di konten-module.js.
    indikator.sort(function(a, b) {
      var hariA = parseInt((a.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      var hariB = parseInt((b.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      if (hariA !== hariB) return hariA - hariB;
      return (a.urutan || 0) - (b.urutan || 0);
    });
    var hqIds = (halaqahRes.data||[]).map(function(h){ return h.id_halaqah; });
    var itemIds = indikator.map(function(i){ return i.id_item; });

    // MB10 fix (bug hunt 2026-08-27): new Date() device-local -> _todayJakarta().
    // Bandingkan sbg epoch UTC-midnight (pola sama dgn _hariIni()), bukan Date
    // object device-local -- device guru non-WIB bisa geser hariKe/status 1 hari.
    var todayMs    = new Date(_todayJakarta() + 'T00:00:00Z').getTime();
    var mulaiMs    = new Date((periode.tanggal_mulai   || '').slice(0, 10) + 'T00:00:00Z').getTime();
    var selesaiMs  = new Date((periode.tanggal_selesai || '').slice(0, 10) + 'T00:00:00Z').getTime();
    var hariKe = todayMs < mulaiMs ? 0 : todayMs > selesaiMs ? 8 : Math.floor((todayMs - mulaiMs) / 86400000) + 1;
    var statusDaurah = todayMs < mulaiMs ? 'belum' : todayMs > selesaiMs ? 'selesai' : 'berlangsung';

    // Data besar diambil TERFILTER (halaqah milik guru + rentang tanggal periode)
    // dan berpaginasi via _selectAllPaged agar tidak terpotong batas 1000 baris PostgREST.
    var anggotaRows=[], kbmRows=[], nilaiRows=[], asmtRows=[];
    if (hqIds.length) {
      var big = await Promise.all([
        _selectAllPaged('anggota', 'id_murid, nama_murid, id_halaqah, users!anggota_id_murid_fkey(no_hp)',
          function(q){ return q.in('id_halaqah', hqIds).eq('status','aktif').order('id_murid').order('id_halaqah'); },
          'getMutabaahDaurahGuru.anggota'),
        _selectAllPaged('kbm_log', 'id_kbm, id_halaqah, tanggal_pertemuan, pertemuan_ke, status',
          function(q){ return q.in('id_halaqah', hqIds).eq('status','selesai')
            .gte('tanggal_pertemuan', periode.tanggal_mulai).lte('tanggal_pertemuan', periode.tanggal_selesai)
            .order('id_kbm'); },
          'getMutabaahDaurahGuru.kbm'),
        _selectAllPaged('nilai_kbm', 'id_nilai, id_murid, id_halaqah, id_kbm, status_hadir',
          function(q){ return q.in('id_halaqah', hqIds).order('id_nilai'); },
          'getMutabaahDaurahGuru.nilai'),
        itemIds.length
          ? _selectAllPaged('assessment_murid', 'id_murid, id_item, status_guru',
              function(q){ return q.in('id_item', itemIds).order('id_murid').order('id_item'); },
              'getMutabaahDaurahGuru.asmt')
          : Promise.resolve([]),
      ]);
      anggotaRows = big[0]; kbmRows = big[1]; nilaiRows = big[2]; asmtRows = big[3];
    }

    // Hanya nilai dari sesi KBM daurah (status selesai & dalam rentang periode)
    var kbmKeById = {};
    kbmRows.forEach(function(k){ kbmKeById[k.id_kbm] = k.pertemuan_ke || 0; });
    nilaiRows = nilaiRows.filter(function(n){ return Object.prototype.hasOwnProperty.call(kbmKeById, n.id_kbm); });

    var anggotaByHq={}, kbmByHq={}, nilaiByHqMurid={}, asmtByMuridItem={};
    anggotaRows.forEach(function(a){
      var aCopy = Object.assign({}, a, { no_hp: a.users && a.users.no_hp });
      delete aCopy.users;
      (anggotaByHq[a.id_halaqah]=anggotaByHq[a.id_halaqah]||[]).push(aCopy);
    });
    kbmRows.forEach(function(k){ (kbmByHq[k.id_halaqah]=kbmByHq[k.id_halaqah]||[]).push(k); });
    nilaiRows.forEach(function(n){
      var key=n.id_halaqah+'|'+n.id_murid;
      (nilaiByHqMurid[key]=nilaiByHqMurid[key]||[]).push(n);
    });
    asmtRows.forEach(function(s){ asmtByMuridItem[s.id_murid+'|'+s.id_item]=s.status_guru; });

    var halaqahList = (halaqahRes.data||[]).map(function(hq) {
      var muridList = (anggotaByHq[hq.id_halaqah]||[]);
      var sesiList  = (kbmByHq[hq.id_halaqah]||[]).sort(function(a,b){ return (a.pertemuan_ke||0)-(b.pertemuan_ke||0); });
      var sumHadir=0, sumTotal=0;
      var murid = muridList.map(function(m) {
        var nm = (nilaiByHqMurid[hq.id_halaqah+'|'+m.id_murid]||[]);
        var hadir = nm.filter(function(n){ return ['H','T'].includes(n.status_hadir); }).length;
        sumHadir+=hadir; sumTotal+=nm.length;
        var sesiStatus = {};
        nm.forEach(function(n){ var ke = kbmKeById[n.id_kbm]; if (ke) sesiStatus[ke] = n.status_hadir; });
        var tajwid = indikator.map(function(item){
          return { id_item:item.id_item, nama:item.nama_item, status:asmtByMuridItem[m.id_murid+'|'+item.id_item]||null };
        });
        var pahamCount=tajwid.filter(function(t){ return t.status==='paham'; }).length;
        return Object.assign({},m,{ hadir, sesiTotal:nm.length, pctHadir:nm.length>0?Math.round(hadir/nm.length*100):0, tajwid, pahamCount, sesiStatus });
      });
      var pctTajwidSum=0, pctTajwidCount=0;
      murid.forEach(function(m){ if(indikator.length>0){ pctTajwidSum+=m.pahamCount; pctTajwidCount+=indikator.length; } });
      return Object.assign({},hq,{
        murid, sesiList,
        sesiTerlaksana: sesiList.length,
        pctHadir: sumTotal>0?Math.round(sumHadir/sumTotal*100):0,
        pctTajwid: pctTajwidCount>0?Math.round(pctTajwidSum/pctTajwidCount*100):0,
      });
    });

    var totalPeserta=0, gSumHadir=0, gSumTotal=0, gSumPaham=0, gSumTajwid=0, totalSesi=0;
    halaqahList.forEach(function(h){
      totalPeserta+=h.murid.length; totalSesi+=h.sesiTerlaksana;
      h.murid.forEach(function(m){ gSumHadir+=m.hadir; gSumTotal+=m.sesiTotal; gSumPaham+=m.pahamCount; gSumTajwid+=indikator.length; });
    });

    var indikatorRanking = indikator.map(function(item){
      var paham=0,ragu=0,belum=0,total=0;
      halaqahList.forEach(function(h){ h.murid.forEach(function(m){
        var s=asmtByMuridItem[m.id_murid+'|'+item.id_item];
        if(s==='paham')paham++; else if(s==='ragu')ragu++; else if(s==='belum')belum++;
        if(s)total++;
      }); });
      return { id_item:item.id_item, nama:item.nama_item, paham,ragu,belum,total,
        pctPaham:total>0?Math.round(paham/total*100):null };
    }).sort(function(a,b){ return (a.pctPaham===null?-1:a.pctPaham)-(b.pctPaham===null?-1:b.pctPaham); });

    var muridAlert=[];
    halaqahList.forEach(function(h){ h.murid.forEach(function(m){
      var tajwidBelum=m.tajwid.filter(function(t){ return t.status==='belum'; }).length;
      var tajwidRagu =m.tajwid.filter(function(t){ return t.status==='ragu';  }).length;
      var lvl=(m.sesiTotal>0&&m.pctHadir<75)||tajwidBelum>=3?'kritis':((m.sesiTotal>0&&m.pctHadir<85)||tajwidRagu>=3)?'perhatian':null;
      if(lvl) muridAlert.push(Object.assign({},m,{
        nama_halaqah:h.nama_halaqah, nama_guru:h.nama_guru,
        tajwidBelum, tajwidRagu,
        indikatorLemah:m.tajwid.filter(function(t){ return t.status==='belum'||t.status==='ragu'; }).map(function(t){ return t.nama; }),
        level:lvl
      }));
    }); });
    muridAlert.sort(function(a,b){ return (a.level==='kritis'?0:1)-(b.level==='kritis'?0:1); });

    return { status:'ok', data:{
      periode, hariKe, statusDaurah,
      summary:{ totalPeserta, hariKe, totalSesi, avgHadir:gSumTotal>0?Math.round(gSumHadir/gSumTotal*100):0, avgTajwid:gSumTajwid>0?Math.round(gSumPaham/gSumTajwid*100):0 },
      halaqahList, indikatorRanking, indikator, muridAlert
    }};
  },

  // ============================================================
  //  PENGEMBANGAN PENGAJAR (patch_082) — profil diri, input Musyrif, Halaqah Peer.
  //  RLS memfilter data di DB (own / is_pembina() / anggota kelompok).
  // ============================================================

  // Indikator evaluasi aktif (render form nilai). Dibaca semua yg login (RLS).
  getIndikatorEvaluasi: async function() {
    var { data, error } = await _sb.from('pengajar_indikator')
      .select('*').eq('status', 'aktif').order('urutan', { ascending: true });
    _check(error, 'getIndikatorEvaluasi');
    return { status: 'ok', data: data || [] };
  },

  // Profil pengembangan diri pengajar yang login (RLS: hanya barisnya sendiri).
  getProfilPengajarSaya: async function() {
    var id = _uid();
    var [komp, tashih, evalr, riwayat, mutabaah] = await Promise.all([
      _sb.from('pengajar_kompetensi').select('*').eq('id_guru', id).maybeSingle(),
      _sb.from('pengajar_tashih').select('*').eq('id_guru', id).order('tanggal', { ascending: false }),
      _sb.from('pengajar_evaluasi').select('*').eq('id_guru', id).order('tanggal', { ascending: false }),
      _sb.from('pengajar_jenjang_riwayat').select('*').eq('id_guru', id).order('tanggal', { ascending: false }),
      _sb.from('pengajar_mutabaah').select('*').eq('id_guru', id).order('created_at', { ascending: false }),
    ]);
    _check(komp.error, 'getProfilPengajarSaya');
    return { status: 'ok', data: {
      kompetensi: komp.data || null, tashih: tashih.data || [], evaluasi: evalr.data || [],
      riwayat_jenjang: riwayat.data || [], mutabaah: mutabaah.data || [],
    }};
  },

  // ── MUSYRIF: input pembinaan (RLS is_pembina() menolak guru biasa) ──

  // Tashih bacaan. id_penguji dipatok = pemanggil. Auto-buka mutaba'ah bila 'mengulang'.
  simpanTashihPengajar: async function(d) {
    d = d || {};
    if (!d.id_guru) return { status: 'error', message: 'id_guru wajib diisi' };
    var { data, error } = await _sb.from('pengajar_tashih').insert({
      id_guru: d.id_guru, id_penguji: _uid(), tanggal: d.tanggal || undefined,
      surat_diuji: d.surat_diuji || null, skor: d.skor || {}, hasil: d.hasil || null,
      catatan: d.catatan || null,
    }).select().single();
    _check(error, 'simpanTashihPengajar');
    var followupWarning = null;
    if (d.hasil === 'mengulang') {
      // H7 fix (bug hunt 2026-08-18): dulu error insert follow-up ini tak dicek --
      // kalau gagal, catatan tindak lanjut pastoral yang wajib bisa hilang diam-diam
      // padahal tashih di atas sudah tersimpan. Sekarang errornya dikembalikan sbg
      // warning (bukan dilempar) supaya tashih yg sudah tersimpan tidak dianggap gagal
      // total, tapi UI tetap bisa memberi tahu guru penguji utk membuat mutaba'ah manual.
      var { error: mtbErr } = await _sb.from('pengajar_mutabaah').insert({
        id_guru: d.id_guru, id_pendamping: _uid(),
        temuan: 'Lanjut berproses pada tashih' + (d.surat_diuji ? ' (' + d.surat_diuji + ')' : ''),
        rencana: d.catatan || null, sumber: 'tashih',
      });
      if (mtbErr) followupWarning = 'Tashih tersimpan, tapi catatan tindak lanjut mutaba\'ah GAGAL dibuat otomatis (' + mtbErr.message + '). Silakan buat manual.';
    }
    return { status: 'ok', data: data, warning: followupWarning };
  },

  // Evaluasi berbobot. id_penilai = pemanggil. nilai_akhir = Σ (skor/5*100 × bobot/100).
  simpanEvaluasiPengajar: async function(d) {
    d = d || {};
    if (!d.id_guru) return { status: 'error', message: 'id_guru wajib diisi' };
    var skor = d.skor || {};   // { id_indikator: nilai 1-5 }
    var { data: inds, error: indErr } = await _sb.from('pengajar_indikator')
      .select('id_indikator, bobot').eq('status', 'aktif');
    _check(indErr, 'simpanEvaluasiPengajar:indikator');
    var nilaiAkhir = 0;
    (inds || []).forEach(function(it) {
      var s = Number(skor[it.id_indikator]);
      if (s > 0) nilaiAkhir += (s / 5 * 100) * (Number(it.bobot || 0) / 100);
    });
    nilaiAkhir = Math.round(nilaiAkhir * 100) / 100;
    var { data, error } = await _sb.from('pengajar_evaluasi').insert({
      id_guru: d.id_guru, id_penilai: _uid(), id_periode: d.id_periode || null,
      tanggal: d.tanggal || undefined, skor: skor, nilai_akhir: nilaiAkhir, catatan: d.catatan || null,
    }).select().single();
    _check(error, 'simpanEvaluasiPengajar');
    return { status: 'ok', data: data };
  },

  // Buka/ubah tindak lanjut. Tanpa id_mutabaah = insert; dengan = update.
  upsertMutabaahPengajar: async function(d) {
    d = d || {};
    if (d.id_mutabaah) {
      var upd = {};
      ['temuan','rencana','target_waktu','status','sumber'].forEach(function(k){ if (d[k] !== undefined) upd[k] = d[k]; });
      upd.updated_at = new Date().toISOString();
      var { data: u, error: ue } = await _sb.from('pengajar_mutabaah').update(upd)
        .eq('id_mutabaah', d.id_mutabaah).select().single();
      _check(ue, 'upsertMutabaahPengajar:update');
      return { status: 'ok', data: u };
    }
    if (!d.id_guru || !d.temuan) return { status: 'error', message: 'id_guru & temuan wajib diisi' };
    var { data, error } = await _sb.from('pengajar_mutabaah').insert({
      id_guru: d.id_guru, id_pendamping: _uid(), temuan: d.temuan, rencana: d.rencana || null,
      target_waktu: d.target_waktu || null, status: d.status || 'terbuka', sumber: d.sumber || 'manual',
    }).select().single();
    _check(error, 'upsertMutabaahPengajar:insert');
    return { status: 'ok', data: data };
  },

  // Daftar pengajar binaan (musyrif). Lewat RPC get_pengajar_binaan (SECURITY DEFINER):
  // users RLS ketat (patch_018) menutup .from('users') antar-guru — RPC hanya buka kolom
  // non-sensitif & hanya untuk pembina (else 0 baris).
  getBinaanSaya: async function() {
    var { data, error } = await _sb.rpc('get_pengajar_binaan');
    _check(error, 'getBinaanSaya');
    return { status: 'ok', data: (data || [])
      .sort(function(a, b){ return (a.nama_lengkap || '').localeCompare(b.nama_lengkap || ''); })
      .map(function(u){
        return { id_user: u.id_user, nama_lengkap: u.nama_lengkap,
          kompetensi: { jenjang: u.jenjang, status_sertifikasi: u.status_sertifikasi } };
      })};
  },

  // ── PEER (Halaqah Pengajar) ──

  // Kelompok tempat pemanggil terdaftar + anggotanya (calon penyimak).
  getKelompokPengajarku: async function() {
    var id = _uid();
    var { data: myMemb, error: mErr } = await _sb.from('anggota_kelompok_pengajar')
      .select('id_kelompok').eq('id_guru', id);
    _check(mErr, 'getKelompokPengajarku:membership');
    var ids = (myMemb || []).map(function(m){ return m.id_kelompok; });
    if (!ids.length) return { status: 'ok', data: [] };
    var [kel, ang] = await Promise.all([
      _sb.from('kelompok_pengajar').select('*').in('id_kelompok', ids),
      _sb.from('anggota_kelompok_pengajar').select('*').in('id_kelompok', ids),
    ]);
    // L6 fix (bug hunt 2026-08-18): dulu hanya kel.error dicek, ang.error diabaikan --
    // kalau query kedua gagal, anggota kelompok yg tampil jadi kosong tanpa diketahui.
    _check(kel.error, 'getKelompokPengajarku:kelompok');
    _check(ang.error, 'getKelompokPengajarku:anggota');
    var byKel = {};
    (ang.data || []).forEach(function(a){ (byKel[a.id_kelompok] || (byKel[a.id_kelompok] = [])).push(a); });
    return { status: 'ok', data: (kel.data || []).map(function(k){
      return Object.assign({}, k, { anggota: byKel[k.id_kelompok] || [] });
    })};
  },

  // Setor ke rekan. id_penyetor dipatok = pemanggil (anti-spoof). RLS validasi kelompok & penyimak.
  simpanSetoranPeer: async function(d) {
    d = d || {};
    if (!d.id_kelompok || !d.id_penyimak) return { status: 'error', message: 'id_kelompok & id_penyimak wajib diisi' };
    if (d.id_penyimak === _uid()) return { status: 'error', message: 'Penyimak tidak boleh diri sendiri' };
    // Terima audio_url hanya bila https (tolak skema berbahaya spt javascript:/data:).
    var audioUrl = (d.audio_url && /^https:\/\//i.test(String(d.audio_url))) ? String(d.audio_url) : null;
    var durasi = parseInt(d.audio_durasi_detik, 10);
    var { data, error } = await _sb.from('pengajar_setoran').insert({
      id_kelompok: d.id_kelompok, id_penyetor: _uid(), id_penyimak: d.id_penyimak,
      nama_penyetor: d.nama_penyetor || null, nama_penyimak: d.nama_penyimak || null,
      kategori: d.kategori || 'makhraj', sub_materi: d.sub_materi || null,
      dalil: d.dalil || null, catatan: d.catatan || null, tanggal: d.tanggal || undefined,
      audio_url: audioUrl,
      audio_durasi_detik: (audioUrl && Number.isFinite(durasi) && durasi >= 0) ? durasi : null,
      audio_tipe: audioUrl ? (d.audio_tipe || null) : null,
    }).select().single();
    _check(error, 'simpanSetoranPeer');
    return { status: 'ok', data: data };
  },

  // Penyimak memberi nilai/kelancaran/catatan (RLS: hanya penyimak baris itu / admin).
  nilaiSetoranPeer: async function(d) {
    d = d || {};
    if (!d.id_setoran) return { status: 'error', message: 'id_setoran wajib diisi' };
    var upd = {};
    ['nilai','kelancaran','catatan'].forEach(function(k){ if (d[k] !== undefined) upd[k] = d[k]; });
    if (!Object.keys(upd).length) return { status: 'error', message: 'Tidak ada nilai/catatan untuk disimpan' };
    var { data, error } = await _sb.from('pengajar_setoran').update(upd)
      .eq('id_setoran', d.id_setoran).select().single();
    _check(error, 'nilaiSetoranPeer');
    if (!data) throw new Error('Gagal menyimak (0 baris — mungkin bukan penyimak setoran ini).');
    return { status: 'ok', data: data };
  },

  // Riwayat setoran satu kelompok (opsional filter kategori). RLS: hanya anggota kelompok.
  getSetoranKelompok: async function(id_kelompok, filter) {
    if (!id_kelompok) return { status: 'error', message: 'id_kelompok wajib diisi' };
    var q = _sb.from('pengajar_setoran').select('*').eq('id_kelompok', id_kelompok)
      .order('tanggal', { ascending: false });
    if (filter && filter.kategori) q = q.eq('kategori', filter.kategori);
    var { data, error } = await q;
    _check(error, 'getSetoranKelompok');
    return { status: 'ok', data: data || [] };
  },

  // Rekap peer pribadi: jumlah setoran keluar/masuk & kategori dominan (apresiatif).
  getRekapPeerSaya: async function() {
    var id = _uid();
    var [keluar, masuk] = await Promise.all([
      _sb.from('pengajar_setoran').select('kategori').eq('id_penyetor', id),
      _sb.from('pengajar_setoran').select('kategori').eq('id_penyimak', id),
    ]);
    // L6 fix (bug hunt 2026-08-18): dulu hanya keluar.error dicek, masuk.error
    // diabaikan -- total_simak bisa salah (0) tanpa error yg terlihat.
    _check(keluar.error, 'getRekapPeerSaya:keluar');
    _check(masuk.error, 'getRekapPeerSaya:masuk');
    var katCount = {};
    (keluar.data || []).forEach(function(s){ katCount[s.kategori] = (katCount[s.kategori] || 0) + 1; });
    var dominan = Object.keys(katCount).sort(function(a,b){ return katCount[b]-katCount[a]; })[0] || null;
    return { status: 'ok', data: {
      total_setor: (keluar.data || []).length, total_simak: (masuk.data || []).length,
      kategori_dominan: dominan,
    }};
  },

  // Target/milestone bersama. tipe: 'target'(default) | 'milestone'. Dengan id = update.
  upsertTargetKelompok: async function(d) {
    d = d || {};
    var tbl   = d.tipe === 'milestone' ? 'milestone_kelompok_pengajar' : 'target_kelompok_pengajar';
    var idCol = tbl === 'milestone_kelompok_pengajar' ? 'id_milestone' : 'id_target';
    if (d[idCol]) {
      var upd = {};
      if (d.judul !== undefined) upd.judul = d.judul;
      if (tbl === 'target_kelompok_pengajar' && d.status !== undefined) upd.status = d.status;
      var { data: u, error: ue } = await _sb.from(tbl).update(upd).eq(idCol, d[idCol]).select().single();
      _check(ue, 'upsertTargetKelompok:update');
      return { status: 'ok', data: u };
    }
    if (!d.id_kelompok || !d.judul) return { status: 'error', message: 'id_kelompok & judul wajib diisi' };
    var row = { id_kelompok: d.id_kelompok, judul: d.judul, dibuat_oleh: _uid() };
    if (tbl === 'target_kelompok_pengajar') {
      if (d.tanggal_target) row.tanggal_target = d.tanggal_target;
      if (d.status) row.status = d.status;
    } else if (d.tanggal) row.tanggal = d.tanggal;
    var { data, error } = await _sb.from(tbl).insert(row).select().single();
    _check(error, 'upsertTargetKelompok:insert');
    return { status: 'ok', data: data };
  },

  // Target + milestone satu kelompok (RLS: anggota kelompok / admin).
  getTargetMilestoneKelompok: async function(id_kelompok) {
    if (!id_kelompok) return { status: 'error', message: 'id_kelompok wajib diisi' };
    var [tgt, mst] = await Promise.all([
      _sb.from('target_kelompok_pengajar').select('*').eq('id_kelompok', id_kelompok).order('created_at', { ascending: false }),
      _sb.from('milestone_kelompok_pengajar').select('*').eq('id_kelompok', id_kelompok).order('tanggal', { ascending: false }),
    ]);
    // L6 fix (bug hunt 2026-08-18): dulu hanya tgt.error dicek, mst.error diabaikan --
    // daftar milestone bisa kosong diam-diam kalau query itu yg gagal.
    _check(tgt.error, 'getTargetMilestoneKelompok:target');
    _check(mst.error, 'getTargetMilestoneKelompok:milestone');
    return { status: 'ok', data: { target: tgt.data || [], milestone: mst.data || [] } };
  },

  // Hapus target/milestone. tipe: 'target'(default) | 'milestone'.
  hapusTargetKelompok: async function(d) {
    d = d || {};
    var tbl   = d.tipe === 'milestone' ? 'milestone_kelompok_pengajar' : 'target_kelompok_pengajar';
    var idCol = tbl === 'milestone_kelompok_pengajar' ? 'id_milestone' : 'id_target';
    if (!d[idCol]) return { status: 'error', message: idCol + ' wajib diisi' };
    var { error } = await _sb.from(tbl).delete().eq(idCol, d[idCol]);
    _check(error, 'hapusTargetKelompok');
    return { status: 'ok' };
  },
};


// ─────────────────────────────────────────────
//  KALKULASI RAPORT (helper internal)
// ─────────────────────────────────────────────
// BUG-021 fix: gradeConfig parameter opsional untuk backward compat
function _kalkulasiRaport(idMurid, idPeriode, idHalaqah, komponen, nilaiManual, nilaiKBM, atLog, totalAt, gradeConfig, studentLevel, periodeRange, asmtItems, asmtMurid) {
  var lvl = (studentLevel || '').trim();
  // BUG-021: threshold dari gradeConfig (dari DB), fallback ke default jika tidak ada
  var G = gradeConfig || {};
  var GRADE_MUMTAZ       = G.mumtaz       || 90;
  var GRADE_JAYYID_JIDDAN= G.jayyidJiddan || 80;
  var GRADE_JAYYID       = G.jayyid       || 70;
  var BONUS_PERFECT      = G.bonusPerfect != null ? G.bonusPerfect : 5;

  if (lvl === 'Tahsin Al-Fatihah') {
    // 1. Ambil data jawaban murid untuk 7 indikator
    var myAnswers = (asmtMurid || []).filter(function(a) { return a.id_murid === idMurid; });
    
    // 2. Komposisi nilai raport daurah: indikator tajwid 60% (dibagi RATA antar indikator)
    // + KBM 40% (Kehadiran 30% + Adab&Kamera 10%). Bobot indikator DINAMIS = 60 / jumlah
    // indikator aktif, agar porsi 60% tetap terjaga berapa pun jumlah indikator (dulu
    // hardcoded 11.4% -> menggeser komposisi drastis saat jumlah indikator > 7).
    var _totalIndikator = (asmtItems || []).length;
    var _bobotIndikator = _totalIndikator > 0 ? Math.round((60 / _totalIndikator) * 100) / 100 : 0;
    var listKomp = [];
    (asmtItems || []).forEach(function(item) {
      var ans = myAnswers.find(function(a) { return a.id_item === item.id_item; });
      var statusGuru = ans ? ans.status_guru : null;
      // Indikator yang BELUM diverifikasi guru (status_guru null / tak ada baris) di-exclude
      // (tak menyumbang bobot), bukan default 50 — selaras kebijakan "hanya nilai komponen
      // yang ada datanya". Verdict 'belum' (50) TETAP dihitung: itu penilaian guru yang sah.
      if (statusGuru == null) return;
      var score = statusGuru === 'paham' ? 100 : statusGuru === 'ragu' ? 70 : 50;
      listKomp.push({
        id_komponen: item.id_item,
        urutan: item.urutan,
        kategori: item.kategori,
        nama_komponen: item.teks_latin,
        teks_arab: item.teks_arab,
        keterangan: item.keterangan,
        bobot: _bobotIndikator,
        bobot_original: _bobotIndikator,
        nilai: score,
        nilai_bobot: Math.round((score * _bobotIndikator) / 100 * 10) / 10,
        tipe: 'daurah_indikator',
        status_guru: statusGuru
      });
    });

    // 3. Tambahkan komponen KBM Daurah (Kehadiran & Kamera)
    var myKBM = (nilaiKBM || []).filter(function(n) {
      if (n.id_murid !== idMurid) return false;
      if (n.kbm_log && n.kbm_log.status === 'draft') return false;
      if (periodeRange) {
        var tgl = n.tanggal || (n.kbm_log && n.kbm_log.tanggal_pertemuan);
        if (!tgl || tgl < periodeRange.mulai || tgl > periodeRange.selesai) return false;
      }
      return true;
    });

    // A. Kehadiran KBM (Bobot: 30%) — hanya dihitung bila ada data KBM di periode ini.
    // Tanpa sesi KBM sama sekali, kehadiran tidak dinilai (di-exclude), selaras cabang Reguler.
    // Sebelumnya default 100 → murid tanpa data KBM ikut terangkat & membuat guard
    // "Belum Ada Data" (listKomp.length===0) mustahil tercapai.
    if (myKBM.length > 0) {
      var skorHadir = myKBM.reduce(function(s,n) {
        var kd = String(n.status_hadir||'').toUpperCase();
        return s + (kd === 'H' ? 1 : kd === 'T' ? 0.7 : kd === 'I' ? 0.5 : 0);
      }, 0);
      var nilaiHadir = Math.round(skorHadir / myKBM.length * 100);

      listKomp.push({
        id_komponen: 'daurah-kehadiran-kbm',
        nama_komponen: 'Kehadiran KBM',
        bobot: 30,
        bobot_original: 30,
        nilai: nilaiHadir,
        nilai_bobot: Math.round((nilaiHadir * 30) / 100 * 10) / 10,
        tipe: 'daurah_kbm',
        keterangan: 'Kedisiplinan kehadiran di ruang Zoom'
      });
    }

    // B. Partisipasi & Kamera KBM (Bobot: 10%) — hanya dihitung bila ada sesi hadir (H/T).
    // Murid absen total tidak dinilai adab/kamera: komponen di-exclude (tak menyumbang bobot),
    // selaras perilaku cabang Reguler. Sebelumnya default 100 → menaikkan nilai murid absen.
    var hadir = myKBM.filter(function(n) { return ['H','T'].includes(String(n.status_hadir||'').toUpperCase()); });
    if (hadir.length > 0) {
      var ts = 0;
      hadir.forEach(function(n) {
        var km = n.kamera_murid === 'kamera terbuka' ? 100 : n.kamera_murid === 'kamera tertutup' || n.kamera_murid === 'kamera selalu tertutup' ? 0 : 50;
        var a = n.adab === 'Baik' ? 100 : 50;
        ts += Math.round((a * 70 + km * 30) / 100);
      });
      var nilaiKamera = Math.round(ts / hadir.length);

      listKomp.push({
        id_komponen: 'daurah-partisipasi-kbm',
        nama_komponen: 'Adab & Kamera KBM',
        bobot: 10,
        bobot_original: 10,
        nilai: nilaiKamera,
        nilai_bobot: Math.round((nilaiKamera * 10) / 100 * 10) / 10,
        tipe: 'daurah_kbm',
        keterangan: 'Kesesuaian adab dan kesiapan kamera selama KBM'
      });
    }

    // 4. Hitung Nilai Akhir
    var rawSum = listKomp.reduce(function(sum, k) { return sum + (k.nilai * k.bobot); }, 0);
    var totalWeight = listKomp.reduce(function(sum, k) { return sum + k.bobot; }, 0);
    var nilaiAkhir = totalWeight > 0 ? Math.round(rawSum / totalWeight) : 0;

    // Kelulusan daurah menuntut SEMUA indikator tajwid terkonfigurasi (asmtItems aktif)
    // sudah diverifikasi guru. Bila belum lengkap → predikat 'Belum Lengkap' (bukan grade
    // final) agar sertifikat LULUS tak terbit tanpa bukti penilaian tajwid.
    var totalIndikator   = (asmtItems || []).length;
    var indikatorDinilai = listKomp.filter(function(k){ return k.tipe === 'daurah_indikator'; }).length;
    var indikatorLengkap = totalIndikator > 0 && indikatorDinilai >= totalIndikator;

    var predikat = listKomp.length === 0 ? 'Belum Ada Data'
      : !indikatorLengkap                 ? 'Belum Lengkap'
      : nilaiAkhir >= GRADE_MUMTAZ        ? 'Mumtaz'
      : nilaiAkhir >= GRADE_JAYYID_JIDDAN ? 'Jayyid Jiddan'
      : nilaiAkhir >= GRADE_JAYYID        ? 'Jayyid'
      : 'Maqbul';

    return { nilai_akhir: nilaiAkhir, predikat, komponen: listKomp };
  }

  // Fase 1.5: hanya hitung baris dari sesi yang BUKAN draft (predikat <> 'draft' agar
  // tahan data legacy ber-status NULL). Sesi draft yang belum diselesaikan tidak boleh
  // mencemari raport (lihat RENCANA_persistensi_nilai_kbm.md §6).
  var myKBM = (nilaiKBM || []).filter(function(n) {
    if (n.id_murid !== idMurid) return false;
    if (n.kbm_log && n.kbm_log.status === 'draft') return false;   // Fase 1.5: buang sesi draft
    if (periodeRange) {                                            // #2: batasi ke rentang periode
      var tgl = n.tanggal || (n.kbm_log && n.kbm_log.tanggal_pertemuan);
      if (!tgl || tgl < periodeRange.mulai || tgl > periodeRange.selesai) return false;
    }
    return true;
  });
  var myManual = (nilaiManual || []).filter(function(n) { return n.id_murid === idMurid; });
  var myAt = (atLog || []).filter(function(n) { return n.id_murid === idMurid; });

  // Filter out Micro Teaching sessions from regular calculations
  var myRegulerKBM = myKBM.filter(function(n) {
    var jenis = n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler';
    return jenis !== 'Micro Teaching';
  });

  // BUG-021: threshold dari gradeConfig (dari DB), fallback ke default jika tidak ada
  var G = gradeConfig || {};
  var GRADE_MUMTAZ       = G.mumtaz       || 90;
  var GRADE_JAYYID_JIDDAN= G.jayyidJiddan || 80;
  var GRADE_JAYYID       = G.jayyid       || 70;
  var BONUS_PERFECT      = G.bonusPerfect != null ? G.bonusPerfect : 5;

  var ADAB_W = 70, KAM_W = 30;

  var nilaiKomp = (komponen || []).map(function(k) {
    var v = 0, nama = (k.nama_komponen || '').toLowerCase();
    var isExcluded = false;

    if (k.tipe === 'manual') {
      var nm = myManual.find(function(n) { return n.id_komponen === k.id_komponen; });
      if (nm && nm.nilai !== null && nm.nilai !== '') {
        v = Number(nm.nilai) || 0;
      } else {
        isExcluded = true;
      }
    } else {
      var matched = false;
      var hadir = myRegulerKBM.filter(function(n) { return ['H','T'].includes(String(n.status_hadir||'').toUpperCase()); });
      if (nama.includes('kehadiran') && !nama.includes('tibyan')) {
        matched = true;
        // Kehadiran counts MT sessions to reward observer presence (uses myKBM instead of myRegulerKBM)
        var skor = myKBM.reduce(function(s,n) { var kd=String(n.status_hadir||'').toUpperCase(); return s+(kd==='H'?1:kd==='T'?0.7:kd==='I'?0.5:0); }, 0);
        v = myKBM.length > 0 ? Math.round(skor/myKBM.length*100) : 0;
        if (myKBM.length === 0) isExcluded = true;
      } else if (nama.includes('kbm') || nama.includes('harian')) {
        matched = true;
        if (lvl === 'Micro Teaching') {
          isExcluded = true;
        } else {
          var ts = 0;
          hadir.forEach(function(n) {
            var jenis = n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler';
            var km = n.kamera_murid === 'kamera terbuka' ? 100 : n.kamera_murid === 'kamera tertutup' || n.kamera_murid === 'kamera selalu tertutup' ? 0 : 50;
            if (jenis === 'KBM Qiyam') {
              // Qiyam uses camera scores instead of adab (since Qiyam doesn't input adab)
              ts += km;
            } else {
              var a = n.adab === 'Baik' ? 100 : 50;
              ts += Math.round((a * ADAB_W + km * KAM_W) / 100);
            }
          });
          v = hadir.length > 0 ? Math.round(ts / hadir.length) : 0;
          if (hadir.length === 0) isExcluded = true;
        }
      } else if (nama.includes('adab')) {
        matched = true;
        if (lvl === 'Level Qiyam' || lvl === 'Micro Teaching') {
          isExcluded = true;
        } else {
          var vAdab = hadir.filter(function(n){return n.adab;});
          v = vAdab.length > 0 ? Math.round(vAdab.filter(function(n){return n.adab==='Baik';}).length/vAdab.length*100) : 0;
          if (vAdab.length === 0) isExcluded = true;
        }
      } else if (nama.includes('tibyan') || nama.includes('at-tibyan')) {
        matched = true;
        var hadirAt = myAt.filter(function(n){return ['H','T'].includes(String(n.status_hadir||'').toUpperCase());}).length;
        v = totalAt > 0 ? Math.round(hadirAt/totalAt*100) : 0;
        if (totalAt === 0) isExcluded = true;
      } else if (nama.includes('micro') || nama.includes('micro teaching')) {
        matched = true;
        var mtRows = myKBM.filter(function(n) {
          var jenis = n.jenis_sesi || (n.kbm_log && n.kbm_log.jenis_sesi) || 'KBM Reguler';
          return jenis === 'Micro Teaching' && n.nilai != null && n.nilai !== '';
        });
        var mtSum = mtRows.reduce(function(s, n) { return s + (Number(n.nilai) || 0); }, 0);
        v = mtRows.length > 0 ? Math.round(mtSum / mtRows.length) : 0;
        if (mtRows.length === 0) isExcluded = true;
      }
      // C2 fix (bug hunt 2026-08-18): nama komponen "Otomatis" yang tak cocok satu pun
      // kata kunci di atas dulu diam-diam ikut dihitung sbg skor 0 (bukan dikecualikan) --
      // admin yang menamai komponen dgn sinonim ("UTS"/"Presensi") menjatuhkan nilai_akhir
      // SEMUA murid di periode itu tanpa disadari. Sekarang dikecualikan, sama seperti
      // komponen manual yang belum diisi.
      if (!matched) isExcluded = true;
    }
    return { id_komponen: k.id_komponen, nama_komponen: k.nama_komponen, bobot: Number(k.bobot), nilai: v, isExcluded: isExcluded, tipe: k.tipe };
  });

  // Separate active and excluded components
  var activeKomp = nilaiKomp.filter(function(k) { return !k.isExcluded; });
  var totalActiveWeight = activeKomp.reduce(function(sum, k) { return sum + k.bobot; }, 0);

  var nilaiAkhir = 0;
  if (totalActiveWeight > 0) {
    var rawSum = activeKomp.reduce(function(s, k) {
      return s + (k.nilai * k.bobot);
    }, 0);
    nilaiAkhir = Math.round(rawSum / totalActiveWeight);
    
    // Rescale active weights to sum up to exactly 100%
    var bobotUsedSum = 0;
    activeKomp.forEach(function(k) {
      k.bobot_original = k.bobot;
      var preciseBobot = (k.bobot_original / totalActiveWeight) * 100;
      k.bobot = Math.round(preciseBobot * 10) / 10;
      bobotUsedSum += k.bobot;
      
      var preciseNilaiBobot = (k.nilai * preciseBobot) / 100;
      k.nilai_bobot = Math.round(preciseNilaiBobot * 10) / 10;
    });
    
    // Adjust rounding error for bobot to ensure sum is exactly 100%
    var bobotDiff = 100 - bobotUsedSum;
    if (Math.abs(bobotDiff) > 0.01 && activeKomp.length > 0) {
      activeKomp[0].bobot = Math.round((activeKomp[0].bobot + bobotDiff) * 10) / 10;
    }
  }

  // Clean up properties for the final JSON array
  var detailJson = activeKomp.map(function(k) {
    return {
      id_komponen: k.id_komponen,
      nama_komponen: k.nama_komponen,
      bobot: k.bobot,
      bobot_original: k.bobot_original || k.bobot,
      nilai: k.nilai,
      nilai_bobot: k.nilai_bobot,
      tipe: k.tipe
    };
  });

  // Apply perfect attendance bonus using all KBM sessions (myKBM)
  var alpa = myKBM.filter(function(n){return String(n.status_hadir||'').toUpperCase()==='A';}).length;
  // H3 fix (bug hunt 2026-08-18): dulu bonus & predikat pakai myKBM.length sbg sinyal
  // "ada data" -- murid hadir sempurna tapi TANPA komponen akademik ber-data
  // (totalActiveWeight=0, mis. periode itu belum punya komponen "kehadiran" yg
  // cocok) bisa dapat nilai_akhir=5/predikat 'Maqbul' (nilai palsu) padahal
  // seharusnya 'Belum Ada Data'. Sinyal yg benar: apakah ADA komponen aktif
  // ber-bobot yg benar2 dihitung ke nilai_akhir (totalActiveWeight), sama seperti
  // pola yg sudah dipakai di cabang Daurah (listKomp.length === 0).
  if (totalActiveWeight > 0 && myKBM.length > 0 && alpa === 0) nilaiAkhir = Math.min(100, nilaiAkhir + BONUS_PERFECT);

  var predikat = totalActiveWeight === 0 ? 'Belum Ada Data'
    : nilaiAkhir >= GRADE_MUMTAZ        ? 'Mumtaz'
    : nilaiAkhir >= GRADE_JAYYID_JIDDAN ? 'Jayyid Jiddan'
    : nilaiAkhir >= GRADE_JAYYID        ? 'Jayyid'
    : 'Maqbul';

  return { nilai_akhir: nilaiAkhir, predikat, komponen: detailJson };
}


// ═════════════════════════════════════════════════════════════
//  KEUANGAN — sumber kebenaran TUNGGAL untuk angka rekap uang
//  (dipakai getSPPRekap & getArusKas supaya tak ada 2 "Total Masuk"
//   / 2 "Saldo" yang berbeda di halaman yang sama).
// ═════════════════════════════════════════════════════════════
var _BULAN_KEU = ['Januari','Februari','Maret','April','Mei','Juni','Juli',
                  'Agustus','September','Oktober','November','Desember'];

// Bulan (nama Indo) dari baris pembayaran: pakai tanggal_bayar, fallback created_at.
// Dipakai khusus Infaq/Operasional yang kolom `bulan`-nya selalu '-' (patch_052).
function _bulanDariTanggal(row) {
  var d = row && (row.tanggal_bayar || (row.created_at ? String(row.created_at).slice(0, 10) : null));
  if (!d) return null;
  var m = parseInt(String(d).slice(5, 7), 10);
  return (m >= 1 && m <= 12) ? _BULAN_KEU[m - 1] : null;
}

// Hitung pemasukan/pengeluaran/saldo dari array yang SUDAH difilter pemanggil
// (tahun + status='lunas' untuk sppRows; rentang tanggal untuk kasRows/opRows).
//   opts.bulanRange : array nama bulan  → batasi ke rentang itu (null = semua).
//     · SPP Pribadi & Ihsan Guru : kolom `bulan` = nama bulan asli.
//     · Infaq/Operasional        : via _bulanDariTanggal (kolom bulan = '-').
function _hitungKeuangan(sppRows, kasRows, opRows, opts) {
  opts = opts || {};
  var range = opts.bulanRange || null;
  var inRange = function(b) { return !range || (b && range.indexOf(b) >= 0); };
  var spp = 0, infaq = 0, ihsan = 0;
  (sppRows || []).forEach(function(r) {
    if (r.status && r.status !== 'lunas') return;
    var n = Number(r.nominal || 0);
    var j = r.jenis || 'SPP Pribadi';
    if (j === 'Infaq/Operasional') {
      if (!range || inRange(_bulanDariTanggal(r))) infaq += n;
    } else if (j === 'Ihsan Guru') {
      if (inRange(r.bulan)) ihsan += n;
    } else { // SPP Pribadi (atau jenis kosong = lama)
      if (inRange(r.bulan)) spp += n;
    }
  });
  var kasMasuk = 0, kasKeluar = 0;
  (kasRows || []).forEach(function(k) {
    var n = Number(k.nominal || 0);
    if (k.arah === 'masuk') kasMasuk += n; else kasKeluar += n;
  });
  var operasional = (opRows || []).reduce(function(s, o) { return s + Number(o.nominal || 0); }, 0);
  var pemasukanTotal   = spp + infaq + kasMasuk;
  var pengeluaranTotal = ihsan + operasional + kasKeluar;
  return {
    pemasukan:   { spp: spp, infaq: infaq, kas_lain: kasMasuk, total: pemasukanTotal },
    pengeluaran: { ihsan: ihsan, operasional: operasional, kas_lain: kasKeluar, total: pengeluaranTotal },
    saldo: pemasukanTotal - pengeluaranTotal,
  };
}


// Info periode utk filter rekap: nama + daftar id_halaqah + bulan-bulan
// yang tercakup rentang tanggal (utk window tunggakan & label). NULL bila
// periode tak ditemukan / tanggal belum diisi (buckets kosong).
var _PERIODE_SENTINEL_NONE = '__tanpa__'; // "Tanpa Periode" (id_periode IS NULL)
async function _resolvePeriode(id_periode) {
  if (!id_periode || id_periode === _PERIODE_SENTINEL_NONE) return null;
  var pr = await _sb.from('periode')
    .select('id_periode, nama_periode, tanggal_mulai, tanggal_selesai')
    .eq('id_periode', id_periode).maybeSingle();
  var data = pr.data;
  if (!data) return null;
  var hq = await _sb.from('halaqah').select('id_halaqah').eq('id_periode', id_periode);
  var halaqahIds = (hq.data || []).map(function(h){ return h.id_halaqah; });
  var buckets = [];
  if (data.tanggal_mulai && data.tanggal_selesai) {
    var y = Number(data.tanggal_mulai.slice(0,4)), m = Number(data.tanggal_mulai.slice(5,7));
    var ey = Number(data.tanggal_selesai.slice(0,4)), em = Number(data.tanggal_selesai.slice(5,7));
    var guard = 0;
    // 120 bulan = 10 tahun — jauh di atas periode wajar (≤6 bln); guard cuma
    // jaring salah-input tanggal_selesai (mis. '2099'). Lihat _multiYearWarn.
    while ((y < ey || (y === ey && m <= em)) && guard++ < 120) {
      buckets.push({ tahun: y, bulan: _BULAN_KEU[m-1] });
      m++; if (m > 12) { m = 1; y++; }
    }
    if (guard >= 120) console.warn('_resolvePeriode: rentang periode ' + id_periode + ' >10 thn — tanggal_selesai kemungkinan salah input.');
  }
  // Nama bulan berulang (periode >12 bln) → tunggakan mode-periode dedup
  // by-name bisa undercount. Realistis tak terjadi; peringatkan bila ada.
  var _namaSet = {}, _dupNama = false;
  buckets.forEach(function(b){ if (_namaSet[b.bulan]) _dupNama = true; _namaSet[b.bulan] = 1; });
  if (_dupNama) console.warn('_resolvePeriode: periode ' + id_periode + ' >12 bln — estimasi tunggakan bisa kurang akurat (dedup nama bulan).');
  return {
    id_periode: data.id_periode, nama_periode: data.nama_periode,
    tanggal_mulai: data.tanggal_mulai, tanggal_selesai: data.tanggal_selesai,
    halaqahIds: halaqahIds, monthBuckets: buckets, bulan_berulang: _dupNama,
    tahunSet: buckets.reduce(function(s,b){ if (s.indexOf(b.tahun)<0) s.push(b.tahun); return s; }, []),
  };
}


// ─────────────────────────────────────────────
//  ADMIN API
// ─────────────────────────────────────────────
var AdminAPI = {
  getDashboard: async function() {
    var bulanIni = _localDate().slice(0,7)+'-01';
    var bulanIndo = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var namaBulanIni = bulanIndo[new Date().getMonth()];
    var tahunIni = new Date().getFullYear();
    var tujuhHariLalu = _localDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    var [
      usersRes, hqRes, kbmBulanRes, periodeRes, nilaiRes, anggotaRes, kbmSesiRes, raportRes,
      saranRes, sppPendingRes, kbmAllRes, sppBulanIniRes, anggotaTipeRes, kbmPekanRes
    ] = await Promise.all([
      _sb.from('users').select('role').eq('status','aktif').neq('tipe_murid','alumni'),
      _sb.from('halaqah').select('id_halaqah, nama_halaqah, nama_guru, level').eq('status','aktif'),
      _sb.from('kbm_log').select('id_kbm',{count:'exact',head:true}).eq('status','selesai').gte('tanggal_pertemuan', bulanIni),
      _sb.from('periode').select('id_periode, nama_periode').eq('status','aktif').order('created_at',{ascending:false}).limit(1).maybeSingle(),
      _sb.from('nilai_kbm').select('id_halaqah, status_hadir'),
      _sb.from('anggota').select('id_halaqah').eq('status','aktif'),
      _sb.from('kbm_log').select('id_halaqah').eq('status','selesai'),
      _sb.from('raport').select('id_halaqah, nilai_akhir').not('nilai_akhir','is',null),
      _sb.from('saran_masukan').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      _sb.from('spp_pembayaran').select('*').eq('status', 'menunggu'),
      _sb.from('kbm_log').select('id_halaqah, jenis_sesi, status, is_pengganti').in('status', ['selesai', 'libur']),
      _sb.from('spp_pembayaran').select('jenis, nominal, metode_bayar').eq('tahun', tahunIni).eq('bulan', namaBulanIni).eq('status', 'lunas'),
      _sb.from('anggota').select('tipe_spp').eq('status', 'aktif'),
      _sb.from('kbm_log').select('id_halaqah').eq('status','selesai').gte('tanggal_pertemuan', tujuhHariLalu),
    ]);

    var roles = {};
    (usersRes.data||[]).forEach(function(u){roles[u.role]=(roles[u.role]||0)+1;});
    // Aggregate per halaqah
    var anggotaMap={}, nilaiMap={}, sesiMap={}, raportMap={};
    (anggotaRes.data||[]).forEach(function(a){ anggotaMap[a.id_halaqah]=(anggotaMap[a.id_halaqah]||0)+1; });
    (nilaiRes.data||[]).forEach(function(n){
      if (!nilaiMap[n.id_halaqah]) nilaiMap[n.id_halaqah]={hadir:0,total:0};
      nilaiMap[n.id_halaqah].total++;
      if (['H','T'].includes(n.status_hadir)) nilaiMap[n.id_halaqah].hadir++;
    });
    (kbmSesiRes.data||[]).forEach(function(k){ sesiMap[k.id_halaqah]=(sesiMap[k.id_halaqah]||0)+1; });
    (raportRes.data||[]).forEach(function(r){
      if (!raportMap[r.id_halaqah]) raportMap[r.id_halaqah]={sum:0,count:0};
      raportMap[r.id_halaqah].sum+=Number(r.nilai_akhir||0);
      raportMap[r.id_halaqah].count++;
    });
    var totalNilaiIsi = (nilaiRes.data||[]).filter(function(n){return n.status_hadir;}).length;
    var totalAnggota  = (anggotaRes.data||[]).length;
    var halaqah = (hqRes.data||[]).map(function(h) {
      var nm = nilaiMap[h.id_halaqah]||{hadir:0,total:0};
      var rm = raportMap[h.id_halaqah]||{sum:0,count:0};
      return {
        nama_halaqah: h.nama_halaqah, nama_guru: h.nama_guru, level: h.level, id_halaqah: h.id_halaqah,
        total_murid: anggotaMap[h.id_halaqah]||0,
        total_sesi : sesiMap[h.id_halaqah]||0,
        avg_nilai  : rm.count>0 ? Math.round(rm.sum/rm.count) : 0,
        pct_hadir  : nm.total>0 ? Math.round(nm.hadir/nm.total*100) : 0,
      };
    });

    // 1. Saran Pending Count
    var saranPendingCount = saranRes.count || 0;

    // 2. SPP Pending Count (saring expired)
    var sppPendingCount = (sppPendingRes.data || []).filter(function(r) { return !_sppGatewayExpired(r); }).length;

    // 3. Hutang Kelas Pengganti Count
    var liburByHalaqahAndJenis = {}, penggantiByHalaqahAndJenis = {};
    (kbmAllRes.data || []).forEach(function(k) {
      var jenis = k.jenis_sesi || 'KBM Reguler';
      if (k.status === 'libur') {
        if (!liburByHalaqahAndJenis[k.id_halaqah]) liburByHalaqahAndJenis[k.id_halaqah] = {};
        liburByHalaqahAndJenis[k.id_halaqah][jenis] = (liburByHalaqahAndJenis[k.id_halaqah][jenis] || 0) + 1;
      } else if (k.status === 'selesai' && k.is_pengganti) {
        if (!penggantiByHalaqahAndJenis[k.id_halaqah]) penggantiByHalaqahAndJenis[k.id_halaqah] = {};
        penggantiByHalaqahAndJenis[k.id_halaqah][jenis] = (penggantiByHalaqahAndJenis[k.id_halaqah][jenis] || 0) + 1;
      }
    });
    var totalHutangPengganti = 0;
    var allLiburHalaqah = Object.keys(liburByHalaqahAndJenis);
    allLiburHalaqah.forEach(function(id_halaqah) {
      var libur = liburByHalaqahAndJenis[id_halaqah] || {};
      var pengganti = penggantiByHalaqahAndJenis[id_halaqah] || {};
      Object.keys(libur).forEach(function(jenis) {
        var sisa = (libur[jenis] || 0) - (pengganti[jenis] || 0);
        if (sisa > 0) totalHutangPengganti += sisa;
      });
    });

    // 4. Financial Overview Bulan Ini
    var totalMasuk = 0;
    var sppLunasCount = 0;
    var sppLunasNominal = 0;
    var infaqNominal = 0;
    var ihsanNominal = 0;
    var gatewayNominal = 0;
    var manualNominal = 0;

    (sppBulanIniRes.data || []).forEach(function(s) {
      var nominal = Number(s.nominal || 0);
      // 'Ihsan Guru' = gaji guru (PENGELUARAN), bukan pemasukan → jangan
      // dihitung sebagai total_masuk (dulu bug: totalMasuk += utk SEMUA baris
      // membuat "Total Masuk" dashboard menggelembung). Selaras dgn getSPPRekap.
      if (s.jenis === 'SPP Pribadi' || !s.jenis) {
        totalMasuk += nominal;
        sppLunasCount++;
        sppLunasNominal += nominal;
      } else if (s.jenis === 'Infaq/Operasional') {
        totalMasuk += nominal;
        infaqNominal += nominal;
      } else if (s.jenis === 'Ihsan Guru') {
        ihsanNominal += nominal;
        return; // gaji, bukan pemasukan → jangan masuk split metode income
      }

      if (s.metode_bayar === 'gateway') {
        gatewayNominal += nominal;
      } else {
        manualNominal += nominal;
      }
    });

    // SPP target nominal: hitung murid non-beasiswa
    var sppTargetMuridCount = (anggotaTipeRes.data || []).filter(function(a) { return a.tipe_spp !== 'beasiswa'; }).length;
    var sppTargetNominal = sppTargetMuridCount * SPP_NOMINAL_BULANAN;

    // Hitung Kepatuhan Input KBM Pekan Ini (7 hari terakhir)
    var halaqahAktifIds = (hqRes.data || []).map(function(h) { return h.id_halaqah; });
    var halaqahSetorSet = new Set();
    (kbmPekanRes.data || []).forEach(function(k) {
      if (halaqahAktifIds.includes(k.id_halaqah)) {
        halaqahSetorSet.add(k.id_halaqah);
      }
    });
    var totalActiveHq = halaqahAktifIds.length;
    var hqInputtedCount = halaqahSetorSet.size;
    var pctKepatuhanInput = totalActiveHq > 0 ? Math.round(hqInputtedCount / totalActiveHq * 100) : 0;

    return { status:'ok', data:{
      total_murid: roles.murid||0, total_guru: roles.guru||0,
      total_halaqah: (hqRes.data||[]).length, kbm_bulan_ini: kbmBulanRes.count||0,
      pct_nilai_terisi: pctKepatuhanInput,
      periode_aktif: periodeRes.data||null,
      halaqah: halaqah,
      saran_pending_count: saranPendingCount,
      spp_pending_count: sppPendingCount,
      total_hutang_pengganti: totalHutangPengganti,
      financial_overview: {
        bulan_ini: namaBulanIni,
        total_masuk: totalMasuk,
        spp_lunas_count: sppLunasCount,
        spp_lunas_nominal: sppLunasNominal,
        spp_target_murid_count: sppTargetMuridCount,
        spp_target_nominal: sppTargetNominal,
        infaq_nominal: infaqNominal,
        ihsan_nominal: ihsanNominal,
        gateway_nominal: gatewayNominal,
        manual_nominal: manualNominal
      }
    }};
  },
  getAllUsers: async function(p) {
    var q = _sb.from('users').select(USER_COLS_CLIENT).order('nama_lengkap');
    // Accept both a plain string role (e.g. 'guru') or an object { role: 'guru' }
    var roleFilter = typeof p === 'string' ? p : (p && p.role ? p.role : null);
    if (roleFilter) q = q.eq('role', roleFilter);
    var {data,error} = await q; _check(error,'getAllUsers'); return {status:'ok',data};
  },
  createUser: async function(d) { var {data,error}=await _sb.from('users').insert(d).select(USER_COLS_CLIENT).single(); _check(error,'createUser'); return {status:'ok',data}; },
  updateUser: async function(d) { var {id_user,...u}=d; var {data,error}=await _sb.from('users').update(u).eq('id_user',id_user).select(USER_COLS_CLIENT); _check(error,'updateUser'); if(!data || !data.length) throw new Error('User '+id_user+' tidak ditemukan atau tidak ada perubahan tersimpan -- coba muat ulang halaman dan login ulang'); if('role' in u || 'status' in u || 'is_musyrif' in u || 'tipe_murid' in u){ _logAudit('update_user_role_status', {id_user:id_user, changes:u}); } return {status:'ok',data:data[0]}; },
  deleteUser: async function(id_user) { var {error}=await _sb.from('users').update({status:'nonaktif'}).eq('id_user',id_user); _check(error,'deleteUser'); return {status:'ok'}; },
  // Wisuda bulk semua murid di satu halaqah (patch_100)
  bulkWisudaHalaqah: async function(id_halaqah, nama_halaqah) {
    var { data, error } = await _sb.rpc('bulk_wisuda_halaqah', { p_id_halaqah: id_halaqah });
    _check(error, 'bulkWisudaHalaqah');
    _logAudit('wisuda_halaqah_bulk', { id_halaqah: id_halaqah, nama_halaqah: nama_halaqah, jumlah: data });
    return { status: 'ok', jumlah: data };
  },
  // Hapus murid PERMANEN & bersih (RPC patch_043, superadmin only):
  // hapus data + cascade, bebaskan ID, hapus akun auth login.
  hardDeleteMurid: async function(id_user) {
    var {data,error}=await _sb.rpc('hard_delete_murid', { p_id_user: id_user });
    _check(error,'hardDeleteMurid');
    _logAudit('hard_delete_murid', { id_user: id_user });
    return {status:'ok',data};
  },
  hardDeleteGuru: async function(id_user) {
    var {data,error}=await _sb.rpc('hard_delete_guru', { p_id_user: id_user });
    _check(error,'hardDeleteGuru');
    _logAudit('hard_delete_guru', { id_user: id_user });
    return {status:'ok',data};
  },
  hardDeleteHalaqah: async function(id_halaqah) {
    var {data,error}=await _sb.rpc('hard_delete_halaqah', { p_id_halaqah: id_halaqah });
    _check(error,'hardDeleteHalaqah');
    _logAudit('hard_delete_halaqah', { id_halaqah: id_halaqah });
    return {status:'ok',data};
  },
  getAllHalaqah: async function() {
    // Fetch halaqah + seluruh anggota aktif (untuk ketua + hitung jumlah murid) in parallel
    var [{data: hqData, error: hqErr}, {data: anggotaData}] = await Promise.all([
      _sb.from('halaqah').select('*').order('nama_halaqah'),
      _sb.from('anggota').select('id_halaqah, nama_murid, is_ketua').eq('status', 'aktif'),
    ]);
    _check(hqErr,'getAllHalaqah');
    // Build ketua map + count murid aktif per halaqah
    var ketuaMap = {}, countMap = {};
    (anggotaData || []).forEach(function(a) {
      countMap[a.id_halaqah] = (countMap[a.id_halaqah] || 0) + 1;
      if (a.is_ketua === true) ketuaMap[a.id_halaqah] = a.nama_murid;
    });
    if (hqData) {
      hqData = hqData.map(function(h) {
        return Object.assign({}, h, {
          jam_mulai: h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
          jam_selesai: h.jam_selesai ? h.jam_selesai.substring(0, 5) : null,
          nama_ketua: ketuaMap[h.id_halaqah] || null,
          total_murid: countMap[h.id_halaqah] || 0,
        });
      });
    }
    return {status:'ok',data:hqData};
  },
  createHalaqah: async function(d) {
    if (!d.id_halaqah) {
      d.id_halaqah = 'HQ-' + Math.random().toString(36).substring(2, 10).toUpperCase();
    }
    var {data,error}=await _sb.from('halaqah').insert(d).select().single();
    _check(error,'createHalaqah');
    if (data) {
      data.jam_mulai = data.jam_mulai ? data.jam_mulai.substring(0, 5) : null;
      data.jam_selesai = data.jam_selesai ? data.jam_selesai.substring(0, 5) : null;
    }
    return {status:'ok',data};
  },
  updateHalaqah: async function(d) {
    var {id_halaqah,...u}=d;
    var {data,error}=await _sb.from('halaqah').update(u).eq('id_halaqah',id_halaqah).select().single();
    _check(error,'updateHalaqah');
    if (data) {
      data.jam_mulai = data.jam_mulai ? data.jam_mulai.substring(0, 5) : null;
      data.jam_selesai = data.jam_selesai ? data.jam_selesai.substring(0, 5) : null;
    }
    return {status:'ok',data};
  },
  deleteHalaqah: async function(id) { var {error}=await _sb.from('halaqah').update({status:'nonaktif'}).eq('id_halaqah',id); _check(error,'deleteHalaqah'); return {status:'ok'}; },

  // ── Kelas Pengganti: Hari Libur Resmi (admin) ─────────────────
  getHariLiburResmi: async function() {
    var { data, error } = await _sb.from('hari_libur_resmi').select('*').order('tanggal', { ascending: false });
    _check(error, 'getHariLiburResmi');
    return { status: 'ok', data };
  },
  // d: { tanggal_mulai, tanggal_selesai (opsional, default = tanggal_mulai), keterangan }
  // Disimpan 1 baris per tanggal (lihat rencana_kelas_pengganti.md §10.E)
  simpanHariLiburResmi: async function(d) {
    if (!d.tanggal_mulai || !(d.keterangan || '').trim()) {
      return { status: 'error', message: 'Tanggal dan keterangan wajib diisi' };
    }
    var start = new Date(d.tanggal_mulai + 'T00:00:00');
    var end   = new Date((d.tanggal_selesai || d.tanggal_mulai) + 'T00:00:00');
    if (end < start) return { status: 'error', message: 'Tanggal selesai harus sama atau setelah tanggal mulai' };

    var rows = [];
    for (var dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      var y = dt.getFullYear();
      var m = String(dt.getMonth() + 1).padStart(2, '0');
      var day = String(dt.getDate()).padStart(2, '0');
      rows.push({ tanggal: y + '-' + m + '-' + day, keterangan: d.keterangan.trim(), dibuat_oleh: _uid() });
    }
    var { data, error } = await _sb.from('hari_libur_resmi').upsert(rows, { onConflict: 'tanggal' }).select();
    _check(error, 'simpanHariLiburResmi');
    return { status: 'ok', message: 'Hari libur resmi disimpan (' + rows.length + ' tanggal)', data };
  },
  hapusHariLiburResmi: async function(tanggal) {
    var { error } = await _sb.from('hari_libur_resmi').delete().eq('tanggal', tanggal);
    _check(error, 'hapusHariLiburResmi');
    return { status: 'ok' };
  },

  // ── Absensi Guru (rekap + override + pengaturan) ─────────────
  //  Mesin rekap = agregasi JS (_fetchAbsensiData/_deriveRekapAbsensi). Lihat RANCANGAN §4, §6.
  //  p: { bulan(1-12), tahun, id_guru? }. Tanpa argumen → bulan & tahun berjalan.
  getRekapAbsensiGuru: async function(p) {
    p = p || {};
    // MB11 fix (bug hunt 2026-08-27): kembaran M9 lama yg tak ikut ditambal --
    // getAbsensiSaya (versi guru, laporan yg sama) sudah pakai _todayJakarta(),
    // versi admin ini masih new Date() device-local. Disamakan polanya.
    var todayJkt = _todayJakarta();
    var bulan = Number(p.bulan) || Number(todayJkt.slice(5, 7));
    var tahun = Number(p.tahun) || Number(todayJkt.slice(0, 4));
    var data  = await _fetchAbsensiData({ bulan: bulan, tahun: tahun, scope: 'admin', id_guru: p.id_guru || null });
    var rekap = _deriveRekapAbsensi(data);
    if (p.id_guru) rekap.guru = rekap.guru.filter(function(g) { return g.id_guru === p.id_guru; });
    return { status: 'ok', data: rekap };
  },

  // Simpan/ubah koreksi manual (upsert 1 override per sel guru+halaqah+tanggal).
  setAbsensiGuruOverride: async function(d) {
    d = d || {};
    if (!d.id_guru || !d.id_halaqah || !d.tanggal || !d.status) {
      return { status: 'error', message: 'id_guru, id_halaqah, tanggal, dan status wajib diisi' };
    }
    if (['H', 'DS', 'HP', 'I', 'A', 'L'].indexOf(d.status) < 0) {
      return { status: 'error', message: 'Status override tidak valid: ' + d.status };
    }
    var { data, error } = await _sb.from('absensi_guru_override').upsert({
      id_guru: d.id_guru, id_halaqah: d.id_halaqah, tanggal: d.tanggal,
      status: d.status, keterangan: d.keterangan || null, dicatat_oleh: _uid(),
    }, { onConflict: 'id_guru,id_halaqah,tanggal' }).select().single();
    _check(error, 'setAbsensiGuruOverride');
    _logAudit('set_absensi_override', { id_guru: d.id_guru, id_halaqah: d.id_halaqah, tanggal: d.tanggal, status: d.status });
    return { status: 'ok', data: data };
  },

  // Hapus override (kembali ke status otomatis). Terima id_override (string) atau {id_guru,id_halaqah,tanggal}.
  hapusOverride: async function(p) {
    var q = _sb.from('absensi_guru_override').delete();
    if (typeof p === 'string') q = q.eq('id_override', p);
    else if (p && p.id_override) q = q.eq('id_override', p.id_override);
    else if (p && p.id_guru && p.id_halaqah && p.tanggal) {
      q = q.eq('id_guru', p.id_guru).eq('id_halaqah', p.id_halaqah).eq('tanggal', p.tanggal);
    } else {
      return { status: 'error', message: 'id_override atau (id_guru, id_halaqah, tanggal) wajib' };
    }
    var { error } = await q;
    _check(error, 'hapusOverride');
    return { status: 'ok' };
  },

  getPengaturanAbsensiGuru: async function() {
    var { data, error } = await _sb.from('pengaturan_absensi_guru').select('*').eq('id', 1).maybeSingle();
    _check(error, 'getPengaturanAbsensiGuru');
    return { status: 'ok', data: data || { id: 1, durasi_minimal_menit: 90, durasi_outlier_menit: 180 } };
  },
  setPengaturanAbsensiGuru: async function(d) {
    d = d || {};
    var row = {
      id: 1,
      durasi_minimal_menit: Number(d.durasi_minimal_menit) || 90,
      durasi_outlier_menit: Number(d.durasi_outlier_menit) || 180,
      updated_at: new Date().toISOString(), updated_by: _uid(),
    };
    // tanggal_mulai_berlaku (patch_050): hanya kirim bila field disertakan,
    // agar tetap aman bila patch_050 belum dijalankan & field tak diutak-atik.
    if ('tanggal_mulai_berlaku' in d) row.tanggal_mulai_berlaku = d.tanggal_mulai_berlaku || null;
    var { error } = await _sb.from('pengaturan_absensi_guru').upsert(row, { onConflict: 'id' });
    _check(error, 'setPengaturanAbsensiGuru');
    return { status: 'ok' };
  },

  // ── Kelas Pengganti: Flow 6 — toggle is_pengganti (admin) ─────
  toggleIsPengganti: async function(d) {
    var { data, error } = await _sb.from('kbm_log').update({ is_pengganti: !!d.is_pengganti })
      .eq('id_kbm', d.id_kbm).eq('status', 'selesai').select().single();
    _check(error, 'toggleIsPengganti');
    if (!data) throw new Error('Sesi tidak ditemukan atau bukan sesi berstatus selesai');
    return { status: 'ok', data };
  },

  // ── Kelas Pengganti: Flow 7 — ringkasan sisa_pengganti per halaqah/jenis_sesi ──
  getSisaPenggantiSummary: async function() {
    var { data: kbmAll, error } = await _sb.from('kbm_log')
      .select('id_halaqah, jenis_sesi, status, is_pengganti, tanggal_pertemuan, keterangan_libur')
      .in('status', ['selesai', 'libur']);
    _check(error, 'getSisaPenggantiSummary');

    var liburByJenis = {}, penggantiByJenis = {}, liburEntries = {};
    (kbmAll || []).forEach(function(k) {
      var jenis = k.jenis_sesi || 'KBM Reguler';
      if (k.status === 'libur') {
        if (!liburByJenis[k.id_halaqah]) liburByJenis[k.id_halaqah] = {};
        liburByJenis[k.id_halaqah][jenis] = (liburByJenis[k.id_halaqah][jenis] || 0) + 1;
        if (!liburEntries[k.id_halaqah]) liburEntries[k.id_halaqah] = [];
        liburEntries[k.id_halaqah].push({
          tanggal_pertemuan: k.tanggal_pertemuan,
          jenis_sesi: jenis,
          keterangan_libur: k.keterangan_libur || '',
        });
      } else if (k.status === 'selesai' && k.is_pengganti) {
        if (!penggantiByJenis[k.id_halaqah]) penggantiByJenis[k.id_halaqah] = {};
        penggantiByJenis[k.id_halaqah][jenis] = (penggantiByJenis[k.id_halaqah][jenis] || 0) + 1;
      }
    });

    var result = {};
    var allHalaqah = Object.keys(Object.assign({}, liburByJenis, penggantiByJenis));
    allHalaqah.forEach(function(id_halaqah) {
      var libur = liburByJenis[id_halaqah] || {};
      var pengganti = penggantiByJenis[id_halaqah] || {};
      var jenisSet = Object.keys(Object.assign({}, libur, pengganti));
      var perJenis = {};
      var hasAnomali = false;
      jenisSet.forEach(function(jenis) {
        var raw = (libur[jenis] || 0) - (pengganti[jenis] || 0);
        perJenis[jenis] = { sisa: Math.max(0, raw), raw: raw };
        if (raw < 0) hasAnomali = true;
      });
      var riwayatLibur = (liburEntries[id_halaqah] || []).slice().sort(function(a, b) {
        return (b.tanggal_pertemuan || '').localeCompare(a.tanggal_pertemuan || '');
      });
      result[id_halaqah] = { per_jenis: perJenis, has_anomali: hasAnomali, riwayat_libur: riwayatLibur };
    });
    return { status: 'ok', data: result };
  },

  // ── Kelas Pengganti: riwayat libur/pengganti dari SEMUA halaqah (untuk monitoring) ──
  getRiwayatPenggantiSemua: async function(limit) {
    var { data, error } = await _sb.from('kbm_log').select('*')
      .or('status.eq.libur,is_pengganti.eq.true')
      .order('tanggal_pertemuan', { ascending: false })
      .limit(limit || 100);
    _check(error, 'getRiwayatPenggantiSemua');
    if (data) {
      data = data.map(function(k) {
        return Object.assign({}, k, {
          jam_mulai: k.jam_mulai ? k.jam_mulai.substring(0, 5) : null,
          jam_selesai: k.jam_selesai ? k.jam_selesai.substring(0, 5) : null
        });
      });
    }
    return { status: 'ok', data: data || [] };
  },
  getAllAnggota: async function(id_halaqah) {
    var q = _sb.from('anggota').select('*, users!anggota_id_murid_fkey(nama_lengkap,no_hp)');
    if (id_halaqah) q = q.eq('id_halaqah',id_halaqah);
    var {data,error}=await q.order('nama_murid'); _check(error,'getAllAnggota');
    // Fallback nama dari join users bila kolom denormalisasi nama_murid kosong (baris lama)
    if (data) data = data.map(function(a) {
      return Object.assign({}, a, { nama_murid: a.nama_murid || (a.users && a.users.nama_lengkap) || '' });
    });
    return {status:'ok',data};
  },
  addAnggota: async function(d) {
    // Isi nama_murid (denormalisasi) bila belum ada — dipakai untuk display & nama ketua
    if (!d.nama_murid && d.id_murid) {
      var {data:u}=await _sb.from('users').select('nama_lengkap').eq('id_user',d.id_murid).single();
      if (u && u.nama_lengkap) d = Object.assign({}, d, { nama_murid: u.nama_lengkap });
    }
    var {data,error}=await _sb.from('anggota').insert(d).select().single(); _check(error,'addAnggota'); return {status:'ok',data};
  },
  updateAnggota: async function(d) { var {id_anggota,...u}=d; var {error}=await _sb.from('anggota').update(u).eq('id_anggota',id_anggota); _check(error,'updateAnggota'); return {status:'ok'}; },
  // Pindah murid dari halaqah asal ke tujuan secara atomik (RPC patch_042).
  // Tidak meninggalkan baris nyangkut di halaqah lama + aman dari duplikat.
  pindahHalaqah: async function(d) {
    var {data,error}=await _sb.rpc('pindah_anggota_halaqah', {
      p_id_anggota        : d.id_anggota,
      p_id_halaqah_tujuan : d.id_halaqah_tujuan,
      p_level             : d.level || null,
      p_target_level      : d.target_level || null,
    });
    _check(error,'pindahHalaqah'); return {status:'ok',data};
  },
  removeAnggota: async function(d) { var id=typeof d==='string'?d:(d&&d.id_anggota); var {error}=await _sb.from('anggota').update({status:'nonaktif'}).eq('id_anggota',id); _check(error,'removeAnggota'); return {status:'ok'}; },
  assignKetuaKelas: async function(d) {
    var {data:row,error:errRow}=await _sb.from('anggota').select('id_halaqah').eq('id_anggota',d.id_anggota).single();
    _check(errRow,'assignKetuaKelas');
    if (d.assign) {
      await _sb.from('anggota').update({is_ketua:false}).eq('id_halaqah',row.id_halaqah);
      var {error}=await _sb.from('anggota').update({is_ketua:true}).eq('id_anggota',d.id_anggota);
      _check(error,'assignKetuaKelas');
    } else {
      var {error}=await _sb.from('anggota').update({is_ketua:false}).eq('id_anggota',d.id_anggota);
      _check(error,'assignKetuaKelas');
    }
    return {status:'ok'};
  },
  // Kelompok Partner Qiyam — admin lihat/atur lintas halaqah (RLS admin_all_*)
  getMuridQiyam: async function(id_halaqah) { return GuruAPI.getMuridQiyam(id_halaqah); },
  getKelompokPartnerHalaqah: async function(id_halaqah) { return GuruAPI.getKelompokPartnerHalaqah(id_halaqah); },
  getPantauKelompokPartner: async function(id_halaqah) { return GuruAPI.getPantauKelompokPartner(id_halaqah); },
  getLiniMasaSetoranKelompok: async function(id_kelompok) { return GuruAPI.getLiniMasaSetoranKelompok(id_kelompok); },
  getMilestoneByKelompok: async function(id_kelompok) { return GuruAPI.getMilestoneByKelompok(id_kelompok); },
  addMilestoneKelompok: async function(d) { return GuruAPI.addMilestoneKelompok(d); },
  deleteMilestoneKelompok: async function(id_milestone) { return GuruAPI.deleteMilestoneKelompok(id_milestone); },
  guruKonfirmasiSetoran: async function(id_setoran, kelancaran, catatan) { return GuruAPI.guruKonfirmasiSetoran(id_setoran, kelancaran, catatan); },
  getSetoranPartnerMenungguHalaqah: async function(id_halaqah) { return GuruAPI.getSetoranPartnerMenungguHalaqah(id_halaqah); },
  getTargetByKelompok: async function(id_kelompok) { return GuruAPI.getTargetByKelompok(id_kelompok); },
  addTargetByKelompok: async function(d) { return GuruAPI.addTargetByKelompok(d); },
  updateTargetByKelompok: async function(id_target, updates) { return GuruAPI.updateTargetByKelompok(id_target, updates); },
  deleteTargetByKelompok: async function(id_target) { return GuruAPI.deleteTargetByKelompok(id_target); },
  createKelompokPartner: async function(id_halaqah, nama_kelompok, anggota) { return GuruAPI.createKelompokPartner(id_halaqah, nama_kelompok, anggota); },
  updateKelompokPartner: async function(id_kelompok, updates) { return GuruAPI.updateKelompokPartner(id_kelompok, updates); },
  setAnggotaKelompok: async function(id_kelompok, anggota) { return GuruAPI.setAnggotaKelompok(id_kelompok, anggota); },
  deleteKelompokPartner: async function(id_kelompok) { return GuruAPI.deleteKelompokPartner(id_kelompok); },

  // Kelompok Partner Belajar — admin lihat/atur lintas halaqah (RLS admin_all_*)
  getLevelBelajarEnabled: async function() { return GuruAPI.getLevelBelajarEnabled(); },
  getMuridBelajar: async function(id_halaqah) { return GuruAPI.getMuridBelajar(id_halaqah); },
  getKelompokBelajarHalaqah: async function(id_halaqah) { return GuruAPI.getKelompokBelajarHalaqah(id_halaqah); },
  getPantauKelompokBelajar: async function(id_halaqah) { return GuruAPI.getPantauKelompokBelajar(id_halaqah); },
  getLiniMasaBelajarKelompok: async function(id_kelompok) { return GuruAPI.getLiniMasaBelajarKelompok(id_kelompok); },
  getMilestoneBelajarByKelompok: async function(id_kelompok) { return GuruAPI.getMilestoneBelajarByKelompok(id_kelompok); },
  addMilestoneBelajarKelompok: async function(d) { return GuruAPI.addMilestoneBelajarKelompok(d); },
  deleteMilestoneBelajarKelompok: async function(id_milestone) { return GuruAPI.deleteMilestoneBelajarKelompok(id_milestone); },
  guruKonfirmasiLogBelajar: async function(id_log, kelancaran, catatan) { return GuruAPI.guruKonfirmasiLogBelajar(id_log, kelancaran, catatan); },
  getLogBelajarMenungguHalaqah: async function(id_halaqah) { return GuruAPI.getLogBelajarMenungguHalaqah(id_halaqah); },
  getTargetBelajarByKelompok: async function(id_kelompok) { return GuruAPI.getTargetBelajarByKelompok(id_kelompok); },
  addTargetBelajarByKelompok: async function(d) { return GuruAPI.addTargetBelajarByKelompok(d); },
  updateTargetBelajarByKelompok: async function(id_target, updates) { return GuruAPI.updateTargetBelajarByKelompok(id_target, updates); },
  deleteTargetBelajarByKelompok: async function(id_target) { return GuruAPI.deleteTargetBelajarByKelompok(id_target); },
  createKelompokBelajar: async function(id_halaqah, nama_kelompok, anggota) { return GuruAPI.createKelompokBelajar(id_halaqah, nama_kelompok, anggota); },
  updateKelompokBelajar: async function(id_kelompok, updates) { return GuruAPI.updateKelompokBelajar(id_kelompok, updates); },
  setAnggotaKelompokBelajar: async function(id_kelompok, anggota) { return GuruAPI.setAnggotaKelompokBelajar(id_kelompok, anggota); },
  deleteKelompokBelajar: async function(id_kelompok) { return GuruAPI.deleteKelompokBelajar(id_kelompok); },

  getAllPeriode: async function() { return GuruAPI.getAllPeriode(); },
  createPeriode: async function(d) { var {data,error}=await _sb.from('periode').insert(d).select().single(); _check(error,'createPeriode'); return {status:'ok',data}; },
  // Set periode utk banyak halaqah sekaligus + tandai transaksi SPP/Infaq
  // terkait yang belum berperiode (migrasi data lama → rekap per periode).
  bulkSetHalaqahPeriode: async function(d) {
    var ids = (d.halaqah_ids || []).filter(Boolean);
    if (!ids.length)     throw new Error('Pilih minimal 1 halaqah.');
    if (!d.id_periode)   throw new Error('Pilih periode tujuan.');
    var repointAll = d.repoint_all === true;   // pindahkan juga yg sudah ber-periode lain
    // Berapa baris SPP yang akan ikut tertandai (sebelum update).
    //  repoint_all → semua baris halaqah tsb; default → hanya yg id_periode NULL.
    var sppCount = 0;
    try {
      var _cq = _sb.from('spp_pembayaran').select('id_spp', { count:'exact', head:true }).in('id_halaqah', ids);
      if (!repointAll) _cq = _cq.is('id_periode', null);
      var cnt = await _cq;
      sppCount = cnt.count || 0;
    } catch(_) {}
    var { error: e1 } = await _sb.from('halaqah').update({ id_periode: d.id_periode }).in('id_halaqah', ids);
    _check(e1, 'bulkSetHalaqahPeriode:halaqah');
    var sppOk = false;
    if (d.backfill_spp !== false) {
      try {
        var _uq = _sb.from('spp_pembayaran').update({ id_periode: d.id_periode }).in('id_halaqah', ids);
        if (!repointAll) _uq = _uq.is('id_periode', null);
        var { error: e2 } = await _uq;
        if (e2) throw e2;
        sppOk = true;
      } catch (eSpp) {
        // Kolom id_periode belum ada (patch_101 belum dijalankan) → halaqah tetap
        // ter-update; SPP diisi trigger DB nanti / jalankan ulang tool setelah patch.
        console.warn('bulkSetHalaqahPeriode: backfill SPP dilewati —', eSpp && eSpp.message);
      }
    }
    _logAudit('bulk_set_halaqah_periode', { count: ids.length, id_periode: d.id_periode, repoint_all: repointAll, spp_backfilled: sppOk ? sppCount : 0 });
    return { status:'ok', halaqah: ids.length, spp_backfilled: sppOk ? sppCount : 0, repoint_all: repointAll };
  },
  updatePeriode: async function(d) { var {id_periode,...u}=d; var {data,error}=await _sb.from('periode').update(u).eq('id_periode',id_periode).select().single(); _check(error,'updatePeriode'); return {status:'ok',data}; },
  getKomponenRaport: async function(id) { return GuruAPI.getKomponenRaport(id); },
  saveKomponenRaport: async function(d) {
    await _sb.from('komponen_raport').update({status:'nonaktif'}).eq('id_periode',d.id_periode);
    var rows = d.komponen.map(function(k, idx) {
      return {
        id_komponen   : k.id_komponen || _genId('KMP'),
        id_periode    : d.id_periode,
        nama_komponen : k.nama_komponen,
        bobot         : Number(k.bobot),
        tipe          : k.tipe || 'otomatis',
        urutan        : idx,
        status        : 'aktif'
      };
    });
    var {data,error}=await _sb.from('komponen_raport').upsert(rows, { onConflict: 'id_komponen' }).select();
    _check(error,'saveKomponenRaport'); return {status:'ok',data};
  },
  getNilaiManual: async function(id) { return GuruAPI.getNilaiManual(id); },
  getMutabaahDaurahGuru: async function(id_periode) { return GuruAPI.getMutabaahDaurahGuru(id_periode); },
  saveNilaiManual: async function(d) { return GuruAPI.saveNilaiManual(d); },
  saveNilaiManualBatch: async function(d) { return GuruAPI.saveNilaiManualBatch(d); },
  getRaportList: async function(p) {
    var q = _sb.from('raport').select('*, users!raport_id_murid_fkey(nama_lengkap), halaqah(nama_halaqah), periode(nama_periode)');
    if (p && p.id_periode) q = q.eq('id_periode',p.id_periode);
    var {data,error}=await q.order('created_at',{ascending:false}); _check(error,'getRaportList'); return {status:'ok',data};
  },
  publishRaport: async function(d) {
    var {error}=await _sb.from('raport').update({status:'published',published_by:_uid(),published_at:new Date().toISOString()}).eq('id_raport',d.id_raport);
    _check(error,'publishRaport');
    _logAudit('publish_raport', {id_raport: d.id_raport});
    return {status:'ok',message:'Raport dipublikasikan'};
  },
  getAllPengumuman: async function() { var {data,error}=await _sb.from('pengumuman').select('*').order('tanggal',{ascending:false}); _check(error,'getAllPengumuman'); return {status:'ok',data}; },
  buatPengumuman: async function(d) {
    var {data,error}=await _sb.from('pengumuman').insert(Object.assign({},d,{dibuat_oleh:_uid(),nama_pembuat:(_currentUser&&(_currentUser.nama||_currentUser.nama_lengkap))||'Admin'})).select().single();
    _check(error,'buatPengumuman'); return {status:'ok',data};
  },
  getLaporanGlobal: async function() {
    var [hqRes, anggotaRes, nilaiRes, kbmSesiRes, raportRes] = await Promise.all([
      _sb.from('halaqah').select('*').eq('status','aktif'),
      _sb.from('anggota').select('id_halaqah').eq('status','aktif'),
      _sb.from('nilai_kbm').select('id_halaqah, status_hadir'),
      _sb.from('kbm_log').select('id_halaqah').eq('status','selesai'),
      _sb.from('raport').select('id_halaqah, nilai_akhir').not('nilai_akhir','is',null),
    ]);
    _check(hqRes.error,'getLaporanGlobal');
    // Aggregate per halaqah (pola sama dengan getDashboard)
    var anggotaMap={}, nilaiMap={}, sesiMap={}, raportMap={};
    (anggotaRes.data||[]).forEach(function(a){ anggotaMap[a.id_halaqah]=(anggotaMap[a.id_halaqah]||0)+1; });
    (nilaiRes.data||[]).forEach(function(n){
      if (!nilaiMap[n.id_halaqah]) nilaiMap[n.id_halaqah]={hadir:0,total:0};
      nilaiMap[n.id_halaqah].total++;
      if (['H','T'].includes(n.status_hadir)) nilaiMap[n.id_halaqah].hadir++;
    });
    (kbmSesiRes.data||[]).forEach(function(k){ sesiMap[k.id_halaqah]=(sesiMap[k.id_halaqah]||0)+1; });
    (raportRes.data||[]).forEach(function(r){
      if (!raportMap[r.id_halaqah]) raportMap[r.id_halaqah]={sum:0,count:0};
      raportMap[r.id_halaqah].sum+=Number(r.nilai_akhir||0);
      raportMap[r.id_halaqah].count++;
    });
    var data = (hqRes.data||[]).map(function(h) {
      var nm = nilaiMap[h.id_halaqah]||{hadir:0,total:0};
      var rm = raportMap[h.id_halaqah]||{sum:0,count:0};
      return Object.assign({}, h, {
        jam_mulai: h.jam_mulai ? h.jam_mulai.substring(0, 5) : null,
        jam_selesai: h.jam_selesai ? h.jam_selesai.substring(0, 5) : null,
        total_murid: anggotaMap[h.id_halaqah]||0,
        total_sesi : sesiMap[h.id_halaqah]||0,
        avg_nilai  : rm.count>0 ? Math.round(rm.sum/rm.count) : 0,
        pct_hadir  : nm.total>0 ? Math.round(nm.hadir/nm.total*100) : 0,
      });
    });
    return {status:'ok',data};
  },
  getMutabaahDaurah: async function(id_periode) {
    id_periode = id_periode || 'P-DAURAH-JULI-2026';
    var [periodeRes, halaqahRes, asmtItemRes] = await Promise.all([
      _sb.from('periode').select('id_periode, nama_periode, tanggal_mulai, tanggal_selesai').eq('id_periode', id_periode).maybeSingle(),
      _sb.from('halaqah').select('id_halaqah, nama_halaqah, nama_guru, id_guru, level, status').eq('level','Tahsin Al-Fatihah').eq('status','aktif'),
      _sb.from('assessment_items').select('id_item, nama_item:teks_latin, urutan, kategori').eq('level','Tahsin Al-Fatihah').eq('status','aktif').order('urutan'),
    ]);
    _check(periodeRes.error, 'getMutabaahDaurah.periode');
    _check(halaqahRes.error, 'getMutabaahDaurah.halaqah');
    _check(asmtItemRes.error, 'getMutabaahDaurah.items');

    var periode = periodeRes.data || { id_periode: id_periode, nama_periode: 'Daurah Al-Fatihah', tanggal_mulai: '2026-07-11', tanggal_selesai: '2026-07-18' };
    var indikator = asmtItemRes.data || [];
    // .order('urutan') di query hanya urut GLOBAL — indikator hari berbeda bisa
    // bercampur (Hari 2 urutan 1 muncul sebelum Hari 1 urutan 7). Urutkan ulang
    // per Hari (angka di kategori) lalu urutan, sama seperti fix di konten-module.js.
    indikator.sort(function(a, b) {
      var hariA = parseInt((a.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      var hariB = parseInt((b.kategori || 'Hari 1').replace(/[^0-9]/g, ''), 10) || 0;
      if (hariA !== hariB) return hariA - hariB;
      return (a.urutan || 0) - (b.urutan || 0);
    });
    var hqIds = (halaqahRes.data||[]).map(function(h){ return h.id_halaqah; });
    var itemIds = indikator.map(function(i){ return i.id_item; });

    // MB10 fix (bug hunt 2026-08-27): new Date() device-local -> _todayJakarta().
    // Bandingkan sbg epoch UTC-midnight (pola sama dgn _hariIni()), bukan Date
    // object device-local -- device guru non-WIB bisa geser hariKe/status 1 hari.
    var todayMs    = new Date(_todayJakarta() + 'T00:00:00Z').getTime();
    var mulaiMs    = new Date((periode.tanggal_mulai   || '').slice(0, 10) + 'T00:00:00Z').getTime();
    var selesaiMs  = new Date((periode.tanggal_selesai || '').slice(0, 10) + 'T00:00:00Z').getTime();
    var hariKe = todayMs < mulaiMs ? 0 : todayMs > selesaiMs ? 8 : Math.floor((todayMs - mulaiMs) / 86400000) + 1;
    var statusDaurah = todayMs < mulaiMs ? 'belum' : todayMs > selesaiMs ? 'selesai' : 'berlangsung';

    // Data besar diambil TERFILTER (halaqah daurah + rentang tanggal periode)
    // dan berpaginasi via _selectAllPaged agar tidak terpotong batas 1000 baris PostgREST.
    var anggotaRows=[], kbmRows=[], nilaiRows=[], asmtRows=[];
    if (hqIds.length) {
      var big = await Promise.all([
        _selectAllPaged('anggota', 'id_murid, nama_murid, id_halaqah, users!anggota_id_murid_fkey(no_hp)',
          function(q){ return q.in('id_halaqah', hqIds).eq('status','aktif').order('id_murid').order('id_halaqah'); },
          'getMutabaahDaurah.anggota'),
        _selectAllPaged('kbm_log', 'id_kbm, id_halaqah, tanggal_pertemuan, pertemuan_ke, status',
          function(q){ return q.in('id_halaqah', hqIds).eq('status','selesai')
            .gte('tanggal_pertemuan', periode.tanggal_mulai).lte('tanggal_pertemuan', periode.tanggal_selesai)
            .order('id_kbm'); },
          'getMutabaahDaurah.kbm'),
        _selectAllPaged('nilai_kbm', 'id_nilai, id_murid, id_halaqah, id_kbm, status_hadir',
          function(q){ return q.in('id_halaqah', hqIds).order('id_nilai'); },
          'getMutabaahDaurah.nilai'),
        itemIds.length
          ? _selectAllPaged('assessment_murid', 'id_murid, id_item, status_guru',
              function(q){ return q.in('id_item', itemIds).order('id_murid').order('id_item'); },
              'getMutabaahDaurah.asmt')
          : Promise.resolve([]),
      ]);
      anggotaRows = big[0]; kbmRows = big[1]; nilaiRows = big[2]; asmtRows = big[3];
    }

    // Hanya nilai dari sesi KBM daurah (status selesai & dalam rentang periode)
    var kbmKeById = {};
    kbmRows.forEach(function(k){ kbmKeById[k.id_kbm] = k.pertemuan_ke || 0; });
    nilaiRows = nilaiRows.filter(function(n){ return Object.prototype.hasOwnProperty.call(kbmKeById, n.id_kbm); });

    var anggotaByHq={}, kbmByHq={}, nilaiByHqMurid={}, asmtByMuridItem={};
    anggotaRows.forEach(function(a){
      var aCopy = Object.assign({}, a, { no_hp: a.users && a.users.no_hp });
      delete aCopy.users;
      (anggotaByHq[a.id_halaqah]=anggotaByHq[a.id_halaqah]||[]).push(aCopy);
    });
    kbmRows.forEach(function(k){ (kbmByHq[k.id_halaqah]=kbmByHq[k.id_halaqah]||[]).push(k); });
    nilaiRows.forEach(function(n){
      var key=n.id_halaqah+'|'+n.id_murid;
      (nilaiByHqMurid[key]=nilaiByHqMurid[key]||[]).push(n);
    });
    asmtRows.forEach(function(s){ asmtByMuridItem[s.id_murid+'|'+s.id_item]=s.status_guru; });

    var halaqahList = (halaqahRes.data||[]).map(function(hq) {
      var muridList = (anggotaByHq[hq.id_halaqah]||[]);
      var sesiList  = (kbmByHq[hq.id_halaqah]||[]).sort(function(a,b){ return (a.pertemuan_ke||0)-(b.pertemuan_ke||0); });
      var sumHadir=0, sumTotal=0;
      var murid = muridList.map(function(m) {
        var nm = (nilaiByHqMurid[hq.id_halaqah+'|'+m.id_murid]||[]);
        var hadir = nm.filter(function(n){ return ['H','T'].includes(n.status_hadir); }).length;
        sumHadir+=hadir; sumTotal+=nm.length;
        var sesiStatus = {};
        nm.forEach(function(n){ var ke = kbmKeById[n.id_kbm]; if (ke) sesiStatus[ke] = n.status_hadir; });
        var tajwid = indikator.map(function(item){
          return { id_item:item.id_item, nama:item.nama_item, status:asmtByMuridItem[m.id_murid+'|'+item.id_item]||null };
        });
        var pahamCount=tajwid.filter(function(t){ return t.status==='paham'; }).length;
        return Object.assign({},m,{ hadir, sesiTotal:nm.length, pctHadir:nm.length>0?Math.round(hadir/nm.length*100):0, tajwid, pahamCount, sesiStatus });
      });
      var pctTajwidSum=0, pctTajwidCount=0;
      murid.forEach(function(m){ if(indikator.length>0){ pctTajwidSum+=m.pahamCount; pctTajwidCount+=indikator.length; } });
      return Object.assign({},hq,{
        murid, sesiList,
        sesiTerlaksana: sesiList.length,
        pctHadir: sumTotal>0?Math.round(sumHadir/sumTotal*100):0,
        pctTajwid: pctTajwidCount>0?Math.round(pctTajwidSum/pctTajwidCount*100):0,
      });
    });

    var totalPeserta=0, gSumHadir=0, gSumTotal=0, gSumPaham=0, gSumTajwid=0, totalSesi=0;
    halaqahList.forEach(function(h){
      totalPeserta+=h.murid.length; totalSesi+=h.sesiTerlaksana;
      h.murid.forEach(function(m){ gSumHadir+=m.hadir; gSumTotal+=m.sesiTotal; gSumPaham+=m.pahamCount; gSumTajwid+=indikator.length; });
    });

    var indikatorRanking = indikator.map(function(item){
      var paham=0,ragu=0,belum=0,total=0;
      halaqahList.forEach(function(h){ h.murid.forEach(function(m){
        var s=asmtByMuridItem[m.id_murid+'|'+item.id_item];
        if(s==='paham')paham++; else if(s==='ragu')ragu++; else if(s==='belum')belum++;
        if(s)total++;
      }); });
      return { id_item:item.id_item, nama:item.nama_item, paham,ragu,belum,total,
        pctPaham:total>0?Math.round(paham/total*100):null };
    }).sort(function(a,b){ return (a.pctPaham===null?-1:a.pctPaham)-(b.pctPaham===null?-1:b.pctPaham); });

    var muridAlert=[];
    halaqahList.forEach(function(h){ h.murid.forEach(function(m){
      var tajwidBelum=m.tajwid.filter(function(t){ return t.status==='belum'; }).length;
      var tajwidRagu =m.tajwid.filter(function(t){ return t.status==='ragu';  }).length;
      var lvl=(m.sesiTotal>0&&m.pctHadir<75)||tajwidBelum>=3?'kritis':((m.sesiTotal>0&&m.pctHadir<85)||tajwidRagu>=3)?'perhatian':null;
      if(lvl) muridAlert.push(Object.assign({},m,{
        nama_halaqah:h.nama_halaqah, nama_guru:h.nama_guru,
        tajwidBelum, tajwidRagu,
        indikatorLemah:m.tajwid.filter(function(t){ return t.status==='belum'||t.status==='ragu'; }).map(function(t){ return t.nama; }),
        level:lvl
      }));
    }); });
    muridAlert.sort(function(a,b){ return (a.level==='kritis'?0:1)-(b.level==='kritis'?0:1); });

    return { status:'ok', data:{
      periode, hariKe, statusDaurah,
      summary:{ totalPeserta, hariKe, totalSesi, avgHadir:gSumTotal>0?Math.round(gSumHadir/gSumTotal*100):0, avgTajwid:gSumTajwid>0?Math.round(gSumPaham/gSumTajwid*100):0 },
      halaqahList, indikatorRanking, indikator, muridAlert
    }};
  },
  getRekapAbsensi: async function(p) {
    var [levelsRes, queryAnggotaData] = await Promise.all([
      _sb.from('level').select('nama_level, id_level, jumlah_pertemuan'),
      (function() {
        var q = _sb.from('anggota').select('id_murid, nama_murid, id_halaqah, halaqah(nama_halaqah, level)').eq('status', 'aktif');
        if (p.id_halaqah) q = q.eq('id_halaqah', p.id_halaqah);
        return q.order('nama_murid');
      })()
    ]);
    var targetSesiMap = {};
    (levelsRes.data || []).forEach(function(l) {
      if (l.nama_level) targetSesiMap[l.nama_level] = l.jumlah_pertemuan;
      if (l.id_level) targetSesiMap[l.id_level] = l.jumlah_pertemuan;
    });
    var anggota = queryAnggotaData.data;
    var errAnggota = queryAnggotaData.error;
    _check(errAnggota, 'getRekapAbsensi.anggota');
    
    var nilaiList = [];
    
    // Fetch logs based on requested session type
    if (p.jenis_sesi === 'Kajian At-Tibyan') {
      // Fetch only from at_tibyan_log
      var queryAt = _sb.from('at_tibyan_log')
        .select('id_murid, status_hadir, id_halaqah');
      if (p.id_halaqah) {
        queryAt = queryAt.eq('id_halaqah', p.id_halaqah);
      }
      var { data: atList, error: errAt } = await queryAt;
      _check(errAt, 'getRekapAbsensi.at_tibyan_log');
      
      nilaiList = (atList || []).map(function(n) {
        return {
          id_murid: n.id_murid,
          status_hadir: n.status_hadir,
          jenis_sesi: 'Kajian At-Tibyan'
        };
      });
    } else if (p.jenis_sesi) {
      // Fetch specified session type from nilai_kbm (e.g. KBM Reguler, Micro Teaching)
      var queryNilai = _sb.from('nilai_kbm')
        .select('id_murid, status_hadir, jenis_sesi');
      if (p.id_halaqah) {
        queryNilai = queryNilai.eq('id_halaqah', p.id_halaqah);
      }
      queryNilai = queryNilai.eq('jenis_sesi', p.jenis_sesi);
      var { data: kbmList, error: errNilai } = await queryNilai;
      _check(errNilai, 'getRekapAbsensi.nilai');
      
      nilaiList = (kbmList || []).map(function(n) {
        return {
          id_murid: n.id_murid,
          status_hadir: n.status_hadir,
          jenis_sesi: n.jenis_sesi || 'KBM Reguler'
        };
      });
    } else {
      // Fetch all session types (Semua Jenis Sesi) - merge from both tables
      var queryNilai = _sb.from('nilai_kbm')
        .select('id_murid, status_hadir, jenis_sesi');
      if (p.id_halaqah) {
        queryNilai = queryNilai.eq('id_halaqah', p.id_halaqah);
      }
      var queryAt = _sb.from('at_tibyan_log')
        .select('id_murid, status_hadir, id_halaqah');
      if (p.id_halaqah) {
        queryAt = queryAt.eq('id_halaqah', p.id_halaqah);
      }
      
      var [resNilai, resAt] = await Promise.all([queryNilai, queryAt]);
      _check(resNilai.error, 'getRekapAbsensi.nilai');
      _check(resAt.error, 'getRekapAbsensi.at_tibyan_log');
      
      var kbmList = resNilai.data || [];
      var atList = resAt.data || [];
      
      nilaiList = kbmList.map(function(n) {
        return {
          id_murid: n.id_murid,
          status_hadir: n.status_hadir,
          jenis_sesi: n.jenis_sesi || 'KBM Reguler'
        };
      });
      atList.forEach(function(n) {
        nilaiList.push({
          id_murid: n.id_murid,
          status_hadir: n.status_hadir,
          jenis_sesi: 'Kajian At-Tibyan'
        });
      });
    }
    
    var list = (anggota || []).map(function(a) {
      var studentLogs = (nilaiList || []).filter(function(n) { return n.id_murid === a.id_murid; });
      var H = studentLogs.filter(function(n) { return n.status_hadir === 'H'; }).length;
      var T = studentLogs.filter(function(n) { return n.status_hadir === 'T'; }).length;
      var I = studentLogs.filter(function(n) { return n.status_hadir === 'I'; }).length;
      var A = studentLogs.filter(function(n) { return n.status_hadir === 'A'; }).length;
      var total = studentLogs.length;
      var scoreSum = H + (T * 0.7) + (I * 0.5);
      var pct_hadir = total > 0 ? Math.round((scoreSum / total) * 100) : 0;
      var targetSesi = (a.halaqah && targetSesiMap[a.halaqah.level]) || 40;
      var skor_dari_40 = Math.min(Math.round(scoreSum / targetSesi * 100), 100);
      return {
        id_murid: a.id_murid,
        nama_murid: a.nama_murid,
        id_halaqah: a.id_halaqah,
        nama_halaqah: a.halaqah ? a.halaqah.nama_halaqah : '—',
        H: H, T: T, I: I, A: A,
        total: total,
        pct_hadir: pct_hadir,
        skor_dari_40: skor_dari_40
      };
    });
    return { status: 'ok', data: list };
  },
  getLevelList: async function() { var {data,error}=await _sb.from('level').select('*').eq('status','aktif').order('urutan'); _check(error,'getLevelList'); return {status:'ok',data}; },
  saveLevel: async function(d) { var {data,error}=await _sb.from('level').upsert(d,{onConflict:'id_level'}).select(); _check(error,'saveLevel'); return {status:'ok',data}; },
  // Admin: kembalikan baris MENTAH (incl id_template & urutan) utk editor,
  // bukan versi guru yang sudah dikelompokkan per kategori.
  getTemplateKoreksi: async function() {
    var { data, error } = await _sb.from('template_koreksi')
      .select('id_template, kategori, teks, urutan').eq('status','aktif').order('urutan');
    _check(error, 'getTemplateKoreksi(admin)');
    return { status:'ok', flat: data || [] };
  },
  saveTemplateKoreksi: async function(d) {
    // L4: simpan atomik (nonaktif+upsert+insert dalam 1 transaksi) via RPC.
    // Tahan beda versi frontend (t.id maupun t.id_template).
    var templates = ((d && d.templates) || [])
      .filter(function(t){ return t.teks && String(t.teks).trim(); })
      .map(function(t){
        return {
          id_template: t.id || t.id_template || null,
          kategori   : String(t.kategori || 'Umum').trim(),
          teks       : String(t.teks).trim(),
        };
      });
    var rpc = await _sb.rpc('save_template_koreksi', { p_templates: templates });
    if (rpc.error) {
      // Fallback bila RPC belum ada di DB (patch_039 belum dijalankan).
      if (rpc.error.code === 'PGRST202' || /save_template_koreksi/i.test(rpc.error.message || '')) {
        return await _saveTemplateKoreksiLegacy(templates);
      }
      _check(rpc.error, 'saveTemplateKoreksi');
    }
    var written = Number(rpc.data || 0);
    if (templates.length > 0 && written === 0) {
      throw new Error('Template tidak tersimpan (0 baris ditulis ke DB). Kemungkinan sesi ini tidak punya hak admin (RLS admin_write_template). Coba logout lalu login ulang sebagai admin.');
    }
    return { status:'ok', written: written };
  },
  resetPassword: async function(id_user, new_password) {
    var token = sessionStorage.getItem('hq_token') || localStorage.getItem('hq_token');
    var res = await fetch(SUPABASE_URL + '/functions/v1/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ id_user: id_user, new_password: new_password }),
    });
    var data = await res.json();
    if (data.status === 'error') throw new Error(data.message);
    return data;
  },
  getAuditLog: async function() { var {data,error}=await _sb.from('audit_log').select('*').order('created_at',{ascending:false}).limit(100); _check(error,'getAuditLog'); return {status:'ok',data}; },
  getObservasiKBM: async function(p) {
    p = p || {};
    var { data, error } = await _sb.from('observasi_kbm')
      .select('*, halaqah(nama_halaqah, id_guru, nama_guru)')
      .order('created_at', { ascending: false });
    _check(error, 'getObservasiKBM');
    var list = data || [];
    list = list.map(function(r) {
      if (r.halaqah) {
        r.nama_halaqah = r.halaqah.nama_halaqah;
        r.id_guru = r.halaqah.id_guru;
        r.nama_guru = r.halaqah.nama_guru;
      }
      return r;
    });
    if (p.id_halaqah) {
      list = list.filter(function(r) { return r.id_halaqah === p.id_halaqah; });
    }
    if (p.id_guru) {
      list = list.filter(function(r) { return r.id_guru === p.id_guru; });
    }
    if (p.tgl_dari) {
      list = list.filter(function(r) { return r.tanggal >= p.tgl_dari; });
    }
    if (p.tgl_sampai) {
      list = list.filter(function(r) { return r.tanggal <= p.tgl_sampai; });
    }
    return { status: 'ok', data: list };
  },
  // ── SPP Metode Bayar ───────────────────────
  getMetodeBayar: async function() {
    var { data, error } = await _sb.from('spp_metode_bayar').select('*').eq('aktif',true).order('urutan');
    _check(error,'getMetodeBayar'); return { status:'ok', data: data||[] };
  },
  saveMetodeBayar: async function(d) {
    var { id, ...fields } = d;
    if (id) {
      var { error } = await _sb.from('spp_metode_bayar').update(fields).eq('id',id);
      _check(error,'saveMetodeBayar'); return { status:'ok' };
    }
    var { error } = await _sb.from('spp_metode_bayar').insert(fields);
    _check(error,'saveMetodeBayar'); return { status:'ok' };
  },
  deleteMetodeBayar: async function(id) {
    var { error } = await _sb.from('spp_metode_bayar').update({aktif:false}).eq('id',id);
    _check(error,'deleteMetodeBayar'); return { status:'ok' };
  },

  // ── SPP Admin ──────────────────────────────
  getSPPPending: async function() {
    var { data, error } = await _sb.from('spp_pembayaran').select('*').eq('status','menunggu').order('created_at',{ascending:false});
    _check(error,'getSPPPending');
    // M1: sembunyikan reservasi gateway yang sudah kedaluwarsa (invoice tak
    // jadi dibayar) — itu bukan pengajuan manual yang perlu divalidasi admin.
    // Pengajuan manual & invoice gateway yang masih berlaku tetap tampil.
    var rows = (data||[]).filter(function(r){ return !_sppGatewayExpired(r); });
    return { status:'ok', data: rows };
  },
  validasiSPP: async function(id_spp, aksi) {
    // Ambil data SPP dulu untuk push ke murid
    var { data: sppRow } = await _sb.from('spp_pembayaran').select('id_murid, bulan, tahun').eq('id_spp', id_spp).single();
    // Guard: hanya boleh validasi pengajuan yang masih 'menunggu' — cegah validasi ganda
    // (mis. dua admin klik tombol bersamaan, atau klik berulang) yang bisa menimpa
    // validated_by/validated_at dan mengirim notifikasi duplikat ke murid.
    var updateFields = {
      status: aksi, validated_by: _uid(), validated_at: new Date().toISOString(),
    };
    if (aksi === 'lunas') {
      updateFields.tanggal_bayar = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    }
    var { data: updRows, error } = await _sb.from('spp_pembayaran').update(updateFields)
      .eq('id_spp', id_spp).eq('status','menunggu').select('id_spp');
    _check(error,'validasiSPP');
    if (!updRows || !updRows.length) {
      return { status:'error', message:'Pengajuan ini sudah divalidasi sebelumnya.' };
    }
    _logAudit('validasi_spp', {id_spp: id_spp, aksi: aksi, id_murid: sppRow && sppRow.id_murid});
    // Push ke murid yang bersangkutan
    if (sppRow && sppRow.id_murid) {
      var isLunas = aksi === 'lunas';
      _sendPushBg({
        user_ids: [sppRow.id_murid],
        title: isLunas ? '✅ Pembayaran SPP Diterima!' : '❌ Konfirmasi SPP Ditolak',
        body : isLunas
          ? 'SPP ' + (sppRow.bulan || '') + ' ' + (sppRow.tahun || '') + ' sudah terverifikasi. Jazakallahu khairan!'
          : 'Konfirmasi SPP ' + (sppRow.bulan || '') + ' ditolak admin. Silakan hubungi admin untuk info lebih lanjut.',
        url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
        tag  : 'spp-validasi-' + id_spp,
        data : { trigger: isLunas ? 'spp_lunas' : 'spp_ditolak' },
      });
    }
    return { status:'ok' };
  },

  // ── Input SPP Manual oleh Admin ────────────────────────────
  // Ambil status SPP per bulan untuk murid tertentu (dipakai modal input manual)
  getSPPStatusMurid: async function(id_murid, tahun) {
    var t = tahun || new Date().getFullYear();
    var { data, error } = await _sb.from('spp_pembayaran').select('bulan, status, jenis')
      .eq('id_murid', id_murid).eq('tahun', t);
    _check(error, 'getSPPStatusMurid');
    var lunas = []; var menunggu = [];
    (data||[]).forEach(function(r) {
      if (r.jenis && r.jenis !== 'SPP Pribadi') return;
      if (r.status === 'lunas') lunas.push(r.bulan);
      else if (r.status === 'menunggu') menunggu.push(r.bulan);
    });
    return { status:'ok', data: { lunas: lunas, menunggu: menunggu } };
  },

  getIhsanStatusGuru: async function(id_guru, tahun) {
    var t = tahun || new Date().getFullYear();
    var { data, error } = await _sb.from('spp_pembayaran').select('bulan, status')
      .eq('id_murid', id_guru).eq('tahun', t).eq('jenis', 'Ihsan Guru');
    _check(error, 'getIhsanStatusGuru');
    var lunas = [];
    (data||[]).forEach(function(r) {
      if (r.status === 'lunas') lunas.push(r.bulan);
    });
    return { status:'ok', data: { lunas: lunas } };
  },

  // Input pembayaran SPP langsung oleh admin (tanpa murid konfirmasi)
  // d: { id_murid, bulan (array), tahun, jenis, nominal, catatan }
  inputSPPManual: async function(d) {
    var id_murid = d.id_murid;
    if (!id_murid) throw new Error('Murid belum dipilih.');
    var bulanList = Array.isArray(d.bulan) ? d.bulan : [d.bulan];
    if (!bulanList.length) throw new Error('Pilih minimal 1 bulan.');
    if (!(Number(d.nominal) > 0)) throw new Error('Nominal harus lebih dari 0.');
    var tahun = Number(d.tahun) || new Date().getFullYear();
    var jenis = d.jenis || 'SPP Pribadi';

    // Ambil data anggota untuk denormalisasi
    var { data: anggota } = await _sb.from('anggota').select('nama_murid, id_halaqah')
      .eq('id_murid', id_murid).eq('status', 'aktif').maybeSingle();
    var nama_murid = (anggota && anggota.nama_murid) || '';
    var id_halaqah = (anggota && anggota.id_halaqah) || '';
    // id_periode SPP Pribadi & Infaq: diisi otomatis oleh trigger DB dari
    // periode halaqah (patch_101). Ihsan Guru tak punya halaqah → dari form.
    var id_periode = (jenis === 'Ihsan Guru') ? (d.id_periode || null) : null;

    // Jika nama_murid kosong, fallback ke tabel users
    if (!nama_murid) {
      var { data: usr } = await _sb.from('users').select('nama_lengkap').eq('id_user', id_murid).maybeSingle();
      nama_murid = (usr && usr.nama_lengkap) || '';
    }

    // Generate id_spp IDENTIK dengan format MuridAPI.konfirmasiSPP
    var jenisSuffix = jenis.replace(/\s+/g,'').substring(0,3).toUpperCase();
    var idSppMap = {};
    bulanList.forEach(function(bulan) {
      var id = 'SPP-' + id_murid + '-' + bulan.substring(0,3).toUpperCase() + '-' + tahun + '-' + jenisSuffix;
      if (jenis === 'Infaq/Operasional' || jenis === 'Ihsan Guru') {
        id += '-' + Math.random().toString(36).substring(2,10).toUpperCase();
      }
      idSppMap[bulan] = id;
    });

    // Cek bulan yang sudah lunas — skip (untuk SPP Pribadi saja, untuk Infaq & Ihsan Guru tidak skip karena bisa multi-payment)
    var bulanProses = bulanList;
    if (jenis === 'SPP Pribadi') {
      var idSppList = Object.values(idSppMap);
      var { data: existingRows } = await _sb.from('spp_pembayaran')
        .select('id_spp, status').in('id_spp', idSppList);
      var sudahLunasSet = new Set(
        (existingRows || []).filter(function(r){ return r.status === 'lunas'; }).map(function(r){ return r.id_spp; })
      );
      bulanProses = bulanList.filter(function(bulan) {
        return !sudahLunasSet.has(idSppMap[bulan]);
      });
    }
    
    if (!bulanProses.length) {
      return { status: 'ok', message: 'Semua bulan yang dipilih sudah lunas sebelumnya.', count: 0 };
    }

    var now = new Date();
    var todayWIB = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    // Split multi-bulan: floor tiap bulan, sisa pembulatan ke bulan TERAKHIR
    // supaya Σ potongan == total persis (bug presisi P6 — dulu Math.round bisa
    // kehilangan s/d Rp (n−1) per transaksi).
    var _totalNom = Number(d.nominal || 0);
    var _nBulan   = bulanProses.length;
    var _baseNom  = _nBulan > 1 ? Math.floor(_totalNom / _nBulan) : _totalNom;

    var rows = bulanProses.map(function(bulan, _idx) {
      var nominalPerBulan = (_nBulan > 1 && _idx === _nBulan - 1)
        ? _totalNom - _baseNom * (_nBulan - 1)
        : _baseNom;
      var _row = {
        id_spp       : idSppMap[bulan],
        id_murid     : id_murid,
        nama_murid   : nama_murid,
        id_halaqah   : id_halaqah,
        bulan        : bulan,
        tahun        : tahun,
        jenis        : jenis,
        status       : 'lunas',
        nominal      : nominalPerBulan,
        metode_bayar : 'admin_manual',
        metode_transfer: null,
        bukti_url    : null,
        catatan      : d.catatan || 'Input manual oleh admin',
        tanggal_bayar: todayWIB,
        validated_by : _uid(),
        validated_at : now.toISOString(),
        mayar_expired_at  : null,
        mayar_invoice_id  : null,
        mayar_payment_link: null,
      };
      // Hanya kirim id_periode bila ada (Ihsan Guru dari form). SPP/Infaq
      // dibiarkan trigger DB yang isi dari halaqah → aman walau patch_101
      // belum jalan (kolom belum ada).
      if (id_periode) _row.id_periode = id_periode;
      return _row;
    });

    var { error } = await _sb.from('spp_pembayaran').upsert(rows, { onConflict: 'id_spp' });
    _check(error, 'inputSPPManual');

    _logAudit('input_spp_manual', {
      id_murid: id_murid, nama_murid: nama_murid,
      bulan: bulanProses, tahun: tahun, jenis: jenis,
      nominal: d.nominal, count: bulanProses.length,
    });

    // Push notification ke murid (HANYA untuk SPP Pribadi / Infaq, Guru tidak mendapat notifikasi)
    if (id_murid && jenis !== 'Ihsan Guru') {
      var bulanLabel = bulanProses.length > 1
        ? bulanProses.length + ' bulan'
        : bulanProses[0] + ' ' + tahun;
      _sendPushBg({
        user_ids: [id_murid],
        title: '✅ SPP Dicatat Lunas oleh Admin',
        body : 'Pembayaran ' + (jenis === 'SPP Pribadi' ? 'SPP ' : 'Infaq ') + bulanLabel + ' sudah dicatat lunas. Jazakallahu khairan!',
        url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
        tag  : 'spp-admin-manual-' + id_murid + '-' + tahun,
        data : { trigger: 'spp_lunas' },
      });
    }

    return { status:'ok', message: bulanProses.length + ' bulan berhasil dicatat lunas.', count: bulanProses.length };
  },

  // Riwayat konfirmasi terbaru (manual maupun otomatis via gateway) — untuk
  // menemukan & membatalkan salah konfirmasi tanpa perlu SQL manual.
  getSPPRecentValidasi: async function() {
    var { data: manual, error: e1 } = await _sb.from('spp_pembayaran')
      .select('*').not('validated_by','is',null)
      .order('validated_at',{ascending:false}).limit(10);
    _check(e1,'getSPPRecentValidasi');
    var { data: gateway, error: e2 } = await _sb.from('spp_pembayaran')
      .select('*').eq('metode_bayar','gateway').eq('status','lunas').is('validated_by',null)
      .order('tanggal_bayar',{ascending:false}).limit(10);
    _check(e2,'getSPPRecentValidasi');
    var all = (manual||[]).concat(gateway||[]);
    all.forEach(function(r) {
      r._when = r.validated_at || (r.tanggal_bayar ? r.tanggal_bayar + 'T00:00:00Z' : r.created_at);
    });
    all.sort(function(a,b) { return new Date(b._when) - new Date(a._when); });
    return { status:'ok', data: all.slice(0,10) };
  },
  // Batalkan konfirmasi/penolakan yang salah — kembalikan ke 'menunggu'
  // supaya bisa dikonfirmasi ulang dengan benar (tanpa SQL manual).
  batalkanValidasiSPP: async function(id_spp) {
    var { data: sppRow } = await _sb.from('spp_pembayaran').select('id_murid, bulan, tahun, status').eq('id_spp', id_spp).maybeSingle();
    if (!sppRow || (sppRow.status !== 'lunas' && sppRow.status !== 'ditolak')) {
      return { status:'error', message:'Status saat ini tidak bisa dibatalkan.' };
    }
    var { data: updRows, error } = await _sb.from('spp_pembayaran').update({
      status: 'menunggu', validated_by: null, validated_at: null, tanggal_bayar: null,
      mayar_expired_at: null, metode_bayar: 'manual',
    }).eq('id_spp', id_spp).in('status', ['lunas','ditolak']).select('id_spp');
    _check(error,'batalkanValidasiSPP');
    if (!updRows || !updRows.length) {
      return { status:'error', message:'Status sudah berubah, gagal membatalkan.' };
    }
    _logAudit('batal_validasi_spp', {id_spp: id_spp, status_sebelumnya: sppRow.status, id_murid: sppRow.id_murid});
    return { status:'ok' };
  },

  // ── Kelola Transaksi (Fase 3) — edit / hapus / pindah periode per baris ──
  updateSPPRow: async function(id_spp, fields) {
    var _J = ['SPP Pribadi', 'Infaq/Operasional', 'Ihsan Guru'];
    var _S = ['lunas', 'menunggu', 'ditolak'];
    var _B = _BULAN_KEU.concat(['-']);
    if (!id_spp) throw new Error('id_spp wajib.');
    var { data: before } = await _sb.from('spp_pembayaran').select('*').eq('id_spp', id_spp).maybeSingle();
    if (!before) throw new Error('Baris tak ditemukan (mungkin sudah dihapus).');
    var d = fields || {};
    var u = {};
    if (d.bulan   !== undefined) { if (_B.indexOf(d.bulan) < 0) throw new Error('Bulan tak valid.'); u.bulan = d.bulan; }
    // '-' hanya sah utk Infaq/Operasional (kolom bulan memang '-' sejak patch_052).
    var _jefektif = (d.jenis !== undefined) ? d.jenis : before.jenis;
    if (u.bulan === '-' && _jefektif !== 'Infaq/Operasional') throw new Error('Bulan wajib dipilih utk ' + _jefektif + '.');
    if (d.tahun   !== undefined) { var t = Number(d.tahun); if (!(t >= 2020 && t <= 2100)) throw new Error('Tahun tak valid.'); u.tahun = t; }
    if (d.jenis   !== undefined) { if (_J.indexOf(d.jenis) < 0) throw new Error('Jenis tak valid.'); u.jenis = d.jenis; }
    if (d.status  !== undefined) { if (_S.indexOf(d.status) < 0) throw new Error('Status tak valid.'); u.status = d.status; }
    if (d.nominal !== undefined) { var n = Number(d.nominal); if (!(n >= 0)) throw new Error('Nominal tak boleh negatif.'); u.nominal = Math.round(n); }
    if (d.catatan       !== undefined) u.catatan = d.catatan || null;
    if (d.tanggal_bayar !== undefined) u.tanggal_bayar = d.tanggal_bayar || null;
    if (d.id_halaqah    !== undefined) u.id_halaqah = d.id_halaqah || '';
    // id_periode: nilai eksplisit, atau 'from_halaqah' → ikut periode halaqah baris.
    if (d.id_periode === 'from_halaqah') {
      var hqId = (u.id_halaqah !== undefined) ? u.id_halaqah : before.id_halaqah;
      if (hqId) {
        var { data: hq } = await _sb.from('halaqah').select('id_periode').eq('id_halaqah', hqId).maybeSingle();
        u.id_periode = (hq && hq.id_periode) || null;
      } else u.id_periode = null;
    } else if (d.id_periode !== undefined) {
      u.id_periode = d.id_periode || null;
    }
    if (!Object.keys(u).length) return { status:'ok', message:'Tidak ada perubahan.' };
    var { error } = await _sb.from('spp_pembayaran').update(u).eq('id_spp', id_spp);
    if (error && (error.code === '23505' || /duplicate|unique/i.test(error.message||'')))
      throw new Error('Sudah ada transaksi ' + (u.jenis || before.jenis) + ' untuk murid ini di bulan/tahun tsb.');
    _check(error, 'updateSPPRow');
    var chg = {};
    Object.keys(u).forEach(function(k){ if (String(before[k] == null ? '' : before[k]) !== String(u[k] == null ? '' : u[k])) chg[k] = { dari: before[k], jadi: u[k] }; });
    _logAudit('update_spp_row', { id_spp: id_spp, id_murid: before.id_murid, jenis: before.jenis, perubahan: chg });
    return { status:'ok', changed: Object.keys(chg) };
  },

  deleteSPPRow: async function(id_spp) {
    if (!id_spp) throw new Error('id_spp wajib.');
    var { data: snap } = await _sb.from('spp_pembayaran').select('*').eq('id_spp', id_spp).maybeSingle();
    if (!snap) throw new Error('Baris tak ditemukan.');
    var { error } = await _sb.from('spp_pembayaran').delete().eq('id_spp', id_spp);
    _check(error, 'deleteSPPRow');
    _logAudit('delete_spp_row', { id_spp: id_spp, id_murid: snap.id_murid, jenis: snap.jenis,
      bulan: snap.bulan, tahun: snap.tahun, nominal: snap.nominal, status: snap.status, id_periode: snap.id_periode });
    return { status:'ok' };
  },

  // Tandai periode utk banyak baris sekaligus (spp_pembayaran / operasional / kas).
  //  id_periode : '<id>' | '' (kosongkan) | 'from_halaqah' (khusus spp_pembayaran)
  bulkAssignPeriode: async function(d) {
    var table = d.table || 'spp_pembayaran';
    if (['spp_pembayaran','operasional','kas'].indexOf(table) < 0) throw new Error('Tabel tak dikenal.');
    var pkCol = table === 'operasional' ? 'id_operasional' : (table === 'kas' ? 'id_kas' : 'id_spp');
    var ids = (d.ids || []).filter(Boolean);
    if (!ids.length) throw new Error('Pilih minimal 1 baris.');
    var updated = 0;
    if (d.id_periode === 'from_halaqah') {
      if (table !== 'spp_pembayaran') throw new Error("'from_halaqah' hanya untuk transaksi SPP.");
      var rows = await _selectAllPaged(table, 'id_spp, id_halaqah',
        function(q){ return q.in('id_spp', ids).order('id_spp'); }, 'bulkAssignPeriode:rows');
      var hqSet = {};
      (rows || []).forEach(function(r){ if (r.id_halaqah) hqSet[r.id_halaqah] = true; });
      var hqIds = Object.keys(hqSet);
      var hqPer = {};
      if (hqIds.length) {
        var { data: hqs } = await _sb.from('halaqah').select('id_halaqah, id_periode').in('id_halaqah', hqIds);
        (hqs || []).forEach(function(h){ hqPer[h.id_halaqah] = h.id_periode || null; });
      }
      // Kelompokkan id_spp per periode target lalu update per grup.
      var byPer = {};
      (rows || []).forEach(function(r){
        var per = r.id_halaqah ? (hqPer[r.id_halaqah] || null) : null;
        (byPer[per || ''] = byPer[per || ''] || []).push(r.id_spp);
      });
      for (var key in byPer) {
        var per = key || null;
        var { error: eG } = await _sb.from(table).update({ id_periode: per }).in('id_spp', byPer[key]);
        _check(eG, 'bulkAssignPeriode:grup');
        if (per) updated += byPer[key].length;
      }
    } else {
      var per2 = d.id_periode || null;
      var { error: e1 } = await _sb.from(table).update({ id_periode: per2 }).in(pkCol, ids);
      _check(e1, 'bulkAssignPeriode');
      updated = ids.length;
    }
    _logAudit('bulk_assign_periode', { table: table, count: ids.length, id_periode: d.id_periode, updated: updated });
    return { status:'ok', updated: updated };
  },

  // Panel Rekonsiliasi (Fase 4): buktikan Σ(per periode) + TanpaPeriode = Total
  // untuk tiap metrik & tahun. Partisi eksak lewat kolom id_periode.
  getRekonsiliasiSPP: async function(p) {
    var isSemua = !!(p && String(p.tahun) === 'semua');
    var tahun = (p && p.tahun && !isSemua) ? Number(p.tahun) : new Date().getFullYear();
    var spp = await _selectAllPaged('spp_pembayaran', 'jenis, nominal, id_periode',
      function(q){ q = q.eq('status','lunas'); if (!isSemua) q = q.eq('tahun', tahun); return q.order('id_spp'); }, 'rekonsiliasi:spp');
    var op = await _selectAllPaged('operasional', 'nominal, id_periode',
      function(q){ if (!isSemua) q = q.eq('tahun', tahun); return q.order('id_operasional'); }, 'rekonsiliasi:op');
    var kas = await _selectAllPaged('kas', 'nominal, arah, id_periode',
      function(q){ if (!isSemua) q = q.gte('tanggal', tahun+'-01-01').lt('tanggal', (tahun+1)+'-01-01'); return q.order('id_kas'); }, 'rekonsiliasi:kas');
    var per = await _sb.from('periode').select('id_periode, nama_periode').order('created_at', { ascending: true });
    var periodeList = (per.data || []).map(function(x){ return { id: x.id_periode, nama: x.nama_periode }; });

    function agg(rows, valFn, keyFn) {
      var m = { _tanpa: 0, _total: 0 };
      periodeList.forEach(function(pp){ m[pp.id] = 0; });
      (rows || []).forEach(function(r){
        if (keyFn && !keyFn(r)) return;
        var v = Number(valFn(r) || 0);
        m._total += v;
        var k = r.id_periode;
        if (k && m[k] !== undefined) m[k] += v;
        else if (k && m[k] === undefined) { m[k] = v; }  // periode dihapus tapi baris masih menunjuk
        else m._tanpa += v;
      });
      return m;
    }
    function row(label, key, m) {
      var sigma = periodeList.reduce(function(s,pp){ return s + (m[pp.id]||0); }, 0);
      // periode "hantu" (id tak ada di daftar)
      var ghost = 0;
      Object.keys(m).forEach(function(k){ if (k[0] !== '_' && !periodeList.some(function(pp){return pp.id===k;})) ghost += m[k]; });
      sigma += ghost;
      return { key: key, label: label, per: m, tanpa: m._tanpa, sigma_periode: sigma, total: m._total,
               cocok: Math.abs((sigma + m._tanpa) - m._total) < 1 };
    }

    var isSPP = function(r){ var j = r.jenis || 'SPP Pribadi'; return j === 'SPP Pribadi'; };
    var metrik = [
      row('SPP Pribadi (masuk)', 'spp',   agg(spp, function(r){return r.nominal;}, isSPP)),
      row('Infaq (masuk)',       'infaq', agg(spp, function(r){return r.nominal;}, function(r){ return r.jenis === 'Infaq/Operasional'; })),
      row('Ihsan Guru (keluar)', 'ihsan', agg(spp, function(r){return r.nominal;}, function(r){ return r.jenis === 'Ihsan Guru'; })),
      row('Operasional (keluar)','operasional', agg(op, function(r){return r.nominal;})),
      row('Kas lain (masuk)',    'kas_masuk',  agg(kas, function(r){return r.nominal;}, function(r){ return r.arah === 'masuk'; })),
      row('Kas lain (keluar)',   'kas_keluar', agg(kas, function(r){return r.nominal;}, function(r){ return r.arah === 'keluar'; })),
    ];

    // ── "Gigi": bandingkan Total tiap metrik dgn angka yg tampil di KARTU
    // (getSPPRekap = sumber yg dibaca bendahara). Kalau dua jalur fetch beda
    // → cocok=false (bukan cuma cek partisi vs dirinya sendiri yg selalu benar).
    var cardRef = null;
    try {
      var cr = await this.getSPPRekap({ tahun: isSemua ? 'semua' : tahun });
      var cd = (cr && cr.data) || {};
      var _keu = cd.keuangan || { pemasukan:{}, pengeluaran:{} };
      cardRef = {
        spp:         Number(cd.total_nominal || 0),
        infaq:       Number(cd.total_infaq || 0),
        ihsan:       Number(cd.total_ihsan || 0),
        operasional: Number((_keu.pengeluaran && _keu.pengeluaran.operasional) || 0),
        kas_masuk:   Number((_keu.pemasukan && _keu.pemasukan.kas_lain) || 0),
        kas_keluar:  Number((_keu.pengeluaran && _keu.pengeluaran.kas_lain) || 0),
      };
    } catch (eCard) { cardRef = null; }
    metrik.forEach(function(m){
      if (cardRef && cardRef[m.key] !== undefined) {
        m.total_kartu = cardRef[m.key];
        // ✓ hanya bila: (a) Σ per-periode + tanpa == total hasil fetch rekon, DAN
        //               (b) total fetch rekon == total kartu (dua jalur setuju).
        m.cocok = Math.abs((m.sigma_periode + m.tanpa) - m.total) < 1
               && Math.abs(m.total - m.total_kartu) < 1;
      } else {
        m.total_kartu = m.total;  // acuan kartu tak tersedia → tampilkan apa adanya
      }
    });

    return { status:'ok', data: { tahun: tahun, semua_tahun: isSemua, acuan_kartu: !!cardRef,
      periode: periodeList, metrik: metrik,
      semua_cocok: metrik.every(function(m){ return m.cocok; }) } };
  },

  getSPPRekap: async function(p) {
    p = p || {};
    // p: { tahun ('semua'|N), id_periode ('<id>'|'__tanpa__'|undefined), id_halaqah, bulan }
    var pInfo   = (p.id_periode && p.id_periode !== _PERIODE_SENTINEL_NONE) ? await _resolvePeriode(p.id_periode) : null;
    var isTanpa = p.id_periode === _PERIODE_SENTINEL_NONE;
    var tahunSpesifik = (p.tahun && String(p.tahun) !== 'semua') ? Number(p.tahun) : null;
    var isSemuaTahun  = String(p.tahun) === 'semua';
    var tahun = tahunSpesifik || new Date().getFullYear();
    // Tunggakan/lunas/menunggak tak bermakna lintas tahun tanpa batas periode →
    // dimatikan utk kombo "Seluruh Periode + Semua Tahun".
    var tunggakanDisabled = isSemuaTahun && !pInfo;

    // Ambil SEMUA pembayaran lunas dalam scope (SPP Pribadi + Infaq + Ihsan Guru).
    // WAJIB paginasi (bug presisi P1). Scope: periode (id_periode) / tanpa periode /
    // per tahun kalender (mode "Seluruh Periode").
    var sppData = await _selectAllPaged('spp_pembayaran', '*', function(q) {
      q = q.eq('status', 'lunas');
      if (pInfo)        q = q.eq('id_periode', pInfo.id_periode);
      else if (isTanpa) q = q.is('id_periode', null);
      if (tahunSpesifik)                             q = q.eq('tahun', tahunSpesifik);
      else if (!pInfo && !isTanpa && !isSemuaTahun)  q = q.eq('tahun', tahun);
      if (p.bulan) q = q.eq('bulan', p.bulan);
      return q.order('id_spp');
    }, 'getSPPRekap');

    // Saring berdasarkan id_halaqah di memori agar Ihsan Guru tidak ikut tersaring keluar
    var sppFiltered = sppData || [];
    if (p.id_halaqah) {
      sppFiltered = sppFiltered.filter(function(s) {
        return s.id_halaqah === p.id_halaqah || s.jenis === 'Ihsan Guru';
      });
    }

    // Filter berdasarkan jenis pembayaran
    var sppPribadi = sppFiltered.filter(function(s){ return s.jenis === 'SPP Pribadi' || !s.jenis; });
    var infaqData = sppFiltered.filter(function(s){ return s.jenis === 'Infaq/Operasional'; });
    var ihsanData = sppFiltered.filter(function(s){ return s.jenis === 'Ihsan Guru'; });

    // Roster untuk cross-check tunggakan — HANYA anggota aktif di semua mode
    // (alumni tak lagi masuk hitungan lunas/menunggak). Mode periode dibatasi
    // ke halaqah milik periode tsb.
    var anggotaQ = _sb.from('anggota').select('id_murid, nama_murid, id_halaqah, level, tipe_spp, status, halaqah(nama_halaqah, id_guru)');
    if (pInfo) {
      anggotaQ = pInfo.halaqahIds.length
        ? anggotaQ.in('id_halaqah', pInfo.halaqahIds).eq('status','aktif')
        : anggotaQ.eq('id_halaqah', ' none'); // periode tanpa halaqah → roster kosong
    } else if (p.id_halaqah) {
      anggotaQ = anggotaQ.eq('id_halaqah', p.id_halaqah).eq('status','aktif');
    } else {
      anggotaQ = anggotaQ.eq('status','aktif');
    }
    var { data: anggota } = await anggotaQ;
    // Ambil no_hp terpisah untuk hindari FK join error
    var muridIds = (anggota||[]).map(function(a){ return a.id_murid; });
    var hpMap = {};
    if (muridIds.length) {
      var { data: usersHp } = await _sb.from('users').select('id_user, no_hp').in('id_user', muridIds);
      (usersHp||[]).forEach(function(u){ hpMap[u.id_user] = u.no_hp; });
    }
    var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var TOTAL_REKAP   = 12;
    var WINDOW_SIZE   = 5; // 1 level SPP = 5 pembayaran (hitungan via _sppLevelInfo, samakan dgn api-murid)
    // Bulan terakhir yang sudah selesai (getMonth() tanpa +1: Juni=5 → Jan-Mei sudah lewat)
    var bulanSelesai  = new Date().getMonth(); // 0-indexed, eksklusif — hanya utk daftar "bulan belum" (bukan hitungan)
    var startIdx = Math.max(0, bulanSelesai - TOTAL_REKAP);
    var endIdx   = bulanSelesai;
    var bulanRekapDefault = BULAN.slice(startIdx, endIdx);

    // ── Tunggakan SPP: model LEVEL 5-bulan (helper bersama _sppLevelInfo) ──
    // 1 level = 5 pembayaran. lunasCount = jumlah bulan DISTINCT (tahun,bulan)
    // berstatus lunas, jenis SPP Pribadi, SELURUH riwayat murid (LEPAS dari
    // filter periode & tahun). tunggakan = sisa kewajiban level berjalan
    // (Interpretasi A). Rumus IDENTIK dgn portal murid (api-murid getSPPStatus)
    // supaya dua portal tak pernah beda angka. Lihat memori spp-progress-per-level.
    // p.bulan hanya dipakai loadKasBeasiswa (butuh field beasiswa_*, bukan
    // murid_list) → lewati fetch yg mahal.
    var _skipTunggakan = tunggakanDisabled || !!p.bulan;
    var lunasSetMap = {};   // id_murid → { "tahun-bulan": namaBulan }  distinct, lintas tahun
    if (muridIds.length && !_skipTunggakan) {
      var allSppRows = await _selectAllPaged('spp_pembayaran', 'id_spp, id_murid, bulan, tahun, jenis, status',
        function(q){ return q.in('id_murid', muridIds).eq('status','lunas').order('id_spp'); },
        'getSPPRekap:allSppRows');
      (allSppRows||[]).forEach(function(r){
        if (r.jenis && r.jenis !== 'SPP Pribadi') return;
        if (BULAN.indexOf(r.bulan) < 0) return; // buang bulan '-' / tak dikenal
        (lunasSetMap[r.id_murid] = lunasSetMap[r.id_murid] || {})[r.tahun + '-' + r.bulan] = r.bulan;
      });
    }

    // Peserta Daurah Al-Fatihah (NIS prefix FTH) TIDAK dikenai SPP Pribadi —
    // keluarkan dari daftar & hitungan lunas/menunggak. Infaq Daurah mereka tetap
    // tercatat lewat infaqData (langsung dari spp_pembayaran) & anggotaMap.
    var isDaurahFth = function(id){ return !!(id && String(id).toUpperCase().startsWith('FTH')); };
    var anggotaSPP = (anggota||[]).filter(function(a){ return !isDaurahFth(a.id_murid); });
    var muridListRaw = anggotaSPP.map(function(a) {
      var _set   = lunasSetMap[a.id_murid] || {};
      var _keys  = Object.keys(_set);                   // "tahun-bulan" distinct
      var lunasBulan = _keys.map(function(k){ return _set[k]; })
                            .filter(function(b,i,arr){ return arr.indexOf(b) === i; }); // nama bulan distinct
      var _lvl   = _sppLevelInfo(_keys.length);
      var isBeasiswa = a.tipe_spp === 'beasiswa';
      var tunggakan, winLen, levelSelesai, progressLevel;
      if (_skipTunggakan) {
        return {
          id_murid: a.id_murid, nama_murid: a.nama_murid, id_halaqah: a.id_halaqah,
          nama_halaqah: a.halaqah && a.halaqah.nama_halaqah || '', level: a.level,
          no_hp: hpMap[a.id_murid] || '', lunas_bulan: lunasBulan,
          tunggakan: 0, _winLen: 0, is_beasiswa: isBeasiswa,
          level_selesai: 0, progress_level: 0,
        };
      }
      if (isBeasiswa) {
        // Murid beasiswa: SPP Pribadi dibebaskan → tak pernah nunggak.
        // Dikeluarkan dari hitungan lunas/menunggak (kategori terpisah, lihat bawah).
        tunggakan = 0; winLen = 0; levelSelesai = 0; progressLevel = 0;
      } else {
        tunggakan     = _lvl.tunggakan;
        winLen        = WINDOW_SIZE;
        levelSelesai  = _lvl.level_selesai;
        progressLevel = _lvl.progress_level;
      }
      return {
        id_murid: a.id_murid, nama_murid: a.nama_murid,
        id_halaqah: a.id_halaqah, nama_halaqah: a.halaqah && a.halaqah.nama_halaqah || '',
        level: a.level, no_hp: hpMap[a.id_murid] || '',
        // bulan_belum dipensiunkan (2ae457f): model count-based tak petakan bulan
        // kalender → FE tampil "N bulan belum lunas" dari `tunggakan`. Field dihapus.
        lunas_bulan: lunasBulan, tunggakan,
        _winLen: winLen, is_beasiswa: isBeasiswa,
        level_selesai: levelSelesai, progress_level: progressLevel,
      };
    }).sort(function(a,b){ return b.tunggakan - a.tunggakan || a.nama_murid.localeCompare(b.nama_murid); });

    // Map id_murid → info halaqah/level (untuk daftar Infaq)
    var anggotaMap = {};
    (anggota||[]).forEach(function(a){
      anggotaMap[a.id_murid] = { nama_halaqah: a.halaqah && a.halaqah.nama_halaqah || '', id_halaqah: a.id_halaqah, level: a.level };
    });
    // Daftar pembayaran Infaq/Operasional (per transaksi, untuk Rekap Pembayaran + Kelola)
    var infaqList = infaqData.map(function(r){
      var info = anggotaMap[r.id_murid] || {};
      return {
        id_spp: r.id_spp, id_murid: r.id_murid, nama_murid: r.nama_murid,
        id_halaqah: r.id_halaqah || info.id_halaqah || '', nama_halaqah: info.nama_halaqah || '',
        level: info.level || '', bulan: r.bulan, tahun: r.tahun,
        nominal: r.nominal, tanggal_bayar: r.tanggal_bayar, metode_bayar: r.metode_bayar,
        id_periode: r.id_periode || null, status: r.status || 'lunas', catatan: r.catatan || '',
      };
    }).sort(function(a,b){ return (b.tanggal_bayar||'').localeCompare(a.tanggal_bayar||'') || a.nama_murid.localeCompare(b.nama_murid); });

    // Daftar pembayaran SPP Pribadi per transaksi (untuk Kelola Transaksi)
    var sppList = sppPribadi.map(function(r){
      var info = anggotaMap[r.id_murid] || {};
      return {
        id_spp: r.id_spp, id_murid: r.id_murid, nama_murid: r.nama_murid,
        id_halaqah: r.id_halaqah || info.id_halaqah || '', nama_halaqah: info.nama_halaqah || '',
        level: info.level || '', bulan: r.bulan, tahun: r.tahun,
        nominal: r.nominal, tanggal_bayar: r.tanggal_bayar, metode_bayar: r.metode_bayar,
        id_periode: r.id_periode || null, status: r.status || 'lunas', catatan: r.catatan || '',
      };
    }).sort(function(a,b){ return (b.tanggal_bayar||'').localeCompare(a.tanggal_bayar||'') || (a.nama_murid||'').localeCompare(b.nama_murid||''); });

    // ── Angka keuangan: SATU sumber kebenaran (_hitungKeuangan) ──
    // Kas + Operasional ikut scope periode/tahun (agar kartu Pemasukan/
    // Pengeluaran/Saldo = angka Buku Kas / getArusKas pada scope yang sama).
    // p.bulan (dipakai HANYA loadKasBeasiswa utk beasiswa_*) → skip, keuangan tak dipakai.
    var _kasParam = pInfo        ? { id_periode: pInfo.id_periode }
                  : isTanpa      ? { id_periode: _PERIODE_SENTINEL_NONE, tahun: isSemuaTahun ? 'semua' : (tahunSpesifik || tahun) }
                  : isSemuaTahun ? { tahun: 'semua' }
                  :                { tahun: tahun };
    var _kasScope = (p.bulan) ? { data: [] } : await this.getKas(_kasParam);
    var _opScope  = (p.bulan) ? { data: [] } : await this.getOperasional(_kasParam);
    var keuangan = _hitungKeuangan(sppFiltered, _kasScope.data, _opScope.data, { bulanRange: null });

    // Badge "Tanpa Periode": jumlah baris lunas yg id_periode-nya NULL.
    // Scope ke tahun spesifik agar cocok dgn drill-down (klik badge → daftar
    // difilter tahun). Mode "Semua Tahun" / periode → hitung semua tahun.
    var tanpaPeriodeCount = 0;
    try {
      var _tpcQ = _sb.from('spp_pembayaran').select('id_spp', { count:'exact', head:true })
        .eq('status','lunas').is('id_periode', null);
      if (tahunSpesifik) _tpcQ = _tpcQ.eq('tahun', tahunSpesifik);
      var _tpc = await _tpcQ;
      tanpaPeriodeCount = _tpc.count || 0;
    } catch(_) {}

    var totalSPP   = keuangan.pemasukan.spp;
    var totalInfaq = keuangan.pemasukan.infaq;
    var totalIhsan = keuangan.pengeluaran.ihsan;

    // Field lama (kompat FE lama, dirapikan di Fase 2): total_masuk = SPP+Infaq saja,
    // total_net = −Ihsan saja. Angka "resmi" ada di `keuangan` (ikut kas & operasional).
    var totalMasuk = totalSPP + totalInfaq;
    var totalNet = totalMasuk - totalIhsan;

    // Hitung breakdown metode bayar (Gateway vs Manual)
    var sppGatewayNominal = 0;
    var sppGatewayCount = 0;
    var sppManualNominal = 0;
    var sppManualCount = 0;
    sppPribadi.forEach(function(s) {
      if (s.metode_bayar === 'gateway') {
        sppGatewayNominal += Number(s.nominal || 0);
        sppGatewayCount++;
      } else {
        sppManualNominal += Number(s.nominal || 0);
        sppManualCount++;
      }
    });

    var infaqGatewayNominal = 0;
    var infaqGatewayCount = 0;
    var infaqManualNominal = 0;
    var infaqManualCount = 0;
    infaqData.forEach(function(s) {
      if (s.metode_bayar === 'gateway') {
        infaqGatewayNominal += Number(s.nominal || 0);
        infaqGatewayCount++;
      } else {
        infaqManualNominal += Number(s.nominal || 0);
        infaqManualCount++;
      }
    });

    var totalGatewayNominal = sppGatewayNominal + infaqGatewayNominal;
    var totalGatewayCount = sppGatewayCount + infaqGatewayCount;
    var totalManualNominal = sppManualNominal + infaqManualNominal;
    var totalManualCount = sppManualCount + infaqManualCount;

    // ── Murid beasiswa = ember ketiga (dikeluarkan dari lunas & menunggak) ──
    var beasiswa_count = muridListRaw.filter(function(m){ return m.is_beasiswa; }).length;
    // Lunas = tunggakan===0 DAN window kewajibannya tidak kosong (non-beasiswa saja)
    var lunas     = muridListRaw.filter(function(m){ return !m.is_beasiswa && m.tunggakan===0 && m._winLen>0; }).length;
    var menunggak = muridListRaw.filter(function(m){ return !m.is_beasiswa && m.tunggakan>0; }).length;

    // ── Distribusi sisa donasi ke guru pengajar murid beasiswa (basis per bulan) ──
    var bulanTarget = (p && p.bulan) ? p.bulan : BULAN[new Date().getMonth()];
    var bulanIdx    = BULAN.indexOf(bulanTarget) + 1;
    // Infaq per bulan via tanggal_bayar (RPC; kolom bulan infaq selalu '-')
    var infaqBulananRes = await _sb.rpc('get_infaq_bulanan', { p_bulan_idx: bulanIdx, p_tahun: tahun });
    var infaq_bulanan = Number((infaqBulananRes && infaqBulananRes.data) || 0);
    // Operasional bulan tersebut
    var opQ = await _sb.from('operasional').select('nominal').eq('tahun', tahun).eq('bulan', bulanTarget);
    var operasional_total = (opQ.data||[]).reduce(function(s,r){ return s+Number(r.nominal||0); }, 0);
    var sisa_donasi = infaq_bulanan - operasional_total;
    // Guru distinct (id_guru non-null) yang mengajar murid beasiswa
    var beasiswaGuruSet = {};
    (anggota||[]).forEach(function(a){
      if (a.tipe_spp === 'beasiswa' && a.halaqah && a.halaqah.id_guru) beasiswaGuruSet[a.halaqah.id_guru] = true;
    });
    var guru_beasiswa_count = Object.keys(beasiswaGuruSet).length;
    var bagian_per_guru = (sisa_donasi > 0 && guru_beasiswa_count > 0) ? Math.floor(sisa_donasi / guru_beasiswa_count) : 0;

    var muridList = muridListRaw.map(function(m){
      return { id_murid:m.id_murid, nama_murid:m.nama_murid, id_halaqah:m.id_halaqah, nama_halaqah:m.nama_halaqah,
        level:m.level, no_hp:m.no_hp, lunas_bulan:m.lunas_bulan, tunggakan:m.tunggakan, is_beasiswa:m.is_beasiswa,
        level_selesai:m.level_selesai, progress_level:m.progress_level };
    });
    return { status:'ok', data:{ murid_list: muridList, infaq_list: infaqList, spp_list: sppList,
      ihsan_list: ihsanData.map(function(r) {
        return {
          id_spp: r.id_spp,
          id_murid: r.id_murid,
          nama_murid: r.nama_murid,
          bulan: r.bulan,
          tahun: r.tahun,
          nominal: r.nominal,
          tanggal_bayar: r.tanggal_bayar,
          catatan: r.catatan || '',
          id_periode: r.id_periode || null,
          status: r.status || 'lunas',
          metode_bayar: r.metode_bayar || 'manual'
        };
      }).sort(function(a,b){ return (b.tanggal_bayar||'').localeCompare(a.tanggal_bayar||'') || a.nama_murid.localeCompare(b.nama_murid); }),
      total_nominal: totalSPP, total_infaq: totalInfaq, total_ihsan: totalIhsan, total_masuk: totalMasuk, total_net: totalNet, lunas, menunggak, tahun,
      keuangan: keuangan,
      tunggakan_disabled: tunggakanDisabled,
      mode: pInfo ? 'periode' : (isTanpa ? 'tanpa_periode' : (isSemuaTahun ? 'semua_tahun' : 'tahun')),
      periode_id: pInfo ? pInfo.id_periode : (isTanpa ? _PERIODE_SENTINEL_NONE : null),
      periode_nama: pInfo ? pInfo.nama_periode : (isTanpa ? 'Tanpa Periode' : null),
      periode_bulan: null, // usang: tunggakan tak lagi berbasis bulan periode (window 5-bln)
      periode_range: pInfo ? { mulai: pInfo.tanggal_mulai, selesai: pInfo.tanggal_selesai } : null,
      tahun_scope: tahunSpesifik || ((pInfo || isTanpa || isSemuaTahun) ? 'semua' : tahun),
      tanpa_periode_count: tanpaPeriodeCount,
      spp_gateway_nominal: sppGatewayNominal, spp_gateway_count: sppGatewayCount,
      spp_manual_nominal: sppManualNominal, spp_manual_count: sppManualCount,
      infaq_gateway_nominal: infaqGatewayNominal, infaq_gateway_count: infaqGatewayCount,
      infaq_manual_nominal: infaqManualNominal, infaq_manual_count: infaqManualCount,
      total_gateway_nominal: totalGatewayNominal, total_gateway_count: totalGatewayCount,
      total_manual_nominal: totalManualNominal, total_manual_count: totalManualCount,
      bulan_rekap: bulanRekapDefault, total_rekap: TOTAL_REKAP, window_size: WINDOW_SIZE,
      // ── Beasiswa & distribusi sisa donasi ──
      beasiswa_count: beasiswa_count,
      beasiswa_bulan: bulanTarget,
      beasiswa_infaq_bulanan: infaq_bulanan,
      beasiswa_operasional: operasional_total,
      beasiswa_sisa: sisa_donasi,
      beasiswa_guru_count: guru_beasiswa_count,
      beasiswa_bagian_per_guru: bagian_per_guru } };
  },
  // ── Operasional (ledger pengeluaran bulanan) ────────────────
  //  p.id_periode : filter ke periode itu (abaikan tahun/bulan)
  //  p.id_periode === '__tanpa__' : hanya yang id_periode NULL
  getOperasional: async function(p) {
    p = p || {};
    var _semua = String(p.tahun) === 'semua';
    var _th = (p.tahun && !_semua) ? Number(p.tahun) : null;
    var q = _sb.from('operasional').select('*');
    if (p.id_periode === _PERIODE_SENTINEL_NONE) {
      q = q.is('id_periode', null);
      if (_th) q = q.eq('tahun', _th);
    } else if (p.id_periode) {
      q = q.eq('id_periode', p.id_periode);
      if (_th) q = q.eq('tahun', _th);
    } else if (_semua) {
      // semua tahun → tanpa filter tahun
      if (p.bulan) q = q.eq('bulan', p.bulan);
    } else {
      q = q.eq('tahun', _th || new Date().getFullYear());
      if (p.bulan) q = q.eq('bulan', p.bulan);
    }
    var { data, error } = await q.order('created_at', { ascending:false });
    _check(error,'getOperasional');
    var total = (data||[]).reduce(function(s,r){ return s+Number(r.nominal||0); }, 0);
    return { status:'ok', data: data||[], total: total };
  },
  tambahOperasional: async function(d) {
    var _opRow = {
      bulan: d.bulan, tahun: Number(d.tahun), keterangan: d.keterangan,
      nominal: Number(d.nominal), catatan: d.catatan || null, created_by: _uid(),
    };
    if (d.id_periode) _opRow.id_periode = d.id_periode; // aman walau kolom belum ada (patch_101)
    var { error } = await _sb.from('operasional').insert(_opRow);
    _check(error,'tambahOperasional');
    return { status:'ok' };
  },
  updateOperasional: async function(d) {
    var { id_operasional } = d, u = {};
    ['bulan','tahun','keterangan','nominal','catatan'].forEach(function(k){ if (d[k] !== undefined) u[k] = d[k]; });
    if (d.id_periode !== undefined && d.id_periode !== null) u.id_periode = d.id_periode; // clearing → Fase 3
    if (u.nominal != null) u.nominal = Number(u.nominal);
    if (u.tahun   != null) u.tahun   = Number(u.tahun);
    var { error } = await _sb.from('operasional').update(u).eq('id_operasional', id_operasional);
    _check(error,'updateOperasional');
    return { status:'ok' };
  },
  hapusOperasional: async function(id_operasional) {
    var { error } = await _sb.from('operasional').delete().eq('id_operasional', id_operasional);
    _check(error,'hapusOperasional');
    return { status:'ok' };
  },
  // ── Kas / Buku Kas umum (dua arah: masuk & keluar) ──────────
  // Additive: TIDAK menyentuh operasional/spp_pembayaran. Laporan Arus Kas
  // (getArusKas) menggabungkan sumber-sumber di lapisan aplikasi. RLS: tulis
  // admin, baca authenticated (patch_077).
  //  p.id_periode : filter ke periode (abaikan rentang tanggal)
  //  p.id_periode === '__tanpa__' : hanya id_periode NULL (dlm tahun bila diberi)
  getKas: async function(p) {
    p = p || {};
    var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var _semua = String(p.tahun) === 'semua';
    var tahun = (p.tahun && !_semua) ? Number(p.tahun) : new Date().getFullYear();
    var q = _sb.from('kas').select('*');
    if (p.id_periode === _PERIODE_SENTINEL_NONE) {
      q = q.is('id_periode', null);
      if (p.tahun && !_semua) q = q.gte('tanggal', tahun + '-01-01').lt('tanggal', (tahun + 1) + '-01-01');
    } else if (p.id_periode) {
      q = q.eq('id_periode', p.id_periode);
    } else if (_semua) {
      // semua tahun → tanpa filter tanggal
    } else {
      // Periode: rentang (bulanStart..bulanEnd) | bulan tunggal | setahun penuh
      var sIdx = -1, eIdx = -1;
      if (p.bulanStart && p.bulanEnd) { sIdx = BULAN.indexOf(p.bulanStart); eIdx = BULAN.indexOf(p.bulanEnd); }
      else if (p.bulan)               { sIdx = eIdx = BULAN.indexOf(p.bulan); }
      if (sIdx >= 0 && eIdx >= 0) {
        if (sIdx > eIdx) { var _t = sIdx; sIdx = eIdx; eIdx = _t; }
        var pad = function(n){ return (n < 10 ? '0' : '') + n; };
        var start = tahun + '-' + pad(sIdx + 1) + '-01';
        var endY  = eIdx === 11 ? tahun + 1 : tahun;
        var endM  = eIdx === 11 ? 1 : eIdx + 2;
        var end   = endY + '-' + pad(endM) + '-01';
        q = q.gte('tanggal', start).lt('tanggal', end);
      } else {
        q = q.gte('tanggal', tahun + '-01-01').lt('tanggal', (tahun + 1) + '-01-01');
      }
    }
    if (p.arah)     q = q.eq('arah', p.arah);
    if (p.kategori) q = q.eq('kategori', p.kategori);
    var { data, error } = await q.order('tanggal', { ascending:false }).order('created_at', { ascending:false });
    _check(error,'getKas');
    var total = (data||[]).reduce(function(s,r){ return s+Number(r.nominal||0); }, 0);
    return { status:'ok', data: data||[], total: total };
  },
  tambahKas: async function(d) {
    var _kasRow = {
      tanggal: d.tanggal || new Date().toISOString().slice(0,10),
      arah: d.arah, kategori: d.kategori,
      nominal: Number(d.nominal), keterangan: d.keterangan,
      penerima: d.penerima || null, metode: d.metode || null,
      bukti_url: d.bukti_url || null, catatan: d.catatan || null,
      created_by: _uid(),
    };
    if (d.id_periode) _kasRow.id_periode = d.id_periode; // aman walau kolom belum ada (patch_101)
    var { data, error } = await _sb.from('kas').insert(_kasRow).select('id_kas').single();
    _check(error,'tambahKas');
    _logAudit('tambah_kas', { id_kas: data && data.id_kas, arah: d.arah, kategori: d.kategori, nominal: Number(d.nominal) });
    return { status:'ok', data: data };
  },
  updateKas: async function(d) {
    var { id_kas } = d, u = {};
    ['tanggal','arah','kategori','nominal','keterangan','penerima','metode','bukti_url','catatan'].forEach(function(k){ if (d[k] !== undefined) u[k] = d[k]; });
    if (d.id_periode !== undefined && d.id_periode !== null) u.id_periode = d.id_periode; // clearing → Fase 3
    if (u.nominal != null) u.nominal = Number(u.nominal);
    var { error } = await _sb.from('kas').update(u).eq('id_kas', id_kas);
    _check(error,'updateKas');
    _logAudit('update_kas', { id_kas: id_kas, changes: u });
    return { status:'ok' };
  },
  hapusKas: async function(id_kas) {
    var { error } = await _sb.from('kas').delete().eq('id_kas', id_kas);
    _check(error,'hapusKas');
    _logAudit('hapus_kas', { id_kas: id_kas });
    return { status:'ok' };
  },
  // ── Kategori Kas konfigurabel (patch_078) ───────────────────
  // 'Operasional' (keluar) dikunci (kunci=true) karena dipakai routing ke tabel
  // operasional. 'Honor Guru' diblokir (diinput via Ihsan Guru, bukan Buku Kas).
  getKasKategori: async function() {
    var { data, error } = await _sb.from('kas_kategori').select('*')
      .order('arah', { ascending:true }).order('urutan', { ascending:true }).order('nama', { ascending:true });
    _check(error,'getKasKategori');
    return { status:'ok', data: data||[] };
  },
  tambahKasKategori: async function(d) {
    var nama = (d.nama||'').trim();
    var arah = d.arah === 'masuk' ? 'masuk' : 'keluar';
    if (!nama) throw new Error('Nama kategori wajib diisi.');
    if (arah === 'keluar' && nama.toLowerCase() === 'honor guru')
      throw new Error('Honor Guru diinput lewat tombol "Ihsan Guru", bukan Buku Kas.');
    var { data, error } = await _sb.from('kas_kategori')
      .insert({ arah: arah, nama: nama, urutan: Number(d.urutan)||0, created_by: _uid() })
      .select('id_kk').single();
    if (error && (error.code === '23505' || /duplicate|unique/i.test(error.message||'')))
      throw new Error('Kategori "'+nama+'" sudah ada di sisi '+arah+'.');
    _check(error,'tambahKasKategori');
    _logAudit('tambah_kas_kategori', { arah: arah, nama: nama });
    return { status:'ok', data: data };
  },
  updateKasKategori: async function(d) {
    var nama = (d.nama||'').trim();
    if (!nama) throw new Error('Nama kategori wajib diisi.');
    var { data: cur } = await _sb.from('kas_kategori').select('kunci, arah, nama').eq('id_kk', d.id_kk).single();
    if (cur && cur.kunci) throw new Error('Kategori "'+cur.nama+'" terkunci (sistem) — tak bisa diubah.');
    if (cur && cur.arah === 'keluar' && nama.toLowerCase() === 'honor guru')
      throw new Error('Honor Guru diinput lewat tombol "Ihsan Guru", bukan Buku Kas.');
    var u = { nama: nama };
    if (d.urutan !== undefined) u.urutan = Number(d.urutan)||0;
    var { error } = await _sb.from('kas_kategori').update(u).eq('id_kk', d.id_kk);
    if (error && (error.code === '23505' || /duplicate|unique/i.test(error.message||'')))
      throw new Error('Nama kategori "'+nama+'" sudah dipakai.');
    _check(error,'updateKasKategori');
    _logAudit('update_kas_kategori', { id_kk: d.id_kk, nama: nama });
    return { status:'ok' };
  },
  hapusKasKategori: async function(id_kk) {
    var { data: cur } = await _sb.from('kas_kategori').select('kunci, nama').eq('id_kk', id_kk).single();
    if (cur && cur.kunci) throw new Error('Kategori "'+cur.nama+'" terkunci (sistem) — tak bisa dihapus.');
    var { error } = await _sb.from('kas_kategori').delete().eq('id_kk', id_kk);
    _check(error,'hapusKasKategori');
    _logAudit('hapus_kas_kategori', { id_kk: id_kk });
    return { status:'ok' };
  },
  // Laporan Arus Kas (rentang bulan): sisi MASUK = SPP Pribadi lunas + Infaq
  // lunas + kas(masuk); sisi KELUAR = kas(keluar) + operasional + Ihsan Guru
  // (gaji). Ihsan Guru TIDAK dihitung sebagai pemasukan. Infaq via RPC
  // get_infaq_bulanan per bulan (kolom bulan infaq selalu '-', periode dari
  // tanggal_bayar) lalu dijumlah — konsisten dgn transparansi murid & beasiswa.
  // Terima {tahun, bulan} (tunggal, legacy) ATAU {tahun, bulanStart, bulanEnd}.
  getArusKas: async function(p) {
    p = p || {};
    var BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var isSemua = String(p.tahun) === 'semua';
    var tahun = (p.tahun && !isSemua) ? Number(p.tahun) : new Date().getFullYear();
    var pInfo   = (p.id_periode && p.id_periode !== _PERIODE_SENTINEL_NONE) ? await _resolvePeriode(p.id_periode) : null;
    var isTanpa = p.id_periode === _PERIODE_SENTINEL_NONE;

    // Rentang bulan: mode periode → semua bulan periode; semua tahun → 12 bulan;
    // mode tanpa/tahun → dropdown.
    var startIdx, endIdx;
    if (p.bulanStart && p.bulanEnd) { startIdx = BULAN.indexOf(p.bulanStart); endIdx = BULAN.indexOf(p.bulanEnd); }
    else if (p.bulan)               { startIdx = endIdx = BULAN.indexOf(p.bulan); }
    else                            { startIdx = endIdx = new Date().getMonth(); }
    if (startIdx < 0) startIdx = new Date().getMonth();
    if (endIdx   < 0) endIdx   = new Date().getMonth();
    if (startIdx > endIdx) { var _t = startIdx; startIdx = endIdx; endIdx = _t; }
    var monthNames = pInfo
      ? pInfo.monthBuckets.map(function(b){ return b.bulan; }).filter(function(b,i,a){ return a.indexOf(b) === i; })
      : isSemua ? BULAN.slice()
      : BULAN.slice(startIdx, endIdx + 1);
    if (!monthNames.length) monthNames = [BULAN[new Date().getMonth()]];

    // 1. SPP + Ihsan + Infaq lunas dlm scope.
    //    Mode periode → filter id_periode (eksak). Semua tahun → tanpa filter tahun.
    //    Lainnya → rentang bulan + tahun.
    var _sppScope = function(q){
      q = q.eq('status','lunas');
      if (pInfo)              q = q.eq('id_periode', pInfo.id_periode);
      else if (isTanpa)     { q = q.is('id_periode', null); if (!isSemua) q = q.eq('tahun', tahun); }
      else if (!isSemua)      q = q.eq('tahun', tahun);
      return q;
    };
    var _cols = 'id_spp, id_murid, nama_murid, jenis, bulan, tahun, nominal, tanggal_bayar, created_at, metode_bayar, catatan, status, id_periode';
    var sppMonthRows = await _selectAllPaged('spp_pembayaran', _cols, function(q){
      q = _sppScope(q);
      if (!pInfo) q = q.in('bulan', monthNames);
      return q.order('id_spp');
    }, 'getArusKas:sppMonth');
    var infaqAllRows = await _selectAllPaged('spp_pembayaran', _cols, function(q){
      return _sppScope(q).eq('jenis','Infaq/Operasional').order('id_spp');
    }, 'getArusKas:infaq');
    var infaqInRange = (pInfo || isSemua) ? infaqAllRows
      : infaqAllRows.filter(function(r){ return monthNames.indexOf(_bulanDariTanggal(r)) >= 0; });
    // Gabung: SPP Pribadi + Ihsan dari sppMonthRows (buang Infaq apa pun di sana),
    //         + Infaq disaring-tanggal → tak ada dobel hitung.
    var sppRows = sppMonthRows.filter(function(s){ return (s.jenis || 'SPP Pribadi') !== 'Infaq/Operasional'; }).concat(infaqInRange);
    var sppPribadiRows = sppRows.filter(function(s){ return (s.jenis || 'SPP Pribadi') === 'SPP Pribadi'; });
    var ihsanRows      = sppRows.filter(function(s){ return s.jenis === 'Ihsan Guru'; });

    // 2. Operasional dlm scope
    var opAll = pInfo   ? await this.getOperasional({ id_periode: pInfo.id_periode })
              : isTanpa ? await this.getOperasional({ id_periode: _PERIODE_SENTINEL_NONE, tahun: isSemua ? 'semua' : tahun })
              : isSemua ? await this.getOperasional({ tahun: 'semua' })
              :           await this.getOperasional({ tahun: tahun });
    var opRows = (pInfo || isSemua) ? (opAll.data || [])
              : (opAll.data || []).filter(function(o){ return monthNames.indexOf(o.bulan) >= 0; });

    // 3. Kas umum dlm scope
    var kasRes = pInfo   ? await this.getKas({ id_periode: pInfo.id_periode })
               : isTanpa ? await this.getKas({ id_periode: _PERIODE_SENTINEL_NONE, tahun: isSemua ? 'semua' : tahun })
               : isSemua ? await this.getKas({ tahun: 'semua' })
               :           await this.getKas({ tahun: tahun, bulanStart: monthNames[0], bulanEnd: monthNames[monthNames.length - 1] });
    var kasRows = kasRes.data || [];

    // ── SATU sumber kebenaran: _hitungKeuangan (rentang sudah difilter di atas) ──
    var keu = _hitungKeuangan(sppRows, kasRows, opRows, { bulanRange: null });
    var sppMasuk          = keu.pemasukan.spp;
    var infaqMasuk        = keu.pemasukan.infaq;
    var kasMasuk          = keu.pemasukan.kas_lain;
    var ihsanKeluar       = keu.pengeluaran.ihsan;
    var operasionalKeluar = keu.pengeluaran.operasional;
    var kasKeluar         = keu.pengeluaran.kas_lain;
    var totalMasuk  = keu.pemasukan.total;
    var totalKeluar = keu.pengeluaran.total;

    // Breakdown kas per kategori + agregat Infaq per bulan (utk riwayat)
    var bMasuk = {}, bKeluar = {};
    kasRows.forEach(function(k){
      var n = Number(k.nominal||0);
      if (k.arah === 'masuk') bMasuk[k.kategori] = (bMasuk[k.kategori]||0)+n;
      else bKeluar[k.kategori] = (bKeluar[k.kategori]||0)+n;
    });
    var _infaqPerBulanMap = {};
    infaqInRange.forEach(function(r){
      var b = _bulanDariTanggal(r) || (r.bulan && r.bulan !== '-' ? r.bulan : 'Lainnya');
      _infaqPerBulanMap[b] = (_infaqPerBulanMap[b]||0) + Number(r.nominal||0);
    });
    var _bOrder = pInfo ? monthNames.concat(['Lainnya']) : monthNames;
    var infaqPerBulan = Object.keys(_infaqPerBulanMap)
      .sort(function(a,b){ return _bOrder.indexOf(a) - _bOrder.indexOf(b); })
      .filter(function(b){ return _infaqPerBulanMap[b] > 0; })
      .map(function(b){ return { bulan: b, nominal: _infaqPerBulanMap[b] }; });

    // Breakdown per kategori (untuk grafik)
    var breakdownMasuk = [];
    if (sppMasuk   > 0) breakdownMasuk.push({ kategori:'SPP Pribadi', nominal: sppMasuk });
    if (infaqMasuk > 0) breakdownMasuk.push({ kategori:'Infaq', nominal: infaqMasuk });
    Object.keys(bMasuk).forEach(function(k){ breakdownMasuk.push({ kategori:k, nominal:bMasuk[k] }); });
    var breakdownKeluar = [];
    if (ihsanKeluar       > 0) breakdownKeluar.push({ kategori:'Honor Guru (Ihsan)', nominal: ihsanKeluar });
    if (operasionalKeluar > 0) breakdownKeluar.push({ kategori:'Operasional', nominal: operasionalKeluar });
    Object.keys(bKeluar).forEach(function(k){ breakdownKeluar.push({ kategori:k, nominal:bKeluar[k] }); });
    breakdownMasuk.sort(function(a,b){ return b.nominal - a.nominal; });
    breakdownKeluar.sort(function(a,b){ return b.nominal - a.nominal; });

    // Riwayat gabungan kronologis (bertanggal dulu desc, agregat tanpa tanggal di akhir)
    var riwayat = [];
    kasRows.forEach(function(k){
      riwayat.push({ source:'kas', id:k.id_kas, tanggal:k.tanggal, arah:k.arah,
        kategori:k.kategori, nominal:Number(k.nominal||0), keterangan:k.keterangan,
        penerima:k.penerima||null, metode:k.metode||null, catatan:k.catatan||null,
        id_periode:k.id_periode||null });
    });
    opRows.forEach(function(o){
      riwayat.push({ source:'operasional', id:o.id_operasional, tanggal:null, arah:'keluar',
        kategori:'Operasional', nominal:Number(o.nominal||0), keterangan:(o.keterangan||'')+' ('+(o.bulan||'')+')',
        penerima:null, metode:null, catatan:o.catatan||null });
    });
    ihsanRows.forEach(function(x){
      riwayat.push({ source:'ihsan', id:x.id_spp, tanggal:x.tanggal_bayar||null, arah:'keluar',
        kategori:'Honor Guru (Ihsan)', nominal:Number(x.nominal||0),
        keterangan:'Ihsan Guru — '+(x.nama_murid||''), penerima:x.nama_murid||null, metode:x.metode_bayar||null, catatan:x.catatan||null });
    });
    sppPribadiRows.forEach(function(s){
      riwayat.push({ source:'spp', id:s.id_spp, tanggal:s.tanggal_bayar||null, arah:'masuk',
        kategori:'SPP Pribadi', nominal:Number(s.nominal||0),
        keterangan:'SPP '+(s.bulan||'')+' — '+(s.nama_murid||''), penerima:s.nama_murid||null, metode:s.metode_bayar||null, catatan:s.catatan||null });
    });
    // Infaq: satu baris agregat per bulan (per-baris individu tak tersedia bersih via kolom bulan='-')
    infaqPerBulan.forEach(function(x){
      riwayat.push({ source:'infaq', id:'infaq-'+tahun+'-'+x.bulan, tanggal:null, arah:'masuk',
        kategori:'Infaq', nominal:x.nominal, keterangan:'Infaq/Operasional ('+x.bulan+')', penerima:null, metode:null, catatan:null });
    });
    riwayat.sort(function(a,b){
      var ta = a.tanggal || '', tb = b.tanggal || '';
      if (ta && tb) return tb.localeCompare(ta);
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      return 0;
    });

    return { status:'ok', data:{
      tahun: tahun, bulan_start: monthNames[0], bulan_end: monthNames[monthNames.length - 1],
      mode: pInfo ? 'periode' : (isTanpa ? 'tanpa_periode' : (isSemua ? 'semua_tahun' : 'tahun')),
      periode_nama: pInfo ? pInfo.nama_periode : (isTanpa ? 'Tanpa Periode' : (isSemua ? 'Semua Tahun' : null)),
      total_masuk: totalMasuk, total_keluar: totalKeluar, saldo: totalMasuk - totalKeluar,
      masuk:  { spp_pribadi: sppMasuk, infaq: infaqMasuk, kas: kasMasuk },
      keluar: { kas: kasKeluar, operasional: operasionalKeluar, ihsan: ihsanKeluar },
      keuangan: keu,
      breakdown_masuk: breakdownMasuk, breakdown_keluar: breakdownKeluar,
      riwayat: riwayat,
    }};
  },

  // Ringkasan GLOBAL — SEMUA periode & tahun. Untuk strip di atas halaman SPP,
  // TERPISAH dari kartu KPI (yang ikut filter periode/tahun). Uang via
  // getArusKas('semua') — satu sumber (ikut kas & operasional). Lunas/menunggak
  // via model level (_sppLevelInfo, akumulasi bulan lunas SPP Pribadi lintas
  // tahun) — rumus & hasil sama persis dgn getSPPRekap.
  getRekapGlobal: async function() {
    var kas = await this.getArusKas({ tahun: 'semua' });
    var kd = (kas && kas.data) || {};
    var _m = kd.masuk || {}, _k = kd.keluar || {};
    var isFth = function(id){ return !!(id && String(id).toUpperCase().startsWith('FTH')); };

    var { data: anggota } = await _sb.from('anggota').select('id_murid, tipe_spp').eq('status','aktif');
    var roster = (anggota||[]).filter(function(a){ return !isFth(a.id_murid); });
    var muridIds = roster.map(function(a){ return a.id_murid; });
    var beasiswa = roster.filter(function(a){ return a.tipe_spp === 'beasiswa'; }).length;

    var setMap = {};
    if (muridIds.length) {
      var rows = await _selectAllPaged('spp_pembayaran', 'id_murid, bulan, tahun, jenis, status',
        function(q){ return q.in('id_murid', muridIds).eq('status','lunas').order('id_spp'); }, 'getRekapGlobal');
      (rows||[]).forEach(function(r){
        if (r.jenis && r.jenis !== 'SPP Pribadi') return;
        if (_BULAN_KEU.indexOf(r.bulan) < 0) return; // buang bulan '-' / tak dikenal
        (setMap[r.id_murid] = setMap[r.id_murid] || {})[r.tahun + '-' + r.bulan] = 1;
      });
    }
    var lunas = 0, menunggak = 0, tunggakanBulan = 0;
    roster.forEach(function(a){
      if (a.tipe_spp === 'beasiswa') return;
      var lv = _sppLevelInfo(Object.keys(setMap[a.id_murid] || {}).length);
      if (lv.tunggakan === 0) lunas++; else { menunggak++; tunggakanBulan += lv.tunggakan; }
    });

    return { status:'ok', data:{
      lunas: lunas, menunggak: menunggak, beasiswa: beasiswa,
      murid_non_beasiswa: lunas + menunggak,
      belum_tertagih: tunggakanBulan * SPP_NOMINAL_BULANAN,
      spp:          Number(_m.spp_pribadi || 0),
      infaq:        Number(_m.infaq || 0),
      total_masuk:  Number(kd.total_masuk || 0),
      ihsan:        Number(_k.ihsan || 0),
      total_keluar: Number(kd.total_keluar || 0),
      saldo:        Number(kd.saldo || 0),
    }};
  },

  exportRekapAbsensi: async function(p) { return {status:'ok',message:'Export belum diimplementasi'}; },
  arsipData: async function() { throw new Error('Fitur arsip data belum tersedia. Data BELUM dipindahkan — jangan jadikan ini sebagai pengganti backup.'); },
  getArsipList: async function() { return {status:'ok',data:[]}; },
  deleteLevel: async function(id) { var {error}=await _sb.from('level').update({status:'nonaktif'}).eq('id_level',id); _check(error,'deleteLevel'); return {status:'ok'}; },
  // ── Import Bulk CSV — 3 Tahap ────────────────────────────────
  importTahap1: async function(d) {
    var halaqah = d.halaqah || [];
    var dibuat = [], skipped = [];
    // Ambil semua halaqah existing untuk cek duplikat & tabrakan id_halaqah
    var { data: existing } = await _sb.from('halaqah').select('id_halaqah, nama_halaqah');
    var existingSet = new Set((existing||[]).map(function(h){return h.nama_halaqah.toLowerCase();}));
    var usedIds = new Set((existing||[]).map(function(h){return h.id_halaqah;}));
    // Ambil semua guru untuk mapping nama → id_user
    var { data: gurus } = await _sb.from('users').select('id_user, nama_lengkap').eq('role','guru');
    var guruMap = {};
    (gurus||[]).forEach(function(g){ guruMap[g.nama_lengkap.toLowerCase()] = g.id_user; });
    for (var i = 0; i < halaqah.length; i++) {
      var h = halaqah[i];
      // Trim nama_halaqah/nama_guru -- spasi liar dari CSV (mis. "Rumaysho ")
      // membuat halaqah yang sama dianggap berbeda antar baris/level.
      var namaHalaqah = (h.nama_halaqah||'').trim();
      var namaGuru    = (h.nama_guru||'').trim();
      if (existingSet.has(namaHalaqah.toLowerCase())) { skipped.push(namaHalaqah); continue; }
      var id_guru = guruMap[namaGuru.toLowerCase()] || null;
      // BUG-031 fix: nama halaqah yang berbagi 12 karakter awal yang sama
      // (mis. "Halaqah Tahsin Akhwat 1", "...2", dst) menghasilkan id_halaqah
      // yang sama -> tabrakan primary key -> insert gagal diam-diam. Tambah
      // suffix angka jika id_halaqah sudah dipakai.
      var suffix  = namaHalaqah.replace(/^halaqah\s*/i,'').replace(/^al-?/i,'').toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,12);
      var baseId  = 'HQ-' + (suffix || String(Date.now()).slice(-6));
      var id_halaqah = baseId, n = 1;
      while (usedIds.has(id_halaqah)) { n++; id_halaqah = baseId + '-' + n; }
      var { error } = await _sb.from('halaqah').insert({
        id_halaqah, nama_halaqah:namaHalaqah, id_guru, nama_guru:namaGuru,
        level:h.level||'Level 1', jadwal_hari:h.jadwal_hari||null,
        jam_mulai:_normJam(h.jam_mulai), jam_selesai:_normJam(h.jam_selesai), status:'aktif',
      });
      if (!error) { dibuat.push(namaHalaqah); existingSet.add(namaHalaqah.toLowerCase()); usedIds.add(id_halaqah); }
      else skipped.push(namaHalaqah + ' (error: ' + error.message + ')');
    }
    return { status:'ok', dibuat, skipped, message: dibuat.length + ' halaqah dibuat, ' + skipped.length + ' dilewati' };
  },

  importTahap2: async function(d) {
    var users = d.users || [];
    var berhasil = [], duplikat = 0, gagal = [];
    if (!users.length) return { status:'ok', berhasil, duplikat, gagal };
    // Cek duplikat secara batch
    var nisExisting = users.filter(function(u){return u.nis;}).map(function(u){return u.nis.toUpperCase().trim();});
    var existingSet = new Set();
    if (nisExisting.length) {
      var { data: ex } = await _sb.from('users').select('id_user').in('id_user', nisExisting);
      (ex||[]).forEach(function(u){ existingSet.add(u.id_user); });
    }
    // Cari max murid ID untuk auto-generate
    var yearPrefix = 'RTL' + new Date().getFullYear().toString().slice(2);
    var { data: lastMurid } = await _sb.from('users').select('id_user').like('id_user', yearPrefix+'%').order('id_user',{ascending:false}).limit(1);
    var lastNum = 0;
    if (lastMurid && lastMurid[0]) {
      var m = lastMurid[0].id_user.replace(yearPrefix,'');
      lastNum = parseInt(m) || 0;
    }
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      try {
        var id_user = u.nis ? u.nis.toUpperCase().trim() : '';
        if (!id_user) {
          if ((u.role||'murid') === 'murid') {
            lastNum++;
            id_user = yearPrefix + String(lastNum).padStart(6,'0');
          } else {
            // BUG-020 fix: tambah suffix numerik agar guru bernama depan sama tidak tabrakan
            var baseId = u.nama_lengkap
              .replace(/^(al-|al\s|ustadz\s|ustadzah\s)/gi, '')
              .split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g,'').substring(0, 6);
            id_user = baseId;
            // Cek dan tambah suffix jika sudah ada
            var suffix = 2;
            while (existingSet.has(id_user)) {
              id_user = baseId.substring(0, 5) + suffix;
              suffix++;
            }
          }
        }
        if (existingSet.has(id_user)) { duplikat++; continue; }
        var { error } = await _sb.from('users').insert({
          id_user, nama_lengkap:u.nama_lengkap, role:u.role||'murid',
          no_hp:u.no_hp||null, email:u.email||null,
          nama_guru:u.nama_guru||null, nama_halaqah:u.nama_halaqah||null,
          status:'aktif',
        });
        if (error) { gagal.push({nis:id_user, error:error.message}); continue; }
        if (u.password) await _sb.rpc('set_user_password', { p_id_user:id_user, p_password:u.password });
        existingSet.add(id_user);
        berhasil.push(id_user);
      } catch(e) { gagal.push({nis:u.nis||u.nama_lengkap, error:e.message}); }
    }
    return { status:'ok', berhasil, duplikat, gagal };
  },

  importTahap3: async function(d) {
    var anggota = d.anggota || [];
    var assigned = 0, not_found = [];
    if (!anggota.length) return { status:'ok', assigned, not_found };
    // Load halaqah map
    var { data: allHQ } = await _sb.from('halaqah').select('id_halaqah, nama_halaqah').eq('status','aktif');
    var hqMap = {};
    (allHQ||[]).forEach(function(h){ hqMap[h.nama_halaqah.toLowerCase()] = h.id_halaqah; });
    // Load existing anggota untuk cek duplikat
    var { data: existAnggota } = await _sb.from('anggota').select('id_murid, id_halaqah');
    var existSet = new Set((existAnggota||[]).map(function(a){return a.id_murid+'|'+a.id_halaqah;}));
    for (var i = 0; i < anggota.length; i++) {
      var a = anggota[i];
      var id_halaqah = hqMap[(a.nama_halaqah||'').trim().toLowerCase()];
      if (!id_halaqah) { not_found.push('Halaqah tidak ditemukan: '+a.nama_halaqah); continue; }
      var id_murid = (a.nis||'').toUpperCase().trim();
      // Jika NIS kosong, cari berdasarkan nama
      if (!id_murid) {
        var { data: found } = await _sb.from('users').select('id_user').eq('nama_lengkap',a.nama_murid).eq('role','murid').maybeSingle();
        if (found) id_murid = found.id_user;
        else { not_found.push('User tidak ditemukan: '+a.nama_murid); continue; }
      }
      if (existSet.has(id_murid+'|'+id_halaqah)) { assigned++; continue; }
      var { error } = await _sb.from('anggota').insert({
        id_murid, nama_murid:a.nama_murid, id_halaqah, level:a.level||'Level 1', status:'aktif',
      });
      if (!error) { assigned++; existSet.add(id_murid+'|'+id_halaqah); }
      else not_found.push(id_murid+' (error: '+error.message+')');
    }
    return { status:'ok', assigned, not_found };
  },

  // Tautkan halaqah.id_guru yang masih kosong (mis. halaqah dibuat di
  // Tahap 1 sebelum guru-nya dibuat di Tahap 2) ke id_user guru terkait
  // berdasarkan kecocokan nama_guru <-> nama_lengkap.
  linkHalaqahGuru: async function() {
    var { data: belum } = await _sb.from('halaqah').select('id_halaqah, nama_guru').is('id_guru', null);
    if (!belum || !belum.length) return { status:'ok', linked:0 };
    var { data: gurus } = await _sb.from('users').select('id_user, nama_lengkap').eq('role','guru');
    var guruMap = {};
    (gurus||[]).forEach(function(g){ guruMap[g.nama_lengkap.toLowerCase()] = g.id_user; });
    var linked = 0;
    for (var i = 0; i < belum.length; i++) {
      var h = belum[i];
      var id_guru = h.nama_guru ? guruMap[h.nama_guru.toLowerCase()] : null;
      if (!id_guru) continue;
      var { error } = await _sb.from('halaqah').update({ id_guru: id_guru }).eq('id_halaqah', h.id_halaqah);
      if (!error) linked++;
    }
    return { status:'ok', linked: linked };
  },
  // Raport bulk — TODO: implementasi penuh
  generateRaportByHalaqah: async function(p) { return GuruAPI.generateRaportHalaqah ? GuruAPI.generateRaportHalaqah(p) : {status:'ok',data:[]}; },
  generateRaportByLevel: async function(p) {
    // p = { id_periode, level }
    if (!p || !p.id_periode || !p.level) throw new Error('id_periode dan level wajib diisi.');
    
    // 1. Ambil semua anggota aktif dari level yang diminta (lintas halaqah)
    var { data: anggota, error: errAnggota } = await _sb.from('anggota')
      .select('id_murid, nama_murid, level, id_halaqah')
      .eq('level', p.level).eq('status', 'aktif');
    _check(errAnggota, 'generateRaportByLevel:anggota');
    if (!anggota || !anggota.length) return { status: 'error', message: 'Tidak ada murid aktif dengan level ' + p.level + '.' };
    var ids = anggota.map(function(a) { return a.id_murid; });

    // 2. Ambil komponen raport (untuk non-daurah)
    var { data: komponen } = await _sb.from('komponen_raport').select('*').eq('id_periode', p.id_periode).eq('status', 'aktif').order('urutan');
    var isDaurahLevel = p.level === 'Tahsin Al-Fatihah';
    if (!isDaurahLevel && (!komponen || !komponen.length)) {
      return { status: 'error', message: 'Komponen raport belum dikonfigurasi untuk periode ini.' };
    }

    // 3. Grade config
    var { data: cfgRows } = await _sb.from('konfigurasi_raport').select('key, value');
    var cfgMap = {}; (cfgRows || []).forEach(function(r) { cfgMap[r.key] = r.value; });
    var gradeConfig = {
      mumtaz      : parseInt(cfgMap['grade_mumtaz']         || '90'),
      jayyidJiddan: parseInt(cfgMap['grade_jayyid_jiddan']  || '80'),
      jayyid      : parseInt(cfgMap['grade_jayyid']         || '70'),
      bonusPerfect: parseInt(cfgMap['bonus_perfect_attendance'] || '5'),
    };

    // 4. Periode range
    var { data: prData } = await _sb.from('periode').select('tanggal_mulai, tanggal_selesai').eq('id_periode', p.id_periode).maybeSingle();
    var pr = prData || {};
    var periodeRange = (pr.tanggal_mulai && pr.tanggal_selesai) ? { mulai: pr.tanggal_mulai, selesai: pr.tanggal_selesai } : null;

    // 5. Assessment data untuk daurah
    var asmtItems = [], asmtMurid = [];
    if (isDaurahLevel) {
      var [aiRes, amRes] = await Promise.all([
        _sb.from('assessment_items').select('*').eq('level', 'Tahsin Al-Fatihah').eq('status', 'aktif').order('urutan'),
        _sb.from('assessment_murid').select('*').in('id_murid', ids),
      ]);
      asmtItems = aiRes.data || [];
      asmtMurid = amRes.data || [];
    }

    // 6. Nilai manual dan KBM per halaqah (dikelompokkan)
    var nilaiManualAll = [], nilaiKBMAll = [], atLogAll = [];
    if (isDaurahLevel) {
      // Daurah hanya butuh nilai_kbm (komponen Kehadiran + Adab/Kamera, 20%); nilai_manual
      // & At-Tibyan tak dipakai cabang daurah. Tanpa fetch ini komponen KBM daurah hilang
      // (selaras generateRaportHalaqah yang memang mengambil KBM untuk daurah).
      var { data: kbmD } = await _sb.from('nilai_kbm')
        .select('*, kbm_log!nilai_kbm_id_kbm_fkey(jenis_sesi, status, tanggal_pertemuan)').in('id_murid', ids);
      nilaiKBMAll = kbmD || [];
    } else {
      var [nmRes, kbmRes, atRes] = await Promise.all([
        _sb.from('nilai_manual').select('*').eq('id_periode', p.id_periode).in('id_murid', ids),
        _sb.from('nilai_kbm').select('*, kbm_log!nilai_kbm_id_kbm_fkey(jenis_sesi, status, tanggal_pertemuan)').in('id_murid', ids),
        _sb.from('at_tibyan_log').select('id_murid, id_halaqah, status_hadir').in('id_murid', ids),
      ]);
      nilaiManualAll = nmRes.data || [];
      nilaiKBMAll    = kbmRes.data || [];
      atLogAll       = atRes.data  || [];
    }

    // 7. Generate per murid
    var berhasil = [], gagal = [];
    for (var i = 0; i < anggota.length; i++) {
      var m = anggota[i];
      try {
        var myNilaiKBM  = nilaiKBMAll.filter(function(n){ return n.id_halaqah === m.id_halaqah; });
        var myAtLog     = atLogAll.filter(function(a){ return a.id_halaqah === m.id_halaqah; });
        var raportData = _kalkulasiRaport(
          m.id_murid, p.id_periode, m.id_halaqah,
          komponen, nilaiManualAll, myNilaiKBM, myAtLog, 0,
          gradeConfig, m.level, periodeRange, asmtItems, asmtMurid
        );
        var { error: upErr } = await _sb.from('raport').upsert({
          id_murid: m.id_murid, id_periode: p.id_periode, id_halaqah: m.id_halaqah,
          nilai_akhir: raportData.nilai_akhir, predikat: raportData.predikat,
          detail_json: raportData.komponen,
          tanggal_cetak: _localDate(),
          status: 'draft',
        // MB7 fix (bug hunt 2026-08-27): idem generateRaportHalaqah -- sertakan
        // id_halaqah spy match constraint unik baru (patch_096), tak lagi berebut
        // 1 baris dgn halaqah lain murid yg sama utk periode yg sama.
        }, { onConflict: 'id_murid,id_periode,id_halaqah' });
        if (upErr) throw new Error(upErr.message);
        berhasil.push({ nama_murid: m.nama_murid, nilai_akhir: raportData.nilai_akhir, predikat: raportData.predikat });
      } catch(e) { gagal.push({ id_murid: m.id_murid, nama: m.nama_murid, alasan: e.message }); }
    }
    return { status: 'ok', message: berhasil.length + ' raport berhasil digenerate (level: ' + p.level + ')', data: { berhasil, gagal } };
  },
  generateRaportBulk: async function(p) { throw new Error('Generate raport bulk belum diimplementasi.'); },
  kirimRaportEmail: async function(id) { throw new Error('Kirim raport via email belum diimplementasi.'); },
  getObservasiStats: async function(p) {
    p = p || {};
    var { data, error } = await _sb.from('observasi_kbm')
      .select('*, halaqah(nama_halaqah, id_guru, nama_guru)')
      .order('created_at', { ascending: false });
    _check(error, 'getObservasiStats');
    var list = data || [];
    list = list.map(function(r) {
      if (r.halaqah) {
        r.nama_halaqah = r.halaqah.nama_halaqah;
        r.id_guru = r.halaqah.id_guru;
        r.nama_guru = r.halaqah.nama_guru;
      }
      return r;
    });
    if (p.id_halaqah) {
      list = list.filter(function(r) { return r.id_halaqah === p.id_halaqah; });
    }
    if (p.id_guru) {
      list = list.filter(function(r) { return r.id_guru === p.id_guru; });
    }
    if (p.tgl_dari) {
      list = list.filter(function(r) { return r.tanggal >= p.tgl_dari; });
    }
    if (p.tgl_sampai) {
      list = list.filter(function(r) { return r.tanggal <= p.tgl_sampai; });
    }
    var statsMap = {};
    list.forEach(function(r) {
      var guruId = r.id_guru || 'UNKNOWN';
      var guruNama = r.nama_guru || r.id_guru || 'Tanpa Nama';
      if (!statsMap[guruId]) {
        statsMap[guruId] = {
          nama_guru: guruNama,
          total: 0,
          kondusif: 0,
          tepat_waktu: 0,
          terlambat: 0,
          total_menit_telat: 0,
          ada_latihan: 0,
          kamera_sebagian_besar_terbuka: 0,
          kamera_campuran: 0,
          kamera_sebagian_besar_tertutup: 0
        };
      }
      var s = statsMap[guruId];
      s.total++;
      if (r.kondisi_kelas === 'Kondusif') {
        s.kondusif++;
      }
      if (r.ketepatan_waktu === 'Tepat Waktu') {
        s.tepat_waktu++;
      }
      if (r.ketepatan_waktu === 'Guru Terlambat' || r.ketepatan_waktu === 'Keduanya') {
        s.terlambat++;
        s.total_menit_telat += (Number(r.estimasi_menit) || 0);
      }
      if (r.ada_latihan === 'Ya') {
        s.ada_latihan++;
      }
      if (r.kamera_peserta === 'Sebagian Besar Terbuka') {
        s.kamera_sebagian_besar_terbuka++;
      } else if (r.kamera_peserta === 'Campuran') {
        s.kamera_campuran++;
      } else if (r.kamera_peserta === 'Sebagian Besar Tertutup') {
        s.kamera_sebagian_besar_tertutup++;
      }
    });
    var statsList = Object.keys(statsMap).map(function(k) {
      var s = statsMap[k];
      return {
        id_guru: k,
        nama_guru: s.nama_guru,
        total: s.total,
        kondusif: s.kondusif,
        pct_kondusif: s.total > 0 ? Math.round((s.kondusif / s.total) * 100) : 0,
        tepat_waktu: s.tepat_waktu,
        pct_tepat_waktu: s.total > 0 ? Math.round((s.tepat_waktu / s.total) * 100) : 0,
        terlambat: s.terlambat,
        rata_menit_telat: s.terlambat > 0 ? Math.round(s.total_menit_telat / s.terlambat) : 0,
        ada_latihan: s.ada_latihan,
        pct_ada_latihan: s.total > 0 ? Math.round((s.ada_latihan / s.total) * 100) : 0,
        kamera_sebagian_besar_terbuka: s.kamera_sebagian_besar_terbuka,
        kamera_campuran: s.kamera_campuran,
        kamera_sebagian_besar_tertutup: s.kamera_sebagian_besar_tertutup
      };
    });
    return { status: 'ok', data: statsList };
  },

  getKepatuhanRekap: async function() {
    var [halaqahRes, anggotaRes, nilaiRes, atRes, kbmLogRes, obsRes] = await Promise.all([
      _sb.from('halaqah').select('id_halaqah, nama_halaqah, id_guru, nama_guru').eq('status','aktif'),
      _sb.from('anggota').select('id_murid, nama_murid, id_halaqah, is_ketua, followup_at, followup_alpa_kbm, followup_alpa_at, followup_ketua_at, followup_ketua_alpa_kbm, followup_ketua_alpa_at').eq('status','aktif'),
      _sb.from('nilai_kbm').select('id_murid, id_halaqah, status_hadir, kamera_murid'),
      _sb.from('at_tibyan_log').select('id_murid, id_halaqah, status_hadir'),
      _sb.from('kbm_log').select('id_kbm, id_halaqah').eq('status', 'selesai'),
      _sb.from('observasi_kbm').select('id_kbm, id_halaqah')
    ]);
    _check(halaqahRes.error, 'getKepatuhanRekap.halaqah');
    _check(anggotaRes.error, 'getKepatuhanRekap.anggota');
    var halaqahList = halaqahRes.data || [];
    var anggotaList = anggotaRes.data || [];
    var nilaiList   = nilaiRes.data || [];
    var atList      = atRes.data || [];
    var kbmLogList  = kbmLogRes.data || [];
    var obsList     = obsRes.data || [];

    var kbmLogMap = {};
    kbmLogList.forEach(function(k){
      kbmLogMap[k.id_halaqah] = (kbmLogMap[k.id_halaqah] || 0) + 1;
    });
    var obsMap = {};
    obsList.forEach(function(o){
      obsMap[o.id_halaqah] = (obsMap[o.id_halaqah] || 0) + 1;
    });
    var membersMap = {};
    anggotaList.forEach(function(a){
      if (!membersMap[a.id_halaqah]) membersMap[a.id_halaqah] = [];
      membersMap[a.id_halaqah].push(a);
    });
    var nilaiMuridMap = {};
    nilaiList.forEach(function(n){
      if (!nilaiMuridMap[n.id_murid]) nilaiMuridMap[n.id_murid] = [];
      nilaiMuridMap[n.id_murid].push(n);
    });
    var atMuridMap = {};
    atList.forEach(function(n){
      if (!atMuridMap[n.id_murid]) atMuridMap[n.id_murid] = [];
      atMuridMap[n.id_murid].push(n);
    });
    var rekap = halaqahList.map(function(h) {
      var members = membersMap[h.id_halaqah] || [];
      var ketua = members.find(function(m){ return m.is_ketua; })?.nama_murid || 'Belum Diatur';
      var totalKritis = 0;
      var guruFollowedUp = 0;
      var ketuaFollowedUp = 0;
      members.forEach(function(m) {
        var nm = nilaiMuridMap[m.id_murid] || [];
        var at = atMuridMap[m.id_murid] || [];
        var alpaKbm = nm.filter(function(n){ return n.status_hadir === 'A'; }).length;
        var alpaAt  = at.filter(function(n){ return n.status_hadir === 'A'; }).length;
        var terlambat = nm.filter(function(n){ return n.status_hadir === 'T'; }).length;
        var kameraBuruk = nm.filter(function(n) { return n.kamera_murid && (n.kamera_murid.toLowerCase().indexOf('selalu') >= 0 || n.kamera_murid.toLowerCase().indexOf('sering') >= 0); }).length;
        var status = (alpaKbm >= 2 || alpaAt >= 2) ? 'kritis' : ((alpaKbm === 1 || alpaAt === 1 || terlambat >= 2 || kameraBuruk >= 2) ? 'peringatan' : 'normal');
        if (status !== 'normal') {
          totalKritis++;
          if (m.followup_at) {
            var isGuruDone = (m.followup_alpa_kbm >= alpaKbm) && (m.followup_alpa_at >= alpaAt);
            if (isGuruDone) guruFollowedUp++;
          }
          if (m.followup_ketua_at) {
            var isKetuaDone = (m.followup_ketua_alpa_kbm >= alpaKbm) && (m.followup_ketua_alpa_at >= alpaAt);
            if (isKetuaDone) ketuaFollowedUp++;
          }
        }
      });
      var totalKbm = kbmLogMap[h.id_halaqah] || 0;
      var totalObs = obsMap[h.id_halaqah] || 0;
      return {
        id_halaqah: h.id_halaqah,
        nama_halaqah: h.nama_halaqah,
        nama_guru: h.nama_guru || 'Tanpa Guru',
        nama_ketua: ketua,
        total_murid: members.length,
        total_kritis: totalKritis,
        guru_followed_up: guruFollowedUp,
        ketua_followed_up: ketuaFollowedUp,
        total_kbm: totalKbm,
        total_obs: totalObs,
        pct_guru_followup: totalKritis > 0 ? Math.round((guruFollowedUp / totalKritis) * 100) : 100,
        pct_ketua_followup: totalKritis > 0 ? Math.round((ketuaFollowedUp / totalKritis) * 100) : 100,
        pct_obs: totalKbm > 0 ? Math.round((totalObs / totalKbm) * 100) : 100
      };
    });
    return { status: 'ok', data: rekap };
  },

  // ── Materi At-Tibyan (admin CRUD) ─────────────
  getAtTibyanMateriAdmin: async function() {
    var {data,error} = await _sb.from('at_tibyan_materi').select('*').order('pertemuan_ke');
    _check(error,'getAtTibyanMateriAdmin');
    return {status:'ok', data: data||[]};
  },
  upsertAtTibyanMateri: async function(d) {
    var row = { pertemuan_ke: Number(d.pertemuan_ke), tanggal: d.tanggal||'', pemateri: d.pemateri||'', materi_pembahasan: d.materi_pembahasan||'', nasihat_aplikatif: d.nasihat_aplikatif||'' };
    if (d.id) row.id = d.id;
    var {data,error} = await _sb.from('at_tibyan_materi').upsert(row,{onConflict:'id'}).select().single();
    _check(error,'upsertAtTibyanMateri');
    return {status:'ok', data};
  },
  deleteAtTibyanMateri: async function(id) {
    var {error} = await _sb.from('at_tibyan_materi').delete().eq('id',id);
    _check(error,'deleteAtTibyanMateri');
    return {status:'ok'};
  },

  // ── Assessment Items (Daurah Indikator CRUD) ─────────────
  getAssessmentItemsAdmin: async function() {
    var {data,error} = await _sb.from('assessment_items').select('*').order('urutan');
    _check(error,'getAssessmentItemsAdmin');
    return {status:'ok', data: data||[]};
  },
  upsertAssessmentItem: async function(d) {
    var row = {
      level: d.level || 'Tahsin Al-Fatihah',
      kategori: d.kategori || 'Tahsin',
      teks_latin: d.teks_latin || '',
      teks_arab: d.teks_arab || '',
      keterangan: d.keterangan || '',
      urutan: Number(d.urutan) || 1,
      status: d.status || 'aktif'
    };
    if (d.id_item) {
      row.id_item = d.id_item;
    } else {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        row.id_item = crypto.randomUUID();
      } else {
        row.id_item = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }
    }
    var {data,error} = await _sb.from('assessment_items').upsert(row,{onConflict:'id_item'}).select().single();
    _check(error,'upsertAssessmentItem');
    return {status:'ok', data};
  },
  deleteAssessmentItem: async function(id_item) {
    var {error} = await _sb.from('assessment_items').delete().eq('id_item', id_item);
    _check(error,'deleteAssessmentItem');
    return {status:'ok'};
  },

  // ── Push Subscriber Management ────────────────
  getPushSubscribers: async function() {
    var {data,error} = await _sb.from('push_subscriptions')
      .select('id,id_user,role,device_hint,created_at').order('created_at',{ascending:false});
    _check(error,'getPushSubscribers');
    var ids = (data||[]).map(function(s){return s.id_user;});
    var namaMap = {};
    if (ids.length) {
      var {data:users} = await _sb.from('users').select('id_user,nama_lengkap').in('id_user',ids);
      (users||[]).forEach(function(u){namaMap[u.id_user]=u.nama_lengkap;});
    }
    return {status:'ok', data:(data||[]).map(function(s){
      return Object.assign({},s,{nama:namaMap[s.id_user]||s.id_user});
    })};
  },
  deletePushSubscriber: async function(id) {
    var {error} = await _sb.from('push_subscriptions').delete().eq('id',id);
    _check(error,'deletePushSubscriber'); return {status:'ok'};
  },
  getHalaqahForPush: async function() {
    var {data} = await _sb.from('halaqah').select('id_halaqah,nama_halaqah,level').eq('status','aktif').order('nama_halaqah');
    return {status:'ok',data:data||[]};
  },
  getLevelForPush: async function() {
    var {data} = await _sb.from('level').select('nama_level').eq('status','aktif').order('urutan');
    return {status:'ok',data:(data||[]).map(function(l){return l.nama_level;})};
  },
  getPushTargetUserIds: async function(target) {
    var q = _sb.from('anggota').select('id_murid').eq('status','aktif');
    if (target.halaqah) q = q.eq('id_halaqah',target.halaqah);
    if (target.level)   q = q.eq('level',target.level);
    var {data} = await q;
    return (data||[]).map(function(a){return a.id_murid;});
  },

  // ── Push Notifikasi Admin ──────────────────────
  updatePushConfig: async function(key, enabled) {
    var {error} = await _sb.from('push_config').update({enabled,updated_at:new Date().toISOString()}).eq('key',key);
    _check(error,'updatePushConfig'); return {status:'ok'};
  },
  // Pengumuman onboarding (single-row id=1). Read diizinkan semua user (RLS);
  // write hanya admin. Dipakai murid untuk menampilkan popup saat login.
  getOnboarding: async function() {
    var {data,error} = await _sb.from('onboarding_config').select('*').eq('id',1).maybeSingle();
    _check(error,'getOnboarding'); return {status:'ok',data:data||null};
  },
  saveOnboarding: async function(cfg) {
    var row = {
      id         : 1,
      enabled    : !!cfg.enabled,
      judul      : cfg.judul || '',
      pesan      : cfg.pesan || '',
      target_role: cfg.target_role || 'murid',
      cta_label  : cfg.cta_label || '',
      cta_action : cfg.cta_action || '',
      only_unsubscribed: !!cfg.only_unsubscribed,
      updated_at : new Date().toISOString(),
    };
    var {error} = await _sb.from('onboarding_config').upsert(row, {onConflict:'id'});
    _check(error,'saveOnboarding'); return {status:'ok'};
  },
  // Popup notifikasi (popup dakwah -- bukan push, TERPISAH dari onboarding_config,
  // lihat RENCANA_fitur-popup-notifikasi.md §2.2 di repo Modul-Web). Multi-baris
  // (id_popup bebas pilih admin), admin lihat semua baris; publik hanya baca yg
  // aktif=true (RLS, patch_087). dibuat_oleh TIDAK dikirim di sini -- diisi
  // otomatis oleh DEFAULT kolom saat INSERT (current_user_id()), dan sengaja
  // tak disentuh saat UPDATE supaya tercatat siapa pembuat aslinya.
  getPopupNotifList: async function() {
    var {data,error} = await _sb.from('popup_notifikasi').select('*').order('updated_at',{ascending:false});
    _check(error,'getPopupNotifList'); return {status:'ok',data:data||[]};
  },
  savePopupNotif: async function(cfg) {
    var row = {
      id_popup       : cfg.id_popup,
      judul          : cfg.judul || null,
      isi            : cfg.isi,
      dalil_arab     : cfg.dalil_arab || null,
      cta_label      : cfg.cta_label || null,
      cta_url        : cfg.cta_url || null,
      aktif          : !!cfg.aktif,
    };
    var {error} = await _sb.from('popup_notifikasi').upsert(row, {onConflict:'id_popup'});
    _check(error,'savePopupNotif'); return {status:'ok'};
  },
  deletePopupNotif: async function(idPopup) {
    var {error} = await _sb.from('popup_notifikasi').delete().eq('id_popup',idPopup);
    _check(error,'deletePopupNotif'); return {status:'ok'};
  },
  getPushStats: async function() {
    var [total,murid,guru,admin] = await Promise.all([
      _sb.from('push_subscriptions').select('*',{count:'exact',head:true}),
      _sb.from('push_subscriptions').select('*',{count:'exact',head:true}).eq('role','murid'),
      _sb.from('push_subscriptions').select('*',{count:'exact',head:true}).eq('role','guru'),
      _sb.from('push_subscriptions').select('*',{count:'exact',head:true}).in('role',['admin','superadmin']),
    ]);
    var {data:logs} = await _sb.from('push_log').select('*').order('created_at',{ascending:false}).limit(10);
    return {status:'ok',data:{total:total.count||0,murid:murid.count||0,guru:guru.count||0,admin:admin.count||0,logs:logs||[]}};
  },
  testSendPush: async function(d) {
    var session = (await _sb.auth.getSession()).data.session;
    var token   = session ? session.access_token : SUPABASE_ANON;
    var res = await fetch(SUPABASE_URL+'/functions/v1/send-push',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify(d),
    });
    return res.json();
  },
  testTrigger: async function(trigger) {
    var session = (await _sb.auth.getSession()).data.session;
    var token   = session ? session.access_token : SUPABASE_ANON;
    var res = await fetch(SUPABASE_URL+'/functions/v1/push-scheduler',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token},
      body:JSON.stringify({trigger}),
    });
    return res.json();
  },

  // ── Materi Level (admin CRUD) ──────────────────
  getMateriLevelAdmin: async function() {
    var {data,error} = await _sb.from('materi_level').select('*').order('level').order('urutan');
    _check(error,'getMateriLevelAdmin');
    return {status:'ok', data: data||[]};
  },
  upsertMateriLevel: async function(d) {
    var row = { level: d.level||'', kategori: d.kategori||'', judul: d.judul||'', isi: d.isi||'', urutan: Number(d.urutan)||0 };
    if (d.id) row.id = d.id;
    var {data,error} = await _sb.from('materi_level').upsert(row,{onConflict:'id'}).select().single();
    _check(error,'upsertMateriLevel');
    return {status:'ok', data};
  },
  deleteMateriLevel: async function(id) {
    var {error} = await _sb.from('materi_level').delete().eq('id',id);
    _check(error,'deleteMateriLevel');
    return {status:'ok'};
  },

  getAllSaran: async function() {
    var { data, error } = await _sb.from('saran_masukan')
      .select('*, halaqah(nama_halaqah, nama_guru), users:id_murid(nama_lengkap)')
      .order('created_at', { ascending: false })
      .limit(500);
    _check(error, 'getAllSaran');
    return { status: 'ok', data: data || [] };
  },

  updateSaran: async function(id, updates, studentId = null) {
    var { error } = await _sb.from('saran_masukan')
      .update(updates)
      .eq('id', id);
    _check(error, 'updateSaran');
    
    if (studentId && (updates.status || updates.tanggapan)) {
      _sendPushBg({
        user_ids: [studentId],
        title: '💬 Tanggapan Saran & Masukan',
        body : 'Aspirasi Anda telah ditanggapi atau diperbarui oleh Staf Manajemen. Silakan periksa di tab Riwayat.',
        url  : '/Portal-Halaqah-Rattililquran/murid/index.html',
        tag  : 'saran-tanggapan-' + id,
        data : { trigger: 'saran_responded' },
      });
    }

    return { status: 'ok' };
  },

  // ── Rattil Maze (admin) — kelola level; RLS maze_level_admin_write (is_admin) ──
  getMazeLevelsAdmin: async function() {
    var { data, error } = await _sb.from('maze_level')
      .select('*')
      .order('urutan', { ascending: true });
    _check(error, 'getMazeLevelsAdmin');
    return { status: 'ok', data: data || [] };
  },
  getQuizListForMaze: async function() {
    var { data, error } = await _sb.from('quiz')
      .select('id_quiz, judul, status')
      .order('created_at', { ascending: false });
    _check(error, 'getQuizListForMaze');
    return { status: 'ok', data: data || [] };
  },
  createMazeLevel: async function(payload) {
    var row = {
      nama_level:        payload.nama_level,
      urutan:            payload.urutan != null ? payload.urutan : 0,
      map_data:          payload.map_data,
      jumlah_monster:    payload.jumlah_monster != null ? payload.jumlah_monster : 2,
      kecepatan_monster: payload.kecepatan_monster != null ? payload.kecepatan_monster : 1.0,
      id_kuis:           payload.id_kuis || null,
      tingkat_kesulitan: payload.tingkat_kesulitan || 'mudah',
      target_levels:     payload.target_levels || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:             payload.aktif !== false
    };
    var { data, error } = await _sb.from('maze_level').insert([row]).select().single();
    _check(error, 'createMazeLevel');
    if (!data) throw new Error('createMazeLevel: 0 baris tersimpan (akses admin ditolak?).');
    return { status: 'ok', data: data };
  },
  updateMazeLevel: async function(id_maze_level, payload) {
    var row = {
      nama_level:        payload.nama_level,
      urutan:            payload.urutan != null ? payload.urutan : 0,
      jumlah_monster:    payload.jumlah_monster != null ? payload.jumlah_monster : 2,
      kecepatan_monster: payload.kecepatan_monster != null ? payload.kecepatan_monster : 1.0,
      id_kuis:           payload.id_kuis || null,
      tingkat_kesulitan: payload.tingkat_kesulitan || 'mudah',
      target_levels:     payload.target_levels || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:             payload.aktif !== false
    };
    if (payload.map_data) row.map_data = payload.map_data;
    var { data, error } = await _sb.from('maze_level')
      .update(row).eq('id_maze_level', id_maze_level).select('id_maze_level');
    _check(error, 'updateMazeLevel');
    if (!data || data.length === 0) throw new Error('Perubahan tidak tersimpan (0 baris — akses ditolak?).');
    return { status: 'ok' };
  },
  setMazeLevelAktif: async function(id_maze_level, aktif) {
    var { data, error } = await _sb.from('maze_level')
      .update({ aktif: !!aktif }).eq('id_maze_level', id_maze_level).select('id_maze_level');
    _check(error, 'setMazeLevelAktif');
    if (!data || data.length === 0) throw new Error('Gagal mengubah status (0 baris).');
    return { status: 'ok' };
  },
  deleteMazeLevel: async function(id_maze_level) {
    var { error } = await _sb.from('maze_level').delete().eq('id_maze_level', id_maze_level);
    _check(error, 'deleteMazeLevel');
    return { status: 'ok' };
  },

  // ── Rattil Run (admin) — kelola level; RLS run_level_write (is_admin) ──
  getRunLevelsAdmin: async function() {
    var { data, error } = await _sb.from('run_level')
      .select('*')
      .order('urutan', { ascending: true });
    _check(error, 'getRunLevelsAdmin');
    return { status: 'ok', data: data || [] };
  },
  getQuizListForRun: async function() {
    var { data, error } = await _sb.from('quiz')
      .select('id_quiz, judul, status')
      .order('created_at', { ascending: false });
    _check(error, 'getQuizListForRun');
    return { status: 'ok', data: data || [] };
  },
  createRunLevel: async function(payload) {
    var row = {
      nama_level:          payload.nama_level,
      urutan:              payload.urutan != null ? payload.urutan : 0,
      target_soal:         payload.target_soal != null ? payload.target_soal : 8,
      kecepatan_awal:      payload.kecepatan_awal != null ? payload.kecepatan_awal : 1.0,
      kepadatan_rintangan: payload.kepadatan_rintangan != null ? payload.kepadatan_rintangan : 1.0,
      id_kuis:             payload.id_kuis || null,
      tingkat_kesulitan:   payload.tingkat_kesulitan || 'mudah',
      target_levels:       payload.target_levels || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:               payload.aktif !== false
    };
    var { data, error } = await _sb.from('run_level').insert([row]).select().single();
    _check(error, 'createRunLevel');
    if (!data) throw new Error('createRunLevel: 0 baris tersimpan (akses admin ditolak?).');
    return { status: 'ok', data: data };
  },
  updateRunLevel: async function(id_run_level, payload) {
    var row = {
      nama_level:          payload.nama_level,
      urutan:              payload.urutan != null ? payload.urutan : 0,
      target_soal:         payload.target_soal != null ? payload.target_soal : 8,
      kecepatan_awal:      payload.kecepatan_awal != null ? payload.kecepatan_awal : 1.0,
      kepadatan_rintangan: payload.kepadatan_rintangan != null ? payload.kepadatan_rintangan : 1.0,
      id_kuis:             payload.id_kuis || null,
      tingkat_kesulitan:   payload.tingkat_kesulitan || 'mudah',
      target_levels:       payload.target_levels || [],
      rekomendasi_pertemuan_ke: (payload.rekomendasi_pertemuan_ke != null && payload.rekomendasi_pertemuan_ke !== '') ? parseInt(payload.rekomendasi_pertemuan_ke) : null,
      aktif:               payload.aktif !== false
    };
    var { data, error } = await _sb.from('run_level')
      .update(row).eq('id_run_level', id_run_level).select('id_run_level');
    _check(error, 'updateRunLevel');
    if (!data || data.length === 0) throw new Error('Perubahan tidak tersimpan (0 baris — akses ditolak?).');
    return { status: 'ok' };
  },
  setRunLevelAktif: async function(id_run_level, aktif) {
    var { data, error } = await _sb.from('run_level')
      .update({ aktif: !!aktif }).eq('id_run_level', id_run_level).select('id_run_level');
    _check(error, 'setRunLevelAktif');
    if (!data || data.length === 0) throw new Error('Gagal mengubah status (0 baris).');
    return { status: 'ok' };
  },
  deleteRunLevel: async function(id_run_level) {
    var { error } = await _sb.from('run_level').delete().eq('id_run_level', id_run_level);
    _check(error, 'deleteRunLevel');
    return { status: 'ok' };
  },

  // ============================================================
  //  PENGEMBANGAN PENGAJAR (patch_082) — kelola admin/superadmin.
  // ============================================================

  // Daftar pengajar + profil kompetensi (join FK pengajar_kompetensi.id_guru→users).
  getPengajarList: async function() {
    var { data, error } = await _sb.from('users')
      .select('id_user, nama_lengkap, no_hp, is_musyrif, pengajar_kompetensi(*)')
      .eq('role', 'guru').order('nama_lengkap', { ascending: true });
    _check(error, 'getPengajarList');
    return { status: 'ok', data: (data || []).map(function(u){
      var k = Array.isArray(u.pengajar_kompetensi) ? u.pengajar_kompetensi[0] : u.pengajar_kompetensi;
      return { id_user: u.id_user, nama_lengkap: u.nama_lengkap, no_hp: u.no_hp,
        is_musyrif: !!u.is_musyrif, kompetensi: k || null };
    })};
  },

  // Upsert profil kompetensi (sanad, hafalan, status sertifikasi, catatan).
  upsertPengajarKompetensi: async function(d) {
    d = d || {};
    if (!d.id_guru) return { status: 'error', message: 'id_guru wajib diisi' };
    var row = { id_guru: d.id_guru, updated_at: new Date().toISOString() };
    // 'jenjang' SENGAJA tidak di sini — perubahan jenjang WAJIB lewat setJenjang()
    // agar tertulis ke pengajar_jenjang_riwayat (audit) & tunduk gate superadmin (RLS).
    ['status_sertifikasi','status_sanad','hafalan_juz','tgl_mulai','catatan']
      .forEach(function(k){ if (d[k] !== undefined) row[k] = d[k]; });
    var { data, error } = await _sb.from('pengajar_kompetensi')
      .upsert(row, { onConflict: 'id_guru' }).select().single();
    _check(error, 'upsertPengajarKompetensi');
    return { status: 'ok', data: data };
  },

  // Naik/atur jenjang + audit trail (tulis riwayat & update kompetensi).
  setJenjang: async function(id_guru, jenjang, catatan) {
    if (!id_guru || !jenjang) return { status: 'error', message: 'id_guru & jenjang wajib diisi' };
    // H8 fix (bug hunt 2026-08-18, patch_089): dulu riwayat INSERT lalu kompetensi
    // UPSERT sbg 2 request terpisah -- kalau yg kedua gagal setelah yg pertama sukses,
    // pengajar_jenjang_riwayat mencatat perubahan jenjang yg SEBENARNYA TAK PERNAH
    // terjadi (audit trail rusak oleh fungsi yg justru dibuat utk menjaganya).
    // Sekarang 1 RPC atomik (security invoker -- RLS superadmin-only di
    // pengajar_jenjang_riwayat & trigger guard C5 di pengajar_kompetensi tetap berlaku).
    var { error } = await _sb.rpc('set_jenjang_pengajar', {
      p_id_guru: id_guru, p_jenjang: jenjang, p_catatan: catatan || null
    });
    _check(error, 'setJenjang');
    _logAudit('set_jenjang_pengajar', { id_guru: id_guru, jenjang_baru: jenjang });
    return { status: 'ok' };
  },

  getIndikatorEvaluasi: async function() {
    var { data, error } = await _sb.from('pengajar_indikator').select('*').order('urutan', { ascending: true });
    _check(error, 'getIndikatorEvaluasi');
    return { status: 'ok', data: data || [] };
  },

  // Upsert indikator (superadmin only — dijaga RLS). Tanpa id_indikator = insert.
  upsertIndikator: async function(d) {
    d = d || {};
    if (!d.nama) return { status: 'error', message: 'nama indikator wajib diisi' };
    var row = { nama: d.nama, bobot: Number(d.bobot) || 0, urutan: Number(d.urutan) || 0, status: d.status || 'aktif' };
    if (d.id_indikator) row.id_indikator = d.id_indikator;
    var { data, error } = await _sb.from('pengajar_indikator')
      .upsert(row, { onConflict: 'id_indikator' }).select().single();
    _check(error, 'upsertIndikator');
    _logAudit('upsert_indikator_pengajar', { id_indikator: data && data.id_indikator, bobot: row.bobot });
    return { status: 'ok', data: data };
  },

  upsertPelatihan: async function(d) {
    d = d || {};
    if (!d.judul || !d.tanggal) return { status: 'error', message: 'judul & tanggal wajib diisi' };
    var row = { judul: d.judul, tanggal: d.tanggal, kategori: d.kategori || 'tahsin',
      pemateri: d.pemateri || null, lokasi: d.lokasi || null, deskripsi: d.deskripsi || null,
      status: d.status || 'terjadwal' };
    if (d.id_pelatihan) row.id_pelatihan = d.id_pelatihan;
    if (d.id_agenda !== undefined) row.id_agenda = d.id_agenda || null;  // kaitkan ke agenda (opsional)
    var { data, error } = await _sb.from('pelatihan').upsert(row, { onConflict: 'id_pelatihan' }).select().single();
    _check(error, 'upsertPelatihan');
    return { status: 'ok', data: data };
  },

  // Checklist kehadiran. list = [{ id_guru, status_hadir(H/I/A), catatan }].
  setKehadiranPelatihan: async function(id_pelatihan, list) {
    if (!id_pelatihan || !Array.isArray(list)) return { status: 'error', message: 'id_pelatihan & list wajib diisi' };
    var rows = list.map(function(x){ return {
      id_pelatihan: id_pelatihan, id_guru: x.id_guru,
      status_hadir: x.status_hadir || 'H', catatan: x.catatan || null,
    }; });
    if (!rows.length) return { status: 'ok' };
    var { error } = await _sb.from('pelatihan_peserta').upsert(rows, { onConflict: 'id_pelatihan,id_guru' });
    _check(error, 'setKehadiranPelatihan');
    return { status: 'ok' };
  },

  // Daftar pelatihan + ringkas kehadiran (total & hadir).
  getPelatihanList: async function() {
    var [plt, ps] = await Promise.all([
      _sb.from('pelatihan').select('*').order('tanggal', { ascending: false }),
      _sb.from('pelatihan_peserta').select('id_pelatihan, status_hadir'),
    ]);
    _check(plt.error, 'getPelatihanList');
    var cnt = {};
    (ps.data || []).forEach(function(p){
      if (!cnt[p.id_pelatihan]) cnt[p.id_pelatihan] = { total: 0, hadir: 0 };
      cnt[p.id_pelatihan].total++;
      if (p.status_hadir === 'H') cnt[p.id_pelatihan].hadir++;
    });
    return { status: 'ok', data: (plt.data || []).map(function(x){
      return Object.assign({}, x, { peserta: cnt[x.id_pelatihan] || { total: 0, hadir: 0 } });
    })};
  },

  getPesertaPelatihan: async function(id_pelatihan) {
    if (!id_pelatihan) return { status: 'error', message: 'id_pelatihan wajib diisi' };
    var { data, error } = await _sb.from('pelatihan_peserta').select('*').eq('id_pelatihan', id_pelatihan);
    _check(error, 'getPesertaPelatihan');
    return { status: 'ok', data: data || [] };
  },

  // ── Program Pembinaan / Agenda (patch_083) ──────────────────
  // To-do dua sumber: masalah (keresahan) / kebaikan (ciri). Taksonomi opsional.
  getAgendaPembinaan: async function() {
    var [ag, plt] = await Promise.all([
      _sb.from('agenda_pembinaan').select('*, pengajar_indikator(nama, bobot)'),
      _sb.from('pelatihan').select('id_agenda').not('id_agenda', 'is', null),
    ]);
    _check(ag.error, 'getAgendaPembinaan');
    var cnt = {};
    (plt.data || []).forEach(function(p){ cnt[p.id_agenda] = (cnt[p.id_agenda] || 0) + 1; });
    var rankAsal = { masalah: 0, kebaikan: 1 };
    var rankRanah = { qurani: 0, pedagogik: 1, kepribadian: 2, sosial: 3, lainnya: 4 };
    var rows = (ag.data || []).map(function(a){
      var ind = Array.isArray(a.pengajar_indikator) ? a.pengajar_indikator[0] : a.pengajar_indikator;
      return Object.assign({}, a, { indikator: ind || null, jumlah_dilaksanakan: cnt[a.id_agenda] || 0 });
    });
    rows.sort(function(a, b){
      return (rankAsal[a.asal] - rankAsal[b.asal])
        || ((rankRanah[a.ranah] != null ? rankRanah[a.ranah] : 9) - (rankRanah[b.ranah] != null ? rankRanah[b.ranah] : 9))
        || (a.judul || '').localeCompare(b.judul || '');
    });
    return { status: 'ok', data: rows };
  },

  upsertAgendaPembinaan: async function(d) {
    d = d || {};
    if (!d.judul) return { status: 'error', message: 'judul wajib diisi' };
    var row = { judul: d.judul, asal: d.asal || 'kebaikan' };
    ['masalah','target','ranah','jenis','id_indikator','frekuensi','jadwal_teks','deskripsi','status']
      .forEach(function(k){ if (d[k] !== undefined) row[k] = d[k] || null; });
    if (d.id_agenda) row.id_agenda = d.id_agenda;
    var { data, error } = await _sb.from('agenda_pembinaan')
      .upsert(row, { onConflict: 'id_agenda' }).select().single();
    _check(error, 'upsertAgendaPembinaan');
    return { status: 'ok', data: data };
  },

  hapusAgendaPembinaan: async function(id_agenda) {
    if (!id_agenda) return { status: 'error', message: 'id_agenda wajib diisi' };
    var { error } = await _sb.from('agenda_pembinaan').delete().eq('id_agenda', id_agenda);
    _check(error, 'hapusAgendaPembinaan');
    return { status: 'ok' };
  },

  // Pengingat MANUAL ke semua guru aktif (auto-jadwal berkala = butuh cron, di luar cakupan).
  ingatkanAgenda: async function(id_agenda) {
    if (!id_agenda) return { status: 'error', message: 'id_agenda wajib diisi' };
    var { data: ag, error } = await _sb.from('agenda_pembinaan')
      .select('judul, jadwal_teks').eq('id_agenda', id_agenda).maybeSingle();
    _check(error, 'ingatkanAgenda');
    if (!ag) return { status: 'error', message: 'Agenda tidak ditemukan' };
    var { data: gurus } = await _sb.from('users').select('id_user').eq('role', 'guru').eq('status', 'aktif');
    var ids = (gurus || []).map(function(g){ return g.id_user; });
    if (!ids.length) return { status: 'error', message: 'Tidak ada guru aktif' };
    _sendPushBg({
      user_ids: ids,
      title: '📅 ' + (ag.judul || 'Program Pembinaan'),
      body : (ag.jadwal_teks ? ag.jadwal_teks + ' — ' : '') + 'Yuk hadir & ikhtiar bersama 🌱',
      url  : '/Portal-Halaqah-Rattililquran/guru/index.html',
      tag  : 'agenda-' + id_agenda,
      data : { trigger: 'agenda_pembinaan' },
    });
    return { status: 'ok', jumlah: ids.length };
  },

  // Rapor pengajar: gabung kompetensi, evaluasi terakhir, ringkas tashih,
  // %hadir (mesin absensi), capaian murid (rata2 nilai_akhir raport halaqahnya), mutaba'ah terbuka.
  getRaporPengajar: async function(id_guru, id_periode) {
    if (!id_guru) return { status: 'error', message: 'id_guru wajib diisi' };
    // LB4 fix (bug hunt 2026-08-27): new Date() device-local -> _todayJakarta()
    // -- komponen "Kedisiplinan" (pctHadir) bisa terhitung dari bulan yg salah
    // di sekitar pergantian bulan kalau device server/pemanggil beda zona.
    var todayJkt = _todayJakarta();
    var [komp, tashih, evalr, mtb, hqRes, microRes] = await Promise.all([
      _sb.from('pengajar_kompetensi').select('*').eq('id_guru', id_guru).maybeSingle(),
      _sb.from('pengajar_tashih').select('hasil').eq('id_guru', id_guru),
      _sb.from('pengajar_evaluasi').select('*').eq('id_guru', id_guru).order('tanggal', { ascending: false }).limit(1),
      _sb.from('pengajar_mutabaah').select('id_mutabaah').eq('id_guru', id_guru).neq('status', 'selesai'),
      _sb.from('halaqah').select('id_halaqah').eq('id_guru', id_guru).eq('status', 'aktif'),
      // Micro Teaching = jenis_sesi di kbm_log → referensi rapor pengajar (RENCANA integrasi).
      _sb.from('kbm_log').select('id_kbm', { count: 'exact', head: true })
         .eq('id_guru', id_guru).eq('jenis_sesi', 'Micro Teaching').eq('status', 'selesai'),
    ]);
    _check(komp.error, 'getRaporPengajar');
    // Kedisiplinan ← %hadir dari mesin absensi (reuse _fetchAbsensiData/_deriveRekapAbsensi).
    var pctHadir = null;
    try {
      var absData = await _fetchAbsensiData({ bulan: Number(todayJkt.slice(5, 7)), tahun: Number(todayJkt.slice(0, 4)), scope: 'admin', id_guru: id_guru });
      var rekap = _deriveRekapAbsensi(absData);
      var gr = (rekap.guru || []).filter(function(g){ return g.id_guru === id_guru; })[0];
      pctHadir = gr ? gr.pct_kehadiran : null;
    } catch (e) { pctHadir = null; }
    // Capaian murid ← rata-rata nilai_akhir raport murid di halaqah guru.
    var hqIds = (hqRes.data || []).map(function(h){ return h.id_halaqah; });
    var capaian = null;
    if (hqIds.length) {
      var rq = _sb.from('raport').select('nilai_akhir').in('id_halaqah', hqIds).not('nilai_akhir', 'is', null);
      if (id_periode) rq = rq.eq('id_periode', id_periode);
      var { data: rap } = await rq;
      if (rap && rap.length) {
        capaian = Math.round(rap.reduce(function(s,r){ return s + Number(r.nilai_akhir||0); }, 0) / rap.length * 100) / 100;
      }
    }
    var tData = tashih.data || [];
    return { status: 'ok', data: {
      kompetensi: komp.data || null,
      evaluasi_terakhir: (evalr.data || [])[0] || null,
      tashih_total: tData.length,
      tashih_lulus: tData.filter(function(t){ return t.hasil === 'lulus'; }).length,
      pct_kehadiran: pctHadir, capaian_murid: capaian,
      mutabaah_terbuka: (mtb.data || []).length,
      micro_teaching: microRes.count || 0,
    }};
  },

  // Riwayat tashih & evaluasi seorang pengajar (admin/pembina — RLS memfilter).
  getTashihEvaluasiPengajar: async function(id_guru) {
    if (!id_guru) return { status: 'error', message: 'id_guru wajib diisi' };
    var [tashih, evalr] = await Promise.all([
      _sb.from('pengajar_tashih').select('*').eq('id_guru', id_guru).order('tanggal', { ascending: false }),
      _sb.from('pengajar_evaluasi').select('*').eq('id_guru', id_guru).order('tanggal', { ascending: false }),
    ]);
    _check(tashih.error, 'getTashihEvaluasiPengajar');
    return { status: 'ok', data: { tashih: tashih.data || [], evaluasi: evalr.data || [] } };
  },

  // Dashboard agregat: jumlah per jenjang, rata2 nilai evaluasi, mutaba'ah belum selesai.
  getDashboardPengajar: async function() {
    var [komp, mtb, evalr] = await Promise.all([
      _sb.from('pengajar_kompetensi').select('jenjang'),
      _sb.from('pengajar_mutabaah').select('id_mutabaah').neq('status', 'selesai'),
      _sb.from('pengajar_evaluasi').select('nilai_akhir').not('nilai_akhir', 'is', null),
    ]);
    _check(komp.error, 'getDashboardPengajar');
    var perJenjang = {};
    (komp.data || []).forEach(function(k){ perJenjang[k.jenjang] = (perJenjang[k.jenjang] || 0) + 1; });
    var evs = (evalr.data || []).map(function(e){ return Number(e.nilai_akhir); });
    var avg = evs.length ? Math.round(evs.reduce(function(s,x){ return s+x; }, 0) / evs.length * 100) / 100 : null;
    return { status: 'ok', data: {
      per_jenjang: perJenjang, total_pengajar: (komp.data || []).length,
      rata_nilai_evaluasi: avg, mutabaah_belum_selesai: (mtb.data || []).length,
    }};
  },

  setApresiasi: async function(d) {
    d = d || {};
    if (!d.id_guru) return { status: 'error', message: 'id_guru wajib diisi' };
    var { data, error } = await _sb.from('pengajar_apresiasi').insert({
      id_guru: d.id_guru, id_periode: d.id_periode || null, jenis: d.jenis || 'teladan',
      keterangan: d.keterangan || null, tanggal: d.tanggal || undefined,
    }).select().single();
    _check(error, 'setApresiasi');
    return { status: 'ok', data: data };
  },

  // Daftar apresiasi (opsional per pengajar). Admin baca semua (RLS).
  getApresiasiList: async function(id_guru) {
    var q = _sb.from('pengajar_apresiasi').select('*').order('tanggal', { ascending: false }).limit(50);
    if (id_guru) q = q.eq('id_guru', id_guru);
    var { data, error } = await q;
    _check(error, 'getApresiasiList');
    return { status: 'ok', data: data || [] };
  },

  hapusApresiasi: async function(id_apresiasi) {
    if (!id_apresiasi) return { status: 'error', message: 'id_apresiasi wajib diisi' };
    var { error } = await _sb.from('pengajar_apresiasi').delete().eq('id_apresiasi', id_apresiasi);
    _check(error, 'hapusApresiasi');
    return { status: 'ok' };
  },

  // ── Kelola kelompok pengajar (peer) ──
  upsertKelompokPengajar: async function(d) {
    d = d || {};
    if (!d.nama_kelompok) return { status: 'error', message: 'nama_kelompok wajib diisi' };
    var row = { nama_kelompok: d.nama_kelompok, fokus: d.fokus || null,
      id_koordinator: d.id_koordinator || null, jadwal: d.jadwal || null, status: d.status || 'aktif' };
    if (d.id_kelompok) row.id_kelompok = d.id_kelompok;
    var { data, error } = await _sb.from('kelompok_pengajar').upsert(row, { onConflict: 'id_kelompok' }).select().single();
    _check(error, 'upsertKelompokPengajar');
    return { status: 'ok', data: data };
  },

  // Semua kelompok pengajar + anggotanya (admin: RLS is_admin() memberi akses penuh).
  getKelompokPengajarAdmin: async function() {
    var [kel, ang] = await Promise.all([
      _sb.from('kelompok_pengajar').select('*').order('created_at', { ascending: false }),
      _sb.from('anggota_kelompok_pengajar').select('*'),
    ]);
    _check(kel.error, 'getKelompokPengajarAdmin');
    var byKel = {};
    (ang.data || []).forEach(function(a){ (byKel[a.id_kelompok] || (byKel[a.id_kelompok] = [])).push(a); });
    return { status: 'ok', data: (kel.data || []).map(function(k){
      return Object.assign({}, k, { anggota: byKel[k.id_kelompok] || [] });
    })};
  },

  // Hapus kelompok pengajar (cascade menghapus anggota/setoran/target/milestone).
  deleteKelompokPengajar: async function(id_kelompok) {
    if (!id_kelompok) return { status: 'error', message: 'id_kelompok wajib diisi' };
    var { error } = await _sb.from('kelompok_pengajar').delete().eq('id_kelompok', id_kelompok);
    _check(error, 'deleteKelompokPengajar');
    return { status: 'ok' };
  },

  // Pengingat MANUAL (push) ke anggota kelompok agar melanjutkan setoran peer.
  // Auto-jadwal berkala (mingguan/bulanan) = butuh cron/edge terjadwal (di luar cakupan ini).
  ingatkanKelompokPengajar: async function(id_kelompok, pesan) {
    if (!id_kelompok) return { status: 'error', message: 'id_kelompok wajib diisi' };
    var { data: ang, error } = await _sb.from('anggota_kelompok_pengajar')
      .select('id_guru').eq('id_kelompok', id_kelompok);
    _check(error, 'ingatkanKelompokPengajar');
    var ids = (ang || []).map(function(a){ return a.id_guru; });
    if (!ids.length) return { status: 'error', message: 'Kelompok belum punya anggota' };
    _sendPushBg({
      user_ids: ids,
      title: '🤝 Halaqah Pengajar',
      body : (pesan && pesan.trim().slice(0, 140)) || 'Yuk lanjutkan setoran makhraj/sifat/dalil bersama rekan pekan ini 🌱',
      url  : '/Portal-Halaqah-Rattililquran/guru/index.html',
      tag  : 'pengajar-reminder-' + id_kelompok,
      data : { trigger: 'pengajar_peer' },
    });
    return { status: 'ok', jumlah: ids.length };
  },

  // Atur anggota kelompok PENGAJAR (replace-set). listGuru = [{ id_guru, nama_guru, peran }].
  // NB: nama sengaja dibedakan dari setAnggotaKelompok (itu utk kelompok MURID) — hindari tabrakan key.
  setAnggotaKelompokPengajar: async function(id_kelompok, listGuru) {
    if (!id_kelompok || !Array.isArray(listGuru)) return { status: 'error', message: 'id_kelompok & listGuru wajib diisi' };
    var { error: delErr } = await _sb.from('anggota_kelompok_pengajar').delete().eq('id_kelompok', id_kelompok);
    _check(delErr, 'setAnggotaKelompok:delete');
    var rows = listGuru.map(function(g){ return {
      id_kelompok: id_kelompok, id_guru: g.id_guru, nama_guru: g.nama_guru || null, peran: g.peran || 'anggota',
    }; });
    if (rows.length) {
      var { error } = await _sb.from('anggota_kelompok_pengajar').insert(rows);
      _check(error, 'setAnggotaKelompok:insert');
    }
    return { status: 'ok' };
  },

  // Pantau lintas kelompok: keaktifan setoran & kategori tersering (apresiatif, bukan peringkat individu).
  getPantauPeer: async function() {
    var [kel, setoran] = await Promise.all([
      _sb.from('kelompok_pengajar').select('id_kelompok, nama_kelompok, status'),
      _sb.from('pengajar_setoran').select('id_kelompok, kategori'),
    ]);
    _check(kel.error, 'getPantauPeer');
    var perKel = {}, perKat = {};
    (setoran.data || []).forEach(function(s){
      perKel[s.id_kelompok] = (perKel[s.id_kelompok] || 0) + 1;
      perKat[s.kategori] = (perKat[s.kategori] || 0) + 1;
    });
    return { status: 'ok', data: {
      kelompok: (kel.data || []).map(function(k){ return Object.assign({}, k, { jumlah_setoran: perKel[k.id_kelompok] || 0 }); }),
      total_setoran: (setoran.data || []).length, kategori: perKat,
    }};
  },
};

// ── attach ke window.HQ ──
window.HQ = window.HQ || {};
window.HQ.GuruAPI = GuruAPI;
window.HQ.AdminAPI = AdminAPI;
window.HQ.SuperAdminAPI = AdminAPI;
