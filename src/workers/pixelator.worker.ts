import { PixelationOptions } from '../types/pattern';
import { processImagePixels } from '../utils/pixelator';

export interface WorkerRequest {
  requestId: number;
  rgbaBuffer: ArrayBuffer;
  srcWidth: number;
  srcHeight: number;
  options: PixelationOptions;
}

export interface WorkerResponse {
  requestId: number;
  width: number;
  height: number;
  grid: number[];
  palette: ReturnType<typeof processImagePixels>['palette'];
  previewBuffer: ArrayBuffer;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { requestId, rgbaBuffer, srcWidth, srcHeight, options } = event.data;
  const srcRgba = new Uint8ClampedArray(rgbaBuffer);
  const result = processImagePixels(srcRgba, srcWidth, srcHeight, options);
  const previewCopy = new ArrayBuffer(result.previewRgba.byteLength);
  new Uint8Array(previewCopy).set(result.previewRgba);
  const response: WorkerResponse = {
    requestId,
    width: result.width,
    height: result.height,
    grid: result.grid,
    palette: result.palette,
    previewBuffer: previewCopy,
  };
  (self as unknown as Worker).postMessage(response, [previewCopy]);
};
