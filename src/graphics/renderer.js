// WebGPU renderer: owns pipelines, GPU buffers and per-view render targets, and draws a frame
// described by plain data (cameras, instance arrays, particle arrays). It knows nothing about
// game rules. One code path serves one or several views (split screen).

import {
  mat4Create, mat4Multiply, mat4Invert, mat4PerspectiveReverseZ, mat4Ortho, mat4LookAt, halton,
} from '../core/math.js';
import { VIEW_UNIFORM_FLOATS, VIEW_OFFSETS as O } from './shaders/common.wgsl.js';
import { MESH_WGSL, SHADOW_WGSL } from './shaders/mesh.wgsl.js';
import { SKY_WGSL, PARTICLE_WGSL, DECAL_WGSL } from './shaders/effects.wgsl.js';
import { SSAO_WGSL, TAA_WGSL, BLOOM_WGSL, COMPOSITE_WGSL } from './shaders/post.wgsl.js';
import { VERTEX_STRIDE } from './mesh-builder.js';
import { createNoiseTexture, createAtlasTexture } from './procedural-textures.js';

export const MAX_CARS = 20;
export const CAR_INSTANCE_FLOATS = 40;
export const PROP_INSTANCE_FLOATS = 16;
export const CAR_PART = { BODY: 0, DRIVER: 1, STEERING: 2, WHEEL_FRONT: 3, WHEEL_REAR: 5 };
export const CAR_INSTANCE_SLOTS = MAX_CARS * 7;
export const MAX_PARTICLES = 3072;
export const PARTICLE_FLOATS = 12;
export const MAX_DECAL_QUADS = 3072;
export const DECAL_VERTEX_FLOATS = 7;
const BLOOM_LEVELS = 5;
const CASCADES = 3;
const HDR = 'rgba16float';

const VERTEX_LAYOUT = {
  arrayStride: VERTEX_STRIDE,
  attributes: [
    { shaderLocation: 0, offset: 0, format: 'float32x3' },
    { shaderLocation: 1, offset: 12, format: 'snorm16x4' },
    { shaderLocation: 2, offset: 20, format: 'float32x2' },
    { shaderLocation: 3, offset: 28, format: 'unorm8x4' },
  ],
};
const f4 = (shaderLocation, offset) => ({ shaderLocation, offset, format: 'float32x4' });
const STATIC_INSTANCE_LAYOUT = {
  arrayStride: 64, stepMode: 'instance',
  attributes: [f4(4, 0), f4(5, 16), f4(6, 32), f4(7, 0), f4(8, 16), f4(9, 32), f4(10, 48), f4(11, 48), f4(12, 48), f4(13, 48)],
};
const DYNAMIC_INSTANCE_LAYOUT = {
  arrayStride: 160, stepMode: 'instance',
  attributes: [f4(4, 0), f4(5, 16), f4(6, 32), f4(7, 48), f4(8, 64), f4(9, 80), f4(10, 96), f4(11, 112), f4(12, 128), f4(13, 144)],
};

export class Renderer {
  constructor(gpu, quality) {
    this.gpu = gpu;
    this.device = gpu.device;
    this.context = gpu.context;
    this.quality = quality;
    this.views = [];
    this.world = null;
    this.carMesh = null;
    this.frameIndex = 0;
    this.carInstanceData = new Float32Array(CAR_INSTANCE_SLOTS * CAR_INSTANCE_FLOATS);
    this.particleData = new Float32Array(MAX_PARTICLES * PARTICLE_FLOATS);
    this.decalData = new Float32Array(MAX_DECAL_QUADS * 4 * DECAL_VERTEX_FLOATS);
    this.decalDirtyFrom = 0; this.decalDirtyTo = 0;
    this.gpuTimeMs = 0;
    this.timingEnabled = false;
    this.stats = { draws: 0, chunks: 0 };
    this.scratch = {
      proj: mat4Create(), viewProj: mat4Create(), clean: mat4Create(), inv: mat4Create(), projClean: mat4Create(),
      lightView: mat4Create(), lightProj: mat4Create(), planes: new Float32Array(20),
      cascadeCentre: new Float32Array(CASCADES * 4),
    };
    this.env = null;
  }

