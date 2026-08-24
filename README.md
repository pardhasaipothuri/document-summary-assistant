# Document Summary Assistant

A lightweight web application that accepts PDF and image documents, extracts their text, and produces concise summaries and key points.

## Features

- PDF text extraction using PDF.js
- OCR for scanned images using Tesseract.js
- Short, medium, and long summary options
- Automatic key-point extraction
- Drag-and-drop or file-picker upload
- Loading/progress and basic error handling
- Responsive interface

## Approach

The application runs document processing in the browser. PDF files are parsed with PDF.js, while image documents are processed with Tesseract.js OCR. The extracted text is cleaned and analyzed using an extractive ranking algorithm based on word frequency and sentence position. The highest-scoring sentences form the selected summary, while the same ranking is used to identify key points. This keeps the application lightweight and avoids requiring a server or storing uploaded documents.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL shown by Vite.
