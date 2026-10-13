"use client";

import { Check, Copy, ScanSearch, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { Notice, OutcomeBadge } from "@/components/clinical/status";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/chat-store";
import { formatStamp } from "@/lib/clinical-format";
import { StepProgress } from "./StepProgress";

function CopyAnswer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
      }
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : "Copy answer"}
    </Button>
  );
}

function Stamp({ at, now }: { at?: number; now: number }) {
  return at ? <span className="numeric text-meta text-muted-foreground">{formatStamp(at, now)}</span> : null;
}

const enter = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 } };

export function Message({ message, now }: { message: ChatMessage; now: number }) {
  if (message.role === "user") {
    return (
      <motion.article {...enter} aria-label="Your message" className="ml-auto flex max-w-[min(72ch,88%)] flex-col items-end gap-1">
        <header className="flex items-baseline gap-2">
          <span className="text-meta font-medium">You</span>
          <Stamp at={message.at} now={now} />
        </header>
        <p className="rounded-xl rounded-tr-sm bg-foreground px-4 py-3 text-body whitespace-pre-wrap text-background">{message.content}</p>
      </motion.article>
    );
  }

  const done = message.status === "done";
  const blocked = message.outcome === "blocked" || message.decision === "block";

  let body;
  if (message.status === "streaming" && message.step) {
    body = <StepProgress step={message.step} startedAt={message.startedAt} />;
  } else if (message.status === "error") {
    // The request never completed (network or server failure): same notice as an unreachable model.
    body = <Notice tone="unavailable" title="We couldn't connect.">The request didn&apos;t complete. Please try again in a moment.</Notice>;
  } else if (message.outcome === "unavailable") {
    body = (
      <Notice tone="unavailable" title="We couldn't connect to the AI model.">
        Your message passed every ScrubX check, but no answer came back. Please try again in a moment.
      </Notice>
    );
  } else if (blocked) {
    body = (
      <Notice tone="block" title="Blocked by ScrubX. Nothing was sent to the AI model.">
        {message.content}
      </Notice>
    );
  } else {
    body = (
      <div className="space-y-3">
        {message.decision === "flag" && (
          <Notice tone="flag" title="Flagged for review">
            ScrubX let this request through but found something worth a second look. Check the answer against the record.
          </Notice>
        )}
        <p className="max-w-[72ch] text-body whitespace-pre-wrap">{message.content}</p>
      </div>
    );
  }

  const answered = done && message.outcome === "answered";
  return (
    <motion.article {...enter} aria-label="AI assistant reply" className="flex max-w-[min(80ch,100%)] flex-col gap-1">
      <header className="flex flex-wrap items-baseline gap-x-2">
        <span className="flex items-center gap-1.5 text-meta font-medium">
          <Sparkles className="size-3.5" /> AI assistant
        </span>
        {/* Provenance of AI output: labeled, with the model that actually answered. */}
        {answered && !blocked && (
          <span className="text-meta text-muted-foreground">AI-generated{message.model && ` · ${message.model}`}</span>
        )}
        <Stamp at={message.at} now={now} />
      </header>
      <div className="space-y-3 rounded-xl rounded-tl-sm border bg-card px-4 py-3">
        {body}
        {done && (
          <footer className="flex flex-wrap items-center gap-2 border-t pt-3">
            <OutcomeBadge outcome={message.outcome} decision={message.decision} />
            {!!message.quarantined && (
              <span className="text-meta text-muted-foreground">
                {message.quarantined} instruction{message.quarantined === 1 ? "" : "s"} removed from the record before it reached the AI
              </span>
            )}
            <span className="ml-auto flex items-center gap-1">
              {answered && !blocked && (
                <>
                  <span className="text-meta text-muted-foreground">Not added to the record</span>
                  <CopyAnswer text={message.content} />
                </>
              )}
              {message.requestId && (
                <Link href={`/security?request=${message.requestId}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  <ScanSearch /> View trace
                </Link>
              )}
            </span>
          </footer>
        )}
      </div>
    </motion.article>
  );
}
