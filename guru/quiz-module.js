// ============================================================
//  guru/quiz-module.js  v1.0
//  Portal Guru — Rattil Quiz Management & Analytics
// ============================================================

(function () {
  'use strict';

  var _activeTab = 'kuis'; // 'kuis' | 'bank' | 'review' | 'laporan'
  var _selectedQuizId = null;

  // Filter state for bank soal
  var _bankFilterText = '';
  var _bankFilterLevel = '';
  var _bankFilterPertemuan = '';
  var _allBankSoalRaw = [];
  var _parsedImportSoal = [];

  // Filter & bulk select state for quiz question picker
  var _pickerFilterText = '';
  var _pickerFilterLevel = '';
  var _pickerFilterPertemuan = '';
  var _pickerAvailableSoal = [];
  var _pickerSelectedSoalIds = new Set();
  var _currentQuizData = null;

  // ─────────────────────────────────────────────
  //  1. RENDER GURU QUIZ PAGE
  // ─────────────────────────────────────────────
  window.renderGuruQuizPage = async function () {
    var container = document.getElementById('page-kuis-guru');
    if (!container) return;

    container.innerHTML = `
      <div class="guru-quiz-container">
        <!-- Sub-header & Navigation Tabs -->
        <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:16px 20px;border:1px solid var(--border);box-shadow:var(--shadow);margin-bottom:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
            <div>
              <h2 style="font-size:18px;font-weight:800;color:var(--text)">🎯 Manajemen Rattil Quiz</h2>
              <p style="font-size:12px;color:var(--text-3)">Buat kuis latihan, kelola bank soal, & tinjau hasil halaqah</p>
            </div>
            <button onclick="openModalCreateKuis()" style="padding:10px 18px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-size:12px;font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">
              ➕ Buat Kuis Baru
            </button>
          </div>

          <div style="display:inline-flex;background:rgba(0,0,0,0.04);padding:4px;border-radius:100px;border:1px solid rgba(0,0,0,0.03);overflow-x:auto;max-width:100%;">
            <button onclick="switchGuruQuizTab('kuis', this)" class="gquiz-tab active" style="padding:8px 18px;border:none;border-radius:100px;background:#fff;font-family:inherit;font-size:13px;font-weight:800;color:var(--blue-d);box-shadow:0 2px 6px rgba(0,0,0,0.05);cursor:pointer;transition:all 0.2s ease;white-space:nowrap;display:flex;align-items:center;gap:6px;">
              📋 Daftar Kuis
            </button>
            <button onclick="switchGuruQuizTab('bank', this)" class="gquiz-tab" style="padding:8px 18px;border:none;border-radius:100px;background:transparent;font-family:inherit;font-size:13px;font-weight:700;color:var(--text-3);cursor:pointer;transition:all 0.2s ease;white-space:nowrap;display:flex;align-items:center;gap:6px;">
              📦 Bank Soal
            </button>
            <button onclick="switchGuruQuizTab('review', this)" class="gquiz-tab" style="padding:8px 18px;border:none;border-radius:100px;background:transparent;font-family:inherit;font-size:13px;font-weight:700;color:var(--text-3);cursor:pointer;transition:all 0.2s ease;white-space:nowrap;display:flex;align-items:center;gap:6px;">
              ⏳ Antrian Review Isian <span id="badgeAntrianReview" style="background:var(--red);color:#fff;border-radius:100px;font-size:10px;padding:1px 6px;margin-left:4px;display:none;">0</span>
            </button>
          </div>
        </div>

        <!-- Dynamic Sub-Tab Content -->
        <div id="guruQuizTabContent">
          <div style="text-align:center;padding:40px;color:var(--text-3);">Memuat data kuis...</div>
        </div>

        <!-- Modals Container -->
        <div id="guruQuizModalContainer"></div>
      </div>
    `;

    await loadGuruQuizTabContent();
  };

  window.switchGuruQuizTab = function (tabName, btnEl) {
    _activeTab = tabName;
    document.querySelectorAll('.gquiz-tab').forEach(function (b) {
      b.style.color = 'var(--text-3)';
      b.style.background = 'transparent';
      b.style.boxShadow = 'none';
      b.style.fontWeight = '700';
      b.classList.remove('active');
    });
    if (btnEl) {
      btnEl.style.color = 'var(--blue-d)';
      btnEl.style.background = '#fff';
      btnEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.05)';
      btnEl.style.fontWeight = '800';
      btnEl.classList.add('active');
    }
    loadGuruQuizTabContent();
  };

  async function loadGuruQuizTabContent() {
    var contentEl = document.getElementById('guruQuizTabContent');
    if (!contentEl) return;

    if (_activeTab === 'kuis') {
      await renderDaftarKuis(contentEl);
    } else if (_activeTab === 'bank') {
      await renderBankSoal(contentEl);
    } else if (_activeTab === 'review') {
      await renderAntrianReview(contentEl);
    }
  }

  // ─────────────────────────────────────────────
  //  2. TAB 1: DAFTAR KUIS GURU
  // ─────────────────────────────────────────────
  async function renderDaftarKuis(container) {
    try {
      var res = await window.HQ.QuizAPI.getKuisList();
      var list = res.data || [];

      if (list.length === 0) {
        container.innerHTML = `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:40px 20px;text-align:center;border:1px solid var(--border);box-shadow:var(--shadow);">
            <div style="font-size:42px;margin-bottom:12px;">📝</div>
            <h3 style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:4px;">Belum Ada Kuis</h3>
            <p style="font-size:12px;color:var(--text-3);margin-bottom:16px;">Klik tombol "Buat Kuis Baru" di atas untuk membuat kuis pertama Anda.</p>
            <button onclick="openModalCreateKuis()" style="padding:10px 20px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-size:12px;font-weight:800;cursor:pointer;">
              ➕ Buat Kuis Pertama
            </button>
          </div>
        `;
        return;
      }

      var html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px;">';
      list.forEach(function (q) {
        var statusColor = q.status === 'aktif' ? 'background:var(--green-l);color:var(--green);' : q.status === 'selesai' ? 'background:var(--bg-2);color:var(--text-3);' : 'background:var(--amber-l);color:var(--amber-txt);';
        var halaqahNames = (q.assigned_halaqah || []).map(function(h){ return h.nama_halaqah; }).join(', ') || 'Belum di-assign';

        html += `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:18px;border:1px solid var(--border);box-shadow:var(--shadow);display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <span style="font-size:10px;font-weight:800;padding:3px 10px;border-radius:100px;text-transform:uppercase;${statusColor}">
                  ● ${q.status}
                </span>
                <span style="font-size:11px;font-weight:700;color:var(--text-3);">
                  ${q.total_soal} Soal
                </span>
              </div>

              <h3 style="font-size:15px;font-weight:800;color:var(--text);margin-bottom:6px;">${escapeHtml(q.judul)}</h3>
              <p style="font-size:12px;color:var(--text-2);margin-bottom:12px;">${escapeHtml(q.deskripsi || 'Tidak ada deskripsi.')}</p>

              <div style="font-size:11px;color:var(--text-3);background:var(--bg-2);padding:8px 12px;border-radius:var(--r-sm);margin-bottom:14px;">
                <div>👥 <strong>Halaqah:</strong> ${escapeHtml(halaqahNames)}</div>
                <div style="margin-top:2px;">⏱️ <strong>Durasi:</strong> ${q.durasi_per_soal_detik ? q.durasi_per_soal_detik + ' dtk/soal' : 'Tanpa batas'}</div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
              <button onclick="manageSoalKuis('${escapeJsStr(q.id_quiz)}')" style="padding:9px 8px;background:var(--blue-l);color:var(--blue-d);border:1.5px solid rgba(37,99,235,0.12);border-radius:10px;font-weight:800;font-size:11.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;transition:all 0.2s;">
                ⚙️ Kelola Soal (${q.total_soal})
              </button>
              <button onclick="viewHasilKuisGuru('${escapeJsStr(q.id_quiz)}')" style="padding:9px 8px;background:rgba(16,185,129,0.08);color:#059669;border:1.5px solid rgba(16,185,129,0.15);border-radius:10px;font-weight:800;font-size:11.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;transition:all 0.2s;">
                📊 Laporan & Hasil
              </button>
              <button onclick="openModalEditKuis('${escapeJsStr(q.id_quiz)}')" style="padding:9px 8px;background:var(--bg-2);color:var(--text-2);border:1.5px solid var(--border);border-radius:10px;font-weight:800;font-size:11.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;transition:all 0.2s;">
                ✏️ Edit Setting
              </button>
              <button onclick="deleteKuisConfirm('${escapeJsStr(q.id_quiz)}')" style="padding:9px 8px;background:var(--red-l);color:var(--red);border:1.5px solid rgba(239,68,68,0.12);border-radius:10px;font-weight:800;font-size:11.5px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px;transition:all 0.2s;">
                🗑️ Hapus
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      console.error('[QuizGuru] Load error:', err);
      container.innerHTML = '<div style="color:var(--red);text-align:center;">Gagal memuat daftar kuis.</div>';
    }
  }

  // ─────────────────────────────────────────────
  //  3. TAB 2: BANK SOAL GURU
  // ─────────────────────────────────────────────
  function getTipeSoalLabel(tipe) {
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

  async function renderBankSoal(container) {
    var headerHtml = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:12px;">
        <div>
          <h3 style="font-size:15px;font-weight:800;color:var(--text);">📦 Bank Soal Bersama</h3>
          <p style="font-size:11px;color:var(--text-3);">Semua pengajar dapat menggunakan soal-soal ini di kuis halaqah masing-masing.</p>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="bukaModalImportSoalGuru()" style="padding:8px 16px;background:var(--blue-l);color:var(--blue-d);border:1px solid var(--blue);border-radius:var(--r-pill,100px);font-weight:800;font-size:12px;cursor:pointer;">
            📥 Import CSV
          </button>
          <button onclick="openModalCreateSoal()" style="padding:8px 16px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;font-size:12px;cursor:pointer;box-shadow:var(--shadow-blue);">
            ➕ Buat Soal Baru
          </button>
        </div>
      </div>

      <!-- Filter Panel -->
      <div style="background:var(--card-solid);padding:14px;border-radius:var(--r-lg);border:1px solid var(--border);margin-bottom:16px;box-shadow:var(--shadow);display:flex;flex-wrap:wrap;gap:12px;align-items:center;">
        <!-- Search input -->
        <div style="flex:2;min-width:200px;position:relative;">
          <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:14px;color:var(--text-3);">🔍</span>
          <input type="text" id="bankSearchInput" oninput="onBankSearchInput(this.value)" placeholder="Cari teks soal..." value="${escapeHtml(_bankFilterText)}" style="width:100%;padding:10px 10px 10px 34px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;background:#fff;color:var(--text);">
        </div>
        <!-- Level Select -->
        <div style="flex:1;min-width:150px;">
          <select id="bankLevelSelect" onchange="onBankLevelFilterChange(this.value)" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;background:#fff;color:var(--text);outline:none;">
            <option value="">— Semua Level —</option>
            <option value="Level 1" ${_bankFilterLevel === 'Level 1' ? 'selected' : ''}>Level 1</option>
            <option value="Level 2" ${_bankFilterLevel === 'Level 2' ? 'selected' : ''}>Level 2</option>
            <option value="Level 3" ${_bankFilterLevel === 'Level 3' ? 'selected' : ''}>Level 3</option>
            <option value="Level Qiyam" ${_bankFilterLevel === 'Level Qiyam' ? 'selected' : ''}>Level Qiyam</option>
            <option value="Micro Teaching" ${_bankFilterLevel === 'Micro Teaching' ? 'selected' : ''}>Micro Teaching</option>
            <option value="Tahsin Al-Fatihah" ${_bankFilterLevel === 'Tahsin Al-Fatihah' ? 'selected' : ''}>Tahsin Al-Fatihah</option>
          </select>
        </div>
        <!-- Pertemuan Ke- Input -->
        <div style="flex:1;min-width:120px;">
          <input type="number" id="bankPertemuanInput" oninput="onBankPertemuanFilterChange(this.value)" placeholder="Pertemuan ke-" value="${escapeHtml(_bankFilterPertemuan)}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;background:#fff;color:var(--text);">
        </div>
      </div>

      <style>
        .bank-soal-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow-lg) !important;
          border-color: var(--blue) !important;
        }
        .btn-delete-soal:hover {
          background: var(--red) !important;
          color: #fff !important;
        }
      </style>

      <div id="bankSoalListContainer">
        <div style="text-align:center;padding:30px;color:var(--text-3);">Memuat daftar bank soal...</div>
      </div>
    `;

    container.innerHTML = headerHtml;

    await reloadBankList();
  }

  window.onBankSearchInput = function (val) {
    _bankFilterText = val;
    filterAndRenderBankList();
  };

  window.onBankLevelFilterChange = async function (val) {
    _bankFilterLevel = val;
    await reloadBankList();
  };

  window.onBankPertemuanFilterChange = async function (val) {
    _bankFilterPertemuan = val;
    await reloadBankList();
  };

  async function reloadBankList() {
    var listContainer = document.getElementById('bankSoalListContainer');
    if (listContainer && listContainer.innerHTML === '') {
      listContainer.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-3);">Memuat daftar bank soal...</div>';
    }
    try {
      var res = await window.HQ.QuizAPI.getBankSoal(null, null, _bankFilterLevel || null, _bankFilterPertemuan || null);
      _allBankSoalRaw = res.data || [];
      filterAndRenderBankList();
    } catch (err) {
      if (listContainer) {
        listContainer.innerHTML = '<div style="color:var(--red);text-align:center;padding:20px;">Gagal memuat bank soal.</div>';
      }
    }
  }

  // ── Helper bersama: kelompokkan & urutkan soal per level lalu per pertemuan ──
  var LEVEL_ORDER = ['Level 1', 'Level 2', 'Level 3', 'Level Qiyam', 'Micro Teaching', 'Tahsin Al-Fatihah'];

  function _levelRank(lvl) {
    var i = LEVEL_ORDER.indexOf(lvl);
    return i === -1 ? LEVEL_ORDER.length : i;
  }

  // Level utama sebuah soal = level tercentang yang paling awal di urutan kurikulum.
  function _primaryLevel(s) {
    var lvls = (s.levels || []).slice();
    if (!lvls.length) return null;
    lvls.sort(function (a, b) { return _levelRank(a) - _levelRank(b); });
    return lvls[0];
  }

  // Bagi daftar soal menjadi seksi per-level (urut kurikulum, "Tanpa Level" di akhir),
  // isi tiap seksi diurutkan naik berdasarkan rekomendasi pertemuan (null di bawah).
  function groupSoalByLevel(list) {
    var groups = {};
    list.forEach(function (s) {
      var key = _primaryLevel(s) || '__none__';
      (groups[key] = groups[key] || []).push(s);
    });
    return Object.keys(groups).sort(function (a, b) {
      if (a === '__none__') return 1;
      if (b === '__none__') return -1;
      var ra = _levelRank(a), rb = _levelRank(b);
      return ra !== rb ? ra - rb : a.localeCompare(b);
    }).map(function (k) {
      var items = groups[k].slice().sort(function (x, y) {
        var px = x.rekomendasi_pertemuan_ke, py = y.rekomendasi_pertemuan_ke;
        var nx = (px === null || px === undefined), ny = (py === null || py === undefined);
        if (nx && ny) return 0;
        if (nx) return 1;
        if (ny) return -1;
        return px - py;
      });
      return { level: k === '__none__' ? null : k, items: items };
    });
  }

  function levelSectionHeader(level, count, compact) {
    var label = level || 'Tanpa Level';
    var chip = level
      ? 'background:rgba(16,185,129,0.12);color:#059669;'
      : 'background:var(--bg-2);color:var(--text-3);';
    var mtop = compact ? '8px' : '18px';
    var fs = compact ? '11px' : '12px';
    return `
      <div style="display:flex;align-items:center;gap:8px;margin:${mtop} 0 8px;grid-column:1/-1;">
        <span style="font-size:${fs};font-weight:800;${chip}padding:4px 12px;border-radius:100px;white-space:nowrap;">📗 ${escapeHtml(label)}</span>
        <span style="font-size:10.5px;font-weight:700;color:var(--text-3);white-space:nowrap;">${count} soal</span>
        <div style="flex:1;height:1px;background:var(--border);"></div>
      </div>`;
  }

  function bankSoalCardHtml(s, num, currentUserId) {
    var authorName = s.users ? s.users.nama_lengkap : 'Pengajar';
    var isOwner = s.id_guru === currentUserId;

    return `
        <div class="bank-soal-card" style="background:var(--card-solid);border-radius:var(--r-lg);padding:18px;border:1px solid var(--border);box-shadow:var(--shadow);transition:all 0.25s ease;display:flex;flex-direction:column;justify-content:space-between;gap:12px;position:relative;">
          <div>
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;">
              <div style="display:flex;flex-direction:column;gap:6px;min-width:0;flex:1;">
                <!-- Badges -->
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <span style="font-size:10px;font-weight:800;background:var(--blue-l);color:var(--blue-d);padding:2px 8px;border-radius:100px;text-transform:uppercase;letter-spacing:0.02em;">
                    ${getTipeSoalLabel(s.tipe_soal)}
                  </span>
                  ${(s.levels || []).map(function(lvl) {
                    return `<span style="font-size:10px;font-weight:800;background:rgba(16,185,129,0.1);color:#059669;padding:2px 8px;border-radius:100px;">${escapeHtml(lvl)}</span>`;
                  }).join('')}
                  ${s.rekomendasi_pertemuan_ke ? `
                    <span style="font-size:10px;font-weight:800;background:rgba(245,158,11,0.1);color:var(--amber-txt);padding:2px 8px;border-radius:100px;">
                      📍 Pertemuan ${s.rekomendasi_pertemuan_ke}
                    </span>
                  ` : ''}
                </div>
                <!-- Question text -->
                <div style="font-size:13.5px;font-weight:700;color:var(--text);line-height:1.45;margin-top:4px;word-break:break-word;">
                  ${num}. ${escapeHtml(s.teks_soal)}
                </div>
              </div>

              <!-- Actions -->
              ${isOwner ? `
                <div style="display:flex;gap:4px;">
                  <button onclick="openModalCreateSoal('', '${escapeJsStr(s.id_soal)}')" class="btn-edit-soal" style="background:var(--blue-l);color:var(--blue-d);border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;" title="Edit Soal">
                    ✏️
                  </button>
                  <button onclick="deleteSoalConfirm('${escapeJsStr(s.id_soal)}')" class="btn-delete-soal" style="background:var(--red-l);color:var(--red);border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;" title="Hapus Soal">
                    🗑️
                  </button>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Footer Meta Info -->
          <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:10px;font-size:10.5px;color:var(--text-3);">
            <span>Oleh: <strong>${escapeHtml(authorName)}</strong> ${isOwner ? '(Saya)' : ''}</span>
            <span>Dibuat: ${new Date(s.created_at).toLocaleDateString('id-ID', {day: 'numeric', month: 'short'})}</span>
          </div>
        </div>
      `;
  }

  function filterAndRenderBankList() {
    var container = document.getElementById('bankSoalListContainer');
    if (!container) return;

    var filtered = _allBankSoalRaw.filter(function (s) {
      if (!_bankFilterText) return true;
      var term = _bankFilterText.toLowerCase();
      return (s.teks_soal || '').toLowerCase().includes(term) ||
             (s.users && s.users.nama_lengkap || '').toLowerCase().includes(term);
    });

    if (filtered.length === 0) {
      container.innerHTML = '<div style="background:var(--card-solid);padding:40px;border-radius:var(--r-lg);text-align:center;color:var(--text-3);border:1px dashed var(--border);grid-column: 1 / -1;">Tidak ada soal yang cocok dengan filter pencarian.</div>';
      return;
    }

    var currentUserId = window.HQ.getCurrentUser().id_user;
    var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:16px;">';
    groupSoalByLevel(filtered).forEach(function (g) {
      html += levelSectionHeader(g.level, g.items.length, false);
      g.items.forEach(function (s, idx) {
        html += bankSoalCardHtml(s, idx + 1, currentUserId);
      });
    });
    html += '</div>';
    container.innerHTML = html;
  }

  // ─────────────────────────────────────────────
  //  4. TAB 3: ANTRIAN REVIEW ISIAN SINGKAT
  // ─────────────────────────────────────────────
  async function renderAntrianReview(container) {
    try {
      var res = await window.HQ.QuizAPI.getAntrianReviewIsian();
      var list = res.data || [];

      var badgeEl = document.getElementById('badgeAntrianReview');
      if (badgeEl) {
        if (list.length > 0) {
          badgeEl.textContent = list.length;
          badgeEl.style.display = 'inline-block';
        } else {
          badgeEl.style.display = 'none';
        }
      }

      if (list.length === 0) {
        container.innerHTML = `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:40px 20px;text-align:center;border:1px solid var(--border);">
            <div style="font-size:42px;margin-bottom:8px;">✅</div>
            <h3 style="font-size:15px;font-weight:800;color:var(--text);">Antrian Review Kosong</h3>
            <p style="font-size:12px;color:var(--text-3);">Semua jawaban isian singkat murid sudah diperiksa.</p>
          </div>
        `;
        return;
      }

      var html = '<div style="display:flex;flex-direction:column;gap:12px;">';
      list.forEach(function (item) {
        var muridName = item.users ? item.users.nama_lengkap : 'Murid';
        var soalText = item.soal ? item.soal.teks_soal : '';

        html += `
          <div style="background:var(--card-solid);border-radius:var(--r-lg);padding:18px;border:1px solid var(--border);box-shadow:var(--shadow);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
              <span style="font-size:13px;font-weight:800;color:var(--text);">${escapeHtml(muridName)}</span>
              <span style="font-size:10px;font-weight:800;background:var(--amber-l);color:var(--amber-txt);padding:2px 8px;border-radius:100px;">⏳ Menunggu Review</span>
            </div>

            <div style="font-size:12px;color:var(--text-2);margin-bottom:8px;">
              <strong>Soal:</strong> ${escapeHtml(soalText)}
            </div>

            <div style="background:var(--bg-2);padding:10px 14px;border-radius:var(--r-sm);margin-bottom:12px;font-size:13px;">
              Jawaban Murid: <strong style="color:var(--blue-d);">${escapeHtml(item.teks_jawaban_isian)}</strong>
            </div>

            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button onclick="prosesReviewIsian('${escapeJsStr(item.id_jawaban)}', true, false)" style="padding:8px 14px;background:var(--green-l);color:var(--green-d);border:none;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;">
                ✅ Terima
              </button>
              <button onclick="prosesReviewIsian('${escapeJsStr(item.id_jawaban)}', true, true)" style="padding:8px 14px;background:var(--blue-l);color:var(--blue-d);border:none;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;">
                📖 + Kunci Jawaban
              </button>
              <button onclick="prosesReviewIsian('${escapeJsStr(item.id_jawaban)}', false, false)" style="padding:8px 14px;background:var(--red-l);color:var(--red);border:none;border-radius:var(--r-sm);font-weight:700;font-size:12px;cursor:pointer;">
                ❌ Tolak
              </button>
            </div>
          </div>
        `;
      });
      html += '</div>';
      container.innerHTML = html;
    } catch (err) {
      container.innerHTML = '<div style="color:var(--red);text-align:center;">Gagal memuat antrian review.</div>';
    }
  }

  window.prosesReviewIsian = async function (id_jawaban, disetujui, simpanVarian) {
    try {
      showLoading('Memproses review...');
      await window.HQ.QuizAPI.reviewIsianSingkat(id_jawaban, disetujui, simpanVarian);
      hideLoading();
      await loadGuruQuizTabContent();
    } catch (err) {
      hideLoading();
      alert('Gagal memproses review: ' + err.message);
    }
  };

  // ─────────────────────────────────────────────
  //  5. MODAL HANDLERS & ACTIONS
  // ─────────────────────────────────────────────
  window.closeGuruQuizModal = function () {
    var el = document.getElementById('guruQuizModalContainer');
    if (el) el.innerHTML = '';
  };

  window.openModalCreateKuis = async function () {
    var modalEl = document.getElementById('guruQuizModalContainer');
    if (!modalEl) return;

    showLoading('Memuat daftar halaqah...');
    var halaqahList = [];
    try {
      var id_guru = window.HQ.getCurrentUser().id_user;
      var { data } = await window.HQ.supabase.from('halaqah').select('*').eq('id_guru', id_guru).eq('status', 'aktif');
      halaqahList = data || [];
    } catch(e) {}
    hideLoading();

    var halaqahOptionsHtml = halaqahList.map(function(h) {
      return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" name="id_halaqah" value="${h.id_halaqah}"> ${escapeHtml(h.nama_halaqah)} (${escapeHtml(h.level)})</label>`;
    }).join('') || '<div style="font-size:12px;color:var(--text-3);">Belum ada halaqah aktif.</div>';

    modalEl.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeGuruQuizModal()">
        <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="font-size:16px;font-weight:800;color:var(--text)">➕ Buat Kuis Baru</h3>
            <button onclick="closeGuruQuizModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
          </div>

          <form onsubmit="submitFormCreateKuis(event)">
            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">JUDUL KUIS *</label>
              <input type="text" id="cqJudul" required placeholder="mis. Kuis Hukum Nun Mati & Tanwin" style="width:100%;padding:10px 12px;border-radius:var(--r-sm,12px);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;">
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DESKRIPSI / INSTRUKSI</label>
              <textarea id="cqDeskripsi" rows="2" placeholder="Petunjuk pengerjaan kuis untuk murid..." style="width:100%;padding:10px 12px;border-radius:var(--r-sm,12px);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;resize:vertical;"></textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">KATEGORI</label>
                <select id="cqKategori" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="Tajwid">Tajwid</option>
                  <option value="Makharijul Huruf">Makharijul Huruf</option>
                  <option value="Hafalan">Hafalan</option>
                  <option value="Murajaah">Murajaah</option>
                  <option value="Umum" selected>Umum</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">STATUS</label>
                <select id="cqStatus" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="draft">Draft (Disimpan saja)</option>
                  <option value="aktif" selected>Aktif (Dapat Dikerjakan)</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DURASI PER SOAL (DETIK)</label>
                <input type="number" id="cqDurasi" value="30" placeholder="0 = tanpa batas" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">URUTAN SOAL</label>
                <select id="cqUrutan" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="berurutan">Berurutan</option>
                  <option value="acak">Acak (Random)</option>
                </select>
              </div>
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">ASSIGN KE HALAQAH *</label>
              <div style="background:var(--bg-2);padding:10px;border-radius:var(--r-sm);display:flex;flex-direction:column;gap:6px;max-height:120px;overflow-y:auto;">
                ${halaqahOptionsHtml}
              </div>
            </div>

            <div style="display:flex;gap:10px;margin-top:18px;">
              <button type="button" onclick="closeGuruQuizModal()" style="flex:1;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;">Batal</button>
              <button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">Simpan Kuis</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  window.submitFormCreateKuis = async function (e) {
    e.preventDefault();
    var idHalaqahList = Array.from(document.querySelectorAll('input[name="id_halaqah"]:checked')).map(function(c){ return c.value; });

    var payload = {
      judul: document.getElementById('cqJudul').value.trim(),
      deskripsi: document.getElementById('cqDeskripsi').value.trim(),
      kategori: document.getElementById('cqKategori').value,
      status: document.getElementById('cqStatus').value,
      durasi_per_soal_detik: parseInt(document.getElementById('cqDurasi').value) || null,
      urutan_soal: document.getElementById('cqUrutan').value,
      id_halaqah_list: idHalaqahList
    };

    try {
      showLoading('Membuat kuis...');
      await window.HQ.QuizAPI.createKuis(payload);
      hideLoading();
      closeGuruQuizModal();
      await loadGuruQuizTabContent();
    } catch (err) {
      hideLoading();
      alert('Gagal membuat kuis: ' + err.message);
    }
  };

  window.openModalEditKuis = async function (id_quiz) {
    var modalEl = document.getElementById('guruQuizModalContainer');
    if (!modalEl) return;

    showLoading('Memuat detail kuis...');
    var halaqahList = [];
    var kuisData = null;
    try {
      var id_guru = window.HQ.getCurrentUser().id_user;
      
      // Fetch halaqah
      var { data: hList } = await window.HQ.supabase.from('halaqah').select('*').eq('id_guru', id_guru).eq('status', 'aktif');
      halaqahList = hList || [];
      
      // Fetch quiz detail with its assigned halaqah
      var { data: qData } = await window.HQ.supabase.from('quiz').select('*, quiz_halaqah(id_halaqah)').eq('id_quiz', id_quiz).single();
      kuisData = qData;
    } catch(e) {
      alert('Gagal memuat detail kuis: ' + e.message);
      hideLoading();
      return;
    }
    hideLoading();

    if (!kuisData) return;

    var assignedHalaqahIds = (kuisData.quiz_halaqah || []).map(function(qh) { return qh.id_halaqah; });

    var halaqahOptionsHtml = halaqahList.map(function(h) {
      var isChecked = assignedHalaqahIds.indexOf(h.id_halaqah) !== -1 ? 'checked' : '';
      return `<label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;"><input type="checkbox" name="id_halaqah" value="${h.id_halaqah}" ${isChecked}> ${escapeHtml(h.nama_halaqah)} (${escapeHtml(h.level)})</label>`;
    }).join('') || '<div style="font-size:12px;color:var(--text-3);">Belum ada halaqah aktif.</div>';

    modalEl.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeGuruQuizModal()">
        <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="font-size:16px;font-weight:800;color:var(--text)">✏️ Edit Setting Kuis</h3>
            <button onclick="closeGuruQuizModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
          </div>

          <form onsubmit="submitFormEditKuis(event, '${escapeJsStr(kuisData.id_quiz)}')">
            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">JUDUL KUIS *</label>
              <input type="text" id="eqJudul" required value="${escapeHtml(kuisData.judul)}" placeholder="mis. Kuis Hukum Nun Mati & Tanwin" style="width:100%;padding:10px 12px;border-radius:var(--r-sm,12px);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;">
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DESKRIPSI / INSTRUKSI</label>
              <textarea id="eqDeskripsi" rows="2" placeholder="Petunjuk pengerjaan kuis untuk murid..." style="width:100%;padding:10px 12px;border-radius:var(--r-sm,12px);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;resize:vertical;">${escapeHtml(kuisData.deskripsi || '')}</textarea>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">KATEGORI</label>
                <select id="eqKategori" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="Tajwid" ${kuisData.kategori === 'Tajwid' ? 'selected' : ''}>Tajwid</option>
                  <option value="Makharijul Huruf" ${kuisData.kategori === 'Makharijul Huruf' ? 'selected' : ''}>Makharijul Huruf</option>
                  <option value="Hafalan" ${kuisData.kategori === 'Hafalan' ? 'selected' : ''}>Hafalan</option>
                  <option value="Murajaah" ${kuisData.kategori === 'Murajaah' ? 'selected' : ''}>Murajaah</option>
                  <option value="Umum" ${kuisData.kategori === 'Umum' ? 'selected' : ''}>Umum</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">STATUS</label>
                <select id="eqStatus" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="draft" ${kuisData.status === 'draft' ? 'selected' : ''}>Draft (Disimpan saja)</option>
                  <option value="aktif" ${kuisData.status === 'aktif' ? 'selected' : ''}>Aktif (Dapat Dikerjakan)</option>
                  <option value="selesai" ${kuisData.status === 'selesai' ? 'selected' : ''}>Selesai</option>
                  <option value="arsip" ${kuisData.status === 'arsip' ? 'selected' : ''}>Arsip</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DURASI PER SOAL (DETIK)</label>
                <input type="number" id="eqDurasi" value="${kuisData.durasi_per_soal_detik !== null ? kuisData.durasi_per_soal_detik : 0}" placeholder="0 = tanpa batas" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">URUTAN SOAL</label>
                <select id="eqUrutan" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="berurutan" ${kuisData.urutan_soal === 'berurutan' ? 'selected' : ''}>Berurutan</option>
                  <option value="acak" ${kuisData.urutan_soal === 'acak' ? 'selected' : ''}>Acak (Random)</option>
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">BOLEH RETAKE?</label>
                <select id="eqBolehRetake" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="false" ${!kuisData.boleh_retake ? 'selected' : ''}>Tidak Boleh</option>
                  <option value="true" ${kuisData.boleh_retake ? 'selected' : ''}>Boleh Retake</option>
                </select>
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">ANTI TAB / CHEAT</label>
                <select id="eqAntiTab" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                  <option value="true" ${kuisData.anti_tab_aktif ? 'selected' : ''}>Aktif (Diawasi)</option>
                  <option value="false" ${!kuisData.anti_tab_aktif ? 'selected' : ''}>Nonaktif</option>
                </select>
              </div>
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">📋 TAMPILKAN REVIEW JAWABAN KE MURID</label>
              <select id="eqTampilkanJawaban" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                <option value="setelah_submit" ${(kuisData.tampilkan_jawaban || 'setelah_submit') === 'setelah_submit' ? 'selected' : ''}>✅ Tampilkan setelah submit (Semua jawaban + kunci benar)</option>
                <option value="hanya_skor" ${kuisData.tampilkan_jawaban === 'hanya_skor' ? 'selected' : ''}>📊 Hanya tampilkan skor total (Jawaban disembunyikan)</option>
                <option value="sembunyikan" ${kuisData.tampilkan_jawaban === 'sembunyikan' ? 'selected' : ''}>🔒 Sembunyikan semua hasil (Hanya konfirmasi selesai)</option>
              </select>
              <div style="font-size:11px;color:var(--text-3);margin-top:4px;">Pilih bagaimana murid dapat melihat hasil kuis setelah selesai mengerjakan.</div>
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">ASSIGN KE HALAQAH *</label>
              <div style="background:var(--bg-2);padding:10px;border-radius:var(--r-sm);display:flex;flex-direction:column;gap:6px;max-height:120px;overflow-y:auto;">
                ${halaqahOptionsHtml}
              </div>
            </div>

            <div style="display:flex;gap:10px;margin-top:18px;">
              <button type="button" onclick="closeGuruQuizModal()" style="flex:1;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;">Batal</button>
              <button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">Simpan Perubahan</button>
            </div>
          </form>
        </div>
      </div>
    `;
  };

  window.submitFormEditKuis = async function (e, id_quiz) {
    e.preventDefault();
    var idHalaqahList = Array.from(document.querySelectorAll('input[name="id_halaqah"]:checked')).map(function(c){ return c.value; });

    var payload = {
      judul: document.getElementById('eqJudul').value.trim(),
      deskripsi: document.getElementById('eqDeskripsi').value.trim(),
      kategori: document.getElementById('eqKategori').value,
      status: document.getElementById('eqStatus').value,
      durasi_per_soal_detik: parseInt(document.getElementById('eqDurasi').value) || null,
      urutan_soal: document.getElementById('eqUrutan').value,
      boleh_retake: document.getElementById('eqBolehRetake').value === 'true',
      anti_tab_aktif: document.getElementById('eqAntiTab').value === 'true',
      tampilkan_jawaban: document.getElementById('eqTampilkanJawaban').value,
      id_halaqah_list: idHalaqahList
    };

    try {
      showLoading('Menyimpan perubahan...');
      await window.HQ.QuizAPI.updateKuis(id_quiz, payload);
      hideLoading();
      closeGuruQuizModal();
      await loadGuruQuizTabContent();
    } catch (err) {
      hideLoading();
      alert('Gagal mengedit kuis: ' + err.message);
    }
  };

  window.deleteKuisConfirm = async function (id_quiz) {
    if (!confirm('Apakah Anda yakin ingin menghapus kuis ini? Semua jawaban dan hasil murid pada kuis ini akan terhapus.')) return;

    try {
      showLoading('Menghapus kuis...');
      await window.HQ.QuizAPI.deleteKuis(id_quiz);
      hideLoading();
      await loadGuruQuizTabContent();
    } catch (err) {
      hideLoading();
      alert('Gagal menghapus kuis: ' + err.message);
    }
  };

  window.manageSoalKuis = async function (id_quiz) {
    var modalEl = document.getElementById('guruQuizModalContainer');
    if (!modalEl) return;

    _selectedQuizId = id_quiz;
    _pickerSelectedSoalIds.clear(); // Reset selection

    try {
      showLoading('Memuat soal kuis...');
      var quizRes = await window.HQ.QuizAPI.getHasilKuis(id_quiz);
      hideLoading();

      var quiz = quizRes.quiz;
      _currentQuizData = quiz;
      var existingQuizSoal = quiz.quiz_soal || [];

      var html = '<div style="display:flex;gap:16px;flex-wrap:wrap;"><div style="flex:1;min-width:300px;height:450px;overflow-y:auto;background:var(--bg-2);padding:14px;border-radius:var(--r-lg);border:1px solid var(--border);">';
      html += `<div style="font-size:12px;font-weight:800;color:var(--text-3);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.02em;">Soal di Kuis Saat Ini (${existingQuizSoal.length})</div>`;
      html += existingQuizSoal.map(function(qs, idx) {
        var s = qs.soal;
        if (!s) return '';
        return `
          <div style="background:var(--card-solid);padding:12px;border-radius:var(--r-sm);border:1px solid var(--border);box-shadow:var(--shadow-sm);display:flex;flex-direction:column;margin-bottom:8px;gap:8px;">
            <div style="font-size:12.5px;font-weight:700;color:var(--text);">${idx + 1}. ${escapeHtml(s.teks_soal)}</div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:8px;">
              <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-2);">
                <span>⏱️ Durasi:</span>
                <input type="number" value="${qs.durasi_detik_override !== null && qs.durasi_detik_override !== undefined ? qs.durasi_detik_override : ''}" placeholder="Default" onchange="updateSoalKuisSettingAction('${escapeJsStr(id_quiz)}', '${escapeJsStr(s.id_soal)}', this.value, null)" style="width:70px;padding:3px 6px;border-radius:4px;border:1px solid var(--border);font-size:11.5px;color:var(--text);background:var(--bg-2);outline:none;">
                <span>dtk</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;font-size:11.5px;color:var(--text-2);">
                <span>🎯 Poin:</span>
                <input type="number" value="${qs.bobot_poin || 10}" onchange="updateSoalKuisSettingAction('${escapeJsStr(id_quiz)}', '${escapeJsStr(s.id_soal)}', null, this.value)" style="width:50px;padding:3px 6px;border-radius:4px;border:1px solid var(--border);font-size:11.5px;color:var(--text);background:var(--bg-2);outline:none;">
              </div>
              <button onclick="removeSoalFromKuisAction('${escapeJsStr(id_quiz)}', '${escapeJsStr(s.id_soal)}')" style="background:var(--red-l);color:var(--red);border:none;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;margin-left:auto;">Hapus</button>
            </div>
          </div>
        `;
      }).join('') || '<div style="font-size:12px;color:var(--text-3);padding:10px 0;text-align:center;">Belum ada soal dimasukkan ke kuis ini.</div>';

      html += `
          </div>
          <div style="flex:1.2;min-width:280px;height:450px;background:var(--bg-2);border-radius:var(--r-lg);padding:14px;border:1px solid var(--border);display:flex;flex-direction:column;gap:12px;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <h4 style="font-size:13px;font-weight:800;color:var(--text);">📦 Pilih dari Bank Soal</h4>
              <button onclick="openModalCreateSoal('${escapeJsStr(id_quiz)}')" style="background:var(--blue-l);color:var(--blue-d);border:none;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:700;cursor:pointer;">➕ Buat Soal Baru</button>
            </div>

            <!-- Picker Filters -->
            <div style="display:flex;flex-direction:column;gap:8px;background:var(--card-solid);padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);">
              <input type="text" id="pickerSearchInput" oninput="onPickerSearchInput(this.value)" placeholder="Cari teks soal..." value="${escapeHtml(_pickerFilterText)}" style="width:100%;padding:8px;border-radius:6px;border:1px solid var(--border);font-size:12px;background:#fff;color:var(--text);outline:none;">
              <div style="display:flex;gap:6px;">
                <select id="pickerLevelSelect" onchange="onPickerLevelFilterChange(this.value)" style="flex:1.2;padding:8px;border-radius:6px;border:1px solid var(--border);font-size:12px;background:#fff;color:var(--text);outline:none;">
                  <option value="">— Level —</option>
                  <option value="Level 1" ${_pickerFilterLevel === 'Level 1' ? 'selected' : ''}>Level 1</option>
                  <option value="Level 2" ${_pickerFilterLevel === 'Level 2' ? 'selected' : ''}>Level 2</option>
                  <option value="Level 3" ${_pickerFilterLevel === 'Level 3' ? 'selected' : ''}>Level 3</option>
                  <option value="Level Qiyam" ${_pickerFilterLevel === 'Level Qiyam' ? 'selected' : ''}>Level Qiyam</option>
                  <option value="Micro Teaching" ${_pickerFilterLevel === 'Micro Teaching' ? 'selected' : ''}>Micro Teaching</option>
                  <option value="Tahsin Al-Fatihah" ${_pickerFilterLevel === 'Tahsin Al-Fatihah' ? 'selected' : ''}>Tahsin Al-Fatihah</option>
                </select>
                <input type="number" id="pickerPertemuanInput" oninput="onPickerPertemuanFilterChange(this.value)" placeholder="Pertemuan ke-" value="${escapeHtml(_pickerFilterPertemuan)}" style="flex:0.8;padding:8px;border-radius:6px;border:1px solid var(--border);font-size:12px;background:#fff;color:var(--text);outline:none;width:100%;">
              </div>
            </div>

            <!-- Floating / Top Action Bar for Bulk Add -->
            <div id="pickerBulkActionBar" style="display:none;background:var(--blue-l);border:1px solid var(--blue);padding:8px 12px;border-radius:var(--r-sm);align-items:center;justify-content:space-between;transition:all 0.2s ease;">
              <span style="font-size:11.5px;font-weight:800;color:var(--blue-d);" id="pickerSelectedCountText">0 soal terpilih</span>
              <button onclick="bulkAddSelectedSoal('${escapeJsStr(id_quiz)}')" style="background:var(--blue-d);color:#fff;border:none;padding:5px 12px;border-radius:var(--r-pill,100px);font-size:11.5px;font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">➕ Tambah Terpilih</button>
            </div>

            <div id="soalPickerContainer" style="display:flex;flex-direction:column;gap:8px;overflow-y:auto;flex:1;">
              <!-- Loaded dynamically -->
            </div>
          </div>
        </div>
      `;

      modalEl.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeGuruQuizModal()">
          <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:880px;max-height:92vh;overflow-y:auto;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;gap:14px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <h3 style="font-size:16px;font-weight:800;color:var(--text)">⚙️ Kelola Soal: ${escapeHtml(quiz.judul)}</h3>
              <button onclick="closeGuruQuizModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
            </div>

            ${html}

            <button onclick="closeGuruQuizModal()" style="width:100%;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;flex-shrink:0;">Selesai</button>
          </div>
        </div>
      `;

      await reloadPickerList(id_quiz);
    } catch (err) {
      hideLoading();
      alert('Gagal mengelola soal kuis: ' + err.message);
    }
  };

  window.onPickerSearchInput = function (val) {
    _pickerFilterText = val;
    renderPickerList(_selectedQuizId);
  };

  window.onPickerLevelFilterChange = async function (val) {
    _pickerFilterLevel = val;
    await reloadPickerList(_selectedQuizId);
  };

  window.onPickerPertemuanFilterChange = async function (val) {
    _pickerFilterPertemuan = val;
    await reloadPickerList(_selectedQuizId);
  };

  async function reloadPickerList(id_quiz) {
    var pickerEl = document.getElementById('soalPickerContainer');
    if (pickerEl && pickerEl.innerHTML === '') {
      pickerEl.innerHTML = '<div style="font-size:11px;color:var(--text-3);text-align:center;padding:20px;">Memuat soal...</div>';
    }
    try {
      var res = await window.HQ.QuizAPI.getBankSoal(null, null, _pickerFilterLevel || null, _pickerFilterPertemuan || null);
      _pickerAvailableSoal = res.data || [];
      renderPickerList(id_quiz);
    } catch (e) {
      if (pickerEl) pickerEl.innerHTML = '<div style="font-size:11px;color:var(--red);text-align:center;padding:20px;">Gagal memuat soal.</div>';
    }
  }

  function renderPickerList(id_quiz) {
    var pickerEl = document.getElementById('soalPickerContainer');
    if (!pickerEl) return;

    var quiz = _currentQuizData;
    var existingQuizSoal = quiz ? (quiz.quiz_soal || []) : [];
    var addedIds = new Set(existingQuizSoal.map(function(qs){ return qs.id_soal; }));

    var available = _pickerAvailableSoal.filter(function(b){
      return !addedIds.has(b.id_soal);
    });

    if (_pickerFilterText) {
      var term = _pickerFilterText.toLowerCase();
      available = available.filter(function(s) {
        return (s.teks_soal || '').toLowerCase().includes(term);
      });
    }

    if (available.length === 0) {
      pickerEl.innerHTML = '<div style="font-size:11.5px;color:var(--text-3);text-align:center;padding:20px;">Tidak ada soal baru di bank soal yang sesuai filter.</div>';
      updateBulkActionBarVisibility();
      return;
    }

    var pickerHtml = '';
    groupSoalByLevel(available).forEach(function (g) {
      pickerHtml += levelSectionHeader(g.level, g.items.length, true);
      g.items.forEach(function(s) {
      var badgeText = getTipeSoalLabel(s.tipe_soal);
      var isChecked = _pickerSelectedSoalIds.has(s.id_soal);

      pickerHtml += `
        <div style="background:var(--card-solid);padding:10px;border-radius:8px;border:1px solid var(--border);box-shadow:var(--shadow-sm);display:flex;align-items:center;gap:8px;">
          <input type="checkbox" class="picker-cb" value="${escapeHtml(s.id_soal)}" ${isChecked ? 'checked' : ''} onchange="onPickerCheckboxChange(this)" style="width:16px;height:16px;cursor:pointer;flex-shrink:0;margin:0 4px 0 0;">
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;">
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
              <span style="font-size:8px;font-weight:800;background:var(--blue-l);color:var(--blue-d);padding:2px 6px;border-radius:4px;text-transform:uppercase;">${badgeText}</span>
              ${(s.levels || []).map(function(lvl){
                return `<span style="font-size:8px;font-weight:800;background:rgba(16,185,129,0.1);color:#059669;padding:2px 6px;border-radius:4px;">${escapeHtml(lvl)}</span>`;
              }).join('')}
              ${s.rekomendasi_pertemuan_ke ? `
                <span style="font-size:8px;font-weight:800;background:rgba(245,158,11,0.1);color:var(--amber-txt);padding:2px 6px;border-radius:4px;">📍 P.${s.rekomendasi_pertemuan_ke}</span>
              ` : ''}
            </div>
            <div style="font-size:12px;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(s.teks_soal)}">${escapeHtml(s.teks_soal)}</div>
          </div>
          <button onclick="addSoalToKuisAction('${escapeJsStr(id_quiz)}', '${escapeJsStr(s.id_soal)}')" style="background:var(--blue-l);color:var(--blue-d);border:none;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;flex-shrink:0;">+ Tambah</button>
        </div>
      `;
      });
    });

    pickerEl.innerHTML = pickerHtml;
    updateBulkActionBarVisibility();
  }

  window.onPickerCheckboxChange = function(cb) {
    var id_soal = cb.value;
    if (cb.checked) {
      _pickerSelectedSoalIds.add(id_soal);
    } else {
      _pickerSelectedSoalIds.delete(id_soal);
    }
    updateBulkActionBarVisibility();
  };

  function updateBulkActionBarVisibility() {
    var bar = document.getElementById('pickerBulkActionBar');
    var txt = document.getElementById('pickerSelectedCountText');
    if (!bar || !txt) return;

    if (_pickerSelectedSoalIds.size > 0) {
      txt.textContent = _pickerSelectedSoalIds.size + ' soal terpilih';
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }

  window.bulkAddSelectedSoal = async function(id_quiz) {
    var ids = Array.from(_pickerSelectedSoalIds);
    if (ids.length === 0) return;

    try {
      showLoading(`Menambahkan ${ids.length} soal ke kuis...`);
      for (var i = 0; i < ids.length; i++) {
        await window.HQ.QuizAPI.addSoalToKuis(id_quiz, ids[i], null, 10);
      }
      _pickerSelectedSoalIds.clear();
      hideLoading();
      manageSoalKuis(id_quiz);
    } catch (err) {
      hideLoading();
      alert('Gagal menambahkan soal massal: ' + err.message);
    }
  };

  window.addSoalToKuisAction = async function (id_quiz, id_soal) {
    try {
      showLoading('Menambahkan soal...');
      await window.HQ.QuizAPI.addSoalToKuis(id_quiz, id_soal, null, 10);
      hideLoading();
      manageSoalKuis(id_quiz);
    } catch (err) {
      hideLoading();
      alert('Gagal menambahkan soal: ' + err.message);
    }
  };

  window.removeSoalFromKuisAction = async function (id_quiz, id_soal) {
    try {
      showLoading('Menghapus soal...');
      await window.HQ.QuizAPI.removeSoalFromKuis(id_quiz, id_soal);
      hideLoading();
      manageSoalKuis(id_quiz);
    } catch (err) {
      hideLoading();
      alert('Gagal menghapus soal: ' + err.message);
    }
  };

  window.openModalCreateSoal = async function (prefilledQuizId, editSoalId) {
    var modalEl = document.getElementById('guruQuizModalContainer');
    if (!modalEl) return;

    var editingSoal = null;
    if (editSoalId) {
      try {
        showLoading('Memuat detail soal...');
        var res = await window.HQ.QuizAPI.getSoalDetail(editSoalId);
        editingSoal = res.data;
        hideLoading();
      } catch (err) {
        hideLoading();
        alert('Gagal memuat detail soal: ' + err.message);
        return;
      }
    }

    modalEl.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeGuruQuizModal()">
        <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="font-size:16px;font-weight:800;color:var(--text)">${editingSoal ? '📝 Edit Soal (Bank Soal)' : '➕ Buat Soal Baru (Bank Soal)'}</h3>
            <button onclick="closeGuruQuizModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
          </div>

          <form onsubmit="submitFormCreateSoal(event, '${prefilledQuizId || ''}', ${editingSoal ? `'${editingSoal.id_soal}'` : 'null'})">
            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">TIPE SOAL *</label>
              <select id="csTipe" onchange="onTipeSoalChange(this.value)" ${editingSoal ? 'disabled' : ''} style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
                <option value="pilihan_ganda" ${editingSoal && editingSoal.tipe_soal === 'pilihan_ganda' ? 'selected' : ''}>Pilihan Ganda</option>
                <option value="benar_salah" ${editingSoal && editingSoal.tipe_soal === 'benar_salah' ? 'selected' : ''}>Benar / Salah</option>
                <option value="matching" ${editingSoal && editingSoal.tipe_soal === 'matching' ? 'selected' : ''}>Matching (Menjodohkan)</option>
                <option value="audio" ${editingSoal && editingSoal.tipe_soal === 'audio' ? 'selected' : ''}>Audio / Suara</option>
                <option value="teks_arab" ${editingSoal && editingSoal.tipe_soal === 'teks_arab' ? 'selected' : ''}>Teks Arab</option>
                <option value="isian_singkat" ${editingSoal && editingSoal.tipe_soal === 'isian_singkat' ? 'selected' : ''}>Isian Singkat</option>
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
              <input type="number" id="csRekomendasiPertemuan" placeholder="Contoh: 23" min="1" value="${editingSoal && editingSoal.rekomendasi_pertemuan_ke ? editingSoal.rekomendasi_pertemuan_ke : ''}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
            </div>

            <!-- Default Durasi & Poin -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DEFAULT DURASI (DETIK)</label>
                <input type="number" id="csDurasiDefault" placeholder="Kosongkan jika default kuis" min="0" value="${editingSoal && editingSoal.durasi_detik_default !== null && editingSoal.durasi_detik_default !== undefined ? editingSoal.durasi_detik_default : ''}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
              </div>
              <div>
                <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">DEFAULT POIN</label>
                <input type="number" id="csPoinDefault" placeholder="Default: 10" min="0" value="${editingSoal && editingSoal.bobot_poin_default !== null && editingSoal.bobot_poin_default !== undefined ? editingSoal.bobot_poin_default : '10'}" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
              </div>
            </div>

            <!-- Boleh dimainkan di Rattil Maze (Petualangan) -->
            <div style="margin-bottom:12px;">
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg-2);padding:11px;border-radius:var(--r-sm);border:1px solid var(--border);">
                <input type="checkbox" id="csBolehMaze" ${editingSoal && editingSoal.boleh_maze ? 'checked' : ''}>
                <span style="flex:1">🎮 Boleh dimainkan di <b>Rattil Maze</b> (Petualangan)</span>
              </label>
              <div style="font-size:10.5px;color:var(--text-3);margin-top:4px;line-height:1.5;">Efektif untuk tipe <b>Pilihan Ganda</b>, <b>Benar/Salah</b>, atau <b>Audio</b> dengan opsi pendek (≤4 opsi, tiap opsi ≤14 karakter). Tipe lain diabaikan di maze.</div>
            </div>

            <!-- Boleh dimainkan di Rattil Run (Lari) -->
            <div style="margin-bottom:12px;">
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg-2);padding:11px;border-radius:var(--r-sm);border:1px solid var(--border);">
                <input type="checkbox" id="csBolehRun" ${editingSoal && editingSoal.boleh_run ? 'checked' : ''}>
                <span style="flex:1">🦘 Boleh dimainkan di <b>Rattil Run</b> (Lari)</span>
              </label>
              <div style="font-size:10.5px;color:var(--text-3);margin-top:4px;line-height:1.5;">Efektif untuk tipe <b>Pilihan Ganda</b> atau <b>Benar/Salah</b> dengan opsi pendek (ideal ≤3 opsi, tiap opsi ≤14 karakter). Tipe lain diabaikan di Run.</div>
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">TEKS PERTANYAAN (LATIN) *</label>
              <textarea id="csTeksSoal" required rows="2" placeholder="Ketik pertanyaan di sini..." style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;outline:none;resize:vertical;">${editingSoal ? escapeHtml(editingSoal.teks_soal) : ''}</textarea>
            </div>

            <div id="csTeksArabWrap" style="display:none;margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <label style="font-size:11px;font-weight:700;color:var(--text-2);">TEKS ARAB</label>
                <button type="button" onclick="applyTajwidHighlight()" style="font-size:10.5px;font-weight:800;color:var(--blue-d);background:var(--blue-l);border:none;padding:3px 8px;border-radius:100px;cursor:pointer;">✨ Tandai Highlight Tajwid</button>
              </div>
              <textarea id="csTeksArab" rows="2" oninput="updateTeksArabPreview(this.value)" placeholder="Gunakan {[...]} untuk highlight kata/hukum tajwid" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:'Amiri',serif;font-size:18px;direction:rtl;outline:none;resize:vertical;">${editingSoal && editingSoal.teks_arab ? escapeHtml(editingSoal.teks_arab) : ''}</textarea>
              <div style="margin-top:6px;">
                <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:2px;">Pratinjau Teks Arab:</div>
                <div id="csTeksArabPreview" style="font-family:'Amiri',serif;font-size:22px;direction:rtl;text-align:center;padding:12px;background:var(--bg-2);border-radius:var(--r-sm);border:1px solid var(--border);min-height:48px;word-break:break-word;">
                  <span style="color:var(--text-3);">–</span>
                </div>
              </div>
            </div>

            <div id="csAudioWrap" style="display:none;margin-bottom:12px;">
              <label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:4px;">URL AUDIO (GDrive / YouTube / MP3 Direct)</label>
              <input type="url" id="csAudioUrl" value="${editingSoal && editingSoal.audio_url ? escapeHtml(editingSoal.audio_url) : ''}" placeholder="https://..." style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);font-family:inherit;font-size:13px;">
            </div>

            <!-- Options Container Dynamic -->
            <div id="csDynamicOptions" style="margin-bottom:14px;"></div>

            <div style="display:flex;gap:10px;margin-top:18px;">
              <button type="button" onclick="closeGuruQuizModal()" style="flex:1;padding:11px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;">Batal</button>
              <button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:var(--r-pill,100px);font-weight:800;cursor:pointer;box-shadow:var(--shadow-blue);">
                ${editingSoal ? 'Simpan Perubahan' : 'Simpan Soal'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    if (editingSoal) {
      var lvls = editingSoal.levels || [];
      document.querySelectorAll('.csLevelCheck').forEach(function(cb) {
        cb.checked = lvls.indexOf(cb.value) !== -1;
      });

      onTipeSoalChange(editingSoal.tipe_soal);

      if (editingSoal.tipe_soal === 'pilihan_ganda' || editingSoal.tipe_soal === 'audio' || editingSoal.tipe_soal === 'teks_arab') {
        var pils = editingSoal.soal_pilihan || [];
        var pilInputs = document.querySelectorAll('.csPil');
        var radioInputs = document.querySelectorAll('input[name="csBenar"]');
        pils.forEach(function(p, i) {
          if (pilInputs[i]) pilInputs[i].value = p.teks_pilihan || '';
          if (radioInputs[i]) radioInputs[i].checked = !!p.is_benar;
        });
      } else if (editingSoal.tipe_soal === 'benar_salah') {
        var pils = editingSoal.soal_pilihan || [];
        var trueBenar = pils.some(function(p) { return p.teks_pilihan === 'Benar' && p.is_benar; });
        var radioInputs = document.querySelectorAll('input[name="csBsBenar"]');
        if (radioInputs[0]) radioInputs[0].checked = trueBenar;
        if (radioInputs[1]) radioInputs[1].checked = !trueBenar;
      } else if (editingSoal.tipe_soal === 'matching') {
        var pas = editingSoal.soal_pasangan || [];
        var kiriInputs = document.querySelectorAll('.csMatchKiri');
        var kananInputs = document.querySelectorAll('.csMatchKanan');
        pas.forEach(function(p, i) {
          if (kiriInputs[i]) kiriInputs[i].value = p.teks_kiri || '';
          if (kananInputs[i]) kananInputs[i].value = p.teks_kanan || '';
        });
      } else if (editingSoal.tipe_soal === 'isian_singkat') {
        var kun = editingSoal.soal_kunci_isian || [];
        var keys = kun.map(function(k) { return k.teks_kunci; }).join(', ');
        var inputKunci = document.getElementById('csIsianKunci');
        if (inputKunci) inputKunci.value = keys;
      }

      if (editingSoal.teks_arab) {
        updateTeksArabPreview(editingSoal.teks_arab);
      }
    } else {
      onTipeSoalChange('pilihan_ganda');
    }
  };

  window.onTipeSoalChange = function (tipe) {
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
          <label style="font-size:13px;font-weight:700;cursor:pointer;"><input type="radio" name="csBsBenar" value="benar" checked> ✅ Benar</label>
          <label style="font-size:13px;font-weight:700;cursor:pointer;"><input type="radio" name="csBsBenar" value="salah"> ❌ Salah</label>
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
  };

  window.submitFormCreateSoal = async function (e, prefilledQuizId, editSoalId) {
    e.preventDefault();
    // Payload dari modul bersama (SoalCore) — sumber tunggal bentuk data
    // (kunci_isian string, delimiter, is_benar). Return null bila level kosong.
    var payload = window.SoalCore.collectFormPayload();
    if (!payload) return;

    try {
      if (editSoalId) {
        showLoading('Menyimpan perubahan soal...');
        await window.HQ.QuizAPI.updateSoalFull(editSoalId, payload);
        hideLoading();
        closeGuruQuizModal();
        alert('Soal berhasil diperbarui di Bank Soal!');
        await loadGuruQuizTabContent();
      } else {
        showLoading('Membuat soal...');
        var res = await window.HQ.QuizAPI.createSoal(payload);
        var newSoal = res.data;

        if (prefilledQuizId && newSoal) {
          // L4 fix (bug hunt 2026-08-18): urutan:1 dulu hardcode -> selalu menggeser
          // soal lain yg sudah ada ke posisi berikutnya. null = auto-append di akhir,
          // sama seperti jalur tambah normal (+ Tambah / bulk-add di atas).
          await window.HQ.QuizAPI.addSoalToKuis(prefilledQuizId, newSoal.id_soal, null, 10);
        }

        hideLoading();
        closeGuruQuizModal();

        if (prefilledQuizId) {
          manageSoalKuis(prefilledQuizId);
        } else {
          await loadGuruQuizTabContent();
        }
      }
    } catch (err) {
      hideLoading();
      alert('Gagal menyimpan soal: ' + err.message);
    }
  };

  window.deleteSoalConfirm = async function (id_soal) {
    if (!confirm('Apakah Anda yakin ingin menghapus soal ini dari Bank Soal?')) return;

    try {
      showLoading('Menghapus soal...');
      await window.HQ.QuizAPI.deleteSoal(id_soal);
      hideLoading();
      await loadGuruQuizTabContent();
    } catch (err) {
      hideLoading();
      alert('Gagal menghapus soal: ' + err.message);
    }
  };

  window.viewHasilKuisGuru = async function (id_quiz) {
    var modalEl = document.getElementById('guruQuizModalContainer');
    if (!modalEl) return;

    try {
      showLoading('Memuat laporan kuis...');
      var res = await window.HQ.QuizAPI.getHasilKuis(id_quiz);
      hideLoading();

      var quiz = res.quiz;
      var summary = res.summary;
      var hasilMurid = summary.hasil_murid || [];
      var jawabanDetail = summary.jawaban_detail || [];
      var quizSoalList = quiz.quiz_soal || [];
      var belumMengerjakan = summary.belum_mengerjakan || [];
      window._currentBelumMengerjakan = belumMengerjakan;

      // 1. Calculate error rate per question (Soal Tersulit)
      var soalStats = quizSoalList.map(function(qs) {
        var s = qs.soal;
        if (!s) return null;

        var answers = jawabanDetail.filter(function(jd) { return jd.id_soal === s.id_soal; });
        var totalAnswers = answers.length;
        var wrongAnswers = answers.filter(function(jd) { 
          return jd.is_benar === false || (jd.is_benar !== true && jd.skor_diperoleh === 0);
        }).length;

        var errorRate = totalAnswers > 0 ? Math.round((wrongAnswers / totalAnswers) * 100) : 0;

        return {
          id_soal: s.id_soal,
          teks_soal: s.teks_soal,
          tipe_soal: s.tipe_soal,
          total_answers: totalAnswers,
          wrong_answers: wrongAnswers,
          error_rate: errorRate
        };
      }).filter(Boolean);

      // Sort by error rate descending
      soalStats.sort(function(a, b) { return b.error_rate - a.error_rate; });
      var topWrongSoal = soalStats.slice(0, 3).filter(function(s) { return s.error_rate > 0; });

      // 2. Score Distribution Histogram (CSS murni)
      var dist = { range1: 0, range2: 0, range3: 0, range4: 0 };
      hasilMurid.forEach(function(h) {
        var pct = h.skor_maksimal > 0 ? (h.skor_total / h.skor_maksimal) * 100 : 0;
        if (pct <= 25) dist.range1++;
        else if (pct <= 50) dist.range2++;
        else if (pct <= 75) dist.range3++;
        else dist.range4++;
      });
      
      var maxDist = Math.max(dist.range1, dist.range2, dist.range3, dist.range4) || 1;
      var pct1 = Math.round((dist.range1 / maxDist) * 100);
      var pct2 = Math.round((dist.range2 / maxDist) * 100);
      var pct3 = Math.round((dist.range3 / maxDist) * 100);
      var pct4 = Math.round((dist.range4 / maxDist) * 100);

      // 3. Leaderboard Podium (🥇🥈🥉)
      var top3Html = '';
      if (hasilMurid.length > 0) {
        top3Html = '<div style="display:flex;justify-content:center;align-items:flex-end;gap:12px;margin:16px 0 10px;">';
        var ranks = [];
        var icons = [];
        var heights = [];
        var colors = [];

        if (hasilMurid.length >= 3) {
          ranks = [hasilMurid[1], hasilMurid[0], hasilMurid[2]];
          icons = ['🥈', '🥇', '🥉'];
          heights = ['65px', '85px', '55px'];
          colors = ['#e2e8f0', '#fef08a', '#ffedd5'];
        } else if (hasilMurid.length === 2) {
          ranks = [hasilMurid[1], hasilMurid[0]];
          icons = ['🥈', '🥇'];
          heights = ['65px', '85px'];
          colors = ['#e2e8f0', '#fef08a'];
        } else {
          ranks = [hasilMurid[0]];
          icons = ['🥇'];
          heights = ['85px'];
          colors = ['#fef08a'];
        }

        ranks.forEach(function(r, i) {
          if (!r) return;
          var name = r.users ? r.users.nama_lengkap : 'Murid';
          top3Html += `
            <div style="flex:1;max-width:110px;text-align:center;">
              <div style="font-size:10.5px;font-weight:700;color:var(--text);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(name)}">${escapeHtml(name)}</div>
              <div style="height:${heights[i]};background:${colors[i]};border-radius:12px 12px 0 0;display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:var(--shadow);border:1px solid var(--border);">
                <span style="font-size:18px;">${icons[i]}</span>
                <span style="font-weight:900;font-size:11px;color:var(--text);margin-top:2px;">${r.skor_total}</span>
              </div>
            </div>
          `;
        });
        top3Html += '</div>';
      }

      // 4. Hardest Questions HTML
      var wrongSoalHtml = '';
      if (topWrongSoal.length > 0) {
        wrongSoalHtml = `
          <div style="background:var(--red-l);border:1px solid rgba(239,68,68,0.2);padding:14px;border-radius:var(--r-lg);margin-bottom:20px;">
            <h4 style="font-size:12px;font-weight:800;color:var(--red);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.02em;">⚠️ Soal Tersulit (Butuh Review Kelas)</h4>
            <div style="display:flex;flex-direction:column;gap:8px;">
        `;
        topWrongSoal.forEach(function(ws, idx) {
          wrongSoalHtml += `
            <div style="background:var(--card-solid);padding:10px;border-radius:var(--r-sm);border:1px solid rgba(239,68,68,0.15);font-size:12px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:4px;">
                <span style="font-weight:800;color:var(--text);">#${idx + 1}. Tipe: <span style="text-transform:capitalize;">${ws.tipe_soal.replace('_', ' ')}</span></span>
                <span style="font-weight:900;color:var(--red);font-size:11.5px;">${ws.error_rate}% Salah</span>
              </div>
              <div style="color:var(--text-2);font-weight:500;line-height:1.45;word-break:break-word;">
                "${escapeHtml(ws.teks_soal)}"
              </div>
              <div style="font-size:10px;color:var(--text-3);margin-top:4px;">
                Dijawab salah oleh ${ws.wrong_answers} dari ${ws.total_answers} murid
              </div>
            </div>
          `;
        });
        wrongSoalHtml += `
            </div>
          </div>
        `;
      }

      var rowsHtml = hasilMurid.map(function(h, idx) {
        var name = h.users ? h.users.nama_lengkap : 'Murid';
        var percent = h.skor_maksimal > 0 ? Math.round((h.skor_total / h.skor_maksimal) * 100) : 0;

        return `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:10px;font-size:12px;font-weight:700;">#${idx + 1}</td>
            <td style="padding:10px;font-size:12px;font-weight:800;color:var(--text);">${escapeHtml(name)}</td>
            <td style="padding:10px;font-size:12px;font-weight:900;color:var(--green);">${h.skor_total} / ${h.skor_maksimal} (${percent}%)</td>
            <td style="padding:10px;font-size:12px;">${h.durasi_pengerjaan_detik ? h.durasi_pengerjaan_detik + 's' : '-'}</td>
            <td style="padding:10px;font-size:11px;">
              ${h.flag_suspicious ? `<span style="background:var(--red-l);color:var(--red);padding:2px 8px;border-radius:100px;font-weight:800;">⚠️ ${h.jumlah_tab_switch}x Pindah Tab</span>` : '<span style="color:var(--text-3);">Normal</span>'}
            </td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-3);">Belum ada murid yang mengerjakan kuis ini.</td></tr>';

      modalEl.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeGuruQuizModal()">
          <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:680px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="font-size:16px;font-weight:800;color:var(--text)">📊 Laporan & Hasil: ${escapeHtml(quiz.judul)}</h3>
              <button onclick="closeGuruQuizModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;">
              <div style="background:var(--bg-2);padding:14px;border-radius:var(--r-sm);text-align:center;">
                <div style="font-size:11px;font-weight:700;color:var(--text-3);">TOTAL MENGERJAKAN</div>
                <div style="font-size:24px;font-weight:900;color:var(--blue-d);">${summary.total_mengerjakan} Murid</div>
              </div>
              <div style="background:var(--bg-2);padding:14px;border-radius:var(--r-sm);text-align:center;">
                <div style="font-size:11px;font-weight:700;color:var(--text-3);">RATA-RATA SKOR</div>
                <div style="font-size:24px;font-weight:900;color:var(--green);">${summary.rata_rata_skor} Poin</div>
              </div>
            </div>

            <!-- Visual Leaderboard & Analytics Grid -->
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(280px, 1fr));gap:16px;margin-bottom:20px;">
              <!-- Podium section -->
              <div style="background:var(--bg-2);padding:16px;border-radius:var(--r-lg);display:flex;flex-direction:column;justify-content:center;">
                <h4 style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.02em;text-align:center;">🏆 Peringkat Kelas (Podium)</h4>
                ${top3Html || '<div style="text-align:center;color:var(--text-3);padding:20px;font-size:12px;">Belum ada peringkat kuis</div>'}
              </div>

              <!-- Value Distribution -->
              <div style="background:var(--bg-2);padding:16px;border-radius:var(--r-lg);">
                <h4 style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:12px;text-transform:uppercase;letter-spacing:0.02em;">📊 Distribusi Nilai Kelas</h4>
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:10.5px;font-weight:700;color:var(--text-3);width:60px;">0 - 25%</span>
                    <div style="flex:1;height:10px;background:var(--border);border-radius:5px;overflow:hidden;">
                      <div style="width:${pct1}%;height:100%;background:var(--red);border-radius:5px;"></div>
                    </div>
                    <span style="font-size:11px;font-weight:800;color:var(--text);width:20px;text-align:right;">${dist.range1}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:10.5px;font-weight:700;color:var(--text-3);width:60px;">26 - 50%</span>
                    <div style="flex:1;height:10px;background:var(--border);border-radius:5px;overflow:hidden;">
                      <div style="width:${pct2}%;height:100%;background:var(--amber);border-radius:5px;"></div>
                    </div>
                    <span style="font-size:11px;font-weight:800;color:var(--text);width:20px;text-align:right;">${dist.range2}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:10.5px;font-weight:700;color:var(--text-3);width:60px;">51 - 75%</span>
                    <div style="flex:1;height:10px;background:var(--border);border-radius:5px;overflow:hidden;">
                      <div style="width:${pct3}%;height:100%;background:var(--blue);border-radius:5px;"></div>
                    </div>
                    <span style="font-size:11px;font-weight:800;color:var(--text);width:20px;text-align:right;">${dist.range3}</span>
                  </div>
                  <div style="display:flex;align-items:center;gap:12px;">
                    <span style="font-size:10.5px;font-weight:700;color:var(--text-3);width:60px;">76 - 100%</span>
                    <div style="flex:1;height:10px;background:var(--border);border-radius:5px;overflow:hidden;">
                      <div style="width:${pct4}%;height:100%;background:var(--green);border-radius:5px;"></div>
                    </div>
                    <span style="font-size:11px;font-weight:800;color:var(--text);width:20px;text-align:right;">${dist.range4}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Hardest Question Warning Box -->
            ${wrongSoalHtml}

            <!-- Belum Mengerjakan Section -->
            <div style="margin-top:20px;margin-bottom:20px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px;">
                <div style="font-size:12px;font-weight:800;color:var(--text);text-transform:uppercase;letter-spacing:0.02em;">
                  ⚠️ Murid Belum Mengerjakan (${belumMengerjakan.length})
                </div>
                ${belumMengerjakan.length > 0 ? `
                  <button onclick="shareRecapWa('${escapeJsStr(quiz.judul)}', window._currentBelumMengerjakan)" style="padding:6px 14px;background:#25d366;color:#fff;border:none;border-radius:100px;font-size:11px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:6px;box-shadow:0 2px 8px rgba(37,211,102,0.3);font-family:inherit;">
                    🟢 📢 Pengingat Grup WA
                  </button>
                ` : ''}
              </div>
              
              <div style="border:1px solid var(--border);border-radius:var(--r-sm);overflow:hidden;background:var(--bg-2);padding:4px;">
                ${belumMengerjakan.length > 0 ? `
                  <div style="display:flex;flex-direction:column;gap:6px;max-height:180px;overflow-y:auto;padding:6px;">
                    ${belumMengerjakan.map(function(m, idx) {
                      var waNum = formatWaNumber(m.no_hp);
                      var waBtn = waNum 
                        ? `<button onclick="sendPersonalWa('${escapeJsStr(m.nama_lengkap)}', '${waNum}', '${escapeJsStr(quiz.judul)}')" style="padding:4px 10px;background:#25d366;color:#fff;border:none;border-radius:100px;font-size:10.5px;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px;font-family:inherit;">💬 Chat WA</button>`
                        : `<span style="font-size:10px;color:var(--text-3);background:var(--border);padding:3px 8px;border-radius:100px;">Tanpa No. HP</span>`;

                      return `
                        <div style="background:var(--card-solid);padding:10px 12px;border-radius:6px;display:flex;align-items:center;justify-content:space-between;border:1px solid var(--border);">
                          <div style="font-size:12px;font-weight:700;color:var(--text);">${idx + 1}. ${escapeHtml(m.nama_lengkap)}</div>
                          <div>${waBtn}</div>
                        </div>
                      `;
                    }).join('')}
                  </div>
                ` : `
                  <div style="text-align:center;padding:20px;color:var(--text-3);font-size:12px;font-weight:700;background:var(--card-solid);border-radius:var(--r-sm);">
                    🎉 Masya Allah, semua anggota halaqah sudah mengerjakan kuis ini!
                  </div>
                `}
              </div>
            </div>

            <!-- Score Table -->
            <div style="font-size:12px;font-weight:800;color:var(--text);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.02em;">📝 Rincian Nilai Murid</div>
            <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--r-sm);">
              <table style="width:100%;border-collapse:collapse;text-align:left;">
                <thead>
                  <tr style="background:var(--bg-2);font-size:11px;font-weight:800;color:var(--text-3);text-transform:uppercase;border-bottom:1px solid var(--border);">
                    <th style="padding:10px;">No</th>
                    <th style="padding:10px;">Nama Murid</th>
                    <th style="padding:10px;">Skor</th>
                    <th style="padding:10px;">Waktu</th>
                    <th style="padding:10px;">Status / Log</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
            </div>

            <button onclick="closeGuruQuizModal()" style="width:100%;padding:11px;margin-top:20px;background:var(--bg-2);color:var(--text);border:none;border-radius:var(--r-pill,100px);font-weight:700;cursor:pointer;">Tutup</button>
          </div>
        </div>
      `;
    } catch (err) {
      hideLoading();
      alert('Gagal memuat laporan kuis: ' + err.message);
    }
  };

  // Helper Utilities
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/`/g, '&#96;');
  }

  function escapeJsStr(str) {
    if (!str) return '';
    // Fix bug hunt 27 Agustus 2026 (CRITICAL): versi lama cuma escape backslash/kutip
    // TANPA HTML-entity-encode dulu -- HTML tak kenal backslash sbg escape char, jadi
    // string berisi `"` (mis. dari nama_lengkap murid, bebas-teks & murid bisa ubah
    // sendiri) tetap memutus atribut onclick="..." lebih awal meski sudah di-\"-escape.
    // Delegasikan ke escJs() global (guru/index.html) yang sudah benar (HTML-encode
    // &/</>/" dulu, baru escape backslash & apostrof) -- konsisten dgn modul lain.
    if (typeof window.escJs === 'function') return window.escJs(str);
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  function showLoading(msg) {
    if (typeof window.showLoad === 'function') window.showLoad(msg);
  }

  function hideLoading() {
    if (typeof window.hideLoad === 'function') window.hideLoad();
  }

  function showQuizAlert(opts) {
    var type = opts.type || 'warning';
    var icon = opts.icon || (type === 'warning' ? '⚠️' : type === 'danger' ? '🚨' : type === 'success' ? '🎉' : 'ℹ️');
    var buttonText = opts.buttonText || 'Mengerti 👍';

    var headerBg = type === 'warning' ? 'linear-gradient(135deg,#f59e0b,#d97706)' :
                   type === 'danger'  ? 'linear-gradient(135deg,#ef4444,#dc2626)' :
                   type === 'success' ? 'linear-gradient(135deg,#10b981,#059669)' :
                                        'linear-gradient(135deg,#0ea5e9,#0284c7)';

    var existing = document.getElementById('quizAlertModalOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'quizAlertModalOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.65);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;animation:quizFadeIn .25s ease;';

    overlay.innerHTML = `
      <div style="background:var(--card-solid,#fff);border-radius:24px;padding:28px 24px;width:100%;max-width:400px;text-align:center;box-shadow:0 20px 50px rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.6);animation:quizPopIn .3s cubic-bezier(0.34,1.56,0.64,1);position:relative;overflow:hidden;">
        <div style="width:64px;height:64px;border-radius:50%;background:${headerBg};color:#fff;display:flex;align-items:center;justify-content:center;font-size:32px;margin:0 auto 16px;box-shadow:0 8px 20px rgba(0,0,0,0.15);">
          ${icon}
        </div>
        <h3 style="font-size:17px;font-weight:900;color:var(--text,#1e293b);margin-bottom:8px;line-height:1.3;">
          ${escapeHtml(opts.title || 'Pemberitahuan')}
        </h3>
        <p style="font-size:13px;color:var(--text-2,#475569);line-height:1.5;margin-bottom:22px;">
          ${escapeHtml(opts.message || '')}
        </p>
        <button id="btnQuizAlertClose" style="width:100%;padding:13px;background:${headerBg};color:#fff;border:none;border-radius:100px;font-weight:800;font-size:13.5px;cursor:pointer;box-shadow:0 4px 16px rgba(0,0,0,0.2);transition:transform .2s;">
          ${escapeHtml(buttonText)}
        </button>
      </div>
      <style>
        @keyframes quizFadeIn { from{opacity:0;} to{opacity:1;} }
        @keyframes quizPopIn { from{opacity:0;transform:scale(0.85) translateY(10px);} to{opacity:1;transform:scale(1) translateY(0);} }
      </style>
    `;

    document.body.appendChild(overlay);

    document.getElementById('btnQuizAlertClose').onclick = function () {
      overlay.remove();
      if (typeof opts.callback === 'function') opts.callback();
    };
  }

  window.applyTajwidHighlight = function() {
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
  };

  window.updateTeksArabPreview = function(val) {
    var previewEl = document.getElementById('csTeksArabPreview');
    if (!previewEl) return;
    if (!val) {
      previewEl.innerHTML = '<span style="color:var(--text-3); font-size:14px;">–</span>';
      return;
    }
    var html = escapeHtml(val).replace(/\{\[(.*?)\]\}/g, function(match, content) {
      return `<span style="background:rgba(239,68,68,0.15); border-bottom:2px solid #ef4444; border-radius:4px; padding:2px 4px; font-weight:800; color:var(--text);">${content}</span>`;
    });
    previewEl.innerHTML = html;
  };

  window.updateSoalKuisSettingAction = async function (id_quiz, id_soal, durasi, poin) {
    try {
      showLoading('Menyimpan pengaturan soal...');
      // We pass undefined if value is null to avoid overwrite of the other parameter
      var finalDurasi = durasi !== null ? (durasi ? parseInt(durasi) : null) : undefined;
      var finalPoin = poin !== null ? (poin ? parseInt(poin) : 10) : undefined;
      
      await window.HQ.QuizAPI.updateSoalKuisSetting(id_quiz, id_soal, finalDurasi, finalPoin);
      hideLoading();
    } catch (err) {
      hideLoading();
      alert('Gagal memperbarui pengaturan soal: ' + err.message);
    }
  };

  window.bukaModalImportSoalGuru = function () {
    var modalEl = document.getElementById('guruQuizModalContainer');
    if (!modalEl) return;

    _parsedImportSoal = [];

    modalEl.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)closeGuruQuizModal()">
        <div style="background:var(--card-solid,#fff);border-radius:var(--r-xl,24px);padding:24px;width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;gap:14px;box-shadow:var(--shadow-lg);overflow:hidden;">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-shrink:0;">
            <h3 style="font-size:16px;font-weight:800;color:var(--text)">📥 Import Soal via CSV</h3>
            <button onclick="closeGuruQuizModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-3)">✕</button>
          </div>

          <div style="overflow-y:auto;flex:1;padding-right:4px;display:flex;flex-direction:column;gap:12px;">
            <div style="background:var(--blue-l);border-radius:var(--r-sm);padding:14px;">
              <div style="font-size:12px;font-weight:700;color:var(--blue-d);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">📋 Panduan Pengisian Template</div>
              <ol style="font-size:12px;color:var(--blue-d);line-height:1.8;padding-left:16px;margin:0;">
                <li>Unduh template dengan mengklik tombol di bawah ini.</li>
                <li>Kolom <strong>tipe_soal</strong> wajib diisi: <code>pilihan_ganda</code>, <code>benar_salah</code>, <code>matching</code>, <code>audio</code>, <code>teks_arab</code>, atau <code>isian_singkat</code>.</li>
                <li>Kolom <strong>pilihan</strong>: pisahkan opsi dengan <code>|</code> dan tandai yang benar dengan <code>*</code> di akhir (contoh: <code>A*|B|C|D</code>).</li>
                <li>Kolom <strong>levels</strong>: masukkan level halaqah dipisah koma (contoh: <code>Level 1,Level 2</code>).</li>
                <li>Simpan berkas dalam format <strong>CSV (UTF-8, pemisah titik koma / semicolon)</strong>.</li>
              </ol>
              <button onclick="downloadTemplateSoalGuru()" style="margin-top:10px;background:#fff;border:1.5px solid var(--blue);color:var(--blue-d);padding:6px 12px;border-radius:100px;font-size:11px;font-weight:700;cursor:pointer;">Unduh Template CSV Soal</button>
            </div>

            <!-- Dropzone -->
            <div id="dropZoneSoalGuru" style="border:2px dashed var(--border);border-radius:var(--r-md);padding:30px 16px;text-align:center;cursor:pointer;background:var(--bg-2);transition:all .2s;" onclick="document.getElementById('csvFileInputSoalGuru').click()">
              <div style="font-size:36px;margin-bottom:8px">☁️</div>
              <div style="font-weight:700;font-size:13.5px;color:var(--text-2)">Drag berkas CSV Soal ke sini atau klik untuk memilih</div>
              <div style="font-size:11px;color:var(--text-3);margin-top:4px">Format berkas: .csv (UTF-8)</div>
            </div>
            <input type="file" id="csvFileInputSoalGuru" accept=".csv" style="display:none" onchange="handleFileSelectSoalGuru(event)">

            <!-- Preview Box -->
            <div id="importPreviewBoxSoalGuru" style="display:none;margin-top:8px;">
              <div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em;">👁️ Pratinjau Soal (<span id="previewCountSoalGuru">0</span> soal terdeteksi)</div>
              <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--r-sm);">
                <table style="width:100%;border-collapse:collapse;font-size:11.5px;text-align:left;">
                  <thead>
                    <tr style="background:var(--bg-2);border-bottom:1px solid var(--border);">
                      <th style="padding:8px 10px;">Tipe</th>
                      <th style="padding:8px 10px;">Teks Soal</th>
                      <th style="padding:8px 10px;">Level</th>
                      <th style="padding:8px 10px;">Rekomendasi P.</th>
                      <th style="padding:8px 10px;">Status</th>
                    </tr>
                  </thead>
                  <tbody id="importPreviewTbodySoalGuru"></tbody>
                </table>
              </div>
            </div>

            <!-- Progress bar -->
            <div id="importProgressSoalGuru" style="display:none;margin-top:8px;">
              <div style="font-size:12px;color:var(--text-2);margin-bottom:4px;display:flex;justify-content:space-between;">
                <span>Mengimpor data soal...</span>
                <strong id="importProgressTextSoalGuru">0%</strong>
              </div>
              <div style="height:8px;background:var(--bg-2);border-radius:4px;overflow:hidden;">
                <div id="importProgressBarSoalGuru" style="width:0%;height:100%;background:var(--blue);transition:width .1s;"></div>
              </div>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;flex-shrink:0;border-top:1px solid var(--border);padding-top:12px;">
            <button onclick="closeGuruQuizModal()" id="btnBatalImportSoalGuru" style="padding:8px 16px;background:var(--bg-2);color:var(--text);border:none;border-radius:100px;font-weight:700;cursor:pointer;">Batal</button>
            <button id="btnImportSoalGuru" onclick="prosesImportSoalGuru()" disabled style="padding:8px 20px;background:linear-gradient(135deg,var(--blue),var(--blue-d));color:#fff;border:none;border-radius:100px;font-weight:800;cursor:pointer;opacity:0.5;box-shadow:var(--shadow-blue);">🚀 Mulai Impor</button>
          </div>
        </div>
      </div>
    `;

    // Add drag and drop listeners
    var dz = document.getElementById('dropZoneSoalGuru');
    if (dz) {
      dz.addEventListener('dragover', function(e) {
        e.preventDefault();
        dz.style.borderColor = 'var(--blue)';
        dz.style.background = 'rgba(56,189,248,.05)';
      });
      dz.addEventListener('dragleave', function(e) {
        e.preventDefault();
        dz.style.borderColor = 'var(--border)';
        dz.style.background = '';
      });
      dz.addEventListener('drop', function(e) {
        e.preventDefault();
        dz.style.borderColor = 'var(--border)';
        dz.style.background = '';
        var files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.endsWith('.csv')) {
          parseCSVSoalGuru(files[0]);
        }
      });
    }
  };

  window.downloadTemplateSoalGuru = function () {
    window.SoalCore.downloadTemplate('template_import_soal_rattil.csv');
  };

  window.handleFileSelectSoalGuru = function (e) {
    var file = e.target.files[0];
    if (!file) return;
    parseCSVSoalGuru(file);
  };

  window.parseCSVSoalGuru = function (file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      // Parse & validasi = SoalCore (sumber tunggal, sadar-kutip, kunci_isian string).
      var res = window.SoalCore.parseCSV(e.target.result);
      if (res.empty) {
        alert('File CSV kosong atau hanya berisi header!');
        return;
      }
      if (res.headerError) {
        alert('Header CSV tidak cocok dengan template! Gunakan separator titik koma (;)');
        return;
      }

      _parsedImportSoal = res.items;
      var validCount = res.validCount;

      // Render preview dari item hasil SoalCore (markup identik dgn sebelumnya).
      var tbody = document.getElementById('importPreviewTbodySoalGuru');
      tbody.innerHTML = res.items.map(function(item) {
        var statusHtml = item.error
          ? '<span style="color:var(--red);font-weight:700">❌ ' + escapeHtml(item.error) + '</span>'
          : '<span style="color:var(--green);font-weight:700">✅ Valid</span>';
        return `
          <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:8px 10px;"><span style="font-size:10px;font-weight:800;background:var(--blue-l);color:var(--blue-d);padding:2px 8px;border-radius:100px;">${escapeHtml(getTipeSoalLabel(item.tipe_soal))}</span></td>
            <td style="padding:8px 10px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(item.teks_soal)}">${escapeHtml(item.teks_soal)}</td>
            <td style="padding:8px 10px;">${(item.levels || []).map(function(l) { return '<span style="font-size:10px;font-weight:800;background:rgba(16,185,129,0.1);color:#059669;padding:2px 8px;border-radius:100px;margin-right:2px;">' + escapeHtml(l) + '</span>'; }).join('') || '–'}</td>
            <td style="padding:8px 10px;text-align:center;">${item.rekomendasi_pertemuan_ke || '–'}</td>
            <td style="padding:8px 10px;">${statusHtml}</td>
          </tr>
        `;
      }).join('');

      document.getElementById('previewCountSoalGuru').textContent = _parsedImportSoal.length;
      document.getElementById('importPreviewBoxSoalGuru').style.display = 'block';
      
      var dropZone = document.getElementById('dropZoneSoalGuru');
      dropZone.style.borderColor = validCount === _parsedImportSoal.length ? 'var(--green)' : 'var(--amber)';
      dropZone.innerHTML = `<div style="font-size:32px">📂</div>`
        + `<div style="font-weight:700;font-size:13.5px;color:var(--text-2)">Berkas: ${escapeHtml(file.name)}</div>`
        + `<div style="font-size:11px;color:var(--text-3);margin-top:4px">${validCount} dari ${_parsedImportSoal.length} soal valid dan siap diimpor.</div>`;

      var importBtn = document.getElementById('btnImportSoalGuru');
      importBtn.disabled = validCount === 0;
      importBtn.style.opacity = validCount === 0 ? '0.5' : '1';
    };
    reader.readAsText(file);
  };

  window.prosesImportSoalGuru = async function () {
    var validSoalList = _parsedImportSoal.filter(function(s) { return !s.error; });
    if (validSoalList.length === 0) return;

    document.getElementById('btnImportSoalGuru').disabled = true;
    document.getElementById('btnBatalImportSoalGuru').disabled = true;
    
    var progBox = document.getElementById('importProgressSoalGuru');
    var progBar = document.getElementById('importProgressBarSoalGuru');
    var progText = document.getElementById('importProgressTextSoalGuru');
    
    progBox.style.display = 'block';
    progBar.style.width = '0%';
    progText.textContent = '0%';

    var importedCount = 0;

    for (var i = 0; i < validSoalList.length; i++) {
      var s = validSoalList[i];
      try {
        var payload = {
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
        console.error('prosesImportSoalGuru failed row:', i, err);
      }
      
      var percent = Math.round(((i + 1) / validSoalList.length) * 100);
      progBar.style.width = percent + '%';
      progText.textContent = percent + '%';
    }

    alert('Impor Selesai! ' + importedCount + ' dari ' + validSoalList.length + ' soal berhasil masuk ke Bank Soal.');
    closeGuruQuizModal();
    await loadGuruQuizTabContent();
  };

  // WhatsApp reminder helpers for teachers
  window.sendPersonalWa = function (nama, noHp, judulKuis) {
    var text = "Assalamualaikum wr. wb. Saudara/i *" + nama + "*, semoga senantiasa dalam limpahan taufik dan kesehatan dari Allah SWT.\n\nSekadar mengingatkan untuk meluangkan sedikit waktu guna menyelesaikan tugas latihan kuis halaqah kita: *" + judulKuis + "*.\n\nSemoga Allah memudahkan langkah antum/antunna dalam menuntut ilmu dan menghafalkan kalam-Nya. Syukron jazakallahu khairan. 🙏✨";
    var encoded = encodeURIComponent(text);
    var url = "https://api.whatsapp.com/send?phone=" + noHp + "&text=" + encoded;
    window.open(url, '_blank');
  };

  window.shareRecapWa = function (judulKuis, list) {
    if (!list || list.length === 0) return;
    
    var text = "Assalamualaikum wr. wb. Bapak/Ibu/Saudara sekalian anggota halaqah, semoga Allah merahmati dan melimpahkan keberkahan kepada kita semua.\n\nBerikut kami informasikan rekan-rekan yang belum berkesempatan menyelesaikan kuis *" + judulKuis + "*:\n\n";
    
    list.forEach(function(m, idx) {
      text += (idx + 1) + ". *" + m.nama_lengkap + "*\n";
    });
    
    text += "\nMari bersama-sama kita luangkan waktu sejenak demi kelancaran dan keberkahan halaqah kita. Semoga Allah mudahkan setiap urusan kita semua. Jazakumullahu khairan katsiran. 🙏📖✨";
    
    try {
      var tempInput = document.createElement("textarea");
      tempInput.value = text;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);
      alert("Pesan rekap pengingat grup berhasil disalin ke clipboard! Silakan tempel (paste) di grup WhatsApp halaqah Anda.");
    } catch (e) {
      console.warn("Clipboard copy failed: ", e);
    }
    
    var encoded = encodeURIComponent(text);
    var url = "https://api.whatsapp.com/send?text=" + encoded;
    window.open(url, '_blank');
  };

  function formatWaNumber(num) {
    if (!num) return '';
    var clean = num.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '62' + clean.slice(1);
    } else if (clean.startsWith('8')) {
      clean = '62' + clean;
    }
    return clean;
  }

  // ══════════════════════════════════════════
  //  KELOLA MAZE (Rattil Maze) — guru, level miliknya + audiens per-halaqah
  // ══════════════════════════════════════════
  var GURU_MAZE_GRID = ['#############','#.....1.....#','#.#.##.#.##.#','#.#....#....#','#.#..#.#.##.#','#....#G.....#','#.##...##.#.#','#4....P...#2#','#.#.##.##...#','#.#.##......#','#...##.##.#.#','#.#.......#.#','#.#.##.#....#','#.....3.....#','#############'];
  var _GMZ_INP = 'width:100%;padding:10px;border-radius:8px;border:1px solid #cbd5e1;font-family:inherit;font-size:13px';
  var _guruMazeQuizCache = [];
  function _gmzLabel(t) { return '<label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px">' + t + '</label>'; }
  function _gmzBadge(text, color) { return '<span style="display:inline-block;font-size:9px;font-weight:800;padding:2px 7px;border-radius:100px;background:' + color + '1a;color:' + color + '">' + esc(text) + '</span>'; }
  function _gmzErr(e) { return esc((e && e.message) || e || 'error'); }

  window.renderGuruMazePage = async function () {
    var page = document.getElementById('page-maze-guru');
    if (!page) return;
    page.innerHTML =
      '<div style="font-size:18px;font-weight:800;margin-bottom:4px">🎮 Rattil Maze (Petualangan)</div>' +
      '<div style="font-size:13px;color:#64748b;margin-bottom:16px">Buat game labirin untuk halaqah Anda. Pilih halaqah tujuan — hanya murid di halaqah itu yang melihatnya. Quiz opsional sebagai sumber soal.</div>' +
      '<div style="margin-bottom:16px"><button onclick="openGuruMazeModal(null)" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border:none;padding:10px 18px;border-radius:100px;font-weight:800;font-size:13px;cursor:pointer">➕ Tambah Petualangan</button></div>' +
      '<div id="guruMazeList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px"><div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8">Memuat…</div></div>';
    await loadGuruMazeList();
  };

  async function loadGuruMazeList() {
    var box = document.getElementById('guruMazeList');
    if (!box) return;
    try {
      var levels = (((await window.HQ.QuizAPI.getMazeLevelsGuru()) || {}).data) || [];
      if (!_guruMazeQuizCache.length) { try { _guruMazeQuizCache = (((await window.HQ.QuizAPI.getKuisList()) || {}).data) || []; } catch (e) {} }
      var quizMap = {}; _guruMazeQuizCache.forEach(function (q) { quizMap[q.id_quiz] = q; });
      var halMap = {}; (halaqahList || []).forEach(function (h) { halMap[h.id_halaqah] = h.nama_halaqah; });
      if (!levels.length) { box.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8">Belum ada petualangan. Klik "Tambah Petualangan".</div>'; return; }
      box.innerHTML = levels.map(function (lv) {
        var q = lv.id_kuis ? quizMap[lv.id_kuis] : null;
        var sumber = lv.id_kuis ? (q ? '🔗 ' + esc(q.judul) + ' ' + _gmzBadge(q.status, q.status === 'aktif' ? '#16a34a' : '#d97706') : _gmzBadge('quiz tak ditemukan', '#dc2626')) : _gmzBadge('Latihan bebas', '#2563eb');
        var aud = (lv.target_halaqah && lv.target_halaqah.length) ? lv.target_halaqah.map(function (id) { return esc(halMap[id] || id); }).join(', ') : '(belum ada halaqah tujuan)';
        return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px"><div><div style="font-weight:800;font-size:14.5px">' + esc(lv.nama_level) + '</div><div style="font-size:11px;color:#94a3b8;margin-top:2px">Urutan ' + esc(lv.urutan) + ' · ' + esc(lv.tingkat_kesulitan) + ' · 👾 ' + esc(lv.jumlah_monster) + ' · ⚡ ' + esc(lv.kecepatan_monster) + '×</div></div>' + _gmzBadge(lv.aktif ? 'Aktif' : 'Nonaktif', lv.aktif ? '#16a34a' : '#6b7280') + '</div>' +
            '<div style="font-size:11.5px;color:#475569;margin-bottom:4px">Sumber soal: ' + sumber + '</div>' +
            '<div style="font-size:11px;color:#94a3b8;margin-bottom:12px">Audiens: ' + aud + (lv.rekomendasi_pertemuan_ke ? ' · rekom. pertemuan ke-' + esc(lv.rekomendasi_pertemuan_ke) : '') + '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button onclick="openGuruMazeModal(\'' + escJs(lv.id_maze_level) + '\')" style="flex:1;background:#e0f2fe;color:#0369a1;border:none;padding:8px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">✏️ Edit</button>' +
              '<button onclick="toggleGuruMazeAktif(\'' + escJs(lv.id_maze_level) + '\',' + (lv.aktif ? 'false' : 'true') + ')" style="flex:1;background:#f1f5f9;color:#334155;border:none;padding:8px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">' + (lv.aktif ? '⏸ Nonaktifkan' : '▶ Aktifkan') + '</button>' +
              '<button onclick="deleteGuruMazeConfirm(\'' + escJs(lv.id_maze_level) + '\',\'' + escJs(lv.nama_level) + '\')" style="background:#fee2e2;color:#dc2626;border:none;padding:8px 12px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">🗑</button>' +
            '</div></div>';
      }).join('');
    } catch (e) { box.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#dc2626">Gagal memuat: ' + _gmzErr(e) + '</div>'; }
  }

  window.openGuruMazeModal = async function (id_maze_level) {
    var cont = document.getElementById('guruMazeModalContainer');
    if (!cont) return;
    var editing = null;
    try {
      if (id_maze_level) { showLoad('Memuat petualangan…'); var lv = (((await window.HQ.QuizAPI.getMazeLevelsGuru()) || {}).data) || []; editing = lv.filter(function (x) { return x.id_maze_level === id_maze_level; })[0] || null; }
      if (!_guruMazeQuizCache.length) { _guruMazeQuizCache = (((await window.HQ.QuizAPI.getKuisList()) || {}).data) || []; }
      hideLoad();
    } catch (e) { hideLoad(); toast('Gagal memuat: ' + _gmzErr(e), 'err'); return; }
    if (id_maze_level && !editing) { toast('Petualangan tidak ditemukan', 'err'); return; }
    var g = editing || {}, kes = g.tingkat_kesulitan || 'mudah', tHal = g.target_halaqah || [];
    var quizOpts = ['<option value="">— Latihan bebas (tanpa quiz) —</option>'].concat(_guruMazeQuizCache.map(function (q) { return '<option value="' + esc(q.id_quiz) + '"' + (g.id_kuis === q.id_quiz ? ' selected' : '') + '>' + esc(q.judul) + ' (' + esc(q.status) + ')</option>'; })).join('');
    var halChecks = (halaqahList || []).map(function (h) { return '<label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="gmzHalCheck" value="' + esc(h.id_halaqah) + '"' + (tHal.indexOf(h.id_halaqah) >= 0 ? ' checked' : '') + '> ' + esc(h.nama_halaqah) + (h.level ? ' <span style="color:#94a3b8">(' + esc(h.level) + ')</span>' : '') + '</label>'; }).join('') || '<div style="font-size:12px;color:#94a3b8">Anda belum punya halaqah.</div>';
    cont.innerHTML =
      '<div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px" onclick="if(event.target===this)closeGuruMazeModal()">' +
        '<div style="background:#fff;border-radius:20px;padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,.3)">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="font-size:16px;font-weight:800">🎮 ' + (editing ? 'Edit' : 'Tambah') + ' Petualangan</h3><button onclick="closeGuruMazeModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#94a3b8">✕</button></div>' +
          '<form onsubmit="submitGuruMazeLevel(event,' + (editing ? '\'' + escJs(editing.id_maze_level) + '\'' : 'null') + ')">' +
            '<div style="margin-bottom:12px">' + _gmzLabel('NAMA PETUALANGAN *') + '<input id="gmzNama" required value="' + esc(g.nama_level || '') + '" placeholder="Contoh: Tahsin Pekan 3" style="' + _GMZ_INP + '"></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px"><div>' + _gmzLabel('URUTAN') + '<input id="gmzUrutan" type="number" min="0" value="' + (g.urutan != null ? esc(g.urutan) : 0) + '" style="' + _GMZ_INP + '"></div><div>' + _gmzLabel('KESULITAN') + '<select id="gmzKesulitan" style="' + _GMZ_INP + '"><option value="mudah"' + (kes === 'mudah' ? ' selected' : '') + '>Mudah</option><option value="sedang"' + (kes === 'sedang' ? ' selected' : '') + '>Sedang</option><option value="sulit"' + (kes === 'sulit' ? ' selected' : '') + '>Sulit</option></select></div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px"><div>' + _gmzLabel('JUMLAH MONSTER (1–4)') + '<input id="gmzMonster" type="number" min="1" max="4" value="' + (g.jumlah_monster != null ? esc(g.jumlah_monster) : 2) + '" style="' + _GMZ_INP + '"></div><div>' + _gmzLabel('KECEPATAN (×)') + '<input id="gmzKecepatan" type="number" min="0.5" max="2" step="0.1" value="' + (g.kecepatan_monster != null ? esc(g.kecepatan_monster) : '1.0') + '" style="' + _GMZ_INP + '"></div></div>' +
            '<div style="margin-bottom:12px">' + _gmzLabel('HALAQAH TUJUAN (AUDIENS) *') + '<div style="display:grid;grid-template-columns:1fr;gap:6px;background:#f8fafc;padding:10px;border-radius:8px;border:1px solid #e2e8f0;max-height:150px;overflow-y:auto">' + halChecks + '</div><div style="font-size:10.5px;color:#94a3b8;margin-top:4px">Hanya murid di halaqah terpilih yang melihat game ini.</div></div>' +
            '<div style="margin-bottom:12px">' + _gmzLabel('SUMBER SOAL (QUIZ, opsional)') + '<select id="gmzKuis" style="' + _GMZ_INP + '">' + quizOpts + '</select><div style="font-size:10.5px;color:#94a3b8;margin-top:4px">Pilih quiz → soal dari quiz itu (yang dicentang "boleh maze"). Kosong → dari semua soal "boleh maze".</div></div>' +
            '<div style="margin-bottom:12px">' + _gmzLabel('REKOMENDASI PERTEMUAN KE- (opsional)') + '<input id="gmzPertemuan" type="number" min="1" value="' + (g.rekomendasi_pertemuan_ke != null ? esc(g.rekomendasi_pertemuan_ke) : '') + '" placeholder="mis. 10" style="' + _GMZ_INP + '"></div>' +
            '<label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer;background:#f8fafc;padding:11px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px"><input type="checkbox" id="gmzAktif"' + ((!editing || g.aktif) ? ' checked' : '') + '> <span>Aktif (tampilkan ke murid)</span></label>' +
            '<div style="display:flex;gap:10px"><button type="button" onclick="closeGuruMazeModal()" style="flex:1;padding:11px;background:#f1f5f9;color:#334155;border:none;border-radius:100px;font-weight:700;cursor:pointer">Batal</button><button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border:none;border-radius:100px;font-weight:800;cursor:pointer">' + (editing ? 'Simpan Perubahan' : 'Simpan Petualangan') + '</button></div>' +
          '</form></div></div>';
  };

  window.closeGuruMazeModal = function () { var c = document.getElementById('guruMazeModalContainer'); if (c) c.innerHTML = ''; };

  window.submitGuruMazeLevel = async function (e, id_maze_level) {
    e.preventDefault();
    var nama = document.getElementById('gmzNama').value.trim();
    if (!nama) { toast('Nama level wajib diisi', 'err'); return; }
    var target_halaqah = Array.prototype.slice.call(document.querySelectorAll('.gmzHalCheck:checked')).map(function (cb) { return cb.value; });
    if (!target_halaqah.length) { toast('Pilih minimal satu halaqah tujuan', 'err'); return; }
    var monster = parseInt(document.getElementById('gmzMonster').value); if (isNaN(monster) || monster < 1) monster = 1; if (monster > 4) monster = 4;
    var kecepatan = parseFloat(document.getElementById('gmzKecepatan').value); if (isNaN(kecepatan) || kecepatan <= 0) kecepatan = 1.0;
    var pert = document.getElementById('gmzPertemuan').value;
    var payload = { nama_level: nama, urutan: parseInt(document.getElementById('gmzUrutan').value) || 0, tingkat_kesulitan: document.getElementById('gmzKesulitan').value, jumlah_monster: monster, kecepatan_monster: kecepatan, id_kuis: document.getElementById('gmzKuis').value || null, target_halaqah: target_halaqah, rekomendasi_pertemuan_ke: pert !== '' ? parseInt(pert) : null, aktif: document.getElementById('gmzAktif').checked };
    try {
      showLoad('Menyimpan…');
      if (id_maze_level) { await window.HQ.QuizAPI.updateMazeLevelGuru(id_maze_level, payload); }
      else { payload.map_data = { grid: GURU_MAZE_GRID, seed: 40 }; await window.HQ.QuizAPI.createMazeLevelGuru(payload); }
      hideLoad(); closeGuruMazeModal(); toast('Petualangan tersimpan!', 'ok'); await loadGuruMazeList();
    } catch (err) { hideLoad(); toast('Gagal menyimpan: ' + _gmzErr(err), 'err'); }
  };

  window.toggleGuruMazeAktif = async function (id_maze_level, aktif) {
    try { showLoad('Mengubah status…'); await window.HQ.QuizAPI.setMazeLevelAktifGuru(id_maze_level, aktif === true || aktif === 'true'); hideLoad(); await loadGuruMazeList(); }
    catch (err) { hideLoad(); toast('Gagal: ' + _gmzErr(err), 'err'); }
  };

  window.deleteGuruMazeConfirm = async function (id_maze_level, nama) {
    if (!confirm('Hapus petualangan "' + nama + '"?\n\nProgress/skor murid pada level ini ikut terhapus.')) return;
    try { showLoad('Menghapus…'); await window.HQ.QuizAPI.deleteMazeLevelGuru(id_maze_level); hideLoad(); toast('Petualangan dihapus', 'ok'); await loadGuruMazeList(); }
    catch (err) { hideLoad(); toast('Gagal menghapus: ' + _gmzErr(err), 'err'); }
  };

  // ══════════════════════════════════════════
  //  RATTIL RUN — guru, level miliknya + audiens per-halaqah (reuse helper _gmz*)
  //  Field khas Run (target_soal/kecepatan_awal/kepadatan_rintangan), tanpa monster/peta.
  // ══════════════════════════════════════════
  var _guruRunQuizCache = [];

  window.renderGuruRunPage = async function () {
    var page = document.getElementById('page-run-guru');
    if (!page) return;
    page.innerHTML =
      '<div style="font-size:18px;font-weight:800;margin-bottom:4px">🦘 Rattil Run (Lari)</div>' +
      '<div style="font-size:13px;color:#64748b;margin-bottom:16px">Buat game pelari kuis untuk halaqah Anda. Pilih halaqah tujuan — hanya murid di halaqah itu yang melihatnya. Quiz opsional sebagai sumber soal. Hanya soal ber-flag "Boleh Rattil Run" yang tampil.</div>' +
      '<div style="margin-bottom:16px"><button onclick="openGuruRunModal(null)" style="background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border:none;padding:10px 18px;border-radius:100px;font-weight:800;font-size:13px;cursor:pointer">➕ Tambah Level</button></div>' +
      '<div id="guruRunList" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:16px"><div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8">Memuat…</div></div>';
    await loadGuruRunList();
  };

  async function loadGuruRunList() {
    var box = document.getElementById('guruRunList');
    if (!box) return;
    try {
      var levels = (((await window.HQ.QuizAPI.getRunLevelsGuru()) || {}).data) || [];
      if (!_guruRunQuizCache.length) { try { _guruRunQuizCache = (((await window.HQ.QuizAPI.getKuisList()) || {}).data) || []; } catch (e) {} }
      var quizMap = {}; _guruRunQuizCache.forEach(function (q) { quizMap[q.id_quiz] = q; });
      var halMap = {}; (halaqahList || []).forEach(function (h) { halMap[h.id_halaqah] = h.nama_halaqah; });
      if (!levels.length) { box.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#94a3b8">Belum ada level lari. Klik "Tambah Level".</div>'; return; }
      box.innerHTML = levels.map(function (lv) {
        var q = lv.id_kuis ? quizMap[lv.id_kuis] : null;
        var sumber = lv.id_kuis ? (q ? '🔗 ' + esc(q.judul) + ' ' + _gmzBadge(q.status, q.status === 'aktif' ? '#16a34a' : '#d97706') : _gmzBadge('quiz tak ditemukan', '#dc2626')) : _gmzBadge('Latihan bebas', '#2563eb');
        var aud = (lv.target_halaqah && lv.target_halaqah.length) ? lv.target_halaqah.map(function (id) { return esc(halMap[id] || id); }).join(', ') : '(belum ada halaqah tujuan)';
        return '<div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)">' +
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px"><div><div style="font-weight:800;font-size:14.5px">🦘 ' + esc(lv.nama_level) + '</div><div style="font-size:11px;color:#94a3b8;margin-top:2px">Urutan ' + esc(lv.urutan) + ' · ' + esc(lv.tingkat_kesulitan) + ' · 🎯 ' + esc(lv.target_soal) + ' soal · ⚡ ' + esc(lv.kecepatan_awal) + '× · 🌵 ' + esc(lv.kepadatan_rintangan) + '×</div></div>' + _gmzBadge(lv.aktif ? 'Aktif' : 'Nonaktif', lv.aktif ? '#16a34a' : '#6b7280') + '</div>' +
            '<div style="font-size:11.5px;color:#475569;margin-bottom:4px">Sumber soal: ' + sumber + '</div>' +
            '<div style="font-size:11px;color:#94a3b8;margin-bottom:12px">Audiens: ' + aud + (lv.rekomendasi_pertemuan_ke ? ' · rekom. pertemuan ke-' + esc(lv.rekomendasi_pertemuan_ke) : '') + '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
              '<button onclick="openGuruRunModal(\'' + escJs(lv.id_run_level) + '\')" style="flex:1;background:#e0f2fe;color:#0369a1;border:none;padding:8px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">✏️ Edit</button>' +
              '<button onclick="toggleGuruRunAktif(\'' + escJs(lv.id_run_level) + '\',' + (lv.aktif ? 'false' : 'true') + ')" style="flex:1;background:#f1f5f9;color:#334155;border:none;padding:8px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">' + (lv.aktif ? '⏸ Nonaktifkan' : '▶ Aktifkan') + '</button>' +
              '<button onclick="deleteGuruRunConfirm(\'' + escJs(lv.id_run_level) + '\',\'' + escJs(lv.nama_level) + '\')" style="background:#fee2e2;color:#dc2626;border:none;padding:8px 12px;border-radius:8px;font-weight:700;font-size:12px;cursor:pointer">🗑</button>' +
            '</div></div>';
      }).join('');
    } catch (e) { box.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:#dc2626">Gagal memuat: ' + _gmzErr(e) + '</div>'; }
  }

  window.openGuruRunModal = async function (id_run_level) {
    var cont = document.getElementById('guruRunModalContainer');
    if (!cont) return;
    var editing = null;
    try {
      if (id_run_level) { showLoad('Memuat level lari…'); var lv = (((await window.HQ.QuizAPI.getRunLevelsGuru()) || {}).data) || []; editing = lv.filter(function (x) { return x.id_run_level === id_run_level; })[0] || null; }
      if (!_guruRunQuizCache.length) { _guruRunQuizCache = (((await window.HQ.QuizAPI.getKuisList()) || {}).data) || []; }
      hideLoad();
    } catch (e) { hideLoad(); toast('Gagal memuat: ' + _gmzErr(e), 'err'); return; }
    if (id_run_level && !editing) { toast('Level tidak ditemukan', 'err'); return; }
    var g = editing || {}, kes = g.tingkat_kesulitan || 'mudah', tHal = g.target_halaqah || [];
    var quizOpts = ['<option value="">— Latihan bebas (tanpa quiz) —</option>'].concat(_guruRunQuizCache.map(function (q) { return '<option value="' + esc(q.id_quiz) + '"' + (g.id_kuis === q.id_quiz ? ' selected' : '') + '>' + esc(q.judul) + ' (' + esc(q.status) + ')</option>'; })).join('');
    var halChecks = (halaqahList || []).map(function (h) { return '<label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;cursor:pointer"><input type="checkbox" class="gruHalCheck" value="' + esc(h.id_halaqah) + '"' + (tHal.indexOf(h.id_halaqah) >= 0 ? ' checked' : '') + '> ' + esc(h.nama_halaqah) + (h.level ? ' <span style="color:#94a3b8">(' + esc(h.level) + ')</span>' : '') + '</label>'; }).join('') || '<div style="font-size:12px;color:#94a3b8">Anda belum punya halaqah.</div>';
    cont.innerHTML =
      '<div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px" onclick="if(event.target===this)closeGuruRunModal()">' +
        '<div style="background:#fff;border-radius:20px;padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,.3)">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px"><h3 style="font-size:16px;font-weight:800">🦘 ' + (editing ? 'Edit' : 'Tambah') + ' Level Lari</h3><button onclick="closeGuruRunModal()" style="background:none;border:none;font-size:18px;cursor:pointer;color:#94a3b8">✕</button></div>' +
          '<form onsubmit="submitGuruRunLevel(event,' + (editing ? '\'' + escJs(editing.id_run_level) + '\'' : 'null') + ')">' +
            '<div style="margin-bottom:12px">' + _gmzLabel('NAMA LEVEL *') + '<input id="gruNama" required value="' + esc(g.nama_level || '') + '" placeholder="Contoh: Lari Tahsin Pekan 3" style="' + _GMZ_INP + '"></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px"><div>' + _gmzLabel('URUTAN') + '<input id="gruUrutan" type="number" min="0" value="' + (g.urutan != null ? esc(g.urutan) : 0) + '" style="' + _GMZ_INP + '"></div><div>' + _gmzLabel('KESULITAN') + '<select id="gruKesulitan" style="' + _GMZ_INP + '"><option value="mudah"' + (kes === 'mudah' ? ' selected' : '') + '>Mudah</option><option value="sedang"' + (kes === 'sedang' ? ' selected' : '') + '>Sedang</option><option value="sulit"' + (kes === 'sulit' ? ' selected' : '') + '>Sulit</option></select></div></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px"><div>' + _gmzLabel('TARGET SOAL') + '<input id="gruTargetSoal" type="number" min="1" max="20" value="' + (g.target_soal != null ? esc(g.target_soal) : 8) + '" style="' + _GMZ_INP + '"></div><div>' + _gmzLabel('KECEPATAN (×)') + '<input id="gruKecepatan" type="number" min="0.5" max="2" step="0.1" value="' + (g.kecepatan_awal != null ? esc(g.kecepatan_awal) : '1.0') + '" style="' + _GMZ_INP + '"></div><div>' + _gmzLabel('RINTANGAN (×)') + '<input id="gruKepadatan" type="number" min="0.5" max="2" step="0.1" value="' + (g.kepadatan_rintangan != null ? esc(g.kepadatan_rintangan) : '1.0') + '" style="' + _GMZ_INP + '"></div></div>' +
            '<div style="margin-bottom:12px">' + _gmzLabel('HALAQAH TUJUAN (AUDIENS) *') + '<div style="display:grid;grid-template-columns:1fr;gap:6px;background:#f8fafc;padding:10px;border-radius:8px;border:1px solid #e2e8f0;max-height:150px;overflow-y:auto">' + halChecks + '</div><div style="font-size:10.5px;color:#94a3b8;margin-top:4px">Hanya murid di halaqah terpilih yang melihat game ini.</div></div>' +
            '<div style="margin-bottom:12px">' + _gmzLabel('SUMBER SOAL (QUIZ, opsional)') + '<select id="gruKuis" style="' + _GMZ_INP + '">' + quizOpts + '</select><div style="font-size:10.5px;color:#94a3b8;margin-top:4px">Pilih quiz → soal dari quiz itu (yang dicentang "Boleh Rattil Run"). Kosong → dari semua soal "Boleh Rattil Run".</div></div>' +
            '<div style="margin-bottom:12px">' + _gmzLabel('REKOMENDASI PERTEMUAN KE- (opsional)') + '<input id="gruPertemuan" type="number" min="1" value="' + (g.rekomendasi_pertemuan_ke != null ? esc(g.rekomendasi_pertemuan_ke) : '') + '" placeholder="mis. 10" style="' + _GMZ_INP + '"></div>' +
            '<label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:8px;cursor:pointer;background:#f8fafc;padding:11px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px"><input type="checkbox" id="gruAktif"' + ((!editing || g.aktif) ? ' checked' : '') + '> <span>Aktif (tampilkan ke murid)</span></label>' +
            '<div style="display:flex;gap:10px"><button type="button" onclick="closeGuruRunModal()" style="flex:1;padding:11px;background:#f1f5f9;color:#334155;border:none;border-radius:100px;font-weight:700;cursor:pointer">Batal</button><button type="submit" style="flex:1.5;padding:11px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border:none;border-radius:100px;font-weight:800;cursor:pointer">' + (editing ? 'Simpan Perubahan' : 'Simpan Level') + '</button></div>' +
          '</form></div></div>';
  };

  window.closeGuruRunModal = function () { var c = document.getElementById('guruRunModalContainer'); if (c) c.innerHTML = ''; };

  window.submitGuruRunLevel = async function (e, id_run_level) {
    e.preventDefault();
    var nama = document.getElementById('gruNama').value.trim();
    if (!nama) { toast('Nama level wajib diisi', 'err'); return; }
    var target_halaqah = Array.prototype.slice.call(document.querySelectorAll('.gruHalCheck:checked')).map(function (cb) { return cb.value; });
    if (!target_halaqah.length) { toast('Pilih minimal satu halaqah tujuan', 'err'); return; }
    var target = parseInt(document.getElementById('gruTargetSoal').value); if (isNaN(target) || target < 1) target = 1; if (target > 20) target = 20;
    var kecepatan = parseFloat(document.getElementById('gruKecepatan').value); if (isNaN(kecepatan) || kecepatan <= 0) kecepatan = 1.0;
    var kepadatan = parseFloat(document.getElementById('gruKepadatan').value); if (isNaN(kepadatan) || kepadatan <= 0) kepadatan = 1.0;
    var pert = document.getElementById('gruPertemuan').value;
    var payload = { nama_level: nama, urutan: parseInt(document.getElementById('gruUrutan').value) || 0, tingkat_kesulitan: document.getElementById('gruKesulitan').value, target_soal: target, kecepatan_awal: kecepatan, kepadatan_rintangan: kepadatan, id_kuis: document.getElementById('gruKuis').value || null, target_halaqah: target_halaqah, rekomendasi_pertemuan_ke: pert !== '' ? parseInt(pert) : null, aktif: document.getElementById('gruAktif').checked };
    try {
      showLoad('Menyimpan…');
      if (id_run_level) { await window.HQ.QuizAPI.updateRunLevelGuru(id_run_level, payload); }
      else { await window.HQ.QuizAPI.createRunLevelGuru(payload); }
      hideLoad(); closeGuruRunModal(); toast('Level lari tersimpan!', 'ok'); await loadGuruRunList();
    } catch (err) { hideLoad(); toast('Gagal menyimpan: ' + _gmzErr(err), 'err'); }
  };

  window.toggleGuruRunAktif = async function (id_run_level, aktif) {
    try { showLoad('Mengubah status…'); await window.HQ.QuizAPI.setRunLevelAktifGuru(id_run_level, aktif === true || aktif === 'true'); hideLoad(); await loadGuruRunList(); }
    catch (err) { hideLoad(); toast('Gagal: ' + _gmzErr(err), 'err'); }
  };

  window.deleteGuruRunConfirm = async function (id_run_level, nama) {
    if (!confirm('Hapus level lari "' + nama + '"?\n\nProgress/skor murid pada level ini ikut terhapus.')) return;
    try { showLoad('Menghapus…'); await window.HQ.QuizAPI.deleteRunLevelGuru(id_run_level); hideLoad(); toast('Level lari dihapus', 'ok'); await loadGuruRunList(); }
    catch (err) { hideLoad(); toast('Gagal menghapus: ' + _gmzErr(err), 'err'); }
  };

})();
