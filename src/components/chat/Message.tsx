import { WifiOff } from "lucide-react";
import Link from "next/link";
import type { ChatMessage } from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import { OutcomeBadge } from "./DecisionBadge";
import { StepProgress } from "./StepProgress";

function ConnectionFlag({ detail }: { detail: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2 text-sm text-zinc-800">
      <WifiOff className="mt-0.5 size-4 shrink-0" />
      <div>
        <p className="font-medium">We couldn&apos;t connect to the model.</p>
        <p className="text-xs text-zinc-600">{detail}</p>
      </div>
    </div>
  );
}

export function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-foreground px-4 py-2.5 text-sm text-background">
          {message.content}
        </p>
      </div>
    );
  }

  const unreachable = message.outcome === "unavailable";
  return (
    <div className="flex justify-start">
      <div className={cn("w-full max-w-[92%] space-y-3 rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm")}>
        {message.status === "streaming" && message.step ? (
          <StepProgress step={message.step} startedAt={message.startedAt} />
        ) : message.status === "error" ? (
          // The request never completed (network or server failure): same flag as an unreachable model.
          <ConnectionFlag detail="The request didn't complete. Please try again in a moment." />
        ) : unreachable ? (
          <ConnectionFlag detail="Your message passed every check, but no answer came back. Please try again in a moment." />
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        )}

        {message.status === "done" && (
          <div className="flex items-center gap-2 border-t pt-2.5">
            <OutcomeBadge outcome={message.outcome} decision={message.decision} />
            {!!message.quarantined && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {message.quarantined} instruction{message.quarantined === 1 ? "" : "s"} removed from record
              </span>
            )}
            {message.requestId && (
              <Link
                href={`/security?request=${message.requestId}`}
                className="ml-auto font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                View in Security Division →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
