# RAMEDIA Audio Module

## 1. Tujuan

Dokumen ini mendefinisikan modul **Audio** sebagai modul terpisah dari **Media visual** di RAMEDIA.

Tujuan utamanya:

- Menangani file audio seperti `mp3`, `wav`, dan `ogg` dengan workflow yang memang cocok untuk audio.
- Menghindari pemaksaan audio ke model kerja slide visual.
- Memberikan kontrol operator yang cepat, aman, dan mudah dipahami saat ibadah atau live event.

---

## 2. Prinsip Dasar

Audio **bukan** sekadar media visual tanpa gambar.

Audio memiliki karakter yang berbeda:

- Tidak membutuhkan slide visual besar seperti image/video.
- Sering harus tetap berjalan sambil operator mengganti slide lagu, ayat, atau background.
- Sering perlu dikontrol sebagai playback global, bukan sekadar konten satu slide.
- Sering butuh state yang persisten: `playing`, `paused`, `stopped`, `muted`, `loop`, `current time`, dan `output level`.

Karena itu, audio di RAMEDIA harus diperlakukan sebagai **modul playback independen**.

---

## 3. Keputusan Produk

### 3.1 Posisi Audio

Audio akan menjadi **panel sendiri** di Controller, sejajar secara konseptual dengan:

- Song
- Media
- Schedule
- Live

Audio **tidak** digabung ke panel Media visual sebagai perilaku utama operator.

### 3.2 Relasi dengan Media Library

Secara storage, audio tetap boleh disimpan dalam sistem asset yang sama seperti media lain.

Namun secara UI dan operasional:

- **Image/Video** masuk ke workflow visual.
- **Audio** masuk ke workflow audio.

Artinya, asset manager boleh satu sumber, tapi pengalaman operator untuk audio harus berbeda.

---

## 4. Best Practice yang Dipakai

RAMEDIA akan mengikuti pola yang umum dipakai pada aplikasi presentasi, playback, dan live production:

- **Transport audio global**
  Audio memiliki play/pause/stop yang tidak bergantung pada slide saat ini.

- **Now Playing yang selalu jelas**
  Operator harus selalu tahu audio apa yang sedang jalan.

- **Kontrol cepat dan langsung**
  Minimal harus ada:
  - play
  - pause
  - stop
  - seek
  - volume
  - mute
  - loop

- **Multitasking**
  Audio tetap bisa berjalan ketika operator:
  - ganti slide
  - ganti item preview
  - push image/video ke live
  - membuka editor atau panel lain

- **Separation of concerns**
  Visual output dan audio output tidak saling mengunci.

---

## 5. Model Interaksi Operator

### 5.1 Library Audio

Panel Audio akan menampilkan daftar asset audio:

- judul file
- durasi
- waveform placeholder atau timeline ringkas
- status playback
- icon loop / mute bila aktif

### 5.2 Single Click

Single click pada item audio:

- memilih track
- menampilkan detail di **Audio Preview / Inspector mini**
- **tidak langsung play**

### 5.3 Double Click

Double click pada item audio:

- langsung memulai playback
- menjadikan item tersebut sebagai **Now Playing**

### 5.4 Tombol Aksi Cepat

Setiap item audio idealnya punya tombol cepat:

- play / pause
- stop
- queue / prepare
- options

---

## 6. Audio Panel Layout

Struktur panel audio yang direkomendasikan:

### A. Audio Library List

Menampilkan semua file audio:

- searchable
- sortable
- bisa difilter

### B. Now Playing Section

Bagian yang selalu terlihat dan menampilkan:

- nama track
- elapsed time / duration
- playhead
- play / pause
- stop
- loop
- volume slider
- mute

### C. Optional Queue

Jika nanti dibutuhkan, audio dapat punya queue sendiri:

- next track
- preload track berikutnya
- auto-continue setelah track selesai

Untuk fase awal, queue audio **opsional**.

---

## 7. Playback Behavior

### 7.1 Audio Bersifat Global

Audio playback tidak boleh otomatis berhenti hanya karena:

- preview slide berubah
- live slide berubah
- operator klik item library lain

Audio hanya berubah jika operator:

- stop
- pause
- replace dengan track lain
- rundown rule tertentu memintanya berhenti

### 7.2 Fokus Audio

Hanya satu track audio utama yang aktif pada satu waktu pada fase awal.

Ini adalah pendekatan paling aman untuk operator live.

Catatan:

- Multi-layer audio mixing bisa menjadi fase lanjutan.
- Fase pertama cukup satu playback channel utama.

### 7.3 Output Audio

Audio harus diarahkan ke jalur output yang jelas.

Minimal behavior awal:

