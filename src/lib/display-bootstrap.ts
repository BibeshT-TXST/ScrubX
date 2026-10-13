// No React here: the root layout (a server component) inlines this before first
// paint, so a dark-theme viewer never sees a white flash. Mirrors applyDisplay().

export const DISPLAY_KEY = "scrubx-display";

export const DISPLAY_BOOTSTRAP = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(DISPLAY_KEY)})||"{}");var t=p.theme||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";if(p.density==="compact")r.dataset.density="compact";}catch(e){}})();`;
