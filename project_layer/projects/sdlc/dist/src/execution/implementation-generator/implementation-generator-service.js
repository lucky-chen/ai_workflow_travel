import { ChangeApplier } from "./change-applier.js";
import { ImplementationPromptBuilder } from "./implementation-prompt-builder.js";
import { ModuleDesignLoader } from "./module-design-loader.js";
import { ProjectContextLoader } from "./project-context-loader.js";
import { StageOutputBuilder } from "./stage-output-builder.js";
export class ImplementationGeneratorService {
    moduleDesignLoader;
    projectContextLoader;
    promptBuilder;
    llmExecutor;
    changeApplier;
    outputBuilder;
    static create(artifactStore, llmExecutor) {
        return new ImplementationGeneratorService(new ModuleDesignLoader(artifactStore), new ProjectContextLoader(), new ImplementationPromptBuilder(), llmExecutor, new ChangeApplier(), new StageOutputBuilder());
    }
    constructor(moduleDesignLoader, projectContextLoader, promptBuilder, llmExecutor, changeApplier, outputBuilder) {
        this.moduleDesignLoader = moduleDesignLoader;
        this.projectContextLoader = projectContextLoader;
        this.promptBuilder = promptBuilder;
        this.llmExecutor = llmExecutor;
        this.changeApplier = changeApplier;
        this.outputBuilder = outputBuilder;
    }
    async run(context) {
        const moduleDesignDoc = await this.moduleDesignLoader.loadModuleDesign(context);
        const projectContext = await this.projectContextLoader.loadProjectContext(context);
        const request = this.promptBuilder.build({ moduleDesignDoc, projectContext });
        const llmResult = await this.llmExecutor.execute(request);
        const generatedChanges = this.changeApplier.parseGeneratedChanges(llmResult);
        return this.outputBuilder.build(context.stageId, generatedChanges);
    }
}
