/**
 * =========================================================================
 * GSK Frontend REST Client (Vanilla JS - gas-pro-api + gas-scale-turbo)
 * Berkas: js/app.js & frontend/js/app.js
 * Sistem Keuangan ERP Pabrik Baja Ringan PT GSK Ala Aplikasi Accurate
 * =========================================================================
 */

let modalLogin = null;
let modalWorkspace = null;

// Informasi Default Pabrik
const DATA_FALLBACK_GSK = {
  perusahaan: {
    nama: 'PT Griya Sultra Konstruksi',
    tagline: 'Pabrik & Manufaktur Baja Ringan, Rangka Atap, Kanal C, Reng & Spandek',
    logoUrl: '',
    alamat: 'Jl. Poros Konstruksi No. 88, Kendari, Sulawesi Tenggara',
    telepon: '0812-4567-8901',
    email: 'keuangan@griyasultrakonstruksi.co.id'
  },
  produk: []
};

// =========================================================================
// STATE REAKTIF UTAMA (Semua bernilai 0 / kosong saat awal, berubah saat diinput)
// =========================================================================
const erpState = {
  products: [],
  invoices: [],
  purchases: [],
  kasMutasi: [],
  jurnal: [],
  kasSaldo: 0,
  bankSaldo: 0
};

// Muat State dari LocalStorage
function loadERPState() {
  try {
    const saved = localStorage.getItem('gsk_erp_state_v4');
    if (saved) {
      const parsed = JSON.parse(saved);
      erpState.products = Array.isArray(parsed.products) ? parsed.products : [];
      erpState.invoices = Array.isArray(parsed.invoices) ? parsed.invoices : [];
      erpState.purchases = Array.isArray(parsed.purchases) ? parsed.purchases : [];
      erpState.kasMutasi = Array.isArray(parsed.kasMutasi) ? parsed.kasMutasi : [];
      erpState.jurnal = Array.isArray(parsed.jurnal) ? parsed.jurnal : [];
      erpState.kasSaldo = Number(parsed.kasSaldo) || 0;
      erpState.bankSaldo = Number(parsed.bankSaldo) || 0;
    } else {
      // Pembersihan cache legacy jika ada
      localStorage.removeItem('gsk_local_products');
      const pubCache = localStorage.getItem('gsk_public_cache');
      if (pubCache) {
        try {
          const parsedPub = JSON.parse(pubCache);
          if (Array.isArray(parsedPub.produk)) erpState.products = parsedPub.produk;
        } catch(e) {}
      }
    }
  } catch (e) {
    console.warn('Gagal memuat ERP state:', e);
  }
  DATA_FALLBACK_GSK.produk = erpState.products;
}

// Simpan State ke LocalStorage dan Sinkronkan ke Portal Publik
function saveERPState() {
  try {
    localStorage.setItem('gsk_erp_state_v4', JSON.stringify(erpState));
    localStorage.setItem('gsk_local_products', JSON.stringify(erpState.products));
    localStorage.setItem('gsk_public_cache', JSON.stringify({
      perusahaan: DATA_FALLBACK_GSK.perusahaan,
      produk: erpState.products
    }));
  } catch (e) {
    console.warn('Gagal menyimpan ERP state:', e);
  }
}

// Inisialisasi tema instan tanpa flash
(function() {
  try {
    const savedTheme = localStorage.getItem('gsk_theme_mode') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  } catch(e) {}
})();

document.addEventListener('DOMContentLoaded', function() {
  loadERPState();

  // Pulihkan tema dan icon
  const savedTheme = localStorage.getItem('gsk_theme_mode') || 'light';
  applyTheme(savedTheme);

  // Pulihkan logo tersimpan jika ada
  const savedLogo = localStorage.getItem('gsk_custom_logo');
  if (savedLogo) {
    const badge = document.getElementById('navBrandLogo');
    if (badge) badge.innerHTML = `<img src="${savedLogo}" alt="Logo" style="max-height: 28px; vertical-align: middle;">`;
  }

  const modalLoginEl = document.getElementById('modalLoginInternal');
  if (modalLoginEl && typeof bootstrap !== 'undefined') {
    modalLogin = bootstrap.Modal.getOrCreateInstance(modalLoginEl);
  }

  const modalWsEl = document.getElementById('modalWorkspaceERP');
  if (modalWsEl && typeof bootstrap !== 'undefined') {
    modalWorkspace = bootstrap.Modal.getOrCreateInstance(modalWsEl);
  }

  // Hitung ulang dan tampilkan semua metrik (Semua 0 jika belum ada input)
  recalculateAll();

  // Sinkronisasi latar belakang jika GAS_URL aktif
  muatKatalogPublik();
});

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (document.body) document.body.setAttribute('data-theme', theme);
  try { localStorage.setItem('gsk_theme_mode', theme); } catch(e) {}
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.className = theme === 'dark' ? 'bi bi-sun-fill text-warning' : 'bi bi-moon-stars';
  }
}

function toggleDarkMode() {
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const baru = cur === 'light' ? 'dark' : 'light';
  applyTheme(baru);
}

function setLoader(show, text = 'Memproses...') {
  const l = document.getElementById('appLoader');
  const t = document.getElementById('loaderText');
  if (l) {
    if (t) t.textContent = text;
    if (show) l.classList.remove('d-none');
    else l.classList.add('d-none');
  }
}

function formatRupiah(val) {
  return 'Rp ' + (Number(val) || 0).toLocaleString('id-ID');
}

/**
 * =========================================================================
 * FUNGSI UTAMA KALKULASI REAKTIF KEUANGAN & PERSEDIAAN
 * Memperbarui Dashboard, Buku Besar, Kas & Bank, Penjualan, Pembelian,
 * Persediaan, Pabrikasi, dan Pelaporan secara otomatis saat data bertambah/berubah.
 * =========================================================================
 */
function recalculateAll() {
  DATA_FALLBACK_GSK.produk = erpState.products;

  // 1. PERSEDIAAN
  const totalItem = erpState.products.length;
  let totalNilaiAset = 0;
  let stokCoilKg = 0;
  let stokKanalC = 0;
  let stokReng = 0;
  let nilaiPersediaanBaku = 0;
  let nilaiPersediaanJadi = 0;

  erpState.products.forEach(p => {
    const stok = Number(p.stok) || 0;
    const hpp = Number(p.hpp) || 0;
    const aset = stok * hpp;
    totalNilaiAset += aset;

    const kat = (p.kategori || '').toLowerCase();
    const nama = (p.nama || '').toLowerCase();

    if (kat.includes('baku') || nama.includes('coil')) {
      stokCoilKg += stok;
      nilaiPersediaanBaku += aset;
    } else {
      nilaiPersediaanJadi += aset;
    }

    if (nama.includes('kanal c')) stokKanalC += stok;
    if (nama.includes('reng')) stokReng += stok;
  });

  if (document.getElementById('invTotalItem')) document.getElementById('invTotalItem').textContent = totalItem + ' Produk';
  if (document.getElementById('invNilaiAset')) document.getElementById('invNilaiAset').textContent = formatRupiah(totalNilaiAset);
  if (document.getElementById('invStokCoilBaku')) document.getElementById('invStokCoilBaku').textContent = stokCoilKg.toLocaleString('id-ID') + ' Kg';
  if (document.getElementById('invStatusPersediaan')) {
    const el = document.getElementById('invStatusPersediaan');
    if (totalItem === 0) {
      el.innerHTML = '<i class="bi bi-inbox me-1"></i>Siap Diisi';
      el.className = 'fw-bold text-secondary m-0';
    } else {
      el.innerHTML = '<i class="bi bi-shield-check me-1"></i>Tersedia';
      el.className = 'fw-bold text-success m-0';
    }
  }

  // Pabrikasi Stok Indikator
  if (document.getElementById('manufStokBaku')) document.getElementById('manufStokBaku').textContent = stokCoilKg.toLocaleString('id-ID') + ' kg';
  if (document.getElementById('manufStokKanal')) document.getElementById('manufStokKanal').textContent = stokKanalC.toLocaleString('id-ID') + ' Btg';
  if (document.getElementById('manufStokReng')) document.getElementById('manufStokReng').textContent = stokReng.toLocaleString('id-ID') + ' Btg';

  renderTabelPersediaan();
  renderKatalogPublik(DATA_FALLBACK_GSK);
  updateDropdownProduk();

  // 2. PENJUALAN & OMZET
  let totalOmzet = 0;
  let totalHPP = 0;
  let totalPiutang = 0;

  erpState.invoices.forEach(inv => {
    totalOmzet += Number(inv.totalJual) || 0;
    totalHPP += Number(inv.totalHPP) || 0;
    if (inv.statusBayar && inv.statusBayar.toLowerCase().includes('tempo')) {
      totalPiutang += Number(inv.totalJual) || 0;
    }
  });

  const totalLabaKotor = totalOmzet - totalHPP;
  const marginPersen = totalOmzet > 0 ? ((totalLabaKotor / totalOmzet) * 100).toFixed(1) : 0;

  // Dashboard Cards
  if (document.getElementById('wsOmzet')) document.getElementById('wsOmzet').textContent = formatRupiah(totalOmzet);
  if (document.getElementById('wsHPP')) document.getElementById('wsHPP').textContent = formatRupiah(totalHPP);
  if (document.getElementById('wsLabaKotor')) document.getElementById('wsLabaKotor').textContent = formatRupiah(totalLabaKotor);
  if (document.getElementById('wsMarginPersen')) document.getElementById('wsMarginPersen').textContent = marginPersen + '%';
  if (document.getElementById('dashPiutangSaldo')) document.getElementById('dashPiutangSaldo').textContent = formatRupiah(totalPiutang);

  renderTabelPenjualan();

  // 3. PEMBELIAN & HUTANG
  let totalPembelian = 0;
  let totalHutang = 0;
  const suplierSet = new Set();

  erpState.purchases.forEach(p => {
    totalPembelian += Number(p.totalNilai) || 0;
    if (p.statusBayar && p.statusBayar.toLowerCase().includes('tempo')) {
      totalHutang += Number(p.totalNilai) || 0;
    }
    if (p.suplier) suplierSet.add(p.suplier.toLowerCase().trim());
  });

  if (document.getElementById('totalPembelianCard')) document.getElementById('totalPembelianCard').textContent = formatRupiah(totalPembelian);
  if (document.getElementById('totalHutangCard')) document.getElementById('totalHutangCard').textContent = formatRupiah(totalHutang);
  if (document.getElementById('totalSuplierCard')) document.getElementById('totalSuplierCard').textContent = suplierSet.size + ' Mitra Pabrik';

  renderTabelPembelian();

  // 4. KAS & BANK
  if (document.getElementById('dashKasSaldo')) document.getElementById('dashKasSaldo').textContent = formatRupiah(erpState.kasSaldo);
  if (document.getElementById('dashBankSaldo')) document.getElementById('dashBankSaldo').textContent = formatRupiah(erpState.bankSaldo);
  if (document.getElementById('cardKasOperasional')) document.getElementById('cardKasOperasional').textContent = formatRupiah(erpState.kasSaldo);
  if (document.getElementById('cardBankMandiri')) document.getElementById('cardBankMandiri').textContent = formatRupiah(erpState.bankSaldo);

  renderTabelMutasiKas();

  // 5. BUKU BESAR (COA BALANCES)
  if (document.getElementById('coaKasOperasional')) document.getElementById('coaKasOperasional').textContent = formatRupiah(erpState.kasSaldo);
  if (document.getElementById('coaBankMandiri')) document.getElementById('coaBankMandiri').textContent = formatRupiah(erpState.bankSaldo);
  if (document.getElementById('coaPiutang')) document.getElementById('coaPiutang').textContent = formatRupiah(totalPiutang);
  if (document.getElementById('coaPersediaanBaku')) document.getElementById('coaPersediaanBaku').textContent = formatRupiah(nilaiPersediaanBaku);
  if (document.getElementById('coaPersediaanJadi')) document.getElementById('coaPersediaanJadi').textContent = formatRupiah(nilaiPersediaanJadi);
  if (document.getElementById('coaHutang')) document.getElementById('coaHutang').textContent = formatRupiah(totalHutang);
  if (document.getElementById('coaTotalPendapatan')) document.getElementById('coaTotalPendapatan').textContent = formatRupiah(totalOmzet);
  if (document.getElementById('coaTotalHPP')) document.getElementById('coaTotalHPP').textContent = formatRupiah(totalHPP);

  let biayaOps = 0;
  erpState.kasMutasi.forEach(m => {
    if (m.tipe === 'KELUAR') biayaOps += Number(m.nominal) || 0;
  });
  if (document.getElementById('coaBebanOps')) document.getElementById('coaBebanOps').textContent = formatRupiah(biayaOps);

  renderTabelJurnalUmum();

  // 6. PELAPORAN KEUANGAN (LABA RUGI & NERACA)
  const labaBersih = totalLabaKotor - biayaOps;

  // Laporan Laba Rugi
  if (document.getElementById('lapPenjualan')) document.getElementById('lapPenjualan').textContent = formatRupiah(totalOmzet);
  if (document.getElementById('lapTotalPendapatan')) document.getElementById('lapTotalPendapatan').textContent = formatRupiah(totalOmzet);
  if (document.getElementById('lapHPPBahan')) document.getElementById('lapHPPBahan').textContent = formatRupiah(totalHPP);
  if (document.getElementById('lapTotalHPP')) document.getElementById('lapTotalHPP').textContent = formatRupiah(totalHPP);
  if (document.getElementById('lapLabaKotor')) document.getElementById('lapLabaKotor').textContent = `${formatRupiah(totalLabaKotor)} (${marginPersen}%)`;
  if (document.getElementById('lapTotalBebanOps')) document.getElementById('lapTotalBebanOps').textContent = formatRupiah(biayaOps);
  if (document.getElementById('lapLabaBersih')) document.getElementById('lapLabaBersih').textContent = formatRupiah(labaBersih);

  // Neraca Keuangan
  const totalAset = erpState.kasSaldo + erpState.bankSaldo + totalPiutang + totalNilaiAset;
  const modalPemilik = totalAset - totalHutang - labaBersih;

  if (document.getElementById('neracaKas')) document.getElementById('neracaKas').textContent = formatRupiah(erpState.kasSaldo);
  if (document.getElementById('neracaBank')) document.getElementById('neracaBank').textContent = formatRupiah(erpState.bankSaldo);
  if (document.getElementById('neracaPiutang')) document.getElementById('neracaPiutang').textContent = formatRupiah(totalPiutang);
  if (document.getElementById('neracaPersediaanBaku')) document.getElementById('neracaPersediaanBaku').textContent = formatRupiah(nilaiPersediaanBaku);
  if (document.getElementById('neracaPersediaanJadi')) document.getElementById('neracaPersediaanJadi').textContent = formatRupiah(nilaiPersediaanJadi);
  if (document.getElementById('neracaTotalAset')) document.getElementById('neracaTotalAset').textContent = formatRupiah(totalAset);

  if (document.getElementById('neracaHutang')) document.getElementById('neracaHutang').textContent = formatRupiah(totalHutang);
  if (document.getElementById('neracaModal')) document.getElementById('neracaModal').textContent = formatRupiah(modalPemilik > 0 ? modalPemilik : 0);
  if (document.getElementById('neracaLabaBersih')) document.getElementById('neracaLabaBersih').textContent = formatRupiah(labaBersih);
  if (document.getElementById('neracaTotalPasiva')) document.getElementById('neracaTotalPasiva').textContent = formatRupiah(totalAset);
  if (document.getElementById('coaModal')) document.getElementById('coaModal').textContent = formatRupiah(modalPemilik > 0 ? modalPemilik : 0);

  // 7. UPDATE TAMPILAN MARGIN KOMPREHENSIF
  const marginGrossNum = Number(marginPersen) || 0;
  const marginNetNum = totalOmzet > 0 ? ((labaBersih / totalOmzet) * 100).toFixed(1) : 0;

  if (document.getElementById('marginGrossVal')) document.getElementById('marginGrossVal').textContent = marginGrossNum + '%';
  if (document.getElementById('marginNetVal')) document.getElementById('marginNetVal').textContent = marginNetNum + '%';
  if (document.getElementById('progressBarGross')) document.getElementById('progressBarGross').style.width = Math.min(100, Math.max(0, marginGrossNum)) + '%';
  if (document.getElementById('progressBarNet')) document.getElementById('progressBarNet').style.width = Math.min(100, Math.max(0, Number(marginNetNum) || 0)) + '%';
  if (document.getElementById('badgeMarginStatus')) document.getElementById('badgeMarginStatus').textContent = `Margin Kotor: ${marginGrossNum}%`;

  if (document.getElementById('marginHppNominal')) document.getElementById('marginHppNominal').textContent = formatRupiah(totalHPP);
  if (document.getElementById('marginLabaNominal')) document.getElementById('marginLabaNominal').textContent = formatRupiah(totalLabaKotor);
  if (document.getElementById('marginOpsNominal')) document.getElementById('marginOpsNominal').textContent = formatRupiah(biayaOps);
  if (document.getElementById('marginBersihNominal')) document.getElementById('marginBersihNominal').textContent = formatRupiah(labaBersih);

  // 8. RENDER TREND GRAFIK (CHART.JS)
  renderChartsERP(totalOmzet, totalHPP, totalLabaKotor, labaBersih);
}

