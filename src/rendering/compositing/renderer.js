// WebGPU compositor for the 2D racing scene. One render pass per frame; for each view the
// layers are drawn in a fixed order:
//   1 sky + clouds, 2 far relief, 3 near relief        (sky pipeline)
//   4 ground: road, kerbs, verges                       (road pipeline, row table)
//   5 scene quads back to front: strips, props, cars    (quad pipeline, crest clipping)
//   6 speed lines / flash                               (overlay pipeline)
//   7 cockpit, 8 HUD                                    (quad pipeline, no clipping)
// and finally the interface page over the whole canvas (blit pipeline).
// The renderer knows nothing about game rules: it consumes buffers prepared by the scene code.

import { SKY_WGSL } from '../shaders/sky.wgsl.js';
import { ROAD_WGSL } from '../shaders/road.wgsl.js';
import { QUAD_WGSL, MAX_LIVERIES } from '../shaders/quad.wgsl.js';
import { OVERLAY_WGSL } from '../shaders/overlay.wgsl.js';
import { BLIT_WGSL } from '../shaders/blit.wgsl.js';
import { VIEW_UNIFORM_FLOATS } from './view-uniforms.js';
import { ROW_FLOATS } from '../projection/road-projection.js';
import { QUAD_FLOATS } from '../drawing/quad-batch.js';
import { makeCanvas } from '../drawing/atlas.js';

export const MAX_VIEWS = 2;
export const MAX_ROWS = 2160;
export const MAX_QUADS = 16000;
export const MAX_TRACK_SAMPLES = 4096;
export const ATLAS_LAYER_SIZE = 2048;
export const ATLAS_LAYERS = 10;
export const CAR_LAYER_WIDTH = 1024;
export const CAR_LAYER_HEIGHT = 512;
export const BACKDROP_WIDTH = 4096;
export const BACKDROP_HEIGHT = 768;
export const BACKDROP_LAYERS = 3;
const MIP_LEVELS = 4;

export class Renderer {
  constructor(gpu, options = {}) {
    this.gpu = gpu;
    this.device = gpu.device;
    this.sampleCount = options.sampleCount === 4 ? 4 : 1;
    this.carLayers = options.carLayers || 2;
    this.width = 0; this.height = 0;
    this.gpuTimeMs = 0;
    this.gpuTimeSerial = 0;
    this.stats = { quads: 0, draws: 0 };
    this.blitData = new Float32Array(8);
    this.pageVisible = false;
  }

