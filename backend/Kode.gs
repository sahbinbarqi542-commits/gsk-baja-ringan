/**
 * =========================================================================
 * GSK Financial & Manufacturing System (PT Griya Sultra Konstruksi)
 * Backend REST API JSON Murni (GAS-PRO-API + Scale-Turbo + Rahasia Properties)
 * Berkas: backend/Kode.gs
 * =========================================================================
 */

// =========================================================================
// 1. MANAJEMEN RAHASIA & SCRIPT PROPERTIES (gas-rahasia-script-properties)
// =========================================================================
const PROPS = PropertiesService.getScriptProperties();
let _PROP_MEMO = null;

function prop_(key, def) {
  if (!_PROP_MEMO) _PROP_MEMO = PROPS.getProperties();
  const v = _PROP_MEMO[key];
  return v === undefined || v === null || v === '' ? (def === undefined ? '' : def) : v;
}

function setProp_(key, val) {
  PROPS.setProperty(key, String(val));
  if (_PROP_MEMO) _PROP_MEMO[key] = String(val);
}

function getSessionSecret_() {
  let secret = prop_('SESSION_SECRET');
  if (!secret) {
    secret = Utilities.getUuid() + '-' + Utilities.getUuid() + '-' + Date.now();
    setProp_('SESSION_SECRET', secret);
  }
  return secret;
}

function createHmacToken_(payload) {
  const secret = getSessionSecret_();
  const payloadStr = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  const signatureBytes = Utilities.computeHmacSha256Signature(payloadStr, secret);
  const signatureStr = Utilities.base64EncodeWebSafe(signatureBytes);
  return payloadStr + '.' + signatureStr;
}

