import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for PDF.js - Logic adapted for Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
).toString();

/**
 * Converts a File (PDF or Image) to an array of text strings (one per page/image).
 */
export async function performOCR(file, onProgress) {
    if (file.type === 'application/pdf') {
        return processPDF(file, onProgress);
    } else if (file.type.startsWith('image/')) {
        return processImage(file, onProgress);
    } else {
        throw new Error('Unsupported file type. Please upload a PDF or Image.');
    }
}

async function processImage(file, onProgress) {
    onProgress?.('Initializing Tesseract...', 0);

    const worker = await Tesseract.createWorker('eng', 1, {
        logger: m => {
            if (m.status === 'recognizing text') {
                onProgress?.('Recognizing text...', m.progress);
            }
        }
    });

    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();

    return [text];
}

async function processPDF(file, onProgress) {
    onProgress?.('Loading PDF...', 0);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;
    const pageTexts = [];

    const worker = await Tesseract.createWorker('eng', 1, {
        logger: _m => {
            // Only log heavy tasks
            // Using _m to silence unused variable warning
        }
    });

    for (let i = 1; i <= numPages; i++) {
        onProgress?.(`Processing Page ${i} of ${numPages}...`, (i - 1) / numPages);

        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 }); // Scale up for better OCR details

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) continue;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };

        // Cast to any because pdfjs-dist types can be strict/finicky about canvas properties
        await page.render(renderContext).promise;

        // Convert canvas to blob for Tesseract
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));

        if (blob) {
            onProgress?.(`OCR on Page ${i}...`, (i - 0.5) / numPages);
            const { data: { text } } = await worker.recognize(blob);
            pageTexts.push(text);
        }
    }

    await worker.terminate();
    onProgress?.('Completed', 1);
    return pageTexts;
}
