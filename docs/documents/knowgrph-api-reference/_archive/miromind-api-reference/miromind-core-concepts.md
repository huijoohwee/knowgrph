# Core Concepts

Understanding Workflow, Agent, and Step - the building blocks of MiroMind

Before diving into API integration, it's essential to understand the three core concepts that power MiroMind: Workflow, Agent, and Step. These hierarchical components work together to execute complex AI tasks.

---

## Workflow

The Top-Level Execution Container

A Workflow is the highest-level execution unit in the platform. It represents a complete AI task request from the user, containing all input, output, and execution state. Each Workflow corresponds to one API request and manages the entire lifecycle of an AI task.

#### Key Properties

- **workflow_id**: Unique identifier for tracking and managing the workflow
- **status**: Execution state (queued, in_progress, completed, failed, cancelled)
- **input**: Input messages provided by the user (array of message objects)
- **agents**: List of Agents executed within this workflow

#### Example Use Case

```
User sends a research request → Creates a Workflow → Executes multiple Agents → Returns final result
```

---

## Agent

Autonomous Task Executor

An Agent is an autonomous AI entity within a Workflow that executes specific tasks. Each Agent has a unique name and role (e.g., 'researcher', 'writer', 'reviewer'). Agents can collaborate and communicate with each other to complete complex multi-step tasks.

#### Key Properties

- **agent_id**: Unique identifier for the agent
- **name**: Agent's name (e.g., 'main', 'researcher', 'analyzer')
- **status**: Execution state (started, completed, failed)
- **steps**: List of Steps executed by this agent

#### Example Use Case

```
A 'researcher' Agent might first search for information (Tool Call Step), then generate a summary (Message Step)
```

---

## Step

The Smallest Unit of Execution

A Step is the smallest unit of execution within an Agent. Each Step represents a specific action, such as generating a text message or calling an external tool. Steps are executed sequentially and can be streamed in real-time to provide incremental updates.

#### Step Types

- Message Step: Generates text content using an AI model, streamed token by token
- Tool Call Step: Calls external tools or APIs (e.g., web search, calculator, database query)

#### Key Properties

- **step_id**: Unique identifier for the step
- **type**: Step type ('message' or 'tool_call')
- **status**: Execution state (created, in_progress, completed, failed)
- **delta**: Incremental updates (e.g., new tokens for message steps)

#### Example Use Case

Message Step: Streaming 'Hello, how can I help you today?' token by token

---

## Relationship & Hierarchy

Understanding how Workflow, Agent, and Step work together is crucial for effective API integration:

```
Workflow: Top-level container for the entire AI task
↓ Contains one or more
Agent: Autonomous executor handling specific responsibilities
↓ Executes multiple
Step: Atomic action generating results
```

### Complete Execution Flow

1. User creates a Workflow with a research request
2. Workflow starts and creates a 'researcher' Agent
3. Agent executes Step 1: Tool Call (web search)
4. Agent executes Step 2: Message (generate summary)
5. Agent completes, Workflow returns final result

---

## Next Steps

Now that you understand the core concepts, you're ready to start integrating:

- [Learn how to authenticate with API Keys](https://platform.miromind.ai/docs/authentication)

- [Explore Chat Completions API endpoints and usage](https://platform.miromind.ai/docs/chat-completions)

- [Understand real-time streaming events for Steps and Agents](https://platform.miromind.ai/docs/streaming)

---

Source: https://platform.miromind.ai/docs/concepts
Converted: 2026-05-27
