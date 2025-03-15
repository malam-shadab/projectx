import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

export const configurePdfWorker = async () => {
    try {
        const workerUrl = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
        
        // Wait for worker to be ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return true;
    } catch (error) {
        console.error('PDF Worker configuration failed:', error);
        throw error;
    }
};