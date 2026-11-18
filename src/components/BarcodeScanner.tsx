import { useEffect, useRef, useState } from 'react';

interface Detector {
  detect(src: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

/** Camera barcode scanner: native BarcodeDetector where available, otherwise ZXing (works on iPhone Safari). */
export default function BarcodeScanner({ onDetected, onCancel }: { onDetected: (code: string) => void; onCancel: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const done = useRef(false);

  useEffect(() => {
    let stop = () => {};
    const found = (code: string) => {
      if (done.current) return;
      done.current = true;
      navigator.vibrate?.(80);
      stop();
      onDetected(code);
    };
    (async () => {
      try {
        const Native = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
        if (Native) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          const v = video.current!;
          v.srcObject = stream;
          await v.play();
          const det = new Native({ formats: FORMATS });
          let raf = 0;
          const tick = async () => {
            if (done.current) return;
            try {
              const codes = await det.detect(v);
              if (codes[0]?.rawValue) return found(codes[0].rawValue);
            } catch {
              /* frame not ready */
            }
            raf = window.setTimeout(tick, 200);
          };
          tick();
          stop = () => {
            clearTimeout(raf);
            stream.getTracks().forEach((t) => t.stop());
          };
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          const reader = new BrowserMultiFormatReader();
          const controls = await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video.current!, (res) => {
            if (res) found(res.getText());
          });
          stop = () => controls.stop();
        }
      } catch (e) {
        setError((e as Error).name === 'NotAllowedError' ? 'Camera access was blocked. Allow it in Settings → Safari → Camera, or type the barcode below.' : 'Could not start the camera. Type the barcode below instead.');
      }
    })();
    return () => stop();
  }, [onDetected]);

  return (
    <div>
      <h2 className="h2 mb-2">Scan a barcode</h2>
      <div className="relative overflow-hidden rounded-2xl bg-black">
        <video ref={video} className="aspect-[4/3] w-full object-cover" playsInline muted autoPlay />
        <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-rose-500/80" />
      </div>
      {error && <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">{error}</p>}
      <div className="mt-3 flex gap-2">
        {/* Text, not a number: barcodes can start with 0. */}
        <input className="input flex-1" inputMode="numeric" pattern="[0-9]*" value={manual} onChange={(e) => setManual(e.target.value.replace(/\D/g, ''))} placeholder="Type barcode digits" aria-label="Barcode" />
        <button className="btn-primary" disabled={manual.length < 6} onClick={() => onDetected(manual)}>Look up</button>
      </div>
      <button className="btn-secondary mt-2 w-full" onClick={onCancel}>Cancel</button>
    </div>
  );
}
