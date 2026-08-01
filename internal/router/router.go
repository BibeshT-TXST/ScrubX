package router

import {
	"fmt"

	"llm-gateway/internal/providers"
}

// Router holds every registered provider and knows how to pick one
// by name. Intitially this component will be dumb and wont have any failover
// circuit breaker or a cost/latency based routing
type Router struct {
	providers map[string]providers.Provider
	// default name is whoch provider Route() picks when the
	// caller doesnt ask for a specific string.
	defaultName string
}

// New builds a router from a list of providers. The first provider in 
// the list becomes the default. The list must not me empty or have duplicate 
// names [ NOT WORKING ON THIS ISSUE RIGHT NOW]
// ...providers.Provider -> [variadic parameter]
// ... basically means pass as many parameters you want separtaed by a comma
// provs acts like an array that strores all the parameters and is used 
// within the function as a common identifier to access all the parameter values
func New(provs ...providers.Provider) *Router {
	if len(provs) == 0{
		panic("router: at least one provider is required")
	}

	m := make(map[string]providers.Provider, len(provs))
	for _, p := range provs {
		name := p.Name()
		// if [initialization statement]; [condition] {...}
		// _ discards actual map value
		// Gos map look up returns two value at once
		//  value  ,  exists  :=  m[name]
     	//	│          │
     	//	│          └─► Gets 2nd output: bool (true/false){ usually uzed for conditions}
     	//	└────────────► Gets 1st output: actual data/ value
		if _, exists := m[name]; exists {
			panic(fmt.Sprintf("router: duplicate provider name %q", name))
		}
		m[name] = p
	}

	return &Router{
		providers: 		m,
		defaultName:	provs[0].Name(),
	}
}

// Route returns the provider registered under name 
// passing an empty string returns the default provider
func ( r *Router ) Route(name string) (providers.Provider, error){
	if name == "" {
		name = r.defaultName
	}

	p, ok := r.providers[name]
	if !ok {
		return nil, fmt.Errorf("router: no provider registerd under name %q", name)
	}

	return p, nil
}

//Names returns every rigeisterd provider name, mainlu useful for a healthcheck endpoint
func (r *Router) Names() []string {
	names := make([]string, 0, len(r.providers))
	for name: = range r.providers {
		names = append(names, name)
	}
	return names
}