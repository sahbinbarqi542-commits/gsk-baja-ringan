# Product Requirements Document (PRD)
## Sistem Informasi Akuntansi, Manufaktur & Manajemen Margin â€” GSK (Griya Sultra Konstruksi)

---

### 1. Judul & Ringkasan Eksekutif
* **Nama Produk:** GSK Financial & Manufacturing System (Sistem Keuangan & Manufaktur Griya Sultra Konstruksi)
* **Kategori:** Web Application (Single Page Application - SPA) berbasis Google Apps Script (GAS) & Google Sheets Database.
* **Inspirasi Sistem:** Modul Terpadu ala Accurate Online/Desktop yang disesuaikan untuk karakteristik industri konstruksi & manufaktur baja ringan & rangka atap.
* **Ringkasan:** Aplikasi web internal yang mengintegrasikan pencatatan kas/bank, penjualan proyek, pengadaan material, persediaan barang manufaktur (Bahan Baku $\rightarrow$ Proses Produksi $\rightarrow$ Barang Jadi), perhitungan otomatis Harga Pokok Produksi (HPP), analisis laba kotor/margin per transaksi secara real-time, serta pelaporan margin bulanan dan tahunan yang dilengkapi Portal Admin terdedikasi.

---

### 2. Tujuan Produk & Nilai Bisnis
1. **Efisiensi Biaya Operasional:** Menghadirkan sistem ERP/Akuntansi setara Accurate tanpa beban biaya langganan bulanan (*zero license fee*), dengan keandalan Google Cloud Infrastructure.
2. **Presisi HPP & Stok Manufaktur:** Mengeliminasi selisih stok material konstruksi melalui formula resep produksi (*Bill of Materials* / BOM) dan kartu stok otomatis.
3. **Visibilitas Margin Real-Time:** Memberikan gambaran keuntungan langsung pada setiap faktur transaksi, performa laba bulanan (*Month-over-Month*), serta evaluasi tahunan (*Year-over-Year*) bagi pengambil keputusan.
4. **Keamanan & Tata Kelola Data:** Mengamankan data sensitif keuangan melalui Portal Admin dan pembagian peran bertingkat (RBAC).

---

### 3. Pengguna Target & Matriks Hak Akses (RBAC)

| Peran (Role) | Target Pengguna | Hak Akses & Kewenangan |
| :--- | :--- | :--- |
| **Super Admin / Portal Admin** | IT / Direktur Utama | Mengelola seluruh akun pengguna, reset PIN/sandi, konfigurasi Master COA, pengaturan profil perusahaan GSK, backup database, dan inspeksi log audit. |
| **Owner / Direktur** | Jajaran Direksi GSK | Akses penuh dashboard keuangan, analitik margin (per transaksi, bulanan, tahunan), laporan Laba Rugi, Neraca, dan persetujuan pengeluaran besar. |
| **Admin Keuangan & Penjualan** | Staf Finance / Akunting | Input invoice penjualan/proyek, pencatatan kas/bank masuk & keluar, monitoring piutang jatuh tempo, verifikasi nota, dan cetak invoice/kwitansi. |
| **Staf Gudang & Produksi** | Mandor / Operator Gudang | Input mutasi penerimaan material, input eksekusi perintah produksi (BOM), monitoring kartu stok & alert minimum stok material. *(Dibatasi: Tidak dapat melihat saldo kas/bank dan margin keuntungan).* |

---

### 4. Arsitektur Data & Integrasi Ekosistem Google Workspace