- audio keluar dari output aplikasi utama
- volume app mengikuti slider internal

Fase lanjutan bisa menambah:

- output device selection
- preview headphone bus
- dedicated audio routing

---

## 8. Relasi dengan Rundown

Audio harus mendukung dua mode:

### Mode A: Standalone Audio

Audio diputar manual dari panel Audio.

Cocok untuk:

- backing track
- instrumental
- ambience
- bumper music

### Mode B: Audio sebagai Rundown Item

Audio dapat ditambahkan ke rundown sebagai item.

Cocok untuk:

- opening track
- bumper antar segmen
- closing song bed

Behavior yang direkomendasikan:

- item rundown audio saat di-preview menampilkan transport audio
- saat di-live, audio mulai diputar
- operator tetap bisa mengontrol playback dari panel Audio

Dengan kata lain, rundown boleh memicu audio, tetapi kontrol global tetap berada di modul Audio.

---

## 9. Hubungan dengan Media Visual

Audio dan media visual harus bisa jalan bersamaan.

Contoh:

- MP3 instrumental berjalan
- operator menampilkan lirik lagu
- background tetap image atau video loop

Ini berarti:

- audio **tidak** menggantikan visual layer
- audio **tidak** harus menghasilkan slide visual
- audio hanya butuh representasi UI operasional, bukan representasi canvas output

Kalau diperlukan di live panel, audio cukup punya indikator:

- now playing
- progress
- level

Bukan preview visual besar seperti image/video.

---

## 10. Penyimpanan Asset Audio

Audio mengikuti managed storage yang sama dengan media lain:

- file asli di-copy ke direktori internal aplikasi
- database menyimpan metadata dan path hasil copy

Keuntungan:

- file tetap tersedia walau sumber asli pindah
- rundown lebih portable
- backup lebih aman

Direkomendasikan:

- folder managed tetap satu keluarga asset
- metadata audio dipisahkan secara logis dengan `media_type = 'audio'`

---

## 11. Metadata Audio yang Dibutuhkan

Untuk fase awal, tiap item audio sebaiknya menyimpan:

```json
{
  "playback": {
    "volume": 100,
    "loop": false,
    "startTime": 0,
    "endTime": 0,
    "fadeInMs": 0,
    "fadeOutMs": 0
  }
}
```

Field penting:

- `volume`
- `loop`
- `startTime`
- `endTime`
- `fadeInMs`
- `fadeOutMs`

Metadata tambahan yang sangat berguna:

- `duration`
- `sampleRate`
- `channels`
- `bitrate`

---

## 12. State Model yang Direkomendasikan

Audio sebaiknya memiliki store sendiri, misalnya:

```ts
interface AudioState {
  currentTrack: AudioAsset | null;
  status: 'idle' | 'playing' | 'paused' | 'stopped';
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  loop: boolean;

  selectTrack: (track: AudioAsset | null) => void;
  playTrack: (track?: AudioAsset) => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleLoop: () => void;
}
```

Poin penting:

- audio state dipisah dari presentation slide state
- audio tidak ditaruh di `previewSlide`
- audio tidak dipaksa menjadi `Slide`

---

## 13. UI Fase 1 yang Direkomendasikan

Fase pertama implementasi sebaiknya sederhana:

1. Panel Audio baru
2. Import file audio
3. Daftar track audio
4. Single click memilih track
5. Double click play
6. Now Playing bar
7. Play / pause / stop
8. Seekbar
9. Volume slider
10. Loop toggle

Belum perlu di fase awal:

- multi-track mixer
- waveform editor kompleks
- cue bus
- ducking otomatis
- crossfade antar track

---

## 14. UX Rules

Aturan UX yang harus dijaga:

- Jangan otomatis mematikan audio saat operator hanya berpindah preview slide.
- Jangan menaruh audio di Preview Queue visual seperti image/video.
- Jangan membuat audio bergantung pada canvas visual.
- Selalu tampilkan track yang sedang aktif dengan jelas.
- Stop harus benar-benar menghentikan playback dan reset posisi.
- Pause harus mempertahankan posisi playhead.
- Saat track baru di-play, track lama berhenti dulu.

---

## 15. Kesimpulan

Audio di RAMEDIA harus dibangun sebagai **modul playback independen** dengan kontrol global.

Keputusan utamanya:

- audio adalah asset media, tetapi bukan media visual
- audio butuh panel sendiri
- audio harus mendukung multitasking lintas slide
- audio boleh terhubung ke rundown, tetapi kontrol utamanya tetap dari modul Audio

Pendekatan ini paling aman, paling scalable, dan paling sesuai dengan kebutuhan operator live.