  init() {
    const device = this.device, q = this.quality;
    this.noiseTexture = createNoiseTexture(device);
    this.atlasTexture = createAtlasTexture(device);
    this.noiseSampler = device.createSampler({
      addressModeU: 'repeat', addressModeV: 'repeat', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear',
      maxAnisotropy: q.anisotropy,
    });
    this.linearSampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    this.shadowSampler = device.createSampler({ compare: 'less-equal', magFilter: 'linear', minFilter: 'linear' });
    this.shadowTexture = device.createTexture({
      label: 'shadow-cascades', size: [q.shadowSize, q.shadowSize, CASCADES], format: 'depth32float',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
    });
    this.shadowArrayView = this.shadowTexture.createView({ dimension: '2d-array' });
    this.shadowLayerViews = [];
    for (let i = 0; i < CASCADES; i++) this.shadowLayerViews.push(this.shadowTexture.createView({ dimension: '2d', baseArrayLayer: i, arrayLayerCount: 1 }));

    this.sceneLayout = device.createBindGroupLayout({
      label: 'scene', entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
        { binding: 4, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'depth', viewDimension: '2d-array' } },
        { binding: 5, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'comparison' } },
      ],
    });
    this.shadowLayout = device.createBindGroupLayout({
      label: 'shadow', entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }],
    });
    const scenePipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout] });
    const shadowPipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [this.shadowLayout] });

    const meshModule = this.module('mesh', MESH_WGSL);
    const shadowModule = this.module('shadow', SHADOW_WGSL);
    const targets = [{ format: HDR }, { format: 'rg16float' }];
    const depthMain = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'greater' };
    const meshPipeline = (label, instanceLayout) => device.createRenderPipeline({
      label, layout: scenePipelineLayout,
      vertex: { module: meshModule, entryPoint: 'vs_main', buffers: [VERTEX_LAYOUT, instanceLayout] },
      fragment: { module: meshModule, entryPoint: 'fs_main', targets },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: depthMain,
    });
    this.meshStatic = meshPipeline('mesh-static', STATIC_INSTANCE_LAYOUT);
    this.meshDynamic = meshPipeline('mesh-dynamic', DYNAMIC_INSTANCE_LAYOUT);
    const shadowPipeline = (label, instanceLayout) => device.createRenderPipeline({
      label, layout: shadowPipelineLayout,
      vertex: { module: shadowModule, entryPoint: 'vs_shadow', buffers: [VERTEX_LAYOUT, instanceLayout] },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less', depthBias: 2, depthBiasSlopeScale: 2.5 },
    });
    this.shadowStatic = shadowPipeline('shadow-static', STATIC_INSTANCE_LAYOUT);
    this.shadowDynamic = shadowPipeline('shadow-dynamic', DYNAMIC_INSTANCE_LAYOUT);

    const skyModule = this.module('sky', SKY_WGSL);
    this.skyPipeline = device.createRenderPipeline({
      label: 'sky', layout: scenePipelineLayout,
      vertex: { module: skyModule, entryPoint: 'vs_sky' },
      fragment: { module: skyModule, entryPoint: 'fs_sky', targets },
      primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'equal' },
    });
    const premultiplied = { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
    const blendTargets = [{ format: HDR, blend: premultiplied }, { format: 'rg16float', writeMask: 0 }];
    const particleModule = this.module('particle', PARTICLE_WGSL);
    this.particlePipeline = device.createRenderPipeline({
      label: 'particles', layout: scenePipelineLayout,
      vertex: {
        module: particleModule, entryPoint: 'vs_particle',
        buffers: [{ arrayStride: PARTICLE_FLOATS * 4, stepMode: 'instance', attributes: [f4(0, 0), f4(1, 16), f4(2, 32)] }],
      },
      fragment: { module: particleModule, entryPoint: 'fs_particle', targets: blendTargets },
      primitive: { topology: 'triangle-strip' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater' },
    });
    const decalModule = this.module('decal', DECAL_WGSL);
    this.decalPipeline = device.createRenderPipeline({
      label: 'decals', layout: scenePipelineLayout,
      vertex: {
        module: decalModule, entryPoint: 'vs_decal',
        buffers: [{ arrayStride: DECAL_VERTEX_FLOATS * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x4' }] }],
      },
      fragment: { module: decalModule, entryPoint: 'fs_decal', targets: blendTargets },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: false, depthCompare: 'greater-equal', depthBias: 24, depthBiasSlopeScale: 2 },
    });

    const post = (label, code, entry, format, blend) => {
      const module = this.module(label, code);
      return device.createRenderPipeline({
        label, layout: 'auto',
        vertex: { module, entryPoint: 'vs_fullscreen' },
        fragment: { module, entryPoint: entry, targets: [blend ? { format, blend } : { format }] },
        primitive: { topology: 'triangle-list' },
      });
    };
    const additive = { color: { srcFactor: 'one', dstFactor: 'one' }, alpha: { srcFactor: 'one', dstFactor: 'one' } };
    this.ssaoPipeline = post('ssao', SSAO_WGSL, 'fs_ssao', 'r8unorm');
    this.taaPipeline = post('taa', TAA_WGSL, 'fs_taa', HDR);
    this.bloomPrefilter = post('bloom-prefilter', BLOOM_WGSL, 'fs_prefilter', HDR);
    this.bloomDown = post('bloom-down', BLOOM_WGSL, 'fs_down', HDR);
    this.bloomUp = post('bloom-up', BLOOM_WGSL, 'fs_up', HDR, additive);
    this.compositePipeline = post('composite', COMPOSITE_WGSL, 'fs_composite', this.gpu.format);

    // Shared dynamic buffers.
    const identity = new Float32Array(PROP_INSTANCE_FLOATS);
    identity[0] = 1; identity[5] = 1; identity[10] = 1; identity[12] = 1; identity[13] = 1; identity[14] = 1; identity[15] = 0;
    this.identityInstance = this.createBuffer('identity-instance', identity, GPUBufferUsage.VERTEX);
    this.carInstanceBuffer = device.createBuffer({ label: 'car-instances', size: this.carInstanceData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    this.particleBuffer = device.createBuffer({ label: 'particles', size: this.particleData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    this.decalBuffer = device.createBuffer({ label: 'decals', size: this.decalData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    const decalIndices = new Uint16Array(MAX_DECAL_QUADS * 6);
    for (let i = 0; i < MAX_DECAL_QUADS; i++) decalIndices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    this.decalIndexBuffer = this.createBuffer('decal-indices', decalIndices, GPUBufferUsage.INDEX);

    this.compositePass = { colorAttachments: [{ view: null, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] };
    if (this.gpu.canTimestamp) {
      this.querySet = device.createQuerySet({ type: 'timestamp', count: 2 });
      this.queryResolve = device.createBuffer({ size: 16, usage: GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC });
      this.queryRead = [0, 1, 2].map(() => device.createBuffer({ size: 16, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST }));
      this.queryFree = this.queryRead.slice();
    }
  }

  module(label, code) {
    const module = this.device.createShaderModule({ label, code });
    module.getCompilationInfo().then((info) => {
      for (const m of info.messages) {
        if (m.type === 'error') console.error(`[wgsl:${label}] ${m.lineNum}:${m.linePos} ${m.message}`);
      }
    });
    return module;
  }

  createBuffer(label, data, usage) {
    const buffer = this.device.createBuffer({ label, size: Math.ceil(data.byteLength / 4) * 4, usage: usage | GPUBufferUsage.COPY_DST, mappedAtCreation: true });
    new Uint8Array(buffer.getMappedRange()).set(new Uint8Array(data.buffer || data, data.byteOffset || 0, data.byteLength));
    buffer.unmap();
    return buffer;
  }

  /** Upload the car geometry. mesh: { vertexData, indexData, parts: { body, driver, steering, wheelFront, wheelRear } }. */
  setCarMesh(mesh) {
    this.carMesh = {
      vertexBuffer: this.createBuffer('car-vertices', new Uint8Array(mesh.vertexData), GPUBufferUsage.VERTEX),
      indexBuffer: this.createBuffer('car-indices', mesh.indexData, GPUBufferUsage.INDEX),
      parts: mesh.parts,
    };
  }

  /**
   * Upload a circuit. world: { vertexData, indexData, chunks, propMeshes, propInstances, propBatches, environment }.
   */
  setWorld(world) {
    if (this.world) {
      this.world.vertexBuffer.destroy(); this.world.indexBuffer.destroy(); this.world.propInstanceBuffer.destroy();
    }
    const instances = world.propInstances.length ? world.propInstances : new Float32Array(PROP_INSTANCE_FLOATS);
    this.world = {
      ...world,
      vertexBuffer: this.createBuffer('world-vertices', new Uint8Array(world.vertexData), GPUBufferUsage.VERTEX),
      indexBuffer: this.createBuffer('world-indices', world.indexData, GPUBufferUsage.INDEX),
      propInstanceBuffer: this.createBuffer('prop-instances', instances, GPUBufferUsage.VERTEX),
      visible: new Uint8Array(world.chunks.length),
      distance: new Float32Array(world.chunks.length),
    };
    this.env = world.environment;
    this.decalData.fill(0);
    this.decalDirtyFrom = 0; this.decalDirtyTo = this.decalData.length;
    for (const view of this.views) view.historyValid = false;
  }

  /** Define the viewports (canvas pixel rectangles). Recreates render targets when sizes change. */
  configureViews(rects) {
    const scale = this.quality.renderScale;
    while (this.views.length > rects.length) this.destroyView(this.views.pop());
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const w = Math.max(8, Math.round(r.w * scale)), h = Math.max(8, Math.round(r.h * scale));
      let view = this.views[i];
      if (!view || view.width !== w || view.height !== h) {
        if (view) this.destroyView(view);
        view = this.createView(w, h);
        this.views[i] = view;
      }
      view.rect = { x: r.x, y: r.y, w: r.w, h: r.h };
    }
  }

  destroyView(view) {
    for (const t of view.textures) t.destroy();
    view.ubo.destroy();
    for (const b of view.cascadeUbo) b.destroy();
  }

  createView(width, height) {
    const device = this.device;
    const textures = [];
    const tex = (label, format, w, h) => {
      const t = device.createTexture({ label, size: [w, h], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING });
      textures.push(t);
      return t.createView();
    };
    const view = {
      width, height, textures, rect: null, historyIndex: 0, historyValid: false,
      uboData: new Float32Array(VIEW_UNIFORM_FLOATS),
      prevViewProj: mat4Create(), hasPrev: false,
      cascadeData: [0, 1, 2].map(() => new Float32Array(16)),
    };
    view.ubo = device.createBuffer({ label: 'view-uniforms', size: VIEW_UNIFORM_FLOATS * 4, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    view.cascadeUbo = [0, 1, 2].map(() => device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST }));
    view.cascadeBind = view.cascadeUbo.map((buffer) => device.createBindGroup({ layout: this.shadowLayout, entries: [{ binding: 0, resource: { buffer } }] }));
    const color = tex('scene-color', HDR, width, height);
    const velocity = tex('velocity', 'rg16float', width, height);
    const depth = tex('depth', 'depth32float', width, height);
    const hw = Math.max(1, width >> 1), hh = Math.max(1, height >> 1);
    const ao = tex('ao', 'r8unorm', hw, hh);
    const history = [tex('history-a', HDR, width, height), tex('history-b', HDR, width, height)];
    const bloom = [];
    for (let i = 0; i < BLOOM_LEVELS; i++) bloom.push(tex(`bloom-${i}`, HDR, Math.max(1, width >> (i + 1)), Math.max(1, height >> (i + 1))));
    view.mainBind = device.createBindGroup({
      layout: this.sceneLayout, entries: [
        { binding: 0, resource: { buffer: view.ubo } },
        { binding: 1, resource: this.noiseTexture.createView() },
        { binding: 2, resource: this.noiseSampler },
        { binding: 3, resource: this.atlasTexture.createView() },
        { binding: 4, resource: this.shadowArrayView },
        { binding: 5, resource: this.shadowSampler },
      ],
    });
    const group = (pipeline, resources) => device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0), entries: resources.map((resource, binding) => ({ binding, resource })),
    });
    const ubo = { buffer: view.ubo };
    view.ssaoBind = group(this.ssaoPipeline, [ubo, depth]);
    view.taaBind = [0, 1].map((i) => group(this.taaPipeline, [ubo, color, velocity, depth, history[1 - i], ao, this.linearSampler]));
    view.prefilterBind = [0, 1].map((i) => group(this.bloomPrefilter, [history[i], this.linearSampler]));
    view.downBind = bloom.map((b, i) => (i === 0 ? null : group(this.bloomDown, [bloom[i - 1], this.linearSampler])));
    view.upBind = bloom.map((b, i) => (i === BLOOM_LEVELS - 1 ? null : group(this.bloomUp, [bloom[i + 1], this.linearSampler])));
    view.compositeBind = [0, 1].map((i) => group(this.compositePipeline, [ubo, history[i], velocity, bloom[0], this.linearSampler]));
    const colorPass = (target, clear) => ({ colorAttachments: [{ view: target, clearValue: clear || { r: 0, g: 0, b: 0, a: 1 }, loadOp: clear === null ? 'load' : 'clear', storeOp: 'store' }] });
    view.shadowPass = this.shadowLayerViews.map((layer) => ({
      colorAttachments: [], depthStencilAttachment: { view: layer, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' },
    }));
    view.mainPass = {
      colorAttachments: [
        { view: color, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' },
        { view: velocity, clearValue: { r: 0, g: 0, b: 0, a: 0 }, loadOp: 'clear', storeOp: 'store' },
      ],
      depthStencilAttachment: { view: depth, depthClearValue: 0, depthLoadOp: 'clear', depthStoreOp: 'store' },
    };
    view.ssaoPass = colorPass(ao, { r: 1, g: 1, b: 1, a: 1 });
    view.taaPass = history.map((h) => colorPass(h));
    view.bloomDownPass = bloom.map((b) => colorPass(b));
    view.bloomUpPass = bloom.map((b) => colorPass(b, null));
    return view;
  }

  /** Mark a range of decal quads as modified (uploaded on the next frame). */
  markDecals(firstQuad, quadCount) {
    const from = firstQuad * 4 * DECAL_VERTEX_FLOATS, to = (firstQuad + quadCount) * 4 * DECAL_VERTEX_FLOATS;
    if (this.decalDirtyTo <= this.decalDirtyFrom) { this.decalDirtyFrom = from; this.decalDirtyTo = to; }
    else { this.decalDirtyFrom = Math.min(this.decalDirtyFrom, from); this.decalDirtyTo = Math.max(this.decalDirtyTo, to); }
  }

  /**
   * Draw one frame.
   * frame: { time, cameras: Camera[], carCount, particleCount, hideDrivers: number[] }
   */
  render(frame) {
    const device = this.device;
    if (!this.world || !this.carMesh || this.views.length === 0) return;
    this.frameIndex++;
    this.stats.draws = 0;
    device.queue.writeBuffer(this.carInstanceBuffer, 0, this.carInstanceData);
    if (frame.particleCount > 0) device.queue.writeBuffer(this.particleBuffer, 0, this.particleData, 0, frame.particleCount * PARTICLE_FLOATS);
    if (this.decalDirtyTo > this.decalDirtyFrom) {
      device.queue.writeBuffer(this.decalBuffer, this.decalDirtyFrom * 4, this.decalData, this.decalDirtyFrom, this.decalDirtyTo - this.decalDirtyFrom);
      this.decalDirtyFrom = 0; this.decalDirtyTo = 0;
    }
    const encoder = device.createCommandEncoder();
    const timing = this.timingEnabled && this.querySet && this.queryFree.length > 0;
    const count = Math.min(this.views.length, frame.cameras.length);
    for (let v = 0; v < count; v++) {
      this.renderView(encoder, this.views[v], frame.cameras[v], frame, frame.hideDrivers ? frame.hideDrivers[v] : -1, timing && v === 0);
    }
    this.compositePass.colorAttachments[0].view = this.context.getCurrentTexture().createView();
    this.compositePass.timestampWrites = timing ? { querySet: this.querySet, endOfPassWriteIndex: 1 } : undefined;
    const pass = encoder.beginRenderPass(this.compositePass);
    pass.setPipeline(this.compositePipeline);
    for (let v = 0; v < count; v++) {
      const view = this.views[v], r = view.rect;
      pass.setViewport(r.x, r.y, r.w, r.h, 0, 1);
      pass.setScissorRect(r.x, r.y, r.w, r.h);
      pass.setBindGroup(0, view.compositeBind[view.historyIndex]);
      pass.draw(3);
    }
    pass.end();
    let readBuffer = null;
    if (timing) {
      readBuffer = this.queryFree.pop();
      encoder.resolveQuerySet(this.querySet, 0, 2, this.queryResolve, 0);
      encoder.copyBufferToBuffer(this.queryResolve, 0, readBuffer, 0, 16);
    }
    device.queue.submit([encoder.finish()]);
    if (readBuffer) {
      readBuffer.mapAsync(GPUMapMode.READ).then(() => {
        const t = new BigUint64Array(readBuffer.getMappedRange());
        const ns = Number(t[1] - t[0]);
        if (ns > 0 && ns < 5e9) this.gpuTimeMs = ns / 1e6;
        readBuffer.unmap();
        this.queryFree.push(readBuffer);
      }).catch(() => { this.queryFree.push(readBuffer); });
    }
    for (let v = 0; v < count; v++) {
      const view = this.views[v];
      view.historyIndex = 1 - view.historyIndex;
      view.historyValid = true;
    }
  }

  writeViewUniforms(view, camera, frame) {
    const s = this.scratch, u = view.uboData, env = this.env, q = this.quality;
    const aspect = view.width / view.height;
    mat4PerspectiveReverseZ(s.projClean, camera.fovY, aspect, camera.near);
    s.proj.set(s.projClean);
    const jx = (halton((this.frameIndex % 8) + 1, 2) - 0.5) * 2 / view.width;
    const jy = (halton((this.frameIndex % 8) + 1, 3) - 0.5) * 2 / view.height;
    s.proj[8] = -jx; s.proj[9] = -jy;
    mat4Multiply(s.viewProj, s.proj, camera.viewMatrix);
    mat4Multiply(s.clean, s.projClean, camera.viewMatrix);
    mat4Invert(s.inv, s.clean);
    const reset = !view.hasPrev || camera.cut || !view.historyValid;
    if (reset) view.prevViewProj.set(s.clean);
    u.set(s.viewProj, O.viewProj);
    u.set(view.prevViewProj, O.prevViewProj);
    u.set(s.clean, O.cleanViewProj);
    u.set(s.inv, O.invViewProj);
    view.prevViewProj.set(s.clean);
    view.hasPrev = true;
    this.computeCascades(view, camera, aspect);
    for (let c = 0; c < CASCADES; c++) u.set(view.cascadeData[c], O.shadowMat + c * 16);
    const set4 = (o, a, b, c, d) => { u[o] = a; u[o + 1] = b; u[o + 2] = c; u[o + 3] = d; };
    set4(O.cameraPos, camera.eye[0], camera.eye[1], camera.eye[2], frame.time);
    set4(O.sunDir, env.sunDir[0], env.sunDir[1], env.sunDir[2], 1.35);
    set4(O.sunColor, env.sunColor[0], env.sunColor[1], env.sunColor[2], env.exposure);
    set4(O.zenithColor, env.zenith[0], env.zenith[1], env.zenith[2], env.cloudCoverage);
    set4(O.horizonColor, env.horizon[0], env.horizon[1], env.horizon[2], env.cloudScale);
    set4(O.groundColor, env.groundLit[0], env.groundLit[1], env.groundLit[2], env.fogDensity);
    set4(O.fogColor, env.fogColor[0], env.fogColor[1], env.fogColor[2], env.fogFalloff);
    set4(O.ambient, env.skyAmbient, env.groundAmbient, q.ssao ? 0.85 : 0, camera.noMotionBlur ? 0 : q.motionBlur);
    const sd = q.shadowDistance;
    set4(O.cascadeSplits, sd * 0.07, sd * 0.27, sd, 1 / q.shadowSize);
    set4(O.viewport, view.width, view.height, 1 / view.width, 1 / view.height);
    set4(O.jitter, jx * 0.5, -jy * 0.5, reset ? -100 : 0, 0);
    set4(O.trackParams, env.trackHalfWidth, 3.2, q.bloom ? env.bloom : 0, this.frameIndex % 64);
    set4(O.kerbColor, env.kerbColor[0], env.kerbColor[1], env.kerbColor[2], 0);
    set4(O.grassColor, env.grass[0], env.grass[1], env.grass[2], 0);
    set4(O.grassColor2, env.grass2[0], env.grass2[1], env.grass2[2], 0);
    set4(O.gravelColor, env.gravel[0], env.gravel[1], env.gravel[2], 0);
    set4(O.cameraRight, camera.right[0], camera.right[1], camera.right[2], camera.near);
    set4(O.cameraUp, camera.up[0], camera.up[1], camera.up[2], Math.tan(camera.fovY / 2));
    set4(O.outputRect, view.rect.x, view.rect.y, view.rect.w, view.rect.h);
    this.device.queue.writeBuffer(view.ubo, 0, u);
    for (let c = 0; c < CASCADES; c++) this.device.queue.writeBuffer(view.cascadeUbo[c], 0, view.cascadeData[c]);
    // Frustum planes (left, right, bottom, top, near) from the unjittered matrix.
    const m = s.clean, p = s.planes;
    const plane = (i, a, b, c, d) => { const l = Math.hypot(a, b, c) || 1; p[i * 4] = a / l; p[i * 4 + 1] = b / l; p[i * 4 + 2] = c / l; p[i * 4 + 3] = d / l; };
    plane(0, m[3] + m[0], m[7] + m[4], m[11] + m[8], m[15] + m[12]);
    plane(1, m[3] - m[0], m[7] - m[4], m[11] - m[8], m[15] - m[12]);
    plane(2, m[3] + m[1], m[7] + m[5], m[11] + m[9], m[15] + m[13]);
    plane(3, m[3] - m[1], m[7] - m[5], m[11] - m[9], m[15] - m[13]);
    plane(4, camera.forward[0], camera.forward[1], camera.forward[2], -(camera.forward[0] * camera.eye[0] + camera.forward[1] * camera.eye[1] + camera.forward[2] * camera.eye[2]));
  }

  computeCascades(view, camera, aspect) {
    const s = this.scratch, env = this.env, q = this.quality;
    const tanY = Math.tan(camera.fovY / 2), tanX = tanY * aspect;
    const k2 = tanX * tanX + tanY * tanY;
    const sd = q.shadowDistance;
    const splits = [camera.near, sd * 0.07, sd * 0.27, sd];
    const L = env.sunDir;
    // light basis
    let ux = 0, uy = 1, uz = 0;
    if (Math.abs(L[1]) > 0.95) { ux = 1; uy = 0; }
    let rx = uy * L[2] - uz * L[1], ry = uz * L[0] - ux * L[2], rz = ux * L[1] - uy * L[0];
    const rl = Math.hypot(rx, ry, rz); rx /= rl; ry /= rl; rz /= rl;
    const vx = L[1] * rz - L[2] * ry, vy = L[2] * rx - L[0] * rz, vz = L[0] * ry - L[1] * rx;
    for (let c = 0; c < CASCADES; c++) {
      const n = splits[c], f = splits[c + 1];
      let centreDist, radius;
      if (k2 >= (f - n) / (f + n)) { centreDist = f; radius = f * Math.sqrt(k2); }
      else { centreDist = 0.5 * (f + n) * (1 + k2); radius = Math.sqrt((f - centreDist) * (f - centreDist) + f * f * k2); }
      radius = Math.ceil(radius * 16) / 16;
      let cx = camera.eye[0] + camera.forward[0] * centreDist;
      let cy = camera.eye[1] + camera.forward[1] * centreDist;
      let cz = camera.eye[2] + camera.forward[2] * centreDist;
      // snap to shadow texels to keep the shadows stable while the camera moves
      const texel = (2 * radius) / q.shadowSize;
      const lx = cx * rx + cy * ry + cz * rz, ly = cx * vx + cy * vy + cz * vz;
      const dx = Math.round(lx / texel) * texel - lx, dy = Math.round(ly / texel) * texel - ly;
      cx += rx * dx + vx * dy; cy += ry * dx + vy * dy; cz += rz * dx + vz * dy;
      const back = radius + 260;
      mat4LookAt(s.lightView, cx + L[0] * back, cy + L[1] * back, cz + L[2] * back, cx, cy, cz, vx, vy, vz);
      mat4Ortho(s.lightProj, -radius, radius, -radius, radius, 1, back + radius + 60);
      mat4Multiply(view.cascadeData[c], s.lightProj, s.lightView);
      s.cascadeCentre[c * 4] = cx; s.cascadeCentre[c * 4 + 1] = cy; s.cascadeCentre[c * 4 + 2] = cz; s.cascadeCentre[c * 4 + 3] = radius;
    }
  }

  cullChunks(camera) {
    const world = this.world, p = this.scratch.planes;
    const chunks = world.chunks;
    let visibleCount = 0;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      let visible = 1;
      for (let k = 0; k < 5; k++) {
        if (p[k * 4] * c.cx + p[k * 4 + 1] * c.cy + p[k * 4 + 2] * c.cz + p[k * 4 + 3] < -c.radius) { visible = 0; break; }
      }
      world.visible[i] = visible;
      world.distance[i] = Math.max(0, Math.hypot(c.cx - camera.eye[0], c.cy - camera.eye[1], c.cz - camera.eye[2]) - c.radius);
      visibleCount += visible;
    }
    this.stats.chunks = visibleCount;
  }

  drawCars(pass, carCount, hideDriver) {
    const parts = this.carMesh.parts, N = MAX_CARS;
    pass.setVertexBuffer(0, this.carMesh.vertexBuffer);
    pass.setVertexBuffer(1, this.carInstanceBuffer);
    pass.setIndexBuffer(this.carMesh.indexBuffer, 'uint32');
    pass.drawIndexed(parts.body.count, carCount, parts.body.first, 0, 0);
    if (hideDriver >= 0 && hideDriver < carCount) {
      if (hideDriver > 0) pass.drawIndexed(parts.driver.count, hideDriver, parts.driver.first, 0, N);
      if (hideDriver < carCount - 1) pass.drawIndexed(parts.driver.count, carCount - hideDriver - 1, parts.driver.first, 0, N + hideDriver + 1);
    } else pass.drawIndexed(parts.driver.count, carCount, parts.driver.first, 0, N);
    pass.drawIndexed(parts.steering.count, carCount, parts.steering.first, 0, N * 2);
    pass.drawIndexed(parts.wheelFront.count, carCount * 2, parts.wheelFront.first, 0, N * 3);
    pass.drawIndexed(parts.wheelRear.count, carCount * 2, parts.wheelRear.first, 0, N * 5);
    this.stats.draws += 5;
  }

  drawShadowCasters(pass, cascade, carCount) {
    const world = this.world, q = this.quality, cc = this.scratch.cascadeCentre, L = this.env.sunDir;
    const cx = cc[cascade * 4], cy = cc[cascade * 4 + 1], cz = cc[cascade * 4 + 2], radius = cc[cascade * 4 + 3];
    pass.setPipeline(this.shadowDynamic);
    this.drawCars(pass, carCount, -1);
    pass.setPipeline(this.shadowStatic);
    pass.setVertexBuffer(0, world.vertexBuffer);
    pass.setIndexBuffer(world.indexBuffer, 'uint32');
    pass.setVertexBuffer(1, this.identityInstance);
    const chunks = world.chunks, inside = world.visible;
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const dx = c.cx - cx, dy = c.cy - cy, dz = c.cz - cz;
      const along = dx * L[0] + dy * L[1] + dz * L[2];
      const perp = Math.sqrt(Math.max(0, dx * dx + dy * dy + dz * dz - along * along));
      inside[i] = perp < radius + c.radius ? 1 : 0;
      if (inside[i] && c.structCount > 0) { pass.drawIndexed(c.structCount, 1, c.structFirst, 0, 0); this.stats.draws++; }
    }
    pass.setVertexBuffer(1, world.propInstanceBuffer);
    const batches = world.propBatches, meshes = world.propMeshes;
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      if (!inside[batch.chunk]) continue;
      const mesh = meshes[batch.mesh];
      if (!mesh.castShadow) continue;
      const useLod = cascade === 2 && mesh.lodCount > 0;
      pass.drawIndexed(useLod ? mesh.lodCount : mesh.count, batch.count, useLod ? mesh.lodFirst : mesh.first, 0, batch.first);
      this.stats.draws++;
    }
    void q;
  }

  renderView(encoder, view, camera, frame, hideDriver, timing) {
    const world = this.world, q = this.quality;
    this.writeViewUniforms(view, camera, frame);
    const carCount = frame.carCount;
    // ---- shadows
    for (let c = 0; c < CASCADES; c++) {
      const desc = view.shadowPass[c];
      desc.timestampWrites = timing && c === 0 ? { querySet: this.querySet, beginningOfPassWriteIndex: 0 } : undefined;
      const pass = encoder.beginRenderPass(desc);
      pass.setBindGroup(0, view.cascadeBind[c]);
      this.drawShadowCasters(pass, c, carCount);
      pass.end();
    }
    // ---- main scene
    this.cullChunks(camera);
    const pass = encoder.beginRenderPass(view.mainPass);
    pass.setBindGroup(0, view.mainBind);
    pass.setPipeline(this.meshDynamic);
    this.drawCars(pass, carCount, hideDriver);
    pass.setPipeline(this.meshStatic);
    pass.setVertexBuffer(0, world.vertexBuffer);
    pass.setIndexBuffer(world.indexBuffer, 'uint32');
    pass.setVertexBuffer(1, this.identityInstance);
    const chunks = world.chunks, visible = world.visible, distance = world.distance;
    for (let i = 0; i < chunks.length; i++) {
      if (!visible[i]) continue;
      const c = chunks[i];
      if (c.groundCount > 0) { pass.drawIndexed(c.groundCount, 1, c.groundFirst, 0, 0); this.stats.draws++; }
      if (c.structCount > 0 && distance[i] < q.propDistance * 1.5) { pass.drawIndexed(c.structCount, 1, c.structFirst, 0, 0); this.stats.draws++; }
    }
    pass.setVertexBuffer(1, world.propInstanceBuffer);
    const batches = world.propBatches, meshes = world.propMeshes;
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      if (!visible[batch.chunk]) continue;
      const mesh = meshes[batch.mesh];
      const d = distance[batch.chunk];
      if (d > q.propDistance * mesh.distanceScale) continue;
      const useLod = mesh.lodCount > 0 && d > q.lodDistance;
      pass.drawIndexed(useLod ? mesh.lodCount : mesh.count, batch.count, useLod ? mesh.lodFirst : mesh.first, 0, batch.first);
      this.stats.draws++;
    }
    pass.setPipeline(this.skyPipeline);
    pass.draw(3);
    pass.setPipeline(this.decalPipeline);
    pass.setVertexBuffer(0, this.decalBuffer);
    pass.setIndexBuffer(this.decalIndexBuffer, 'uint16');
    pass.drawIndexed(MAX_DECAL_QUADS * 6);
    if (frame.particleCount > 0) {
      pass.setPipeline(this.particlePipeline);
      pass.setVertexBuffer(0, this.particleBuffer);
      pass.draw(4, frame.particleCount);
    }
    pass.end();
    // ---- post
    const fullscreen = (desc, pipeline, bind) => {
      const p = encoder.beginRenderPass(desc);
      p.setPipeline(pipeline);
      p.setBindGroup(0, bind);
      p.draw(3);
      p.end();
    };
    if (q.ssao) fullscreen(view.ssaoPass, this.ssaoPipeline, view.ssaoBind);
    const hi = view.historyIndex;
    fullscreen(view.taaPass[hi], this.taaPipeline, view.taaBind[hi]);
    if (q.bloom) {
      fullscreen(view.bloomDownPass[0], this.bloomPrefilter, view.prefilterBind[hi]);
      for (let i = 1; i < BLOOM_LEVELS; i++) fullscreen(view.bloomDownPass[i], this.bloomDown, view.downBind[i]);
      for (let i = BLOOM_LEVELS - 2; i >= 0; i--) fullscreen(view.bloomUpPass[i], this.bloomUp, view.upBind[i]);
    }
  }
}
