// Public surface of the framework-free core. The host project imports from here.
export * from "./types";
export * from "./schemas";
export * from "./config";
export * from "./pipeline/events";
export * from "./pipeline/Stage";
export * from "./pipeline/TraceRecorder";
export * from "./pipeline/steps";
export * from "./pipeline/Pipeline";
export * from "./data/PatientRepository";
export * from "./data/DemoPatientRepository";
export * from "./providers/LLMProvider";
export * from "./providers/MockProvider";
export * from "./injection/scanner";
export { FIELD_POLICY, RESTRICTED_FIELDS, fieldsForRole } from "./stages/Retrieval";
