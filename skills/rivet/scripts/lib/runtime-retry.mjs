import fs from "fs";

function attributeValue(value) {
  if (!value || typeof value !== "object") return value;
  for (const key of ["stringValue", "intValue", "doubleValue", "boolValue"]) {
    if (Object.hasOwn(value, key)) {
      return key === "intValue" ? Number(value[key]) : value[key];
    }
  }
  return value;
}

function attributes(span) {
  if (!Array.isArray(span.attributes)) return span.attributes || {};
  return Object.fromEntries(
    span.attributes
      .filter((item) => item?.key)
      .map((item) => [item.key, attributeValue(item.value)]),
  );
}

function flatten(document) {
  if (Array.isArray(document.spans)) return document.spans;
  return (document.resourceSpans || []).flatMap((resource) =>
    (resource.scopeSpans || resource.instrumentationLibrarySpans || []).flatMap(
      (scope) => scope.spans || [],
    ),
  );
}

function isClient(span) {
  return span.kind === 3 || span.kind === "SPAN_KIND_CLIENT" || span.kind === "CLIENT";
}

function operationKey(span, attrs) {
  return [
    span.name || "",
    attrs["http.request.method"] || attrs["http.method"] || "",
    attrs["rpc.system.name"] || attrs["rpc.system"] || "",
    attrs["rpc.method"] || "",
    attrs["server.address"] || attrs["net.peer.name"] || "",
    attrs["server.port"] || attrs["net.peer.port"] || "",
  ].join("|");
}

function spanError(span, attrs) {
  const code = span.status?.code;
  return (
    code === 2 ||
    code === "STATUS_CODE_ERROR" ||
    Boolean(attrs["error.type"]) ||
    Number(attrs["http.response.status_code"] || attrs["http.status_code"]) >= 500
  );
}

export function analyzeRuntimeRetries(file) {
  const document = JSON.parse(fs.readFileSync(file, "utf8"));
  const spans = flatten(document).map((span) => ({
    ...span,
    normalized_attributes: attributes(span),
  }));
  const clients = spans.filter(isClient);
  const byId = new Map(spans.map((span) => [span.spanId, span]));
  const groups = new Map();
  for (const span of clients) {
    const key = [
      span.traceId || "",
      span.parentSpanId || "",
      operationKey(span, span.normalized_attributes),
    ].join("::");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(span);
  }

  const explicitResends = [];
  for (const span of clients) {
    const count = Number(span.normalized_attributes["http.request.resend_count"]);
    if (Number.isInteger(count) && count > 0) {
      explicitResends.push({
        trace_id: span.traceId || null,
        span_id: span.spanId || null,
        operation: span.name || null,
        resend_count: count,
        request_attempts: count + 1,
      });
    }
  }

  const repeatedGroups = [...groups.values()]
    .filter((group) => group.length > 1)
    .map((group) => ({
      trace_id: group[0].traceId || null,
      parent_span_id: group[0].parentSpanId || null,
      operation: group[0].name || null,
      operation_key: operationKey(group[0], group[0].normalized_attributes),
      observed_spans: group.length,
      error_spans: group.filter((span) =>
        spanError(span, span.normalized_attributes),
      ).length,
      span_ids: group.map((span) => span.spanId || null),
      classification: "possible-retry-redirect-or-duplicate",
    }));

  const repeatedSpanIds = new Set(
    repeatedGroups.flatMap((group) => group.span_ids),
  );
  const amplification = repeatedGroups
    .filter((group) => repeatedSpanIds.has(group.parent_span_id))
    .map((group) => {
      const parent = byId.get(group.parent_span_id);
      return {
        trace_id: group.trace_id,
        outer_span_id: group.parent_span_id,
        outer_operation: parent?.name || null,
        inner_operation: group.operation,
        inner_observed_spans: group.observed_spans,
        classification: "nested-repeated-client-operations",
      };
    });

  const findings = [
    ...explicitResends.map((item) => ({
      id: "http-resend-observed",
      severity: "note",
      evidence: item,
      statement:
        "The HTTP client span records one or more resends. The cause can be a retry, redirect, authorization response, or network failure.",
    })),
    ...repeatedGroups.map((item) => ({
      id: "repeated-client-operation",
      severity: "note",
      evidence: item,
      statement:
        "Sibling client spans have the same operation identity. Confirm whether they are retries, redirects, fan-out, or duplicate calls.",
    })),
    ...amplification.map((item) => ({
      id: "runtime-retry-amplification",
      severity: "warning",
      evidence: item,
      statement:
        "Repeated client operations contain another repeated client operation. Confirm retry ownership and the maximum attempt product.",
    })),
  ];

  return {
    schema: 1,
    kind: "runtime-retry-analysis",
    evidence_class: "derived",
    trace_format: Array.isArray(document.spans) ? "rivet-span-json" : "otlp-json",
    spans_inspected: spans.length,
    client_spans: clients.length,
    explicit_http_resends: explicitResends,
    repeated_client_groups: repeatedGroups,
    nested_repetition: amplification,
    findings,
    decision: amplification.length
      ? "review-findings"
      : clients.length
        ? "observed"
        : "insufficient-evidence",
    limitations: [
      "HTTP resend count includes retries, redirects, authorization responses, and other resend causes.",
      "Repeated sibling client spans can represent retries, redirects, fan-out, or duplicate instrumentation.",
      "Sampling, missing propagation, and span loss can hide attempts and parent-child relationships.",
      "Runtime trace evidence describes only the captured requests and cannot prove retry limits.",
    ],
  };
}
