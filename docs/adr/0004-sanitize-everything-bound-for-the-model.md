# 0004 · Sanitize everything bound for the model, not just the message

**Status:** accepted

**Context.** Patient records and client-held history are untrusted. A record can carry an instruction (pt-005), and history comes from the browser. Blocking the clinician because a record is poisoned would be wrong.

**Decision.** Retrieval treats the role-filtered record and each history turn like the message: normalize, replace any sentence that trips a high or critical injection rule or the flag threshold with `[removed: embedded instruction]`, detect PHI, and tokenize with the request's vault. A quarantine also turns on strict output analysis. Blocked exchanges are left out of the history the client sends.

**Consequences.** Indirect injection never reaches the model, and the request still gets answered. A sentence mixing clinical facts with an instruction loses its clinical facts too. The quarantine count is audited and shown in both views.
