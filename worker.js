// Ember inference worker
// Runs the WebLLM engine (model loading + token generation) off the main
// thread so the UI never freezes while the GPU is busy. The main thread talks
// to this worker through CreateWebWorkerMLCEngine; we just forward messages
// into the handler, which owns the actual engine inside the worker.

import { WebWorkerMLCEngineHandler } from "https://esm.run/@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg) => {
  handler.onmessage(msg);
};
