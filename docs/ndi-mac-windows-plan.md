# RAMEDIA NDI Support Plan (`macOS + Windows`)

## 1. Tujuan

Dokumen ini mendefinisikan rencana dukungan **NDI input** dan **NDI output** untuk RAMEDIA pada:

- `macOS`
- `Windows`

Fokus utama dokumen ini adalah:

- menentukan scope produk yang realistis
- memilih arsitektur teknis yang aman untuk Electron
- mengurangi risiko build dan packaging lintas platform
- menyiapkan urutan implementasi yang bisa dieksekusi bertahap

Keputusan utama pada fase awal:

- **mulai dari NDI Output lebih dulu**
- **target MVP lintas platform: video-only**
- **gunakan helper native process, bukan Electron native addon langsung**

---

## 2. Ringkasan Keputusan

### 2.1 Kenapa NDI memungkinkan di RAMEDIA

Secara arsitektur, RAMEDIA sudah punya fondasi yang cukup dekat:

- Electron main process
- multi-output runtime
- output routing model
- state sinkronisasi live output
- capture/live-source abstraction yang mulai terbentuk

Artinya, aplikasi ini sudah punya tempat yang logis untuk menambahkan transport video network.

### 2.2 Kenapa tidak langsung kerjakan input + output sekaligus

NDI bukan fitur UI biasa. Ia menyentuh:

- native SDK
- video frame transport
- sinkronisasi audio/video
- lifecycle process
- packaging lintas platform

Kalau input dan output dikerjakan bersamaan, risiko naik tajam:

- area bug terlalu luas
- debugging lebih sulit
- pipeline belum sempat distabilkan

Karena itu urutan yang direkomendasikan:

1. `NDI Output MVP`
2. `NDI Output hardening`
3. `NDI Input MVP`
4. `NDI Input hardening`

### 2.3 Keputusan integrasi

Rekomendasi:

- **jangan** link NDI SDK langsung ke renderer
- **jangan** kirim raw frame besar lewat IPC Electron biasa
- **gunakan helper process native terpisah**

Helper process bertugas:

- publish NDI sender
- receive NDI source
- expose command/status API sederhana ke Electron main

Electron main bertugas:

- mengelola lifecycle helper
- meneruskan command dari renderer
- menyimpan status runtime
- menjaga contract platform tetap konsisten

---

## 3. Sasaran Produk

### 3.1 NDI Output

Tujuan produk:

- output RAMEDIA bisa muncul sebagai source NDI di jaringan lokal
- source itu bisa dibaca oleh aplikasi seperti:
  - OBS
  - vMix
  - TriCaster
  - NDI Studio Monitor
  - komputer lain yang menerima NDI

Contoh use case:

- kirim lyric output ke OBS tanpa HDMI capture
- kirim confidence view ke device lain di jaringan
- kirim stage display ke mesin produksi berbeda

### 3.2 NDI Input

Tujuan produk:

- RAMEDIA bisa menerima source NDI dari network
- source itu bisa dipakai sebagai live source temporer

Contoh use case:

- menerima feed dari OBS atau vMix
- menerima camera feed dari mesin lain
- menerima content dari komputer operator lain

Catatan produk penting:

- `NDI Input` harus diperlakukan seperti live capture source
- `NDI Input` **bukan** asset library permanen
- default behavior-nya **tidak** membuat record media di database

---

## 4. Prinsip Produk

### 4.1 Output NDI adalah ekstensi dari Output Routing

NDI Output bukan modul media library.

Posisi yang benar:

- bagian dari `Output / Routing`
- sejajar dengan browser output dan local display output

### 4.2 Input NDI adalah ekstensi dari Live Capture

NDI Input bukan media import.

Posisi yang benar:

- bagian dari live source / capture
- sejajar dengan screen capture, HDMI capture, camera capture

### 4.3 Default phase awal harus sederhana

Untuk MVP lintas platform, RAMEDIA harus menghindari scope yang terlalu lebar.

Default awal:

- satu NDI output aktif
- video only
- tanpa alpha
- tanpa audio
- nama source bisa dikonfigurasi
- resolusi tetap 1080p lebih dulu

---

## 5. Scope Implementasi

