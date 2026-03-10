# 1. System Overview
hello-service uses a minimal function export as the service boundary.

# 2. Runtime Flow
The service exposes one hello function returning a stable string for hello-service.

# 3. Module Design
- Workflow

# 4. Data and State
No persistent state is required.

# 5. Validation Strategy
Validate that the generated file exists and exports the expected function.