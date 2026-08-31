"use client";

// Gestion des championnats — jusqu'ici en lecture seule (leagues/{key} n'était
// jamais écrit par l'admin). Ouvert depuis le bouton « Gérer les championnats »
// de l'onglet Produits : ajouter un championnat (ex. « Ligue 1 Cameroun ») et
// renommer les existants à volonté.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Drawer } from "@/components/admin/Drawer";
import { Icon } from "@/components/icons/Icon";
import { showToast } from "@/components/Toast";
import { createLeagueAction, deleteLeagueAction, renameLeagueAction } from "@/lib/actions/leagues";
import type { League } from "@/lib/types";

function LeagueRow({ league, onSaved, onDeleted }: { league: League; onSaved: () => void; onDeleted: () => void }) {
  const [label, setLabel] = useState(league.label);
  const [color, setColor] = useState(league.color);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const dirty = label.trim() !== league.label || color !== league.color;

  async function save() {
    setSaving(true);
    setError("");
    try {
      const result = await renameLeagueAction(league.key, { label, color });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast("Championnat mis à jour", "check-circle");
      onSaved();
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    if (!confirm(`Supprimer « ${league.label} » ?`)) return;
    setSaving(true);
    try {
      const result = await deleteLeagueAction(league.key);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      showToast("Championnat supprimé", "delete");
      onDeleted();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adm-tcard">
      <div className="top">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          style={{ width: 36, height: 36, padding: 0, border: "none", borderRadius: "var(--r-item)", flexShrink: 0 }}
        />
        <div style={{ flex: 1 }}>
          <div className="adm-field" style={{ margin: 0 }}>
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <p className="sub" style={{ margin: "4px 0 0" }}>
            {league.key}
          </p>
        </div>
        <button type="button" className="icon-btn danger" aria-label="Supprimer" disabled={saving} onClick={remove}>
          <Icon name="delete" size="sm" />
        </button>
      </div>
      {error ? <p style={{ color: "var(--error)", fontSize: ".8rem", margin: "8px 0 0" }}>{error}</p> : null}
      {dirty ? (
        <button type="button" className="btn btn-tonal btn-sm" style={{ marginTop: 10 }} disabled={saving} onClick={save}>
          <Icon name="save" size="sm" />
          Enregistrer
        </button>
      ) : null}
    </div>
  );
}

export function LeaguesManager({ leagues, open, onClose }: { leagues: League[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#22c55e");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function addLeague() {
    if (creating) return;
    setCreating(true);
    setError("");
    try {
      const result = await createLeagueAction({ label: newLabel, color: newColor });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showToast(`« ${newLabel} » créé`, "check-circle");
      setNewLabel("");
      router.refresh();
    } finally {
      setCreating(false);
    }
  }

  return (
    <Drawer open={open} onClose={onClose} title="Championnats" titleIcon="storefront">
      <div className="adm-warn">
        <Icon name="info" />
        <div>Renommer un championnat met aussi à jour tous les maillots déjà classés dedans.</div>
      </div>

      <div className="adm-testi">
        {leagues.map((l) => (
          <LeagueRow key={l.key} league={l} onSaved={() => router.refresh()} onDeleted={() => router.refresh()} />
        ))}
      </div>

      <h3 style={{ fontSize: ".92rem", margin: "22px 0 10px" }}>Ajouter un championnat</h3>
      {error ? (
        <div className="adm-warn">
          <Icon name="error" />
          <div>{error}</div>
        </div>
      ) : null}
      <div className="top" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          style={{ width: 36, height: 36, padding: 0, border: "none", borderRadius: "var(--r-item)", flexShrink: 0 }}
        />
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="Ligue 1 Cameroun"
          style={{ flex: 1 }}
        />
      </div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        style={{ marginTop: 12 }}
        disabled={creating || !newLabel.trim()}
        onClick={addLeague}
      >
        <Icon name="add" size="sm" />
        {creating ? "Création…" : "Créer le championnat"}
      </button>
    </Drawer>
  );
}
