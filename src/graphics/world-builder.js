// Assembles everything the renderer needs to draw a circuit.

import { getTheme, buildEnvironment } from '../tracks/themes.js';
import { buildTrackGeometry } from './track-mesh.js';
import { buildScenery } from './scenery.js';

/**
 * @returns {object} world description for Renderer.setWorld, plus tvCameras and theme.
 */
export function buildWorld(track) {
  const theme = getTheme(track.theme);
  const geometry = buildTrackGeometry(track, theme);
  const scenery = buildScenery(geometry, track, theme);
  const mesh = geometry.builder.finish();
  return {
    vertexData: mesh.vertexData, indexData: mesh.indexData, chunks: geometry.chunks,
    propMeshes: scenery.propMeshes, propInstances: scenery.propInstances, propBatches: scenery.propBatches,
    tvCameras: scenery.tvCameras, environment: buildEnvironment(theme, track), theme, track,
    stats: { vertices: mesh.vertexCount, triangles: mesh.indexCount / 3, props: scenery.propInstances.length / 16 },
  };
}
