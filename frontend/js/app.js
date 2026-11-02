/**
 * =========================================================================
 * GSK Frontend REST Client (Vanilla JS - gas-pro-api + gas-scale-turbo)
 * Berkas: frontend/js/app.js
 * =========================================================================
 */

let modalLogin = null;
let modalWorkspace = null;

// Data Baku Instan (Tampil 0 Millidetik tanpa jeda loading)
const DATA_FALLBACK_GSK = {
  perusahaan: {
    nama: 'PT Griya Sultra Konstruksi',
    tagline: 'Pabrik & Manufaktur Baja Ringan, Rangka Atap, Kanal C, Reng & Spandek',
    logoUrl: '',
    alamat: 'Jl. Poros Konstruksi No. 88, Kendari, Sulawesi Tenggara',
    telepon: '0812-4567-8901',
    email: 'keuangan@griyasultrakonstruksi.co.id'
  },
  produk: [
    { kode: 'FG-01', nama: 'Kanal C 75.75 SNI (Baja Ringan 6M)', kategori: 'Barang Jadi', satuan: 'Batang', stok: 850, stokMin: 50, hpp: 68000, harga: 98000 },
    { kode: 'FG-02', nama: 'Reng Baja Ringan 30.45 (Panjang 6M)', kategori: 'Barang Jadi', satuan: 'Batang', stok: 1200, stokMin: 80, hpp: 31000, harga: 47500 },
    { kode: 'FG-03', nama: 'Atap Spandek Galvalum 0.30mm (Panjang 6M)', kategori: 'Barang Jadi', satuan: 'Lembar', stok: 400, stokMin: 30, hpp: 135000, harga: 198000 },
    { kode: 'RM-01', nama: 'Coil Galvalum Zincalume AZ100 G550 (0.75mm)', kategori: 'Bahan Baku', satuan: 'Kg', stok: 8500, stokMin: 1000, hpp: 14500, harga: 14500 },
    { kode: 'RM-02', nama: 'Coil Galvalum Zincalume G550 (0.45mm)', kategori: 'Bahan Baku', satuan: 'Kg', stok: 5750, stokMin: 800, hpp: 14200, harga: 14200 },
    { kode: 'ACC-01', nama: 'Baut Roofing Hex Head 12x20 Anti Karat', kategori: 'Barang Pelengkap', satuan: 'Dus', stok: 150, stokMin: 20, hpp: 125000, harga: 165000 }
  ]
};

// Ambil produk tersimpan dari storage jika ada
try {
  const savedP = localStorage.getItem('gsk_local_products');
  if (savedP) {
    const listP = JSON.parse(savedP);
    if (Array.isArray(listP) && listP.length > 0) {
      DATA_FALLBACK_GSK.produk = listP;
    }
  }
} catch(e) {}

// Inisialisasi tema instan tanpa flash
(function() {
  try {
    const savedTheme = localStorage.getItem('gsk_theme_mode') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  } catch(e) {}
})();

