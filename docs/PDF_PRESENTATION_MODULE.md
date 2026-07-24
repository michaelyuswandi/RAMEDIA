# PDF Presentation Module

## Goal

Add a native PDF presentation flow to RAMEDIA without embedding a full PowerPoint engine.

Scope for this implementation:

- import PDF into the managed media library
- treat each PDF page as a controllable slide
- preview and send PDF pages to live output
- use slide-controller behavior for page navigation
- support rundown insertion through the existing media item flow

Out of scope for this implementation:

- native PPTX rendering
- annotation persistence
- laser pointer
- presenter notes
- remote control

## Product Decision

RAMEDIA will not attempt to run `pptx` internally in the first phase.

Instead:

- `pptx` stays an external-app workflow
- `pdf` becomes the first supported presentation document format inside RAMEDIA

This keeps the renderer cross-platform and aligned with the existing controller/output architecture.

## User Flow

1. User imports a PDF from the library or media panel.
2. Electron copies the PDF into RAMEDIA managed storage.
3. RAMEDIA reads PDF metadata:
   - page count
   - first page size
   - page aspect ratio
4. The PDF is stored in the media library with `mediaType = pdf`.
5. When selected, RAMEDIA builds one virtual slide per PDF page.
6. The center panel and right panel show those pages like a normal slide controller.
7. Operator can:
   - click a page to preview
   - double-click a page to go live
   - use previous/next controls
   - use `ArrowLeft`, `ArrowRight`, `PageUp`, `PageDown`, `Home`, `End`
8. Output window renders the active PDF page directly.

## Architecture

### Storage

Implementation reuses the existing `media` table:

- `mediaType: 'pdf'`
- `filepath`: managed local file URL
- `mimeType: 'application/pdf'`
- `playbackSettings`: JSON metadata for PDF

Current PDF metadata shape:

```json
{
  "pageCount": 12,
  "aspectRatio": 1.7778,
  "pageWidth": 1280,
  "pageHeight": 720
}
```

### Import

Electron main process adds a dedicated PDF import path:

- file picker limited to `pdf`
- file copied into `assets_documents`
- metadata read using `pdfjs-dist` legacy build in Node

### Virtual Slides

`buildMediaVirtualSlides()` now supports PDF:

- image/video: 1 media item -> 1 virtual slide
- PDF: 1 media item -> N virtual slides, one per page

Each PDF virtual slide stores:

- `pageNumber`
- `pageCount`
- a `media` layer pointing to the source PDF
- layer style declaring `mediaType: 'pdf'`

### Rendering

`SlideRenderer` now supports `mediaType: 'pdf'`.

Rendering is done by `PdfPageCanvas`:

- loads PDF with `pdfjs-dist`
- renders the requested page to canvas
- scales the page to fit the current viewport
- re-renders on resize

This keeps output rendering inside the same layer engine used by songs, media, and Bible content.

## UI Integration

### Library Panel

- PDFs are visible in the media library
- cards show a PDF icon and page count
- preview/live actions reuse the existing media workflow
- media toolbar now has:
  - Add Image/Video
  - Add PDF

### Media Panel

- PDFs appear beside images and videos
- cards show page count
- dedicated `Import PDF` action added

### Center Panel

- PDFs do not use the media queue preview flow
- they appear as a normal page list / slide controller

### Right Panel

- previous/next navigation works for PDF pages
- keyboard shortcuts added:
  - `ArrowLeft` / `PageUp`
  - `ArrowRight` / `PageDown`
  - `Home`
  - `End`

## Current Limitations

- no thumbnail caching yet; thumbnails are rendered live from PDF pages
- large PDFs may be heavier than songs or image media in controller view
- no laser pointer yet
- no drawing/annotation layer yet
- PDF inspector is basic and currently centered on preview and metadata

## Recommended Next Steps

1. Add thumbnail caching during import for large PDFs.
2. Add a lightweight laser pointer overlay synchronized to output.
3. Add page jump input and page number HUD.
4. Add temporary annotations per live session.
5. Add stage/confidence view support for current page / next page / timer.
