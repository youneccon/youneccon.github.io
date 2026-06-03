import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/* 生き生きとした池（全頁背景・モノクロ影トーン・スクロール連動）
   - 鯉 8 匹: #0=マウス追従。#1〜7=各自ゆるく自律(wander)＋たまに #0 に同調。
   - ハスの葉: 自走しない。鯉が近いと押されて戻る(バネ)＋自然な揺れ。葉が鯉の軌道を逸らす。
   - さざ波: 風が一方向へ吹き抜ける不規則な小波の帯。湖面を大きく横切って消える。
   - 性能: 各タイプ1ドローコール(uniform配列でインスタンス化)。 */

const NKOI = 8;
const NLOTUS = 4;
const GUSTS = 4; // 同時に存在できる「風のさざ波」帯の数
const GUST_N = 3200; // 1帯あたりの粒子数（大規模・高密度）
const NRECT = 18; // 文字マスク矩形の最大数（NDC, この内側の粒子を減光）

// ===== ジオメトリ =====
function sampleKoiArrays(img: HTMLImageElement) {
  const W = 200;
  const H = Math.round((W * img.height) / img.width) || 476;
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(img, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  const cx = W / 2, cy = H / 2, half = H / 2, step = 3, DENSITY = 0.42;
  const pos: number[] = [], tail: number[] = [];
  for (let py = 0; py < H; py += step) for (let px = 0; px < W; px += step) {
    const i = (py * W + px) * 4;
    if (data[i + 3] < 80) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const redness = Math.max(0, Math.min(1, (r - Math.max(g, b)) / 180));
    if (Math.random() > (1 - redness * 0.72) * DENSITY) continue;
    const lx = (cy - py) / half, ly = (px - cx) / half;
    pos.push(lx, ly); tail.push(Math.min(1, Math.max(0, (0.85 - lx) / 1.7)));
  }
  return { pos, tail };
}
function fallbackKoiArrays() {
  const pos: number[] = [], tail: number[] = [];
  let n = 0;
  while (n < 1600) {
    const lx = -1 + Math.random() * 2, ly = (Math.random() - 0.5) * 0.9;
    let h = 0;
    if (lx >= -0.6 && lx <= 0.9) h = 0.26 * Math.pow(Math.sin(Math.PI * ((lx + 0.6) / 1.5)), 0.7);
    else if (lx < -0.6 && lx >= -1) h = 0.05 + ((-0.6 - lx) / 0.4) * 0.3;
    if (Math.abs(ly) <= h) { pos.push(lx, ly); tail.push(Math.min(1, Math.max(0, (0.85 - lx) / 1.7))); n++; }
  }
  return { pos, tail };
}
function buildKoiGeo(arr: { pos: number[]; tail: number[] }) {
  const P = arr.tail.length;
  const pos = new Float32Array(P * NKOI * 3);
  const koi = new Float32Array(P * NKOI);
  const tail = new Float32Array(P * NKOI);
  const rand = new Float32Array(P * NKOI);
  let o = 0;
  for (let k = 0; k < NKOI; k++) for (let i = 0; i < P; i++) {
    pos[o * 3] = arr.pos[i * 2]; pos[o * 3 + 1] = arr.pos[i * 2 + 1]; pos[o * 3 + 2] = 0;
    koi[o] = k; tail[o] = arr.tail[i]; rand[o] = Math.random(); o++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aKoi", new THREE.BufferAttribute(koi, 1));
  g.setAttribute("aTail", new THREE.BufferAttribute(tail, 1));
  g.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  g.frustumCulled = false;
  return g;
}
function buildLotusGeo() {
  const per = 700;
  const pos: number[] = [], leaf: number[] = [], rnd: number[] = [];
  for (let l = 0; l < NLOTUS; l++) {
    let n = 0;
    while (n < per) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random());
      if (Math.abs(((a + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.35 && rr > 0.15) continue;
      pos.push(Math.cos(a) * rr, Math.sin(a) * rr, 0);
      leaf.push(l); rnd.push(Math.random()); n++;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("aLeaf", new THREE.BufferAttribute(new Float32Array(leaf), 1));
  g.setAttribute("aRand", new THREE.BufferAttribute(new Float32Array(rnd), 1));
  g.frustumCulled = false;
  return g;
}
function buildGusts() {
  const pos: number[] = [], gust: number[] = [], u: number[] = [], v: number[] = [], rnd2: number[] = [];
  for (let g = 0; g < GUSTS; g++) for (let i = 0; i < GUST_N; i++) {
    pos.push(0, 0, 0); gust.push(g);
    u.push(Math.random() * 2 - 1); v.push(Math.random() * 2 - 1); rnd2.push(Math.random());
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute("aGust", new THREE.BufferAttribute(new Float32Array(gust), 1));
  geo.setAttribute("aU", new THREE.BufferAttribute(new Float32Array(u), 1));
  geo.setAttribute("aV", new THREE.BufferAttribute(new Float32Array(v), 1));
  geo.setAttribute("aRand", new THREE.BufferAttribute(new Float32Array(rnd2), 1));
  geo.frustumCulled = false;
  return geo;
}

// ===== シェーダー =====
const maskLoop = /* glsl */ `
    vec2 ndc=clip.xy/clip.w; float dim=1.0;
    for(int r=0;r<${NRECT};r++){
      vec4 rc=uTextRect[r]; vec2 dd=abs(ndc-rc.xy)-rc.zw;
      float inside=1.0-smoothstep(0.0,0.03,max(dd.x,dd.y));
      dim=min(dim,1.0-inside*0.82);
    }`;
const koiVert = /* glsl */ `
  uniform float uTime,uSize,uDpr,uWaveK,uWaveSpeed,uWaveAmp;
  uniform vec2 uKoiCenter[${NKOI}]; uniform float uKoiHeading[${NKOI}]; uniform float uKoiScale[${NKOI}];
  uniform vec4 uTextRect[${NRECT}];
  attribute float aKoi,aTail,aRand;
  varying float vDim;
  void main(){
    vec2 c=vec2(0.0); float h=0.0,sc=1.0;
    for(int i=0;i<${NKOI};i++){ if(abs(float(i)-aKoi)<0.5){ c=uKoiCenter[i]; h=uKoiHeading[i]; sc=uKoiScale[i]; } }
    vec2 local=position.xy;
    local.y += sin(local.x*uWaveK - uTime*uWaveSpeed + aRand*0.4 + aKoi*1.7)*uWaveAmp*aTail;
    vec2 p=local*sc; float cs=cos(h),sn=sin(h);
    vec2 world=c+vec2(p.x*cs-p.y*sn, p.x*sn+p.y*cs);
    gl_PointSize=uSize*uDpr;
    vec4 clip=projectionMatrix*modelViewMatrix*vec4(world,0.0,1.0);
    gl_Position=clip;
    ${maskLoop}
    vDim=dim;
  }`;
const koiFrag = /* glsl */ `
  precision mediump float; uniform vec3 uColor; varying float vDim;
  void main(){ vec2 cc=gl_PointCoord-0.5; float a=smoothstep(0.5,0.15,length(cc)); if(a<0.02)discard; gl_FragColor=vec4(uColor,a*0.45*vDim); }`;
const dotFrag = (alpha: string) => /* glsl */ `
  precision mediump float; uniform vec3 uColor;
  void main(){ vec2 cc=gl_PointCoord-0.5; float a=smoothstep(0.5,0.15,length(cc)); if(a<0.02)discard; gl_FragColor=vec4(uColor,a*${alpha}); }`;
const lotusVert = /* glsl */ `
  uniform float uSize,uDpr,uScale; uniform vec2 uLeafCenter[${NLOTUS}];
  attribute float aLeaf;
  void main(){
    vec2 c=vec2(0.0); for(int i=0;i<${NLOTUS};i++){ if(abs(float(i)-aLeaf)<0.5) c=uLeafCenter[i]; }
    vec2 world=c+position.xy*uScale;
    gl_PointSize=uSize*uDpr;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(world,0.0,1.0);
  }`;
// 風が一方向に吹き抜ける不規則なさざ波の帯
const gustVert = /* glsl */ `
  uniform float uTime,uSize,uDpr,uGustMax;
  uniform vec2 uGustCenter[${GUSTS}]; uniform float uGustStart[${GUSTS}]; uniform float uGustAngle[${GUSTS}];
  uniform float uGustScale[${GUSTS}]; uniform float uGustLife[${GUSTS}]; uniform float uGustSeed[${GUSTS}];
  uniform vec4 uTextRect[${NRECT}];
  attribute float aGust,aU,aV,aRand; varying float vA; varying float vTone;
  void main(){
    vec2 c=vec2(9999.0); float st=-999.0, ang=0.0, sc=1.0, lf=6.0, seed=0.0;
    for(int i=0;i<${GUSTS};i++){ if(abs(float(i)-aGust)<0.5){ c=uGustCenter[i]; st=uGustStart[i]; ang=uGustAngle[i]; sc=uGustScale[i]; lf=uGustLife[i]; seed=uGustSeed[i]; } }
    float age=uTime-st; float tt=age/lf;
    if(st<-900.0||tt<0.0||tt>1.0){ gl_Position=vec4(2.0,2.0,2.0,1.0); gl_PointSize=0.0; vA=0.0; return; }
    float patchU=uGustMax*sc; float patchV=patchU*0.64;
    float u=aU, v=aV;
    // 不規則な波面（平行・直線にしない。v/u 依存の複数ノイズでうねらせる）
    float wob = sin(v*2.3+seed)*1.2 + sin(v*5.3+seed*1.7)*0.6 + sin(u*1.7+seed*0.7)*0.5;
    float K = 7.0 + sin(seed)*2.0;
    float ph = u*K + wob + uTime*2.7 + aRand*0.6;
    float crest = sin(ph);
    vTone = crest;
    float band = smoothstep(0.5, 0.95, abs(crest)); // crest頂部だけ＝波の線
    float X = u*patchU + (aRand-0.5)*patchU*0.02;
    float Y = v*patchV + crest*patchV*0.025;
    float env = smoothstep(1.0,0.6,abs(u)) * smoothstep(1.0,0.5,abs(v));
    env *= 0.6 + 0.4*sin(v*4.0+u*2.5+seed*2.0); // 密度・縁を不均一に（不規則さ）
    float fade = smoothstep(0.0,0.15,tt) * smoothstep(1.0,0.6,tt);
    float baseA = max(0.0, band*env*fade);
    float cs=cos(ang), sn=sin(ang);
    vec2 world=c+vec2(X*cs-Y*sn, X*sn+Y*cs);
    gl_PointSize=uSize*uDpr;
    vec4 clip=projectionMatrix*modelViewMatrix*vec4(world,0.0,1.0);
    gl_Position=clip;
    ${maskLoop}
    vA = baseA * dim;
  }`;
const gustFrag = /* glsl */ `
  precision mediump float; uniform vec3 uColorLight, uColorDark; varying float vA; varying float vTone;
  void main(){
    vec2 cc=gl_PointCoord-0.5; float a=smoothstep(0.5,0.2,length(cc)); if(a<0.02)discard;
    vec3 col = mix(uColorDark, uColorLight, smoothstep(-0.25,0.25,vTone)); // 谷=暗 / 稜線=明
    gl_FragColor=vec4(col, a*vA*0.72);
  }`;

function shortAngle(a: number) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function rnd(min: number, max: number) { return min + Math.random() * (max - min); }

function Scene({ reduce }: { reduce: boolean }) {
  const { viewport } = useThree();
  const koiMat = useRef<THREE.ShaderMaterial>(null);
  const lotusMat = useRef<THREE.ShaderMaterial>(null);
  const gustMat = useRef<THREE.ShaderMaterial>(null);
  const [koiGeo, setKoiGeo] = useState<THREE.BufferGeometry | null>(null);
  const lotusGeo = useMemo(buildLotusGeo, []);
  const gustGeo = useMemo(buildGusts, []);
  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio : 1, 2);
  const pointer = useRef({ x: typeof window !== "undefined" ? window.innerWidth / 2 : 0, y: typeof window !== "undefined" ? window.innerHeight / 2 : 0 });
  const textRect = useMemo(() => Array.from({ length: NRECT }, () => new THREE.Vector4(9, 9, 0, 0)), []);
  const textEls = useRef<HTMLElement[]>([]);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setKoiGeo(buildKoiGeo(sampleKoiArrays(img))); };
    img.onerror = () => { if (!cancelled) setKoiGeo(buildKoiGeo(fallbackKoiArrays())); };
    img.src = "/koi.svg";
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const onMove = (e: PointerEvent) => { pointer.current.x = e.clientX; pointer.current.y = e.clientY; };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  useEffect(() => {
    // 文字マスク対象（文字ブロック）を取得。静的ページなので一度でよい。
    const grab = () => {
      textEls.current = Array.from(document.querySelectorAll<HTMLElement>(
        ".content h1, .content h2, .content h3, .content p, .content li, .content .eyebrow"
      ));
    };
    grab();
    const id = setTimeout(grab, 600); // フォント/レイアウト確定後に再取得
    return () => clearTimeout(id);
  }, []);

  const koiU = useMemo(() => ({
    uTime: { value: 0 }, uSize: { value: 1.8 }, uDpr: { value: dpr },
    uWaveK: { value: 4.0 }, uWaveSpeed: { value: 1.7 }, uWaveAmp: { value: 0.085 },
    uKoiCenter: { value: Array.from({ length: NKOI }, () => new THREE.Vector2(9999, 9999)) },
    uKoiHeading: { value: new Array(NKOI).fill(0) as number[] },
    uKoiScale: { value: new Array(NKOI).fill(1) as number[] },
    uTextRect: { value: textRect },
    uColor: { value: new THREE.Color("#4a4034") },
  }), [dpr, textRect]);
  const lotusU = useMemo(() => ({
    uSize: { value: 1.8 }, uDpr: { value: dpr }, uScale: { value: 1 },
    uLeafCenter: { value: Array.from({ length: NLOTUS }, () => new THREE.Vector2(9999, 9999)) },
    uColor: { value: new THREE.Color("#564f3f") },
  }), [dpr]);
  const gustU = useMemo(() => ({
    uTime: { value: 0 }, uSize: { value: 2.2 }, uDpr: { value: dpr }, uGustMax: { value: 1 },
    uGustCenter: { value: Array.from({ length: GUSTS }, () => new THREE.Vector2(9999, 9999)) },
    uGustStart: { value: new Array(GUSTS).fill(-999) as number[] },
    uGustAngle: { value: new Array(GUSTS).fill(0) as number[] },
    uGustScale: { value: new Array(GUSTS).fill(1) as number[] },
    uGustLife: { value: new Array(GUSTS).fill(6) as number[] },
    uGustSeed: { value: new Array(GUSTS).fill(0) as number[] },
    uTextRect: { value: textRect },
    uColorLight: { value: new THREE.Color("#f2ead6") },
    uColorDark: { value: new THREE.Color("#5e5440") },
  }), [dpr, textRect]);

  const S = useRef<any>(null);

  useFrame((rs, delta) => {
    const ku = koiMat.current?.uniforms, lu = lotusMat.current?.uniforms, gu = gustMat.current?.uniforms;
    if (!ku || !lu || !gu) return;
    const t = rs.clock.elapsedTime;
    const vw = viewport.width, vh = viewport.height, minWH = Math.min(vw, vh);
    const innerW = window.innerWidth || 1, innerH = window.innerHeight || 1;
    const worldPerPx = vh / innerH, scrollY = window.scrollY || 0;
    const docH = document.documentElement.scrollHeight || innerH;
    const docHW = docH * worldPerPx;
    const toWorldY = (pageY: number) => 0.5 * vh - (pageY - scrollY * worldPerPx);

    ku.uTime.value = t; gu.uTime.value = t;
    const koiScaleW = minWH * 0.17;
    lu.uScale.value = minWH * 0.075;
    const gMax = minWH * 1.05;
    gu.uGustMax.value = gMax;

    // ---- lazy init ----
    if (!S.current) {
      const koi = Array.from({ length: NKOI }, (_, i) => ({
        center: new THREE.Vector2(rnd(-vw * 0.3, vw * 0.3), rnd(0.4, Math.max(1.2, docHW / vh - 0.4)) * vh),
        smooth: new THREE.Vector2(0, vh * 0.5),
        heading: rnd(-Math.PI, Math.PI),
        home: new THREE.Vector2(rnd(-vw * 0.32, vw * 0.32), rnd(0.5, Math.max(1.5, docHW / vh - 0.5)) * vh),
        angleOff: i === 0 ? 0 : rnd(-0.5, 0.5),
        speedF: i === 0 ? 1 : rnd(0.85, 1.35),
        scaleF: i === 0 ? 1 : rnd(0.6, 1.05),
        fx: rnd(0.05, 0.16), fy: rnd(0.05, 0.16), px: rnd(0, 6.28), py: rnd(0, 6.28),
        syncF: rnd(0.05, 0.12), syncP: rnd(0, 6.28),
      }));
      koi[0].center.set(0, vh * 0.5); koi[0].scaleF = 1;
      const lotus = Array.from({ length: NLOTUS }, () => ({
        base: new THREE.Vector2(rnd(-vw * 0.34, vw * 0.34), rnd(0.4, Math.max(1.3, docHW / vh - 0.4)) * vh),
        off: new THREE.Vector2(0, 0), vel: new THREE.Vector2(0, 0),
        swph: rnd(0, 6.28), swph2: rnd(0, 6.28), swf: rnd(0.25, 0.5),
      }));
      const gusts = Array.from({ length: GUSTS }, () => ({
        center: new THREE.Vector2(0, 0), dir: new THREE.Vector2(1, 0),
        anglePage: 0, scale: 1, start: -999, life: 6, seed: 0,
      }));
      S.current = { koi, lotus, gusts, nextGust: 0, gustNext: t + rnd(0.5, 2) };
    }
    const st = S.current;

    // ---- 文字マスク矩形(NDC)を毎フレーム更新（文字ブロック内の粒子を減光）----
    const els = textEls.current; let nr = 0;
    for (let j = 0; j < els.length && nr < NRECT; j++) {
      const rr = els[j].getBoundingClientRect();
      if (rr.width < 2 || rr.height < 2 || rr.bottom < 0 || rr.top > innerH) continue;
      textRect[nr].set(
        ((rr.left + rr.width / 2) / innerW) * 2 - 1,
        -(((rr.top + rr.height / 2) / innerH) * 2 - 1),
        rr.width / innerW, rr.height / innerH
      );
      nr++;
    }
    for (let j = nr; j < NRECT; j++) textRect[j].set(9, 9, 0, 0);

    if (reduce) {
      for (let i = 0; i < NKOI; i++) {
        (ku.uKoiCenter.value as THREE.Vector2[])[i].set(9999, 9999);
        (ku.uKoiScale.value as number[])[i] = koiScaleW * st.koi[i].scaleF;
      }
      (ku.uKoiCenter.value as THREE.Vector2[])[0].set(0, 0);
      (ku.uKoiHeading.value as number[])[0] = -Math.PI / 2;
      for (let i = 0; i < NLOTUS; i++) (lu.uLeafCenter.value as THREE.Vector2[])[i].set(st.lotus[i].base.x, toWorldY(st.lotus[i].base.y));
      return;
    }

    const dt = Math.min(delta, 0.05);

    // ---- leader target (mouse, page coords, smoothed) ----
    const lead = st.koi[0];
    const tgtX = (pointer.current.x / (window.innerWidth || 1) - 0.5) * vw;
    const tgtY = (pointer.current.y + scrollY) * worldPerPx;
    const lp = 1 - Math.pow(0.5, dt / 1.2);
    lead.smooth.x += (tgtX - lead.smooth.x) * lp;
    lead.smooth.y += (tgtY - lead.smooth.y) * lp;

    const kc = ku.uKoiCenter.value as THREE.Vector2[];
    const kh = ku.uKoiHeading.value as number[];
    const ksc = ku.uKoiScale.value as number[];

    for (let i = 0; i < NKOI; i++) {
      const k = st.koi[i];
      let tX: number, tY: number;
      if (i === 0) { tX = lead.smooth.x; tY = lead.smooth.y; }
      else {
        const wx = k.home.x + Math.sin(t * k.fx + k.px) * vw * 0.22;
        const wy = k.home.y + Math.sin(t * k.fy + k.py) * vh * 0.5;
        const sw = Math.max(0, Math.sin(t * k.syncF + k.syncP)) ** 2 * 0.7;
        k.smooth.x += (lead.smooth.x - k.smooth.x) * (1 - Math.pow(0.5, dt / 2.0));
        k.smooth.y += (lead.smooth.y - k.smooth.y) * (1 - Math.pow(0.5, dt / 2.0));
        tX = wx * (1 - sw) + k.smooth.x * sw;
        tY = wy * (1 - sw) + k.smooth.y * sw;
      }
      const dx = tX - k.center.x, dy = tY - k.center.y, dist = Math.hypot(dx, dy);
      let desired = Math.atan2(dy, dx) + k.angleOff;
      if (dist < minWH * 0.22) desired += Math.PI / 2;
      desired += Math.sin(t * 0.25 + i) * 0.2;

      for (let l = 0; l < NLOTUS; l++) {
        const lx = st.lotus[l].base.x + st.lotus[l].off.x, ly = st.lotus[l].base.y + st.lotus[l].off.y;
        const ddx = k.center.x - lx, ddy = k.center.y - ly, d = Math.hypot(ddx, ddy);
        const avoidR = lu.uScale.value * 2.2;
        if (d < avoidR && d > 0.001) {
          const away = Math.atan2(ddy, ddx);
          const w = (1 - d / avoidR) * 0.8;
          desired = Math.atan2(Math.sin(desired) * (1 - w) + Math.sin(away) * w, Math.cos(desired) * (1 - w) + Math.cos(away) * w);
        }
      }
      const halfW = vw * 0.46;
      if (Math.abs(k.center.x) > halfW) {
        const e = Math.min(1, (Math.abs(k.center.x) - halfW) / (vw * 0.1)), toCx = k.center.x > 0 ? Math.PI : 0;
        desired = Math.atan2(Math.sin(desired) * (1 - e) + Math.sin(toCx) * e, Math.cos(desired) * (1 - e) + Math.cos(toCx) * e);
      }
      if (k.center.y < vh * 0.1) desired = Math.PI / 2;
      else if (k.center.y > docHW - vh * 0.1) desired = -Math.PI / 2;

      const maxTurn = 0.5;
      k.heading += Math.max(-maxTurn * dt, Math.min(maxTurn * dt, shortAngle(desired - k.heading)));
      const speed = minWH * 0.028 * k.speedF;
      const hx = Math.cos(k.heading), hy = Math.sin(k.heading);
      k.center.x += hx * speed * dt; k.center.y += hy * speed * dt;

      kc[i].set(k.center.x, toWorldY(k.center.y));
      kh[i] = Math.atan2(-hy, hx);
      ksc[i] = koiScaleW * k.scaleF;
    }

    // ---- ハスの葉 ----
    const lc = lu.uLeafCenter.value as THREE.Vector2[];
    for (let l = 0; l < NLOTUS; l++) {
      const leaf = st.lotus[l];
      let fx = 0, fy = 0;
      for (let i = 0; i < NKOI; i++) {
        const k = st.koi[i];
        const ddx = leaf.base.x - k.center.x, ddy = leaf.base.y - k.center.y, d = Math.hypot(ddx, ddy);
        const pushR = lu.uScale.value * 2.4;
        if (d < pushR) {
          const w = (1 - d / pushR) * minWH * 0.05;
          fx += Math.cos(k.heading) * w; fy += Math.sin(k.heading) * w;
        }
      }
      leaf.vel.x += (fx - 7 * leaf.off.x) * dt; leaf.vel.y += (fy - 7 * leaf.off.y) * dt;
      leaf.vel.multiplyScalar(Math.pow(0.06, dt));
      leaf.off.x += leaf.vel.x * dt; leaf.off.y += leaf.vel.y * dt;
      const swx = Math.sin(t * leaf.swf + leaf.swph) * minWH * 0.012;
      const swy = Math.cos(t * leaf.swf * 0.8 + leaf.swph2) * minWH * 0.012;
      lc[l].set(leaf.base.x + leaf.off.x + swx, toWorldY(leaf.base.y + leaf.off.y + swy));
    }

    // ---- さざ波（風の帯）: たまに1つ発生し、一方向へ吹き抜けて消える ----
    if (t > st.gustNext) {
      st.gustNext = t + rnd(3.5, 6.5);
      const gi = st.nextGust; st.nextGust = (gi + 1) % GUSTS;
      const g = st.gusts[gi];
      g.anglePage = rnd(-Math.PI, Math.PI);
      g.dir.set(Math.cos(g.anglePage), Math.sin(g.anglePage));
      g.scale = rnd(1.0, 1.7); g.life = rnd(6, 9); g.start = t; g.seed = rnd(0, 6.28);
      g.center.set(rnd(-vw * 0.2, vw * 0.2), scrollY * worldPerPx + rnd(0.3, 0.7) * vh);
    }
    const gCenter = gu.uGustCenter.value as THREE.Vector2[];
    const gStart = gu.uGustStart.value as number[];
    const gAngle = gu.uGustAngle.value as number[];
    const gScale = gu.uGustScale.value as number[];
    const gLife = gu.uGustLife.value as number[];
    const gSeed = gu.uGustSeed.value as number[];
    for (let i = 0; i < GUSTS; i++) {
      const g = st.gusts[i];
      if (g.start < -900 || t - g.start > g.life) { gStart[i] = -999; continue; }
      const spd = (gMax * g.scale * 1.9) / g.life; // 寿命でおよそ帯1.9個ぶん流れる（ダイナミック）
      g.center.x += g.dir.x * spd * dt; g.center.y += g.dir.y * spd * dt;
      gCenter[i].set(g.center.x, toWorldY(g.center.y));
      gStart[i] = g.start; gAngle[i] = -g.anglePage; gScale[i] = g.scale; gLife[i] = g.life; gSeed[i] = g.seed;
    }
  });

  return (
    <>
      <points geometry={gustGeo} frustumCulled={false}>
        <shaderMaterial ref={gustMat} uniforms={gustU} vertexShader={gustVert} fragmentShader={gustFrag} transparent depthWrite={false} />
      </points>
      <points geometry={lotusGeo} frustumCulled={false}>
        <shaderMaterial ref={lotusMat} uniforms={lotusU} vertexShader={lotusVert} fragmentShader={dotFrag("0.4")} transparent depthWrite={false} />
      </points>
      {koiGeo && (
        <points geometry={koiGeo} frustumCulled={false}>
          <shaderMaterial ref={koiMat} uniforms={koiU} vertexShader={koiVert} fragmentShader={koiFrag} transparent depthWrite={false} />
        </points>
      )}
    </>
  );
}

export default function KoiParticles() {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <Canvas dpr={[1, 2]} frameloop={reduce ? "never" : "always"} camera={{ position: [0, 0, 3], fov: 50 }}
      gl={{ antialias: true, alpha: true }} style={{ position: "absolute", inset: 0 }} aria-hidden="true">
      <Scene reduce={reduce} />
    </Canvas>
  );
}