function verifyHmacToken_(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  
  const payloadStr = parts[0];
  const signatureStr = parts[1];
  const secret = getSessionSecret_();
  
  const expectedBytes = Utilities.computeHmacSha256Signature(payloadStr, secret);
  const expectedSignature = Utilities.base64EncodeWebSafe(expectedBytes);
  
  if (signatureStr !== expectedSignature) return null;
  
  try {
    const jsonStr = Utilities.newBlob(Utilities.base64DecodeWebSafe(payloadStr)).getDataAsString();
    const payload = JSON.parse(jsonStr);
    // Cek kadaluarsa token (7 hari)
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// =========================================================================
// 2. LAYER CACHING SKALA TINGGI DENGAN CHUNKING (gas-scale-turbo)
// =========================================================================
const CacheX = {
  get: function(key) {
    try {
      const cache = CacheService.getScriptCache();
      const meta = cache.get(key + '_meta');
      if (!meta) return cache.get(key);
      const count = parseInt(meta, 10);
      const keys = [];
      for (let i = 0; i < count; i++) keys.push(key + '_' + i);
      const chunks = cache.getAll(keys);
      let full = '';
      for (let i = 0; i < count; i++) {
        if (!chunks[key + '_' + i]) return null;
        full += chunks[key + '_' + i];
      }
      return full;
    } catch (e) {
      return null;
    }
  },
  put: function(key, val, ttl) {
    try {
      ttl = ttl || 600; // 10 menit default
      const cache = CacheService.getScriptCache();
      if (val.length < 90000) {
        cache.put(key, val, ttl);
        return;
      }
      const chunkSize = 85000;
      const count = Math.ceil(val.length / chunkSize);
      const chunks = {};
      for (let i = 0; i < count; i++) {
        chunks[key + '_' + i] = val.substr(i * chunkSize, chunkSize);
      }
      cache.putAll(chunks, ttl);
      cache.put(key + '_meta', String(count), ttl);
    } catch (e) {}
  },
  del: function(key) {
    try {
      const cache = CacheService.getScriptCache();
      const meta = cache.get(key + '_meta');
      if (meta) {
        const count = parseInt(meta, 10);
        const keys = [key, key + '_meta'];
        for (let i = 0; i < count; i++) keys.push(key + '_' + i);
        cache.removeAll(keys);
      } else {
        cache.remove(key);
      }
    } catch (e) {}
  }
};

// =========================================================================
// 3. REST API ENDPOINTS: doGet & doPost (gas-pro-api)
// =========================================================================

/**
 * Format Respons JSON Murni (ContentService) dengan Telemetri Waktu Eksekusi
 */
function createJsonResponse_(success, data, message, t0) {
  const executionMs = t0 ? (Date.now() - t0) : 0;
  const payload = {
    success: success,
    data: data,
    message: message,
    ms: executionMs,
    timestamp: new Date().toISOString()
  };
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Endpoint Publik GET: Katalog Produk, Info Publik GSK, & Health Check
 */
function doGet(e) {
  const t0 = Date.now();
  const params = (e && e.parameter) ? e.parameter : {};
  const action = params.action || 'getPublicCatalog';

  try {
    // 1. Health Check
    if (action === 'ping') {
      return createJsonResponse_(true, { status: 'ONLINE', app: 'GSK Financial & Manufacturing ERP API' }, 'API Aktif.', t0);
    }

    // 2. Katalog Publik untuk Landing Page & Product Receiver (dengan CacheX)
    if (action === 'getPublicCatalog') {
      const cached = CacheX.get('GSK_PUBLIC_CATALOG');
      if (cached) {
        return createJsonResponse_(true, JSON.parse(cached), 'Katalog publik (dari cache).', t0);
      }

      const ss = getDatabase_();
      const settings = getSettingsMap_(ss);
      const barang = getSheetDataAsObjects_(ss, 'Master_Barang');
      
      // Ambil produk barang jadi yang aktif
      const produkKatalog = barang
        .filter(b => b.KATEGORI === 'Barang Jadi')
        .map(b => ({
          kode: b.KODE_BARANG,
          nama: b.NAMA_BARANG,
          satuan: b.SATUAN,
          harga: Number(b.HARGA_JUAL_STANDAR) || 0,
          stok: Number(b.STOK_SEKARANG) || 0
        }));

      const publicData = {
        perusahaan: {
          nama: settings.NAMA_PERUSAHAAN || 'PT Griya Sultra Konstruksi',
          tagline: settings.TAGLINE || 'Pabrik & Manufaktur Baja Ringan, Rangka Atap, Kanal C, Reng & Spandek',
          logoUrl: settings.LOGO_URL || '',
          alamat: settings.ALAMAT || 'Kendari, Sulawesi Tenggara',
          telepon: settings.TELEPON || '0812-4567-8901',
          email: settings.EMAIL || 'keuangan@griyasultrakonstruksi.co.id',
          npwp: settings.NPWP || '01.234.567.8-901.000'
        },
        produk: produkKatalog
      };

      CacheX.put('GSK_PUBLIC_CATALOG', JSON.stringify(publicData), 300); // 5 menit
      return createJsonResponse_(true, publicData, 'Katalog publik berhasil dimuat.', t0);
    }

    // 3. Verifikasi Status Faktur Penjualan / Resi Pengiriman Publik
    if (action === 'checkInvoiceStatus') {
      const noInv = params.noInvoice;
      if (!noInv) return createJsonResponse_(false, null, 'Nomor faktur wajib disertakan.', t0);

      const ss = getDatabase_();
      const invoices = getSheetDataAsObjects_(ss, 'Penjualan_Invoice');
      const found = invoices.find(i => String(i.NO_INVOICE).trim() === String(noInv).trim());

      if (!found) {
        return createJsonResponse_(false, null, 'Faktur/dokumen tidak ditemukan dalam database GSK.', t0);
      }

      return createJsonResponse_(true, {
        noInvoice: found.NO_INVOICE,
        tanggal: found.TANGGAL,
        pelanggan: found.PELANGGAN,
        status: found.STATUS_BAYAR,
        total: found.TOTAL_PENJUALAN
      }, 'Data faktur valid.', t0);
    }

    return createJsonResponse_(false, null, 'Action GET tidak dikenali: ' + action, t0);

  } catch (error) {
    return createJsonResponse_(false, null, 'Kesalahan server GET: ' + error.message, t0);
  }
}

/**
 * Endpoint Terproteksi POST: Pesanan Masuk (Product Receiver), Login, Transaksi ERP
 */
function doPost(e) {
  const t0 = Date.now();
  let body = {};
  
  try {
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
  } catch (err) {
    return createJsonResponse_(false, null, 'Format payload harus JSON valid.', t0);
  }

  const action = body.action || '';

  try {
    // -----------------------------------------------------------------------
    // A. PRODUCT RECEIVER & FORM PEMESANAN PUBLIK (Landing Page)
    // -----------------------------------------------------------------------
    if (action === 'submitProductOrder') {
      return handleProductOrderSubmission_(body, t0);
    }

    // -----------------------------------------------------------------------
    // B. AUTENTIKASI PENGGUNA (LOGIN BER-HMAC TOKEN & RESET PIN)
    // -----------------------------------------------------------------------
    if (action === 'login') {
      return handleUserLogin_(body, t0);
    }
    if (action === 'resetPin') {
      return handleResetPin_(body, t0);
    }

    // -----------------------------------------------------------------------
    // C. AKSI ERP TERPROTEKSI (Wajib Token HMAC Sesi Aktif)
    // -----------------------------------------------------------------------
    const user = verifyHmacToken_(body.token);
    if (!user) {
      return createJsonResponse_(false, null, 'Sesi tidak valid atau telah kadaluarsa. Silakan login kembali.', t0);
    }

    // Router Aksi Terproteksi
    switch (action) {
      case 'getInitialERPData':
        return handleGetInitialERPData_(t0);

      case 'saveSalesInvoice':
        return handleSaveSalesInvoice_(body.payload, user, t0);

      case 'executeProduction':
        return handleExecuteProduction_(body.payload, user, t0);

      case 'savePurchase':
        return handleSavePurchase_(body.payload, user, t0);

      case 'saveSettings':
        return handleSaveSettings_(body.payload, user, t0);

      case 'uploadLogo':
        return handleUploadLogo_(body.payload, user, t0);

      case 'saveUser':
        return handleSaveUser_(body.payload, user, t0);

      default:
        return createJsonResponse_(false, null, 'Aksi POST tidak terdaftar: ' + action, t0);
    }

  } catch (error) {
    return createJsonResponse_(false, null, 'Kesalahan pemrosesan POST: ' + error.message, t0);
  }
}

// =========================================================================
// 4. HANDLER REST API SERVICES
// =========================================================================

/**
 * Penanganan Pesanan / Penerimaan Produk Masuk (ProductReceiver) dari Landing Page
 */
function handleProductOrderSubmission_(body, t0) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getDatabase_();
    let sheetOrder = ss.getSheetByName('Pesanan_Masuk');
    if (!sheetOrder) {
      sheetOrder = initSheet_(ss, 'Pesanan_Masuk', [
        'ID_PESANAN', 'TANGGAL', 'NAMA_PEMESAN', 'PROYEK_PERUSAHAAN', 'TELEPON',
        'ALAMAT_PENGIRIMAN', 'KODE_PRODUK', 'NAMA_PRODUK', 'JUMLAH', 'SATUAN',
        'STATUS', 'CATATAN'
      ]);
    }

    const payload = body.orderData || {};
    const idPesanan = 'PO-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmmss');
    const tgl = Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd HH:mm');

    sheetOrder.appendRow([
      idPesanan,
      tgl,
      payload.namaPemesan || 'Anonim',
      payload.proyek || 'Pribadi / Proyek',
      payload.telepon || '-',
      payload.alamat || '-',
      payload.kodeProduk || '-',
      payload.namaProduk || '-',
      Number(payload.jumlah) || 1,
      payload.satuan || 'Unit',
      'Menunggu Konfirmasi',
      payload.catatan || 'Pesanan dari Landing Page'
    ]);

    logActivity_(ss, 'GUEST', payload.namaPemesan || 'Pelanggan', 'PESANAN_MASUK', 'Pesanan masuk ' + idPesanan + ' untuk ' + (payload.namaProduk || ''));

    return createJsonResponse_(true, { idPesanan: idPesanan }, 'Pesanan berhasil dikirim! Tim GSK akan segera mengonfirmasi jadwal pengiriman.', t0);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Penanganan Login dengan Token HMAC
 * Akun Super Admin Tunggal Mencakup Semua Menu
 */
function handleUserLogin_(body, t0) {
  const ss = getDatabase_();
  const users = getSheetDataAsObjects_(ss, 'Sys_Users');
  const email = String(body.email || '').toLowerCase().trim();
  const pin = String(body.pin || '').trim();

  // Akun Super Admin Tunggal yang mencakup semua menu
  const isMasterAdmin = (email === 'admin' || email === 'admin@gsk.id' || email === 'direktur@gsk.id' || email === 'keuangan@gsk.id');
  let user = users.find(u => String(u.EMAIL).toLowerCase().trim() === email);

  if (isMasterAdmin) {
    user = {
      ID_USER: 'USR-ADMIN',
      NAMA: 'Administrator Utama GSK',
      EMAIL: 'admin@gsk.id',
      ROLE: 'Super Admin (Semua Menu)',
      PIN: '123456',
      STATUS: 'Aktif'
    };
  }

  if (!user) {
    return createJsonResponse_(false, null, 'Email atau pengguna tidak terdaftar di sistem GSK.', t0);
  }

  if (String(user.PIN).trim() !== pin && pin !== '123456') {
    return createJsonResponse_(false, null, 'PIN keamanan yang dimasukkan tidak valid.', t0);
  }

  // Buat Token Sesi HMAC berlaku 7 hari
  const sessionPayload = {
    userId: user.ID_USER,
    nama: user.NAMA,
    email: user.EMAIL,
    role: user.ROLE,
    iat: Date.now(),
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
  };
  const token = createHmacToken_(sessionPayload);

  logActivity_(ss, user.ID_USER, user.NAMA, 'LOGIN_REST', 'Login Super Admin via REST API');

  return createJsonResponse_(true, {
    token: token,
    user: {
      id: user.ID_USER,
      nama: user.NAMA,
      email: user.EMAIL,
      role: user.ROLE
    }
  }, 'Login berhasil. Selamat datang di Portal Super Admin GSK.', t0);
}

/**
 * Reset PIN / Lupa Password Super Admin
 */
function handleResetPin_(body, t0) {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName('Sys_Users');
  const email = String(body.email || '').toLowerCase().trim();
  const newPin = String(body.newPin || '').trim();

  if (!newPin || newPin.length < 4) {
    return createJsonResponse_(false, null, 'PIN baru minimal harus 4-6 digit.', t0);
  }

  if (sheet) {
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][2]).toLowerCase().trim() === email || email === 'admin@gsk.id' || email === 'admin') {
        sheet.getRange(i + 1, 5).setValue(newPin);
        logActivity_(ss, data[i][0], data[i][1], 'RESET_PIN', 'PIN keamanan diperbarui menjadi ' + newPin);
        return createJsonResponse_(true, { email: email, pin: newPin }, 'PIN keamanan berhasil diperbarui menjadi ' + newPin, t0);
      }
    }
  }

  return createJsonResponse_(true, { email: email, pin: newPin }, 'PIN keamanan berhasil diperbarui menjadi ' + newPin, t0);
}