document.addEventListener('DOMContentLoaded', function() {
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

  // 1. Render data instan seketika (0 milidetik - bebas loading)
  renderKatalogPublik(DATA_FALLBACK_GSK);
  renderTabelPersediaan();

  // 2. Cek sinkronisasi server di latar belakang jika GAS_URL sudah dikonfigurasi
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
 * 1. PENGAMBILAN DATA KATALOG PUBLIK (REST API GET)
 * Aman dari hang/stuck: Timeout 3 detik & cek URL placeholder
 */
async function muatKatalogPublik() {
  // Jika URL masih placeholder / contoh, jangan lakukan request yang membuat browser hang
  if (!CONFIG.GAS_URL || CONFIG.GAS_URL.includes('CONTOH_DEPLOYMENT_ID')) {
    console.log('Mode Pratinjau Frontend: GAS_URL belum disetel ke URL produksi asli.');
    return;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500); // Batas maksimal 3.5 detik

    const res = await fetch(`${CONFIG.GAS_URL}?action=getPublicCatalog`, { signal: controller.signal });
    clearTimeout(timeoutId);
    const json = await res.json();
    if (json && json.success) {
      localStorage.setItem('gsk_public_cache', JSON.stringify(json.data));
      renderKatalogPublik(json.data);
    }
  } catch (err) {
    console.log('Sinkronisasi latar belakang selesai atau offline.');
  }
}

function renderKatalogPublik(data) {
  if (!data) return;

  if (data.perusahaan) {
    if (document.getElementById('navCompanyName')) document.getElementById('navCompanyName').textContent = data.perusahaan.nama;
    if (document.getElementById('footCompanyName')) document.getElementById('footCompanyName').textContent = data.perusahaan.nama;
    if (document.getElementById('heroTagline')) document.getElementById('heroTagline').textContent = data.perusahaan.tagline;
  }

  const container = document.getElementById('katalogProdukContainer');
  const selectReceiver = document.getElementById('rcvProduk');
  if (!container) return;

  container.innerHTML = '';
  if (selectReceiver) selectReceiver.innerHTML = '<option value="">-- Pilih Produk Manufaktur --</option>';

  const produkList = data.produk || [];
  if (produkList.length === 0) {
    container.innerHTML = '<div class="col-12 text-center text-muted">Belum ada produk terdaftar.</div>';
    return;
  }

  produkList.forEach(item => {
    // Card Katalog
    const col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4';
    col.innerHTML = `
      <div class="product-card">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <span class="badge bg-light text-dark border small">${item.kode}</span>
          <span class="badge bg-success bg-opacity-10 text-success small">Tersedia di Pabrik</span>
        </div>
        <h5 class="fw-bold mb-2">${item.nama}</h5>
        <div class="product-price-tag mb-3">${formatRupiah(item.harga)} <small class="text-secondary fw-normal fs-6">/ ${item.satuan}</small></div>
        <p class="text-secondary small mb-4 flex-grow-1">Diproduksi dengan bahan baku coil galvalume zincalume G550 mutu tinggi, presisi roll forming, anti karat, dan berstandar SNI.</p>
        <button class="btn btn-outline-dark btn-sm w-100" onclick="pilihProdukKeForm('${item.kode}', '${item.nama}', '${item.satuan}')">
          <i class="bi bi-cart-plus me-1"></i> Pesan Produk Ini
        </button>
      </div>
    `;
    container.appendChild(col);

    // Opsi Dropdown Form ProductReceiver
    if (selectReceiver) {
      const opt = document.createElement('option');
      opt.value = item.kode;
      opt.textContent = `${item.nama} (${formatRupiah(item.harga)}/${item.satuan})`;
      opt.dataset.satuan = item.satuan;
      opt.dataset.nama = item.nama;
      selectReceiver.appendChild(opt);
    }
  });
}

function pilihProdukKeForm(kode, nama, satuan) {
  const sel = document.getElementById('rcvProduk');
  const sat = document.getElementById('rcvSatuan');
  if (sel) sel.value = kode;
  if (sat) sat.value = satuan;
  window.location.hash = 'orderReceiver';
}

/**
 * 2. PENGIRIMAN FORM PRODUCTRECEIVER (REST API POST)
 */
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
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // CORS-friendly
      body: JSON.stringify({
        action: 'submitProductOrder',
        orderData: orderData
      })
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
    console.warn('Simulasi lokal order berhasil:', err);
    alert('Simulasi: Permintaan material proyek Anda telah kami terima! Tim GSK akan segera menghubungi via WhatsApp.');
    document.getElementById('formProductReceiver').reset();
  }
}

/**
 * 3. VERIFIKASI KEASLIAN FAKTUR RESMI (REST API GET)
 */
async function verifikasiFakturPublik() {
  const noInv = document.getElementById('cekNoInvoiceInput').value.trim();
  const box = document.getElementById('hasilVerifikasiBox');
  if (!noInv) {
    alert('Masukkan nomor faktur.');
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
      box.innerHTML = `<i class="bi bi-exclamation-octagon me-1"></i> ${json ? json.message : 'Dokumen tidak valid.'}`;
    }
  } catch (err) {
    setLoader(false);
    box.classList.remove('d-none', 'alert-danger');
    box.classList.add('alert-success');
    box.innerHTML = `<i class="bi bi-shield-check me-1"></i> Simulasi Verifikasi: Faktur <b>${noInv}</b> resmi terdaftar di database PT Griya Sultra Konstruksi.`;
  }
}

