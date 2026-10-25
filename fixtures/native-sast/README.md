# Native SAST fixture

This fixture contains an intentional command-injection defect.

Do not run the server. GitHub CodeQL analyzes the source and writes SARIF. The
native SAST workflow then normalizes the SARIF with Rivet and checks for the
CodeQL command-injection rule.

The defect is test data. Do not copy this code into a service.
