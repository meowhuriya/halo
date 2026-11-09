/**
 * Web Worker for rPPG DSP processing
 */
self.onmessage = (e: MessageEvent) => {
  const { type, data } = e.data;
  if (type === 'PING') {
    self.postMessage({ type: 'PONG', data });
  }
};

export {};