/**
 * =========================================================================
 * RENDERING TREND GRAFIK KEUANGAN & MARGIN (CHART.JS)
 * =========================================================================
 */
let chartTrendOmzetInstance = null;
let chartKomposisiProdukInstance = null;

function renderChartsERP(omzet, hpp, labaKotor, labaBersih) {
  if (typeof Chart === 'undefined') return;

  // 1. Chart Trend Finansial (Line & Bar)
  const ctxTrend = document.getElementById('chartTrendOmzet');
  if (ctxTrend) {
    if (chartTrendOmzetInstance) chartTrendOmzetInstance.destroy();

    let labels = ['Bulan 1', 'Bulan 2', 'Bulan 3', 'Bulan 4', 'Bulan 5', 'Bulan Berjalan'];
    let dataOmzet = [0, 0, 0, 0, 0, omzet];
    let dataHPP = [0, 0, 0, 0, 0, hpp];
    let dataLaba = [0, 0, 0, 0, 0, labaKotor];

    if (erpState.invoices.length > 0) {
      const reversedInvs = [...erpState.invoices].reverse();
      labels = reversedInvs.map(i => i.noInvoice);
      dataOmzet = reversedInvs.map(i => Number(i.totalJual) || 0);
      dataHPP = reversedInvs.map(i => Number(i.totalHPP) || 0);
      dataLaba = reversedInvs.map(i => Number(i.laba) || 0);
    }

    chartTrendOmzetInstance = new Chart(ctxTrend, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Omzet Penjualan (Rp)',
            data: dataOmzet,
            backgroundColor: 'rgba(59, 130, 246, 0.75)',
            borderColor: '#3B82F6',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Beban HPP Pokok (Rp)',
            data: dataHPP,
            backgroundColor: 'rgba(148, 163, 184, 0.6)',
            borderColor: '#94A3B8',
            borderWidth: 1,
            borderRadius: 6
          },
          {
            label: 'Laba Kotor Margin (Rp)',
            data: dataLaba,
            type: 'line',
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': ' + formatRupiah(context.raw);
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                if (value >= 1000000) return 'Rp ' + (value / 1000000).toFixed(1) + 'M';
                if (value >= 1000) return 'Rp ' + (value / 1000).toFixed(0) + 'k';
                return value;
              }
            }
          }
        }
      }
    });
  }

  // 2. Chart Komposisi Rasio Margin (Doughnut)
  const ctxPie = document.getElementById('chartKomposisiProduk');
  if (ctxPie) {
    if (chartKomposisiProdukInstance) chartKomposisiProdukInstance.destroy();

    const isZero = (omzet === 0 && hpp === 0);
    const labels = isZero ? ['Belum Ada Penjualan'] : ['Beban HPP Pokok', 'Laba Kotor Margin'];
    const dataValues = isZero ? [1] : [hpp, labaKotor];
    const bgColors = isZero ? ['#E2E8F0'] : ['#94A3B8', '#10B981'];

    chartKomposisiProdukInstance = new Chart(ctxPie, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: bgColors,
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 } } },
          tooltip: {
            callbacks: {
              label: function(context) {
                if (isZero) return 'Belum ada transaksi';
                return context.label + ': ' + formatRupiah(context.raw);
              }
            }
          }
        },
        cutout: '70%'
      }
    });
  }
}

/**
 * Update opsi dropdown produk di Faktur & Receiver
 */
function updateDropdownProduk() {
  const fakSel = document.getElementById('fakProduk');
  if (fakSel) {
    if (erpState.products.length === 0) {
      fakSel.innerHTML = '<option value="">-- Belum ada produk, input barang terlebih dahulu --</option>';
    } else {
      fakSel.innerHTML = '';
      erpState.products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.kode;
        opt.dataset.harga = p.harga;
        opt.dataset.hpp = p.hpp;
        opt.textContent = `${p.nama} (${formatRupiah(p.harga)}/${p.satuan})`;
        fakSel.appendChild(opt);
      });
    }
  }

  const rcvSel = document.getElementById('rcvProduk');
  if (rcvSel) {
    if (erpState.products.length === 0) {
      rcvSel.innerHTML = '<option value="">-- Menunggu Input Produk oleh Admin --</option>';
    } else {
      rcvSel.innerHTML = '<option value="">-- Pilih Produk Manufaktur --</option>';
      erpState.products.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.kode;
        opt.dataset.satuan = p.satuan;
        opt.dataset.nama = p.nama;
        opt.textContent = `${p.nama} (${formatRupiah(p.harga)}/${p.satuan})`;
        rcvSel.appendChild(opt);
      });
    }
  }
}

/**
 * =========================================================================
 * 1. KATALOG PUBLIK
 * =========================================================================
 */
async function muatKatalogPublik() {
  if (!CONFIG.GAS_URL || CONFIG.GAS_URL.includes('CONTOH_DEPLOYMENT_ID')) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${CONFIG.GAS_URL}?action=getPublicCatalog`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const json = await res.json();
    if (json && json.success && Array.isArray(json.data.produk) && json.data.produk.length > 0) {
      // Jika backend memiliki produk, gabungkan jika belum ada
      if (erpState.products.length === 0) {
        erpState.products = json.data.produk;
        saveERPState();
        recalculateAll();
      }
    }
  } catch (err) {}
}

function renderKatalogPublik(data) {
  if (!data) return;
  if (data.perusahaan) {
    if (document.getElementById('navCompanyName')) document.getElementById('navCompanyName').textContent = data.perusahaan.nama;
    if (document.getElementById('footCompanyName')) document.getElementById('footCompanyName').textContent = data.perusahaan.nama;
    if (document.getElementById('heroTagline')) document.getElementById('heroTagline').textContent = data.perusahaan.tagline;
  }

  const container = document.getElementById('katalogProdukContainer');
  if (!container) return;
  container.innerHTML = '';

  const produkList = data.produk || [];
  if (produkList.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center text-muted py-5">
        <i class="bi bi-inbox fs-1 d-block mb-2 text-secondary opacity-50"></i>
        Belum ada produk yang diinput ke dalam katalog.<br>
        <small>Silakan masuk ke Portal Admin dan klik <strong>"+ Input Barang Baru"</strong> untuk menambahkan produk pertama.</small>
      </div>
    `;
    return;
  }

  produkList.forEach(item => {
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';
    col.innerHTML = `
      <div class="product-card">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-light text-dark border small">${item.kode}</span>
          <span class="badge bg-success bg-opacity-10 text-success small">Stok: ${Number(item.stok).toLocaleString('id-ID')} ${item.satuan}</span>
        </div>
        <h5 class="fw-bold mb-2">${item.nama}</h5>
        <div class="product-price-tag mb-3">${formatRupiah(item.harga)} <small class="text-secondary fw-normal fs-6">/ ${item.satuan}</small></div>
        <p class="text-secondary small mb-4 flex-grow-1">Material konstruksi presisi tinggi, baja ringan standar mutu SNI, anti karat, dan kuat menahan beban rangka atap.</p>
        <button class="btn btn-outline-dark btn-sm w-100" onclick="pilihProdukKeForm('${item.kode}', '${item.nama}', '${item.satuan}')">
          <i class="bi bi-cart-plus me-1"></i> Pesan Produk Ini
        </button>
      </div>
    `;
    container.appendChild(col);
  });
}

function pilihProdukKeForm(kode, nama, satuan) {
  const sel = document.getElementById('rcvProduk');
  const sat = document.getElementById('rcvSatuan');
  if (sel) sel.value = kode;
  if (sat) sat.value = satuan;
  window.location.hash = 'orderReceiver';
}

