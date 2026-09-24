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
  const clean = text.replace(/`{3}(?:json)?/g, "").trim();
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
        <div><div class="lbl">Klant en montageadres</div>${c(o.montage_naam)}<br>${c(o.montage_adres)}<br>${c(o.montage_postcode_stad)}</div>
        <div><div class="lbl">Uw adviseur bij Schipper Kozijnen</div>${adviseurNaam}<br>${o.adviseur_email || ""}<br>${o.adviseur_telefoon || ""}</div>
      </div>
      <h2 class="sectie">Totaaloverzicht</h2>
      <table class="lijst"><colgroup><col><col class="c-aantal"><col class="c-prijs"></colgroup>
        <thead><tr><th>Omschrijving</th><th class="num">Aantal</th><th class="num">Incl. btw</th></tr></thead>
        <tbody>${dakRegels}${overigHTML}</tbody></table>
      <div class="totaal"><span>Totaal incl. 21% btw</span><span class="bedrag">${formatEur(t.totaalAlles)}</span></div>
      <div class="noot">Dakkapel(len) worden zonder binnenafwerking, casco opgeleverd.<br>Eventuele zonnepanelen dienen verwijderd te zijn voor plaatsing van de dakkapel(len).<br>Alle genoemde prijzen zijn inclusief 21% btw. De specificatie per dakkapel vindt u op de volgende pagina's.</div>
    </section>`;

    // ---------- PER DAKKAPEL: DETAILPAGINA + BIJLAGE ----------
    const dakPaginas = daks.map((dak, di) => {
      const dt = t.dakkapellen[di] || { dakkapelTotaalExcl: 0, subtotaal: 0, rx: {} };
      const positie = c(dak.dakkapel_positie || "achterzijde");
      const foto = fotos[di] || {};
      const kleuren = ral[di] || {};

      const specs = [["Uitvoering", c(dak.dakkapel_uitvoering)], ["Afmetingen (b × h)", afm(dak, false)], ["Hellingshoek", c(dak.dakkapel_hellingshoek)], ["Extra woonoppervlakte", c(dak.dakkapel_woonoppervlakte)]]
        .filter(([, v]) => v).map(([l, v]) => "<div><div class='l'>" + l + "</div><div class='v'>" + v + "</div></div>").join("");

      const fotoVak = (src, label) => "<figure>" + (src ? "<div class='foto'><img src='" + src + "' alt='" + label + "'/></div>" : "<div class='foto leeg'>" + label + "</div>") + "<figcaption>" + label + "</figcaption></figure>";

      const ralItems = RAL_VELDEN.filter(([veld]) => (kleuren[veld] || "").trim());
      const ralHTML = ralItems.length ? "<div class='ral'>" + ralItems.map(([veld, label]) => {
        const hex = ralHex(kleuren[veld]);
        return "<div><div class='l'>" + label + "</div><div class='v'>" + (hex ? "<span class='sw' style='background:" + hex + "'></span>" : "") + kleuren[veld].trim() + "</div></div>";
      }).join("") + "</div>" : "";

      let r = 0;
      const kostenHTML = (dak.kostenposten || []).map((k, i) => {
        const s = k.omschrijving || "";
        if (isTripleGlasNul(k) || isVentilatierooster(s) || isVerborgenInDakkapel(s) || isVoorbereidingRolluik(s)) return "";
        const tekst = c(s);
        if (!tekst) return "";
        const pIncl = (pm(k.totaal_excl || 0, "dak" + di + "_kost_" + i) + (dt.rx[i] || 0)) * 1.21;
        return rij(td(tekst) + td((k.aantal || 1) + "×", "num") + td(formatEur(pIncl), "num"), r++);
      }).join("");

      const detail = `<section class="pagina">
        ${kop("Dakkapel " + (di + 1) + " · " + positie)}
        <div class="dak-titel"><span>${dakNaam(dak, di)}</span><span>${formatEur(dt.dakkapelTotaalExcl * 1.21)}</span></div>
        <div class="specs">${specs}</div>
        <div class="fotos">${fotoVak(foto.voor, "Vooraanzicht")}${fotoVak(foto.zij, "Zijaanzicht")}</div>
        <p class="hint">De afbeeldingen zijn een impressie van de dakkapel en kunnen afwijken van de werkelijkheid.</p>
        ${ralHTML}
        <table class="lijst"><colgroup><col><col class="c-aantal"><col class="c-prijs"></colgroup>
          <thead><tr><th>Opties en overige</th><th class="num">Aantal</th><th class="num">Incl. btw</th></tr></thead>
          <tbody><tr class="basis">${td("Dakkapel " + c(cleanDakkapelNaam(dak.dakkapel_naam || "SK Line Dakkapel")))}${td("1×", "num")}${td(formatEur(dt.dakkapelTotaalExcl * 1.21), "num")}</tr>${kostenHTML}
          <tr class="subtot"><td colspan="2">Subtotaal dakkapel ${di + 1}</td><td class="num">${formatEur(dt.subtotaal * 1.21)}</td></tr></tbody></table>
      </section>`;
      // Bijlage: specificaties, zonwering, materialen, indeling
      const kv = [["Uitstraling", c(dak.dakkapel_uitvoering)], ["Afmetingen (b × h × d)", afm(dak, true)], ["Inzakmaat (incl. 10 mm speling)", metMm(dak.dakkapel_inzakmaat)], ["Hellingshoek", c(dak.dakkapel_hellingshoek)], ["Positie op de woning", positie], ["Vergunningsplichtig", "Nee"], ["Extra woonoppervlakte", c(dak.dakkapel_woonoppervlakte)], ["Overstek boei voorkant", metMm(dak.dakkapel_overstek_voorkant) || "260 mm"], ["Overstek boei zijkant", metMm(dak.dakkapel_overstek_zijkant) || "150 mm"]]
        .filter(([, v]) => v).map(([l, v], i) => rij(td(l, "l") + td(v), i)).join("");

      const zon = (dak.zonwering || []).filter(z => z && (z.type || z.kozijn));
      const zonHTML = zon.length ? "<h3 class='kopje'>Zonwering</h3><table class='lijst'><tbody>" + zon.map((z, i) => {
        const details = [z.kleur && "Kleur: " + c(z.kleur), z.geleiders && "Geleiders: " + c(z.geleiders), z.aansluiting && "Aansluiting buitenzijde: " + c(z.aansluiting)].filter(Boolean).join(" · ");
        return rij(td("<strong>" + [c(z.type), c(z.kozijn)].filter(Boolean).join(" — ") + "</strong>" + (details ? "<div class='klein'>" + details + "</div>" : "")), i);
      }).join("") + "</tbody></table>" : "";

      const mat = (dak.materialen || []).filter(x => x && (x.onderdeel || x.materiaal));
      const matHTML = mat.length ? "<h3 class='kopje'>Materialen</h3><table class='lijst'><colgroup><col style='width:30%'><col style='width:42%'><col style='width:28%'></colgroup><thead><tr><th>Onderdeel</th><th>Materiaal</th><th>Kleur</th></tr></thead><tbody>" +
        mat.map((x, i) => rij(td(c(x.onderdeel)) + td(c(x.materiaal)) + td(c(x.kleur)), i)).join("") + "</tbody></table>" : "";

      const ind = (dak.indeling || []).filter(k => k && (k.type || k.breedte));
      const indItems = ind.map(k => ({
        type: c(k.type),
        breedte: metMm(k.breedte),
        mm: mmGetal(k.breedte),
        inhoud: (k.inhoud || []).filter(x => !isVentilatierooster(x)).map(c).filter(Boolean),
        penant: /penant/i.test(k.type || ""),
      }));
      const somMm = indItems.reduce((s, k) => s + (k.mm || 0), 0);
      const stripOk = indItems.length > 0 && indItems.every(k => k.mm > 0) && somMm > 0;
      const stripHTML = stripOk ? "<div class='strip'>" + indItems.map((k, i) =>
        "<div class='el " + (k.penant ? "penant" : "kozijn") + "' style='flex:" + k.mm + " 1 0'>" +
          (k.penant ? "<span>" + (i + 1) + "</span>" : (k.inhoud.length ? k.inhoud : [k.type]).map(v => "<div class='vak'>" + vakLabel(v) + "</div>").join("")) +
        "</div>").join("") + "</div><div class='strip-maten'>" + indItems.map((k, i) =>
        "<div style='flex:" + k.mm + " 1 0'>" + (i + 1) + (k.mm / somMm >= 0.1 ? " · " + k.breedte : "") + "</div>").join("") + "</div>" : "";
      const indTabel = indItems.length ? "<table class='lijst'><colgroup><col style='width:34px'><col style='width:28%'><col><col class='c-prijs'></colgroup><thead><tr><th>#</th><th>Onderdeel</th><th>Uitvoering</th><th class='num'>Breedte</th></tr></thead><tbody>" +
        indItems.map((k, i) => rij(td(String(i + 1)) + td("<strong>" + k.type + "</strong>") + td(k.inhoud.join(" · ") || "—") + td(k.breedte, "num"), i)).join("") + "</tbody></table>" : "";
      const indHTML = indItems.length ? "<h3 class='kopje'>Indeling <span class='hint'>van buitenaf gezien, van links naar rechts</span></h3>" + stripHTML + indTabel + "<p class='hint'>Zie de kozijnomschrijving voor verdere specificaties per kozijn.</p>" : "";

      const bijlage = `<section class="pagina">
        ${kop("Bijlage " + letterFor(di) + " · Technische specificatie dakkapel " + (di + 1) + " " + positie)}
        <div class="twee">
          <div><h3 class="kopje eerste">Schipper dakkapel <span class="hint">een kwaliteitsproduct naar uw wens samengesteld</span></h3><table class="lijst kv"><tbody>${kv}</tbody></table>${zonHTML}</div>
          <div>${matHTML.replace("class='kopje'", "class='kopje eerste'")}</div>
        </div>
        ${indHTML}
      </section>`;

      return detail + bijlage;
    }).join("");

    // ---------- ALGEMENE VOORWAARDEN ----------
    const voorwaarden = `<section class="pagina">
      ${kop("Bijlage " + letterFor(daks.length) + " · Algemene voorwaarden")}
      <p class="av">Schipper Kozijnen bouwt zijn kapellen volgens hoge kwaliteitsnormen: Uitsluitend A-merken van Nederlands fabricaat - Balken in het dak geplaatst om de 30 cm, hoogste norm - Isolatiewaarde van Rc 6,3 in het dak en Rc 4,7 in de zijwangen - EPDM dakbedekking - Kozijnen zijn rondom vleugel en kozijn doorboord voor staalbevestiging - Standaard HR++ glas - Kunststof kozijnen en draaikiepramen, naar binnen draaiend, met Politie keurmerk. Naast kwaliteit en uitstraling hechten wij vooral veel waarde aan goede service en snelle levertijden. Onze dakkapellen worden geheel volgens uw wens in de fabriek prefab geproduceerd en daarmee bent u verzekerd van een hoogwaardig kwaliteitsproduct. Voorafgaand aan de productie en plaatsing komt onze specialist alles ter plekke technisch inmeten.</p>
      <h3 class="kopje">Kraan gerelateerde vergunningen en maatregelen</h3>
      <p class="av">I.v.m. de veiligheid en bereikbaarheid tijdens het plaatsen van de dakkapellen d.m.v. een hijskraan moeten we in de meeste situaties de gemeente op de hoogte brengen d.m.v. een melding of soms een vergunning. In enkele gevallen moet het kraanbedrijf dit doen. Het kraanbedrijf neemt afhankelijk van de situatie (soms in overleg met uw gemeente) verkeersmaatregelen (wel of niet zichtbaar) omdat deze essentieel zijn voor een ongestoorde en veilige uitvoering van de werkzaamheden. Ook om te voorkomen dat u of de machinist in ongewenste situaties komen, vindt het kraanbedrijf het belangrijk dat deze zaken goed zijn geregeld. Deze externe kosten worden na plaatsing aan u doorberekend.</p>
      <h3 class="kopje">Oplevering</h3>
      <p class="av">Uw dakkapel(len) worden geleverd en geplaatst onder voorbehoud van de weersomstandigheden op een nader te bepalen datum. Uw dakkapel(len) worden casco (zonder binnenafwerking) opgeleverd en elektra zult u zelf (of een installateur) moeten aansluiten.</p>
    </section>`;

    const css = `
@page{size:A4;margin:13mm 14mm}
*{box-sizing:border-box;margin:0;padding:0}
html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'IBM Plex Sans','Segoe UI',sans-serif;font-size:11.5px;line-height:1.45;color:#1f2226;background:#fff}
@media screen{body{background:#e6e6e6;padding:24px 0}.pagina{width:210mm;min-height:297mm;margin:0 auto 24px;padding:13mm 14mm;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.12)}}
.pagina+.pagina{break-before:page;page-break-before:always}
.balk{height:5px;background:${RED};margin-bottom:22px}
.head{display:flex;justify-content:space-between;align-items:flex-start}
.logo{height:46px}
.head-r{text-align:right}
.doc{font-size:19px;font-weight:600}
.grijs{color:#555}
.stempel{display:inline-block;margin-top:8px;border:2px solid ${RED};color:${RED};font-weight:700;font-size:10px;letter-spacing:.06em;padding:3px 9px;border-radius:3px}
.info{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:26px 0 4px}
.info>div:last-child{text-align:right}
.lbl{font-size:10px;font-weight:600;color:${RED};margin-bottom:3px}
h2.sectie{font-size:14px;font-weight:600;border-top:2px solid #1f2226;padding-top:10px;margin:22px 0 8px}
table{width:100%;border-collapse:collapse;table-layout:fixed}
thead{display:table-header-group}
tr{break-inside:avoid;page-break-inside:avoid}
.lijst th{font-size:10px;font-weight:600;color:#595959;text-align:left;padding:0 8px 5px;border-bottom:1px solid #1f2226}
.lijst td{padding:6px 8px;vertical-align:top}
tr.alt td{background:#f1f1f0}
.num{text-align:right;white-space:nowrap}
.korting{color:#2D6A4F}
col.c-aantal{width:62px}col.c-prijs{width:112px}
tr.groep td{font-size:10px;font-weight:600;color:#595959;padding:14px 8px 5px;border-bottom:1px solid #d6d6d6}
tr.basis td{font-weight:600;border-bottom:1px solid #d6d6d6}
tr.subtot td{border-top:2px solid #1f2226;font-weight:600;padding-top:8px}
.totaal{display:flex;justify-content:space-between;align-items:baseline;border-top:2px solid ${RED};margin-top:10px;padding:10px 8px;break-inside:avoid}
.totaal span:first-child{font-size:13px;font-weight:600}
.totaal .bedrag{font-size:20px;font-weight:600;color:${RED}}
.noot{margin-top:18px;padding-top:10px;border-top:1px solid #e2e2e2;font-size:10px;color:#595959;break-inside:avoid}
.kop{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${RED};padding-bottom:8px;margin-bottom:18px}
.kop-titel{font-size:13px;font-weight:600}
.kop-r{display:flex;align-items:center;gap:14px;color:#595959;font-size:10px}
.kop-logo{height:28px}
.dak-titel{display:flex;justify-content:space-between;align-items:baseline;gap:16px;font-size:15px;font-weight:600}
.dak-titel span:last-child{white-space:nowrap}
.specs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:10px 0 16px}
.l{font-size:10px;color:#595959}
.v{font-weight:500;display:flex;align-items:center;gap:6px}
.fotos{display:grid;grid-template-columns:1fr 1fr;gap:12px;break-inside:avoid}
.foto{height:200px;border:1px solid #e2e2e2;display:flex;align-items:center;justify-content:center;background:#fff;overflow:hidden;padding:8px}
.foto img{max-width:100%;max-height:100%;object-fit:contain}
.foto.leeg{border:1.5px dashed #cdcdcd;color:#8a8a8a;font-size:10px;background:#fafafa}
figcaption{font-size:10px;color:#595959;margin-top:4px}
.hint{font-size:10px;color:#666;font-weight:400}
p.hint{margin:6px 0 0}
.ral{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;background:#f1f1f0;padding:10px 12px;margin:14px 0 0;break-inside:avoid}
.sw{width:12px;height:12px;border:1px solid #8c8c8c;flex-shrink:0;display:inline-block}
.lijst{margin-top:16px}
.kv td.l{width:48%;font-size:11px}
h3.kopje{font-size:12px;font-weight:600;margin:18px 0 0;break-after:avoid;page-break-after:avoid}
h3.kopje.eerste{margin-top:0}
h3.kopje .hint{margin-left:6px}
h3.kopje+.lijst{margin-top:6px}
.klein{font-size:10px;color:#555;margin-top:1px}
.twee{display:grid;grid-template-columns:1fr 1fr;gap:26px}
.strip{display:flex;height:60px;border:1.5px solid #1f2226;margin-top:8px;break-inside:avoid}
.strip .el{display:flex;min-width:0;border-right:1.5px solid #1f2226}
.strip .el:last-child{border-right:none}
.strip .penant{background:#5b6166;color:#fff;align-items:center;justify-content:center;font-size:10px;font-weight:600}
.strip .kozijn{background:#fff;gap:3px;padding:4px}
.strip .vak{flex:1 1 0;min-width:0;background:#e5ecf0;border:1px solid #9aa6ae;display:flex;align-items:center;justify-content:center;font-size:9px;color:#333;overflow:hidden;white-space:nowrap}
.strip-maten{display:flex;font-size:9.5px;color:#595959;margin-top:3px}
.strip-maten div{min-width:0;text-align:center;white-space:nowrap;overflow:hidden}
.strip-maten+.lijst{margin-top:10px}
p.av{font-size:10.5px;color:#444;line-height:1.7;margin-top:6px}
`;

    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>${docTitel} - ${projNrTonen} v${versie}</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"><style>${css}</style></head><body>`);
    win.document.write(pagina1 + dakPaginas + voorwaarden);
    win.document.write("</body></html>");
    win.document.close();
    const doPrint = () => { try { win.focus(); win.print(); } catch (e) { /* venster gesloten */ } };
    setTimeout(() => {
      const fontsKlaar = win.document.fonts && win.document.fonts.ready ? win.document.fonts.ready : Promise.resolve();
      fontsKlaar.then(() => setTimeout(doPrint, 150)).catch(doPrint);
    }, 400);
  };

  const t = berekenTotalen();
  const daks = offerte ? (offerte.dakkapellen || []) : [];

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f7", fontFamily: "'Segoe UI', system-ui, sans-serif", color: "#1a1a2e" }}>
      <div style={{ background: "linear-gradient(135deg," + DARKRED + "," + RED + ")", color: "white", padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 4px 20px rgba(227,30,36,0.3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ background: "white", borderRadius: 6, padding: "3px 8px", display: "flex", alignItems: "center" }}>
            <img src="https://subsidie-adviseur.vercel.app/images.png" alt="Schipper Kozijnen" style={{ height: 36 }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Dakkapel Offerte Tool</div>
            <div style={{ fontSize: 10, opacity: 0.75 }}>Van Hattem offerte omzetten naar Schipper Kozijnen</div>
          </div>
        </div>
        {stap === "preview" && (
          <button onClick={() => { setStap("upload"); setOfferte(null); }} style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", color: "white", padding: "7px 16px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
            Nieuwe offerte
          </button>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px" }}>
        {stap === "upload" && (
          <div onDragOver={e => e.preventDefault()} onDrop={e => e.preventDefault()} style={{ background: "white", borderRadius: 16, padding: "48px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", borderTop: "4px solid " + RED }}>
            <img src="https://subsidie-adviseur.vercel.app/images.png" alt="Schipper Kozijnen" style={{ height: 60, marginBottom: 24 }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: RED }}>Van Hattem Offerte Uploaden</h2>
            <p style={{ color: "#888", fontSize: 14, marginBottom: 32 }}>Upload de PDF van Van Hattem en wij zetten hem automatisch om naar een Schipper Kozijnen offerte. Offertes met meerdere dakkapellen worden automatisch herkend.</p>
            {error && <div style={{ background: "#fff0f0", border: "1px solid #f5c6c6", borderRadius: 10, padding: "12px 18px", color: "#c0392b", fontSize: 13, marginBottom: 20 }}>{error}</div>}
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{ width: 48, height: 48, border: "4px solid " + RED, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <div style={{ color: RED, fontWeight: 600 }}>PDF wordt gelezen door AI...</div>
                <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
              </div>
            ) : (
              <div
                onClick={() => fileRef.current.click()}
                onDragEnter={e => { e.preventDefault(); setSleepPDF(true); }}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setSleepPDF(true); }}
                onDragLeave={e => { e.preventDefault(); if (!e.currentTarget.contains(e.relatedTarget)) setSleepPDF(false); }}
                onDrop={e => { e.preventDefault(); e.stopPropagation(); setSleepPDF(false); verwerkPDF(e.dataTransfer.files[0]); }}
                style={{ border: (sleepPDF ? "3px solid " : "3px dashed ") + RED, borderRadius: 12, padding: "40px", cursor: "pointer", background: sleepPDF ? "#ffe3e3" : "#fff5f5", transform: sleepPDF ? "scale(1.01)" : "none", transition: "all 0.15s" }}
              >
                <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: RED, marginBottom: 6 }}>{sleepPDF ? "Laat los om te uploaden" : "Sleep je PDF hierheen of klik om te uploaden"}</div>
                <div style={{ fontSize: 13, color: "#aaa" }}>Van Hattem offerte (PDF)</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={e => { verwerkPDF(e.target.files[0]); e.target.value = ""; }} />
          </div>
        )}

        {stap === "preview" && offerte && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <datalist id="ral-opties">{RAL_OPTIES.map(o => <option key={o} value={o} />)}</datalist>

            {/* PROJECTGEGEVENS */}
            <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", borderTop: "3px solid " + RED }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: RED, marginBottom: 12 }}>Projectgegevens</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 13, marginBottom: 16 }}>
                {[["Klant", offerte.montage_naam], ["Adres", offerte.montage_adres + " " + offerte.montage_postcode_stad], ["Datum", offerte.datum], ["Adviseur Schipper", ((offerte.adviseur_voornaam || "") + " " + (offerte.adviseur_achternaam || "")).trim()], ["VH Referentie", offerte.referentie || offerte.projectnummer]].map(([label, val]) => (
                  <div key={label}><span style={{ fontSize: 10, color: "#888", textTransform: "uppercase", display: "block", marginBottom: 2 }}>{label}</span><strong>{val}</strong></div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
                <div>
                  <label style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Schipper Projectnummer</label>
                  <input value={eigProjNr} onChange={e => setEigProjNr(e.target.value)} placeholder="bijv. O-196107" style={{ padding: "8px 12px", border: "2px solid " + RED, borderRadius: 8, fontSize: 14, fontWeight: 600, outline: "none", width: 200 }} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Versie</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {["1", "2", "3", "4", "5"].map(v => (
                      <button key={v} onClick={() => setVersie(v)} style={{ width: 36, height: 36, borderRadius: 8, border: versie === v ? "2px solid " + RED : "1.5px solid #dde", background: versie === v ? RED : "white", color: versie === v ? "white" : "#555", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{v}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 4 }}>Document type</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    {[["offerte", "Offerte"], ["inmeten", "Na Inmeten"], ["orderbevestiging", "Orderbevestiging"]].map(([val, label]) => (
                      <button key={val} onClick={() => setDocumentType(val)} style={{ padding: "6px 12px", borderRadius: 8, border: documentType === val ? "2px solid " + RED : "1.5px solid #dde", background: documentType === val ? RED : "white", color: documentType === val ? "white" : "#555", fontWeight: 700, fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* PER-DAKKAPEL PRIJZEN EN MARGE */}
            {daks.map((dak, di) => {
              const dt = t.dakkapellen[di] || { subtotaal: 0, rx: {} };
              const dakkapelNaamUI = "Dakkapel " + (di + 1) + " " + (dak.dakkapel_positie || "achterzijde") + " - " + cleanDakkapelNaam(dak.dakkapel_naam || "SK Line Dakkapel");
              return (
                <div key={di} style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: RED, marginBottom: 4 }}>{dakkapelNaamUI}</div>
                  <div style={{ fontSize: 11, color: "#888", marginBottom: 16 }}>Gestreepte posten zijn verborgen in dakkapelprijs op PDF — marge wordt wel meegenomen.</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                    {/* DAKKAPEL BASISPRIJS */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fff5f5", borderRadius: 10, border: "1px solid #f5c6c6" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{dakkapelNaamUI}</div>
                        <div style={{ fontSize: 11, color: "#888" }}>Dakkapel basisprijs</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: RED }}>{formatEur(pm(dak.dakkapel_prijs_excl || 0, "dak" + di + "_dakkapel") * 1.21)}</div>
                          <div style={{ fontSize: 10, color: "#aaa" }}>incl. BTW</div>
                        </div>
                        <button onClick={() => setMarges(m => ({ ...m, ["dak" + di + "_dakkapel"]: !m["dak" + di + "_dakkapel"] }))} style={{ background: marges["dak" + di + "_dakkapel"] ? RED : "#eee", color: marges["dak" + di + "_dakkapel"] ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {marges["dak" + di + "_dakkapel"] ? "Marge AAN" : "Marge UIT"}
                        </button>
                      </div>
                    </div>

                    {/* KOZIJNEN VOOR DEZE DAKKAPEL */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f0fff4", borderRadius: 10, border: "1px solid #a8e6c0" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>Schipper Kozijnen kozijnen</div>
                        <div style={{ fontSize: 11, color: "#888" }}>Incl. BTW — verborgen in dakkapelprijs op PDF</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, color: "#2D6A4F", fontWeight: 700 }}>€</span>
                          <input type="number" min="0" value={kozijnenPosten[di] ?? ""} onChange={e => setKozijnenPosten(arr => arr.map((v, idx) => idx === di ? e.target.value : v))} placeholder="0.00" style={{ width: 90, padding: "5px 8px", border: "1.5px solid #2D6A4F", borderRadius: 6, fontSize: 13, textAlign: "right", outline: "none" }} />
                        </div>
                        <button onClick={() => setKozijnenMarges(arr => arr.map((v, idx) => idx === di ? !v : v))} style={{ background: kozijnenMarges[di] ? RED : "#eee", color: kozijnenMarges[di] ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {kozijnenMarges[di] ? "Marge AAN" : "Marge UIT"}
                        </button>
                      </div>
                    </div>

                    {/* KOSTENPOSTEN VAN DEZE DAKKAPEL */}
                    {(dak.kostenposten || []).map((k, i) => {
                      const s = k.omschrijving || "";
                      if (isTripleGlasNul(k) || isVentilatierooster(s)) return null;
                      const isVerborgen = isVerborgenInDakkapel(s) || isVoorbereidingRolluik(s);
                      const key = "dak" + di + "_kost_" + i;
                      const extra = dt.rx[i] || 0;
                      const pIncl = (pm(k.totaal_excl || 0, key) + extra) * 1.21;
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: isVerborgen ? "#f5f5f5" : "#fafafa", borderRadius: 10, border: isVerborgen ? "1px dashed #ccc" : "1px solid #eee" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: isVerborgen ? "#999" : "#1a1a2e" }}>{cleanTekst(s)}</div>
                            <div style={{ fontSize: 11, color: "#bbb" }}>{k.aantal}x{isVerborgen ? " — verborgen in dakkapelprijs" : extra > 0 ? " (incl. voorbereiding)" : ""}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700, color: isVerborgen ? "#bbb" : marges[key] ? RED : "#333" }}>{formatEur(pIncl)}</div>
                              <div style={{ fontSize: 10, color: "#bbb" }}>incl. BTW</div>
                            </div>
                            <button onClick={() => setMarges(m => ({ ...m, [key]: !m[key] }))} style={{ background: marges[key] ? RED : "#eee", color: marges[key] ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                              {marges[key] ? "Marge AAN" : "Marge UIT"}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* SUBTOTAAL VAN DEZE DAKKAPEL */}
                    <div style={{ padding: "10px 16px", background: "#f0f0f0", borderRadius: 10, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                      <span>Subtotaal {dakkapelNaamUI} incl. BTW</span><span>{formatEur(dt.subtotaal * 1.21)}</span>
                    </div>

                    {/* KLEUREN KOZIJNEN (RAL) */}
                    <div style={{ marginTop: 8, paddingTop: 14, borderTop: "2px dashed #eee" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999" }}>Kleuren kozijnen (RAL)</div>
                        {di > 0 && (
                          <button onClick={() => kopieerRal(di)} style={{ padding: "5px 10px", borderRadius: 6, border: "1.5px solid #dde", background: "white", color: "#555", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Kopieer van dakkapel 1</button>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {RAL_VELDEN.map(([veld, label]) => {
                          const val = (ral[di] || {})[veld] || "";
                          const hex = ralHex(val);
                          return (
                            <label key={veld} style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#666" }}>
                              {label}
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ width: 24, height: 24, borderRadius: 5, border: "1px solid #bbb", background: hex || "repeating-linear-gradient(45deg,#fafafa,#fafafa 4px,#eee 4px,#eee 8px)", flexShrink: 0 }} />
                                <input list="ral-opties" value={val} onChange={e => setRalVeld(di, veld, e.target.value)} placeholder="bijv. RAL 9001 Crème" style={{ flex: 1, minWidth: 0, padding: "7px 10px", border: "1.5px solid #dde", borderRadius: 8, fontSize: 13, outline: "none" }} />
                              </div>
                            </label>
                          );
                        })}
                      </div>
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>Leeg gelaten velden komen niet op de PDF.</div>
                    </div>

                    {/* FOTO'S DAKKAPEL */}
                    <div style={{ marginTop: 8, paddingTop: 14, borderTop: "2px dashed #eee" }}>
                      <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: 10 }}>Foto's dakkapel</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {[["voor", "Vooraanzicht"], ["zij", "Zijaanzicht"]].map(([k, label]) => (
                          <FotoVak key={k} label={label} src={(fotos[di] || {})[k]} onFile={file => setFoto(di, k, file)} onRemove={() => setFoto(di, k, null)} />
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>Zonder foto komt er een leeg kader op de PDF.</div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* GEDEELDE KOSTEN, ASBEST, AANPASSINGEN */}
            <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: RED, marginBottom: 4 }}>Gedeelde kosten</div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 16 }}>Deze posten horen niet bij één specifieke dakkapel en komen één keer op de offerte.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                {/* EXTRA POSTEN */}
                {extraPosten.map((k, i) => {
                  const s = k.omschrijving || "";
                  const isVerborgen = isInmeten(s) || isAfvoer(s);
                  const pIncl = pm(k.prijs_excl || 0, "extra_" + i) * 1.21;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: isVerborgen ? "#f5f5f5" : "#fafafa", borderRadius: 10, border: isVerborgen ? "1px dashed #ccc" : "1px solid #eee" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: isVerborgen ? "#999" : "#1a1a2e" }}>{cleanTekst(s)}</div>
                        <div style={{ fontSize: 11, color: "#bbb" }}>{k.aantal}x{isVerborgen ? " — verborgen in dakkapelprijs" : ""}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: isVerborgen ? "#bbb" : marges["extra_" + i] ? RED : "#333" }}>{formatEur(pIncl)}</div>
                          <div style={{ fontSize: 10, color: "#bbb" }}>incl. BTW</div>
                        </div>
                        <button onClick={() => setMarges(m => ({ ...m, ["extra_" + i]: !m["extra_" + i] }))} style={{ background: marges["extra_" + i] ? RED : "#eee", color: marges["extra_" + i] ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {marges["extra_" + i] ? "Marge AAN" : "Marge UIT"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                {/* ASBEST */}
                <div onClick={() => setAsbest(a => !a)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: asbest ? "#fff5f5" : "#fafafa", borderRadius: 10, border: asbest ? "1px solid #f5c6c6" : "1px solid #eee", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: asbest ? "2px solid " + RED : "2px solid #ccc", background: asbest ? RED : "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "white", fontWeight: 800, flexShrink: 0 }}>{asbest ? "v" : ""}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>Asbestinventarisatie</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>€ 495,00 incl. BTW — geen marge</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, color: asbest ? RED : "#aaa" }}>{asbest ? "€ 495,00" : "—"}</div>
                </div>

                {/* HANDMATIGE AANPASSINGEN */}
                <div style={{ borderTop: "2px dashed #eee", paddingTop: 14, marginTop: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: "#999", marginBottom: 10 }}>Handmatige aanpassingen</div>
                  {aanpassingen.map((a, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <input
                        value={a.omschrijving}
                        onChange={e => setAanpassingen(aa => aa.map((x, j) => j === i ? { ...x, omschrijving: e.target.value } : x))}
                        placeholder="Omschrijving..."
                        style={{ flex: 1, padding: "8px 10px", border: "1.5px solid #dde", borderRadius: 8, fontSize: 13, outline: "none" }}
                      />
                      <input
                        type="number"
                        value={a.bedrag}
                        onChange={e => setAanpassingen(aa => aa.map((x, j) => j === i ? { ...x, bedrag: e.target.value } : x))}
                        placeholder="€ bedrag"
                        style={{ width: 120, padding: "8px 10px", border: "1.5px solid #dde", borderRadius: 8, fontSize: 13, outline: "none", textAlign: "right", color: parseFloat(a.bedrag) < 0 ? "#2D6A4F" : parseFloat(a.bedrag) > 0 ? RED : "#333" }}
                      />
                      <button
                        onClick={() => setAanpassingen(aa => aa.map((x, j) => j === i ? { ...x, zichtbaar: !x.zichtbaar } : x))}
                        style={{ padding: "8px 12px", borderRadius: 8, border: a.zichtbaar ? "1.5px solid " + RED : "1.5px solid #dde", background: a.zichtbaar ? "#fff5f5" : "#f5f5f5", color: a.zichtbaar ? RED : "#aaa", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}
                      >
                        {a.zichtbaar ? "Op PDF" : "Verborgen"}
                      </button>
                      {aanpassingen.length > 1 && (
                        <button
                          onClick={() => setAanpassingen(aa => aa.filter((_, j) => j !== i))}
                          style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #dde", background: "white", color: "#aaa", fontSize: 14, cursor: "pointer", fontWeight: 700 }}
                        >✕</button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setAanpassingen(aa => [...aa, { omschrijving: "", bedrag: "", zichtbaar: true }])}
                    style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px dashed " + RED, background: "white", color: RED, fontSize: 12, fontWeight: 700, cursor: "pointer", marginTop: 4 }}
                  >+ Regel toevoegen</button>
                </div>
              </div>
            </div>

            {/* TOTAAL */}
            <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", borderTop: "3px solid " + RED }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", fontWeight: 800, fontSize: 18, color: RED }}>
                <span>Totaal incl. BTW</span><span>{formatEur(t.totaalAlles)}</span>
              </div>
            </div>

            <button onClick={printOfferte} style={{ background: RED, color: "white", border: "none", borderRadius: 12, padding: "16px", fontWeight: 800, fontSize: 16, cursor: "pointer", width: "100%", boxShadow: "0 4px 16px rgba(227,30,36,0.3)" }}>
              {documentType === "orderbevestiging" ? "Genereer Orderbevestiging PDF" : documentType === "inmeten" ? "Genereer Offerte na Inmeten PDF" : "Genereer Schipper Kozijnen Offerte PDF"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
