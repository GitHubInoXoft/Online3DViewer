import { IsDefined } from '../core/core.js';
import { Direction } from '../geometry/geometry.js';
import { Importer, ImportErrorCode, ImportSettings } from '../import/importer.js';
import { FileSource, TransformFileHostUrls } from '../io/fileutils.js';
import { ParameterConverter } from '../parameters/parameterlist.js';
import { ThreeModelLoader } from '../threejs/threemodelloader.js';
import { Viewer } from './viewer.js';

export class EmbeddedViewer
{
    constructor (parentElement, parameters)
    {
        this.parentElement = parentElement;
        this.parameters = {};
        if (IsDefined (parameters)) {
            this.parameters = parameters;
        }

        this.canvas = document.createElement ('canvas');
        this.parentElement.appendChild (this.canvas);

        this.viewer = new Viewer ();
        this.viewer.Init (this.canvas);

        let width = this.parentElement.clientWidth;
        let height = this.parentElement.clientHeight;
        this.viewer.Resize (width, height);

        if (this.parameters.backgroundColor) {
            this.viewer.SetBackgroundColor (this.parameters.backgroundColor);
        }

        if (this.parameters.edgeSettings) {
            this.viewer.SetEdgeSettings (
                this.parameters.edgeSettings.showEdges,
                this.parameters.edgeSettings.edgeColor,
                this.parameters.edgeSettings.edgeThreshold
            );
        }

        if (this.parameters.environmentSettings) {
            let environmentMap = this.parameters.environmentSettings.environmentMap;
            let backgroundIsEnvMap = this.parameters.environmentSettings.backgroundIsEnvMap;
            this.viewer.SetEnvironmentMapSettings (environmentMap, backgroundIsEnvMap);
        }

        window.addEventListener ('resize', () => {
            this.Resize ();
        });
    }

    Uuidv4 ()
    {
        return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
          (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
        );
    }

    GenerateTreeList (data, fileName, meshes, meshesNames)
    {
        if (!data || !data.childNodes.length) return [];

        const treeList = [];
        const defaultAttrs = {
            visible: true,
            transparent: false,
            opacity: 1
        };


        data.childNodes.forEach((child) => {
            let obj = {};

            if (child.type === 1) {
                obj = meshes[this.viewer.treeMeshsesNumber];
                obj.name = meshesNames[this.viewer.treeMeshsesNumber];

                this.viewer.treeMeshsesNumber++;

                obj.title = child.name;
                obj.key = this.Uuidv4();
                obj.children = [];
            } else {
                obj = {
                    title: child.name,
                    key: this.Uuidv4(),
                    type: 'Group',
                    children: this.GenerateTreeList(child, null, meshes, meshesNames),
                    ...defaultAttrs,
                };
            }

            treeList.push(obj);
        });

        if (fileName) {
            return [
                {
                    title: fileName,
                    key: this.Uuidv4(),
                    type: 'Group',
                    children: treeList,
                    ...defaultAttrs
                }
            ];
        }

        return treeList;
    }

    LoadModel (file, isAddingObject, isUploaded)
    {
        const setFileNameToMeshes = (object, fileName, fileId) =>
        {
            object.children.forEach((child) => {
                if (child.type === 'Mesh') {
                    child.fileName = fileName;
                    child.fileId = fileId;
                } else {
                    setFileNameToMeshes(child, fileName, fileId);
                }
            });
        };

        this.viewer.treeMeshsesNumber = 0;

        return new Promise((resolve, reject) => {
            let loader = new ThreeModelLoader ();
            let settings = new ImportSettings ();

            if (this.parameters.defaultColor) {
                settings.defaultColor = this.parameters.defaultColor;
            }

            loader.LoadModel ([file], FileSource.Url, settings, {
                onLoadStart : () => {
                    console.log('onLoadStart');
                    this.canvas.style.display = 'none';
                },
                onImportStart : () => {
                    console.log('onImportStart');
                },
                onVisualizationStart : () => {
                    console.log('onVisualizationStart');
                },
                onModelFinished : (importResult, threeObject) => {
                    console.log('onModelFinished (importResult, threeObject)', importResult, threeObject);
                    this.canvas.style.display = 'inherit';

                    if (isUploaded) {
                        threeObject.name = file.name;
                        setFileNameToMeshes(threeObject, file.name, threeObject.id);
                    }

                    if (isAddingObject) {
                        this.viewer.AddObjectToMain(threeObject);
                        this.viewer.meshesNames = [
                            ...this.viewer.meshesNames,
                            ...importResult.model.meshes.map((mesh) => mesh.name)
                        ];
                        let meshes = [];
                        let meshIdx = 0;
                        this.viewer.geometry.EnumerateMeshes((mesh) => {
                            if (meshIdx > this.viewer.lastMeshIdx) {
                                meshes.push(mesh);
                                this.viewer.lastMeshIdx++;
                            }
                            meshIdx++;
                        });
                        this.viewer.treeList = [
                          ...this.viewer.treeList,
                          ...this.GenerateTreeList(
                            importResult.model.root,
                            file.name,
                            [...meshes],
                            [...this.viewer.meshesNames]
                          ),
                        ];
                        resolve();
                        return;
                    }

                    this.viewer.SetMainObject (threeObject);
                    let boundingSphere = this.viewer.GetBoundingSphere (() => {
                        return true;
                    });
                    this.viewer.AdjustClippingPlanesToSphere (boundingSphere);
                    if (this.parameters.camera) {
                        this.viewer.SetCamera (this.parameters.camera);
                    } else {
                        this.viewer.SetUpVector (Direction.Y, false);
                    }
                    this.viewer.FitSphereToWindow (boundingSphere, false);
                    this.viewer.meshesNames = importResult.model.meshes.map((mesh) => mesh.name);
                    let meshes = [];
                    this.viewer.geometry.EnumerateMeshes((mesh) => {
                        meshes.push(mesh);
                    });
                    this.viewer.lastMeshIdx = meshes.length - 1;
                    this.viewer.treeList = this.GenerateTreeList(
                      importResult.model.root,
                      isUploaded && file.name,
                      meshes,
                      [...this.viewer.meshesNames]
                    );
                    resolve();
                },
                onTextureLoaded : () => {
                    console.log('onTextureLoaded');
                    this.viewer.Render ();
                },
                onLoadError : (importError) => {
                    console.log('onLoadError');
                    let message = 'Unknown error';
                    if (importError.code === ImportErrorCode.NoImportableFile) {
                        message = 'No importable file found';
                    } else if (importError.code === ImportErrorCode.FailedToLoadFile) {
                        message = 'Failed to load file for import.';
                    } else if (importError.code === ImportErrorCode.ImportFailed) {
                        message = 'Failed to import model.';
                    }
                    if (importError.message !== null) {
                        message += ' (' + importError.message + ')';
                    }
                    reject(message);
                }
            }, isUploaded);
        });
    }

