"use client";

import Sheet from "./Sheet";

/**
 * Modal — alias of Sheet that always centers (no bottom-sheet on mobile).
 * Use Sheet for content-led mobile flows, Modal for confirmation dialogs.
 */
export default function Modal(props) {
  return (
    <Sheet
      {...props}
      className={
        "sm:rounded-2xl rounded-2xl !items-center " +
        "max-w-[calc(100vw-32px)] sm:max-w-md " +
        (props.className || "")
      }
    />
  );
}
