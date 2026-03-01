> 用户为什么需要它
用户怎么使用它
系统对用户承诺什么结果
首版做什么不做什么
如何判断产品成功


# background
- In most cases, It's hard to get runable programs from an idea. 
- if we could get programs by developing from ai in low cost(time,starffs).
- we could verfri our idea in short time and matian programs with ai as user requirements changs.

# Target users

- engineers :
    - how to use: cli or ui
    - response: in charge of development part(code and docs monitor)
- product managers: using with ui
    - how to use: ui
    - response: in charge of users usage, updating users requirements and confirm final program usage result

# User Journey
1. product manager entire prodect's dir then input or update requirements to requirements.md
2. pm use ui to call cli to lunch programs
3. programs generate changes from currenet requirement.md compared last doc
4. pm confirm changes
    4.1 if failed, move to step 1
5. programs generate architecture、module design from change of requirements
6. engineers confirm design of diffs form current design doc compared last design technical docs
7. programs generate update prodect's code into mutiple part to simplify review by engineers form technical changes 
8. programs run loop untile all parts of changing code are apply in code respository.
    8.1 update one part of changing code into project
    8.2 run test for product with this part of change
    8.3 if test pass, make a pr to enginner to review
9. enginer check and confirm the result of target product's usage
    9.1 if pass, notice pm
    9.2 if failed, engineer move to step 5
9. pm check and confirm the result of target product's usage

# inputs &&outputs

## inputs: 
- requirements.md structed with
    - Problem
    - Target Users
    - Core Use Cases
    - Product Scope
    -  User Journey
    - Inputs and Outputs
    - Core Features
    - Constraints and Non-Goals
    - Success Metrics
    - Risks
- outputs: 
    - generate changes in product's dir to trace after
    - generate running programs in product's dir
    - generate test report
## Outputs
- architecture.md 
    - Requirements exploration: Understand the problem clarifying questions
    - Architecture/high-level  design: Identfy key-components and how they releated to each other
    - Data model/Core entites:  Descripe the core entities and it's data including field, and which component the entities belong
    - API Design: Define the api between different components, including their params and responses
    - Optimization and deeping dive: List key possible issues in complex sutitions to optimizations 


# core abilities

1. Requirement management
pm can create/edit/update requirement doc as the source of truth for generation and maiantenance 
2. Artifact Generation
The system can generate key project arifacts from requirements, such as task breakdowns and project reurces
3. Process Visibilty and change confirmation
The system shows the exeution proggress, generate outputs and pending changes and allow users to confirm important modifycations before apply changing them
4. continuous maintenance
When requirements change, the system can update existing artifacts instead of regenerate everything from scrtch


# constrains


# success criteria

Programs can generate and maintain rograms by ai from requirements.

- v1: have ability to generage a runnable programs from requirements.md
- v2: 
- v3:  

- program must pass test case
# risks and borders

## Standard Flow step

1. Users create or update a requirement document
2. Users launch this program from cli or ui
3. The programs analyze requirement and identifies thee requested changes. 
4. The program shows changes of key artifacts compared with previous version
4. The users confirm whether to apply update
5. The program updates the affected artifacts
6. The program outputs updated result and valdation feedback



# User Journey
1. product manager entire prodect's dir then input or update requirements to requirements.md
2. pm use ui to call cli to lunch programs
3. programs generate changes from currenet requirement.md compared last doc
4. pm confirm changes
    4.1 if failed, move to step 1
5. programs generate architecture、module design from change of requirements
6. engineers confirm design of diffs form current design doc compared last design technical docs
7. programs generate update prodect's code into mutiple part to simplify review by engineers form technical changes 
8. programs run loop untile all parts of changing code are apply in code respository.
    8.1 update one part of changing code into project
    8.2 run test for product with this part of change
    8.3 if test pass, make a pr to enginner to review
9. enginer check and confirm the result of target product's usage
    9.1 if pass, notice pm
    9.2 if failed, engineer move to step 5
9. pm check and confirm the result of target product's usage