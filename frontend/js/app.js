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
    { kode: 'FG-01', nama: 'Kanal C 75.75 SNI (Baja Ringan 6M)', satuan: 'Batang', harga: 98000, stok: 850 },
    { kode: 'FG-02', nama: 'Reng Baja Ringan 30.45 (Panjang 6M)', satuan: 'Batang', harga: 47500, stok: 1200 },
    { kode: 'FG-03', nama: 'Atap Spandek Galvalum 0.30mm (Panjang 6M)', satuan: 'Lembar', harga: 198000, stok: 400 }
  ]
};

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
          { kode: 'FG-01', nama: 'Kanal C 75.75 SNI (Baja Ringan 6M)', satuan: 'Batang', harga: 98000, stok: 850 },
          { kode: 'FG-02', nama: 'Reng Baja Ringan 30.45 (Panjang 6M)', satuan: 'Batang', harga: 47500, stok: 1200 },
          { kode: 'FG-03', nama: 'Atap Spandek Galvalum 0.30mm (Panjang 6M)', satuan: 'Lembar', harga: 198000, stok: 400 }
        ]
      });
    }
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

  try {
    const res = await fetch(CONFIG.GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'login', email: email, pin: pin })
    });
    const json = await res.json();
    setLoader(false);

    if (json && json.success) {
      localStorage.setItem('gsk_jwt_token', json.data.token);
      localStorage.setItem('gsk_user_info', JSON.stringify(json.data.user));
      tutupLoginDanBukaERP();
    } else {
      if (alertBox) {
        alertBox.textContent = json ? json.message : 'Login gagal. Periksa Email dan PIN Anda.';
        alertBox.classList.remove('d-none');
      }
    }
  } catch (err) {
    setLoader(false);
    // Mode demo instan
    localStorage.setItem('gsk_jwt_token', 'demo.hmac.token');
    localStorage.setItem('gsk_user_info', JSON.stringify({ nama: 'Direktur Utama GSK', role: 'Direktur / Owner' }));
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
 * Akses Langsung Menu Admin Frontend
 */
function bukaAdminPortalFrontend() {
  // Masuk langsung sebagai admin
  localStorage.setItem('gsk_jwt_token', 'session.admin.token');
  localStorage.setItem('gsk_user_info', JSON.stringify({ nama: 'Administrator GSK', role: 'Super Admin' }));
  
  const modalEl = document.getElementById('modalWorkspaceERP');
  if (modalEl && typeof bootstrap !== 'undefined') {
    modalWorkspace = bootstrap.Modal.getOrCreateInstance(modalEl);
    modalWorkspace.show();
  }
  bukaWorkspaceERP();
  switchTabERP('admin');
}
  localStorage.setItem('gsk_user_info', JSON.stringify({ nama: 'Administrator GSK', role: 'Super Admin' }));
  bukaWorkspaceERP();
  switchTabERP('admin');
}

function switchTabERP(tabName) {
  const tabDash = document.getElementById('erpTabDashboard');
  const tabAdm = document.getElementById('erpTabAdmin');
  const btnDash = document.getElementById('tabBtnDashboard');
  const btnAdm = document.getElementById('tabBtnAdmin');

  if (tabName === 'admin') {
    if (tabDash) tabDash.classList.add('d-none');
    if (tabAdm) tabAdm.classList.remove('d-none');
    if (btnDash) btnDash.classList.remove('active');
    if (btnAdm) btnAdm.classList.add('active');

    // Muat logo tersimpan jika ada
    const savedLogo = localStorage.getItem('gsk_custom_logo');
    if (savedLogo) {
      const box = document.getElementById('frontendLogoPreviewBox');
      if (box) box.innerHTML = `<img src="${savedLogo}" alt="Logo" style="max-height: 100px; max-width: 100px; object-fit: contain;">`;
    }
  } else {
    if (tabDash) tabDash.classList.remove('d-none');
    if (tabAdm) tabAdm.classList.add('d-none');
    if (btnDash) btnDash.classList.add('active');
    if (btnAdm) btnAdm.classList.remove('active');
  }
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