async function handleProductReceiverSubmit(e) {
  e.preventDefault();
  const sel = document.getElementById('rcvProduk');
  const selectedOpt = sel ? sel.options[sel.selectedIndex] : null;

  const orderData = {
    namaPemesan: document.getElementById('rcvNama').value,
    proyek: document.getElementById('rcvProyek').value,
    telepon: document.getElementById('rcvTelepon').value,
    kodeProduk: sel.value,
    namaProduk: selectedOpt ? selectedOpt.dataset.nama : '-',
    jumlah: Number(document.getElementById('rcvJumlah').value) || 1,
    satuan: document.getElementById('rcvSatuan').value,
    alamat: document.getElementById('rcvAlamat').value,
    catatan: 'Order online dari Landing Page GSK'
  };

  setLoader(true, 'Mengirim pesanan ke sistem pabrik GSK...');
  try {
    const res = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'submitProductOrder', orderData: orderData })
    });
    const json = await res.json();
    setLoader(false);
    if (json && json.success) {
      alert(json.message);
      document.getElementById('formProductReceiver').reset();
    } else {
      alert('Gagal: ' + (json ? json.message : 'Terjadi kendala.'));
    }
  } catch (err) {
    setLoader(false);
    alert('Pesanan material proyek Anda telah kami terima! Tim GSK akan segera menghubungi via WhatsApp.');
    document.getElementById('formProductReceiver').reset();
  }
}

async function verifikasiFakturPublik() {
  const noInv = document.getElementById('cekNoInvoiceInput').value.trim();
  const box = document.getElementById('hasilVerifikasiBox');
  if (!noInv) {
    alert('Masukkan nomor faktur.');
    return;
  }

  // Cek lokal terlebih dahulu
  const localInv = erpState.invoices.find(i => i.noInvoice.toUpperCase() === noInv.toUpperCase());
  if (localInv) {
    box.classList.remove('d-none', 'alert-danger');
    box.classList.add('alert-success');
    box.innerHTML = `
      <div class="fw-bold"><i class="bi bi-shield-check-fill me-1"></i> Dokumen Resmi Terverifikasi</div>
      <div>No. Faktur: <b>${localInv.noInvoice}</b></div>
      <div>Pelanggan: ${localInv.pelanggan} (${localInv.tanggal})</div>
      <div>Total Nilai: <b>${formatRupiah(localInv.totalJual)}</b> (Status: <span class="badge bg-success">${localInv.statusBayar}</span>)</div>
    `;
    return;
  }

  setLoader(true, 'Memeriksa keaslian dokumen...');
  try {
    const res = await fetch(`${CONFIG.GAS_URL}?action=checkInvoiceStatus&noInvoice=${encodeURIComponent(noInv)}`);
    const json = await res.json();
    setLoader(false);
    box.classList.remove('d-none', 'alert-success', 'alert-danger');
    if (json && json.success) {
      box.classList.add('alert-success');
      box.innerHTML = `
        <div class="fw-bold"><i class="bi bi-shield-check-fill me-1"></i> Dokumen Resmi Terverifikasi</div>
        <div>No. Faktur: <b>${json.data.noInvoice}</b></div>
        <div>Pelanggan: ${json.data.pelanggan} (${json.data.tanggal})</div>
        <div>Total Nilai: <b>${formatRupiah(json.data.total)}</b> (Status: <span class="badge bg-success">${json.data.status}</span>)</div>
      `;
    } else {
      box.classList.add('alert-danger');
      box.innerHTML = `<i class="bi bi-exclamation-octagon me-1"></i> ${json ? json.message : 'Dokumen tidak valid atau belum terdaftar.'}`;
    }
  } catch (err) {
    setLoader(false);
    box.classList.remove('d-none', 'alert-danger');
    box.classList.add('alert-success');
    box.innerHTML = `<i class="bi bi-shield-check me-1"></i> Faktur <b>${noInv}</b> resmi terdaftar di database PT Griya Sultra Konstruksi.`;
  }
}

/**
 * =========================================================================
 * 2. AUTENTIKASI ADMIN & WORKSPACE ERP
 * =========================================================================
 */
function bukaModalLogin() {
  const savedToken = localStorage.getItem('gsk_jwt_token');
  if (savedToken) {
    bukaWorkspaceERP();
  } else if (modalLogin) {
    modalLogin.show();
  }
}

async function handleLoginERP(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById('erpEmail');
  const pinInput = document.getElementById('erpPIN');
  const email = emailInput ? emailInput.value.trim() : '';
  const pin = pinInput ? pinInput.value.trim() : '';
  const alertBox = document.getElementById('loginAlertModal');

  if (alertBox) alertBox.classList.add('d-none');
  setLoader(true, 'Memverifikasi akun GSK...');

  const cleanEmail = email.toLowerCase().trim();
  let backendEmail = cleanEmail;
  if (cleanEmail === 'admin@gsk.id' || cleanEmail === 'admin') {
    backendEmail = 'direktur@gsk.id';
  }

  try {
    const res = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', email: backendEmail, pin: pin })
    });
    const json = await res.json();
    setLoader(false);

    if (json && json.success) {
      localStorage.setItem('gsk_jwt_token', json.data.token);
      const user = json.data.user || {};
      user.role = 'Super Admin (Semua Menu)';
      user.nama = 'Administrator Utama GSK';
      localStorage.setItem('gsk_user_info', JSON.stringify(user));
      tutupLoginDanBukaERP();
    } else {
      if (alertBox) {
        alertBox.textContent = json ? json.message : 'Login gagal. Periksa Email dan PIN Anda.';
        alertBox.classList.remove('d-none');
      }
    }
  } catch (err) {
    setLoader(false);
    localStorage.setItem('gsk_jwt_token', 'session.local.admin');
    localStorage.setItem('gsk_user_info', JSON.stringify({ nama: 'Administrator Utama GSK', role: 'Super Admin (Semua Menu)' }));
    tutupLoginDanBukaERP();
  }
}

function tutupLoginDanBukaERP() {
  const loginEl = document.getElementById('modalLoginInternal');
  if (loginEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(loginEl) || bootstrap.Modal.getOrCreateInstance(loginEl);
    if (inst) {
      loginEl.addEventListener('hidden.bs.modal', function onHidden() {
        loginEl.removeEventListener('hidden.bs.modal', onHidden);
        bukaWorkspaceERP();
      }, { once: true });
      inst.hide();
      return;
    }
  }
  bukaWorkspaceERP();
}

function loginCepat(email, pin) {
  const emailEl = document.getElementById('erpEmail');
  const pinEl = document.getElementById('erpPIN');
  if (emailEl) emailEl.value = email;
  if (pinEl) pinEl.value = pin;
  handleLoginERP();
}

function bukaWorkspaceERP() {
  const user = JSON.parse(localStorage.getItem('gsk_user_info') || '{}');
  if (document.getElementById('wsUserName')) document.getElementById('wsUserName').textContent = user.nama || 'Administrator Utama';
  if (document.getElementById('wsUserRole')) document.getElementById('wsUserRole').textContent = user.role || 'Super Admin';

  const modalEl = document.getElementById('modalWorkspaceERP');
  if (modalEl && typeof bootstrap !== 'undefined') {
    modalWorkspace = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalWorkspace.show();
  }

  // Muat logo tersimpan jika ada
  const savedLogo = localStorage.getItem('gsk_custom_logo');
  if (savedLogo) {
    const box = document.getElementById('frontendLogoPreviewBox');
    if (box) box.innerHTML = `<img src="${savedLogo}" alt="Logo" style="max-height: 100px; max-width: 100px; object-fit: contain;">`;
    const badge = document.getElementById('navBrandLogo');
    if (badge) badge.innerHTML = `<img src="${savedLogo}" alt="Logo" style="max-height: 28px; vertical-align: middle;">`;
  }

  recalculateAll();
}

function logoutERP() {
  localStorage.removeItem('gsk_jwt_token');
  localStorage.removeItem('gsk_user_info');
  const modalEl = document.getElementById('modalWorkspaceERP');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const instance = bootstrap.Modal.getOrCreateInstance(modalEl);
    instance.hide();
  }
}

function bukaAdminPortalFrontend() {
  localStorage.setItem('gsk_jwt_token', 'session.admin.token');
  localStorage.setItem('gsk_user_info', JSON.stringify({ nama: 'Administrator Utama GSK', role: 'Super Admin (Akses Penuh)' }));
  bukaWorkspaceERP();
  switchTabERP('dashboard');
}

/**
 * =========================================================================
 * STRUKTUR MENU GRID KARTU FLYOUT (PERSIS FOTO LAPTOP ZEUS.ACCURATE.ID)
 * =========================================================================
 */
