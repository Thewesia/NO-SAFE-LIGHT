import * as THREE from 'three';

export interface MaterialLibrary {
  wetAsphalt: THREE.MeshStandardMaterial;
  sidewalkConcrete: THREE.MeshStandardMaterial;
  buildingBrick: THREE.MeshStandardMaterial;
  industrialMetal: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  hazardStripe: THREE.MeshStandardMaterial;
  glassDark: THREE.MeshStandardMaterial;
  puddleReflective: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

export function createMaterialLibrary(renderer: THREE.WebGLRenderer): MaterialLibrary {
  const textures: THREE.Texture[] = [];
  const materials: THREE.Material[] = [];
  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);

  const registerTex = (
    canvas: HTMLCanvasElement,
    isColor: boolean,
    repeatX = 1,
    repeatY = 1
  ): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = maxAniso;
    textures.push(tex);
    return tex;
  };

  // 1. Wet Asphalt albedo + roughness variation
  const [asphCanvas, asphCtx] = makeCanvas(512, 512);
  asphCtx.fillStyle = '#181b20';
  asphCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 18 + Math.floor(Math.random() * 24);
    asphCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 5})`;
    asphCtx.fillRect(x, y, 2, 2);
  }
  // Subtle cracks & damp patches
  asphCtx.strokeStyle = 'rgba(8, 10, 14, 0.55)';
  asphCtx.lineWidth = 1.5;
  for (let c = 0; c < 12; c++) {
    asphCtx.beginPath();
    let cx = Math.random() * 512;
    let cy = Math.random() * 512;
    asphCtx.moveTo(cx, cy);
    for (let s = 0; s < 6; s++) {
      cx += (Math.random() - 0.5) * 45;
      cy += (Math.random() - 0.5) * 45;
      asphCtx.lineTo(cx, cy);
    }
    asphCtx.stroke();
  }
  const asphMap = registerTex(asphCanvas, true, 16, 16);

  const [asphRoughCanvas, asphRoughCtx] = makeCanvas(256, 256);
  asphRoughCtx.fillStyle = '#707070';
  asphRoughCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 24; i++) {
    const px = Math.random() * 256;
    const py = Math.random() * 256;
    const r = 14 + Math.random() * 34;
    const g = asphRoughCtx.createRadialGradient(px, py, 2, px, py, r);
    g.addColorStop(0, '#181818'); // glossy wet patch
    g.addColorStop(1, 'rgba(112, 112, 112, 0)');
    asphRoughCtx.fillStyle = g;
    asphRoughCtx.beginPath();
    asphRoughCtx.arc(px, py, r, 0, Math.PI * 2);
    asphRoughCtx.fill();
  }
  const asphRoughMap = registerTex(asphRoughCanvas, false, 16, 16);

  const wetAsphalt = new THREE.MeshStandardMaterial({
    map: asphMap,
    roughnessMap: asphRoughMap,
    roughness: 0.42,
    metalness: 0.14,
  });
  materials.push(wetAsphalt);

  // 2. Concrete Sidewalk
  const [concCanvas, concCtx] = makeCanvas(256, 256);
  concCtx.fillStyle = '#2d3138';
  concCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) {
    const v = 38 + Math.floor(Math.random() * 22);
    concCtx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 5})`;
    concCtx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  concCtx.strokeStyle = 'rgba(15, 17, 22, 0.7)';
  concCtx.lineWidth = 2;
  concCtx.strokeRect(1, 1, 126, 126);
  concCtx.strokeRect(129, 1, 126, 126);
  concCtx.strokeRect(1, 129, 126, 126);
  concCtx.strokeRect(129, 129, 126, 126);
  const concMap = registerTex(concCanvas, true, 6, 6);

  const sidewalkConcrete = new THREE.MeshStandardMaterial({
    map: concMap,
    roughness: 0.78,
    metalness: 0.05,
  });
  materials.push(sidewalkConcrete);

  // 3. Industrial Brick / Concrete Wall
  const [wallCanvas, wallCtx] = makeCanvas(256, 256);
  wallCtx.fillStyle = '#23272e';
  wallCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 16) {
    const offset = (y / 16) % 2 === 0 ? 0 : 16;
    for (let x = -16; x < 256; x += 32) {
      const shade = 28 + Math.floor(Math.random() * 14);
      wallCtx.fillStyle = `rgb(${shade}, ${shade + 2}, ${shade + 5})`;
      wallCtx.fillRect(x + offset + 1, y + 1, 30, 14);
    }
  }
  const wallMap = registerTex(wallCanvas, true, 3, 2);

  const buildingBrick = new THREE.MeshStandardMaterial({
    map: wallMap,
    roughness: 0.85,
    metalness: 0.08,
  });
  materials.push(buildingBrick);

  // 4. Corrugated Industrial Metal
  const [metalCanvas, metalCtx] = makeCanvas(256, 256);
  for (let x = 0; x < 256; x += 8) {
    metalCtx.fillStyle = (x / 8) % 2 === 0 ? '#2b323b' : '#20262e';
    metalCtx.fillRect(x, 0, 8, 256);
  }
  for (let i = 0; i < 600; i++) {
    metalCtx.fillStyle = 'rgba(72, 48, 36, 0.24)'; // subtle rust speckles
    metalCtx.fillRect(Math.random() * 256, Math.random() * 256, 4, 8);
  }
  const metalMap = registerTex(metalCanvas, true, 2, 1);

  const industrialMetal = new THREE.MeshStandardMaterial({
    map: metalMap,
    roughness: 0.52,
    metalness: 0.65,
  });
  materials.push(industrialMetal);

  // 5. Dark Steel
  const darkSteel = new THREE.MeshStandardMaterial({
    color: 0x242932,
    roughness: 0.38,
    metalness: 0.78,
  });
  materials.push(darkSteel);

  // 6. Hazard Stripe Tape
  const [hazCanvas, hazCtx] = makeCanvas(128, 128);
  hazCtx.fillStyle = '#18181b';
  hazCtx.fillRect(0, 0, 128, 128);
  hazCtx.fillStyle = '#d99b26';
  for (let i = -128; i < 256; i += 32) {
    hazCtx.beginPath();
    hazCtx.moveTo(i, 0);
    hazCtx.lineTo(i + 16, 0);
    hazCtx.lineTo(i + 144, 128);
    hazCtx.lineTo(i + 128, 128);
    hazCtx.closePath();
    hazCtx.fill();
  }
  const hazMap = registerTex(hazCanvas, true, 3, 1);
  const hazardStripe = new THREE.MeshStandardMaterial({
    map: hazMap,
    roughness: 0.55,
    metalness: 0.15,
  });
  materials.push(hazardStripe);

  // 7. Dark Glass
  const glassDark = new THREE.MeshStandardMaterial({
    color: 0x101720,
    roughness: 0.12,
    metalness: 0.85,
  });
  materials.push(glassDark);

  // 8. Rain Puddle Reflective Disc
  const puddleReflective = new THREE.MeshStandardMaterial({
    color: 0x12161d,
    roughness: 0.06,
    metalness: 0.88,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  materials.push(puddleReflective);

  // 9. Soft Contact Shadow
  const [shadCanvas, shadCtx] = makeCanvas(128, 128);
  const sg = shadCtx.createRadialGradient(64, 64, 8, 64, 64, 60);
  sg.addColorStop(0, 'rgba(0,0,0,0.68)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  shadCtx.fillStyle = sg;
  shadCtx.fillRect(0, 0, 128, 128);
  const shadTex = new THREE.CanvasTexture(shadCanvas);
  shadTex.colorSpace = THREE.SRGBColorSpace;
  textures.push(shadTex);

  const contactShadow = new THREE.MeshBasicMaterial({
    map: shadTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.65,
  });
  materials.push(contactShadow);

  return {
    wetAsphalt,
    sidewalkConcrete,
    buildingBrick,
    industrialMetal,
    darkSteel,
    hazardStripe,
    glassDark,
    puddleReflective,
    contactShadow,
    dispose: () => {
      textures.forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
