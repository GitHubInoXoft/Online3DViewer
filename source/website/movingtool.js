export class MovingTool {
  constructor (viewer, scene)
  {
    this.viewer = viewer;
    this.scene = scene;
    this.obj = null;
  }

  AddArrowHelper ()
  {
    // direction: se {x: 0, y: 0, z: -1}
    // origin: se {x: 0, y: 0, z: 0}

    let raycaster = new THREE.Raycaster ();
    let arrowHelper = new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, 5, 0xff0000);
    arrowHelper.line.material.linewidth = 200;
    this.obj.add(arrowHelper);
  }

  Click (mouseCoordinates)
  {
    let intersection = this.viewer.GetMeshIntersectionUnderMouse(mouseCoordinates);
    if (intersection === null || (this.obj && intersection.object.uuid === this.obj.uuid)) {
      this.obj = null;
      return;
    }
    this.obj = intersection.object;
    this.AddArrowHelper();

    // FIXME
    // let plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    // this.scene.add(new THREE.PlaneHelper( plane, 100, 0xffff00 ));
  }

  MouseMove (mouseCoords)
  {
    if (!this.obj) return;

    let { width, height } = this.viewer.GetCanvasSize ();
    let mousePos = new THREE.Vector2 ();
    let raycaster = new THREE.Raycaster ();
    let intersects = new THREE.Vector3 ();
    let plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    mousePos.x = (mouseCoords.x / width) * 2 - 1;
    mousePos.y = -(mouseCoords.y / height) * 2 + 1;

    raycaster.setFromCamera(mousePos, this.viewer.camera);
    raycaster.ray.intersectPlane(plane, intersects);

    this.obj.position.set(intersects.x, intersects.y, intersects.z);
    this.viewer.Render();
  }
}