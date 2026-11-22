// Puts the two launches side by side, in step (the contact happens at the same instant in both):
// the recoverable hop on the left, the hard accident (E3) on the right; cockpit view above, the
// view from behind below. Built from the sequences recorded by collision-sequences.mjs.
// node work/scripts/compose-hop-vs-accident.mjs [dir]
import { execFileSync } from 'node:child_process';
import { root } from './lib-browser.mjs';

const dir = `${root}/${process.argv[2] || 'work/renders/collisions'}`;
const font = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', seconds = 8;
const label = (text) => `drawtext=fontfile=${font}:text='${text}':x=(w-text_w)/2:y=h-46:fontsize=26:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=8`;
// the views from behind are shorter: their last image is held
const hold = `tpad=stop_mode=clone:stop_duration=${seconds}`;
const graph = [
  `[0:v]trim=duration=${seconds},setpts=PTS-STARTPTS,${label('SAUT RÉCUPÉRABLE - la course continue')}[a]`,
  `[1:v]trim=duration=${seconds},setpts=PTS-STARTPTS,${label('ACCIDENT VIOLENT (E3) - immobilisation')}[b]`,
  `[2:v]${hold},trim=duration=${seconds},setpts=PTS-STARTPTS[c]`,
  `[3:v]${hold},trim=duration=${seconds},setpts=PTS-STARTPTS[d]`,
  '[a][b]hstack=inputs=2[top]', '[c][d]hstack=inputs=2[bottom]', '[top][bottom]vstack=inputs=2[v]',
].join(';');
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${dir}/HOP.mp4`, '-i', `${dir}/E3.mp4`, '-i', `${dir}/HOPx.mp4`, '-i', `${dir}/E3x.mp4`,
  '-filter_complex', graph, '-map', '[v]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '60', '-movflags', '+faststart', `${dir}/hop-vs-accident.mp4`], { stdio: 'inherit' });
console.log('->', `${dir}/hop-vs-accident.mp4`);
