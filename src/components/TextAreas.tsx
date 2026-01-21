interface TextAreasProps {
  originalText: string;
  modifiedText: string;
  onOriginalChange: (value: string) => void;
  onModifiedChange: (value: string) => void;
}

function TextAreas({
  originalText,
  modifiedText,
  onOriginalChange,
  onModifiedChange,
}: TextAreasProps) {
  return (
    <main className="workspace">
      <div className="editor-pane">
        <div className="pane-header">
          <h2>Original</h2>
          <div className="pane-tools">
            <span className="badge">Read Only</span>
          </div>
        </div>
        <div className="textarea-wrapper">
          <textarea
            id="original"
            placeholder="Paste the original version of the text here..."
            value={originalText}
            onChange={(e) => onOriginalChange(e.target.value)}
          ></textarea>
        </div>
      </div>

      <div className="editor-pane">
        <div className="pane-header">
          <h2>Modified</h2>
          <div className="pane-tools">
            <span className="badge">Editable</span>
          </div>
        </div>
        <div className="textarea-wrapper">
          <textarea
            id="modified"
            placeholder="Paste the modified version of the text here..."
            value={modifiedText}
            onChange={(e) => onModifiedChange(e.target.value)}
          ></textarea>
        </div>
      </div>
    </main>
  );
}

export default TextAreas;
