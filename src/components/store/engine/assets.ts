import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { Textures } from "./gfx";
import type { Room, Store } from "./worlds";

// The record store's modelled furniture and photo textures, loaded after
// the scene is already on screen.
//
// The shop opens straight away with its plain built-in geometry, then
// upgrades in place: the generated textures (scripts/store-textures.py)
// replace the canvas ones, and the Blender furniture
// (scripts/store-models.py) replaces the plain boxes. If anything fails
// to load, the plain version simply stays - the shop never waits on it.

const BASE = "/store";

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Swaps a texture's picture, keeping its wrapping and filtering. */
async function upgrade(tex: THREE.Texture, name: string, repeat?: [number, number]) {
  const img = await loadImage(`${BASE}/tex/${name}.png`);
  if (!img) return;
  // A new size needs a new GPU texture; uploading a bigger picture into
  // the old one overflows it.
  tex.dispose();
  tex.image = img;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  if (repeat) tex.repeat.set(repeat[0], repeat[1]);
  tex.needsUpdate = true;
}

/**
 * The glTF's materials, rebuilt as the Lambert the rest of the scene
 * uses, so the furniture is lit by the same spotlights in the same way.
 * The baked ambient occlusion comes in as vertex colours and is kept.
 */
function prepare(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const old = mesh.material as THREE.MeshStandardMaterial;
    const map = old.map ?? null;
    if (map) {
      map.colorSpace = THREE.NoColorSpace;
      map.magFilter = THREE.NearestFilter;
      map.minFilter = THREE.LinearMipmapNearestFilter;
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
    }
    const metallic = (old.metalness ?? 0) > 0.4;
    mesh.material = metallic
      ? new THREE.MeshPhongMaterial({
          map,
          color: old.color,
          vertexColors: !!mesh.geometry.attributes.color,
          shininess: 70,
          specular: 0x777766,
        })
      : new THREE.MeshLambertMaterial({ map, color: old.color, vertexColors: !!mesh.geometry.attributes.color });
    old.dispose();
  });
}

async function loadModel(loader: GLTFLoader, name: string): Promise<THREE.Object3D | null> {
  try {
    const gltf = await loader.loadAsync(`${BASE}/models/${name}.glb`);
    prepare(gltf.scene);
    return gltf.scene;
  } catch {
    return null;
  }
}

export async function upgradeWorlds(T: Textures, store: Store, room: Room): Promise<void> {
  const loader = new GLTFLoader();
  await Promise.all([
    upgrade(T.shelf, "oak"),
    upgrade(T.shelfDark, "walnut"),
    upgrade(T.wall, "wall_store", [10, 2]),
    upgrade(T.wainscot, "wall_trim", [24, 1]),
    // Four tiles a side in the new texture against two in the old one.
    upgrade(T.floor, "floor_store", [11, 2.5]),
    upgrade(room.surfaces.wall, "wall_room", [6, 1.5]),
    upgrade(room.surfaces.carpet, "carpet_room", [8, 6]),
    upgrade(room.surfaces.cork, "cork", [3, 2]),
  ]);
  const [storeModel, roomModel, collection] = await Promise.all([
    loadModel(loader, "store"),
    loadModel(loader, "room"),
    loadModel(loader, "collection"),
  ]);
  if (storeModel) {
    store.furniture.visible = false;
    store.scene.add(storeModel);
  }
  if (roomModel) {
    room.furniture.visible = false;
    room.scene.add(roomModel);
  }
  if (collection) {
    room.collectionFrame.visible = false;
    room.shelfHolder.add(collection);
  }
}
