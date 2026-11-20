// Graphics quality presets. Every field can be overridden individually from the options menu.

export const QUALITY_PRESETS = {
  low: { id: 'low', renderScale: 0.6, shadowSize: 1024, ssao: false, bloom: true, motionBlur: 0, anisotropy: 2, propDistance: 500, lodDistance: 70, shadowDistance: 160, particles: 0.5 },
  medium: { id: 'medium', renderScale: 0.8, shadowSize: 2048, ssao: true, bloom: true, motionBlur: 0.3, anisotropy: 4, propDistance: 800, lodDistance: 110, shadowDistance: 220, particles: 0.8 },
  high: { id: 'high', renderScale: 1, shadowSize: 2048, ssao: true, bloom: true, motionBlur: 0.4, anisotropy: 8, propDistance: 1100, lodDistance: 150, shadowDistance: 280, particles: 1 },
  ultra: { id: 'ultra', renderScale: 1, shadowSize: 4096, ssao: true, bloom: true, motionBlur: 0.4, anisotropy: 16, propDistance: 1600, lodDistance: 220, shadowDistance: 340, particles: 1 },
};
export const QUALITY_ORDER = ['low', 'medium', 'high', 'ultra'];

export function resolveQuality(id, overrides) {
  return { ...(QUALITY_PRESETS[id] || QUALITY_PRESETS.high), ...(overrides || {}) };
}
