# PANDUAN LENGKAP IMPLEMENTASI & PENGGUNAAN
## Sistem Informasi Keuangan, Manufaktur Baja Ringan & ProductReceiver
### PT Griya Sultra Konstruksi (GSK)

Dokumen ini memandu Anda langkah demi langkah dalam memasang, menyebarkan (*deploy*), dan mengoperasikan aplikasi pabrik baja ringan GSK, baik menggunakan **Arsitektur Decoupled (GitHub Pages + REST API GAS)** maupun **Aplikasi Mandiri (GAS Web App)**.

---

## 📑 DAFTAR ISI
1. [Arsitektur & Pilihan Deployment](#1-arsitektur--pilihan-deployment)
2. [Tahap 1: Setup Backend REST API (Google Apps Script)](#tahap-1-setup-backend-rest-api-google-apps-script)
3. [Tahap 2: Menghubungkan Frontend ke Backend](#tahap-2-menghubungkan-frontend-ke-backend)
4. [Tahap 3: Deploy Frontend ke GitHub Pages (Terminal Git)](#tahap-3-deploy-frontend-ke-github-pages-terminal-git)
5. [Panduan Operasional Fitur Pabrik Baja Ringan](#panduan-operasional-fitur-pabrik-baja-ringan)
6. [Daftar Akun Pengguna & PIN Keamanan Default](#daftar-akun-pengguna--pin-keamanan-default)
7. [Panduan Utilitas Migrasi Database (Migrasi.gs)](#panduan-utilitas-migrasi-database-migrasigs)

---

## 1. Arsitektur & Pilihan Deployment

Aplikasi ini telah disiapkan dalam 2 varian yang fleksibel:

| Varian | Lokasi File | Keunggulan Utama |
| :--- | :--- | :--- |
| **Varian A (Rekomendasi Utama: Decoupled)** | Folder `frontend/` & `backend/` | Frontend di **GitHub Pages** (sangat cepat, nama domain rapi, SEO sempurna) + Backend di **Google Apps Script** sebagai REST API JSON murni (`gas-pro-api`). Bebas iframe. |
| **Varian B (Aplikasi Standalone GAS)** | Berkas `Index.html` & `Kode.gs` di root folder | Berjalan 100% di dalam Google Workspace (*HtmlService*), cocok untuk portal kerja internal tim tanpa perlu akun GitHub. |

---

## Tahap 1: Setup Backend REST API (Google Apps Script)

Langkah ini menyiapkan Google Spreadsheet, folder Google Drive, formula resep roll-forming baja ringan, dan token keamanan Script Properties secara otomatis:

1. **Buka Google Spreadsheet Baru**:
   * Buka browser dan kunjungi [sheets.new](https://sheets.new) (atau buat Google Spreadsheet baru di Google Drive Anda).
   * Beri nama spreadsheet: `GSK_Database_Keuangan_Manufaktur`.
2. **Buka Editor Apps Script**:
   * Pada menu atas spreadsheet, klik **Ekstensi** $\rightarrow$ **Apps Script**.
3. **Salin Berkas Backend**:
   * Pada file bawaan `Code.gs`, hapus semua isinya lalu salin seluruh isi berkas [backend/Kode.gs](file:///c:/Users/Digitalisasi/Documents/APLIKASI%20WEB%20SAHBIN/ANTI%20GRAVITY/APK%20KEUANGAN/backend/Kode.gs).
   * Buat file skrip baru dengan menekan tanda `+` di samping File $\rightarrow$ pilih **Script** $\rightarrow$ beri nama `Migrasi` $\rightarrow$ salin seluruh isi berkas [backend/Migrasi.gs](file:///c:/Users/Digitalisasi/Documents/APLIKASI%20WEB%20SAHBIN/ANTI%20GRAVITY/APK%20KEUANGAN/backend/Migrasi.gs).
4. **Jalankan Inisialisasi Otomatis (Auto-Setup)**:
   * Pada dropdown fungsi di bagian atas editor, pilih fungsi: **`setupAppEnvironment`**.
   * Klik tombol **Jalankan (Run)**.
   * Muncul jendela izin Google: klik *Review Permissions* $\rightarrow$ pilih Akun Google Anda $\rightarrow$ klik *Advanced* $\rightarrow$ klik *Go to (Untitled project) (unsafe)* $\rightarrow$ klik *Allow*.
   * Tunggu beberapa detik hingga muncul pesan *"Execution completed"*. Seluruh sheet database (`Sys_Settings`, `Sys_Users`, `Master_Barang`, `Manufaktur_BOM`, `Produksi_Log`, `Penjualan_Invoice`, dll.) otomatis selesai dibuat dengan data formula baja ringan.
5. **Deploy sebagai Web App (REST API)**:
   * Klik tombol biru **Terapkan (Deploy)** di kanan atas $\rightarrow$ pilih **Penerapan Baru (New Deployment)**.
   * Klik ikon gerigi (roda gigi) di kiri atas $\rightarrow$ pilih **Aplikasi Web (Web App)**.
   * Isi konfigurasi wajib:
     * **Deskripsi:** `GSK REST API Production v2`
     * **Jalankan sebagai (Execute as):** `Saya (email Google Anda)`
     * **Siapa yang memiliki akses (Who has access):** `Siapa saja (Anyone)` *(Wajib agar form pemesanan pelanggan & frontend GitHub Pages dapat berkomunikasi)*.
   * Klik **Terapkan (Deploy)**.
   * **SALIN URL APLIKASI WEB** yang muncul (URL panjang yang berakhiran `/exec`). Simpan URL ini untuk Tahap 2.

---

## Tahap 2: Menghubungkan Frontend ke Backend

1. Buka berkas konfigurasi frontend di laptop Anda:
   [frontend/js/config.js](file:///c:/Users/Digitalisasi/Documents/APLIKASI%20WEB%20SAHBIN/ANTI%20GRAVITY/APK%20KEUANGAN/frontend/js/config.js).
2. Ganti URL contoh pada baris `GAS_URL` dengan URL Web App asli yang Anda salin pada Tahap 1:
   ```javascript
   const CONFIG = {
     GAS_URL: 'https://script.google.com/macros/s/AKfycb...URL_ASLI_DARI_TAHAP_1.../exec',
     APP_NAME: 'GSK Financial & Manufacturing ERP',
     VERSION: '2.0-PRO'
   };
   ```
3. Simpan file (`Ctrl + S`).

---

## Tahap 3: Deploy Frontend ke GitHub Pages (Terminal Git)

Ikuti panduan terminal ramah pemula di bawah ini untuk menerbitkan Landing Page & ProductReceiver ke internet secara gratis:

1. **Buka Terminal / PowerShell di Folder Frontend**:
   Buka PowerShell, lalu arahkan ke folder `frontend`:
   ```powershell
   cd "c:\Users\Digitalisasi\Documents\APLIKASI WEB SAHBIN\ANTI GRAVITY\APK KEUANGAN\frontend"
   ```
2. **Inisialisasi Git Lokal**:
   ```bash
   git init
   git add .
   git commit -m "Peluncuran Perdana Landing Page & ProductReceiver GSK Baja Ringan"
   ```
3. **Buat Repositori di GitHub**:
   * Buka [github.com/new](https://github.com/new).
   * Isi nama repositori, misalnya: `gsk-baja-ringan`.
   * Pilih opsi **Public** *(wajib agar fitur GitHub Pages gratis aktif)*.
   * Jangan centang "Add a README file".
   * Klik tombol hijau **Create repository**.
4. **Hubungkan & Unggah (*Push*) Kode**:
   Jalankan perintah berikut di PowerShell Anda (ganti `USERNAME-ANDA` dengan username GitHub Anda):
   ```bash
   git branch -M main
   git remote add origin https://github.com/USERNAME-ANDA/gsk-baja-ringan.git
   git push -u origin main
   ```
5. **Aktifkan GitHub Pages**:
   * Masuk ke repositori Anda di situs GitHub.
   * Klik tab **Settings** (ikon gerigi di atas).
   * Pada menu bilah kiri, klik **Pages**.
   * Pada bagian **Branch**, pilih branch: `main` dan folder: `/ (root)`.
   * Klik **Save**.
   * Tunggu sekitar 1–2 menit, halaman web publik Anda akan aktif di:
     `https://USERNAME-ANDA.github.io/gsk-baja-ringan/`

---

## Panduan Operasional Fitur Pabrik Baja Ringan

### 1. Penerimaan Pesanan Proyek (Engine ProductReceiver)
* **Pengguna:** Klien luar, aplikator baja ringan, toko bangunan, atau mandor lapangan.
* **Cara Kerja:** 
  1. Pelanggan membuka website publik pada seksi **Pemesanan Material Proyek (ProductReceiver)**.
  2. Pelanggan memilih produk (Kanal C 75.75, Reng 30.45, Spandek 0.30mm), mengisikan volume (misal: 250 Batang), kontak WhatsApp, dan alamat drop material proyek.
  3. Saat tombol kirim ditekan, pesanan langsung tersimpan ke lembar database Google Sheets `Pesanan_Masuk` dan memicu notifikasi antrean pengiriman.

### 2. Eksekusi Produksi Roll-Forming & Potong Stok Otomatis
* **Menu:** *Produksi & Resep Formula (BOM)*
* **Cara Kerja:**
  1. Mandor/Staf memilih produk jadi yang akan diproduksi (contoh: *Kanal C 75.75 SNI*).
  2. Masukkan target produksi, misalnya: `200 Batang`.
  3. Kotak pratinjau formula BOM otomatis menampilkan:
     * Kebutuhan bahan baku: $\pm 770$ Kg Coil Galvalum 0.75mm.
     * Cek ketersediaan stok coil di gudang (aman / tidak cukup).
     * Estimasi total HPP (harga coil + overhead listrik/operator).
  4. Klik **Eksekusi & Potong Stok Bahan**. Sistem otomatis memotong stok coil galvalum di kartu stok, menambah 200 batang stok Kanal C jadi, dan mencatat jurnal debet-kredit.

### 3. Pembuatan Faktur Penjualan & Kalkulator Margin Real-Time
* **Menu:** *Penjualan & Faktur Proyek*
* **Cara Kerja:**
  1. Pilih produk baja ringan yang dijual dan masukkan volume pesanan.
  2. Saat memasukkan harga jual, kotak **Kalkulator Margin Real-Time** langsung menghitung:
     * Total Penjualan (Omzet)
     * Total HPP Produksi
     * Estimasi Laba Kotor (Rp)
     * Persentase Margin Keuntungan (% Margin)
  3. Jika margin di atas target perusahaan (>25%), muncul lencana hijau *Sehat*.
  4. Simpan faktur: stok barang jadi otomatis berkurang dan piutang/kas tercatat.
  5. Klik tombol **Cetak** untuk memunculkan cetak faktur resmi ber-QR Code validasi keaslian dokumen GSK.

### 4. Mengubah Logo & Profil Perusahaan
* **Menu:** *Portal Admin & Logo*
* **Cara Kerja:**
  1. Klik tombol emas **Menu Admin** di navbar atas.
  2. Pada seksi *Kustomisasi Logo*, klik *Pilih File Logo Baru* (PNG/JPG/SVG).
  3. Anda dapat meninjau pratinjau langsung logo pada latar terang dan gelap.
  4. Klik **Simpan Profil & Terapkan Logo**.
  5. Logo baru seketika tersinkronisasi ke seluruh layar: Navbar atas, kartu login, kop surat faktur PDF resmi, dan laporan keuangan.

---

## Daftar Akun Pengguna & PIN Keamanan Default

Sistem dilengkapi proteksi bertingkat berbasis peran (*Role-Based Access Control*):

| Nama Akun | Email Login | Hak Akses Utama | PIN Bawaan |
| :--- | :--- | :--- | :---: |
| **Super Admin IT** | `admin@gsk.id` | Akses tak terbatas, reset PIN, pengaturan COA, ganti logo | `123456` |
| **Direktur Utama GSK** | `direktur@gsk.id` | Analisis margin, laporan laba rugi, kontrol HPP | `123456` |
| **Admin Keuangan** | `keuangan@gsk.id` | Input faktur penjualan, tagihan supplier, cetak kwitansi | `123456` |
| **Mandor Pabrik & Gudang** | `gudang@gsk.id` | Eksekusi produksi BOM, mutasi stok coil & barang jadi | `123456` |

> *Catatan Keamanan: PIN dapat diganti kapan saja melalui Portal Admin atau langsung di sheet `Sys_Users`.*

---

## Panduan Utilitas Migrasi Database (Migrasi.gs)

Jika Anda memiliki data dari spreadsheet versi lama yang ingin disinkronkan ke sistem baru tanpa merusak database lama:

1. Buka editor Apps Script.
2. Buka berkas `Migrasi.gs`.
3. **Langkah 1 (Simulasi / Dry-Run):**
   * Jalankan fungsi:
     ```javascript
     dryRunMigrasiDatabase('ID_SPREADSHEET_LAMA_ANDA');
     ```
   * Periksa log eksekusi (*Execution log*). Sistem akan menghitung berapa baris data barang dan faktur yang siap dipindahkan tanpa mengubah data apa pun.
4. **Langkah 2 (Eksekusi Idempoten):**
   * Jalankan fungsi:
     ```javascript
     eksekusiMigrasiDatabase('ID_SPREADSHEET_LAMA_ANDA');
     ```
   * Data dipindahkan berbasis nama header kolom. Data yang sudah ada tidak akan diduplikasi (*idempotent upsert*).
