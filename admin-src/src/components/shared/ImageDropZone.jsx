// Zone de dépôt/clic pour changer une photo — porté depuis #edDrop dans
// js/admin.js (openProduct). Le parent décide quoi faire du fichier choisi
// via onFile (redimensionnement canvas, etc. — voir admin-src/src/lib/image.js).
import { useRef, useState } from "react";

export default function ImageDropZone({
  previewSrc,
  previewAlt = "",
  onFile,
  label = "Changer la photo",
  hint = "Cliquez ou déposez une image ici",
}) {
  const inputRef = useRef(null);
  const [isOver, setIsOver] = useState(false);

  function pick() {
    if (!inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.click();
  }

  function handleChange(e) {
    const file = e.target.files && e.target.files[0];
    if (file) onFile(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsOver(false);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <>
      {previewSrc ? <img className="adm-preview" src={previewSrc} alt={previewAlt} /> : null}
      <div
        className={"adm-drop" + (isOver ? " over" : "")}
        role="button"
        tabIndex={0}
        onClick={pick}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          pick();
        }}
        onDragEnter={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsOver(false); }}
        onDrop={handleDrop}
      >
        <svg className="icon" aria-hidden="true"><use href="#i-image"></use></svg>
        <p><strong>{label}</strong><br />{hint}</p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleChange} />
    </>
  );
}
