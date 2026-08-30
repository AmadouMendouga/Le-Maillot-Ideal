"use client";

// Zone de dépôt/clic pour changer une photo — porté depuis
// admin-src/src/components/shared/ImageDropZone.jsx. Le parent décide quoi
// faire du fichier choisi (upload Cloudinary, voir lib/cloudinaryUpload.ts).
import { useRef, useState, type DragEvent } from "react";
import { Icon } from "@/components/icons/Icon";

export interface ImageDropZoneProps {
  previewSrc?: string;
  previewAlt?: string;
  onFile: (file: File) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
}

export function ImageDropZone({
  previewSrc,
  previewAlt = "",
  onFile,
  label = "Changer la photo",
  hint = "Cliquez ou déposez une image ici",
  disabled = false,
}: ImageDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOver, setIsOver] = useState(false);

  function pick() {
    if (disabled || !inputRef.current) return;
    inputRef.current.value = "";
    inputRef.current.click();
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {previewSrc ? <img className="adm-preview" src={previewSrc} alt={previewAlt} /> : null}
      <div
        className={"adm-drop" + (isOver ? " over" : "") + (disabled ? " is-disabled" : "")}
        role="button"
        tabIndex={0}
        onClick={pick}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          pick();
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsOver(false);
        }}
        onDrop={handleDrop}
      >
        <Icon name="image" />
        <p>
          <strong>{disabled ? "Envoi en cours…" : label}</strong>
          <br />
          {hint}
        </p>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleChange} />
    </>
  );
}
