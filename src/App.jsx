import { useState, useRef } from "react";

const RED = "#E31E24";
const DARKRED = "#B01419";

function cleanTekst(s) {
  if (!s) return "";
  return String(s)
    .replace(/\(aangeleverd door Schipper Kozijnen\)/gi, "")
    .replace(/,\s*aangeleverd door Schipper Kozijnen/gi, "")
    .replace(/aangeleverd door Schipper Kozijnen/gi, "")
    // Alle varianten van "kozijn door/van derden", "(aangeleverd) door derden", "door derden aangeleverd" — alleen de zinsnede weg, rest van de regel blijft staan
    .replace(/\(\s*(?:kozijn(?:en)?\s+)?(?:aangeleverd\s+)?(?:door|van)\s+derden(?:\s+aangeleverd)?\s*\)/gi, "")
    .replace(/[\s,;:–-]*\b(?:kozijn(?:en)?\s+)?(?:aangeleverd\s+)?(?:door|van)\s+derden(?:\s+aangeleverd)?\b/gi, "")
    .replace(/\s*rechts draaiend/gi, "")
    .replace(/\s*links draaiend/gi, "")
    .replace(/draaikiepraam rechts/gi, "Draaikiepraam")
    .replace(/draaikiepraam links/gi, "Draaikiepraam")
    .replace(/\bVH\b/g, "SK")
    .replace(/Van Hattem/gi, "Schipper")
    // Opruimen van restanten
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([,;:])(?=\s*([,;:]|$))/g, "")
    .replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, "")
    .trim();
}

// Maten: voorkomt "mm mm"
function zonderMm(v) { return v == null ? "" : String(v).replace(/\s*mm\s*$/i, "").trim(); }
function metMm(v) { const z = zonderMm(v); return z ? z + " mm" : ""; }
function mmGetal(v) { const n = parseInt(String(v || "").replace(/[^\d]/g, ""), 10); return isNaN(n) ? 0 : n; }

// Korte label voor een vak in de indelingstekening
function vakLabel(s) {
  const t = String(s || "").toLowerCase();
  if (/draai\s*-?\s*kiep/.test(t)) return "Draaikiep";
  if (/vast/.test(t)) return "Vast";
  if (/deur/.test(t)) return "Deur";
  if (/kiep/.test(t)) return "Kiep";
  if (/draai/.test(t)) return "Draai";
  return String(s || "").split(" ")[0];
}

// RAL-kleuren
const RAL_VELDEN = [
  ["kozijnBuiten", "Kozijn buitenzijde"],
  ["kozijnBinnen", "Kozijn binnenzijde"],
  ["draaiBuiten", "Draaideel buitenzijde"],
  ["draaiBinnen", "Draaideel binnenzijde"],
];
const RAL_OPTIES = ["RAL 9001 Crème", "RAL 9010 Zuiver wit", "RAL 9016 Verkeerswit", "RAL 7016 Antraciet", "RAL 7021 Zwartgrijs", "RAL 7039 Kwartsgrijs", "RAL 9005 Gitzwart", "RAL 6009 Dennengroen", "RAL 5011 Staalblauw"];
const RAL_HEX = {
  "1015": "#E6D2B5", "3004": "#6A1A21", "5011": "#1A2B3C", "5024": "#6093AC", "6005": "#0E4243", "6009": "#27352A",
  "7001": "#8C969D", "7012": "#575D5E", "7015": "#51565C", "7016": "#383E42", "7021": "#2E3234", "7022": "#4B4D46",
  "7024": "#474A50", "7035": "#CBD0CC", "7039": "#6C6960", "7040": "#9DA3A6", "8014": "#4A3526", "9001": "#E9E0D2",
  "9003": "#F4F4F4", "9005": "#0E0E10", "9010": "#F1ECE1", "9016": "#F1F0EA",
};
function ralHex(s) {
  const t = String(s || "");
  const m = t.match(/\b(\d{4})\b/);
  if (m && RAL_HEX[m[1]]) return RAL_HEX[m[1]];
  if (/antraciet/i.test(t)) return "#383E42";
  if (/cr[eè]me/i.test(t)) return "#E9E0D2";
  if (/zwart/i.test(t)) return "#111111";
  if (/wit/i.test(t)) return "#F4F4F4";
  return "";
}

