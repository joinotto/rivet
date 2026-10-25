function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

export function statefulTemplate(system, revision, createdAt) {
  return {
    schema: 1,
    kind: "stateful-test-model",
    system: system || "",
    revision: revision || "",
    created_at: createdAt,
    model: {
      initial_state: "",
      states: [],
      commands: [],
      invariants: [],
    },
    execution: {
      runner: "",
      runs: 0,
      max_commands: 0,
      records_seed: false,
      shrinking: false,
      reset: "",
      isolation: "",
    },
    review: {
      owner: "",
      evidence: [],
    },
  };
}

export function validateStatefulModel(document) {
  const faults = [];
  const warnings = [];
  if (document?.schema !== 1 || document?.kind !== "stateful-test-model") {
    faults.push("The file must use Rivet stateful-test-model schema 1.");
  }
  for (const field of ["system", "revision", "created_at"]) {
    if (!text(document?.[field])) faults.push(`The model requires ${field}.`);
  }

  const states = list(document?.model?.states);
  const stateIds = new Set();
  for (const state of states) {
    if (!text(state?.id)) {
      faults.push("Each state requires an id.");
      continue;
    }
    if (stateIds.has(state.id)) faults.push(`Duplicate state id: ${state.id}.`);
    stateIds.add(state.id);
    if (!text(state?.description)) {
      faults.push(`State ${state.id} requires a description.`);
    }
  }
  if (!states.length) faults.push("The model requires at least one state.");

  const initialState = document?.model?.initial_state;
  if (!text(initialState)) {
    faults.push("The model requires initial_state.");
  } else if (!stateIds.has(initialState)) {
    faults.push(`The initial state is not declared: ${initialState}.`);
  }

  const commands = list(document?.model?.commands);
  const commandIds = new Set();
  const reachable = new Set(text(initialState) ? [initialState] : []);
  for (const command of commands) {
    const label = command?.id || "record";
    if (!text(command?.id)) {
      faults.push("Each command requires an id.");
    } else if (commandIds.has(command.id)) {
      faults.push(`Duplicate command id: ${command.id}.`);
    } else {
      commandIds.add(command.id);
    }
    for (const field of [
      "description",
      "generator",
      "precondition",
      "action",
      "postcondition",
    ]) {
      if (!text(command?.[field])) {
        faults.push(`Command ${label} requires ${field}.`);
      }
    }
    const from = list(command?.from);
    const to = list(command?.to);
    if (!from.length) faults.push(`Command ${label} requires from states.`);
    if (!to.length) faults.push(`Command ${label} requires to states.`);
    for (const state of [...from, ...to]) {
      if (!stateIds.has(state)) {
        faults.push(`Command ${label} references unknown state: ${state}.`);
      }
    }
  }
  if (!commands.length) faults.push("The model requires at least one command.");

  let changed = true;
  while (changed) {
    changed = false;
    for (const command of commands) {
      if (list(command?.from).some((state) => reachable.has(state))) {
        for (const state of list(command?.to)) {
          if (stateIds.has(state) && !reachable.has(state)) {
            reachable.add(state);
            changed = true;
          }
        }
      }
    }
  }
  const unreachableStates = [...stateIds].filter((state) => !reachable.has(state));
  for (const state of unreachableStates) {
    warnings.push(`No declared command path reaches state ${state}.`);
  }

  const invariants = list(document?.model?.invariants);
  const invariantIds = new Set();
  for (const invariant of invariants) {
    const label = invariant?.id || "record";
    if (!text(invariant?.id)) {
      faults.push("Each invariant requires an id.");
    } else if (invariantIds.has(invariant.id)) {
      faults.push(`Duplicate invariant id: ${invariant.id}.`);
    } else {
      invariantIds.add(invariant.id);
    }
    for (const field of ["description", "oracle"]) {
      if (!text(invariant?.[field])) {
        faults.push(`Invariant ${label} requires ${field}.`);
      }
    }
  }
  if (!invariants.length) faults.push("The model requires at least one invariant.");

  const execution = document?.execution || {};
  for (const field of ["runner", "reset", "isolation"]) {
    if (!text(execution[field])) faults.push(`Execution requires ${field}.`);
  }
  for (const field of ["runs", "max_commands"]) {
    if (!Number.isInteger(execution[field]) || execution[field] < 1) {
      faults.push(`Execution ${field} must be a positive integer.`);
    }
  }
  if (execution.records_seed !== true) {
    faults.push("Execution must record the random seed.");
  }
  if (execution.shrinking !== true) {
    warnings.push("The runner does not declare failing-sequence shrinking.");
  }
  if (!text(document?.review?.owner)) {
    warnings.push("The model has no review owner.");
  }

  return {
    schema: 1,
    kind: "stateful-test-model-validation",
    evidence_class: "derived",
    faults,
    warnings,
    counts: {
      states: states.length,
      commands: commands.length,
      invariants: invariants.length,
      reachable_states: reachable.size,
    },
    unreachable_states: unreachableStates,
    decision: faults.length ? "incomplete" : "ready-for-execution",
    limitations: [
      "Model validation does not execute the system or prove that the model matches it.",
      "Generated input quality and the test oracle determine which defects the runner can find.",
      "Keep the seed and the smallest failing command sequence for reproducibility.",
    ],
  };
}
