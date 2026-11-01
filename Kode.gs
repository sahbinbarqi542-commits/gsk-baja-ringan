/**
 * =========================================================================
 * GSK Financial & Manufacturing System (PT Griya Sultra Konstruksi)
 * Backend Core Script: Kode.gs
 * Arsitektur: Google Apps Script Web App (SPA)
 * =========================================================================
 */

/**
 * Endpoint Utama Web App Google Apps Script
 */
function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('GSK Keuangan & Manufaktur - PT Griya Sultra Konstruksi')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Menyertakan file HTML lain ke dalam template induk
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Pembungkus Standar Respons API Client-Server
 */
function createResponse(success, data = null, message = '') {
  return {
    success: success,
    data: data,
    message: message,
    timestamp: new Date().toISOString()
  };
}

/**
 * Mendapatkan Spreadsheet Database Aktif
 */
function getDatabase() {
  const props = PropertiesService.getScriptProperties();
  const ssId = props.getProperty('GSK_SPREADSHEET_ID');
  if (ssId) {
    try {
      return SpreadsheetApp.openById(ssId);
    } catch (e) {
      // Fallback jika ID tersimpan tidak valid
    }
  }
  
  // Cek apakah script ini terikat langsung ke active spreadsheet
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) {
      props.setProperty('GSK_SPREADSHEET_ID', active.getId());
      return active;
    }
  } catch (err) {}
  
  // Jika belum ada, jalankan setup otomatis
  return setupAppEnvironment().data.spreadsheet;
}

/**
 * AUTO-SETUP ENVIRONMENT & DATABASE SPREADSHEET
 * Membangun seluruh lembar database, formula awal, data default, dan folder Drive
 */
