import React, { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createWorker } from "tesseract.js";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const SUMMARY_SIZES = {
  short: 3,
  medium: 6,
  long: 10
};

function cleanText(text) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .trim();
}

function splitSentences(text) {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 35);
}

function summarize(text, length) {
  const sentences = splitSentences(text);
  if (!sentences.length) return text.slice(0, 1200);

  const words = text.toLowerCase().match(/[a-zA-Z][a-zA-Z'-]{2,}/g) || [];
  const stopWords = new Set([
    "the","and","for","that","this","with","from","are","was","were","have",
    "has","had","not","but","you","your","they","their","about","which","will",
    "would","there","into","than","then","also","can","may","its","our","out",
    "all","any","more","some","such","when","where","what","how","who","why",
    "these","those","been","being","each","other","only","very","over","under",
    "between","through","while","because","should","could","might","does","did"
  ]);

  const freq = {};
  for (const word of words) {
    if (!stopWords.has(word)) freq[word] = (freq[word] || 0) + 1;
  }

  const ranked = sentences.map((sentence, index) => {
    const sentenceWords = sentence.toLowerCase().match(/[a-zA-Z][a-zA-Z'-]{2,}/g) || [];
    let score = 0;
    for (const word of sentenceWords) score += freq[word] || 0;
    if (index < 2) score += 2;
    if (sentence.length > 250) score -= 1;
    return { sentence, index, score };
  });

  const count = Math.min(SUMMARY_SIZES[length], sentences.length);
  const selected = ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .sort((a, b) => a.index - b.index);

  return selected.map((item) => item.sentence).join(" ");
}

function keyPoints(text) {
  const sentences = splitSentences(text);
  const words = text.toLowerCase().match(/[a-zA-Z][a-zA-Z'-]{2,}/g) || [];
  const stopWords = new Set([
    "the","and","for","that","this","with","from","are","was","were","have",
    "has","had","not","but","you","your","they","their","about","which","will",
    "would","there","into","than","then","also","can","may","its","our","out",
    "all","any","more","some","such","when","where","what","how","who","why"
  ]);

  const freq = {};
  for (const word of words) {
    if (!stopWords.has(word)) freq[word] = (freq[word] || 0) + 1;
  }

  return sentences
    .map((sentence, index) => {
      const ws = sentence.toLowerCase().match(/[a-zA-Z][a-zA-Z'-]{2,}/g) || [];
      const score = ws.reduce((sum, w) => sum + (freq[w] || 0), 0) + (index < 3 ? 3 : 0);
      return { sentence, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x) => x.sentence);
}

async function extractPdf(file) {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str || "").join(" ");
    text += pageText + "\n";
  }

  return cleanText(text);
}

async function extractImage(file, onProgress) {
  const worker = await createWorker("eng", 1, {
    logger: (message) => {
      if (message.status === "recognizing text" && message.progress) {
        onProgress(Math.round(message.progress * 100));
      }
    }
  });

  const result = await worker.recognize(file);
  await worker.terminate();
  return cleanText(result.data.text);
}

export default function App() {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [points, setPoints] = useState([]);
  const [length, setLength] = useState("medium");
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  async function processFile(selectedFile) {
    if (!selectedFile) return;

    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(selectedFile.type)) {
      setStatus("Please upload a PDF, PNG, JPG, or WebP file.");
      return;
    }

    setFile(selectedFile);
    setSummary("");
    setPoints([]);
    setText("");
    setProgress(0);

    try {
      let extracted = "";

      if (selectedFile.type === "application/pdf") {
        setStatus("Extracting text from PDF...");
        extracted = await extractPdf(selectedFile);
      } else {
        setStatus("Running OCR on image...");
        extracted = await extractImage(selectedFile, setProgress);
      }

      if (!extracted) {
        throw new Error("No readable text was found in this document.");
      }

      setText(extracted);
      setSummary(summarize(extracted, length));
      setPoints(keyPoints(extracted));
      setStatus("Document processed successfully.");
      setProgress(100);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Something went wrong while processing the document.");
    }
  }

  function regenerate(newLength = length) {
    if (!text) return;
    setLength(newLength);
    setSummary(summarize(text, newLength));
    setPoints(keyPoints(text));
  }

  function onDrop(event) {
    event.preventDefault();
    setDragging(false);
    processFile(event.dataTransfer.files?.[0]);
  }

  return (
    <main className="app">
      <section className="hero">
        <h1>Document Summary Assistant</h1>
        <p>Upload a PDF or scanned image and quickly extract, summarize, and understand its most important information.</p>
      </section>

      <section className="card">
        <div
          className={`dropzone ${dragging ? "dragging" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="upload-icon">↑</div>
          <h2>Drop your document here</h2>
          <p>or click to choose a PDF or image</p>
          <span>PDF · PNG · JPG · WEBP</span>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            hidden
            onChange={(e) => processFile(e.target.files?.[0])}
          />
        </div>

        {file && (
          <div className="file-row">
            <div>
              <strong>{file.name}</strong>
              <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
            </div>
            <button className="secondary" onClick={() => inputRef.current?.click()}>Change</button>
          </div>
        )}

        {status && (
          <div className="status">
            <span>{status}</span>
            {progress > 0 && progress < 100 && <progress value={progress} max="100" />}
          </div>
        )}
      </section>

      {text && (
        <section className="results">
          <div className="card">
            <div className="section-head">
              <div>
                <h2>Summary</h2>
                <p>Choose the amount of detail you want.</p>
              </div>
              <div className="lengths">
                {["short", "medium", "long"].map((item) => (
                  <button
                    key={item}
                    className={length === item ? "active" : ""}
                    onClick={() => regenerate(item)}
                  >
                    {item[0].toUpperCase() + item.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <p className="summary">{summary}</p>
          </div>

          <div className="card">
            <div className="section-head">
              <div>
                <h2>Key Points</h2>
                <p>Main ideas identified from the document.</p>
              </div>
            </div>
            <ul className="points">
              {points.map((point, index) => <li key={index}>{point}</li>)}
            </ul>
          </div>

          <details className="card extracted">
            <summary>View extracted text</summary>
            <p>{text}</p>
          </details>
        </section>
      )}

      <footer>
        <span>Document Summary Assistant</span>
        <span>PDF parsing + OCR + extractive summarization</span>
      </footer>
    </main>
  );
}