## 5.1 Phase 1: NDI Output MVP

Deliverable:

- output type baru: `ndi`
- satu output channel bisa dipublish sebagai source NDI
- user bisa:
  - enable/disable NDI output
  - isi nama source
  - lihat status `idle / starting / live / error`
- target video:
  - `1920x1080`
  - `30fps` atau `60fps` tergantung performa helper
- tanpa audio

Out of scope phase ini:

- alpha channel
- fill/key pair
- audio NDI
- multi-NDI sender
- auto-discovery input

## 5.2 Phase 2: NDI Output Hardening

Deliverable:

- pilihan resolusi
- pilihan fps
- reconnect/error recovery
- multi-output NDI bila dibutuhkan
- health metrics:
  - frame drop
  - last publish time
  - helper process state

Optional:

- audio output ke NDI
- alpha/fill-key workflow

## 5.3 Phase 3: NDI Input MVP

Deliverable:

- daftar source NDI yang tersedia di LAN
- operator bisa memilih satu source
- source diperlakukan sebagai live capture source
- preview status:
  - source name
  - connected/disconnected
  - resolution
  - frame status

Input NDI harus bisa:

- tampil di preview
- masuk ke live output
- dihentikan tanpa meninggalkan state rusak

## 5.4 Phase 4: NDI Input Hardening

Deliverable:

- reconnect otomatis
- audio input bila diperlukan
- fallback UI saat source hilang
- latency metrics
- opsi scale / crop / contain

---

## 6. Arsitektur yang Direkomendasikan

## 6.1 Komponen

```txt
Renderer (React)
  -> Settings / Output UI
  -> Capture / Input UI
  -> status display

Electron Main
  -> NDI session manager
  -> helper process supervisor
  -> IPC bridge
  -> runtime state persistence

Native Helper Process
  -> NDI SDK binding
  -> sender runtime
  -> receiver runtime
  -> frame/audio transport
```

## 6.2 Kenapa helper process lebih aman

Alasan utama:

- crash di helper tidak langsung menjatuhkan Electron main
- dependency native lebih terisolasi
- build `macOS` dan `Windows` bisa dipisah lebih bersih
- upgrade SDK lebih mudah
- lebih aman untuk debugging performa

Kalau memakai native addon langsung di Electron:

- binding harus cocok dengan runtime Electron
- rebuild native dependency lebih sensitif
- crash native bisa lebih merusak proses utama

---

## 7. Alur NDI Output

### 7.1 Flow produk

```txt
Operator pilih output channel
  -> set targetType = ndi
  -> isi NDI source name
  -> klik enable
  -> Electron main start helper sender
  -> helper publish source NDI ke LAN
  -> live output frame dikirim ke helper
```

### 7.2 Frame source

Untuk phase awal, source frame sebaiknya berasal dari output renderer yang sudah ada.

Pilihan arsitektur:

1. capture frame dari output renderer surface
2. generate frame dari rendering pipeline terpisah

Rekomendasi awal:

- manfaatkan output renderer yang sudah live
- hindari membangun rendering pipeline kedua untuk MVP

### 7.3 Mekanisme pengiriman frame

Jangan kirim frame full-size via JSON IPC.

Rekomendasi:

- gunakan shared memory atau binary buffer channel antara Electron main dan helper
- atau helper mengambil frame dari offscreen render target

Untuk MVP, implementasi yang masih realistis:

- output renderer render ke hidden/offscreen surface
- frame diambil sebagai bitmap/raw RGBA
- dikirim ke helper dalam binary payload

Catatan:

- ini harus diukur sejak awal, karena copying frame 1080p/60 cukup mahal

---

## 8. Alur NDI Input

### 8.1 Flow produk

```txt
Operator buka panel capture / input
  -> app minta daftar source NDI
  -> operator pilih source
  -> Electron main start helper receiver
  -> helper connect ke source NDI
  -> renderer/output menerima stream frames
  -> source tampil sebagai live capture
```

### 8.2 Model UI

NDI Input sebaiknya masuk ke panel yang sama dengan live source lain:

- Screen Share
- HDMI / Camera
- NDI Source

Jangan meletakkannya di:

