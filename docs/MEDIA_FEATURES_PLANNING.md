# Fitur Media Terpadu RAMEDIA (Konsep & Spesifikasi)

## 1. Analisis Kompetitor (ProPresenter, EasyWorship, Resolume)
Aplikasi standar industri memiliki ekosistem manajamen **Media** (Video, Image, Audio) yang canggih yang dibagi menjadi dua jenis prioritas (*Foreground* dan *Background*). 

Berikut adalah rangkuman fitur-fitur wajib yang mereka miliki:
*   **Media Inspector (ProPresenter)**: Fasilitas klik kanan pada video untuk mengubah properti pemutaran secara non-destruktif tanpa mengedit file aslinya.
*   **Marking (In/Out Point)**: Menentukan dari detik ke berapa video akan mulai diputar (In-point) dan di detik berapa akan berhenti (Out-point).
*   **End Behavior**: Aturan saat video berakhir (*Looping* ke awal, *Fade to Black*, *Hold on Last Frame*, atau memicu *Go to Next Slide*).
*   **Scaling Options (Aspek Rasio)**: *Scale to Fill/Cover* (Memenuhi bingkai layar walau terpotong), *Scale to Fit/Contain* (Sempurna proporsinya walau bergaris hitam di tepi layar), dan *Stretch* (Ditarik paksa untuk layar P10 LED lebar).
*   **Audio Routing**: Meredam (Mute) audio yang tertanam di dalam klip background lirik agar tidak bocor ke output *soundcard*, namun membuka volumernya jika video tayang sebagai konten utama (*standalone*).

---

## 2. Rencana Eksekusi Fitur Media di RAMEDIA

Berdasarkan *request* Anda terkait *Marking Preview* (pemotongan durasi khusus schedule), ini adalah desain fitur yang sangat mungkin untuk diterapkan secara elegan di React & Electron.

### A. Fitur "Media Inspector" & Marking (In/Out)
*   **Mekanisme UI**: Thumbnail video di **Media Library** (atau item Schedule) akan memiliki tombol pengaturan. Saat dibuka, akan muncul *Modal Video Player*.
*   **Trim Slider (Range Slider)**: Di bawah video *preview* terdapat dua buah tuas (tuas kiri dan tuas kanan). Anda bisa menarik tuas kiri ke `00:15` (masuk) dan tuas kanan ke `00:45` (keluar).
*   **Sistem Non-Destruktif**: RAMEDIA tidak akan me-render atau meng-convert ulang file video MP4 tersebut (menghemat CPU). Melainkan, RAMEDIA hanya mencatat properti (metadata) ini di database tabel Media. 

### B. Playback Config (Pengaturan Pemutaran)
Nantinya, setiap video memiliki metadata seperti berikut:
*   **Playback Rate**: Mengatur laju pemutaran (Misal `0.5x` untuk *slow-motion loop* yang apik di layar latar lirik ibadah).
*   **Audio Volume**: *Muted* atau persentase Volume dari `0-100%`.
*   **Behavior (saat mencapai titik Out)**: Ada Opsi dropdown `Loop`, `Stop`, atau `Next`.

### C. Implementasi di Output Stage
Saat video di-*Push* ke Layar Output, React Video DOM akan dengan cerdas mengeksekusinya:
```javascript
// Konsep code di belakang layar:
useEffect(() => {
   if (video) {
       video.currentTime = startTime; // Lompat langsung ke detik In-Point (00:15)
       video.play();
   }
}, [video])

// Event listener di komponen video
const handleTimeUpdate = (e) => {
   if (e.target.currentTime >= endTime) { // Saat menyentuh detik Out-Point (00:45)
       if (behavior === 'loop') e.target.currentTime = startTime;
       if (behavior === 'stop') e.target.pause();
   }
}
```
}
```

### D. Arsitektur Penyimpanan Media (Managed Folder)
Alih-alih hanya mencatat/me-*link* jalur file (seperti `Downloads/video.mp4`) yang rentan rusak jika terhapus (Media Not Found), RAMEDIA akan mengadopsi standar industri:
*   **Auto-Copy ke Managed Directory**: Saat user meng-import via *File Open Dialog*, RAMEDIA (lewat layer Electron `fs.copyFileSync`) akan langsung mereplikasi/mengkopi file tersebut ke brankas internal `~/.ramedia/assets/media/`.
*   **Reliability 100%**: File yang di-*push* ke layar akan terjamin selalu ada dan tidak akan putus sekalipun pengguna mencabut Flashdisk atau membersihkan folder letak file video asli.
*   **Portabilitas**: Mudah di-*bundle* (*Export Package*) jika ibadah ingin dipindahkan ke komputer lain utuh berserta videonya.

### E. Utilitas "Media Cleanup" (Pembersih File Yatim Piatu)
Kekurangan dari metode "Copy ke Managed Folder" adalah kapasitas Hard-disk (*Storage*) sisa yang terus terkuras seiring waktu. Untuk menyelesaikannya wajib ada fitur tombol khusus di halaman **Settings**:
*   **Scanning Pintar**: Algoritma akan menelusuri seluruh baris database SQLite (Song, Template, Schedule) untuk mendata video mana yang *sedang* digunakan.
*   **Deteksi File Yatim Piatu (Orphaned Media)**: File yang menganggur dan tidak pernah terhubung dengan *Lirik* atau *Rundown* apa pun akan otomatis terdeteksi.
*   **One-Click Purge**: Muncul popup *"Ditemukan 15 media seberat 3 GB yang tidak terpakai"* lalu dengan satu klik, RAMEDIA akan menghapus fisik video-video tersebut secara permanen untuk melegakan SSD pengguna.

---

## 3. Rencana Penyesuaian Database Modul Media (Schema)

Untuk menampung ide brilian ini, kita akan menambahkan opsi JSON ke dalam *Media service* kita, lebih tepatnya di properti bawaan `media` dan menempelkannya jika item tersebut dikirim ke `schedule_items`.

**Struktur JSON Playback Settings (yang akan disisipkan via Database):**
```json
{
  "playback": {
    "startTime": 15.2,     
    "endTime": 45.0,       
    "behavior": "loop",    // "loop" | "stop" | "hold" | "next"
    "scaling": "cover",    // "cover" | "contain" | "fill"
    "volume": 0.0,         
    "speed": 1.0           
  }
}
```

## 4. Workaround Langkah Berikutnya
Jika kita memilih untuk mengembangkan jalan ini, urutan pengembangan selanjutnya adalah:
1.  **Membuka Modul Media Sesungguhnya:** Mengubah fungsi simulasi *Fake Media* di tombol `[+] Import Media` dengan fungsi Electron Dialog `showOpenDialog` sesungguhnya agar mengkopi MP4/JPG lokal ke `/AppData/` dari OS Anda.
2.  **Pembuatan Media Inspector Modal**: Membuat UI Popup Video Player yang dilengkapi tombol *Seekbar In & Out Point*.
3.  **Pengikat Output**: Meneruskan konfigurasi In/Out ini ke `SlideRenderer` sehingga ketika di klik ganda (*Push*) pada Controller, maka videonya mematuhi batasan *Trim* virtual tersebut.
