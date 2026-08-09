import './TextAreas.css';

interface TextAreasProps {
  originalText: string;
  modifiedText: string;
  onOriginalChange: (value: string) => void;
  onModifiedChange: (value: string) => void;
}

function TextAreas({ originalText, modifiedText, onOriginalChange, onModifiedChange }: TextAreasProps) {
  return (
    <main className="text-areas">
      <div className="text-areas__pane">
        <div className="text-areas__pane-header">
          <h2>Original</h2>
        </div>
        <div className="text-areas__textarea-wrapper">
          <textarea
            className="text-areas__textarea"
            id="original"
            placeholder="Paste the original version of the text here..."
            value={originalText}
            onChange={(e) => onOriginalChange(e.target.value)}
          ></textarea>
        </div>
      </div>

      <div className="text-areas__pane">
        <div className="text-areas__pane-header">
          <h2>Modified</h2>
        </div>
        <div className="text-areas__textarea-wrapper">
          <textarea
            className="text-areas__textarea"
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