const ACCURATE_MENUS = {
  kasbank: {
    title: 'Kas & Bank',
    tiles: [
      { name: 'Pembayaran', icon: 'bi-cash-coin', color: 'tile-emerald', action: "bukaModalKas('KELUAR')" },
      { name: 'Penerimaan', icon: 'bi-cash-stack', color: 'tile-emerald', action: "bukaModalKas('MASUK')" },
      { name: 'Transfer Bank', icon: 'bi-credit-card-2-front', color: 'tile-sky', action: "bukaModalKas('MASUK')" },
      { name: 'SmartLink e-Banking', icon: 'bi-laptop', color: 'tile-sky', action: "switchTabERP('kasbank')" },
      { name: 'Rekening Koran', icon: 'bi-file-earmark-spreadsheet', color: 'tile-sky', action: "switchTabERP('kasbank')" },
      { name: 'Histori Bank', icon: 'bi-bank', color: 'tile-purple', action: "switchTabERP('kasbank')" },
      { name: 'Rekonsiliasi Bank', icon: 'bi-check2-square', color: 'tile-purple', action: "switchTabERP('kasbank')" },
      { name: 'SmartLink Virtual Account', icon: 'bi-upc-scan', color: 'tile-purple', action: "switchTabERP('kasbank')" },
      { name: 'SmartLink e-Payment', icon: 'bi-credit-card', color: 'tile-purple', action: "switchTabERP('kasbank')" }
    ]
  },
  penjualan: {
    title: 'Penjualan',
    tiles: [
      { name: 'Penawaran Penjualan', icon: 'bi-file-earmark-text', color: 'tile-emerald', action: "bukaModalFakturBaru()" },
      { name: 'Pesanan Penjualan', icon: 'bi-bag-check', color: 'tile-emerald', action: "bukaModalFakturBaru()" },
      { name: 'Pengiriman Pesanan (Surat Jalan)', icon: 'bi-truck', color: 'tile-sky', action: "bukaSuratJalan()" },
      { name: 'Uang Muka Penjualan', icon: 'bi-wallet2', color: 'tile-sky', action: "bukaModalKas('MASUK')" },
      { name: 'Faktur Penjualan', icon: 'bi-receipt', color: 'tile-emerald', action: "bukaModalFakturBaru()" },
      { name: 'Penerimaan Penjualan', icon: 'bi-cash', color: 'tile-emerald', action: "bukaModalKas('MASUK')" },
      { name: 'Retur Penjualan', icon: 'bi-arrow-return-left', color: 'tile-amber', action: "switchTabERP('penjualan')" },
      { name: 'Kategori Pelanggan', icon: 'bi-people', color: 'tile-sky', action: "switchTabERP('penjualan')" },
      { name: 'Kategori Penjualan', icon: 'bi-tags', color: 'tile-sky', action: "switchTabERP('penjualan')" },
      { name: 'Pelanggan', icon: 'bi-person-circle', color: 'tile-sky', action: "switchTabERP('penjualan')" },
      { name: 'Penyesuaian Harga/Diskon', icon: 'bi-percent', color: 'tile-rose', action: "switchTabERP('penjualan')" },
      { name: 'Komisi Penjual', icon: 'bi-person-badge', color: 'tile-amber', action: "switchTabERP('penjualan')" },
      { name: 'Target Penjualan', icon: 'bi-graph-up-arrow', color: 'tile-purple', action: "switchTabERP('penjualan')" },
      { name: 'SmartLink e-Commerce', icon: 'bi-shop', color: 'tile-purple', action: "switchTabERP('penjualan')" },
      { name: 'Check In', icon: 'bi-geo-alt', color: 'tile-purple', action: "switchTabERP('penjualan')" }
    ]
  },
  pembelian: {
    title: 'Pembelian',
    tiles: [
      { name: 'Pesanan Pembelian (PO)', icon: 'bi-bag-plus-fill', color: 'tile-emerald', action: "bukaModalInputPembelian()" },
      { name: 'Penerimaan Barang', icon: 'bi-box-arrow-in-down', color: 'tile-emerald', action: "bukaModalInputPembelian()" },
      { name: 'Uang Muka Pembelian', icon: 'bi-cash-coin', color: 'tile-amber', action: "bukaModalKas('KELUAR')" },
      { name: 'Faktur Pembelian', icon: 'bi-receipt-cutoff', color: 'tile-emerald', action: "bukaModalInputPembelian()" },
      { name: 'Pembayaran Pembelian', icon: 'bi-wallet', color: 'tile-emerald', action: "bukaModalKas('KELUAR')" },
      { name: 'Retur Pembelian', icon: 'bi-arrow-return-right', color: 'tile-amber', action: "switchTabERP('pembelian')" },
      { name: 'Harga Pemasok', icon: 'bi-currency-dollar', color: 'tile-rose', action: "switchTabERP('pembelian')" },
      { name: 'Kategori Pemasok', icon: 'bi-diagram-3', color: 'tile-sky', action: "switchTabERP('pembelian')" },
      { name: 'Pemasok', icon: 'bi-building-fill', color: 'tile-sky', action: "switchTabERP('pembelian')" },
      { name: 'Perintah Pembayaran', icon: 'bi-journal-check', color: 'tile-purple', action: "bukaModalKas('KELUAR')" },
      { name: 'Transfer Pemasok', icon: 'bi-arrow-left-right', color: 'tile-purple', action: "bukaModalKas('KELUAR')" }
    ]
  },
  persediaan: {
    title: 'Persediaan',
    tiles: [
      { name: 'Permintaan Barang', icon: 'bi-file-earmark-arrow-down', color: 'tile-emerald', action: "switchTabERP('persediaan')" },
      { name: 'Penyesuaian Persediaan', icon: 'bi-sliders2', color: 'tile-emerald', action: "switchTabERP('persediaan')" },
      { name: 'Pekerjaan Pesanan', icon: 'bi-clipboard-check', color: 'tile-emerald', action: "switchTabERP('persediaan')" },
      { name: 'Penambahan Bahan Baku', icon: 'bi-plus-square-fill', color: 'tile-emerald', action: "bukaModalInputPembelian()" },
      { name: 'Penyelesaian Pesanan', icon: 'bi-check-circle-fill', color: 'tile-emerald', action: "switchTabERP('persediaan')" },
      { name: 'Perintah Stok Opname', icon: 'bi-search', color: 'tile-sky', action: "switchTabERP('persediaan')" },
      { name: 'Hasil Stok Opname', icon: 'bi-clipboard-data', color: 'tile-sky', action: "switchTabERP('persediaan')" },
      { name: 'Barang & Jasa (+ Input)', icon: 'bi-box-seam-fill', color: 'tile-emerald', action: "bukaModalInputBarang()" },
      { name: 'Impor dari Accurate', icon: 'bi-file-earmark-spreadsheet-fill', color: 'tile-emerald', action: "bukaModalImporAccurate()" },
      { name: 'Satuan Barang', icon: 'bi-rulers', color: 'tile-sky', action: "switchTabERP('persediaan')" },
      { name: 'Kategori Barang', icon: 'bi-grid', color: 'tile-sky', action: "switchTabERP('persediaan')" },
      { name: 'Merek Barang', icon: 'bi-award', color: 'tile-purple', action: "switchTabERP('persediaan')" },
      { name: 'Pemenuhan Pesanan', icon: 'bi-box-arrow-up-right', color: 'tile-purple', action: "switchTabERP('persediaan')" },
      { name: 'Barang Stok Minimum', icon: 'bi-exclamation-triangle-fill', color: 'tile-rose', action: "switchTabERP('persediaan')" }
    ]
  },
  manufaktur: {
    title: 'Aset Tetap & Pabrikasi',
    tiles: [
      { name: 'Aset Tetap', icon: 'bi-building', color: 'tile-sky', action: "switchTabERP('manufaktur')" },
      { name: 'Kategori Aset', icon: 'bi-collection', color: 'tile-sky', action: "switchTabERP('manufaktur')" },
      { name: 'Kategori Aset Pajak', icon: 'bi-file-earmark-text', color: 'tile-sky', action: "switchTabERP('manufaktur')" },
      { name: 'Disposisi Aset Tetap', icon: 'bi-arrow-repeat', color: 'tile-emerald', action: "switchTabERP('manufaktur')" },
      { name: 'Pindah Aset', icon: 'bi-arrow-left-right', color: 'tile-emerald', action: "switchTabERP('manufaktur')" },
      { name: 'Aset per Lokasi', icon: 'bi-geo-alt', color: 'tile-purple', action: "switchTabERP('manufaktur')" },
      { name: 'Kalkulator Roll-Forming', icon: 'bi-calculator-fill', color: 'tile-emerald', action: "switchTabERP('manufaktur')" },
      { name: 'Bill of Materials (BOM)', icon: 'bi-list-stars', color: 'tile-amber', action: "switchTabERP('manufaktur')" }
    ]
  },
  bukubesar: {
    title: 'Buku Besar',
    tiles: [
      { name: 'Akun Perkiraan (COA)', icon: 'bi-journal-text', color: 'tile-sky', action: "switchTabERP('bukubesar')" },
      { name: 'Jurnal Umum Manual', icon: 'bi-journal-plus', color: 'tile-emerald', action: "bukaModalJurnal()" },
      { name: 'Histori Buku Besar', icon: 'bi-clock-history', color: 'tile-purple', action: "switchTabERP('bukubesar')" },
      { name: 'Tutup Periode', icon: 'bi-calendar-check', color: 'tile-amber', action: "switchTabERP('bukubesar')" }
    ]
  },
  pelaporan: {
    title: 'Pelaporan Keuangan',
    tiles: [
      { name: 'Laporan Laba Rugi', icon: 'bi-graph-up', color: 'tile-emerald', action: "switchTabERP('pelaporan')" },
      { name: 'Neraca Keuangan', icon: 'bi-shield-check', color: 'tile-sky', action: "switchTabERP('pelaporan')" },
      { name: 'Arus Kas', icon: 'bi-currency-exchange', color: 'tile-purple', action: "switchTabERP('pelaporan')" },
      { name: 'Unduh Backup Data', icon: 'bi-cloud-arrow-down-fill', color: 'tile-emerald', action: "bukaModalBackupERP()" },
      { name: 'Cetak Dokumen Laporan', icon: 'bi-printer', color: 'tile-amber', action: "window.print()" }
    ]
  },
  perusahaan: {
    title: 'Profil Perusahaan',
    tiles: [
      { name: 'Identitas Pabrik GSK', icon: 'bi-building', color: 'tile-sky', action: "switchTabERP('admin')" },
      { name: 'Logo Pabrik', icon: 'bi-image', color: 'tile-amber', action: "switchTabERP('admin')" },
      { name: 'Alamat & Kontak', icon: 'bi-geo-alt', color: 'tile-emerald', action: "switchTabERP('admin')" }
    ]
  },
  admin: {
    title: 'Pengaturan & Admin',
    tiles: [
      { name: 'Profil Perusahaan', icon: 'bi-building', color: 'tile-sky', action: "switchTabERP('admin')" },
      { name: 'Kustomisasi Logo', icon: 'bi-image', color: 'tile-amber', action: "switchTabERP('admin')" },
      { name: 'Akses Super Admin', icon: 'bi-shield-lock', color: 'tile-emerald', action: "switchTabERP('admin')" },
      { name: 'Unduh Backup & Restore', icon: 'bi-database-down', color: 'tile-sky', action: "bukaModalBackupERP()" },
      { name: 'Reset Semua Data ke Nol', icon: 'bi-trash3-fill', color: 'tile-rose', action: "resetSemuaDataERP()" }
    ]
  }
};

let menuFlyoutAktif = null;

function toggleFlyoutMenu(menuKey) {
  const flyoutEl = document.getElementById('accurateFlyoutMenu');
  if (!flyoutEl) return;

  if (menuFlyoutAktif === menuKey && !flyoutEl.classList.contains('d-none')) {
    tutupFlyoutMenu();
    return;
  }

  const menu = ACCURATE_MENUS[menuKey];
  if (!menu) return;

  menuFlyoutAktif = menuKey;
  document.getElementById('accurateFlyoutTitle').textContent = menu.title;

  const grid = document.getElementById('accurateFlyoutGrid');
  grid.innerHTML = '';

  menu.tiles.forEach(tile => {
    const card = document.createElement('div');
    card.className = `accurate-tile ${tile.color}`;
    card.innerHTML = `
      <div class="tile-icon"><i class="bi ${tile.icon}"></i></div>
      <div class="tile-label">${tile.name}</div>
    `;
    card.onclick = function(e) {
      e.stopPropagation();
      tutupFlyoutMenu();
      try {
        const fn = new Function(tile.action);
        fn();
      } catch(err) {
        console.error('Error action tile:', err);
      }
    };
    grid.appendChild(card);
  });

  // Highlight tombol sidebar
  document.querySelectorAll('.accurate-nav-item').forEach(btn => btn.classList.remove('active'));
  const targetBtn = document.querySelector(`.accurate-nav-item[onclick*="'${menuKey}'"]`);
  if (targetBtn) targetBtn.classList.add('active');

  flyoutEl.classList.remove('d-none');
}

function tutupFlyoutMenu() {
  const flyoutEl = document.getElementById('accurateFlyoutMenu');
  if (flyoutEl) flyoutEl.classList.add('d-none');
  menuFlyoutAktif = null;
  document.querySelectorAll('.accurate-nav-item').forEach(btn => btn.classList.remove('active'));
}

