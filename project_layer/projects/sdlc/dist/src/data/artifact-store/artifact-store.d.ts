import type { GetArtifactRequest, IArtifactStore, ListArtifactRequest, WriteArtifactRequest } from "../../shared/contracts/pipeline.js";
export declare class ArtifactStoreService implements IArtifactStore {
    private readonly storageRoot;
    constructor(storageRoot?: string);
    writeArtifact(request: WriteArtifactRequest): Promise<boolean>;
    getArtifact(request: GetArtifactRequest): Promise<string>;
    listArtifacts(query: ListArtifactRequest): Promise<string[]>;
    private getArtifactAbsolutePath;
    private getStageDirectory;
    private walkRelativePaths;
}
