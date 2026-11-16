import { getTerrainHeight } from '../world.js';
import { addBoxCollider } from '../props/reserve-props.js';

const COLLIDER_DEPTH_PADDING = 2;

const HANGAR_COLUMN_XS = [-12, -6, 0, 6, 12];
const HANGAR_COLUMN_ZS = [-4.1, 4.1];
const HANGAR_COLUMNS = [];
for (let xi = 0; xi < HANGAR_COLUMN_XS.length; xi++) {
  for (let zi = 0; zi < HANGAR_COLUMN_ZS.length; zi++) {
    HANGAR_COLUMNS.push({ cx: HANGAR_COLUMN_XS[xi], cz: HANGAR_COLUMN_ZS[zi], width: 0.4, depth: 0.4, height: 7 });
  }
}

export const PIECE_COLLIDERS = {
  tzeelim_hangar: HANGAR_COLUMNS,
  tzeelim_meal_table: [{ cx: 0, cz: 0, width: 7.44, depth: 0.94, height: 0.9 }],
  tzeelim_village_house: [{ cx: 0.475, cz: 0, width: 8.95, depth: 8, height: 6.5 }],
  tzeelim_ruined_container: [{ cx: -0.25, cz: 0.1, width: 6.3, depth: 3.2, height: 2.6 }],
  tzeelim_container_wall: [{ cx: 0, cz: 0, width: 6.06, depth: 2.46, height: 3.4 }],
  tzeelim_concrete_block: [{ cx: 0, cz: 0, width: 1.5, depth: 1.5, height: 1.5 }],
  tzeelim_striped_block: [{ cx: 0, cz: 0, width: 1.5, depth: 1.5, height: 1.2 }],
  tzeelim_sand_berm: [{ cx: 0, cz: 0, width: 6.4, depth: 2.4, height: 1.8 }],
  tzeelim_ramp: [{ cx: 0, cz: 0, width: 2.4, depth: 4.0, height: 1.2 }],
  tzeelim_acacia: [{ cx: 0, cz: 0, width: 0.6, depth: 0.6, height: 6.0 }]
};

export function registerPieceCollider(mapGroup, placement) {
  const specs = PIECE_COLLIDERS[placement.piece];
  if (!specs) {
    return;
  }
  const rotY = placement.ry ?? 0;
  const scaleFactor = placement.scale ?? 1;
  const cos = Math.cos(rotY);
  const sin = Math.sin(rotY);
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const localX = (spec.cx ?? 0) * scaleFactor;
    const localZ = (spec.cz ?? 0) * scaleFactor;
    const worldX = placement.x + localX * cos + localZ * sin;
    const worldZ = placement.z - localX * sin + localZ * cos;
    const halfWidth = spec.width * 0.5 * scaleFactor;
    const halfDepth = spec.depth * 0.5 * scaleFactor;
    const rotatedHalfW = halfWidth * absCos + halfDepth * absSin;
    const rotatedHalfD = halfWidth * absSin + halfDepth * absCos;
    const groundY = getTerrainHeight(worldX, worldZ);
    addBoxCollider(
      mapGroup,
      worldX,
      worldZ,
      rotatedHalfW,
      rotatedHalfD,
      groundY - COLLIDER_DEPTH_PADDING,
      groundY + spec.height * scaleFactor
    );
    const colliders = mapGroup.userData.colliders;
    if (Array.isArray(colliders) && colliders.length > 0) {
      colliders[colliders.length - 1].kitPlacementId = placement.id;
    }
  }
}
