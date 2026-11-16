import { MAP_DEFS } from '../world-layout.js';
import { buildShivta } from '../world-shivta.js';
import { buildYoav } from '../world-yoav.js';
import { buildLine } from '../world-line.js';
import { buildZaura } from './map-zaura.js';
import { buildBeitHillel } from './map-beit-hillel.js';
import { buildTzeelim } from './map-tzeelim.js';
import { mountMapSync, getCurrentMapId as getWorldMapId } from '../world.js';

const BUILDERS = {
  shivta: buildShivta,
  yoav: buildYoav,
  line: buildLine,
  zaura: buildZaura,
  beit_hillel: buildBeitHillel,
  tzeelim: buildTzeelim
};

function makeMapEntry(id) {
  const def = MAP_DEFS[id];
  const builder = BUILDERS[id];
  return {
    ...def,
    build(target) {
      builder(target);
      return target;
    }
  };
}

export const MAPS = {
  shivta: makeMapEntry('shivta'),
  yoav: makeMapEntry('yoav'),
  line: makeMapEntry('line'),
  zaura: makeMapEntry('zaura'),
  beit_hillel: makeMapEntry('beit_hillel'),
  tzeelim: makeMapEntry('tzeelim')
};

export function getCurrentMapId() {
  return getWorldMapId();
}

export async function loadMap(id, opts = {}) {
  const entry = MAPS[id];
  if (!entry) throw new Error(`Unknown map: ${id}`);
  mountMapSync(id, opts.spawn);
  return entry;
}