// Foto inlezen en verkleinen (max 1600 px) zodat de PDF licht blijft
function leesAfbeelding(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, 1600 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * s);
        cv.height = Math.round(img.height * s);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.9));
      };
      img.onerror = () => res(reader.result);
      img.src = reader.result;
    };
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}

// Fotovak: klikken, slepen of plakken (Ctrl+V)
function FotoVak({ label, src, onFile, onRemove }) {
  const [over, setOver] = useState(false);
  const [focus, setFocus] = useState(false);
  const ref = useRef();
  const neem = (file) => { if (file && /^image\//.test(file.type)) onFile(file); };
  const actief = over || focus;
  return (
    <div
      tabIndex={0}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); neem(e.dataTransfer.files[0]); }}
      onPaste={e => { const item = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith("image/")); if (item) { e.preventDefault(); neem(item.getAsFile()); } }}
      style={{ position: "relative", height: 150, borderRadius: 10, border: (actief ? "2px solid " + RED : "2px dashed #ccc"), background: actief ? "#fff5f5" : "#fafafa", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", outline: "none" }}
    >
      {src ? (
        <>
          <img src={src} alt={label} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          <button onClick={e => { e.stopPropagation(); onRemove(); }} style={{ position: "absolute", top: 6, right: 6, background: "white", border: "1px solid #ddd", borderRadius: 6, padding: "3px 8px", fontSize: 11, fontWeight: 700, color: "#888", cursor: "pointer" }}>Verwijder</button>
        </>
      ) : (
        <div style={{ textAlign: "center", fontSize: 12, color: "#888", padding: 10 }}>
          <div style={{ fontWeight: 700, color: "#555", marginBottom: 4 }}>{label}</div>
          <div style={{ marginBottom: 8 }}>{focus ? "Druk nu op Ctrl+V om te plakken" : "Sleep hierheen, of klik en plak (Ctrl+V)"}</div>
          <button onClick={e => { e.stopPropagation(); ref.current.click(); }} style={{ background: "white", border: "1.5px solid " + RED, color: RED, borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Bestand kiezen</button>
        </div>
      )}
      <input ref={ref} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { neem(e.target.files[0]); e.target.value = ""; }} />
    </div>
  );
}

function cleanDakkapelNaam(s) {
  if (!s) return "SK Line Dakkapel";
  return s.replace(/\bVH\b/g, "SK").replace(/Van Hattem/gi, "Schipper").trim();
}

function isMontageKozijn(s) { return /montage kozijn/i.test(s); }
function isInmeten(s) { return /technisch inmeten/i.test(s); }
function isAfvoer(s) { return /afvoeren bouwafval/i.test(s); }
function isVoorbereidingRolluik(s) { return /voorbereiding rolluik|voorbereiding screen/i.test(s); }
function isRolluikOfScreen(s) { return /rolluik|zipscreen|screen|zonnescherm/i.test(s) && !/voorbereiding/i.test(s); }
function isTripleGlasNul(k) { return /triple glas|hr\+\+\+/i.test(k.omschrijving) && Number(k.totaal_excl) === 0; }
function isVentilatierooster(s) { return /ventilatierooster/i.test(s); }
function isVerborgenInDakkapel(s) { return isMontageKozijn(s) || isInmeten(s) || isAfvoer(s); }
function letterFor(i) { return String.fromCharCode(65 + i); }

async function leesOffertePDF(base64) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4000,
      messages: [{
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          {
            type: "text",
            text: `Lees deze Van Hattem dakkapel offerte en geef ALLEEN een JSON object terug zonder uitleg of markdown.

REGELS:
- adviseur_achternaam = de achternaam in "T.a.v. Dhr. [achternaam]" bovenaan (Schipper medewerker)
- adviseur_voornaam = de voornaam uit het schipperkozijnen.nl emailadres bovenaan
- adviseur_email = het schipperkozijnen.nl emailadres
- adviseur_telefoon = het telefoonnummer bij het schipperkozijnen.nl emailadres
- NIET de Van Hattem verkoper gebruiken als adviseur
- dakkapellen = een array met ÉÉN object per dakkapel in de offerte. Een offerte kan 1 of meerdere dakkapellen bevatten (bijv. "Dakkapel 1 achterzijde" en "Dakkapel 2 achterzijde" zijn TWEE aparte objecten in deze array, elk met hun eigen prijs en eigen "Opties & overige")
- dakkapel_naam = ALLEEN de korte productnaam zoals "VH Line Dakkapel" (geen positie erin)
- dakkapel_positie = "achterzijde" of "voorzijde"
- dakkapel_prijs_excl = het grote bedrag bij DIE specifieke dakkapel (NOOIT 0)
- kostenposten van een dakkapel = ALLEEN de opties die onder "Opties & overige" van DIE dakkapel staan. Bedragen EXACT overnemen.
- zonwering, indeling, materialen van een dakkapel = alleen wat in de bijlage van DIE specifieke dakkapel staat (bijv. Bijlage A hoort bij dakkapel 1, Bijlage B bij dakkapel 2)
- extra_posten = ALLE losse, offerte-brede posten die NIET bij één specifieke dakkapel horen, zoals: transport, kraan, vergunning, brandstoftoeslag, technische tekening, technisch inmeten, afvoeren bouwafval, meerprijs bijzonder transport etc.
- Alle bedragen EXACT overnemen.
- Laat de zinsnede "kozijn door derden", "kozijn van derden" of "(aangeleverd) door derden" weg uit alle teksten; de rest van de tekst blijft staan.

{
  "projectnummer": "",
  "referentie": "",
  "datum": "",
  "adviseur_voornaam": "",
  "adviseur_achternaam": "",
  "adviseur_email": "",
  "adviseur_telefoon": "",
  "montage_naam": "",
  "montage_adres": "",
  "montage_postcode_stad": "",
  "dakkapellen": [
    {
      "dakkapel_naam": "",
      "dakkapel_positie": "",
      "dakkapel_uitvoering": "",
      "dakkapel_breedte": "",
      "dakkapel_hoogte": "",
      "dakkapel_diepte": "",
      "dakkapel_inzakmaat": "",
      "dakkapel_hellingshoek": "",
      "dakkapel_woonoppervlakte": "",
      "dakkapel_overstek_voorkant": "",
      "dakkapel_overstek_zijkant": "",
      "dakkapel_prijs_excl": 0,
      "zonwering": [{"kozijn": "", "type": "", "kleur": "", "geleiders": "", "aansluiting": ""}],
      "indeling": [{"type": "", "breedte": "", "inhoud": []}],
      "materialen": [{"onderdeel": "", "materiaal": "", "kleur": ""}],
      "kostenposten": [{"omschrijving": "", "aantal": 1, "totaal_excl": 0}]
    }
  ],
  "extra_posten": [{"omschrijving": "", "aantal": 1, "prijs_excl": 0}]
}`
          }
        ]
      }]
    })
  });
  const data = await response.json();
  if (!data.content || !data.content[0]) throw new Error(JSON.stringify(data));
  const text = data.content[0].text;
  const clean = text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

