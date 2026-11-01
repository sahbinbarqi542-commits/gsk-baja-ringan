/**
 * =========================================================================
 * GSK Migrasi Database Spreadsheet (gas-migrasi-database)
 * Berkas: backend/Migrasi.gs
 * Fungsi: Migrasi & Sinkronisasi Idempoten antar-Spreadsheet tanpa merusak data lama
 * =========================================================================
 */

/**
 * Buka Spreadsheet Sumber (Lama) secara Aman
 */
function openSourceSS_(sourceIdOrUrl) {
  const match = String(sourceIdOrUrl).match(/\/d\/([A-Za-z0-9_-]{20,})/);
  const id = match ? match[1] : String(sourceIdOrUrl).trim();
  
  const currentId = PropertiesService.getScriptProperties().getProperty('GSK_SPREADSHEET_ID');
  if (id === currentId) {
    throw new Error('ID Spreadsheet yang dimasukkan sama dengan Spreadsheet Target Baru. Masukkan ID Spreadsheet LAMA.');
  }
  
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    throw new Error('Gagal membuka Spreadsheet Sumber. Pastikan ID valid dan berada pada akun Google yang sama.');
  }
}

/**
 * Baca Seluruh Baris Sheet Sumber Berdasarkan Header Kolom
 */
function readSourceSheet_(sourceSS, sheetName) {
  const sheet = sourceSS.getSheetByName(sheetName);
  if (!sheet) return null;
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  const headers = values[0].map(String);
  
  return values.slice(1).filter(row => row.join('').trim() !== '').map(row => {
    const obj = {};
    headers.forEach((h, idx) => {
      if (h) obj[h.trim()] = row[idx];
    });
    return obj;
  });
}

/**
 * Mode Simulasi / Pindai (Dry-Run): Memeriksa jumlah data sebelum eksekusi migrasi nyata
 */
function dryRunMigrasiDatabase(sourceIdOrUrl) {
  try {
    const sourceSS = openSourceSS_(sourceIdOrUrl);
    const targetSS = getDatabase_();
    
    const sheetNames = ['Master_Barang', 'Manufaktur_BOM', 'Penjualan_Invoice', 'Sys_Users'];
    const hasilScan = {};

    sheetNames.forEach(name => {
      const sourceRows = readSourceSheet_(sourceSS, name);
      if (sourceRows === null) {
        hasilScan[name] = { status: 'Tidak ditemukan di spreadsheet lama', jumlah: 0 };
      } else {
        hasilScan[name] = { status: 'Siap dimigrasi', jumlahBaris: sourceRows.length };
      }
    });

    return {
      success: true,
      data: hasilScan,
      message: 'Pindaian simulasi berhasil. Tidak ada data yang diubah selama dry-run.'
    };
  } catch (error) {
    return { success: false, message: 'Gagal menjalankan simulasi migrasi: ' + error.message };
  }
}

/**
 * Eksekusi Migrasi & Sinkronisasi Idempoten (Delta-Sync)
 */
function eksekusiMigrasiDatabase(sourceIdOrUrl) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sourceSS = openSourceSS_(sourceIdOrUrl);
    const targetSS = getDatabase_();
    
    let totalMigrasi = 0;

    // 1. Migrasi Master Barang (Key: KODE_BARANG)
    const sourceBarang = readSourceSheet_(sourceSS, 'Master_Barang') || [];
    if (sourceBarang.length > 0) {
      const targetSheet = targetSS.getSheetByName('Master_Barang');
      const targetValues = targetSheet.getDataRange().getValues();
      const existingKeys = new Set(targetValues.slice(1).map(r => String(r[0])));
      
      const newRows = [];
      sourceBarang.forEach(item => {
        const kode = String(item.KODE_BARANG || '').trim();
        if (kode && !existingKeys.has(kode)) {
          newRows.push([
            kode,
            item.NAMA_BARANG || '',
            item.KATEGORI || 'Barang Jadi',
            item.SATUAN || 'Pcs',
            Number(item.STOK_MINIMAL) || 10,
            Number(item.STOK_SEKARANG) || 0,
            Number(item.HARGA_BELI_RATA2) || 0,
            Number(item.HARGA_JUAL_STANDAR) || 0
          ]);
          existingKeys.add(kode);
        }
      });

      if (newRows.length > 0) {
        targetSheet.getRange(targetValues.length + 1, 1, newRows.length, targetValues[0].length).setValues(newRows);
        totalMigrasi += newRows.length;
      }
    }

    // 2. Migrasi Riwayat Invoice (Key: NO_INVOICE)
    const sourceInvoices = readSourceSheet_(sourceSS, 'Penjualan_Invoice') || [];
    if (sourceInvoices.length > 0) {
      const targetSheet = targetSS.getSheetByName('Penjualan_Invoice');
      const targetValues = targetSheet.getDataRange().getValues();
      const existingInvoices = new Set(targetValues.slice(1).map(r => String(r[0])));

      const newInvRows = [];
      sourceInvoices.forEach(inv => {
        const no = String(inv.NO_INVOICE || '').trim();
        if (no && !existingInvoices.has(no)) {
          newInvRows.push([
            no,
            inv.TANGGAL || '',
            inv.JATUH_TEMPO || '',
            inv.PELANGGAN || 'Pelanggan',
            inv.ITEMS_JSON || '[]',
            Number(inv.TOTAL_PENJUALAN) || 0,
            Number(inv.TOTAL_HPP) || 0,
            Number(inv.LABA_KOTOR) || 0,
            Number(inv.PERSEN_MARGIN) || 0,
            inv.STATUS_BAYAR || 'Lunas',
            inv.KETERANGAN || 'Migrasi dari sistem lama'
          ]);
          existingInvoices.add(no);
        }
      });

      if (newInvRows.length > 0) {
        targetSheet.getRange(targetValues.length + 1, 1, newInvRows.length, targetValues[0].length).setValues(newInvRows);
        totalMigrasi += newInvRows.length;
      }
    }

    // Bersihkan cache agar data baru langsung terbaca
    CacheX.del('GSK_PUBLIC_CATALOG');

    return {
      success: true,
      message: 'Migrasi database berhasil diselesaikan! Sebanyak ' + totalMigrasi + ' rekaman baru telah ditambahkan secara aman.'
    };
  } catch (error) {
    return { success: false, message: 'Gagal eksekusi migrasi: ' + error.message };
  } finally {
    lock.releaseLock();
  }
}