function setupAppEnvironment() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const props = PropertiesService.getScriptProperties();

    // 1. Inisialisasi Root Folder di Google Drive
    let rootFolderId = props.getProperty('GSK_ROOT_FOLDER_ID');
    let rootFolder;
    if (!rootFolderId) {
      rootFolder = DriveApp.createFolder('GSK_Sistem_Keuangan_Manufaktur');
      rootFolderId = rootFolder.getId();
      props.setProperty('GSK_ROOT_FOLDER_ID', rootFolderId);
    } else {
      try {
        rootFolder = DriveApp.getFolderById(rootFolderId);
      } catch (e) {
        rootFolder = DriveApp.createFolder('GSK_Sistem_Keuangan_Manufaktur');
        rootFolderId = rootFolder.getId();
        props.setProperty('GSK_ROOT_FOLDER_ID', rootFolderId);
      }
    }

    // 2. Subfolder Upload Bukti & Logo
    let uploadFolderId = props.getProperty('GSK_UPLOAD_FOLDER_ID');
    if (!uploadFolderId) {
      const uploadFolder = rootFolder.createFolder('Bukti_Transaksi_Nota');
      uploadFolderId = uploadFolder.getId();
      props.setProperty('GSK_UPLOAD_FOLDER_ID', uploadFolderId);
    }

    let logoFolderId = props.getProperty('GSK_LOGO_FOLDER_ID');
    if (!logoFolderId) {
      const logoFolder = rootFolder.createFolder('Identitas_Logo');
      logoFolderId = logoFolder.getId();
      props.setProperty('GSK_LOGO_FOLDER_ID', logoFolderId);
    }

    // 3. Inisialisasi Spreadsheet Database
    let ssId = props.getProperty('GSK_SPREADSHEET_ID');
    let ss;
    if (!ssId) {
      try {
        ss = SpreadsheetApp.getActiveSpreadsheet();
        if (!ss) throw new Error('No active spreadsheet');
        ssId = ss.getId();
      } catch (e) {
        ss = SpreadsheetApp.create('GSK_Database_Keuangan_Manufaktur');
        const file = DriveApp.getFileById(ss.getId());
        file.moveTo(rootFolder);
        ssId = ss.getId();
      }
      props.setProperty('GSK_SPREADSHEET_ID', ssId);
    } else {
      try {
        ss = SpreadsheetApp.openById(ssId);
      } catch (e) {
        ss = SpreadsheetApp.create('GSK_Database_Keuangan_Manufaktur');
        const file = DriveApp.getFileById(ss.getId());
        file.moveTo(rootFolder);
        ssId = ss.getId();
        props.setProperty('GSK_SPREADSHEET_ID', ssId);
      }
    }

    // 4. Inisialisasi Sheet-Sheet Baku dengan Header & Data Awal
    initSheet(ss, 'Sys_Settings', ['Key', 'Value', 'Keterangan'], [
      ['NAMA_PERUSAHAAN', 'PT Griya Sultra Konstruksi', 'Nama Resmi Perusahaan'],
      ['TAGLINE', 'Pabrik & Manufaktur Baja Ringan, Rangka Atap, Kanal C, Reng & Spandek', 'Tagline Bisnis'],
      ['LOGO_URL', '', 'URL atau Data Base64 Logo Perusahaan'],
      ['ALAMAT', 'Jl. Poros Konstruksi No. 88, Kendari, Sulawesi Tenggara', 'Alamat Kantor/Workshop'],
      ['TELEPON', '0812-4567-8901', 'Nomor Kontak'],
      ['EMAIL', 'keuangan@griyasultrakonstruksi.co.id', 'Email Resmi'],
      ['NPWP', '01.234.567.8-901.000', 'Nomor Pokok Wajib Pajak'],
      ['TARGET_MARGIN_MINIMAL', '25', 'Target Minimal Gross Margin (%)']
    ]);

    initSheet(ss, 'Sys_Users', ['ID_USER', 'NAMA', 'EMAIL', 'ROLE', 'PIN', 'STATUS'], [
      ['USR-001', 'Direktur Utama GSK', 'direktur@gsk.id', 'Direktur / Owner', '123456', 'Aktif'],
      ['USR-002', 'Admin Keuangan & Pajak', 'keuangan@gsk.id', 'Admin Keuangan', '123456', 'Aktif'],
      ['USR-003', 'Mandor Pabrik & Gudang', 'gudang@gsk.id', 'Staf Gudang & Produksi', '123456', 'Aktif'],
      ['USR-004', 'Super Admin IT', 'admin@gsk.id', 'Super Admin', '123456', 'Aktif']
    ]);

    initSheet(ss, 'Master_COA', ['KODE_AKUN', 'NAMA_AKUN', 'KATEGORI', 'SALDO_NORMAL'], [
      ['1-1001', 'Kas Operasional Kantor', 'Aset Lancar', 'Debit'],
      ['1-1002', 'Kas Kecil Proyek Lapangan', 'Aset Lancar', 'Debit'],
      ['1-1003', 'Bank Mandiri Giro Utama', 'Aset Lancar', 'Debit'],
      ['1-1004', 'Bank BNI Rekening Operasional', 'Aset Lancar', 'Debit'],
      ['1-1005', 'Piutang Usaha Proyek', 'Aset Lancar', 'Debit'],
      ['1-1006', 'Persediaan Bahan Baku (Raw Material)', 'Aset Lancar', 'Debit'],
      ['1-1007', 'Persediaan Barang Jadi (Finished Goods)', 'Aset Lancar', 'Debit'],
      ['2-2001', 'Hutang Usaha Supplier Material', 'Kewajiban', 'Kredit'],
      ['3-3001', 'Modal Saham Disetor', 'Ekuitas', 'Kredit'],
      ['3-3002', 'Laba Ditahan / Saldo Laba', 'Ekuitas', 'Kredit'],
      ['4-4001', 'Pendapatan Penjualan Baja Ringan & Paving', 'Pendapatan', 'Kredit'],
      ['4-4002', 'Pendapatan Jasa Konstruksi & Borongan', 'Pendapatan', 'Kredit'],
      ['5-5001', 'Beban Pokok Produksi (HPP) Material', 'HPP', 'Debit'],
      ['5-5002', 'Beban Upah Tenaga Kerja Langsung', 'HPP', 'Debit'],
      ['6-6001', 'Beban Gaji Staf & Manajemen', 'Beban Operasional', 'Debit'],
      ['6-6002', 'Beban Bahan Bakar & Alat Berat', 'Beban Operasional', 'Debit'],
      ['6-6003', 'Beban Listrik, Air & Komunikasi', 'Beban Operasional', 'Debit']
    ]);

    initSheet(ss, 'Master_Barang', ['KODE_BARANG', 'NAMA_BARANG', 'KATEGORI', 'SATUAN', 'STOK_MINIMAL', 'STOK_SEKARANG', 'HARGA_BELI_RATA2', 'HARGA_JUAL_STANDAR'], [
      ['RM-01', 'Coil Galvalum Zincalume G550 (0.75mm)', 'Bahan Baku', 'Zak', 50, 320, 68000, 0],
      ['RM-02', 'Coil Galvalum Zincalume G550 (0.45mm)', 'Bahan Baku', 'M3', 15, 65, 230000, 0],
      ['RM-03', 'Coil Galvalum Spandek (0.30mm)', 'Bahan Baku', 'M3', 15, 55, 270000, 0],
      ['RM-04', 'Baut Roofing Hex Head 12x20', 'Bahan Baku', 'Batang', 100, 420, 89000, 0],
      ['FG-01', 'Kanal C 75.75 SNI (Baja Ringan 6M) Tebal 6cm', 'Barang Jadi', 'M2', 100, 650, 52400, 88000],
      ['FG-02', 'Reng Baja Ringan 30.45 (6M)', 'Barang Jadi', 'Pcs', 20, 85, 245000, 410000],
      ['FG-03', 'Atap Spandek Galvalum 0.30mm Heavy 100x100x120', 'Barang Jadi', 'Pcs', 10, 18, 1550000, 2450000]
    ]);

    initSheet(ss, 'Manufaktur_BOM', ['ID_BOM', 'KODE_BARANG_JADI', 'KODE_BAHAN_BAKU', 'NAMA_BAHAN_BAKU', 'JUMLAH_KEBUTUHAN', 'SATUAN', 'OVERHEAD_PER_UNIT'], [
      ['BOM-01', 'FG-01', 'RM-01', 'Coil Galvalum Zincalume G550 (0.75mm)', 0.25, 'Zak', 6000],
      ['BOM-01', 'FG-01', 'RM-02', 'Coil Galvalum Zincalume G550 (0.45mm)', 0.035, 'M3', 6000],
      ['BOM-01', 'FG-01', 'RM-03', 'Coil Galvalum Spandek (0.30mm)', 0.040, 'M3', 6000],
      ['BOM-02', 'FG-02', 'RM-01', 'Coil Galvalum Zincalume G550 (0.75mm)', 1.20, 'Zak', 30000],
      ['BOM-02', 'FG-02', 'RM-02', 'Coil Galvalum Zincalume G550 (0.45mm)', 0.12, 'M3', 30000],
      ['BOM-02', 'FG-02', 'RM-03', 'Coil Galvalum Spandek (0.30mm)', 0.15, 'M3', 30000],
      ['BOM-02', 'FG-02', 'RM-04', 'Baut Roofing Hex Head 12x20', 2.50, 'Batang', 30000]
    ]);

    initSheet(ss, 'Produksi_Log', ['ID_PRODUKSI', 'TANGGAL', 'KODE_BARANG_JADI', 'NAMA_BARANG_JADI', 'JUMLAH_PRODUKSI', 'SATUAN', 'TOTAL_HPP', 'HPP_PER_UNIT', 'PENANGGUNG_JAWAB', 'CATATAN'], [
      ['PRD-2026-001', '2026-02-15', 'FG-01', 'Kanal C 75.75 SNI (Baja Ringan 6M) Tebal 6cm', 200, 'M2', 10480000, 52400, 'Mandor Pabrik', 'Batch Produksi Standar K-300'],
      ['PRD-2026-002', '2026-02-20', 'FG-02', 'Reng Baja Ringan 30.45 (6M)', 30, 'Pcs', 7350000, 245000, 'Mandor Pabrik', 'Casting Cetak U-Ditch Proyek']
    ]);

    initSheet(ss, 'Mutasi_Stok', ['ID_MUTASI', 'TANGGAL', 'KODE_BARANG', 'NAMA_BARANG', 'TIPE_MUTASI', 'JUMLAH', 'SATUAN', 'NILAI_SATUAN', 'TOTAL_NILAI', 'REFERENSI'], [
      ['MUT-001', '2026-02-10', 'RM-01', 'Semen Portland Type 1', 'Masuk (Beli)', 200, 'Zak', 68000, 13600000, 'PO-2026-001'],
      ['MUT-002', '2026-02-15', 'FG-01', 'Kanal C 75.75 SNI (Baja Ringan 6M) Tebal 6cm', 'Masuk (Produksi)', 200, 'M2', 52400, 10480000, 'PRD-2026-001'],
      ['MUT-003', '2026-02-18', 'FG-01', 'Kanal C 75.75 SNI (Baja Ringan 6M) Tebal 6cm', 'Keluar (Jual)', 150, 'M2', 52400, 7860000, 'INV-2026-001']
    ]);

    initSheet(ss, 'Penjualan_Invoice', ['NO_INVOICE', 'TANGGAL', 'JATUH_TEMPO', 'PELANGGAN', 'ITEMS_JSON', 'TOTAL_PENJUALAN', 'TOTAL_HPP', 'LABA_KOTOR', 'PERSEN_MARGIN', 'STATUS_BAYAR', 'KETERANGAN'], [
      ['INV-2026-001', '2026-02-18', '2026-03-05', 'PT Bumi Perkasa Kendari', JSON.stringify([
        { kode: 'FG-01', nama: 'Kanal C 75.75 SNI (Baja Ringan 6M) Tebal 6cm', qty: 150, hargaJual: 88000, hpp: 52400, subtotal: 13200000, subtotalHpp: 7860000 }
      ]), 13200000, 7860000, 5340000, 40.45, 'Lunas', 'Pembayaran via Transfer Mandiri Giro']
    ]);

    initSheet(ss, 'Pembelian_Biaya', ['ID_TRANSAKSI', 'TANGGAL', 'SUPPLIER_PIHAK3', 'KATEGORI', 'TOTAL_NOMINAL', 'METODE_BAYAR', 'STATUS', 'KETERANGAN'], [
      ['BELI-2026-001', '2026-02-10', 'PT Semen Tonasa Distributor', 'Pembelian Bahan Baku', 13600000, 'Transfer Bank', 'Lunas', 'Pengadaan 200 Zak Semen'],
      ['BIAYA-2026-002', '2026-02-14', 'Solar Industri Pertamina', 'Bahan Bakar & Alat Berat', 2500000, 'Kas Tunai', 'Lunas', 'BBM Genset & Forklift Pabrik']
    ]);

    initSheet(ss, 'Jurnal_Umum', ['ID_JURNAL', 'TANGGAL', 'NO_REFERENSI', 'KODE_AKUN', 'NAMA_AKUN', 'DEBET', 'KREDIT', 'KETERANGAN'], [
      ['JRN-001', '2026-02-18', 'INV-2026-001', '1-1003', 'Bank Mandiri Giro Utama', 13200000, 0, 'Penerimaan Penjualan INV-2026-001'],
      ['JRN-002', '2026-02-18', 'INV-2026-001', '4-4001', 'Pendapatan Penjualan Baja Ringan & Paving', 0, 13200000, 'Pendapatan INV-2026-001'],
      ['JRN-003', '2026-02-18', 'INV-2026-001', '5-5001', 'Beban Pokok Produksi (HPP) Material', 7860000, 0, 'Beban HPP INV-2026-001'],
      ['JRN-004', '2026-02-18', 'INV-2026-001', '1-1007', 'Persediaan Barang Jadi (Finished Goods)', 0, 7860000, 'Pengurangan Stok FG-01']
    ]);

    initSheet(ss, 'Audit_Log', ['TIMESTAMP', 'USER_ID', 'USER_NAMA', 'AKSI', 'DETAIL'], [
      [new Date().toISOString(), 'SYSTEM', 'Sistem Auto-Setup', 'INISIALISASI', 'Setup database GSK selesai secara otomatis.']
    ]);

    // Hapus sheet default "Sheet1" jika masih ada
    const defaultSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Sheet 1');
    if (defaultSheet && ss.getSheets().length > 1) {
      try { ss.deleteSheet(defaultSheet); } catch(e){}
    }

    return createResponse(true, {
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      rootFolderId: rootFolderId
    }, 'Inisialisasi sistem database GSK berhasil dijalankan.');

  } catch (error) {
    return createResponse(false, null, 'Gagal inisialisasi: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Inisialisasi Sheet Mandiri Aman (Idempoten)
 */
function initSheet(ss, sheetName, headers, defaultRows = []) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
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
 * Helper untuk membaca sheet menjadi Array of Objects
 */
function getSheetDataAsObjects(sheetName) {
  const ss = getDatabase();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  
  const headers = values[0];
  const results = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    results.push(obj);
  }
  return results;
}

/**
 * Memuat Seluruh Data Awal Aplikasi dalam Sekali Request (Efisien & Cepat)
 */
function getAppInitialData() {
  try {
    const ss = getDatabase();
    
    // Konfigurasi Pengaturan Perusahaan
    const rawSettings = getSheetDataAsObjects('Sys_Settings');
    const settings = {};
    rawSettings.forEach(item => {
      settings[item.Key] = item.Value;
    });

    const users = getSheetDataAsObjects('Sys_Users').map(u => ({
      id: u.ID_USER,
      nama: u.NAMA,
      email: u.EMAIL,
      role: u.ROLE,
      status: u.STATUS
    }));

    const coa = getSheetDataAsObjects('Master_COA');
    const barang = getSheetDataAsObjects('Master_Barang');
    const bom = getSheetDataAsObjects('Manufaktur_BOM');
    const produksi = getSheetDataAsObjects('Produksi_Log');
    const invoices = getSheetDataAsObjects('Penjualan_Invoice');
    const pembelian = getSheetDataAsObjects('Pembelian_Biaya');
    const mutasi = getSheetDataAsObjects('Mutasi_Stok');
    const auditLogs = getSheetDataAsObjects('Audit_Log');

    return createResponse(true, {
      settings: settings,
      users: users,
      coa: coa,
      barang: barang,
      bom: bom,
      produksi: produksi,
      invoices: invoices,
      pembelian: pembelian,
      mutasi: mutasi,
      auditLogs: auditLogs.slice(-50).reverse() // 50 log terakhir
    }, 'Data berhasil dimuat.');
  } catch (error) {
    return createResponse(false, null, 'Gagal memuat data awal: ' + error.message);
  }
}

/**
 * Autentikasi Pengguna & PIN
 */
function loginUser(email, pin) {
  try {
    const users = getSheetDataAsObjects('Sys_Users');
    const user = users.find(u => String(u.EMAIL).toLowerCase().trim() === String(email).toLowerCase().trim());
    
    if (!user) {
      return createResponse(false, null, 'Email atau nama pengguna tidak terdaftar di sistem GSK.');
    }
    
    if (String(user.PIN).trim() !== String(pin).trim()) {
      return createResponse(false, null, 'PIN keamanan yang Anda masukkan salah.');
    }

    if (String(user.STATUS).toLowerCase() !== 'aktif') {
      return createResponse(false, null, 'Akun ini sedang dinonaktifkan. Hubungi Administrator.');
    }

    logActivity(user.ID_USER, user.NAMA, 'LOGIN', 'Pengguna berhasil masuk ke sistem.');

    return createResponse(true, {
      id: user.ID_USER,
      nama: user.NAMA,
      email: user.EMAIL,
      role: user.ROLE
    }, 'Login berhasil. Selamat datang di Portal GSK.');
  } catch (error) {
    return createResponse(false, null, 'Gagal memproses login: ' + error.message);
  }
}

/**
 * Simpan / Perbarui Pengaturan Perusahaan (Termasuk Ganti Logo)
 */
function saveCompanySettings(payload, userActor) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getDatabase();
    const sheet = ss.getSheetByName('Sys_Settings');
    if (!sheet) throw new Error('Sheet Sys_Settings tidak ditemukan.');

    const values = sheet.getDataRange().getValues();
    const keys = Object.keys(payload);

    for (const key of keys) {
      let found = false;
      for (let i = 1; i < values.length; i++) {
        if (values[i][0] === key) {
          sheet.getRange(i + 1, 2).setValue(payload[key]);
          found = true;
          break;
        }
      }
      if (!found) {
        sheet.appendRow([key, payload[key], 'Konfigurasi Tambahan']);
      }
    }

    logActivity(userActor ? userActor.id : 'ADMIN', userActor ? userActor.nama : 'Admin', 'UPDATE_SETTINGS', 'Memperbarui profil & identitas perusahaan.');

    return createResponse(true, payload, 'Pengaturan profil dan logo perusahaan berhasil disimpan.');
  } catch (error) {
    return createResponse(false, null, 'Gagal menyimpan pengaturan: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Unggah Berkas Gambar Logo ke Google Drive
 */
function uploadLogoImage(base64Data, filename) {
  try {
    const props = PropertiesService.getScriptProperties();
    let folderId = props.getProperty('GSK_LOGO_FOLDER_ID');
    let folder;
    if (folderId) {
      folder = DriveApp.getFolderById(folderId);
    } else {
      folder = DriveApp.createFolder('Identitas_Logo');
      props.setProperty('GSK_LOGO_FOLDER_ID', folder.getId());
    }

    const contentType = base64Data.substring(5, base64Data.indexOf(';'));
    const bytes = Utilities.base64Decode(base64Data.substr(base64Data.indexOf('base64,') + 7));
    const blob = Utilities.newBlob(bytes, contentType, filename || 'logo_gsk_' + Date.now() + '.png');
    
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    // Dapatkan URL tampilan langsung
    const fileUrl = 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800';

    return createResponse(true, {
      fileId: file.getId(),
      url: fileUrl
    }, 'Logo berhasil diunggah.');
  } catch (error) {
    return createResponse(false, null, 'Gagal upload logo: ' + error.message);
  }
}

/**
 * EKSEKUSI PRODUKSI MANUFAKTUR & POTONG STOK OTOMATIS
 * Memotong stok bahan baku berdasarkan resep BOM x Qty, menghitung total HPP,
 * menambah stok barang jadi, dan mencatat jurnal otomatis.
 */
function executeProductionBatch(payload, userActor) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const ss = getDatabase();
    const sheetBarang = ss.getSheetByName('Master_Barang');
    const sheetBOM = ss.getSheetByName('Manufaktur_BOM');
    const sheetProduksi = ss.getSheetByName('Produksi_Log');
    const sheetMutasi = ss.getSheetByName('Mutasi_Stok');
    const sheetJurnal = ss.getSheetByName('Jurnal_Umum');

    const kodeFG = payload.kodeBarangJadi;
    const qtyProduksi = Number(payload.jumlahProduksi);
    if (!qtyProduksi || qtyProduksi <= 0) throw new Error('Jumlah produksi harus lebih besar dari nol.');

    // 1. Ambil Resep BOM untuk Barang Jadi tersebut
    const allBOM = getSheetDataAsObjects('Manufaktur_BOM');
    const resep = allBOM.filter(b => b.KODE_BARANG_JADI === kodeFG);
    if (resep.length === 0) throw new Error('Resep Formula (BOM) belum ditentukan untuk barang ini.');

    // 2. Validasi Ketersediaan Stok Bahan Baku
    const allBarang = getSheetDataAsObjects('Master_Barang');
    const barangMap = {};
    const barangRowIndexMap = {};
    const barangValues = sheetBarang.getDataRange().getValues();
    for (let i = 1; i < barangValues.length; i++) {
      barangMap[barangValues[i][0]] = {
        nama: barangValues[i][1],
        stok: Number(barangValues[i][5]),
        hargaBeli: Number(barangValues[i][6])
      };
      barangRowIndexMap[barangValues[i][0]] = i + 1; // Baris di sheet
    }

    let totalBiayaMaterial = 0;
    const materialDeductions = [];

    for (const item of resep) {
      const kodeRM = item.KODE_BAHAN_BAKU;
      const kebutuhanPerUnit = Number(item.JUMLAH_KEBUTUHAN);
      const totalKebutuhan = kebutuhanPerUnit * qtyProduksi;

      const currentRM = barangMap[kodeRM];
      if (!currentRM) throw new Error('Bahan baku ' + kodeRM + ' tidak ditemukan di Master Barang.');
      if (currentRM.stok < totalKebutuhan) {
        throw new Error('Stok bahan baku ' + currentRM.nama + ' tidak mencukupi! Diperlukan: ' + totalKebutuhan + ', Tersedia: ' + currentRM.stok);
      }

      const biayaItem = totalKebutuhan * currentRM.hargaBeli;
      totalBiayaMaterial += biayaItem;

      materialDeductions.push({
        kode: kodeRM,
        nama: currentRM.nama,
        qty: totalKebutuhan,
        satuan: item.SATUAN,
        hargaBeli: currentRM.hargaBeli,
        totalBiaya: biayaItem
      });
    }

    const overheadUnit = Number(resep[0].OVERHEAD_PER_UNIT || 0);
    const totalOverhead = overheadUnit * qtyProduksi;
    const totalHPP = totalBiayaMaterial + totalOverhead;
    const hppPerUnit = totalHPP / qtyProduksi;

    const idProduksi = 'PRD-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmmss');
    const tgl = payload.tanggal || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');

    // 3. Potong Stok Bahan Baku di Master Barang & Catat Mutasi
    for (const ded of materialDeductions) {
      const rowIndex = barangRowIndexMap[ded.kode];
      const newStok = barangMap[ded.kode].stok - ded.qty;
      sheetBarang.getRange(rowIndex, 6).setValue(newStok); // Kolom 6 = STOK_SEKARANG

      sheetMutasi.appendRow([
        'MUT-' + Utilities.getUuid().substring(0, 8).toUpperCase(),
        tgl,
        ded.kode,
        ded.nama,
        'Keluar (Produksi)',
        ded.qty,
        ded.satuan,
        ded.hargaBeli,
        ded.totalBiaya,
        idProduksi
      ]);
    }

    // 4. Tambah Stok Barang Jadi di Master Barang & Update Rata-rata HPP
    const fgRowIndex = barangRowIndexMap[kodeFG];
    const currentFGStok = barangMap[kodeFG] ? barangMap[kodeFG].stok : 0;
    const newFGStok = currentFGStok + qtyProduksi;
    sheetBarang.getRange(fgRowIndex, 6).setValue(newFGStok);
    sheetBarang.getRange(fgRowIndex, 7).setValue(hppPerUnit); // Update HARGA_BELI_RATA2 (HPP)

    // 5. Catat Mutasi Masuk Barang Jadi
    sheetMutasi.appendRow([
      'MUT-' + Utilities.getUuid().substring(0, 8).toUpperCase(),
      tgl,
      kodeFG,
      payload.namaBarangJadi,
      'Masuk (Produksi)',
      qtyProduksi,
      payload.satuan || 'Pcs',
      hppPerUnit,
      totalHPP,
      idProduksi
    ]);

    // 6. Simpan Log Produksi
    sheetProduksi.appendRow([
      idProduksi,
      tgl,
      kodeFG,
      payload.namaBarangJadi,
      qtyProduksi,
      payload.satuan || 'Pcs',
      totalHPP,
      hppPerUnit,
      payload.penanggungJawab || (userActor ? userActor.nama : 'Mandor'),
      payload.catatan || 'Batch produksi selesai.'
    ]);

    // 7. Catat Jurnal Akuntansi (Debet: Persediaan FG, Kredit: Persediaan RM & Beban Overhead)
    sheetJurnal.appendRow(['JRN-' + Utilities.getUuid().substring(0, 8), tgl, idProduksi, '1-1007', 'Persediaan Barang Jadi (Finished Goods)', totalHPP, 0, 'Produksi ' + idProduksi]);
    sheetJurnal.appendRow(['JRN-' + Utilities.getUuid().substring(0, 8), tgl, idProduksi, '1-1006', 'Persediaan Bahan Baku (Raw Material)', 0, totalBiayaMaterial, 'Pengurangan Bahan Baku']);
    if (totalOverhead > 0) {
      sheetJurnal.appendRow(['JRN-' + Utilities.getUuid().substring(0, 8), tgl, idProduksi, '5-5002', 'Beban Upah & Overhead Produksi', 0, totalOverhead, 'Alokasi Overhead']);
    }

    logActivity(userActor ? userActor.id : 'PROD', userActor ? userActor.nama : 'Mandor', 'PRODUKSI_SELESAI', 'Memproduksi ' + qtyProduksi + ' unit ' + payload.namaBarangJadi + ' dengan HPP Rp ' + totalHPP);

    return createResponse(true, {
      idProduksi: idProduksi,
      totalHPP: totalHPP,
      hppPerUnit: hppPerUnit,
      newStokFG: newFGStok
    }, 'Eksekusi batch produksi berhasil! Stok bahan baku telah dipotong otomatis.');
  } catch (error) {
    return createResponse(false, null, 'Gagal memproses produksi: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * SIMPAN FAKTUR PENJUALAN PROYEK & KALKULASI MARGIN REAL-TIME
 * Mengurangi stok barang jadi, menghitung Gross Profit & % Margin per transaksi,
 * serta menerbitkan jurnal debet-kredit.
 */
function saveSalesInvoice(payload, userActor) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    const ss = getDatabase();
    const sheetInvoice = ss.getSheetByName('Penjualan_Invoice');
    const sheetBarang = ss.getSheetByName('Master_Barang');
    const sheetMutasi = ss.getSheetByName('Mutasi_Stok');
    const sheetJurnal = ss.getSheetByName('Jurnal_Umum');

    const noInvoice = payload.noInvoice || ('INV-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmm'));
    const tgl = payload.tanggal || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');
    const items = payload.items; // Array: [{kode, nama, qty, hargaJual, hpp, subtotal, subtotalHpp}]
    
    if (!items || items.length === 0) throw new Error('Daftar barang penjualan tidak boleh kosong.');

    let totalPenjualan = 0;
    let totalHPP = 0;

    // Ambil data stok barang
    const barangValues = sheetBarang.getDataRange().getValues();
    const barangRowIndexMap = {};
    const barangStokMap = {};
    for (let i = 1; i < barangValues.length; i++) {
      barangRowIndexMap[barangValues[i][0]] = i + 1;
      barangStokMap[barangValues[i][0]] = Number(barangValues[i][5]);
    }

    // Validasi dan kurangi stok barang jadi
    for (const item of items) {
      const lineTotal = Number(item.qty) * Number(item.hargaJual);
      const lineHPP = Number(item.qty) * Number(item.hpp);
      totalPenjualan += lineTotal;
      totalHPP += lineHPP;

      if (item.kode && barangRowIndexMap[item.kode]) {
        const rowIndex = barangRowIndexMap[item.kode];
        const currentStok = barangStokMap[item.kode] || 0;
        const newStok = currentStok - Number(item.qty);
        sheetBarang.getRange(rowIndex, 6).setValue(newStok);

        sheetMutasi.appendRow([
          'MUT-' + Utilities.getUuid().substring(0, 8).toUpperCase(),
          tgl,
          item.kode,
          item.nama,
          'Keluar (Jual)',
          item.qty,
          item.satuan || 'Unit',
          item.hpp,
          lineHPP,
          noInvoice
        ]);
      }
    }

    const labaKotor = totalPenjualan - totalHPP;
    const persenMargin = totalPenjualan > 0 ? ((labaKotor / totalPenjualan) * 100).toFixed(2) : 0;

    // Simpan Faktur Penjualan
    sheetInvoice.appendRow([
      noInvoice,
      tgl,
      payload.jatuhTempo || tgl,
      payload.pelanggan || 'Pelanggan Umum',
      JSON.stringify(items),
      totalPenjualan,
      totalHPP,
      labaKotor,
      persenMargin,
      payload.statusBayar || 'Lunas',
      payload.keterangan || '-'
    ]);

    // Catat Jurnal Akuntansi
    const kodeKasBank = payload.statusBayar === 'Lunas' ? (payload.kodeAkunKas || '1-1003') : '1-1005';
    const namaKasBank = payload.statusBayar === 'Lunas' ? 'Kas/Bank Penerimaan' : 'Piutang Usaha Proyek';

    sheetJurnal.appendRow(['JRN-' + Utilities.getUuid().substring(0, 8), tgl, noInvoice, kodeKasBank, namaKasBank, totalPenjualan, 0, 'Penjualan ' + noInvoice]);
    sheetJurnal.appendRow(['JRN-' + Utilities.getUuid().substring(0, 8), tgl, noInvoice, '4-4001', 'Pendapatan Penjualan', 0, totalPenjualan, 'Pendapatan ' + noInvoice]);
    sheetJurnal.appendRow(['JRN-' + Utilities.getUuid().substring(0, 8), tgl, noInvoice, '5-5001', 'Beban Pokok Produksi (HPP)', totalHPP, 0, 'Beban HPP ' + noInvoice]);
    sheetJurnal.appendRow(['JRN-' + Utilities.getUuid().substring(0, 8), tgl, noInvoice, '1-1007', 'Persediaan Barang Jadi', 0, totalHPP, 'Pengurangan Persediaan']);

    logActivity(userActor ? userActor.id : 'FINANCE', userActor ? userActor.nama : 'Admin', 'INVOICE_TERBIT', 'Menerbitkan ' + noInvoice + ' senilai Rp ' + totalPenjualan + ' (Margin ' + persenMargin + '%)');

    return createResponse(true, {
      noInvoice: noInvoice,
      totalPenjualan: totalPenjualan,
      totalHPP: totalHPP,
      labaKotor: labaKotor,
      persenMargin: persenMargin
    }, 'Faktur berhasil diterbitkan! Laba kotor tercatat Rp ' + labaKotor.toLocaleString('id-ID') + ' (' + persenMargin + '% Margin).');
  } catch (error) {
    return createResponse(false, null, 'Gagal menerbitkan faktur: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * PENCATATAN PEMBELIAN MATERIAL & BEBAN OPERASIONAL
 */
function savePurchaseExpense(payload, userActor) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getDatabase();
    const sheetBeli = ss.getSheetByName('Pembelian_Biaya');
    const sheetBarang = ss.getSheetByName('Master_Barang');
    const sheetMutasi = ss.getSheetByName('Mutasi_Stok');
    const sheetJurnal = ss.getSheetByName('Jurnal_Umum');

    const idBeli = 'BELI-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmm');
    const tgl = payload.tanggal || Utilities.formatDate(new Date(), 'GMT+7', 'yyyy-MM-dd');
    const totalNominal = Number(payload.nominal);

    sheetBeli.appendRow([
      idBeli,
      tgl,
      payload.pihak3 || 'Supplier',
      payload.kategori || 'Pengadaan Material',
      totalNominal,
      payload.metodeBayar || 'Transfer Bank',
      payload.status || 'Lunas',
      payload.keterangan || '-'
    ]);

    // Jika pembelian bahan baku spesifik, tambah stok & hitung average cost
    if (payload.kodeBarang) {
      const barangValues = sheetBarang.getDataRange().getValues();
      for (let i = 1; i < barangValues.length; i++) {
        if (barangValues[i][0] === payload.kodeBarang) {
          const oldStok = Number(barangValues[i][5]);
          const oldCost = Number(barangValues[i][6]);
          const addQty = Number(payload.qty);
          const newCost = Number(payload.hargaBeliSatuan);

          const newStok = oldStok + addQty;
          const newAvgCost = newStok > 0 ? (((oldStok * oldCost) + (addQty * newCost)) / newStok) : newCost;

          sheetBarang.getRange(i + 1, 6).setValue(newStok);
          sheetBarang.getRange(i + 1, 7).setValue(newAvgCost);

          sheetMutasi.appendRow([
            'MUT-' + Utilities.getUuid().substring(0, 8).toUpperCase(),
            tgl,
            payload.kodeBarang,
            barangValues[i][1],
            'Masuk (Beli)',
            addQty,
            barangValues[i][3],
            newCost,
            totalNominal,
            idBeli
          ]);
          break;
        }
      }
    }

    // Jurnal Akuntansi
    const debetAkun = payload.kodeBarang ? '1-1006' : (payload.kodeAkunBeban || '6-6002');
    const namaAkunDebet = payload.kodeBarang ? 'Persediaan Bahan Baku' : 'Beban Operasional';
    const kreditAkun = payload.status === 'Lunas' ? (payload.kodeAkunKas || '1-1003') : '2-2001';
    const namaAkunKredit = payload.status === 'Lunas' ? 'Kas / Rekening Bank' : 'Hutang Usaha Supplier';

    sheetJurnal.appendRow(['JRN-' + Utilities.getUuid().substring(0, 8), tgl, idBeli, debetAkun, namaAkunDebet, totalNominal, 0, payload.keterangan || 'Pembelian/Biaya']);
    sheetJurnal.appendRow(['JRN-' + Utilities.getUuid().substring(0, 8), tgl, idBeli, kreditAkun, namaAkunKredit, 0, totalNominal, payload.keterangan || 'Pembayaran/Hutang']);

    logActivity(userActor ? userActor.id : 'PROC', userActor ? userActor.nama : 'Admin', 'TRANSAKSI_BELI', 'Mencatat ' + payload.kategori + ' senilai Rp ' + totalNominal);

    return createResponse(true, { idBeli: idBeli }, 'Transaksi pengadaan/beban berhasil disimpan.');
  } catch (error) {
    return createResponse(false, null, 'Gagal menyimpan transaksi: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * SIMPAN ATAU PERBARUI FORMULA BOM (BILL OF MATERIALS)
 */
function saveBOMFormula(payload, userActor) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const ss = getDatabase();
    const sheetBOM = ss.getSheetByName('Manufaktur_BOM');
    const kodeFG = payload.kodeBarangJadi;
    const items = payload.items; // Array: [{kodeRM, namaRM, qty, satuan, overhead}]
    
    // Hapus resep lama untuk kodeFG ini jika ada
    const values = sheetBOM.getDataRange().getValues();
    for (let i = values.length - 1; i >= 1; i--) {
      if (values[i][1] === kodeFG) {
        sheetBOM.deleteRow(i + 1);
      }
    }

    const idBOM = 'BOM-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmm');
    const overhead = Number(payload.overhead || 0);

    for (const item of items) {
      sheetBOM.appendRow([
        idBOM,
        kodeFG,
        item.kodeRM,
        item.namaRM,
        Number(item.qty),
        item.satuan,
        overhead
      ]);
    }

    logActivity(userActor ? userActor.id : 'PROD', userActor ? userActor.nama : 'Admin', 'UPDATE_BOM', 'Memperbarui formula BOM untuk barang ' + kodeFG);

    return createResponse(true, { idBOM: idBOM }, 'Formula resep produksi (BOM) berhasil disimpan.');
  } catch (error) {
    return createResponse(false, null, 'Gagal menyimpan formula BOM: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * KELOLA MASTER PENGGUNA (TAMBAH / UPDATE / RESET PIN)
 */
function saveUserRecord(payload, userActor) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const ss = getDatabase();
    const sheet = ss.getSheetByName('Sys_Users');
    const values = sheet.getDataRange().getValues();
    
    const userId = payload.id || ('USR-' + Utilities.formatDate(new Date(), 'GMT+7', 'yyyyMMdd-HHmm'));
    let foundIndex = -1;

    for (let i = 1; i < values.length; i++) {
      if (values[i][0] === userId || (payload.email && values[i][2] === payload.email && !payload.id)) {
        foundIndex = i + 1;
        break;
      }
    }

    if (foundIndex > 0) {
      sheet.getRange(foundIndex, 2).setValue(payload.nama);
      sheet.getRange(foundIndex, 3).setValue(payload.email);
      sheet.getRange(foundIndex, 4).setValue(payload.role);
      if (payload.pin) sheet.getRange(foundIndex, 5).setValue(payload.pin);
      if (payload.status) sheet.getRange(foundIndex, 6).setValue(payload.status);
    } else {
      sheet.appendRow([
        userId,
        payload.nama,
        payload.email,
        payload.role,
        payload.pin || '123456',
        payload.status || 'Aktif'
      ]);
    }

    logActivity(userActor ? userActor.id : 'ADMIN', userActor ? userActor.nama : 'Admin', 'MANAJEMEN_USER', 'Memperbarui data pengguna: ' + payload.nama);

    return createResponse(true, { id: userId }, 'Data pengguna berhasil disimpan.');
  } catch (error) {
    return createResponse(false, null, 'Gagal menyimpan pengguna: ' + error.message);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Catat Log Aktivitas Audit
 */
function logActivity(userId, userNama, aksi, detail) {
  try {
    const ss = getDatabase();
    const sheet = ss.getSheetByName('Audit_Log');
    if (sheet) {
      sheet.appendRow([
        new Date().toISOString(),
        userId || 'ANONIM',
        userNama || 'Pengguna',
        aksi,
        detail
      ]);
    }
  } catch (e) {
    // Silent fail untuk log agar tidak mengganggu transaksi utama
  }
}