function formatEur(n) {
  if (n == null || isNaN(n)) return "€ 0,00";
  return "€ " + Number(n).toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function App() {
  const [stap, setStap] = useState("upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [offerte, setOfferte] = useState(null);
  const [marges, setMarges] = useState({});
  const [kozijnenPosten, setKozijnenPosten] = useState([]);
  const [kozijnenMarges, setKozijnenMarges] = useState([]);
  const [extraPosten, setExtraPosten] = useState([]);
  const [eigProjNr, setEigProjNr] = useState("");
  const [versie, setVersie] = useState("1");
  const [asbest, setAsbest] = useState(false);
  const [documentType, setDocumentType] = useState("offerte");
  const [aanpassingen, setAanpassingen] = useState([{ omschrijving: "", bedrag: "", zichtbaar: true }]);
  const [ral, setRal] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [sleepPDF, setSleepPDF] = useState(false);
  const fileRef = useRef();

  const leegRal = () => ({ kozijnBuiten: "", kozijnBinnen: "", draaiBuiten: "", draaiBinnen: "" });
  const setRalVeld = (di, veld, v) => setRal(arr => arr.map((r, i) => i === di ? { ...r, [veld]: v } : r));
  const kopieerRal = (di) => setRal(arr => arr.map((r, i) => i === di ? { ...arr[0] } : r));
  const setFoto = async (di, k, file) => {
    const url = file ? await leesAfbeelding(file) : null;
    setFotos(arr => arr.map((f, i) => i === di ? { ...f, [k]: url } : f));
  };

  const verwerkPDF = async (file) => {
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) { setError("Dit is geen PDF-bestand. Sleep de Van Hattem offerte (PDF) hierheen."); return; }
    setLoading(true);
    setError(null);
    try {
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result.split(",")[1]);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      const data = await leesOffertePDF(base64);
      setOfferte(data);
      const daks = data.dakkapellen || [];
      const initMarges = {};
      daks.forEach((dak, di) => {
        initMarges["dak" + di + "_dakkapel"] = false;
        (dak.kostenposten || []).forEach((_, i) => { initMarges["dak" + di + "_kost_" + i] = false; });
      });
      if (data.extra_posten) data.extra_posten.forEach((_, i) => { initMarges["extra_" + i] = false; });
      setMarges(initMarges);
      setKozijnenPosten(daks.map(() => ""));
      setKozijnenMarges(daks.map(() => false));
      setExtraPosten(data.extra_posten || []);
      setEigProjNr(data.projectnummer || "");
      setVersie("1");
      setAsbest(false);
      setDocumentType("offerte");
      setAanpassingen([{ omschrijving: "", bedrag: "", zichtbaar: true }]);
      setRal(daks.map(() => leegRal()));
      setFotos(daks.map(() => ({ voor: null, zij: null })));
      setStap("preview");
    } catch (err) {
      setError("Kon PDF niet lezen: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const pm = (bedrag, key) => marges[key] ? bedrag * 1.2 : bedrag;

  // Rolluik-voorbereidingskosten die bij een specifiek rolluik/screen item van DEZELFDE dakkapel horen
  const getRolluikExtra = (dak, di) => {
    const rx = {};
    (dak.kostenposten || []).forEach((k, i) => {
      if (isVoorbereidingRolluik(k.omschrijving || "")) {
        const ri = (dak.kostenposten || []).findIndex((r, j) => j !== i && isRolluikOfScreen(r.omschrijving || ""));
        if (ri >= 0) rx[ri] = (rx[ri] || 0) + pm(k.totaal_excl || 0, "dak" + di + "_kost_" + i);
      }
    });
    return rx;
  };

  const berekenTotalen = () => {
    if (!offerte) return { dakkapellen: [], dakSubtotaalSom: 0, extraTotaal: 0, totaalExcl: 0, totaalIncl: 0, totaalAlles: 0 };
    const daks = offerte.dakkapellen || [];

    const dakResultaten = daks.map((dak, di) => {
      const rx = getRolluikExtra(dak, di);
      let verborgenExcl = 0;
      (dak.kostenposten || []).forEach((k, i) => {
        const s = k.omschrijving || "";
        const key = "dak" + di + "_kost_" + i;
        if (isVerborgenInDakkapel(s)) { verborgenExcl += pm(k.totaal_excl || 0, key); return; }
        if (isVoorbereidingRolluik(s)) {
          const ri = (dak.kostenposten || []).findIndex((r, j) => j !== i && isRolluikOfScreen(r.omschrijving || ""));
          if (ri < 0) verborgenExcl += pm(k.totaal_excl || 0, key);
        }
      });
      const kozijnenPostVal = parseFloat(kozijnenPosten[di]) || 0;
      const kozijnenInclBTW = kozijnenMarges[di] ? kozijnenPostVal * 1.2 : kozijnenPostVal;
      const kozijnenExclBTW = kozijnenInclBTW / 1.21;
      const dakkapelTotaalExcl = pm(dak.dakkapel_prijs_excl || 0, "dak" + di + "_dakkapel") + verborgenExcl + kozijnenExclBTW;
      const kostenTotaal = (dak.kostenposten || []).reduce((sum, k, i) => {
        const s = k.omschrijving || "";
        const key = "dak" + di + "_kost_" + i;
        if (isTripleGlasNul(k) || isVentilatierooster(s) || isVerborgenInDakkapel(s) || isVoorbereidingRolluik(s)) return sum;
        return sum + pm(k.totaal_excl || 0, key) + (rx[i] || 0);
      }, 0);
      const subtotaal = dakkapelTotaalExcl + kostenTotaal;
      return { dakkapelTotaalExcl, kostenTotaal, subtotaal, rx, kozijnenExclBTW };
    });

    const dakSubtotaalSom = dakResultaten.reduce((s, d) => s + d.subtotaal, 0);

    // FIX: Technisch inmeten en Afvoeren bouwafval worden nu WEL meegeteld in het totaal
    const extraTotaal = extraPosten.reduce((sum, k, i) => {
      return sum + pm(k.prijs_excl || 0, "extra_" + i);
    }, 0);

    const totaalExcl = dakSubtotaalSom + extraTotaal;
    const totaalIncl = totaalExcl * 1.21;
    const aanpassingTotaal = aanpassingen.reduce((sum, a) => sum + (parseFloat(a.bedrag) || 0), 0);
    const totaalAlles = totaalIncl + (asbest ? 495 : 0) + aanpassingTotaal;
    return { dakkapellen: dakResultaten, dakSubtotaalSom, extraTotaal, totaalExcl, totaalIncl, totaalAlles };
  };

  const printOfferte = () => {
    const t = berekenTotalen();
    const o = offerte;
    const daks = o.dakkapellen || [];
    const c = (s) => cleanTekst(s == null ? "" : String(s));
    const LOGO = "https://subsidie-adviseur.vercel.app/images.png";
    const adviseurNaam = ((o.adviseur_voornaam || "") + " " + (o.adviseur_achternaam || "")).trim();
    const projNrTonen = eigProjNr || o.referentie || o.projectnummer || "";
    const docTitel = documentType === "orderbevestiging" ? "Orderbevestiging" : documentType === "inmeten" ? "Offerte na Inmeten" : "Dakkapel Specificatie";
    const stempel = documentType === "orderbevestiging" ? "<div class='stempel'>ORDERBEVESTIGING</div>"
      : documentType === "inmeten" ? "<div class='stempel'>NA INMETEN</div>" : "";

    // Zebra-rijen: om en om grijs/wit
    const rij = (cellen, i, extraClass) => "<tr class='" + (i % 2 ? "alt " : "") + (extraClass || "") + "'>" + cellen + "</tr>";
    const td = (inhoud, cls) => "<td" + (cls ? " class='" + cls + "'" : "") + ">" + inhoud + "</td>";
    const kop = (titel) => "<div class='kop'><div class='kop-titel'>" + titel + "</div><div class='kop-r'><span>" + projNrTonen + " · v" + versie + "</span><img src='" + LOGO + "' class='kop-logo' alt='Schipper Kozijnen'/></div></div>";
    const dakNaam = (dak, di) => "Dakkapel " + (di + 1) + " " + c(dak.dakkapel_positie || "achterzijde") + " — " + c(cleanDakkapelNaam(dak.dakkapel_naam || "SK Line Dakkapel"));
    const afm = (dak, metDiepte) => {
      const d = [dak.dakkapel_breedte, dak.dakkapel_hoogte].concat(metDiepte ? [dak.dakkapel_diepte] : []).map(zonderMm).filter(Boolean);
      return d.length >= 2 ? d.join(" × ") + " mm" : "";
    };

    // ---------- PAGINA 1: OVERZICHT ----------
    let n = 0;
    const dakRegels = daks.map((dak, di) => {
      const dt = t.dakkapellen[di] || { subtotaal: 0 };
      return rij(td(dakNaam(dak, di)) + td("1×", "num") + td(formatEur(dt.subtotaal * 1.21), "num"), n++);
    }).join("");

    const overigRijen = [];
    extraPosten.forEach((k, i) => {
      overigRijen.push([c(k.omschrijving), (k.aantal || 1) + "×", formatEur(pm(k.prijs_excl || 0, "extra_" + i) * 1.21), ""]);
    });
    if (asbest) overigRijen.push(["Asbestinventarisatie", "1×", formatEur(495), ""]);
    aanpassingen
      .filter(a => a.zichtbaar && (parseFloat(a.bedrag) || 0) !== 0 && a.omschrijving.trim())
      .forEach(a => { const b = parseFloat(a.bedrag) || 0; overigRijen.push([a.omschrijving, "1×", formatEur(b), b < 0 ? "korting" : ""]); });

    let m = 0;
    const overigHTML = overigRijen.length
      ? "<tr class='groep'><td colspan='3'>Overige posten</td></tr>" + overigRijen.map(([oms, aantal, prijs, cls]) => rij(td(oms) + td(aantal, "num") + td(prijs, "num " + cls), m++)).join("")
      : "";

    const pagina1 = `<section class="pagina">
      <div class="balk"></div>
      <div class="head">
        <img src="${LOGO}" class="logo" alt="Schipper Kozijnen"/>
        <div class="head-r"><div class="doc">${docTitel}</div><div class="grijs">${projNrTonen} · versie ${versie}${o.datum ? " · " + o.datum : ""}</div>${stempel}</div>
      </div>
      <div class="info">
        <div><div class="lbl">Klant en montageadres</div>${c(o.montage_naam)}<br>$
