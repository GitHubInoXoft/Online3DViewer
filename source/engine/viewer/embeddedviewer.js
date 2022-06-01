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

    LoadModel (url, isUploaded)
    {
        return new Promise((resolve, reject) => {
            let loader = new ThreeModelLoader ();
            let settings = new ImportSettings ();

            if (this.parameters.defaultColor) {
                settings.defaultColor = this.parameters.defaultColor;
            }

            loader.LoadModel ([url], FileSource.Url, settings, {
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
                    console.log('onModelFinished');
                    this.canvas.style.display = 'inherit';
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

    async LoadModelFromUrls (modelUrls, callback)
    {
        this.viewer.Clear ();
        if (modelUrls === null || modelUrls.length === 0) {
            return null;
        }
        TransformFileHostUrls (modelUrls);

        let settings = new ImportSettings ();
        if (this.parameters.defaultColor) {
            settings.defaultColor = this.parameters.defaultColor;
        }

        const importer = new Importer ();
        const files = await importer.GetFilesFromZipFile(modelUrls);

        for (const [i, file] of files.entries()) {
            if (file.extension === 'zip') continue;
            await this.LoadModel(file, true);
            if (i === files.length-1) {
                callback();
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
