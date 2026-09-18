interface Props {
  html: string;
}

export function HtmlBodyPreview({ html }: Props) {
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
