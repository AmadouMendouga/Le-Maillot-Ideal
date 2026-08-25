// Porté depuis la section AVIS de js/admin.js.
import { useRef } from "react";
import { useDraftState } from "../../state/useDraftState.jsx";
import { readImage, reportImageError, toSquare } from "../../lib/image.js";

export default function TestimonialsTab() {
  const { state, dispatch } = useDraftState();
  const fileInputRef = useRef(null);
  const pendingIndexRef = useRef(null);
  const resolveImage = (path) => state.newImages[path] || path;

  function addTestimonial() {
    dispatch({
      type: "TESTI_ADD",
      item: { quote: "", name: "", designation: "", src: "images/testimonials/t" + (state.testimonials.length + 1) + ".svg" },
    });
  }
  function removeTestimonial(index) {
    if (!confirm("Supprimer cet avis ?")) return;
    dispatch({ type: "TESTI_DELETE", index });
  }
  function updateField(index, field, value) {
    dispatch({ type: "TESTI_UPDATE", index, field, value });
  }
  function startImagePick(index) {
    pendingIndexRef.current = index;
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.click();
  }
  async function handleFileChange(e) {
    const file = e.target.files && e.target.files[0];
    const index = pendingIndexRef.current;
    if (!file || index == null) return;
    try {
      const img = await readImage(file);
      const target = "images/testimonials/t" + (index + 1) + ".jpg";
      const dataUrl = toSquare(img, 600, 0.82);
      dispatch({ type: "TESTI_SET_IMAGE", index, path: target, dataUrl });
    } catch (error) {
      reportImageError(error, file);
    }
  }

  return (
    <section className="adm-panel active" data-panel="avis">
      <div className="adm-warn">
        <svg className="icon" aria-hidden="true"><use href="#i-error"></use></svg>
        <div>
          <strong>Ne publiez jamais un avis inventé sous la photo d'une vraie personne.</strong>
          La liste publique est vide par défaut. Ajoutez uniquement des retours authentiques et demandez
          l'accord écrit du client avant d'utiliser son nom ou son visage.
        </div>
      </div>
      <div className="adm-toolbar">
        <button type="button" className="btn btn-tonal btn-sm" onClick={addTestimonial}>
          <svg className="icon icon-sm" aria-hidden="true"><use href="#i-add"></use></svg>Ajouter un avis
        </button>
      </div>
      {state.testimonials.length === 0 ? (
        <div className="adm-empty">
          <svg className="icon" aria-hidden="true"><use href="#i-star"></use></svg>
          <div>Aucun avis publié. Ajoutez uniquement un retour client réel et autorisé.</div>
        </div>
      ) : (
        <div className="adm-testi">
          {state.testimonials.map((t, i) => (
            // eslint-disable-next-line react/no-array-index-key -- pas d'id stable, comme l'original (data-tname="i")
            <div className="adm-tcard" key={i}>
              <div className="top">
                <img src={resolveImage(t.src)} alt="" title="Changer le portrait" onClick={() => startImagePick(i)} />
                <div style={{ flex: 1 }}>
                  <div className="adm-field" style={{ margin: "0 0 6px" }}>
                    <input value={t.name} placeholder="Nom du client" onChange={(e) => updateField(i, "name", e.target.value)} />
                  </div>
                  <div className="adm-field" style={{ margin: 0 }}>
                    <input
                      value={t.designation} placeholder="Ville · Maillot acheté"
                      onChange={(e) => updateField(i, "designation", e.target.value)}
                    />
                  </div>
                </div>
                <button type="button" className="icon-btn danger" aria-label="Supprimer" onClick={() => removeTestimonial(i)}>
                  <svg className="icon icon-sm" aria-hidden="true"><use href="#i-delete"></use></svg>
                </button>
              </div>
              <div className="adm-field" style={{ margin: 0 }}>
                <textarea value={t.quote} placeholder="Ce que dit le client…" onChange={(e) => updateField(i, "quote", e.target.value)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
    </section>
  );
}