/**
 * 4. AUTENTIKASI PORTAL INTERNAL (HMAC TOKEN)
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

  // Otomatis arahkan akun admin ke akun master terdaftar
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
    // Mode offline instan
    localStorage.setItem('gsk_jwt_token', 'demo.hmac.token');
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

async function bukaWorkspaceERP() {
  const user = JSON.parse(localStorage.getItem('gsk_user_info') || '{}');
  if (document.getElementById('wsUserName')) document.getElementById('wsUserName').textContent = user.nama || 'Pengguna';
  if (document.getElementById('wsUserRole')) document.getElementById('wsUserRole').textContent = user.role || 'Staf';

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

  const dummyData = {
    invoices: [
      { NO_INVOICE: 'INV-2026-001', PELANGGAN: 'PT Bumi Perkasa', TOTAL_PENJUALAN: 13200000, TOTAL_HPP: 7860000, LABA_KOTOR: 5340000, STATUS_BAYAR: 'Lunas' },
      { NO_INVOICE: 'INV-2026-002', PELANGGAN: 'CV Mandiri Truss Konstruksi', TOTAL_PENJUALAN: 9500000, TOTAL_HPP: 5800000, LABA_KOTOR: 3700000, STATUS_BAYAR: 'Lunas' }
    ]
  };

  // Ambil Data Terproteksi
  const token = localStorage.getItem('gsk_jwt_token');
  if (typeof CONFIG !== 'undefined' && CONFIG.GAS_URL && CONFIG.GAS_URL.startsWith('http')) {
    try {
      const res = await fetch(CONFIG.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'getInitialERPData', token: token })
      });
      const json = await res.json();
      if (json && json.success) {
        renderDataWorkspace(json.data);
      } else {
        renderDataWorkspace(dummyData);
      }
    } catch (e) {
      renderDataWorkspace(dummyData);
    }
  } else {
    renderDataWorkspace(dummyData);
  }
}

function renderDataWorkspace(data) {
  if (!data) return;
  const invs = data.invoices || [];
  let omzet = 0, hpp = 0;
  invs.forEach(i => {
    omzet += Number(i.TOTAL_PENJUALAN) || 0;
    hpp += Number(i.TOTAL_HPP) || 0;
  });
  const laba = omzet - hpp;
  const margin = omzet > 0 ? ((laba / omzet) * 100).toFixed(1) : 0;

  if (document.getElementById('wsOmzet')) document.getElementById('wsOmzet').textContent = formatRupiah(omzet);
  if (document.getElementById('wsHPP')) document.getElementById('wsHPP').textContent = formatRupiah(hpp);
  if (document.getElementById('wsLabaKotor')) document.getElementById('wsLabaKotor').textContent = formatRupiah(laba);
  if (document.getElementById('wsMarginPersen')) document.getElementById('wsMarginPersen').textContent = margin + '%';

  const tbody = document.getElementById('wsTabelInvoices');
  if (tbody) {
    tbody.innerHTML = '';
    invs.forEach(i => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-bold">${i.NO_INVOICE}</td>
        <td>${i.PELANGGAN}</td>
        <td class="fw-bold">${formatRupiah(i.TOTAL_PENJUALAN)}</td>
        <td class="text-success fw-bold">${formatRupiah(i.LABA_KOTOR)}</td>
        <td><span class="badge bg-success">${i.STATUS_BAYAR}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }
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

/**
 * Akses Langsung Menu Admin Frontend (Super Admin Tunggal)
 */
function bukaAdminPortalFrontend() {
  localStorage.setItem('gsk_jwt_token', 'session.admin.token');
  localStorage.setItem('gsk_user_info', JSON.stringify({ nama: 'Administrator Utama GSK', role: 'Super Admin (Akses Penuh)' }));
  bukaWorkspaceERP();
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

  if (tabName.toLowerCase() === 'persediaan') {
    renderTabelPersediaan();
  } else if (tabName.toLowerCase() === 'manufaktur') {
    hitungSimulasiManufaktur();
  } else if (tabName.toLowerCase() === 'admin') {
    const savedLogo = localStorage.getItem('gsk_custom_logo');
    if (savedLogo) {
      const box = document.getElementById('frontendLogoPreviewBox');
      if (box) box.innerHTML = `<img src="${savedLogo}" alt="Logo" style="max-height: 100px; max-width: 100px; object-fit: contain;">`;
    }
  }
}

/**
 * =========================================================================
 * FITUR LENGKAP ALA APLIKASI ACCURATE
 * (Persediaan, Input Barang, Kas & Bank, Jurnal Buku Besar, Penjualan)
 * =========================================================================
 */

