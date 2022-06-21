function CreateLineFromPoints (points, material)
{
  let geometry = new THREE.BufferGeometry ().setFromPoints (points);
  return new THREE.Line (geometry, material);
}

function CreateMaterial ()
{
  return new THREE.LineBasicMaterial ({
    color : 0x263238,
    depthTest : false
  });
}

export class MovingTool {
  constructor (viewer, scene)
  {
    this.viewer = viewer;
    this.scene = scene;
    this.obj = null;

    // const size = 100;
    // const divisions = 100;
    // const gridHelper = new THREE.GridHelper( size, divisions );
    // this.scene.add( gridHelper );
    // this.viewer.AddExtraObject (gridHelper);
  }

  AddArrowHelper ()
  {
    // direction: se {x: 0, y: 0, z: -1}
    // origin: se {x: 0, y: 0, z: 0}

    // let raycaster = new THREE.Raycaster ();

    // console.log('raycaster', raycaster);

    // let arrowHelper = new THREE.ArrowHelper(raycaster.ray.direction, raycaster.ray.origin, 5, 0xff0000);

    const center = this.GetCenterPoint(this.obj);

    let aa = new THREE.Vector3(center.x, center.y, center.z);

    let arrowHelper1 = new THREE.ArrowHelper(new THREE.Vector3(2, 0, 0), aa, 300, 0x00FF00);
    let arrowHelper2 = new THREE.ArrowHelper(new THREE.Vector3(0, 2, 0), aa, 300, 0xff0000);
    let arrowHelper3 = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 2), aa, 300, 0x0000FF);

    // let arrowHelper3 = new THREE.ArrowHelper(new THREE.Vector3(0, 0, 2).normalize(), new THREE.Vector3(0, 0, 0), 50, 0x0000FF);

    // this.obj.add(arrowHelper1);

    this.viewer.ClearExtra ();

    this.viewer.AddExtraObject (arrowHelper1);
    this.viewer.AddExtraObject (arrowHelper2);
    this.viewer.AddExtraObject (arrowHelper3);
  }

  GetCenterPoint (mesh)
  {
    let middle = new THREE.Vector3();
    let geometry = mesh.geometry;

    geometry.computeBoundingBox();

    middle.x = (geometry.boundingBox.max.x + geometry.boundingBox.min.x) / 2;
    middle.y = (geometry.boundingBox.max.y + geometry.boundingBox.min.y) / 2;
    middle.z = (geometry.boundingBox.max.z + geometry.boundingBox.min.z) / 2;

    mesh.localToWorld( middle );

    console.log('middle', middle);

    return middle;
  }

  Click (mouseCoordinates)
  {
    // this.viewer.geometry.Aaa();
    // this.viewer.geometry.Bbb();


    let intersection = this.viewer.GetMeshIntersectionUnderMouse(mouseCoordinates);
    // console.log('intersection', intersection);
    if (intersection === null || (this.obj && intersection.object.uuid === this.obj.uuid)) {
      this.obj = null;
      return;
    }
    console.log('intersection', intersection);
    this.obj = intersection.object;
    this.AddArrowHelper();

    // FIXME
    // let plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    // this.scene.add(new THREE.PlaneHelper( plane, 100, 0xffff00 ));
    // this.viewer.geometry.mainObject.add(gridHelper);
  }

  MouseMove (mouseCoords)
  {
    if (!this.obj) return;

    // let { width, height } = this.viewer.GetCanvasSize ();
    // let mousePos = new THREE.Vector2 ();
    // let raycaster = new THREE.Raycaster ();
    // let intersects = new THREE.Vector3 ();
    // let plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    //
    // mousePos.x = (mouseCoords.x / width) * 2 - 1;
    // mousePos.y = -(mouseCoords.y / height) * 2 + 1;
    //
    // raycaster.setFromCamera(mousePos, this.viewer.camera);
    // raycaster.ray.intersectPlane(plane, intersects);
    //
    // console.log('intersects', intersects);
    //
    // // this.obj.position.set(intersects.x, intersects.y, intersects.z);
    // this.obj.position.x = intersects.x;
    // // this.obj.position.y = intersects.y;
    // this.obj.position.z = intersects.z;
    // this.viewer.Render();
  }
}