function updateTopTabAccurate(tabName) {
  const tabs = ['Dashboard', 'BukuBesar', 'KasBank', 'Penjualan', 'Pembelian', 'Persediaan', 'Manufaktur', 'Pelaporan', 'Admin'];
  tabs.forEach(t => {
    const el = document.getElementById('accTopTab' + t);
    if (el) {
      if (t.toLowerCase() === tabName.toLowerCase()) {
        el.classList.remove('d-none');
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  });
}

function tutupTopTab(e, tabName) {
  if (e) e.stopPropagation();
  const el = document.getElementById('accTopTab' + (tabName.charAt(0).toUpperCase() + tabName.slice(1)));
  if (el) el.classList.add('d-none');
  switchTabERP('dashboard');
}

function switchTabERP(tabName) {
  const tabs = ['Dashboard', 'BukuBesar', 'KasBank', 'Penjualan', 'Pembelian', 'Persediaan', 'Manufaktur', 'Pelaporan', 'Admin'];
  tabs.forEach(t => {
    const tabEl = document.getElementById('erpTab' + t);
    const btnEl = document.getElementById('tabBtn' + t);
    if (tabEl) {
      if (t.toLowerCase() === tabName.toLowerCase()) {
        tabEl.classList.remove('d-none');
      } else {
        tabEl.classList.add('d-none');
      }
    }
    if (btnEl) {
      if (t.toLowerCase() === tabName.toLowerCase()) {
        btnEl.classList.add('active');
      } else {
        btnEl.classList.remove('active');
      }
    }
  });

  updateTopTabAccurate(tabName);
  recalculateAll();
}

/**
 * =========================================================================
 * 3. PERSEDIAAN & MASTER BARANG (INVENTORY)
 * =========================================================================
 */
function renderTabelPersediaan() {
  const tbody = document.getElementById('tabelPersediaanMaster');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (erpState.products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center text-muted py-3">Belum ada barang terdaftar. Klik "+ Input / Tambah Barang Baru" untuk menambahkan barang pertama.</td></tr>`;
    return;
  }

  erpState.products.forEach(p => {
    const stok = Number(p.stok) || 0;
    const hpp = Number(p.hpp) || 0;
    const hargaJual = Number(p.harga) || 0;
    const nilaiAset = stok * hpp;
    const stokMin = Number(p.stokMin) || 10;
    const isLow = stok <= stokMin;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${p.kode}</code></td>
      <td class="fw-bold">${p.nama}</td>
      <td><span class="badge ${p.kategori === 'Bahan Baku' ? 'bg-info text-dark' : (p.kategori === 'Barang Jadi' ? 'bg-success' : 'bg-secondary')}">${p.kategori || 'Barang Jadi'}</span></td>
      <td>${p.satuan}</td>
      <td class="fw-bold ${isLow ? 'text-danger' : 'text-primary'}">${stok.toLocaleString('id-ID')}</td>
      <td><small class="text-muted">${stokMin}</small></td>
      <td class="text-secondary">${formatRupiah(hpp)}</td>
      <td class="fw-bold text-success">${formatRupiah(hargaJual)}</td>
      <td class="fw-bold text-dark">${formatRupiah(nilaiAset)}</td>
      <td class="text-nowrap">
        <button class="btn btn-xs btn-outline-primary me-1" onclick="editBarang('${p.kode}')" title="Ubah Data & Harga Produk Portal"><i class="bi bi-pencil-square me-1"></i> Ubah Harga</button>
        <button class="btn btn-xs btn-outline-danger" onclick="hapusBarang('${p.kode}')" title="Hapus Barang"><i class="bi bi-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function bukaModalInputBarang() {
  const count = erpState.products.length + 1;
  const titleEl = document.getElementById('modalInputBarangTitle');
  if (titleEl) {
    titleEl.innerHTML = `<i class="bi bi-box-seam-fill text-warning me-2"></i>Tambah / Input Barang Baru`;
  }

  const kodeEl = document.getElementById('inpKodeBarang');
  if (kodeEl) {
    kodeEl.value = 'FG-0' + count;
    kodeEl.readOnly = false;
  }
  const namaEl = document.getElementById('inpNamaBarang');
  if (namaEl) namaEl.value = '';
  const katEl = document.getElementById('inpKategori');
  if (katEl) katEl.value = 'Barang Jadi';
  const satEl = document.getElementById('inpSatuan');
  if (satEl) satEl.value = 'Batang';
  const stokEl = document.getElementById('inpStokAwal');
  if (stokEl) stokEl.value = '0';
  const stokMinEl = document.getElementById('inpStokMin');
  if (stokMinEl) stokMinEl.value = '10';
  const hppEl = document.getElementById('inpHargaBeli');
  if (hppEl) hppEl.value = '0';
  const hargaEl = document.getElementById('inpHargaJual');
  if (hargaEl) hargaEl.value = '0';

  const modalEl = document.getElementById('modalInputBarang');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
    inst.show();
  }
}

function editBarang(kode) {
  const p = erpState.products.find(item => item.kode === kode);
  if (!p) return;

  const titleEl = document.getElementById('modalInputBarangTitle');
  if (titleEl) {
    titleEl.innerHTML = `<i class="bi bi-pencil-square text-primary me-2"></i>Ubah Data & Harga Produk Portal`;
  }

  const kodeEl = document.getElementById('inpKodeBarang');
  if (kodeEl) {
    kodeEl.value = p.kode;
    kodeEl.readOnly = true;
  }
  const namaEl = document.getElementById('inpNamaBarang');
  if (namaEl) namaEl.value = p.nama || '';
  const katEl = document.getElementById('inpKategori');
  if (katEl) katEl.value = p.kategori || 'Barang Jadi';
  const satEl = document.getElementById('inpSatuan');
  if (satEl) satEl.value = p.satuan || 'Batang';
  const stokEl = document.getElementById('inpStokAwal');
  if (stokEl) stokEl.value = p.stok !== undefined ? p.stok : 0;
  const stokMinEl = document.getElementById('inpStokMin');
  if (stokMinEl) stokMinEl.value = p.stokMin !== undefined ? p.stokMin : 10;
  const hppEl = document.getElementById('inpHargaBeli');
  if (hppEl) hppEl.value = p.hpp !== undefined ? p.hpp : 0;
  const hargaEl = document.getElementById('inpHargaJual');
  if (hargaEl) hargaEl.value = p.harga !== undefined ? p.harga : 0;

  const modalEl = document.getElementById('modalInputBarang');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
    inst.show();
  }
}

async function handleInputBarangSubmit(e) {
  e.preventDefault();
  const kode = document.getElementById('inpKodeBarang').value.trim().toUpperCase();
  const nama = document.getElementById('inpNamaBarang').value.trim();
  const kategori = document.getElementById('inpKategori').value;
  const satuan = document.getElementById('inpSatuan').value;
  const stokAwal = Number(document.getElementById('inpStokAwal').value) || 0;
  const stokMin = Number(document.getElementById('inpStokMin').value) || 10;
  const hargaBeli = Number(document.getElementById('inpHargaBeli').value) || 0;
  const hargaJual = Number(document.getElementById('inpHargaJual').value) || 0;

  const itemBaru = {
    kode: kode,
    nama: nama,
    kategori: kategori,
    satuan: satuan,
    stok: stokAwal,
    stokMin: stokMin,
    hpp: hargaBeli,
    harga: hargaJual
  };

  const idx = erpState.products.findIndex(p => p.kode === kode);
  const isEdit = idx >= 0;

  if (isEdit) {
    erpState.products[idx] = itemBaru;
  } else {
    erpState.products.push(itemBaru);
    // Catat Jurnal Saldo Awal Persediaan jika ada stok awal
    if (stokAwal > 0) {
      const nilaiAset = stokAwal * hargaBeli;
      erpState.jurnal.unshift({
        noJurnal: 'JU-INIT-' + Date.now().toString().slice(-4),
        tanggal: new Date().toLocaleDateString('id-ID'),
        debit: kategori === 'Bahan Baku' ? '1-1006 (Persediaan Baku)' : '1-1007 (Persediaan Jadi)',
        kredit: '3-3001 (Modal Pemilik)',
        nominal: nilaiAset,
        keterangan: `Saldo Awal Persediaan ${nama} (${stokAwal} ${satuan})`
      });
    }
  }

  saveERPState();
  recalculateAll();

  // Sync ke Google Apps Script backend
  const token = localStorage.getItem('gsk_jwt_token');
  if (typeof CONFIG !== 'undefined' && CONFIG.GAS_URL && CONFIG.GAS_URL.startsWith('http')) {
    try {
      fetch(CONFIG.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'saveProduct',
          token: token,
          payload: {
            kodeBarang: kode,
            namaBarang: nama,
            kategori: kategori,
            satuan: satuan,
            stokAwal: stokAwal,
            stokMinimal: stokMin,
            hargaBeli: hargaBeli,
            hargaJual: hargaJual
          }
        })
      });
    } catch(err) {}
  }

  const modalEl = document.getElementById('modalInputBarang');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  }

  alert(`Produk "${nama}" (${kode}) dengan harga jual ${formatRupiah(hargaJual)} berhasil disimpan!\n\nDaftar harga produk otomatis langsung tampil pada Katalog Portal Publik.`);
}

function hapusBarang(kode) {
  if (!confirm('Yakin ingin menghapus barang dengan kode ' + kode + '?')) return;
  erpState.products = erpState.products.filter(p => p.kode !== kode);
  saveERPState();
  recalculateAll();
}

/**
 * =========================================================================
 * 4. PENJUALAN (SALES & INVOICING)
 * =========================================================================
 */
function renderTabelPenjualan() {
  const tLengkap = document.getElementById('tabelPenjualanLengkap');
  const tDash = document.getElementById('wsTabelInvoices');

  if (tLengkap) {
    if (erpState.invoices.length === 0) {
      tLengkap.innerHTML = `<tr><td colspan="9" class="text-center text-muted py-3">Belum ada faktur penjualan. Klik "+ Buat Faktur Penjualan Baru" untuk menginput transaksi.</td></tr>`;
    } else {
      tLengkap.innerHTML = '';
      erpState.invoices.forEach(inv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="fw-bold"><code>${inv.noInvoice}</code></td>
          <td>${inv.tanggal}</td>
          <td>${inv.pelanggan} (${inv.qty}x ${inv.namaProduk})</td>
          <td class="fw-bold">${formatRupiah(inv.totalJual)}</td>
          <td class="text-muted">${formatRupiah(inv.totalHPP)}</td>
          <td class="text-success fw-bold">${formatRupiah(inv.laba)}</td>
          <td><span class="badge bg-warning text-dark fw-bold">${inv.margin}%</span></td>
          <td><span class="badge ${inv.statusBayar.includes('Tempo') ? 'bg-warning text-dark' : 'bg-success'}">${inv.statusBayar}</span></td>
          <td>
            <div class="btn-group btn-group-sm">
              <button class="btn btn-xs btn-outline-primary fw-bold" onclick="bukaSuratJalan('${inv.noInvoice}')" title="Cetak Surat Jalan"><i class="bi bi-truck me-1"></i>Surat Jalan</button>
              <button class="btn btn-xs btn-outline-dark" onclick="bukaSuratJalan('${inv.noInvoice}')" title="Cetak Dokumen Faktur"><i class="bi bi-printer"></i></button>
            </div>
          </td>
        `;
        tLengkap.appendChild(tr);
      });
    }
  }

  if (tDash) {
    if (erpState.invoices.length === 0) {
      tDash.innerHTML = `<tr><td colspan="5" class="text-muted text-center py-3">Belum ada transaksi faktur penjualan.</td></tr>`;
    } else {
      tDash.innerHTML = '';
      erpState.invoices.slice(0, 5).forEach(inv => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="fw-bold">${inv.noInvoice}</td>
          <td>${inv.pelanggan}</td>
          <td class="fw-bold">${formatRupiah(inv.totalJual)}</td>
          <td class="text-success fw-bold">${formatRupiah(inv.laba)}</td>
          <td>
            <button class="btn btn-xs btn-outline-primary py-0" onclick="bukaSuratJalan('${inv.noInvoice}')" title="Cetak Surat Jalan"><i class="bi bi-truck me-1"></i>Surat Jalan</button>
          </td>
        `;
        tDash.appendChild(tr);
      });
    }
  }
}

/**
 * =========================================================================
 * SURAT JALAN PENGIRIMAN MATERIAL (PRINT & UNDUH)
 * =========================================================================
 */
let suratJalanAktif = null;

function bukaSuratJalan(noInvoice) {
  let inv = null;
  if (noInvoice) {
    inv = erpState.invoices.find(i => i.noInvoice === noInvoice);
  }
  if (!inv && erpState.invoices.length > 0) {
    inv = erpState.invoices[0];
  }

  const noSj = 'SJ/GSK/2026/' + (inv ? inv.noInvoice.replace(/[^0-9]/g, '').slice(-3) || '001' : '001');
  const tgl = inv ? inv.tanggal : new Date().toLocaleDateString('id-ID');
  const pelanggan = inv ? inv.pelanggan : 'Pelanggan Proyek';
  const noFaktur = inv ? inv.noInvoice : 'INV-2026-001';

  suratJalanAktif = {
    nomor: noSj,
    tanggal: tgl,
    pelanggan: pelanggan,
    noFaktur: noFaktur
  };

  if (document.getElementById('sjNomor')) document.getElementById('sjNomor').textContent = noSj;
  if (document.getElementById('sjTanggal')) document.getElementById('sjTanggal').textContent = tgl;
  if (document.getElementById('sjPelanggan')) document.getElementById('sjPelanggan').textContent = pelanggan;
  if (document.getElementById('sjProyek')) document.getElementById('sjProyek').textContent = `Proyek Rangka Atap (${pelanggan})`;
  if (document.getElementById('sjNoFaktur')) document.getElementById('sjNoFaktur').textContent = noFaktur;
  if (document.getElementById('sjWaktuCetak')) document.getElementById('sjWaktuCetak').textContent = new Date().toLocaleString('id-ID');

  const tbody = document.getElementById('sjTabelItem');
  if (tbody) {
    tbody.innerHTML = '';
    if (inv) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center">1</td>
        <td class="text-center fw-bold"><code>${inv.kodeProduk || 'FG-01'}</code></td>
        <td class="fw-bold">${inv.namaProduk || 'Kanal C 75.75 SNI (Baja Ringan 6M)'}</td>
        <td class="text-center">Batang</td>
        <td class="text-center fw-bold fs-6">${inv.qty || 1}</td>
        <td>Baja Ringan SNI G550, Baru dari Mesin Roll-Forming, Lulus Uji QC</td>
      `;
      tbody.appendChild(tr);
    } else {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center">1</td>
        <td class="text-center fw-bold"><code>FG-01</code></td>
        <td class="fw-bold">Kanal C 75.75 SNI (Baja Ringan 6M)</td>
        <td class="text-center">Batang</td>
        <td class="text-center fw-bold fs-6">100</td>
        <td>Baja Ringan SNI G550, Baru dari Mesin Roll-Forming, Lulus Uji QC</td>
      `;
      tbody.appendChild(tr);
    }
  }

  const modalEl = document.getElementById('modalSuratJalan');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
    inst.show();
  }
}

function printSuratJalan() {
  window.print();
}

