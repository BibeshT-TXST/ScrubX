package providers

import (
	"context"
	"fmt"
	"time"
)

// Mock provider satisfies the provider interface without calling any real API.
// this component is build and test the router

type MockProvider struct {
	//Failnext, when true, makes the next complete call return
	//ErrProviderUnavailable instead of a canned response
	FailNext bool
}

// Name() is the method that returns the string
// The difference between a "Function" & "Method"
// was an important discovery while building this
// function
func (m *MockProvider) Name() string {
	return "mock"
}

func (m *MockProvider) Complete(ctx context.Context, req Request) (Response, error) {
	if req.Prompt == "" {
		return Response{}, fmt.Errorf("mock: %w", ErrRequestInvalid)
	}

	if m.FailNext {
		m.FailNext = false
		return Response{}, fmt.Errorf("mock: %w", ErrProviderUnavailabe)
	}

	// Simulating a bit of latency
	start := time.Now()
	select {
	case <-ctx.Done():
		return Response{}, ctx.Err()
	case <-time.After(20 * time.Millisecond):
	}

	return Response{
		Text:      fmt.Sprintf("[mock response to]: %s", req.Prompt),
		Provider:  m.Name(),
		Model:     "mock-echo-1",
		LatencyMS: time.Since(start).Milliseconds(),
		CostUSD:   0.0,
	}, nil

}