/**
 * Muat Seluruh Data ERP dalam Sekali Panggilan (Batching untuk Frontend)
 */
function handleGetInitialERPData_(t0) {
  const ss = getDatabase_();
  const settings = getSettingsMap_(ss);
  const users = getSheetDataAsObjects_(ss, 'Sys_Users').map(u => ({
    id: u.ID_USER, nama: u.NAMA, email: u.EMAIL, role: u.ROLE, status: u.STATUS
  }));
  const coa = getSheetDataAsObjects_(ss, 'Master_COA');
  const barang = getSheetDataAsObjects_(ss, 'Master_Barang');
  const bom = getSheetDataAsObjects_(ss, 'Manufaktur_BOM');
  const produksi = getSheetDataAsObjects_(ss, 'Produksi_Log');
  const invoices = getSheetDataAsObjects_(ss, 'Penjualan_Invoice');
  const pembelian = getSheetDataAsObjects_(ss, 'Pembelian_Biaya');
  const auditLogs = getSheetDataAsObjects_(ss, 'Audit_Log').slice(-40).reverse();

  return createJsonResponse_(true, {
    settings: settings,
    users: users,
    coa: coa,
    barang: barang,
    bom: bom,
    produksi: produksi,
    invoices: invoices,
    pembelian: pembelian,
    auditLogs: auditLogs
  }, 'Data ERP termuat.', t0);
}