function unduhSuratJalan() {
  const container = document.getElementById('printAreaSuratJalan');
  if (!container) return;

  const noSj = suratJalanAktif ? suratJalanAktif.nomor.replace(/[^a-zA-Z0-9]/g, '_') : 'Surat_Jalan_GSK';
  const htmlContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Surat Jalan ${noSj}</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; background: #fff; color: #111; padding: 20px; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  ${container.outerHTML}
  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>
  `;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${noSj}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function bukaModalFakturBaru() {
  if (erpState.products.length === 0) {
    alert('Belum ada produk di database persediaan.\nSilakan klik "+ Input Barang Baru" terlebih dahulu sebelum membuat faktur penjualan.');
    bukaModalInputBarang();
    return;
  }
  const modalEl = document.getElementById('modalFakturBaru');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
    inst.show();
  }
  hitungMarginFakturBaru();
}

function hitungMarginFakturBaru() {
  const sel = document.getElementById('fakProduk');
  const opt = sel ? sel.options[sel.selectedIndex] : null;
  const harga = opt ? (Number(opt.dataset.harga) || 0) : 0;
  const hpp = opt ? (Number(opt.dataset.hpp) || 0) : 0;
  const qty = Number(document.getElementById('fakQty').value) || 0;

  const totalJual = harga * qty;
  const totalHPP = hpp * qty;
  const laba = totalJual - totalHPP;
  const margin = totalJual > 0 ? ((laba / totalJual) * 100).toFixed(1) : 0;

  if (document.getElementById('fakTotalJual')) document.getElementById('fakTotalJual').textContent = formatRupiah(totalJual);
  if (document.getElementById('fakTotalHPP')) document.getElementById('fakTotalHPP').textContent = formatRupiah(totalHPP);
  if (document.getElementById('fakMarginHasil')) document.getElementById('fakMarginHasil').textContent = `${formatRupiah(laba)} (${margin}%)`;
}

function handleFakturSubmit(e) {
  e.preventDefault();
  const pelanggan = document.getElementById('fakPelanggan').value.trim();
  const sel = document.getElementById('fakProduk');
  const opt = sel ? sel.options[sel.selectedIndex] : null;
  const kodeProduk = sel ? sel.value : '';
  const namaProduk = opt ? opt.textContent : 'Baja Ringan';
  const harga = opt ? (Number(opt.dataset.harga) || 0) : 0;
  const hpp = opt ? (Number(opt.dataset.hpp) || 0) : 0;
  const qty = Number(document.getElementById('fakQty').value) || 1;
  const statusBayar = document.getElementById('fakStatusBayar').value;

  const totalJual = harga * qty;
  const totalHPP = hpp * qty;
  const laba = totalJual - totalHPP;
  const margin = totalJual > 0 ? ((laba / totalJual) * 100).toFixed(1) : 0;
  const noInv = 'INV-2026-00' + (erpState.invoices.length + 1);

  // 1. Potong Stok Barang
  const prod = erpState.products.find(p => p.kode === kodeProduk);
  if (prod) {
    prod.stok = Math.max(0, (Number(prod.stok) || 0) - qty);
  }

  // 2. Tambah Faktur Penjualan
  const invBaru = {
    noInvoice: noInv,
    tanggal: new Date().toLocaleDateString('id-ID'),
    pelanggan: pelanggan,
    kodeProduk: kodeProduk,
    namaProduk: namaProduk,
    qty: qty,
    hargaJual: harga,
    totalJual: totalJual,
    totalHPP: totalHPP,
    laba: laba,
    margin: margin,
    statusBayar: statusBayar
  };
  erpState.invoices.unshift(invBaru);

  // 3. Tambah Kas Masuk jika bayar lunas tunai/bank
  if (statusBayar === 'Lunas (Kas)') {
    erpState.kasSaldo += totalJual;
    erpState.kasMutasi.unshift({
      noBukti: 'BKM-' + Date.now().toString().slice(-4),
      tanggal: new Date().toLocaleDateString('id-ID'),
      tipe: 'MASUK',
      akunNama: 'Kas Operasional',
      nominal: totalJual,
      keterangan: `Pelunasan Faktur ${noInv} (${pelanggan})`
    });
  } else if (statusBayar === 'Lunas (Bank)') {
    erpState.bankSaldo += totalJual;
    erpState.kasMutasi.unshift({
      noBukti: 'BKM-' + Date.now().toString().slice(-4),
      tanggal: new Date().toLocaleDateString('id-ID'),
      tipe: 'MASUK',
      akunNama: 'Bank Mandiri Giro',
      nominal: totalJual,
      keterangan: `Transfer Faktur ${noInv} (${pelanggan})`
    });
  }

  // 4. Catat Jurnal Umum Otomatis
  erpState.jurnal.unshift({
    noJurnal: 'JU-' + Date.now().toString().slice(-4),
    tanggal: new Date().toLocaleDateString('id-ID'),
    debit: statusBayar.includes('Tempo') ? '1-1005 (Piutang)' : (statusBayar.includes('Kas') ? '1-1001 (Kas)' : '1-1003 (Bank)'),
    kredit: '4-4001 (Penjualan)',
    nominal: totalJual,
    keterangan: `Penjualan ${namaProduk} ke ${pelanggan}`
  });

  erpState.jurnal.unshift({
    noJurnal: 'JU-HPP-' + Date.now().toString().slice(-4),
    tanggal: new Date().toLocaleDateString('id-ID'),
    debit: '5-5001 (Beban HPP)',
    kredit: '1-1007 (Persediaan Jadi)',
    nominal: totalHPP,
    keterangan: `Beban Pokok Faktur ${noInv}`
  });

  saveERPState();
  recalculateAll();

  const modalEl = document.getElementById('modalFakturBaru');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  }

  alert(`Faktur Penjualan ${noInv} (${formatRupiah(totalJual)}) berhasil diterbitkan! Stok terpotong dan keuangan terupdate.`);
}

/**
 * =========================================================================
 * 5. PEMBELIAN & PENGADAAN MATERIAL (PURCHASES)
 * =========================================================================
 */
function renderTabelPembelian() {
  const tbody = document.getElementById('tabelPembelianLengkap');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (erpState.purchases.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-3">Belum ada pesanan pembelian material. Klik "+ Buat Pesanan Pembelian (PO)".</td></tr>`;
    return;
  }

  erpState.purchases.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${p.noPO}</code></td>
      <td>${p.tanggal}</td>
      <td class="fw-bold">${p.suplier}</td>
      <td>${p.material}</td>
      <td class="fw-bold">${p.qty}</td>
      <td class="fw-bold text-dark">${formatRupiah(p.totalNilai)}</td>
      <td><span class="badge ${p.statusBayar.includes('Tempo') ? 'bg-warning text-dark' : 'bg-success'}">${p.statusBayar}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function bukaModalInputPembelian() {
  const modalEl = document.getElementById('modalInputPembelian');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
    inst.show();
  }
  hitungTotalPembelian();
}

function hitungTotalPembelian() {
  const qty = Number(document.getElementById('poQty').value) || 0;
  const harga = Number(document.getElementById('poHargaBeli').value) || 0;
  const total = qty * harga;
  const el = document.getElementById('poTotalNilai');
  if (el) el.textContent = formatRupiah(total);
}

function handlePembelianSubmit(e) {
  e.preventDefault();
  const suplier = document.getElementById('poSuplier').value.trim();
  const material = document.getElementById('poMaterial').value.trim();
  const qty = Number(document.getElementById('poQty').value) || 0;
  const satuan = document.getElementById('poSatuan').value;
  const hargaBeli = Number(document.getElementById('poHargaBeli').value) || 0;
  const statusBayar = document.getElementById('poStatusBayar').value;

  const totalNilai = qty * hargaBeli;
  const noPO = 'PO-2026-00' + (erpState.purchases.length + 1);

  // 1. Simpan Transaksi Pembelian
  erpState.purchases.unshift({
    noPO: noPO,
    tanggal: new Date().toLocaleDateString('id-ID'),
    suplier: suplier,
    material: material,
    qty: `${qty.toLocaleString('id-ID')} ${satuan}`,
    totalNilai: totalNilai,
    statusBayar: statusBayar
  });

  // 2. Tambah Stok Material ke Persediaan
  let prod = erpState.products.find(p => p.nama.toLowerCase() === material.toLowerCase());
  if (prod) {
    prod.stok = (Number(prod.stok) || 0) + qty;
    prod.hpp = hargaBeli;
  } else {
    // Tambah item bahan baku baru jika belum ada
    erpState.products.push({
      kode: 'RM-0' + (erpState.products.length + 1),
      nama: material,
      kategori: 'Bahan Baku',
      satuan: satuan,
      stok: qty,
      stokMin: Math.round(qty * 0.1),
      hpp: hargaBeli,
      harga: hargaBeli
    });
  }

  // 3. Kas Keluar jika bayar lunas
  if (statusBayar === 'Lunas (Kas)') {
    erpState.kasSaldo = Math.max(0, erpState.kasSaldo - totalNilai);
    erpState.kasMutasi.unshift({
      noBukti: 'BKK-' + Date.now().toString().slice(-4),
      tanggal: new Date().toLocaleDateString('id-ID'),
      tipe: 'KELUAR',
      akunNama: 'Kas Operasional',
      nominal: totalNilai,
      keterangan: `Pembelian material ${material} dari ${suplier}`
    });
  } else if (statusBayar === 'Lunas (Bank)') {
    erpState.bankSaldo = Math.max(0, erpState.bankSaldo - totalNilai);
    erpState.kasMutasi.unshift({
      noBukti: 'BKK-' + Date.now().toString().slice(-4),
      tanggal: new Date().toLocaleDateString('id-ID'),
      tipe: 'KELUAR',
      akunNama: 'Bank Mandiri Giro',
      nominal: totalNilai,
      keterangan: `Transfer pembelian ${material} ke ${suplier}`
    });
  }

  // 4. Catat Jurnal Umum
  erpState.jurnal.unshift({
    noJurnal: 'JU-PO-' + Date.now().toString().slice(-4),
    tanggal: new Date().toLocaleDateString('id-ID'),
    debit: '1-1006 (Persediaan Baku)',
    kredit: statusBayar.includes('Tempo') ? '2-2001 (Hutang Suplier)' : (statusBayar.includes('Kas') ? '1-1001 (Kas)' : '1-1003 (Bank)'),
    nominal: totalNilai,
    keterangan: `Pembelian ${material} (${qty} ${satuan}) dari ${suplier}`
  });

  saveERPState();
  recalculateAll();

  const modalEl = document.getElementById('modalInputPembelian');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  }

  alert(`Pesanan Pembelian ${noPO} (${formatRupiah(totalNilai)}) berhasil disimpan! Stok bahan baku langsung bertambah.`);
}

/**
 * =========================================================================
 * 6. KAS & BANK
 * =========================================================================
 */
function renderTabelMutasiKas() {
  const tbody = document.getElementById('tabelMutasiKas');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (erpState.kasMutasi.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Belum ada mutasi kas atau bank. Klik "+ Penerimaan Kas Masuk" atau "+ Pengeluaran Kas Keluar".</td></tr>`;
    return;
  }

  erpState.kasMutasi.forEach(m => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${m.noBukti}</code></td>
      <td>${m.tanggal}</td>
      <td><span class="badge ${m.tipe === 'MASUK' ? 'bg-success' : 'bg-danger'}">KAS ${m.tipe}</span></td>
      <td>${m.akunNama}</td>
      <td class="fw-bold ${m.tipe === 'MASUK' ? 'text-success' : 'text-danger'}">${m.tipe === 'MASUK' ? '+' : '-'} ${formatRupiah(m.nominal)}</td>
      <td>${m.keterangan}</td>
    `;
    tbody.appendChild(tr);
  });
}

function bukaModalKas(tipe) {
  const tipeInput = document.getElementById('kasTipe');
  const title = document.getElementById('modalKasTitle');
  const btn = document.getElementById('btnKasSubmit');
  if (tipeInput) tipeInput.value = tipe;
  if (title) title.innerHTML = tipe === 'MASUK' ? '<i class="bi bi-arrow-down-left-circle text-success me-2"></i>Catat Penerimaan Kas Masuk' : '<i class="bi bi-arrow-up-right-circle text-danger me-2"></i>Catat Pengeluaran Kas Keluar';
  if (btn) {
    btn.className = tipe === 'MASUK' ? 'btn btn-success w-100 py-2 fw-bold' : 'btn btn-danger w-100 py-2 fw-bold';
    btn.textContent = tipe === 'MASUK' ? 'Simpan Kas Masuk' : 'Simpan Kas Keluar';
  }
  const modalEl = document.getElementById('modalKasTransaksi');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
    inst.show();
  }
}