  init() {
    const device = this.device, format = this.gpu.format;
    const B = GPUBufferUsage, T = GPUTextureUsage;
    this.viewBuffers = [];
    for (let v = 0; v < MAX_VIEWS; v++) {
      this.viewBuffers.push(device.createBuffer({ size: VIEW_UNIFORM_FLOATS * 4, usage: B.UNIFORM | B.COPY_DST }));
    }
    this.rowsBuffer = device.createBuffer({ size: MAX_VIEWS * MAX_ROWS * ROW_FLOATS * 4, usage: B.STORAGE | B.COPY_DST });
    this.attrsBuffer = device.createBuffer({ size: MAX_TRACK_SAMPLES * 8 * 4, usage: B.STORAGE | B.COPY_DST });
    this.paletteBuffer = device.createBuffer({ size: MAX_LIVERIES * 3 * 16, usage: B.UNIFORM | B.COPY_DST });
    this.blitBuffer = device.createBuffer({ size: 32, usage: B.UNIFORM | B.COPY_DST });
    this.quadBuffer = device.createBuffer({ size: MAX_QUADS * QUAD_FLOATS * 4, usage: B.VERTEX | B.COPY_DST });
    const indices = new Uint32Array(MAX_QUADS * 6);
    for (let q = 0, i = 0; q < MAX_QUADS; q++) {
      const b = q * 4;
      indices[i++] = b; indices[i++] = b + 1; indices[i++] = b + 2;
      indices[i++] = b + 2; indices[i++] = b + 1; indices[i++] = b + 3;
    }
    this.indexBuffer = device.createBuffer({ size: indices.byteLength, usage: B.INDEX | B.COPY_DST });
    device.queue.writeBuffer(this.indexBuffer, 0, indices);

    const texUsage = T.TEXTURE_BINDING | T.COPY_DST | T.RENDER_ATTACHMENT;
    this.atlasTexture = device.createTexture({ size: [ATLAS_LAYER_SIZE, ATLAS_LAYER_SIZE, ATLAS_LAYERS], format: 'rgba8unorm', mipLevelCount: MIP_LEVELS, usage: texUsage });
    this.carTexture = device.createTexture({ size: [CAR_LAYER_WIDTH, CAR_LAYER_HEIGHT, this.carLayers], format: 'rgba8unorm', mipLevelCount: MIP_LEVELS, usage: texUsage });
    this.backdropTexture = device.createTexture({ size: [BACKDROP_WIDTH, BACKDROP_HEIGHT, BACKDROP_LAYERS], format: 'rgba8unorm', mipLevelCount: 1, usage: texUsage });
    this.spriteSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 4, addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    this.backdropSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'repeat', addressModeV: 'clamp-to-edge' });
    this.pageSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });

    const blend = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
    const multisample = { count: this.sampleCount };
    const viewLayout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },
    ] });
    const backdropLayout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
    ] });
    const spriteLayout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { viewDimension: '2d-array' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
    ] });
    this.blitLayout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ] });
    const module = (code, label) => device.createShaderModule({ code, label });
    const fullscreen = (code, label, layouts, blended) => {
      const m = module(code, label);
      return device.createRenderPipeline({
        label, layout: device.createPipelineLayout({ bindGroupLayouts: layouts }),
        vertex: { module: m, entryPoint: 'vsFullscreen' },
        fragment: { module: m, entryPoint: 'fs', targets: [{ format, blend: blended ? blend : undefined }] },
        primitive: { topology: 'triangle-list' }, multisample,
      });
    };
    this.skyPipeline = fullscreen(SKY_WGSL, 'sky', [viewLayout, backdropLayout], false);
    this.roadPipeline = fullscreen(ROAD_WGSL, 'road', [viewLayout], true);
    this.overlayPipeline = fullscreen(OVERLAY_WGSL, 'overlay', [viewLayout], true);
    const quadModule = module(QUAD_WGSL, 'quad');
    this.quadPipeline = device.createRenderPipeline({
      label: 'quad', layout: device.createPipelineLayout({ bindGroupLayouts: [viewLayout, spriteLayout] }),
      vertex: { module: quadModule, entryPoint: 'vs', buffers: [{ arrayStride: 48, attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x4' },
        { shaderLocation: 1, offset: 16, format: 'float32x4' },
        { shaderLocation: 2, offset: 32, format: 'float32x4' },
      ] }] },
      fragment: { module: quadModule, entryPoint: 'fs', targets: [{ format, blend }] },
      primitive: { topology: 'triangle-list' }, multisample,
    });
    const blitModule = module(BLIT_WGSL, 'blit');
    this.blitPipeline = device.createRenderPipeline({
      label: 'blit', layout: device.createPipelineLayout({ bindGroupLayouts: [this.blitLayout] }),
      vertex: { module: blitModule, entryPoint: 'vs' },
      fragment: { module: blitModule, entryPoint: 'fs', targets: [{ format, blend }] },
      primitive: { topology: 'triangle-list' }, multisample,
    });

    this.viewGroups = this.viewBuffers.map((buffer) => device.createBindGroup({ layout: viewLayout, entries: [
      { binding: 0, resource: { buffer } },
      { binding: 1, resource: { buffer: this.rowsBuffer } },
      { binding: 2, resource: { buffer: this.attrsBuffer } },
    ] }));
    this.backdropGroup = device.createBindGroup({ layout: backdropLayout, entries: [
      { binding: 0, resource: this.backdropSampler },
      { binding: 1, resource: this.backdropTexture.createView({ dimension: '2d-array' }) },
    ] });
    this.spriteGroup = device.createBindGroup({ layout: spriteLayout, entries: [
      { binding: 0, resource: this.spriteSampler },
      { binding: 1, resource: this.atlasTexture.createView({ dimension: '2d-array' }) },
      { binding: 2, resource: this.carTexture.createView({ dimension: '2d-array' }) },
      { binding: 3, resource: { buffer: this.paletteBuffer } },
    ] });

    if (this.gpu.canTimestamp) {
      this.querySet = device.createQuerySet({ type: 'timestamp', count: 2 });
      this.queryResolve = device.createBuffer({ size: 16, usage: B.QUERY_RESOLVE | B.COPY_SRC });
      this.queryReads = [0, 1, 2].map(() => {
        const read = { buffer: device.createBuffer({ size: 16, usage: B.MAP_READ | B.COPY_DST }), busy: false, done: null, fail: null };
        read.done = () => {
          const t = new BigUint64Array(read.buffer.getMappedRange());
          const ns = Number(t[1] - t[0]);
          if (ns > 0 && ns < 1e9) { this.gpuTimeMs = ns / 1e6; this.gpuTimeSerial++; }
          read.buffer.unmap();
          read.busy = false;
        };
        read.fail = () => { read.busy = false; };
        return read;
      });
    }
    this.timingEnabled = false;
    this.passDescriptor = {
      colorAttachments: [{ view: null, resolveTarget: undefined, clearValue: { r: 0.06, g: 0.06, b: 0.08, a: 1 }, loadOp: 'clear', storeOp: 'store' }],
    };
    this.timestampWrites = this.querySet ? { querySet: this.querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 } : null;
    this.mipCanvases = new Map();
  }

  /** (Re)create size dependent targets. */
  resize(width, height) {
    if (width === this.width && height === this.height) return;
    this.width = width; this.height = height;
    const device = this.device;
    if (this.msaaTexture) this.msaaTexture.destroy();
    this.msaaTexture = null;
    if (this.sampleCount > 1) {
      this.msaaTexture = device.createTexture({ size: [width, height], format: this.gpu.format, sampleCount: this.sampleCount, usage: GPUTextureUsage.RENDER_ATTACHMENT });
      this.msaaView = this.msaaTexture.createView();
    }
    if (this.pageTexture) this.pageTexture.destroy();
    this.pageTexture = device.createTexture({ size: [width, height], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    this.blitGroup = device.createBindGroup({ layout: this.blitLayout, entries: [
      { binding: 0, resource: { buffer: this.blitBuffer } },
      { binding: 1, resource: this.pageSampler },
      { binding: 2, resource: this.pageTexture.createView() },
    ] });
  }

  setTrackAttributes(data) { this.device.queue.writeBuffer(this.attrsBuffer, 0, data); }
  setPalette(data) { this.device.queue.writeBuffer(this.paletteBuffer, 0, data); }

  /** Upload a painted canvas into one layer of a texture array, generating mip levels. */
  uploadLayer(kind, layer, canvas) {
    const texture = kind === 'atlas' ? this.atlasTexture : kind === 'cars' ? this.carTexture : this.backdropTexture;
    const queue = this.device.queue;
    let source = canvas, w = canvas.width, h = canvas.height;
    for (let level = 0; level < texture.mipLevelCount; level++) {
      if (level > 0) {
        w = Math.max(1, w >> 1); h = Math.max(1, h >> 1);
        const key = `${w}x${h}`;
        let mip = this.mipCanvases.get(key);
        if (!mip) { mip = makeCanvas(w, h); this.mipCanvases.set(key, mip); }
        const ctx = mip.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, 0, 0, w, h);
        source = mip;
      }
      queue.copyExternalImageToTexture({ source }, { texture, mipLevel: level, origin: { x: 0, y: 0, z: layer }, premultipliedAlpha: true }, { width: w, height: h });
    }
  }

  /** Upload the interface page (a canvas the size of the framebuffer). */
  uploadPage(canvas) {
    if (!this.pageTexture || canvas.width !== this.width || canvas.height !== this.height) return;
    this.device.queue.copyExternalImageToTexture({ source: canvas }, { texture: this.pageTexture, premultipliedAlpha: true }, { width: this.width, height: this.height });
  }

  /**
   * Draw one frame.
   * frame: { viewCount, views[{ rect, uniforms, rows, rowCount, sceneStart, sceneCount, frontStart, frontCount, overlay, scene }],
   *          quads (QuadBatch), page: { visible, alpha, wipe } }
   */
  render(frame) {
    const device = this.device, queue = device.queue;
    const quads = frame.quads;
    if (quads.count > 0) queue.writeBuffer(this.quadBuffer, 0, quads.data, 0, quads.count * QUAD_FLOATS);
    for (let v = 0; v < frame.viewCount; v++) {
      const view = frame.views[v];
      queue.writeBuffer(this.viewBuffers[v], 0, view.uniforms);
      if (view.scene) queue.writeBuffer(this.rowsBuffer, v * MAX_ROWS * ROW_FLOATS * 4, view.rows, 0, view.rowCount * ROW_FLOATS);
    }
    const page = frame.page;
    if (page.visible) {
      const b = this.blitData;
      b[0] = page.alpha; b[1] = page.wipe; b[2] = 0; b[3] = 0; b[4] = this.width; b[5] = this.height;
      queue.writeBuffer(this.blitBuffer, 0, b);
    }
    const encoder = device.createCommandEncoder();
    const attachment = this.passDescriptor.colorAttachments[0];
    const swapView = this.gpu.context.getCurrentTexture().createView();
    if (this.msaaTexture) { attachment.view = this.msaaView; attachment.resolveTarget = swapView; }
    else { attachment.view = swapView; attachment.resolveTarget = undefined; }
    this.passDescriptor.timestampWrites = this.timingEnabled && this.timestampWrites ? this.timestampWrites : undefined;
    const pass = encoder.beginRenderPass(this.passDescriptor);
    let draws = 0;
    for (let v = 0; v < frame.viewCount; v++) {
      const view = frame.views[v], r = view.rect;
      pass.setViewport(r.x, r.y, r.w, r.h, 0, 1);
      pass.setScissorRect(r.x, r.y, r.w, r.h);
      pass.setBindGroup(0, this.viewGroups[v]);
      if (view.scene) {
        pass.setPipeline(this.skyPipeline);
        pass.setBindGroup(1, this.backdropGroup);
        pass.draw(3);
        pass.setPipeline(this.roadPipeline);
        pass.draw(3);
        draws += 2;
      }
      if (view.sceneCount > 0 || view.frontCount > 0) {
        pass.setPipeline(this.quadPipeline);
        pass.setBindGroup(1, this.spriteGroup);
        pass.setVertexBuffer(0, this.quadBuffer);
        pass.setIndexBuffer(this.indexBuffer, 'uint32');
      }
      if (view.sceneCount > 0) { pass.drawIndexed(view.sceneCount * 6, 1, view.sceneStart * 6); draws++; }
      if (view.overlay) {
        pass.setPipeline(this.overlayPipeline);
        pass.draw(3);
        draws++;
        if (view.frontCount > 0) pass.setPipeline(this.quadPipeline);
      }
      if (view.frontCount > 0) { pass.drawIndexed(view.frontCount * 6, 1, view.frontStart * 6); draws++; }
    }
    if (page.visible) {
      pass.setViewport(0, 0, this.width, this.height, 0, 1);
      pass.setScissorRect(0, 0, this.width, this.height);
      pass.setPipeline(this.blitPipeline);
      pass.setBindGroup(0, this.blitGroup);
      pass.draw(3);
      draws++;
    }
    pass.end();
    let read = null;
    if (this.querySet && this.timingEnabled) {
      for (let i = 0; i < this.queryReads.length; i++) if (!this.queryReads[i].busy) { read = this.queryReads[i]; break; }
      if (read) {
        encoder.resolveQuerySet(this.querySet, 0, 2, this.queryResolve, 0);
        encoder.copyBufferToBuffer(this.queryResolve, 0, read.buffer, 0, 16);
      }
    }
    queue.submit([encoder.finish()]);
    if (read) {
      read.busy = true;
      read.buffer.mapAsync(GPUMapMode.READ).then(read.done, read.fail);
    }
    this.stats.quads = quads.count; this.stats.draws = draws;
  }
}
