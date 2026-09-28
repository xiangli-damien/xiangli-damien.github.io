/**
 * Every drawing the work board can show. The key is what `program:` refers to in
 * src/data/board.yaml. Programs are loaded on demand, one small file each.
 *
 * To add a drawing: create src/scripts/board/programs/<name>.ts that default-exports
 * a ProgramFactory (see kit.ts), then add one line here.
 */
import type { ProgramLoader } from './engine';

export const programs: Record<string, ProgramLoader> = {
  trajectories: () => import('./programs/trajectories'),
  clusters: () => import('./programs/clusters'),
  cells: () => import('./programs/cells'),
  raft: () => import('./programs/raft'),
  city: () => import('./programs/city'),
  rpc: () => import('./programs/rpc'),
  shell: () => import('./programs/shell'),
  forecast: () => import('./programs/forecast'),
  dispatch: () => import('./programs/dispatch'),
};
