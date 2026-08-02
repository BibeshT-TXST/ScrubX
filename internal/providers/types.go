package providers

import "context"

// Request is the normalized shape every provided recieves.
// Gateway builds once from the incoming HTTP request and
// every provider implementation translates it into whatever wire
// format that vendor expects.
type Request struct {
	Prompt      string `json:"prompt"`
	Model       string `json:"model,omitempty"`
	MaxToken    string `json:"max_tokens,omitempty"`
	Temperature string `json:"temperature,omitempty"`
}

// Response is the normalized shape that every provider returns
type Response struct {
	Text      string  `json:"text"`
	Provider  string  `json:"provider"`
	Model     string  `json:"model"`
	LatencyMS int64   `json:"latency_ms"`
	CostUSD   float64 `json:"cost_usd"`
	FromCache bool    `json:"from_cache"`
}

// Provider is a interface every backend (Gemini, Ollama, a mock
// or a future implementation) must satisfy.
type Provider interface {
	// Name returns a short identifier used in logs, metric labels and
	// the audit log
	Name() string

	// Complete sends a request to the backend and returns a normalized
	// response. It must respect ctx cancellation/timeout
	Complete(ctx context.Context, req Request) (Response, error)
}
