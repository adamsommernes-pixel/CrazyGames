// Reference stage: two meshing gears and an overlay card. Shows the stage API.
WX.registerStage('example', function (ctx) {
  const { THREE, WX, group, overlay } = ctx;
  const a = new THREE.Mesh(WX.gearGeo(40, 0.6, 4, 0.5), WX.mat('brass')); group.add(a);
  const bx = WX.pr(40, 0.5) + WX.pr(10, 0.5);
  const b = new THREE.Mesh(WX.gearGeo(10, 0.6, 0, 0.5), WX.mat('nickel')); b.position.x = bx; group.add(b);
  const phase = WX.meshPhase(0, 0, 40, bx, 0, 10);
  const label = WX.textPlane('40 → 10', { size: 1.4 }); label.position.set(0, -13, 0); group.add(label);
  ctx.anchor('big', group, -6, 6, 0.3);
  overlay.innerHTML = '<div class="ov-card" style="left:24px;top:24px"><div class="ov-k">Ratio</div><div class="ov-big"><span class="ov-accent">4</span> : 1</div></div>';
  return {
    cameras: { front: { t: [3, 0, 0], yaw: 0, pitch: 0.15, dist: 70 }, angle: { t: [3, 0, 0], yaw: 0.7, pitch: 0.5, dist: 70 } },
    update(u, p) { const ang = -u * (p.speed || 0.5); a.rotation.z = ang; b.rotation.z = -ang * 4 + phase; },
  };
});