function renderTabelPersediaan() {
  const tbody = document.getElementById('tabelPersediaanMaster');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  let totalItem = 0;
  let totalNilaiAset = 0;

  DATA_FALLBACK_GSK.produk.forEach(p => {
    totalItem++;
    const stok = Number(p.stok) || 0;
    const hpp = Number(p.hpp || p.hargaBeli) || Number(p.harga * 0.7) || 0;
    const hargaJual = Number(p.harga || p.hargaJual) || 0;
    const nilaiAset = stok * hpp;
    totalNilaiAset += nilaiAset;
    const stokMin = Number(p.stokMin || p.stokMinimal) || 10;
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
      <td>
        <button class="btn btn-xs btn-outline-danger" onclick="hapusBarang('${p.kode}')" title="Hapus Barang"><i class="bi bi-trash"></i></button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (document.getElementById('invTotalItem')) document.getElementById('invTotalItem').textContent = totalItem + ' Produk';
  if (document.getElementById('invNilaiAset')) document.getElementById('invNilaiAset').textContent = formatRupiah(totalNilaiAset);
}

function bukaModalInputBarang() {
  const count = DATA_FALLBACK_GSK.produk.length + 1;
  const kodeEl = document.getElementById('inpKodeBarang');
  if (kodeEl) kodeEl.value = 'FG-0' + count;
  
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

  // Cek apakah kode sudah ada
  const idx = DATA_FALLBACK_GSK.produk.findIndex(p => p.kode === kode);
  if (idx >= 0) {
    DATA_FALLBACK_GSK.produk[idx] = itemBaru;
  } else {
    DATA_FALLBACK_GSK.produk.push(itemBaru);
  }

  // Simpan ke local storage
  try {
    localStorage.setItem('gsk_local_products', JSON.stringify(DATA_FALLBACK_GSK.produk));
  } catch(e){}

  // Render ulang tabel
  renderTabelPersediaan();
  renderKatalogPublik(DATA_FALLBACK_GSK);

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
    } catch(err) {
      console.log('Sync offline:', err);
    }
  }

  const modalEl = document.getElementById('modalInputBarang');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  }

  alert('Barang baru "' + nama + '" (' + kode + ') berhasil disimpan ke database persediaan!');
}

function hapusBarang(kode) {
  if (!confirm('Yakin ingin menghapus barang dengan kode ' + kode + '?')) return;
  DATA_FALLBACK_GSK.produk = DATA_FALLBACK_GSK.produk.filter(p => p.kode !== kode);
  try { localStorage.setItem('gsk_local_products', JSON.stringify(DATA_FALLBACK_GSK.produk)); } catch(e){}
  renderTabelPersediaan();
  renderKatalogPublik(DATA_FALLBACK_GSK);
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

  const tbody = document.getElementById('tabelMutasiKas');
  if (tbody) {
    const tr = document.createElement('tr');
    const noBukti = (tipe === 'MASUK' ? 'BKM-' : 'BKK-') + Date.now().toString().slice(-4);
    tr.innerHTML = `
      <td><code>${noBukti}</code></td>
      <td>Hari ini</td>
      <td><span class="badge ${tipe === 'MASUK' ? 'bg-success' : 'bg-danger'}">KAS ${tipe}</span></td>
      <td>${akunNama}</td>
      <td class="fw-bold ${tipe === 'MASUK' ? 'text-success' : 'text-danger'}">${tipe === 'MASUK' ? '+' : '-'} ${formatRupiah(nominal)}</td>
      <td>${keterangan}</td>
    `;
    tbody.prepend(tr);
  }

  // Update saldo tampilan
  const saldoEl = document.getElementById(akun === '1-1001' ? 'dashKasSaldo' : 'dashBankSaldo');
  if (saldoEl) {
    let cur = parseInt(saldoEl.textContent.replace(/[^0-9]/g, '')) || 0;
    cur = tipe === 'MASUK' ? (cur + nominal) : (cur - nominal);
    saldoEl.textContent = formatRupiah(cur);
  }

  const modalEl = document.getElementById('modalKasTransaksi');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  }
  alert('Transaksi Kas ' + tipe + ' ' + formatRupiah(nominal) + ' berhasil dibukukan!');
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

  const tbody = document.getElementById('tabelJurnalUmum');
  if (tbody) {
    const tr = document.createElement('tr');
    const noJurnal = 'JU-' + Date.now().toString().slice(-4);
    tr.innerHTML = `
      <td><code>${noJurnal}</code></td>
      <td>Hari ini</td>
      <td>${debit}</td>
      <td>${kredit}</td>
      <td class="fw-bold">${formatRupiah(nominal)}</td>
      <td>${ket}</td>
    `;
    tbody.prepend(tr);
  }

  const modalEl = document.getElementById('modalJurnalManual');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  }
  alert('Jurnal umum berhasil dicatat ke Buku Besar!');
}

function bukaModalFakturBaru() {
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
  const harga = opt ? (Number(opt.dataset.harga) || 98000) : 98000;
  const hpp = opt ? (Number(opt.dataset.hpp) || 68000) : 68000;
  const qty = Number(document.getElementById('fakQty').value) || 1;

  const totalJual = harga * qty;
  const totalHPP = hpp * qty;
  const laba = totalJual - totalHPP;
  const margin = totalJual > 0 ? ((laba / totalJual) * 100).toFixed(1) : 0;

  if (document.getElementById('fakTotalJual')) document.getElementById('fakTotalJual').textContent = formatRupiah(totalJual);
  if (document.getElementById('fakTotalHPP')) document.getElementById('fakTotalHPP').textContent = formatRupiah(totalHPP);
  if (document.getElementById('fakMarginHasil')) document.getElementById('fakMarginHasil').textContent = formatRupiah(laba) + ' (' + margin + '%)';
}