- media library
- song library
- schedule asset browser

### 8.3 State minimal

```ts
type NdiConnectionState = 'idle' | 'discovering' | 'connecting' | 'live' | 'error';

interface NdiInputSession {
  sourceId: string | null;
  sourceName: string | null;
  resolution: { width: number; height: number } | null;
  fps: number | null;
  state: NdiConnectionState;
  lastFrameAt: string | null;
  error: string | null;
}
```

---

## 9. Integrasi Dengan Codebase Saat Ini

Area code yang paling relevan:

- [src/core/models/outputSettings.ts](/Users/michaelsebastian/Documents/AMIN/RAMEDIA/src/core/models/outputSettings.ts:1)
- [src/components/modals/settings/OutputSettingsWorkspace.tsx](/Users/michaelsebastian/Documents/AMIN/RAMEDIA/src/components/modals/settings/OutputSettingsWorkspace.tsx:1)
- [src/electron/main.ts](/Users/michaelsebastian/Documents/AMIN/RAMEDIA/src/electron/main.ts:1)
- [src/electron/preload.ts](/Users/michaelsebastian/Documents/AMIN/RAMEDIA/src/electron/preload.ts:1)
- [src/core/services/ipcOutputSettingsService.ts](/Users/michaelsebastian/Documents/AMIN/RAMEDIA/src/core/services/ipcOutputSettingsService.ts:1)
- [src/core/stores/useSettingsStore.ts](/Users/michaelsebastian/Documents/AMIN/RAMEDIA/src/core/stores/useSettingsStore.ts:1)
- [docs/capture-screen-share-module.md](/Users/michaelsebastian/Documents/AMIN/RAMEDIA/docs/capture-screen-share-module.md:1)

### 9.1 Output settings model

Tambahan model yang kemungkinan dibutuhkan:

```ts
type OutputTargetType =
  | 'electron-display'
  | 'browser-client'
  | 'ndi';

interface NdiOutputConfig {
  enabled: boolean;
  sourceName: string;
  resolution: '1080p' | '720p' | 'custom';
  fps: 30 | 60;
  includeAudio: boolean;
}
```

### 9.2 Main process service baru

Sebaiknya tambah service baru terpisah:

```txt
src/electron/ndi/
  ndiRuntimeService.ts
  ndiHelperProcess.ts
  ndiContracts.ts
```

Main process hanya memanggil service ini, bukan mengandung semua logic NDI langsung di `main.ts`.

### 9.3 Preload / IPC contract

Perlu surface IPC baru, misalnya:

```ts
ndi: {
  getRuntimeStatus: () => Promise<NdiRuntimeStatus>;
  startOutput: (payload: StartNdiOutputPayload) => Promise<void>;
  stopOutput: (outputId: string) => Promise<void>;
  listSources: () => Promise<NdiSourceSummary[]>;
  startInput: (payload: StartNdiInputPayload) => Promise<void>;
  stopInput: () => Promise<void>;
}
```

### 9.4 UI surface

Output settings:

- tambah target type `NDI`
- tambah form field:
  - source name
  - resolution
  - fps
  - audio toggle nanti

Capture/settings panel untuk input:

- daftar source NDI
- connect/disconnect
- status dan error

---

## 10. Dependency dan Packaging

## 10.1 Native SDK reality

NDI membutuhkan komponen native di luar stack TypeScript biasa.

Artinya:

- perlu binary/helper per platform
- perlu langkah packaging untuk `macOS`
- perlu langkah packaging untuk `Windows`
- perlu strategi install/update helper

## 10.2 Rekomendasi packaging

Pisahkan helper per platform:

```txt
native/
  ndi-helper-macos/
  ndi-helper-windows/
```

Atau build artifact:

```txt
resources/
  ndi-helper/darwin-arm64/...
  ndi-helper/darwin-x64/...
  ndi-helper/win32-x64/...
```

Electron app hanya memilih binary yang cocok saat runtime.

## 10.3 Kenapa ini penting

Karena target pengguna adalah `macOS + Windows`, maka sejak awal kita harus menolak pendekatan yang hanya enak di satu platform.

Arsitektur yang memudahkan:

