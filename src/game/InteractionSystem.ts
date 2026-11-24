import * as THREE from 'three';
import { InteractableObject } from '../types/game';

export class InteractionSystem {
  public findNearest(
    playerPos: THREE.Vector3,
    interactables: InteractableObject[]
  ): InteractableObject | null {
    let best: InteractableObject | null = null;
    let bestDistSq = Infinity;

    for (const item of interactables) {
      if (item.consumed) continue;
      const dx = item.position.x - playerPos.x;
      const dz = item.position.z - playerPos.z;
      const distSq = dx * dx + dz * dz;
      if (distSq <= item.radius * item.radius && distSq < bestDistSq) {
        best = item;
        bestDistSq = distSq;
      }
    }
    return best;
  }
}