#### A. Skema Google Sheets (Database Inti)
1. **`Sys_Users`**: `user_id`, `nama`, `email`, `role`, `pin_hash`, `salt`, `status_aktif`, `last_login`.
2. **`Sys_Settings`**: `setting_key` (`company_name`, `company_logo_drive_id`, `company_logo_base64`, `company_address`, `company_phone`, `company_npwp`, `default_currency`), `setting_value`, `updated_at`, `updated_by`.
3. **`Master_COA`**: `kode_akun`, `nama_akun`, `kategori` (Aset Lancar, Kas/Bank, Piutang, Persediaan, Hutang, Modal, Pendapatan, HPP, Beban Ops), `saldo_normal` (D/K).
3. **`Master_Barang`**: `kode_barang`, `nama_barang`, `kategori` (Bahan Baku / Barang Jadi / Jasa Proyek), `satuan` (M3, Zak, Batang, Pcs), `stok_minimal`, `harga_beli_avg`, `harga_jual_standar`.
4. **`Manufaktur_BOM`**: `id_bom`, `kode_barang_jadi`, `kode_bahan_baku`, `jumlah_kebutuhan`, `satuan`, `biaya_overhead_standar`.
5. **`Produksi_Log`**: `id_produksi`, `tanggal`, `kode_barang_jadi`, `jumlah_dihasilkan`, `total_hpp`, `hpp_per_unit`, `pj_produksi`, `status`.
6. **`Mutasi_Stok`**: `id_mutasi`, `tanggal`, `kode_barang`, `tipe_transaksi` (Beli/Masuk, Produksi/Keluar, Penjualan/Keluar, Opname), `qty`, `hpp_satuan`, `total_nilai`, `referensi_dokumen`.
7. **`Penjualan_Invoice`**: `no_invoice`, `tanggal`, `jatuh_tempo`, `pelanggan`, `total_penjualan`, `total_hpp`, `margin_nominal`, `margin_persen`, `status_bayar` (Lunas/Piutang), `file_kwitansi_drive`.
8. **`Pembelian_Biaya`**: `id_transaksi`, `tanggal`, `supplier`, `kategori_beban`, `nominal`, `kode_kasbank`, `status_hutang`, `file_nota_drive`.
9. **`Jurnal_Umum`**: `id_jurnal`, `tanggal`, `no_referensi`, `kode_akun`, `debet`, `kredit`, `keterangan`.
10. **`Audit_Log`**: `timestamp`, `user_id`, `aksi`, `modul`, `detail_perubahan`.

#### B. Integrasi Ekosistem Google
* **Google Drive:** Penyimpanan berkas digital secara otomatis (folder nota fisik material, bukti transfer bank, dan arsip PDF kwitansi) dengan tautan terenkripsi.
* **HTML Service & Canvas PDF:** Pembuatan invoice, faktur jalan, dan kwitansi berformat standar resmi GSK dengan QR Code verifikasi dokumen.

---

### 5. Persyaratan Fungsional

#### Modul 1: Portal Admin & Manajemen Sistem
* Manajemen pengguna terpusat (tambah/edit/nonaktifkan user, set peran, reset PIN).
* **Kustomisasi Identitas & Logo Perusahaan (Dapat Diedit Langsung):**
  * Fitur unggah/ganti logo perusahaan GSK via file upload (kamera/galeri) atau tautan URL gambar.
  * Logo tersimpan otomatis di Google Drive / Script Properties aplikasi.
  * Pratinjau langsung (*Live Preview*) saat ganti logo sebelum disimpan.
  * Logo yang diperbarui akan otomatis tersinkronisasi ke:
    - Layar Login & Autentikasi.
    - Header Sidebar & Navbar seluruh modul aplikasi.
    - Kop Surat resmi Invoice Penjualan, Kwitansi Pembayaran, dan Surat Jalan PDF.
    - Laporan Keuangan resmi (Laba Rugi, Neraca, Buku Besar).
* Pengaturan Master Data: Bagan Akun (COA), informasi kontak perusahaan (alamat, telepon, email, NPWP), dan rekening bank penampung.
* Audit Trail log aktivitas untuk transparansi transaksi (mencatat siapa dan kapan perubahan logo/data dilakukan).

#### Modul 2: Manufaktur & Pengendalian Persediaan Stok
* Form *Bill of Materials* (BOM): Formula resep komposisi material konstruksi.
* Form Perintah Produksi & Penyelesaian:
  * Sekali klik: Sistem otomatis memotong stok bahan baku sesuai formula BOM.
  * Menghitung total nilai HPP (material + overhead).
  * Menambah stok barang jadi dengan nilai HPP yang telah dikalkulasi.
* Kartu Stok (*Stock Card*) dengan pelacakan mutasi masuk, keluar, dan sisa.
* Fitur Peringatan Dini (*Minimum Stock Alert*) saat stok material utama menipis.

#### Modul 3: Penjualan Proyek & Analisis Margin Transaksi
* Pembuatan Faktur Proyek / Invoice Penjualan multi-item.
* Kalkulator Margin Instan: Menampilkan Laba Kotor (Rp) dan Persentase Margin (%) langsung saat invoice dirancang sebelum disimpan.
* Pelacakan umur piutang (*Aging Receivables*) dan status pelunasan bertahap.
* Cetak Invoice dan Kwitansi ber-QR Code keaslian dokumen.

#### Modul 4: Pengadaan & Hutang Usaha
* Pencatatan pembelian material konstruksi (Coil Galvalum/Zincalume G550, baut roofing, pelapis, dll).
* Kontrol jatuh tempo hutang supplier & pencatatan bukti nota fisik via upload foto kamera/file.