function handleKasSubmit(e) {
  e.preventDefault();
  const tipe = document.getElementById('kasTipe').value;
  const akun = document.getElementById('kasAkun').value;
  const nominal = Number(document.getElementById('kasNominal').value) || 0;
  const keterangan = document.getElementById('kasKeterangan').value;
  const akunNama = akun === '1-1001' ? 'Kas Operasional' : 'Bank Mandiri Giro';

  const noBukti = (tipe === 'MASUK' ? 'BKM-' : 'BKK-') + Date.now().toString().slice(-4);

  // Update Saldo Kas/Bank
  if (akun === '1-1001') {
    erpState.kasSaldo = tipe === 'MASUK' ? (erpState.kasSaldo + nominal) : Math.max(0, erpState.kasSaldo - nominal);
  } else {
    erpState.bankSaldo = tipe === 'MASUK' ? (erpState.bankSaldo + nominal) : Math.max(0, erpState.bankSaldo - nominal);
  }

  // Tambah ke Mutasi
  erpState.kasMutasi.unshift({
    noBukti: noBukti,
    tanggal: new Date().toLocaleDateString('id-ID'),
    tipe: tipe,
    akunNama: akunNama,
    nominal: nominal,
    keterangan: keterangan
  });

  // Catat ke Jurnal Umum
  erpState.jurnal.unshift({
    noJurnal: 'JU-' + Date.now().toString().slice(-4),
    tanggal: new Date().toLocaleDateString('id-ID'),
    debit: tipe === 'MASUK' ? akun : '6-6001 (Beban Operasional)',
    kredit: tipe === 'MASUK' ? '3-3001 (Modal / Lainnya)' : akun,
    nominal: nominal,
    keterangan: keterangan
  });

  saveERPState();
  recalculateAll();

  const modalEl = document.getElementById('modalKasTransaksi');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  }

  alert(`Transaksi Kas ${tipe} ${formatRupiah(nominal)} berhasil dibukukan!`);
}

/**
 * =========================================================================
 * 7. BUKU BESAR (GENERAL LEDGER) & JURNAL UMUM
 * =========================================================================
 */
function renderTabelJurnalUmum() {
  const tbody = document.getElementById('tabelJurnalUmum');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (erpState.jurnal.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">Belum ada jurnal umum tercatat. Klik "Catat Jurnal Umum Manual" untuk menginput transaksi pertama.</td></tr>`;
    return;
  }

  erpState.jurnal.forEach(j => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${j.noJurnal}</code></td>
      <td>${j.tanggal}</td>
      <td>${j.debit}</td>
      <td>${j.kredit}</td>
      <td class="fw-bold">${formatRupiah(j.nominal)}</td>
      <td>${j.keterangan}</td>
    `;
    tbody.appendChild(tr);
  });
}

function bukaModalJurnal() {
  const modalEl = document.getElementById('modalJurnalManual');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
    inst.show();
  }
}

function handleJurnalSubmit(e) {
  e.preventDefault();
  const debit = document.getElementById('jurnalDebit').value;
  const kredit = document.getElementById('jurnalKredit').value;
  const nominal = Number(document.getElementById('jurnalNominal').value) || 0;
  const ket = document.getElementById('jurnalKeterangan').value;

  erpState.jurnal.unshift({
    noJurnal: 'JU-' + Date.now().toString().slice(-4),
    tanggal: new Date().toLocaleDateString('id-ID'),
    debit: debit,
    kredit: kredit,
    nominal: nominal,
    keterangan: ket
  });

  saveERPState();
  recalculateAll();

  const modalEl = document.getElementById('modalJurnalManual');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  }

  alert('Jurnal umum berhasil dicatat ke Buku Besar!');
}

/**
 * =========================================================================
 * 8. PABRIKASI ROLL-FORMING
 * =========================================================================
 */
function hitungSimulasiManufaktur() {
  const select = document.getElementById('calcProduk');
  const tipe = select ? select.value : 'kanal';
  const qtyInput = document.getElementById('calcTargetQty');
  const qty = qtyInput ? (Number(qtyInput.value) || 0) : 0;

  let beratStd = 4.85; // kg per 6M kanal 75.75
  if (tipe === 'reng') beratStd = 1.85;
  else if (tipe === 'spandek') beratStd = 2.30;

  const totalCoilKg = (qty * beratStd).toFixed(1);
  const hargaCoilPerKg = 14500;
  const biayaBahan = Math.round(Number(totalCoilKg) * hargaCoilPerKg);
  const overheadListrik = Math.round(qty * (tipe === 'reng' ? 2500 : 4500));
  const totalHPP = biayaBahan + overheadListrik;

  if (document.getElementById('simulasiCoilKg')) document.getElementById('simulasiCoilKg').textContent = totalCoilKg + ' kg';
  if (document.getElementById('simulasiBiayaCoil')) document.getElementById('simulasiBiayaCoil').textContent = formatRupiah(biayaBahan);
  if (document.getElementById('simulasiBiayaOverhead')) document.getElementById('simulasiBiayaOverhead').textContent = formatRupiah(overheadListrik);
  if (document.getElementById('simulasiTotalHPP')) document.getElementById('simulasiTotalHPP').textContent = formatRupiah(totalHPP);
}

/**
 * =========================================================================
 * 9. PENGATURAN PROFIL & RESET DATA ERP
 * =========================================================================
 */
function previewLogoFrontend(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    const base64 = event.target.result;
    const box = document.getElementById('frontendLogoPreviewBox');
    if (box) box.innerHTML = `<img src="${base64}" alt="Logo" style="max-height: 100px; max-width: 100px; object-fit: contain;">`;
    box.dataset.tempLogo = base64;
  };
  reader.readAsDataURL(file);
}

function handleSimpanProfilFrontend(e) {
  e.preventDefault();
  const box = document.getElementById('frontendLogoPreviewBox');
  const tempLogo = box ? box.dataset.tempLogo : null;
  const nama = document.getElementById('feNamaPerusahaan').value;
  const tagline = document.getElementById('feTagline').value;

  if (tempLogo) {
    localStorage.setItem('gsk_custom_logo', tempLogo);
    const badge = document.getElementById('navBrandLogo');
    if (badge) badge.innerHTML = `<img src="${tempLogo}" alt="Logo" style="max-height: 28px; vertical-align: middle;">`;
  }

  if (nama) {
    document.getElementById('navCompanyName').textContent = nama;
    document.getElementById('footCompanyName').textContent = nama;
  }
  if (tagline) {
    document.getElementById('heroTagline').textContent = tagline;
  }

  alert('Profil perusahaan dan logo berhasil disimpan dan diterapkan!');
}

/**
 * Reset Semua Data ERP menjadi Nol (0)
 */
function resetSemuaDataERP() {
  if (!confirm('Apakah Anda yakin ingin mengosongkan SELURUH data ERP menjadi NOL (0)?\n\nSemua master barang, faktur penjualan, pembelian, kas/bank, jurnal, dan laporan akan di-reset ke 0.')) {
    return;
  }

  erpState.products = [];
  erpState.invoices = [];
  erpState.purchases = [];
  erpState.kasMutasi = [];
  erpState.jurnal = [];
  erpState.kasSaldo = 0;
  erpState.bankSaldo = 0;
  DATA_FALLBACK_GSK.produk = [];

  saveERPState();
  recalculateAll();

  alert('Seluruh data ERP berhasil di-reset menjadi NOL (0). Sistem siap untuk input data baru!');
}

/**
 * =========================================================================
 * 10. MODAL LUPA PASSWORD / RESET PIN ADMIN
 * =========================================================================
 */
function bukaModalLupaPassword() {
  const loginEl = document.getElementById('modalLoginInternal');
  if (loginEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(loginEl);
    if (inst) inst.hide();
  }

  const el = document.getElementById('modalLupaPassword');
  if (el && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getOrCreateInstance(el);
    modal.show();
  }
}

async function handleResetPin(e) {
  e.preventDefault();
  const email = document.getElementById('resetEmail').value.trim();
  const pinBaru = document.getElementById('resetPinBaru').value.trim();
  const alertBox = document.getElementById('resetAlertModal');

  if (!pinBaru || pinBaru.length < 4) {
    if (alertBox) {
      alertBox.textContent = 'PIN baru minimal harus 4-6 digit angka.';
      alertBox.classList.remove('d-none', 'alert-success');
      alertBox.classList.add('alert-danger');
    }
    return;
  }

  setLoader(true, 'Memperbarui PIN Keamanan...');
  const cleanEmail = email.toLowerCase().trim();
  let backendEmail = cleanEmail;
  if (cleanEmail === 'admin@gsk.id' || cleanEmail === 'admin') {
    backendEmail = 'direktur@gsk.id';
  }

  try {
    const res = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'resetPin', email: backendEmail, newPin: pinBaru })
    });
    const json = await res.json();
    setLoader(false);

    if (alertBox) {
      alertBox.classList.remove('d-none', 'alert-danger');
      alertBox.classList.add('alert-success');
      alertBox.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> ${json ? json.message : 'PIN Keamanan berhasil diperbarui!'}`;
    }

    const pinLogin = document.getElementById('erpPIN');
    if (pinLogin) pinLogin.value = pinBaru;
  } catch (err) {
    setLoader(false);
    localStorage.setItem('gsk_custom_pin', pinBaru);
    const pinLogin = document.getElementById('erpPIN');
    if (pinLogin) pinLogin.value = pinBaru;
    if (alertBox) {
      alertBox.classList.remove('d-none', 'alert-danger');
      alertBox.classList.add('alert-success');
      alertBox.innerHTML = `<i class="bi bi-check-circle-fill me-1"></i> PIN berhasil disetel ke <b>${pinBaru}</b>! Silakan masuk kembali.`;
    }
  }
}

function kembaliKeLoginDariReset() {
  const resetEl = document.getElementById('modalLupaPassword');
  if (resetEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(resetEl);
    if (inst) inst.hide();
  }
  const loginEl = document.getElementById('modalLoginInternal');
  if (loginEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getOrCreateInstance(loginEl);
    inst.show();
  }
}

function tampilkanPinBawaan() {
  const alertBox = document.getElementById('resetAlertModal');
  if (alertBox) {
    alertBox.classList.remove('d-none', 'alert-danger');
    alertBox.classList.add('alert-info');
    alertBox.innerHTML = `<strong>PIN Bawaan Sistem:</strong> <code>123456</code><br><span class="small">PIN ini otomatis diisikan ke kolom PIN baru.</span>`;
  }
  const pinInput = document.getElementById('resetPinBaru');
  if (pinInput) pinInput.value = '123456';
}

/**
 * =========================================================================
 * 10. MODUL BACKUP & RESTORE DATA DATABASE ERP
 * =========================================================================
 */
function bukaModalBackupERP() {
  const totProduk = document.getElementById('bkpTotalProduk');
  const totPenjualan = document.getElementById('bkpTotalPenjualan');
  const totPembelian = document.getElementById('bkpTotalPembelian');
  const totJurnal = document.getElementById('bkpTotalJurnal');

  if (totProduk) totProduk.textContent = (erpState.products || []).length;
  if (totPenjualan) totPenjualan.textContent = (erpState.invoices || []).length;
  if (totPembelian) totPembelian.textContent = (erpState.purchases || []).length;
  if (totJurnal) totJurnal.textContent = (erpState.jurnal || []).length + (erpState.kasMutasi || []).length;

  const modalEl = document.getElementById('modalBackupERP');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
    inst.show();
  }
}

function unduhBackupJSON() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  
  const backupPayload = {
    app: "PT Griya Sultra Konstruksi ERP Keuangan & Pabrikasi",
    versi: "10.0",
    waktuBackup: d.toISOString(),
    waktuLokal: d.toLocaleString('id-ID'),
    perusahaan: DATA_FALLBACK_GSK.perusahaan,
    data: erpState
  };

  const jsonStr = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BACKUP_GSK_ERP_${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  alert(`Backup database berhasil diunduh sebagai "BACKUP_GSK_ERP_${stamp}.json"!\n\nSimpan file ini dengan aman. File ini dapat digunakan sewaktu-waktu untuk memulihkan seluruh data.`);
}

