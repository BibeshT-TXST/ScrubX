import Link from "next/link";
import type { ChatMessage } from "@/lib/chat-store";
import { cn } from "@/lib/utils";
import { DecisionBadge } from "./DecisionBadge";
import { StepProgress } from "./StepProgress";

export function Message({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-foreground px-4 py-2.5 text-sm text-background">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "w-full max-w-[75%] space-y-3 rounded-2xl rounded-bl-sm border bg-card px-4 py-3 text-sm",
          message.status === "error" && "border-red-200 bg-red-50 text-red-700",
        )}
      >
        {message.status === "streaming" && message.step ? (
          <StepProgress step={message.step} />
        ) : (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        )}

        {message.status === "done" && message.decision && (
          <div className="flex items-center gap-2 border-t pt-2.5">
            <DecisionBadge decision={message.decision} />
            {!!message.quarantined && (
              <span className="font-mono text-[11px] text-muted-foreground">
                {message.quarantined} instruction{message.quarantined === 1 ? "" : "s"} removed from record
              </span>
            )}
            {message.requestId && (
              <Link
                href={`/dev?request=${message.requestId}`}
                className="ml-auto font-mono text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                View trace →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