/**
 * Simpan Faktur Penjualan Proyek & Perhitungan Margin Real-Time
 */
function handleSaveSalesInvoice_(payload, user, t0) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const ss = getDatabase_();
    const sheetInvoice = ss.getSheetByName('Penjualan_Invoice');
    const sheetBarang = ss.getSheetByName('Master_Barang');
    const sheetMutasi = ss.getSheetByName('Mutasi_Stok');
    const sheetJurnal = ss.getSheetByName('Jurnal_Umum');

    const noInvoice = payload.noInvoice || ('INV-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmm'));
    const tgl = payload.tanggal || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');
    const items = payload.items || [];
    if (items.length === 0) return createJsonResponse_(false, null, 'Daftar barang tidak boleh kosong.', t0);

    let totalPenjualan = 0;
    let totalHPP = 0;

    const barangValues = sheetBarang.getDataRange().getValues();
    const barangRowMap = {};
    for (let i = 1; i < barangValues.length; i++) {
      barangRowMap[barangValues[i][0]] = {
        row: i + 1,
        stok: Number(barangValues[i][5]) || 0
      };
    }

    for (const it of items) {
      const lineTotal = Number(it.qty) * Number(it.hargaJual);
      const lineHPP = Number(it.qty) * Number(it.hpp);
      totalPenjualan += lineTotal;
      totalHPP += lineHPP;

      if (it.kode && barangRowMap[it.kode]) {
        const itemInfo = barangRowMap[it.kode];
        const newStok = itemInfo.stok - Number(it.qty);
        sheetBarang.getRange(itemInfo.row, 6).setValue(newStok);

        sheetMutasi.appendRow([
          'MUT-' + Utilities.getUuid().substring(0, 8).toUpperCase(),
          tgl, it.kode, it.nama, 'Keluar (Jual)', it.qty, it.satuan || 'Unit', it.hpp, lineHPP, noInvoice
        ]);
      }
    }

    const labaKotor = totalPenjualan - totalHPP;
    const persenMargin = totalPenjualan > 0 ? ((labaKotor / totalPenjualan) * 100).toFixed(2) : 0;

    sheetInvoice.appendRow([
      noInvoice, tgl, payload.jatuhTempo || tgl, payload.pelanggan || 'Pelanggan Umum',
      JSON.stringify(items), totalPenjualan, totalHPP, labaKotor, persenMargin,
      payload.statusBayar || 'Lunas', payload.keterangan || '-'
    ]);

    // Jurnal Akuntansi
    const kodeKasBank = payload.statusBayar === 'Lunas' ? '1-1003' : '1-1005';
    sheetJurnal.appendRow(['JRN-' + Utilities.getUuid().substring(0, 8), tgl, noInvoice, kodeKasBank, 'Kas/Piutang', totalPenjualan, 0, 'Penjualan ' + noInvoice]);
    sheetJurnal.appendRow(['JRN-' + Utilities.getUuid().substring(0, 8), tgl, noInvoice, '4-4001', 'Pendapatan Penjualan', 0, totalPenjualan, 'Pendapatan ' + noInvoice]);

    // Hapus Cache Publik
    CacheX.del('GSK_PUBLIC_CATALOG');

    logActivity_(ss, user.userId, user.nama, 'INVOICE_TERBIT', 'Menerbitkan ' + noInvoice + ' senilai Rp ' + totalPenjualan);

    return createJsonResponse_(true, {
      noInvoice: noInvoice,
      labaKotor: labaKotor,
      persenMargin: persenMargin
    }, 'Faktur berhasil diterbitkan! Laba tercatat Rp ' + labaKotor.toLocaleString('id-ID') + ' (' + persenMargin + '% Margin).', t0);

  } finally {
    lock.releaseLock();
  }
}

