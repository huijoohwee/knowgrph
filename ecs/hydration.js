import { allocateEntity, createWorld, registerComponent } from "./index.js";
import {
  ECS_COMPONENT_SCHEMA_NODE_TYPE,
  ECS_DECISION_NODE_TYPE,
  ECS_ENTITY_NODE_TYPE,
  KgcNodeContractError,
  assertRepresentableComponentValue,
  compareCanonicalStrings,
  normalizeComponentSchemaNode,
  normalizeDecisionNode,
  normalizeEntityNode,
  readKgcNodeState,
} from "./kgcNodeContract.js";

const KGC_COMPUTING_FLOW_SCHEMA = "kgc-computing-flow/v1";

function validateEntityComponents(entity, schemas) {
  for (const componentName of Object.keys(entity.components).sort()) {
    const fieldSpec = schemas.get(componentName);
    const ref = `entity ${entity.entityRef} component ${componentName}`;
    if (!fieldSpec) {
      throw new KgcNodeContractError(
        "ECS_KGC_UNKNOWN_COMPONENT",
        `${ref} has no EcsComponentSchema`,
        ref,
      );
    }
    const values = entity.components[componentName];
    if (typeof values !== "object" || values === null || Array.isArray(values)) {
      throw new KgcNodeContractError(
        "ECS_KGC_INVALID_ENTITY",
        `${ref} values must be an object`,
        ref,
      );
    }
    const expectedFields = Object.keys(fieldSpec).sort();
    const actualFields = Object.keys(values).sort();
    if (
      expectedFields.length !== actualFields.length ||
      expectedFields.some((fieldName, index) => fieldName !== actualFields[index])
    ) {
      throw new KgcNodeContractError(
        "ECS_KGC_COMPONENT_FIELDS_MISMATCH",
        `${ref} must contain exactly ${expectedFields.join(", ")}`,
        ref,
      );
    }
    for (const fieldName of expectedFields) {
      assertRepresentableComponentValue(
        fieldSpec[fieldName],
        values[fieldName],
        `${ref}.${fieldName}`,
      );
    }
  }
}

function collectHydrationState(nodes) {
  const schemas = new Map();
  const entities = new Map();
  const decisions = new Map();

  nodes.forEach((node, nodeIndex) => {
    if (node?.type === ECS_COMPONENT_SCHEMA_NODE_TYPE) {
      const schema = normalizeComponentSchemaNode(node, nodeIndex);
      if (schemas.has(schema.name)) {
        throw new KgcNodeContractError(
          "ECS_KGC_DUPLICATE_COMPONENT_SCHEMA",
          `duplicate EcsComponentSchema ${schema.name}`,
          schema.name,
        );
      }
      schemas.set(schema.name, schema.fields);
      return;
    }
    if (node?.type === ECS_ENTITY_NODE_TYPE) {
      const entity = normalizeEntityNode(node, nodeIndex);
      if (entities.has(entity.entityRef)) {
        throw new KgcNodeContractError(
          "ECS_KGC_DUPLICATE_ENTITY",
          `duplicate EcsEntity ${entity.entityRef}`,
          entity.entityRef,
        );
      }
      entities.set(entity.entityRef, entity);
      return;
    }
    if (node?.type === ECS_DECISION_NODE_TYPE) {
      const decision = normalizeDecisionNode(node, nodeIndex);
      const existing = decisions.get(decision.decisionId);
      if (existing) {
        throw new KgcNodeContractError(
          "ECS_KGC_DUPLICATE_DECISION",
          `duplicate EcsDecision ${decision.decisionId}`,
          decision.decisionId,
        );
      }
      decisions.set(decision.decisionId, decision);
    }
  });

  if (schemas.size === 0) {
    throw new KgcNodeContractError(
      "ECS_KGC_COMPONENT_SCHEMAS_REQUIRED",
      "Hydration requires at least one EcsComponentSchema",
      "EcsComponentSchema",
    );
  }
  if (entities.size === 0) {
    throw new KgcNodeContractError(
      "ECS_KGC_ENTITIES_REQUIRED",
      "Hydration requires at least one EcsEntity",
      "EcsEntity",
    );
  }
  for (const entity of entities.values()) validateEntityComponents(entity, schemas);
  return { decisions, entities, schemas };
}

function hydrationFailure(error) {
  return {
    ok: false,
    errorCode: error?.code ?? "ECS_HYDRATION_FAILED",
    message: error instanceof Error ? error.message : String(error),
    unreadableRef: error?.ref ?? "document",
  };
}

export function hydrateKgcDocument(input, options = {}) {
  try {
    const { nodes, schema } = readKgcNodeState(input);
    if (schema !== null && schema !== KGC_COMPUTING_FLOW_SCHEMA) {
      throw new KgcNodeContractError(
        "ECS_KGC_SCHEMA_MISMATCH",
        `expected ${KGC_COMPUTING_FLOW_SCHEMA}, received ${String(schema)}`,
        "schema",
      );
    }
    const state = collectHydrationState(nodes);
    const world = createWorld({
      systems: options.systems ?? [],
      decisionExecutor: options.decisionExecutor,
      clock: options.clock,
    });
    for (const [name, fields] of [...state.schemas].sort(([left], [right]) =>
      compareCanonicalStrings(left, right),
    )) {
      registerComponent(world, name, fields);
    }
    for (const entity of [...state.entities.values()].sort((left, right) =>
      compareCanonicalStrings(left.entityRef, right.entityRef),
    )) {
      allocateEntity(world, entity);
    }
    const decisionIndex = new Map(
      [...state.decisions].sort(([left], [right]) => compareCanonicalStrings(left, right)),
    );
    return { ok: true, world, decisionIndex };
  } catch (error) {
    return hydrationFailure(error);
  }
}

export const hydrate = hydrateKgcDocument;