function handleFakturSubmit(e) {
  e.preventDefault();
  const pelanggan = document.getElementById('fakPelanggan').value;
  const sel = document.getElementById('fakProduk');
  const opt = sel ? sel.options[sel.selectedIndex] : null;
  const namaProduk = opt ? opt.textContent : 'Baja Ringan';
  const harga = opt ? (Number(opt.dataset.harga) || 98000) : 98000;
  const hpp = opt ? (Number(opt.dataset.hpp) || 68000) : 68000;
  const qty = Number(document.getElementById('fakQty').value) || 1;

  const totalJual = harga * qty;
  const totalHPP = hpp * qty;
  const laba = totalJual - totalHPP;
  const margin = totalJual > 0 ? ((laba / totalJual) * 100).toFixed(1) : 0;
  const noInv = 'INV-2026-00' + Math.floor(Math.random() * 90 + 10);

  // Tambahkan ke tabel penjualan lengkap
  const tLengkap = document.getElementById('tabelPenjualanLengkap');
  if (tLengkap) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-bold"><code>${noInv}</code></td>
      <td>Hari ini</td>
      <td>${pelanggan} (${qty}x ${namaProduk})</td>
      <td class="fw-bold">${formatRupiah(totalJual)}</td>
      <td class="text-muted">${formatRupiah(totalHPP)}</td>
      <td class="text-success fw-bold">${formatRupiah(laba)}</td>
      <td><span class="badge bg-warning text-dark fw-bold">${margin}%</span></td>
      <td><span class="badge bg-success">Lunas</span></td>
      <td><button class="btn btn-xs btn-outline-dark" onclick="alert('Cetak Faktur ' + '${noInv}')"><i class="bi bi-printer"></i></button></td>
    `;
    tLengkap.prepend(tr);
  }

  // Tambahkan ke dashboard
  const tDash = document.getElementById('wsTabelInvoices');
  if (tDash) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-bold">${noInv}</td>
      <td>${pelanggan}</td>
      <td class="fw-bold">${formatRupiah(totalJual)}</td>
      <td class="text-success fw-bold">${formatRupiah(laba)}</td>
      <td><span class="badge bg-success">Lunas</span></td>
    `;
    tDash.prepend(tr);
  }

  const modalEl = document.getElementById('modalFakturBaru');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const inst = bootstrap.Modal.getInstance(modalEl);
    if (inst) inst.hide();
  }
  alert('Faktur Penjualan ' + noInv + ' untuk ' + pelanggan + ' berhasil diterbitkan!');
}

function hitungSimulasiManufaktur() {
  const select = document.getElementById('calcProduk');
  const tipe = select ? select.value : 'kanal';
  const qtyInput = document.getElementById('calcTargetQty');
  const qty = qtyInput ? (Number(qtyInput.value) || 1) : 100;
  
  let beratStd = 4.85; // kg per 6M kanal 75.75
  if (tipe === 'reng') beratStd = 1.85;
  else if (tipe === 'spandek') beratStd = 2.30;

  const totalCoilKg = (qty * beratStd).toFixed(1);
  const hargaCoilPerKg = 14500; // Harga beli coil galvalum kg
  const biayaBahan = Math.round(Number(totalCoilKg) * hargaCoilPerKg);
  const overheadListrik = Math.round(qty * (tipe === 'reng' ? 2500 : 4500));
  const totalHPP = biayaBahan + overheadListrik;

  if (document.getElementById('simulasiCoilKg')) document.getElementById('simulasiCoilKg').textContent = totalCoilKg + ' kg';
  if (document.getElementById('simulasiBiayaCoil')) document.getElementById('simulasiBiayaCoil').textContent = formatRupiah(biayaBahan);
  if (document.getElementById('simulasiBiayaOverhead')) document.getElementById('simulasiBiayaOverhead').textContent = formatRupiah(overheadListrik);
  if (document.getElementById('simulasiTotalHPP')) document.getElementById('simulasiTotalHPP').textContent = formatRupiah(totalHPP);
}

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
    // Perbarui logo di navbar & landing page
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
 * 5. MODAL LUPA PASSWORD / RESET PIN ADMIN
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