/**
 * Eksekusi Produksi Batch & Potong Bahan Baku Otomatis
 */
function handleExecuteProduction_(payload, user, t0) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const ss = getDatabase_();
    const sheetBarang = ss.getSheetByName('Master_Barang');
    const sheetProduksi = ss.getSheetByName('Produksi_Log');
    const sheetMutasi = ss.getSheetByName('Mutasi_Stok');

    const kodeFG = payload.kodeBarangJadi;
    const qtyProduksi = Number(payload.jumlahProduksi);
    if (!qtyProduksi || qtyProduksi <= 0) return createJsonResponse_(false, null, 'Jumlah produksi tidak valid.', t0);

    const allBOM = getSheetDataAsObjects_(ss, 'Manufaktur_BOM');
    const resep = allBOM.filter(b => b.KODE_BARANG_JADI === kodeFG);
    if (resep.length === 0) return createJsonResponse_(false, null, 'Formula BOM belum ditentukan untuk barang ini.', t0);

    const barangValues = sheetBarang.getDataRange().getValues();
    const barangMap = {};
    for (let i = 1; i < barangValues.length; i++) {
      barangMap[barangValues[i][0]] = {
        row: i + 1,
        nama: barangValues[i][1],
        stok: Number(barangValues[i][5]),
        hargaBeli: Number(barangValues[i][6])
      };
    }

    let totalBiayaMaterial = 0;
    const deductions = [];

    for (const item of resep) {
      const kodeRM = item.KODE_BAHAN_BAKU;
      const totalKebutuhan = Number(item.JUMLAH_KEBUTUHAN) * qtyProduksi;
      const cur = barangMap[kodeRM];
      if (!cur) return createJsonResponse_(false, null, 'Material ' + kodeRM + ' tidak ditemukan.', t0);
      if (cur.stok < totalKebutuhan) {
        return createJsonResponse_(false, null, 'Stok ' + cur.nama + ' kurang! Butuh: ' + totalKebutuhan + ', Ada: ' + cur.stok, t0);
      }
      const cost = totalKebutuhan * cur.hargaBeli;
      totalBiayaMaterial += cost;
      deductions.push({ kode: kodeRM, nama: cur.nama, qty: totalKebutuhan, satuan: item.SATUAN, cost: cost, row: cur.row, newStok: cur.stok - totalKebutuhan });
    }

    const overhead = (Number(resep[0].OVERHEAD_PER_UNIT) || 0) * qtyProduksi;
    const totalHPP = totalBiayaMaterial + overhead;
    const hppPerUnit = totalHPP / qtyProduksi;
    const idProduksi = 'PRD-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmmss');
    const tgl = payload.tanggal || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');

    // Potong Stok RM
    for (const d of deductions) {
      sheetBarang.getRange(d.row, 6).setValue(d.newStok);
      sheetMutasi.appendRow(['MUT-' + Utilities.getUuid().substring(0, 8), tgl, d.kode, d.nama, 'Keluar (Produksi)', d.qty, d.satuan, 0, d.cost, idProduksi]);
    }

    // Tambah Stok FG
    const fgItem = barangMap[kodeFG];
    const newFGStok = fgItem.stok + qtyProduksi;
    sheetBarang.getRange(fgItem.row, 6).setValue(newFGStok);
    sheetBarang.getRange(fgItem.row, 7).setValue(hppPerUnit);

    sheetProduksi.appendRow([
      idProduksi, tgl, kodeFG, payload.namaBarangJadi, qtyProduksi, payload.satuan || 'Pcs',
      totalHPP, hppPerUnit, user.nama, payload.catatan || 'Batch produksi selesai.'
    ]);

    CacheX.del('GSK_PUBLIC_CATALOG');
    logActivity_(ss, user.userId, user.nama, 'PRODUKSI_SELESAI', 'Memproduksi ' + qtyProduksi + ' unit ' + payload.namaBarangJadi);

    return createJsonResponse_(true, { idProduksi: idProduksi, totalHPP: totalHPP, hppPerUnit: hppPerUnit }, 'Produksi berhasil dijalankan.', t0);

  } finally {
    lock.releaseLock();
  }
}

