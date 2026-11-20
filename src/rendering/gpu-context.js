// WebGPU bootstrap: adapter and device acquisition, canvas configuration, capability report.

export class GpuUnavailableError extends Error {}

/**
 * @returns {Promise<object>} { device, context, format, info, features, limits, canTimestamp }
 */
export async function createGpuContext(canvas, onError) {
  if (!navigator.gpu) throw new GpuUnavailableError('WebGPU is not available in this browser.');
  let adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new GpuUnavailableError('No WebGPU adapter was found.');
  const canTimestamp = adapter.features.has('timestamp-query');
  const requiredFeatures = canTimestamp ? ['timestamp-query'] : [];
  const device = await adapter.requestDevice({ requiredFeatures });
  device.addEventListener('uncapturederror', (event) => {
    console.error('[gpu]', event.error.message);
    if (onError) onError(event.error.message);
  });
  device.lost.then((lost) => {
    console.error('[gpu] device lost:', lost.message);
    if (onError && lost.reason !== 'destroyed') onError(`GPU device lost: ${lost.message}`);
  });
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  const info = adapter.info || {};
  return {
    device, context, format, canTimestamp,
    info: {
      vendor: info.vendor || '', architecture: info.architecture || '', device: info.device || '',
      description: info.description || '', isFallback: !!(info.isFallbackAdapter ?? adapter.isFallbackAdapter),
    },
    features: [...adapter.features],
    limits: {
      maxTextureDimension2D: adapter.limits.maxTextureDimension2D,
      maxTextureArrayLayers: adapter.limits.maxTextureArrayLayers,
      maxBufferSize: adapter.limits.maxBufferSize,
    },
  };
}

/** True when the adapter is a CPU rasteriser (measurements are then not representative). */
export function isSoftwareAdapter(info) {
  const text = `${info.vendor} ${info.architecture} ${info.device} ${info.description}`.toLowerCase();
  return info.isFallback || /swiftshader|llvmpipe|software|lavapipe/.test(text);
}
