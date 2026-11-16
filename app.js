(() => {
  'use strict';

  const CONFIG_URL = './config.json';
  const sceneEl = document.querySelector('#ar-scene');
  const hintEl = document.querySelector('#camera-hint');
  const noticeEl = document.querySelector('#setup-notice');
  const ctaPanel = document.querySelector('#web-cta-panel');
  const ctaHeading = document.querySelector('#web-cta-heading');
  const ctaButton = document.querySelector('#web-cta-button');
  const ctaRestart = document.querySelector('#web-cta-restart');

  const targetBindings = [0, 1].map((targetIndex) => ({
    targetIndex,
    targetEl: document.querySelector(`#poster-target-${targetIndex}`),
    tapEl: document.querySelector(`#tap-target-${targetIndex}`),
    artNode: document.querySelector(`#art-node-${targetIndex}`),
    textNode: document.querySelector(`#text-node-${targetIndex}`),
    videoNode: document.querySelector(`#video-node-${targetIndex}`)
  }));

  let config = null;
  let activeExperienceIndex = -1;
  let targetIsVisible = false;
  let sceneRevision = 0;
  let ghostVideo = null;
  let ghostTexture = null;
  let ghostMesh = null;
  let ghostCanPlayHandler = null;
  let ghostVideoEnded = false;
  let playRequested = false;
  const animationFrames = new WeakMap();
  const transitionFrames = new WeakMap();
  const activeExitClones = new Map();

  function setHint(message) {
    if (hintEl) {
      hintEl.textContent = typeof message === 'string' ? message : '';
      hintEl.hidden = !message;
    }
  }
  function showNotice(message) { noticeEl.textContent = message; noticeEl.hidden = false; }
  function hideNotice() { noticeEl.hidden = true; noticeEl.textContent = ''; }
  function safeNumber(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function validAnimation(value) { return ['none','fade','pop','slide-up','float'].includes(value) ? value : 'none'; }

  function normalizeScene(scene, index) {
    scene = scene || {};
    scene.id = index + 1;
    scene.label = scene.label || `Escena ${index + 1}`;
    scene.type = scene.type === 'cta' || index === 5 ? 'cta' : 'illustration';
    scene.image = scene.image || {};
    scene.text = scene.text || {};
    const image = scene.image;
    image.src = typeof image.src === 'string' ? image.src.trim() : '';
    image.x = safeNumber(image.x, 0); image.y = safeNumber(image.y, 0.12); image.z = safeNumber(image.z, 0.18);
    image.width = Math.max(0.01, safeNumber(image.width, 0.82));
    image.height = image.height === null || image.height === '' || image.height === undefined ? null : Math.max(0.01, safeNumber(image.height, 0.5));
    image.opacity = clamp(safeNumber(image.opacity, 1), 0, 1);
    image.animation = validAnimation(image.animation || 'float');
    image.durationMs = clamp(safeNumber(image.durationMs, 6000), 0, 10000);
    const text = scene.text;
    text.content = typeof text.content === 'string' ? text.content : '';
    text.x = safeNumber(text.x, 0); text.y = safeNumber(text.y, -0.43); text.z = safeNumber(text.z, 0.22);
    text.width = Math.max(0.05, safeNumber(text.width, 0.88)); text.height = Math.max(0.05, safeNumber(text.height, 0.32));
    text.fontFamily = typeof text.fontFamily === 'string' && text.fontFamily.trim() ? text.fontFamily : 'Arial';
    text.fontSize = clamp(safeNumber(text.fontSize, 58), 8, 240);
    text.fontWeight = typeof text.fontWeight === 'string' ? text.fontWeight : 'normal';
    text.color = typeof text.color === 'string' ? text.color : '#FFFFFF';
    text.align = ['left','center','right'].includes(text.align) ? text.align : 'center';
    text.verticalAlign = ['top','middle','bottom'].includes(text.verticalAlign) ? text.verticalAlign : 'middle';
    text.lineHeight = clamp(safeNumber(text.lineHeight, 1.2), 0.8, 2.5);
    text.opacity = clamp(safeNumber(text.opacity, 1), 0, 1);
    text.animation = validAnimation(text.animation || 'float');
    text.durationMs = clamp(safeNumber(text.durationMs, 6000), 0, 10000);
    return scene;
  }

  function normalizeConfig(raw) {
    if (!raw || !Array.isArray(raw.experiences) || raw.experiences.length !== 2) {
      throw new Error('config.json debe incluir exactamente dos experiencias.');
    }
    raw.project = raw.project || {};
    raw.project.fonts = Array.isArray(raw.project.fonts) ? raw.project.fonts : [];
    raw.tracker = raw.tracker || {};
    raw.tracker.src = typeof raw.tracker.src === 'string' && raw.tracker.src.trim() ? raw.tracker.src.trim() : './targets/poster.mind';
    raw.tracker.maxTrack = 1;
    raw.interface = raw.interface || {};
    raw.interface.continuePrompt = raw.interface.continuePrompt || 'Pulse la imagen para continuar';
    raw.interface.finalPrompt = raw.interface.finalPrompt || 'Fin de la experiencia';
    raw.interface.notFoundPrompt = raw.interface.notFoundPrompt || 'Apuntá la cámara a uno de los dos afiches';
    raw.interface.videoPrompt = raw.interface.videoPrompt || 'Reproduciendo el video del fantasma…';
    raw.interface.videoEndedPrompt = raw.interface.videoEndedPrompt || 'El video terminó. Tocá el afiche para repetirlo.';

    const indexes = new Set();
    raw.experiences.forEach((exp, i) => {
      exp.id = exp.id || (i === 0 ? 'villa-hortensia' : 'fantasma-video');
      exp.name = exp.name || (i === 0 ? 'Villa Hortensia' : 'Video del fantasma');
      exp.mode = exp.mode || (i === 0 ? 'sequence' : 'video');
      exp.targetIndex = Math.max(0, Math.floor(safeNumber(exp.targetIndex, i)));
      if (indexes.has(exp.targetIndex)) throw new Error('Los dos afiches deben tener índices diferentes.');
      indexes.add(exp.targetIndex);
      exp.target = exp.target || {};
      exp.target.width = Math.max(0.1, safeNumber(exp.target.width, 1));
      exp.target.height = Math.max(0.1, safeNumber(exp.target.height, 1.414));
      if (exp.mode === 'sequence') {
        if (!Array.isArray(exp.scenes) || exp.scenes.length !== 6) throw new Error('Villa Hortensia debe contener cinco escenas y una sexta página con el enlace web.');
        exp.scenes = exp.scenes.map(normalizeScene);
        exp.currentSceneIndex = 0;
        exp.cta = exp.cta || {};
        exp.cta.heading = typeof exp.cta.heading === 'string' ? exp.cta.heading : 'Visita la página web para conocer más sobre el barrio y sus historias';
        exp.cta.buttonLabel = typeof exp.cta.buttonLabel === 'string' ? exp.cta.buttonLabel : 'Haz clic para ir a la página';
        exp.cta.url = typeof exp.cta.url === 'string' ? exp.cta.url.trim() : '';
      } else if (exp.mode === 'video') {
        exp.video = exp.video || {};
        const v = exp.video;
        v.webmSrc = typeof v.webmSrc === 'string' ? v.webmSrc.trim() : '';
        v.safariMovSrc = typeof v.safariMovSrc === 'string' ? v.safariMovSrc.trim() : '';
        v.x = safeNumber(v.x, 0); v.y = safeNumber(v.y, 0.04); v.z = safeNumber(v.z, 0.22);
        v.width = Math.max(0.01, safeNumber(v.width, 0.72));
        v.height = v.height === null || v.height === '' || v.height === undefined ? null : Math.max(0.01, safeNumber(v.height, 0.5));
        v.playbackRate = clamp(safeNumber(v.playbackRate, 1), 0.25, 2.5);
        v.loop = Boolean(v.loop);
        v.startAt = Math.max(0, safeNumber(v.startAt, 0));
        v.expectedDurationSec = Math.max(0.1, safeNumber(v.expectedDurationSec, 8));
      } else throw new Error(`Modo de experiencia desconocido en ${exp.name}.`);
    });
    if (raw.experiences[0].mode !== 'sequence' || raw.experiences[0].targetIndex !== 0) throw new Error('El afiche 1 debe ser Villa Hortensia e índice 0.');
    if (raw.experiences[1].mode !== 'video' || raw.experiences[1].targetIndex !== 1) throw new Error('El afiche 2 debe ser el video e índice 1.');
    return raw;
  }

  function setNodePosition(node, x, y, z) { node.setAttribute('position', `${x} ${y} ${z}`); }
  function stopAnimation(node) { const frame = animationFrames.get(node); if (frame) cancelAnimationFrame(frame); animationFrames.delete(node); }
  function stopTransition(node) { const frame = transitionFrames.get(node); if (frame) cancelAnimationFrame(frame); transitionFrames.delete(node); }

  function disposeNodeMesh(node) {
    stopAnimation(node); stopTransition(node);
    const mesh = node.getObject3D('mesh');
    if (mesh) {
      node.removeObject3D('mesh');
      mesh.traverse((part) => {
        if (part.geometry?.dispose) part.geometry.dispose();
        if (part.material) {
          const mats = Array.isArray(part.material) ? part.material : [part.material];
          mats.forEach((mat) => { if (mat.map?.dispose) mat.map.dispose(); if (mat.dispose) mat.dispose(); });
        }
      });
    }
    node.setAttribute('visible', false);
  }

  function setMaterialsOpacity(node, factor) {
    node.object3D.traverse((part) => {
      if (!part.material) return;
      const mats = Array.isArray(part.material) ? part.material : [part.material];
      mats.forEach((mat) => {
        if (mat.userData.webarBaseOpacity === undefined) mat.userData.webarBaseOpacity = mat.opacity;
        mat.transparent = true;
        mat.opacity = clamp(mat.userData.webarBaseOpacity * factor, 0, 1);
        mat.needsUpdate = true;
      });
    });
  }

  function animateNode(node, mode, duration, basePosition) {
    stopAnimation(node);
    const object = node.object3D;
    const pos = { x:basePosition.x, y:basePosition.y, z:basePosition.z };
    const time = Math.max(0, safeNumber(duration, 6000));
    object.position.set(pos.x, pos.y, pos.z); object.scale.set(1,1,1); setMaterialsOpacity(node,1);
    if (mode === 'none' || time === 0) return;
    if (mode === 'fade') setMaterialsOpacity(node,0);
    if (mode === 'pop') object.scale.set(.05,.05,.05);
    if (mode === 'slide-up') object.position.y = pos.y - .16;
    const startedAt = performance.now();
    const easeOut = (t) => 1 - Math.pow(1-t,3);
    const step = (now) => {
      if (!node.isConnected) { animationFrames.delete(node); return; }
      const progress = clamp((now-startedAt)/time,0,1); const eased = easeOut(progress);
      if (mode === 'fade') setMaterialsOpacity(node,eased);
      if (mode === 'pop') { const back=1+1.35*Math.pow(progress-1,3)+.35*Math.pow(progress-1,2); const s=progress===1?1:Math.max(.02,back); object.scale.set(s,s,s); }
      if (mode === 'slide-up') object.position.y = pos.y - .16*(1-eased);
      if (mode === 'float') { const angle=((now-startedAt)/time)*Math.PI*2; object.position.y=pos.y+Math.sin(angle)*.045; }
      if (progress<1 || mode==='float') animationFrames.set(node,requestAnimationFrame(step));
      else { object.position.set(pos.x,pos.y,pos.z); if(mode==='pop') object.scale.set(1,1,1); if(mode==='fade') setMaterialsOpacity(node,1); animationFrames.delete(node); }
    };
    animationFrames.set(node,requestAnimationFrame(step));
  }

  const TRANSITION_MS = 650;
  function disposeClonedObject(object) {
    object.traverse((part) => {
      if (part.geometry?.dispose) part.geometry.dispose();
      if (!part.material) return;
      const mats=Array.isArray(part.material)?part.material:[part.material];
      mats.forEach((mat)=>{if(mat.map?.dispose)mat.map.dispose();if(mat.dispose)mat.dispose();});
    });
  }
  function fadeOutNodeClone(node, anchorEl) {
    const source=node.getObject3D('mesh'); if(!source || node.getAttribute('visible')===false) return;
    const clone=node.object3D.clone(true); const materials=[];
    clone.traverse((part)=>{
      if(!part.isMesh)return;
      if(Number.isFinite(part.renderOrder))part.renderOrder-=.1;
      if(part.geometry?.clone)part.geometry=part.geometry.clone();
      const originals=Array.isArray(part.material)?part.material:[part.material];
      const copies=originals.map((original)=>{
        const mat=original.clone(); if(original.map?.clone){mat.map=original.map.clone();mat.map.needsUpdate=true;}
        mat.transparent=true;mat.depthWrite=false;mat.userData.webarBaseOpacity=mat.opacity;materials.push({mat,start:mat.opacity});return mat;
      });
      part.material=Array.isArray(part.material)?copies:copies[0];
    });
    anchorEl.object3D.add(clone); const started=performance.now();
    const ease=(t)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    const step=(now)=>{
      const p=clamp((now-started)/TRANSITION_MS,0,1);const f=1-ease(p);
      materials.forEach(({mat,start})=>{mat.opacity=start*f;mat.needsUpdate=true;});
      if(p<1)activeExitClones.set(clone,requestAnimationFrame(step));
      else{activeExitClones.delete(clone);clone.parent?.remove(clone);disposeClonedObject(clone);}
    };
    activeExitClones.set(clone,requestAnimationFrame(step));
  }
  function fadeInNode(node,duration=TRANSITION_MS){
    stopTransition(node);const time=Math.max(1,safeNumber(duration,TRANSITION_MS));const started=performance.now();
    const ease=(t)=>1-Math.pow(1-t,3);setMaterialsOpacity(node,0);
    const step=(now)=>{if(!node.isConnected){transitionFrames.delete(node);return;}const p=clamp((now-started)/time,0,1);setMaterialsOpacity(node,ease(p));if(p<1)transitionFrames.set(node,requestAnimationFrame(step));else{setMaterialsOpacity(node,1);transitionFrames.delete(node);}};
    transitionFrames.set(node,requestAnimationFrame(step));
  }

  async function loadCustomFonts() {
    const fonts=config?.project?.fonts || [];
    if(!('fonts' in document)||typeof FontFace==='undefined'||!fonts.length)return;
    await Promise.all(fonts.map(async(font)=>{
      if(!font?.family||!font?.src)return;
      try{const face=new FontFace(font.family,`url("${font.src.replace(/"/g,'')}")`,{weight:String(font.weight||'normal'),style:String(font.style||'normal')});document.fonts.add(await face.load());}
      catch(error){console.warn(`No se pudo cargar la fuente ${font.family}`,error);}
    }));
    try{await document.fonts.ready;}catch(_){/* fuente alternativa */}
  }

  function getExperienceBinding(exp) { return targetBindings.find((b)=>b.targetIndex===exp.targetIndex); }
  function setCtaVisible(show, exp) {
    if(!show){ctaPanel.hidden=true;return;}
    const cta=exp.cta||{};
    ctaHeading.textContent=cta.heading||'Visita la página web para conocer más sobre el barrio y sus historias';
    ctaButton.textContent=cta.buttonLabel||'Haz clic para ir a la página';
    const validUrl=validExternalUrl(cta.url);
    ctaButton.href=validUrl||'#';
    ctaButton.classList.toggle('is-unconfigured',!validUrl);
    ctaButton.setAttribute('aria-disabled',String(!validUrl));
    ctaPanel.hidden=false;
  }
  function validExternalUrl(value) {
    try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch(_){return '';}
  }

  function renderScene(experienceIndex, sceneIndex, options={}) {
    const exp=config?.experiences[experienceIndex];if(!exp||exp.mode!=='sequence')return;
    const binding=getExperienceBinding(exp);if(!binding)throw new Error(`Falta el contenedor para ${exp.name}.`);
    const {targetEl,artNode,textNode}=binding;
    if(options.transition){fadeOutNodeClone(artNode,targetEl);fadeOutNodeClone(textNode,targetEl);}
    exp.currentSceneIndex=clamp(sceneIndex,0,exp.scenes.length-1);
    const revision=++sceneRevision;const scene=exp.scenes[exp.currentSceneIndex];
    disposeNodeMesh(artNode);disposeNodeMesh(textNode);
    if(scene.type==='cta'){
      setCtaVisible(targetIsVisible && activeExperienceIndex===experienceIndex,exp);
      updateHint();return;
    }
    setCtaVisible(false);
    setNodePosition(artNode,scene.image.x,scene.image.y,scene.image.z);
    setNodePosition(textNode,scene.text.x,scene.text.y,scene.text.z);

    if(scene.image.src){
      artNode.setAttribute('visible',false);
      new THREE.TextureLoader().load(scene.image.src,(texture)=>{
        if(revision!==sceneRevision||!artNode.isConnected){texture.dispose();return;}
        const img=texture.image||{};const pw=safeNumber(img.naturalWidth||img.videoWidth||img.width,1);const ph=safeNumber(img.naturalHeight||img.videoHeight||img.height,1);
        if('colorSpace'in texture&&THREE.SRGBColorSpace)texture.colorSpace=THREE.SRGBColorSpace;else if('encoding'in texture&&THREE.sRGBEncoding)texture.encoding=THREE.sRGBEncoding;
        texture.needsUpdate=true;const w=scene.image.width;const h=scene.image.height===null?w*(ph/Math.max(1,pw)):scene.image.height;
        const geometry=new THREE.PlaneGeometry(w,h);const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:scene.image.opacity,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
        material.userData.webarBaseOpacity=scene.image.opacity;const mesh=new THREE.Mesh(geometry,material);mesh.renderOrder=2;
        artNode.setObject3D('mesh',mesh);artNode.setAttribute('visible',true);animateNode(artNode,scene.image.animation,scene.image.durationMs,scene.image);if(options.transition)fadeInNode(artNode);
      },undefined,(error)=>{if(revision===sceneRevision){artNode.setAttribute('visible',false);console.warn(`No se pudo cargar ${scene.image.src}`,error);}});
    }

    if(scene.text.content.trim()){
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.max(128,Math.round(1024*scene.text.height/scene.text.width));
      const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.globalAlpha=scene.text.opacity;
      ctx.textAlign=scene.text.align;ctx.textBaseline='top';ctx.font=`${scene.text.fontWeight} ${scene.text.fontSize}px "${scene.text.fontFamily.replace(/"/g,'')}"`;
      const padding=Math.max(18,scene.text.fontSize*.35);const maxWidth=canvas.width-padding*2;const lines=[];
      scene.text.content.split('\n').forEach((raw)=>{if(raw===''){lines.push('');return;}let line='';raw.split(/\s+/).forEach((word)=>{const next=line?`${line} ${word}`:word;if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;});lines.push(line);});
      ctx.fillStyle='#FFFFFF';ctx.strokeStyle='#000000';ctx.lineWidth=Math.max(2,scene.text.fontSize*.055);ctx.lineJoin='round';
      const step=scene.text.fontSize*scene.text.lineHeight;const total=Math.max(step,lines.length*step);let y=padding;
      if(scene.text.verticalAlign==='middle')y=Math.max(padding,(canvas.height-total)/2);if(scene.text.verticalAlign==='bottom')y=Math.max(padding,canvas.height-total-padding);
      const x=scene.text.align==='left'?padding:scene.text.align==='right'?canvas.width-padding:canvas.width/2;
      lines.forEach((line,i)=>{const lineY=y+i*step;if(lineY<=canvas.height-padding){ctx.strokeText(line,x,lineY,maxWidth);ctx.fillText(line,x,lineY,maxWidth);}});
      ctx.globalAlpha=1;
      const texture=new THREE.CanvasTexture(canvas);if('colorSpace'in texture&&THREE.SRGBColorSpace)texture.colorSpace=THREE.SRGBColorSpace;else if('encoding'in texture&&THREE.sRGBEncoding)texture.encoding=THREE.sRGBEncoding;texture.needsUpdate=true;
      const geometry=new THREE.PlaneGeometry(scene.text.width,scene.text.height);const group=new THREE.Group();
      const bgGeo=new THREE.PlaneGeometry(scene.text.width*1.045,scene.text.height*1.12);
      const bgMat=new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.56,side:THREE.DoubleSide,depthWrite:false,depthTest:false,toneMapped:false});bgMat.userData.webarBaseOpacity=.56;
      const bg=new THREE.Mesh(bgGeo,bgMat);bg.position.z=0;bg.renderOrder=2.5;
      const mat=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:1,side:THREE.DoubleSide,depthWrite:false,depthTest:false,toneMapped:false});mat.userData.webarBaseOpacity=1;
      const mesh=new THREE.Mesh(geometry,mat);mesh.position.z=.002;mesh.renderOrder=3;group.add(bg,mesh);
      textNode.setObject3D('mesh',group);textNode.setAttribute('visible',true);animateNode(textNode,scene.text.animation,scene.text.durationMs,scene.text);if(options.transition)fadeInNode(textNode);
    }
    updateHint();
  }

  function updateHint() {
    if(!config||!targetIsVisible||activeExperienceIndex<0){setCtaVisible(false);setHint(config?.interface?.notFoundPrompt||'Apuntá la cámara a uno de los dos afiches');return;}
    const exp=config.experiences[activeExperienceIndex];
    if(exp.mode==='sequence'){
      const last=exp.currentSceneIndex>=exp.scenes.length-1;
      if(last){setHint('');setCtaVisible(true,exp);}else{setCtaVisible(false);setHint(config.interface.continuePrompt);}
    }else{
      setCtaVisible(false);
      if(!ghostVideo){setHint('Agregá el video transparente en assets/video y configurá sus rutas.');}
      else if(ghostVideoEnded){setHint(config.interface.videoEndedPrompt);}
      else{setHint(config.interface.videoPrompt);}
    }
  }

  function nextScene() {
    if(!targetIsVisible||activeExperienceIndex!==0||!config)return;
    const exp=config.experiences[0];if(exp.currentSceneIndex<exp.scenes.length-1)renderScene(0,exp.currentSceneIndex+1,{transition:true});
  }

  function isAppleWebKit() {
    const ua=navigator.userAgent||'';
    const ios=/iPhone|iPad|iPod/i.test(ua)||(/Macintosh/i.test(ua)&&navigator.maxTouchPoints>1);
    const safari=/Safari/i.test(ua)&&!/Chrome|Chromium|CriOS|Edg|FxiOS|OPiOS|Android/i.test(ua);
    return ios||safari;
  }

  function disposeGhostMesh() {
    const binding=targetBindings[1];
    if(ghostMesh){binding.videoNode.removeObject3D('mesh');ghostMesh=null;}
    if(ghostTexture){ghostTexture.dispose();ghostTexture=null;}
  }

  function createGhostMesh() {
    if(!ghostVideo||!ghostVideo.videoWidth||!ghostVideo.videoHeight)return;
    const exp=config.experiences[1];const v=exp.video;const binding=targetBindings[1];
    disposeGhostMesh();
    const height=v.height===null?v.width*(ghostVideo.videoHeight/ghostVideo.videoWidth):v.height;
    const geometry=new THREE.PlaneGeometry(v.width,height);
    ghostTexture=new THREE.VideoTexture(ghostVideo);
    if('colorSpace'in ghostTexture&&THREE.SRGBColorSpace)ghostTexture.colorSpace=THREE.SRGBColorSpace;else if('encoding'in ghostTexture&&THREE.sRGBEncoding)ghostTexture.encoding=THREE.sRGBEncoding;
    ghostTexture.minFilter=THREE.LinearFilter;ghostTexture.magFilter=THREE.LinearFilter;ghostTexture.generateMipmaps=false;
    const material=new THREE.MeshBasicMaterial({map:ghostTexture,transparent:true,alphaTest:.001,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
    ghostMesh=new THREE.Mesh(geometry,material);ghostMesh.position.set(v.x,v.y,v.z);ghostMesh.renderOrder=4;
    binding.videoNode.setObject3D('mesh',ghostMesh);binding.videoNode.setAttribute('visible',targetIsVisible&&activeExperienceIndex===1);
  }

  function prepareGhostVideo() {
    const v=config.experiences[1].video;
    const apple=isAppleWebKit();
    const src=apple?v.safariMovSrc:v.webmSrc;
    if(!src){
      ghostVideo=null;
      if(apple&&v.webmSrc)console.info('Safari/iOS necesita el archivo HEVC con alfa indicado en safariMovSrc.');
      return;
    }
    ghostVideo=document.createElement('video');
    ghostVideo.setAttribute('playsinline','');ghostVideo.setAttribute('webkit-playsinline','');
    ghostVideo.muted=true;ghostVideo.volume=0;ghostVideo.preload='auto';ghostVideo.loop=Boolean(v.loop);ghostVideo.crossOrigin='anonymous';
    ghostVideo.addEventListener('loadedmetadata',createGhostMesh);
    ghostVideo.addEventListener('ended',()=>{ghostVideoEnded=true;targetBindings[1].videoNode.setAttribute('visible',false);updateHint();});
    ghostVideo.addEventListener('error',()=>{
      console.error('No se pudo cargar el archivo del video transparente.',ghostVideo?.error);
      if(targetIsVisible&&activeExperienceIndex===1)showNotice(`No se pudo cargar el video. Revisá la ruta configurada y que el formato corresponda al dispositivo. En iPhone/Safari necesitás el archivo HEVC con canal alfa (.mov); en Android/Chrome, WebM VP9 con alfa.`);
    });
    ghostVideo.playbackRate=v.playbackRate;
    ghostVideo.src=src;ghostVideo.load();
  }

  async function startGhostVideo() {
    const v=config.experiences[1].video;const node=targetBindings[1].videoNode;
    if(!ghostVideo){
      const apple=isAppleWebKit();
      if(apple&&v.webmSrc&&!v.safariMovSrc)showNotice('En Safari/iPhone hace falta una versión HEVC con transparencia (.mov). WebM con alfa no conserva la transparencia en Safari.');
      setHint('Falta agregar el video transparente en assets/video.');return;
    }
    ghostVideoEnded=false;ghostVideo.loop=Boolean(v.loop);ghostVideo.playbackRate=clamp(safeNumber(v.playbackRate,1),.25,2.5);
    node.setAttribute('visible',true);
    const play=async()=>{
      if(!targetIsVisible||activeExperienceIndex!==1||!ghostVideo)return;
      try{
        if(ghostVideo.currentTime>0.05||ghostVideoEnded)ghostVideo.currentTime=v.startAt||0;
        await ghostVideo.play();
        if(!ghostMesh&&ghostVideo.videoWidth)createGhostMesh();
        node.setAttribute('visible',true);updateHint();
      }catch(error){
        console.warn('La reproducción del video fue bloqueada o falló.',error);
        setHint('Tocá el afiche para iniciar el video.');
        node.setAttribute('visible',false);
      }
    };
    if(ghostVideo.readyState>=2){await play();return;}
    if(ghostCanPlayHandler)ghostVideo.removeEventListener('canplay',ghostCanPlayHandler);
    ghostCanPlayHandler=()=>{ghostCanPlayHandler=null;play();};
    ghostVideo.addEventListener('canplay',ghostCanPlayHandler,{once:true});
    ghostVideo.load();
    setHint('Cargando el video del fantasma…');
  }

  function stopGhostVideo(reset=true) {
    const node=targetBindings[1].videoNode;
    node.setAttribute('visible',false);
    if(ghostVideo){ghostVideo.pause();if(reset){try{ghostVideo.currentTime=config?.experiences[1]?.video?.startAt||0;}catch(_){/* espera metadatos */}ghostVideoEnded=false;}}
  }

  function validateTargetFile(path) {
    return fetch(path,{cache:'no-store'}).then((response)=>{if(!response.ok)throw new Error('missing-target');return response.arrayBuffer();}).then((buffer)=>{if(!buffer||buffer.byteLength<100)throw new Error('invalid-target');});
  }
  function waitForScene(){if(sceneEl.hasLoaded)return Promise.resolve();return new Promise((resolve)=>sceneEl.addEventListener('loaded',resolve,{once:true}));}

  function registerTargetEvents() {
    targetBindings.forEach((binding)=>{
      binding.targetEl.addEventListener('targetFound',()=>{
        if(!config)return;
        const expIndex=config.experiences.findIndex((exp)=>exp.targetIndex===binding.targetIndex);if(expIndex<0)return;
        const changed=activeExperienceIndex!==expIndex;
        if(activeExperienceIndex===1&&expIndex!==1)stopGhostVideo(true);
        activeExperienceIndex=expIndex;targetIsVisible=true;hideNotice();setCtaVisible(false);
        const exp=config.experiences[expIndex];
        if(exp.mode==='sequence'){if(changed)renderScene(expIndex,exp.currentSceneIndex||0);else updateHint();}
        else if(changed||ghostVideoEnded||(ghostVideo&&ghostVideo.paused))startGhostVideo();
        else updateHint();
      });
      binding.targetEl.addEventListener('targetLost',()=>{
        const expIndex=config?.experiences.findIndex((exp)=>exp.targetIndex===binding.targetIndex);
        if(activeExperienceIndex===expIndex){
          if(expIndex===1)stopGhostVideo(true);
          targetIsVisible=false;activeExperienceIndex=-1;setCtaVisible(false);updateHint();
        }
      });
      binding.tapEl.addEventListener('click',(event)=>{
        event.stopPropagation();if(!config||!targetIsVisible||activeExperienceIndex<0)return;
        if(config.experiences[activeExperienceIndex].targetIndex!==binding.targetIndex)return;
        if(activeExperienceIndex===0)nextScene();
        else if(activeExperienceIndex===1&&ghostVideo&&(ghostVideoEnded||ghostVideo.paused))startGhostVideo();
      });
    });
  }

  async function startExperience() {
    try{
      setHint('Preparando la experiencia…');
      const response=await fetch(CONFIG_URL,{cache:'no-store'});
      if(!response.ok)throw new Error('No se pudo abrir config.json. Verificá que esté en la carpeta principal del proyecto.');
      config=normalizeConfig(await response.json());await loadCustomFonts();
      config.experiences.forEach((exp)=>{
        const binding=getExperienceBinding(exp);if(!binding)throw new Error(`Falta el contenedor HTML para el índice ${exp.targetIndex}.`);
        binding.tapEl.setAttribute('width',exp.target.width);binding.tapEl.setAttribute('height',exp.target.height);
        binding.targetEl.setAttribute('mindar-image-target',`targetIndex: ${exp.targetIndex}`);
      });
      prepareGhostVideo();
      await waitForScene();
      const makeRendererTransparent=()=>{const renderer=sceneEl.renderer;if(!renderer)return;renderer.setClearColor(0x000000,0);renderer.setClearAlpha(0);if(renderer.domElement)renderer.domElement.style.background='transparent';};
      makeRendererTransparent();sceneEl.addEventListener('renderstart',makeRendererTransparent,{once:true});
      try{await validateTargetFile(config.tracker.src);}catch(_){
        showNotice('Falta el archivo de reconocimiento combinado: targets/poster.mind. Primero publicá este proyecto en GitHub Pages, abrí tools/compilar-afiches.html desde la computadora, generá poster.mind con los dos afiches y subilo a la carpeta targets. Las instrucciones están en README.md.');
        setHint('Falta generar el archivo de reconocimiento');return;
      }
      registerTargetEvents();
      const arSystem=sceneEl.systems['mindar-image-system'];
      if(!arSystem||typeof arSystem.start!=='function')throw new Error('No se pudo iniciar MindAR. Comprobá la conexión a internet y la carga de A-Frame/MindAR.');
      sceneEl.addEventListener('arReady',()=>{hideNotice();updateHint();});
      sceneEl.addEventListener('arError',()=>{showNotice('No se pudo iniciar la cámara. Revisá el permiso de cámara y abrí la experiencia mediante HTTPS.');setHint('No se pudo iniciar la cámara');});
      setHint('Solicitando acceso a la cámara…');
      const result=arSystem.start();if(result&&typeof result.catch==='function')result.catch(()=>{showNotice('No se pudo iniciar la cámara. Revisá los permisos y usá una dirección HTTPS.');setHint('No se pudo iniciar la cámara');});
    }catch(error){
      console.error(error);if(location.protocol==='file:')showNotice('No abras index.html directamente desde una carpeta. La cámara requiere HTTPS o un servidor local.');else showNotice(error.message||'Ocurrió un error al iniciar la experiencia.');setHint('No se pudo preparar la experiencia');
    }
  }

  ctaButton.addEventListener('click',(event)=>{
    const exp=config?.experiences?.[0];const url=validExternalUrl(exp?.cta?.url);
    if(!url){event.preventDefault();showNotice('Todavía falta agregar la dirección web en el editor visual o en config.json.');return;}
    ctaButton.href=url;
  });
  ctaRestart.addEventListener('click',(event)=>{event.preventDefault();event.stopPropagation();if(!targetIsVisible||activeExperienceIndex!==0)return;renderScene(0,0,{transition:true});});

  window.addEventListener('pagehide',()=>{
    targetBindings.forEach(({artNode,textNode})=>{stopAnimation(artNode);stopAnimation(textNode);stopTransition(artNode);stopTransition(textNode);});
    stopGhostVideo(false);
    activeExitClones.forEach((frame,clone)=>{cancelAnimationFrame(frame);clone.parent?.remove(clone);disposeClonedObject(clone);});
    activeExitClones.clear();
  });
  startExperience();
})();
