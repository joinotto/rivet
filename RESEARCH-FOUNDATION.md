# Research Foundation

## 1. Research method

This proposal uses primary material from engineers, researchers, standards bodies, and open-source foundations.

It does not use AI-generated skill collections as design authority.

The research has five source groups:

1. Software design and specification.
2. Testing and verification.
3. Security engineering.
4. Reliability and operations.
5. Open-source and supply-chain governance.

## 2. Lessons from software design

### 2.1 David Parnas: hide design decisions

David Parnas showed that a system must not be divided only by processing steps. A module must hide a design decision that can change. This method improves changeability and comprehension.

Product consequence:

- The system must inspect boundaries and information hiding.
- It must not recommend microservices only because the repository is large.
- It must identify decisions that leak through many modules.
- It must review the stability of interfaces before it reviews code style.

Source: [On the Criteria To Be Used in Decomposing Systems into Modules](https://kilthub.cmu.edu/articles/journal_contribution/On_the_criteria_to_be_used_in_decomposing_systems_into_modules/6607958)

### 2.2 Butler Lampson: use simple interfaces and plan for failure

Butler Lampson collected practical system-design guidance from real systems. Important themes include simple interfaces, end-to-end behavior, caching, hints, fault handling, and the difference between common and uncommon cases.

Product consequence:

- The design review must examine interfaces, failure cases, state, and recovery.
- Performance recommendations must include workload evidence.
- A local optimization must not damage end-to-end correctness.

Source: [Hints for Computer System Design](https://www.microsoft.com/en-us/research/publication/hints-for-computer-system-design/)

### 2.3 Leslie Lamport: write a specification before subtle code

Leslie Lamport argues that a specification is a blueprint. The required rigor depends on the system. A short method can use a short informal specification. A concurrent or critical system can need a formal model.

Product consequence:

- The system must support a spectrum of specifications.
- It must require invariants for stateful and concurrent changes.
- It must support state-machine and TLA+ workflows for high-risk logic.
- It must not require a formal model for a simple CRUD change.

Sources:

- [Thinking for Programmers](https://www.microsoft.com/en-us/research/video/thinking-for-programmers-rising-above-the-code/)
- [Thinking for Programmers paper](https://lamport.azurewebsites.net/pubs/wired.pdf)

### 2.4 John Ousterhout: reduce dependencies and obscurity

John Ousterhout defines complexity by the difficulty that a developer experiences during a change. Dependencies and obscurity are important causes. Deep modules hide significant capability behind a simple interface.

Product consequence:

- The system must review change amplification.
- It must detect shallow wrappers and pass-through APIs.
- It must prefer a small, stable interface over many configuration points.
- It must measure complexity from the change task, not only from code size.

Source: [A Philosophy of Software Design](https://web.stanford.edu/~ouster/cgi-bin/aposd.php)

### 2.5 Andrej Karpathy: agents require supervision and verifiable work

Andrej Karpathy describes a transition from direct code production to agent direction and supervision. His public educational work also uses small implementations that expose the complete mechanism.

Product consequence:

- The agent must work in small, inspectable increments.
- The product must make intermediate state visible.
- A human must be able to change direction.
- The system must prefer a small complete proof over a large opaque claim.
- The product must treat an LLM as a fallible operator, not as an oracle.

Sources:

- [Andrej Karpathy](https://karpathy.ai/)
- [Neural Networks: Zero to Hero](https://karpathy.ai/zero-to-hero.html)

Karpathy is an influence for the agent workflow. He is not the source for the security standard or the backend architecture standard.

## 3. Lessons from testing

### 3.1 Kent Beck: use short feedback cycles

Test-driven development uses a short cycle:

1. Write a failing test.
2. Make the test pass with the minimum change.
3. Improve the structure while the tests pass.

Product consequence:

- The change workflow must support a red, green, refactor loop.
- It must separate behavior changes from structural changes.
- Tests must describe observable behavior.
- The system must not require test-first work for all maintenance tasks.

Source: [Kent Beck public TDD project instructions](https://github.com/KentBeck/BPlusTree3/blob/main/rust/docs/CLAUDE.md)

### 3.2 Martin Fowler: use tests at different scopes

The test pyramid is a heuristic. It recommends more fast, focused tests and fewer broad tests. It is not a fixed quota. Test definitions and system economics can change the correct shape.

Product consequence:

- The system must create a risk-based test portfolio.
- It must not enforce a percentage of unit, integration, and end-to-end tests.
- It must record speed, fidelity, determinism, and defect value for each test layer.

Sources:

- [Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html)
- [The Practical Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

### 3.3 James Bach and Michael Bolton: testing is investigation

Exploratory testing combines learning, test design, and execution. Scripts cannot identify all mismatches between the product and its purpose.

Product consequence:

- The system must include charters for human or agent exploration.
- It must record observations and new questions.
- Generated tests must not replace investigation.
- A test report must identify coverage limits.

Source: [Exploratory Testing 3.0](https://www.satisfice.com/blog/archives/1509)

### 3.4 Google testing practice: test behavior

Tests that follow internal method structure are fragile. Tests must focus on behavior and use isolated setup where practical.

Product consequence:

- The test reviewer must detect implementation-coupled tests.
- It must detect tests that cannot fail for the intended defect.
- It must run mutation or fault-seeding checks for important test suites.

Source: [Test Behaviors, Not Methods](https://testing.googleblog.com/2014/04/testing-on-toilet-test-behaviors-not.html)

## 4. Lessons from security engineering

### 4.1 NIST SSDF: integrate security into the life cycle

NIST SP 800-218 defines the Secure Software Development Framework. The four practice groups are:

- Prepare the organization.
- Protect the software.
- Produce well-secured software.
- Respond to vulnerabilities.

Product consequence:

- Security cannot be one final scan.
- The product must connect design, implementation, build, release, and response.
- Each recommendation must map to a recognized control when possible.

Source: [NIST Secure Software Development Framework](https://csrc.nist.gov/projects/ssdf)

### 4.2 CISA: the producer owns customer security outcomes

CISA Secure by Design asks software producers to make security a product requirement. Secure defaults must not transfer unreasonable work to the customer.

Product consequence:

- The review must identify insecure default settings.
- It must identify controls that depend on customer action.
- It must include abuse cases and recovery behavior.
- The roadmap must publish measurable secure-by-design commitments.

Source: [CISA Secure by Design](https://www.cisa.gov/resources-tools/resources/secure-by-design)

### 4.3 OWASP ASVS: use testable application controls

OWASP ASVS gives testable requirements for web application security. Version 5.0.0 is the current stable release at the research date.

Product consequence:

- Web application security checks must map to ASVS controls.
- The product must support an applicable verification level.
- It must not claim ASVS compliance from a source scan only.

Source: [OWASP ASVS](https://owasp.org/projects/asvs)

### 4.4 OWASP threat modeling: model, identify, respond, validate

OWASP describes four common threat-modeling activities:

1. Decompose the application.
2. Identify and rank threats.
3. Define mitigations.
4. Review and validate.

Product consequence:

- The threat model must start with assets, trust boundaries, identities, data flows, and entry points.
- STRIDE can be one prompt method. It must not be the only method.
- The result must connect a threat to a concrete control and verification step.

Source: [OWASP Threat Modeling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html)

### 4.5 Vulnerability priority must use real exploitation evidence

CVSS describes technical severity. It does not describe the complete remediation priority.

The product must combine:

- CISA Known Exploited Vulnerabilities status.
- FIRST EPSS exploitation probability.
- Runtime reachability.
- Internet exposure.
- Asset and data criticality.
- Available mitigation.
- Fix risk.

Sources:

- [CISA Known Exploited Vulnerabilities Catalog](https://www.cisa.gov/known-exploited-vulnerabilities-catalog)
- [FIRST Exploit Prediction Scoring System](https://www.first.org/epss/why-epss)

### 4.6 Supply-chain security needs provenance

SLSA defines incremental guarantees for build integrity and provenance. OpenSSF provides project-security checks and baseline practices. OWASP SCVS defines incremental component controls.

Product consequence:

- The system must create and verify an SBOM.
- It must record artifact provenance.
- It must verify signatures and release identity.
- It must review dependency governance, not only known CVEs.

Sources:

- [SLSA specification](https://slsa.dev/spec/)
- [OpenSSF projects](https://openssf.org/projects/)
- [OWASP SCVS](https://owasp.org/www-project-software-component-verification-standard/)

## 5. Lessons from reliability engineering

### 5.1 Google SRE: use service objectives and error budgets

Reliability must connect to user value. An implicit 100 percent objective creates reactive work and prevents rational trade-offs.

Product consequence:

- The system must define service-level indicators and objectives.
- It must use percentiles for latency where the distribution matters.
- It must connect release policy to the error budget.
- It must avoid an automatic “five nines” recommendation.

Sources:

- [Google SRE service-level objectives](https://sre.google/sre-book/service-level-objectives/)
- [Google SRE Workbook](https://sre.google/workbook/index/)

### 5.2 Amazon: retries are load

Retries can improve success for transient failures. They can also amplify an overload. Timeouts, bounded retries, backoff, and jitter must work together.

Product consequence:

- The resilience review must trace timeout budgets through the call chain.
- It must identify retry multiplication.
- It must require idempotency before it recommends a retry.
- It must test overload and recovery.

Source: [Timeouts, retries, and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)

### 5.3 Distributed systems need duplicate and partial-failure handling

Clients can retry when the server completed work but the response was lost. An idempotent receiver uses a request identity to return the saved result.

Product consequence:

- The system must examine duplicate delivery.
- It must examine at-least-once jobs and messages.
- It must examine transaction and side-effect boundaries.
- It must recommend expand-and-contract changes for incompatible interfaces.

Sources:

- [Idempotent Receiver](https://martinfowler.com/articles/patterns-of-distributed-systems/idempotent-receiver.html)
- [Parallel Change](https://martinfowler.com/bliki/ParallelChange.html)
- [Circuit Breaker](https://martinfowler.com/bliki/CircuitBreaker.html)

### 5.4 Observability must answer new questions

OpenTelemetry defines independent signals such as traces and metrics, with common context propagation. Observability must help operators investigate unknown problems.

Product consequence:

- Instrumentation must use stable semantic conventions.
- Logs, metrics, and traces must share request and operation context.
- The product must review cardinality, cost, personal data, and sampling.
- It must verify that alerts identify user harm and give an operator an action.

Sources:

- [OpenTelemetry specification overview](https://opentelemetry.io/docs/specs/otel/overview/)
- [OpenTelemetry observability primer](https://opentelemetry.io/docs/concepts/observability-primer/)

## 6. Product principles from the research

1. Specify before high-risk implementation.
2. Hide changeable decisions behind stable boundaries.
3. Use tests of different scope for different risks.
4. Test behavior, not only implementation.
5. Treat security as a life-cycle property.
6. Use evidence of real exploitation to prioritize vulnerabilities.
7. Design for partial failure and duplicate work.
8. Define reliability from user outcomes.
9. Make agent work small, visible, and reversible.
10. Report uncertainty.

## 7. What the research does not justify

The research does not justify these claims:

- One architecture is correct for all backends.
- Microservices are more mature than a modular monolith.
- Test-driven development is mandatory for every change.
- A clean scanner result proves that software is secure.
- High test coverage proves that tests are effective.
- A high CVSS score is always the first remediation task.
- Formal methods are necessary for all code.
- An agent can replace an experienced tester, security engineer, or operator.

