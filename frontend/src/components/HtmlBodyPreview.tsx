export function HtmlBodyPreview({ html }: { html: string }) {
  return (
    <iframe
      className="html-body-preview"
      title="HTML preview"
      sandbox=""
      srcDoc={html}
      referrerPolicy="no-referrer"
    />
  );
}