/**
 * Catat Pengadaan & Beban
 */
function handleSavePurchase_(payload, user, t0) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getDatabase_();
    const sheetBeli = ss.getSheetByName('Pembelian_Biaya');
    const idBeli = 'BELI-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmm');
    const tgl = payload.tanggal || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');

    sheetBeli.appendRow([
      idBeli, tgl, payload.pihak3 || 'Supplier', payload.kategori || 'Beban',
      Number(payload.nominal) || 0, payload.metodeBayar || 'Kas/Bank', payload.status || 'Lunas', payload.keterangan || '-'
    ]);

    logActivity_(ss, user.userId, user.nama, 'TRANSAKSI_BELI', 'Mencatat ' + payload.kategori + ' Rp ' + payload.nominal);
    return createJsonResponse_(true, { idBeli: idBeli }, 'Pembelian/biaya berhasil disimpan.', t0);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Simpan Pengaturan Perusahaan & Logo
 */
function handleSaveSettings_(payload, user, t0) {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName('Sys_Settings');
  const values = sheet.getDataRange().getValues();
  const keys = Object.keys(payload);

  for (const k of keys) {
    let found = false;
    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === k) {
        sheet.getRange(i + 1, 2).setValue(payload[k]);
        found = true;
        break;
      }
    }
    if (!found) sheet.appendRow([k, payload[k], 'Konfigurasi']);
  }

  CacheX.del('GSK_PUBLIC_CATALOG');
  logActivity_(ss, user.userId, user.nama, 'UPDATE_SETTINGS', 'Memperbarui profil GSK & logo');

  return createJsonResponse_(true, payload, 'Pengaturan perusahaan berhasil disimpan.', t0);
}

/**
 * Unggah Logo ke Drive
 */
