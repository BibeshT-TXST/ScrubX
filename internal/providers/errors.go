package providers

import "errors"

// These are sentinel errors. The future failover chain needs to
// distinguish " this provider is down, try the next one" from
// "this request itself was bad, don't bother retrying it anywhere"
// Researched about erros.Is/error.As and %w wrapping in fmt.Errorf
// will be used to erap with request-specific context in the future,
// without loosing the ability to check the underlying sentinel.
var (
	// ErrProviderUnavailabe means the backend couldn't be reached or
	// returned a 5xx eroor and the request is safe to be retried with
	// another provider.
	ErrProviderUnavailabe = errors.New("provider unavailable")

	// ErrRequestInvalid means the request itself was malformed (empty prompt,
	// negative max_tokens) - retrying against another provider will not help
	ErrRequestInvalid = errors.New("invalid request")
)
