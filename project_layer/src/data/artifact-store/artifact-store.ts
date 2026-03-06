import type {
  GetArtifactRequest,
  IArtifactStore,
  ListArtifactRequest,
  WriteArtifactRequest,
} from "../../shared/contracts/artifact-store.js";

export class ArtifactStoreService implements IArtifactStore {
  async writeArtifact(_request: WriteArtifactRequest): Promise<boolean> {
    return true;
  }

  async getArtifact(_request: GetArtifactRequest): Promise<string> {
    return "";
  }

  async listArtifacts(_query: ListArtifactRequest): Promise<string[]> {
    return [];
  }
}