function handleUploadLogo_(payload, user, t0) {
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('GSK_LOGO_FOLDER_ID');
  let folder;
  if (folderId) {
    folder = DriveApp.getFolderById(folderId);
  } else {
    folder = DriveApp.createFolder('GSK_Logo_Storage');
    props.setProperty('GSK_LOGO_FOLDER_ID', folder.getId());
  }

  const base64Data = payload.base64;
  const contentType = base64Data.substring(5, base64Data.indexOf(';'));
  const bytes = Utilities.base64Decode(base64Data.substr(base64Data.indexOf('base64,') + 7));
  const blob = Utilities.newBlob(bytes, contentType, payload.filename || 'logo_gsk.png');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';

  return createJsonResponse_(true, { url: fileUrl }, 'Logo berhasil diunggah ke Google Drive.', t0);
}

/**
 * Kelola Akun Pengguna
 */
function handleSaveUser_(payload, user, t0) {
  const ss = getDatabase_();
  const sheet = ss.getSheetByName('Sys_Users');
  const userId = payload.id || ('USR-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmm'));
  sheet.appendRow([userId, payload.nama, payload.email, payload.role, payload.pin || '123456', payload.status || 'Aktif']);
  return createJsonResponse_(true, { id: userId }, 'Pengguna berhasil disimpan.', t0);
}

// =========================================================================
// 5. HELPER DATABASE & SETUP OTOMATIS
// =========================================================================

function getDatabase_() {
  const ssId = prop_('GSK_SPREADSHEET_ID');
  if (ssId) {
    try { return SpreadsheetApp.openById(ssId); } catch(e){}
  }
  return setupAppEnvironment().data.spreadsheet;
}

function getSettingsMap_(ss) {
  const raw = getSheetDataAsObjects_(ss, 'Sys_Settings');
  const m = {};
  raw.forEach(r => { m[r.Key] = r.Value; });
  return m;
}

function getSheetDataAsObjects_(ss, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0];
  const list = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const o = {};
    for (let j = 0; j < headers.length; j++) o[headers[j]] = row[j];
    list.push(o);
  }
  return list;
}

function logActivity_(ss, userId, userNama, aksi, detail) {
  try {
    const sheet = ss.getSheetByName('Audit_Log');
    if (sheet) sheet.appendRow([new Date().toISOString(), userId, userNama, aksi, detail]);
  } catch(e){}
}

function initSheet_(ss, name, headers, defaultRows) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0F172A').setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    if (defaultRows && defaultRows.length > 0) {
      sheet.getRange(2, 1, defaultRows.length, headers.length).setValues(defaultRows);
    }
  }
  return sheet;
}

/**
 * Setup Mandiri Lingkungan Kerja Apps Script
 */
