import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Use CDN for the worker to avoid Vite build issues with worker files
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfViewerProps {
    url: string;
}

export default function PdfViewer({ url }: PdfViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [renderFailed, setRenderFailed] = useState(false);
    const [scale, setScale] = useState(0); // 0 = Auto-fit
    const [pdf, setPdf] = useState<any>(null);
    const [pageNum, setPageNum] = useState(1);
    const [numPages, setNumPages] = useState(1);

    useEffect(() => {
        setLoading(true);
        setError('');
        setRenderFailed(false);
        setPageNum(1);
        const loadingTask = pdfjsLib.getDocument({ url, disableAutoFetch: false, disableStream: false });
        loadingTask.promise.then(pdfDoc => {
            setPdf(pdfDoc);
            setNumPages(pdfDoc.numPages);
            setLoading(false);
        }).catch(err => {
            console.error('Error loading PDF:', err);
            setError('Kunne ikke laste inn PDF-filen automatisk. Vennligst bruk "Åpne i ny fane".');
            setLoading(false);
        });
    }, [url]);

    useEffect(() => {
        if (renderFailed || !pdf || !canvasRef.current || !containerRef.current) return;
        let isRenderCancelled = false;

        pdf.getPage(pageNum).then((page: any) => {
            if (isRenderCancelled) return;

            const canvas = canvasRef.current;
            const context = canvas?.getContext('2d');
            if (!canvas || !context) return;
            
            // Determine scale
            const unscaledViewport = page.getViewport({ scale: 1.0 });
            const containerWidth = containerRef.current!.clientWidth - 48;
            const containerHeight = containerRef.current!.clientHeight - 48;
            
            let effectiveScale = scale;
            if (scale === 0) {
                const widthScale = containerWidth / unscaledViewport.width;
                const heightScale = containerHeight / unscaledViewport.height;
                effectiveScale = Math.min(widthScale, heightScale);
                if (effectiveScale > 2) effectiveScale = 2;
            }

            const viewport = page.getViewport({ scale: effectiveScale });
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            page.render(renderContext).promise.then(() => {
                // Render succeeded
            }).catch((err: any) => {
                console.error('PDF render failed, falling back to iframe:', err);
                if (!isRenderCancelled) {
                    setRenderFailed(true);
                }
            });
        }).catch((err: any) => {
            console.error('PDF page load failed, falling back to iframe:', err);
            if (!isRenderCancelled) {
                setRenderFailed(true);
            }
        });

        return () => {
            isRenderCancelled = true;
        };
    }, [pdf, pageNum, scale, renderFailed]);

    // If canvas rendering failed, fall back to browser's built-in PDF viewer via iframe
    if (renderFailed) {
        return (
            <div className="w-full h-full flex flex-col bg-slate-200 overflow-hidden relative">
                {pdf && (
                    <div className="flex items-center justify-center gap-2 sm:gap-4 bg-slate-800 text-white p-2 shrink-0 z-10 shadow-md flex-wrap">
                        <span className="text-sm font-medium px-2">Forhåndsvisning i nettleser</span>
                        <a href={url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-primary-600 rounded hover:bg-primary-500 text-sm font-medium">Åpne i ny fane</a>
                    </div>
                )}
                <iframe
                    src={url}
                    className="flex-1 w-full border-none bg-white"
                    title="PDF-forhåndsvisning"
                />
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col bg-slate-200 overflow-hidden relative">
            {/* Controls */}
            {pdf && (
                <div className="flex items-center justify-center gap-2 sm:gap-4 bg-slate-800 text-white p-2 shrink-0 z-10 shadow-md flex-wrap">
                    <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50 text-sm font-medium">Forrige</button>
                    <span className="text-sm font-medium px-2">Side {pageNum} av {numPages}</span>
                    <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum >= numPages} className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 disabled:opacity-50 text-sm font-medium">Neste</button>
                    
                    <div className="w-px h-6 bg-slate-600 mx-1 sm:mx-2"></div>
                    
                    <button onClick={() => setScale(s => s === 0 ? 0.8 : s * 0.8)} className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 text-sm font-medium">-</button>
                    <button onClick={() => setScale(0)} className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 text-sm font-medium" title="Tilpass til skjerm">Tilpass</button>
                    <button onClick={() => setScale(s => s === 0 ? 1.2 : s * 1.2)} className="px-3 py-1 bg-slate-700 rounded hover:bg-slate-600 text-sm font-medium">+</button>
                    
                    <div className="w-px h-6 bg-slate-600 mx-1 sm:mx-2 hidden sm:block"></div>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="px-3 py-1 bg-primary-600 rounded hover:bg-primary-500 text-sm font-medium hidden sm:block">Åpne i ny fane</a>
                </div>
            )}
            
            {/* Canvas Container */}
            <div ref={containerRef} className="flex-1 overflow-auto flex justify-center items-start p-6">
                {loading && (
                    <div className="flex flex-col items-center justify-center mt-20 gap-4">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
                        <span className="text-slate-500 font-medium">Laster inn PDF-motor...</span>
                    </div>
                )}
                {error && <div className="text-red-500 font-medium mt-20 bg-red-50 p-4 rounded-xl border border-red-200 shadow-sm">{error}</div>}
                <canvas ref={canvasRef} className={`bg-white shadow-xl max-w-none ${loading || error ? 'hidden' : 'block'}`} />
            </div>
        </div>
    );
}
