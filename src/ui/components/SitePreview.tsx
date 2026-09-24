/**
 * The generated site, in a sandboxed iframe.
 *
 * `sandbox` with no tokens at all. The site has no scripts, so
 * allow-scripts is not needed — and it must never be combined with
 * allow-same-origin, which would let a sandboxed script reach the parent
 * origin. With neither, the document is an opaque origin that can render
 * and nothing else: no storage, no navigation, no forms, no scripts.
 *
 * A blob URL rather than srcdoc. DOMPurify does not sanitise srcdoc, and
 * srcdoc has an attribute-length ceiling in some browsers; a blob is a
 * proper document with no ceiling and the same sandbox. The URL is set on
 * the frame from an effect — the frame is the external system being
 * synchronised — and revoked when the markup changes or the component
 * unmounts, so a preview rebuilt on every change does not leak a blob
 * each time.
 */
import { useEffect, useRef } from "react";

export type PreviewWidth = "desktop" | "mobile";

interface Props {
  /** A complete HTML document with its stylesheet inlined. */
  markup: string;
  width: PreviewWidth;
  title: string;
}

export function SitePreview({ markup, width, title }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(new Blob([markup], { type: "text/html" }));
    if (frameRef.current) frameRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [markup]);

  return (
    <div className={`rf-preview rf-preview-${width}`}>
      <iframe
        ref={frameRef}
        className="rf-preview-frame"
        sandbox=""
        title={`Preview of ${title}`}
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