    async LoadModelFromUrls (modelUrls, extension, callback)
    {
        this.viewer.Clear ();
        if (modelUrls === null || modelUrls.length === 0) {
            return null;
        }
        TransformFileHostUrls (modelUrls);

        if (extension === 'zip') {
            const importer = new Importer ();
            const files = await importer.GetFilesFromZipFile(modelUrls);
            let isAddingObject = false;

            for (const [i, file] of files.entries()) {
                if (file.extension === 'zip') continue;
                await this.LoadModel(file, isAddingObject, true);
                isAddingObject = true;
                if (i === files.length-1) {
                    callback();
                }
            }
        } else {
            try {
                await this.LoadModel(modelUrls[0], false, false);
                callback();
            } catch (e) {
                callback(e);
            }
        }
    }

    GetViewer ()
    {
        return this.viewer;
    }

    Resize ()
    {
        let width = this.parentElement.clientWidth;
        let height = this.parentElement.clientHeight;
        this.viewer.Resize (width, height);
    }
}

export function Init3DViewerElement (parentElement, modelUrls, parameters)
{
    let viewer = new EmbeddedViewer (parentElement, parameters);
    viewer.LoadModelFromUrls (modelUrls);
    return viewer;
}

export function Init3DViewerElements (onReady)
{
    function LoadElement (element)
    {
        let camera = null;
        let cameraParams = element.getAttribute ('camera');
        if (cameraParams) {
            camera = ParameterConverter.StringToCamera (cameraParams);
        }

        let backgroundColor = null;
        let backgroundColorParams = element.getAttribute ('backgroundcolor');
        if (backgroundColorParams) {
            backgroundColor = ParameterConverter.StringToColor (backgroundColorParams);
        }

        let defaultColor = null;
        let defaultColorParams = element.getAttribute ('defaultcolor');
        if (defaultColorParams) {
            defaultColor = ParameterConverter.StringToColor (defaultColorParams);
        }

        let edgeSettings = null;
        let edgeSettingsParams = element.getAttribute ('edgesettings');
        if (edgeSettingsParams) {
            edgeSettings = ParameterConverter.StringToEdgeSettings (edgeSettingsParams);
        }

        let environmentSettings = null;
        let environmentMapParams = element.getAttribute ('environmentmap');
        if (environmentMapParams) {
            let environmentMapParts = environmentMapParams.split (',');
            if (environmentMapParts.length === 6) {
                let backgroundIsEnvMap = false;
                let backgroundIsEnvMapParam = element.getAttribute ('environmentmapbg');
                if (backgroundIsEnvMapParam && backgroundIsEnvMapParam === 'true') {
                    backgroundIsEnvMap = true;
                }
                environmentSettings = {
                    environmentMap : environmentMapParts,
                    backgroundIsEnvMap : backgroundIsEnvMap
                };
            }
        }

        let modelUrls = null;
        let modelParams = element.getAttribute ('model');
        if (modelParams) {
            modelUrls = ParameterConverter.StringToModelUrls (modelParams);
        }

        return Init3DViewerElement (element, modelUrls, {
            camera : camera,
            backgroundColor : backgroundColor,
            defaultColor : defaultColor,
            edgeSettings : edgeSettings,
            environmentSettings : environmentSettings
        });
    }

    let viewerElements = [];
    window.addEventListener ('load', () => {
        let elements = document.getElementsByClassName ('online_3d_viewer');
        for (let i = 0; i < elements.length; i++) {
            let element = elements[i];
            let viewerElement = LoadElement (element);
            viewerElements.push (viewerElement);
        }
        if (onReady !== undefined && onReady !== null) {
            onReady (viewerElements);
        }
    });
}