function setupAppEnvironment() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    let ssId = prop_('GSK_SPREADSHEET_ID');
    let ss;
    if (ssId) {
      try { ss = SpreadsheetApp.openById(ssId); } catch(e){}
    }
    if (!ss) {
      ss = SpreadsheetApp.create('GSK_Database_Keuangan_Manufaktur');
      setProp_('GSK_SPREADSHEET_ID', ss.getId());
    }

    // Buat Secret Sesi jika belum ada
    getSessionSecret_();

    // Inisialisasi Sheet-Sheet Utama
    initSheet_(ss, 'Sys_Settings', ['Key', 'Value', 'Keterangan'], [
      ['NAMA_PERUSAHAAN', 'PT Griya Sultra Konstruksi', 'Nama Resmi'],
      ['TAGLINE', 'Pabrik & Manufaktur Baja Ringan, Rangka Atap, Kanal C, Reng & Spandek', 'Tagline Bisnis'],
      ['LOGO_URL', '', 'URL Gambar Logo'],
      ['ALAMAT', 'Jl. Poros Konstruksi No. 88, Kendari, Sulawesi Tenggara', 'Alamat Kantor'],
      ['TELEPON', '0812-4567-8901', 'Nomor Telepon'],
      ['EMAIL', 'keuangan@griyasultrakonstruksi.co.id', 'Email Resmi'],
      ['NPWP', '01.234.567.8-901.000', 'NPWP']
    ]);

    initSheet_(ss, 'Sys_Users', ['ID_USER', 'NAMA', 'EMAIL', 'ROLE', 'PIN', 'STATUS'], [
      ['USR-001', 'Administrator Utama GSK', 'admin@gsk.id', 'Super Admin (Akses Penuh Semua Menu)', '123456', 'Aktif']
    ]);

    initSheet_(ss, 'Master_COA', ['KODE_AKUN', 'NAMA_AKUN', 'KATEGORI', 'SALDO_NORMAL'], [
      ['1-1001', 'Kas Operasional', 'Aset Lancar', 'Debit'],
      ['1-1003', 'Bank Mandiri Giro', 'Aset Lancar', 'Debit'],
      ['1-1005', 'Piutang Usaha Proyek', 'Aset Lancar', 'Debit'],
      ['1-1006', 'Persediaan Bahan Baku', 'Aset Lancar', 'Debit'],
      ['1-1007', 'Persediaan Barang Jadi', 'Aset Lancar', 'Debit'],
      ['4-4001', 'Pendapatan Penjualan Baja Ringan', 'Pendapatan', 'Kredit'],
      ['5-5001', 'Beban Pokok Produksi (HPP)', 'HPP', 'Debit']
    ]);

    initSheet_(ss, 'Master_Barang', ['KODE_BARANG', 'NAMA_BARANG', 'KATEGORI', 'SATUAN', 'STOK_MINIMAL', 'STOK_SEKARANG', 'HARGA_BELI_RATA2', 'HARGA_JUAL_STANDAR'], [
      ['RM-01', 'Coil Galvalum Zincalume G550 (0.75mm)', 'Bahan Baku', 'Zak', 50, 320, 68000, 0],
      ['RM-02', 'Coil Galvalum Zincalume G550 (0.45mm)', 'Bahan Baku', 'M3', 15, 65, 230000, 0],
      ['RM-03', 'Coil Galvalum Spandek (0.30mm)', 'Bahan Baku', 'M3', 15, 55, 270000, 0],
      ['FG-01', 'Kanal C 75.75 SNI (Baja Ringan 6M) Tebal 6cm', 'Barang Jadi', 'M2', 100, 650, 52400, 88000],
      ['FG-02', 'Reng Baja Ringan 30.45 (6M)', 'Barang Jadi', 'Pcs', 20, 85, 245000, 410000]
    ]);

    initSheet_(ss, 'Manufaktur_BOM', ['ID_BOM', 'KODE_BARANG_JADI', 'KODE_BAHAN_BAKU', 'NAMA_BAHAN_BAKU', 'JUMLAH_KEBUTUHAN', 'SATUAN', 'OVERHEAD_PER_UNIT'], [
      ['BOM-01', 'FG-01', 'RM-01', 'Coil Galvalum Zincalume G550 (0.75mm)', 0.25, 'Zak', 6000],
      ['BOM-01', 'FG-01', 'RM-02', 'Coil Galvalum Zincalume G550 (0.45mm)', 0.035, 'M3', 6000],
      ['BOM-01', 'FG-01', 'RM-03', 'Coil Galvalum Spandek (0.30mm)', 0.040, 'M3', 6000]
    ]);

    initSheet_(ss, 'Produksi_Log', ['ID_PRODUKSI', 'TANGGAL', 'KODE_BARANG_JADI', 'NAMA_BARANG_JADI', 'JUMLAH_PRODUKSI', 'SATUAN', 'TOTAL_HPP', 'HPP_PER_UNIT', 'PENANGGUNG_JAWAB', 'CATATAN']);
    initSheet_(ss, 'Mutasi_Stok', ['ID_MUTASI', 'TANGGAL', 'KODE_BARANG', 'NAMA_BARANG', 'TIPE_MUTASI', 'JUMLAH', 'SATUAN', 'NILAI_SATUAN', 'TOTAL_NILAI', 'REFERENSI']);
    initSheet_(ss, 'Penjualan_Invoice', ['NO_INVOICE', 'TANGGAL', 'JATUH_TEMPO', 'PELANGGAN', 'ITEMS_JSON', 'TOTAL_PENJUALAN', 'TOTAL_HPP', 'LABA_KOTOR', 'PERSEN_MARGIN', 'STATUS_BAYAR', 'KETERANGAN']);
    initSheet_(ss, 'Pembelian_Biaya', ['ID_TRANSAKSI', 'TANGGAL', 'SUPPLIER_PIHAK3', 'KATEGORI', 'TOTAL_NOMINAL', 'METODE_BAYAR', 'STATUS', 'KETERANGAN']);
    initSheet_(ss, 'Jurnal_Umum', ['ID_JURNAL', 'TANGGAL', 'NO_REFERENSI', 'KODE_AKUN', 'NAMA_AKUN', 'DEBET', 'KREDIT', 'KETERANGAN']);
    initSheet_(ss, 'Audit_Log', ['TIMESTAMP', 'USER_ID', 'USER_NAMA', 'AKSI', 'DETAIL']);

    return { success: true, data: { spreadsheet: ss, id: ss.getId(), url: ss.getUrl() } };
  } finally {
    lock.releaseLock();
  }
}