- helper terpisah
- IPC contract stabil
- binary dibundle per platform
- error reporting yang jelas saat helper gagal start

---

## 11. Risiko Utama

### 11.1 Build complexity

Risiko:

- native toolchain berbeda antara macOS dan Windows
- packaging Electron jadi lebih sensitif

Mitigasi:

- helper process terpisah
- CI build per platform
- contract runtime yang sempit

### 11.2 Performance bottleneck

Risiko:

- copying frame terlalu mahal
- CPU usage naik saat 1080p/60
- frame drop saat output dan sender berjalan bersamaan

Mitigasi:

- mulai dari 1080p/30
- ukur pipeline sebelum tambah audio
- tambahkan telemetry sederhana untuk frame timing

### 11.3 Crash isolation

Risiko:

- helper/native runtime crash

Mitigasi:

- helper diawasi Electron main
- restart strategy terbatas
- UI tampilkan status error yang jelas

### 11.4 Audio sync

Risiko:

- audio/video drift
- route audio berbeda tiap OS

Mitigasi:

- keluarkan audio dari MVP
- tambah audio hanya setelah output video stabil

### 11.5 Discovery reliability

Risiko:

- source NDI kadang muncul/hilang di LAN
- behavior berbeda di jaringan gereja/event

Mitigasi:

- status polling
- reconnect manual dulu
- auto-reconnect nanti setelah stabil

---

## 12. Urutan Implementasi yang Direkomendasikan

## 12.1 Milestone A: Technical spike

Tujuan:

- buktikan helper sender bisa jalan di `macOS` dan `Windows`
- buktikan app bisa start/stop helper
- buktikan satu frame dummy bisa dipublish sebagai source NDI

Deliverable:

- helper prototype
- command line test
- catatan dependency per platform

## 12.2 Milestone B: Output runtime integration

Tujuan:

- Electron main bisa manage lifecycle helper
- status runtime bisa dibaca renderer

Deliverable:

- `ndiRuntimeService`
- preload IPC
- status panel dasar

## 12.3 Milestone C: NDI Output MVP

Tujuan:

- output channel dapat dipublish ke NDI

Deliverable:

- target type `ndi`
- source name setting
- enable/disable
- live status
- test dengan `NDI Studio Monitor` dan `OBS`

## 12.4 Milestone D: Output hardening

Tujuan:

- stabilkan performa dan UX

Deliverable:

- resolution/fps options
- error handling
- restart handling
- metrics dasar

## 12.5 Milestone E: NDI Input MVP

Tujuan:

- source NDI masuk ke pipeline live capture

Deliverable:

- source discovery
- connect/disconnect
- preview/live integration

---

## 13. Acceptance Criteria MVP

### 13.1 NDI Output MVP dianggap selesai jika:

- berjalan di `macOS`
- berjalan di `Windows`
- source NDI muncul di LAN
- source bisa dibuka oleh minimal:
  - `NDI Studio Monitor`
  - `OBS`
- start/stop tidak membuat app crash
- error helper tampil jelas di UI

### 13.2 Belum dianggap selesai jika:

- hanya berjalan di satu OS
- butuh restart app untuk start ulang sender
- frame output sering freeze tanpa status error
- crash helper ikut menjatuhkan app utama

---

## 14. Rekomendasi Final

Untuk project ini, pendekatan terbaik adalah:

1. **mulai dari NDI Output**
2. **helper process native terpisah**
3. **MVP video-only**
4. **1080p tetap dulu**
5. **setelah stabil baru tambah audio**
6. **NDI Input masuk setelah output sudah production-safe**

Ini memberi tradeoff terbaik antara:

- nilai produk
- kompleksitas engineering
- stabilitas lintas platform

---

## 15. Next Step

Setelah dokumen ini disetujui, langkah berikutnya yang paling tepat adalah membuat:

1. `NDI technical spike spec`
2. `IPC contract draft`
3. `output settings data model update plan`
4. `helper process folder structure`

Dokumen ini sengaja belum mengunci library atau bahasa implementasi helper. Itu sebaiknya diputuskan pada technical spike, karena kebutuhan `macOS + Windows` harus divalidasi dengan bukti build nyata, bukan asumsi.