#### Modul 5: Analisis Eksekutif & Laporan Margin Keuangan
* **Margin Bulanan:** Visualisasi tren laba rugi dan persentase margin dari bulan Januari hingga Desember.
* **Margin Tahunan:** Perbandingan performa tahun berjalan (*Year-to-Date*) terhadap tahun-tahun sebelumnya.
* **Laporan Standar Akuntansi:** Laporan Laba Rugi Komprehensif, Neraca Sederhana, Laporan Arus Kas, dan Neraca Saldo.
* **Ekspor Data:** Dukungan ekspor laporan ke format Excel/CSV dan siap cetak/PDF.

---

### 6. Batasan Teknis & Mitigasi Kuota GAS

1. **Batas Eksekusi 6 Menit:**
   * Seluruh kalkulasi HPP dan agregasi margin dilakukan secara *batch* di memori script sebelum disimpan. Tidak ada looping `getValue()` / `setValue()` baris per baris.
2. **Payload POST & Kuota Upload:**
   * Pengunggahan foto nota dan bukti transfer dikompresi di sisi browser (*client-side canvas compression*) sebelum dikirim ke Google Apps Script untuk disimpan di Google Drive.
3. **Optimasi Performa & Latensi:**
   * Menggunakan arsitektur Single Page Application (SPA) responsif tanpa reload halaman.
   * Caching data master (COA, Katalog Barang, Profil) di *LocalStorage* browser agar aplikasi berjalan instan.

---

### 7. Spesifikasi Tampilan & Antarmuka (UI/UX)

* **Tema Visual:** *Modern Industrial & Corporate Construction*.
* **Palet Warna:**
  * **Primary (Dominan):** Deep Navy (`#0F172A` / `#1E293B`) mencerminkan stabilitas, presisi finansial, dan integritas.
  * **Secondary / Accent:** Safety Industrial Orange / Amber Gold (`#F59E0B` / `#D97706`) mencerminkan energi konstruksi dan manufaktur.
  * **Status Margin:** Emerald Green (`#10B981`) untuk margin sehat, Crimson Red (`#EF4444`) untuk defisit/beban kritis.
  * **Background & Surface:** Slate Light (`#F8FAFC`) untuk mode terang dengan dukungan opsional *Dark Mode* (`#0B0F19`).
* **Tipografi:** Inter / Plus Jakarta Sans (bersih, terbaca sangat jelas pada angka-angka finansial).
* **Komponen Visual:**
  * Kartu Ringkasan Metrik (KPI Cards) dengan indikator pertumbuhan margin.
  * Grafik interaktif (Chart.js): Diagram Batang Gabungan (Omzet vs HPP vs Laba Bersih) dan Garis Tren Margin %.
  * Tabel Data Responsif dengan kolom pencarian cepat, filter status, dan pagination.

---

### 8. Rencana Deployment & Tahapan Pengujian

1. **Fase 1: Setup Spreadsheet & Master Data:**
   * Pembuatan lembar kerja dengan header baku dan formula otomatis.
2. **Fase 2: Implementasi Backend GAS (Kode.gs):**
   * Endpoint RESTful internal (`doGet`, `doPost`), logic HPP manufaktur, kalkulator margin, dan autentikasi session.
3. **Fase 3: Implementasi Frontend SPA (HTML/CSS/JS):**
   * Pembangunan Portal Admin, Dashboard Analitik, Form Transaksi, Modul Manufaktur, dan View Laporan.
4. **Fase 4: Pengujian & Validasi Bisnis (UAT):**
   * Uji coba input resep BOM dan verifikasi akurasi pemotongan stok.
   * Uji coba simulasi penjualan dan verifikasi akurasi persentase margin.
   * Uji coba isolasi hak akses (staf gudang vs direktur vs admin).

---
ðŸŽ¨ **Tahapan Khusus: Penentuan Visual UI/UX**
1. Unggah Referensi: Silakan unggah referensi tangkapan layar, warna, dan gaya antarmuka yang diinginkan.
2. Jika Belum Ada Referensi Visual:
   - Salin seluruh teks dokumen PRD Final di atas.
   - Buka Google Stitch, lalu tempelkan teks PRD ke dalamnya.
   - Unduh hasil pratinjau desain visual yang dihasilkan oleh Google Stitch.
   - Unggah gambar hasil desain tersebut ke percakapan ini untuk diimplementasikan ke dalam kode HTML/CSS.