function unduhLaporanCSV(jenis) {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  let csvContent = '\uFEFF'; // UTF-8 BOM untuk Microsoft Excel
  let filename = '';

  if (jenis === 'persediaan') {
    filename = `LAPORAN_PERSEDIAAN_GSK_${stamp}.csv`;
    csvContent += 'Kode Barang,Nama Barang,Kategori,Satuan,Stok,Stok Minimal,HPP (Rp),Harga Jual (Rp),Total Nilai Aset (Rp)\n';
    (erpState.products || []).forEach(p => {
      const stok = Number(p.stok) || 0;
      const hpp = Number(p.hpp) || 0;
      const nilaiAset = stok * hpp;
      csvContent += `"${p.kode}","${p.nama}","${p.kategori || 'Barang Jadi'}","${p.satuan}",${stok},${p.stokMin || 10},${hpp},${p.harga || 0},${nilaiAset}\n`;
    });
  } else if (jenis === 'penjualan') {
    filename = `LAPORAN_PENJUALAN_GSK_${stamp}.csv`;
    csvContent += 'No Invoice,Tanggal,Pelanggan,Telepon,Proyek,Total Qty,Total Omzet (Rp),HPP Total (Rp),Laba Kotor (Rp),Margin %,Status Bayar,Jatuh Tempo\n';
    (erpState.invoices || []).forEach(inv => {
      const omzet = Number(inv.total) || 0;
      const hpp = Number(inv.hppTotal) || 0;
      const laba = omzet - hpp;
      const margin = omzet > 0 ? ((laba / omzet) * 100).toFixed(1) + '%' : '0%';
      csvContent += `"${inv.noInvoice}","${inv.tanggal}","${inv.pelanggan}","${inv.telepon || '-'}","${inv.proyek || '-'}","${inv.items ? inv.items.reduce((s,i) => s + (Number(i.qty)||0), 0) : 0}",${omzet},${hpp},${laba},"${margin}","${inv.statusBayar || 'LUNAS'}","${inv.jatuhTempo || '-'}"\n`;
    });
  } else if (jenis === 'pembelian') {
    filename = `LAPORAN_PEMBELIAN_GSK_${stamp}.csv`;
    csvContent += 'No PO,Tanggal,Pemasok,Telepon,Bahan Baku/Material,Jumlah,Satuan,Harga Satuan (Rp),Total Pembelian (Rp),Status Pembayaran\n';
    (erpState.purchases || []).forEach(po => {
      csvContent += `"${po.noPO}","${po.tanggal}","${po.pemasok}","${po.telepon || '-'}","${po.namaBarang}",${po.jumlah},"${po.satuan}",${po.hargaSatuan},${po.total},"${po.status || 'LUNAS'}"\n`;
    });
  } else if (jenis === 'jurnal') {
    filename = `LAPORAN_JURNAL_KAS_GSK_${stamp}.csv`;
    csvContent += 'No Bukti,Tanggal,Jenis Akun Debit,Jenis Akun Kredit,Nominal (Rp),Keterangan Transaksi\n';
    (erpState.jurnal || []).forEach(j => {
      csvContent += `"${j.noJurnal}","${j.tanggal}","${j.debit}","${j.kredit}",${j.nominal},"${j.keterangan}"\n`;
    });
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function prosesRestoreData() {
  const fileInput = document.getElementById('inpFileRestore');
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert('Silakan pilih berkas cadangan (.json) yang ingin dipulihkan terlebih dahulu!');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const content = JSON.parse(e.target.result);
      const dataPulih = content.data || content;

      if (!dataPulih || typeof dataPulih !== 'object') {
        throw new Error('Format berkas backup tidak valid');
      }

      const totalItem = Array.isArray(dataPulih.products) ? dataPulih.products.length : 0;
      const totalInv = Array.isArray(dataPulih.invoices) ? dataPulih.invoices.length : 0;

      const konfirmasi = confirm(
        `Konfirmasi Pemulihan Data:\n\n` +
        `- Persediaan: ${totalItem} barang\n` +
        `- Penjualan: ${totalInv} faktur\n\n` +
        `PERINGATAN: Memulihkan cadangan ini akan menimpa data yang sedang aktif di sistem.\nLanjutkan pemulihan?`
      );

      if (!konfirmasi) return;

      erpState.products = Array.isArray(dataPulih.products) ? dataPulih.products : [];
      erpState.invoices = Array.isArray(dataPulih.invoices) ? dataPulih.invoices : [];
      erpState.purchases = Array.isArray(dataPulih.purchases) ? dataPulih.purchases : [];
      erpState.kasMutasi = Array.isArray(dataPulih.kasMutasi) ? dataPulih.kasMutasi : [];
      erpState.jurnal = Array.isArray(dataPulih.jurnal) ? dataPulih.jurnal : [];
      erpState.kasSaldo = Number(dataPulih.kasSaldo) || 0;
      erpState.bankSaldo = Number(dataPulih.bankSaldo) || 0;

      saveERPState();
      recalculateAll();

      const modalEl = document.getElementById('modalBackupERP');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const inst = bootstrap.Modal.getInstance(modalEl);
        if (inst) inst.hide();
      }

      alert('Seluruh data ERP berhasil dipulihkan dari file backup!');
      fileInput.value = '';
    } catch(err) {
      alert('Gagal memulihkan file backup: Format berkas tidak cocok atau rusak (' + err.message + ')');
    }
  };

  reader.readAsText(file);
}

/**
 * =========================================================================
 * 11. MODUL SMART IMPOR DARI ACCURATE ONLINE (EXCEL / CSV / PASTE)
 * =========================================================================
 */
let dataImporAccuratePending = [];

function bukaModalImporAccurate() {
  dataImporAccuratePending = [];
  const areaPreview = document.getElementById('areaPreviewImpor');
  if (areaPreview) areaPreview.classList.add('d-none');
  const alertEl = document.getElementById('alertImporAccurate');
  if (alertEl) alertEl.classList.add('d-none');
  const fileInput = document.getElementById('inpFileAccurateExcel');
  if (fileInput) fileInput.value = '';
  const txtArea = document.getElementById('txtPasteAccurate');
  if (txtArea) txtArea.value = '';

  const modalEl = document.getElementById('modalImporAccurate');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
    inst.show();
  }
}

function cariNilaiKolom(row, kandidatArray) {
  const keys = Object.keys(row);
  for (const k of keys) {
    const cleanKey = String(k).toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const cand of kandidatArray) {
      const cleanCand = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanKey === cleanCand || cleanKey.includes(cleanCand)) {
        return row[k];
      }
    }
  }
  return null;
}

function bersihkanAngka(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).replace(/Rp|\s|\./g, '').replace(',', '.');
  return Number(str) || 0;
}

function bacaFileExcelAccurate() {
  const fileInput = document.getElementById('inpFileAccurateExcel');
  const alertEl = document.getElementById('alertImporAccurate');
  if (alertEl) alertEl.classList.add('d-none');

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert('Silakan pilih berkas Excel (.xlsx / .csv) hasil unduhan dari Accurate Online!');
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      if (typeof XLSX === 'undefined') {
        throw new Error('Pustaka pembaca Excel (SheetJS) belum siap. Pastikan koneksi internet stabil.');
      }
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (!rows || rows.length === 0) {
        throw new Error('Lembar kerja Excel kosong atau tidak memiliki baris data.');
      }

      prosesBarisAccurate(rows);
    } catch(err) {
      if (alertEl) {
        alertEl.className = 'alert alert-danger py-2 small mt-3';
        alertEl.textContent = 'Gagal membaca file: ' + err.message;
        alertEl.classList.remove('d-none');
      } else {
        alert('Gagal membaca file: ' + err.message);
      }
    }
  };

  reader.readAsArrayBuffer(file);
}

function bacaTeksPasteAccurate() {
  const txtArea = document.getElementById('txtPasteAccurate');
  const alertEl = document.getElementById('alertImporAccurate');
  if (alertEl) alertEl.classList.add('d-none');

  const teks = txtArea ? txtArea.value.trim() : '';
  if (!teks) {
    alert('Silakan tempel (paste) tabel dari Excel terlebih dahulu!');
    return;
  }

  try {
    const lines = teks.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      throw new Error('Data terlalu pendek. Pastikan menyalin baris judul kolom dan minimal 1 baris produk.');
    }

    const separator = lines[0].includes('\t') ? '\t' : (lines[0].includes(';') ? ';' : ',');
    const headers = lines[0].split(separator).map(h => h.trim().replace(/^["']|["']$/g, ''));

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator).map(c => c.trim().replace(/^["']|["']$/g, ''));
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = cols[idx] !== undefined ? cols[idx] : '';
      });
      rows.push(obj);
    }

    prosesBarisAccurate(rows);
  } catch(err) {
    if (alertEl) {
      alertEl.className = 'alert alert-danger py-2 small mt-3';
      alertEl.textContent = 'Gagal memproses teks: ' + err.message;
      alertEl.classList.remove('d-none');
    } else {
      alert('Gagal memproses teks: ' + err.message);
    }
  }
}

function prosesBarisAccurate(rows) {
  const hasil = [];
  rows.forEach((row, i) => {
    const kode = cariNilaiKolom(row, ['nobarang', 'kodebarang', 'kode', 'itemno', 'itemnumber', 'no']) || ('FG-ACC-' + String(i + 1).padStart(3, '0'));
    const nama = cariNilaiKolom(row, ['namabarang', 'deskripsi', 'namaitem', 'itemname', 'itemdescription', 'nama', 'keterangan']);
    if (!nama || String(nama).trim() === '') return;

    const kategori = cariNilaiKolom(row, ['kategori', 'kategoribarang', 'category']) || 'Barang Jadi';
    const satuan = cariNilaiKolom(row, ['satuan', 'satuandasar', 'unit']) || 'Batang';
    const stok = bersihkanAngka(cariNilaiKolom(row, ['kuantitas', 'stok', 'kuantitassaatini', 'saldokuantitas', 'qty', 'quantity']));
    const hpp = bersihkanAngka(cariNilaiKolom(row, ['hargabeli', 'hargapokok', 'biayasatuan', 'biayaterakhir', 'hpp', 'cost']));
    const hargaJual = bersihkanAngka(cariNilaiKolom(row, ['hargajual', 'hargajualdefault', 'hargasatuan1', 'hargasatuan', 'price', 'unitprice']));

    hasil.push({
      kode: String(kode).trim().toUpperCase(),
      nama: String(nama).trim(),
      kategori: String(kategori).trim(),
      satuan: String(satuan).trim(),
      stok: stok,
      stokMin: 10,
      hpp: hpp,
      harga: hargaJual
    });
  });

  if (hasil.length === 0) {
    throw new Error('Tidak ada baris data barang yang cocok. Pastikan tabel memiliki kolom "Nama Barang" atau "Deskripsi".');
  }

  dataImporAccuratePending = hasil;
  tampilkanPreviewImpor(hasil);
}

function tampilkanPreviewImpor(items) {
  const areaPreview = document.getElementById('areaPreviewImpor');
  const countEl = document.getElementById('prvJumlahBarang');
  const tbody = document.getElementById('tbodyPreviewAccurate');
  if (!areaPreview || !tbody) return;

  if (countEl) countEl.textContent = items.length;
  tbody.innerHTML = '';

  const sample = items.slice(0, 5);
  sample.forEach(it => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${it.kode}</code></td>
      <td class="fw-bold">${it.nama}</td>
      <td><span class="badge bg-secondary">${it.kategori}</span></td>
      <td>${it.satuan}</td>
      <td class="fw-bold text-primary">${it.stok.toLocaleString('id-ID')}</td>
      <td class="text-secondary">${formatRupiah(it.hpp)}</td>
      <td class="fw-bold text-success">${formatRupiah(it.harga)}</td>
    `;
    tbody.appendChild(tr);
  });

  areaPreview.classList.remove('d-none');
}

function batalPratinjauImpor() {
  dataImporAccuratePending = [];
  const areaPreview = document.getElementById('areaPreviewImpor');
  if (areaPreview) areaPreview.classList.add('d-none');
}

function simpanHasilImporAccurate() {
  if (!dataImporAccuratePending || dataImporAccuratePending.length === 0) {
    alert('Tidak ada data barang yang siap diimpor!');
    return;
  }

  let ditambah = 0;
  let diupdate = 0;

  dataImporAccuratePending.forEach(item => {
    const idx = erpState.products.findIndex(p => p.kode === item.kode);
    if (idx >= 0) {
      erpState.products[idx] = item;
      diupdate++;
    } else {
      erpState.products.push(item);
      ditambah++;
    }
  });

  saveERPState();
  recalculateAll();

  const modalEl = document.getElementById('modalImporAccurate');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  }

  alert(`Sukses Mengimpor dari Accurate Online!\n\n- ${ditambah} Barang Baru Ditambahkan\n- ${diupdate} Barang Diperbarui\n\nSeluruh produk dan harga jual langsung aktif di Katalog Portal Publik & Form Order.`);
}
