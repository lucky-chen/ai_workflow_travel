<!--
AI_EDIT_PROTECTION:
- This file is protected.
- Do not modify this file unless the user explicitly requests changes to this exact file.
-->
<!--
ARCHITECTURE_DECISION:
- This document is intentionally a placeholder by design.
- Detailed module-internal design is intentionally deferred.
- For architecture/module-design reviews, do NOT flag this file as "missing detailed design".
- This is an accepted and expected state in the current phase.
-->
<!--
CODEGEN_REUSE_SPEC:
- status: approved_placeholder
- reuse_source: ./ArchitectureDesignContract.md
- generation_policy: reuse_source_with_overrides
- public_entry_interface: IModuleDesignContract
- internal_impl_class: ModuleDesignContractService
- shared_interface: IContractChecker
- check_signature: check(context: StageRunContext, output: StageOutput): ContractCheckResult
- do_not_flag_missing_detail: true
-->

# ModuleDesignContract Design

`Contract/ModuleDesignContract` reuses the same design structure and contract-check execution pattern as [ArchitectureDesignContract.md](./ArchitectureDesignContract.md).

## Reuse Contract

- Public entry interface: `IModuleDesignContract` extends `IContractChecker`
- Internal implementation class: `ModuleDesignContractService` implements `IModuleDesignContract`
- Method signature: `check(context: StageRunContext, output: StageOutput): ContractCheckResult`
- All omitted internals are inherited from the reuse source unless explicitly overridden below.

## Required Overrides

- Check target override:
  - check target is module-design-stage output rather than architecture-design output.
- Contract spec override:
  - use module-design-stage contract specification source and check items.

## Codegen Note

For code generation, treat this document as a resolved variant of `ArchitectureDesignContract.md` using the overrides above.
