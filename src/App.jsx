import { useState, useRef } from "react";

const RED = "#E31E24";
const DARKRED = "#B01419";

function cleanTekst(s) {
  if (!s) return "";
  return s
    .replace(/\(aangeleverd door Schipper Kozijnen\)/gi, "")
    .replace(/\(aangeleverd door derden\)/gi, "")
    .replace(/,\s*aangeleverd door Schipper Kozijnen/gi, "")
    .replace(/,\s*aangeleverd door derden/gi, "")
    .replace(/aangeleverd door Schipper Kozijnen/gi, "")
    .replace(/aangeleverd door derden/gi, "")
    .replace(/\s*rechts draaiend/gi, "")
    .replace(/\s*links draaiend/gi, "")
    .replace(/draaikiepraam rechts/gi, "Draaikiepraam")
    .replace(/draaikiepraam links/gi, "Draaikiepraam")
    .trim();
}

function isMontageKozijn(s) { return /montage kozijn/i.test(s); }
function isInmeten(s) { return /technisch inmeten/i.test(s); }
function isAfvoer(s) { return /afvoeren bouwafval/i.test(s); }
function isVoorbereidingRolluik(s) { return /voorbereiding rolluik|voorbereiding screen/i.test(s); }
function isRolluikOfScreen(s) { return /rolluik|zipscreen|screen|zonnescherm/i.test(s) && !/voorbereiding/i.test(s); }
function isTripleGlasNul(k) { return /triple glas|hr\+\+\+/i.test(k.omschrijving) && (k.totaal_excl === 0 || k.totaal_excl === "0" || Number(k.totaal_excl) === 0); }
function isVentilatierooster(s) { return /ventilatierooster/i.test(s); }

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
- De offerte is GERICHT AAN Schipper Kozijnen. Bovenaan staat "Schipper Kozijnen" en "T.a.v. Dhr. [naam]"
- adviseur_achternaam = de achternaam in "T.a.v. Dhr. [achternaam]" bovenaan (Schipper medewerker)
- adviseur_voornaam = de voornaam uit het emailadres bovenaan (bijv. "Thijs" uit "Thijs.Hager@schipperkozijnen.nl")
- adviseur_email = het schipperkozijnen.nl emailadres bovenaan
- adviseur_telefoon = het telefoonnummer bij het schipperkozijnen.nl emailadres
- NIET de Van Hattem verkoper gebruiken als adviseur
- dakkapel_prijs_excl = het grote bedrag bij de dakkapel (NOOIT 0)
- kostenposten = ALLE opties inclusief montage kozijn, voorbereiding rolluik, triple glas, inmeten. Bedragen EXACT overnemen.
- extra_posten = ALLE losse posten zoals transport, kraan, vergunning, brandstoftoeslag, technische tekening etc.
- Alle bedragen EXACT overnemen. NOOIT 0 tenzij prijs echt 0 is.

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
  "dakkapel_type": "",
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
  "zonwering": [
    {"kozijn": "Kozijn 1", "type": "Elektrisch rolluik", "kleur": "RAL 9016 Verkeerswit", "geleiders": "RAL 9016 Verkeerswit", "aansluiting": "Rechts"}
  ],
  "indeling": [
    {"type": "Raamkozijn", "breedte": "2181 mm", "inhoud": ["Draaikiepraam", "Insectenhor", "Vast glas"]},
    {"type": "Penant", "breedte": "430 mm", "inhoud": []},
    {"type": "Raamkozijn", "breedte": "2181 mm", "inhoud": ["Vast glas", "Draaikiepraam", "Insectenhor"]}
  ],
  "materialen": [
    {"onderdeel": "Zijwang", "materiaal": "VinyPlus rondkantdelen Horizontaal", "kleur": "RAL 9010 Zuiverwit"}
  ],
  "kostenposten": [
    {"omschrijving": "", "aantal": 1, "totaal_excl": 0}
  ],
  "extra_posten": [
    {"omschrijving": "", "aantal": 1, "prijs_excl": 0}
  ]
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
  const [kozijnenPost, setKozijnenPost] = useState("");
  const [kozijnenMarge, setKozijnenMarge] = useState(false);
  const [extraPosten, setExtraPosten] = useState([]);
  const [eigProjNr, setEigProjNr] = useState("");
  const [versie, setVersie] = useState("1");
  const [asbest, setAsbest] = useState(false);
  const [documentType, setDocumentType] = useState("offerte");
  const fileRef = useRef();

  const handlePDF = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
      const initMarges = {};
      if (data.kostenposten) data.kostenposten.forEach((_, i) => { initMarges["kost_" + i] = false; });
      if (data.extra_posten) data.extra_posten.forEach((_, i) => { initMarges["extra_" + i] = false; });
      initMarges["dakkapel"] = false;
      setMarges(initMarges);
      setExtraPosten(data.extra_posten || []);
      setEigProjNr(data.projectnummer || "");
      setVersie("1");
      setAsbest(false);
      setKozijnenPost("");
      setKozijnenMarge(false);
      setDocumentType("offerte");
      setStap("preview");
    } catch (err) {
      setError("Kon PDF niet lezen: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const prijs = (bedrag, margeKey) => marges[margeKey] ? bedrag * 1.2 : bedrag;

  // Kozijnen incl BTW — marge optioneel
  const kozijnenInclBTW = kozijnenMarge
    ? (parseFloat(kozijnenPost) || 0) * 1.2
    : (parseFloat(kozijnenPost) || 0);

  // Kozijnen omrekenen naar excl BTW voor optelling bij dakkapel
  const kozijnenExclBTW = kozijnenInclBTW / 1.21;

  const verwerkKosten = () => {
    if (!offerte) return { dakkapelExtraExcl: 0, zichtbarePosten: [], rolluikExtra: {} };
    let dakkapelExtraExcl = 0;
    const rolluikExtra = {};
    const zichtbarePosten = [];

    (offerte.kostenposten || []).forEach((k, i) => {
      const omschr = k.omschrijving || "";
      const p = prijs(k.totaal_excl || 0, "kost_" + i);
      if (isTripleGlasNul(k)) return;
      if (isVentilatierooster(omschr)) return;
      if (isMontageKozijn(omschr) || isInmeten(omschr) || isAfvoer(omschr)) {
        dakkapelExtraExcl += p;
        return;
      }
      if (isVoorbereidingRolluik(omschr)) {
        const rolluikIdx = (offerte.kostenposten || []).findIndex((r, j) => j !== i && isRolluikOfScreen(r.omschrijving || ""));
        if (rolluikIdx >= 0) {
          rolluikExtra[rolluikIdx] = (rolluikExtra[rolluikIdx] || 0) + p;
        } else {
          dakkapelExtraExcl += p;
        }
        return;
      }
      zichtbarePosten.push({ ...k, origIndex: i });
    });
    return { dakkapelExtraExcl, zichtbarePosten, rolluikExtra };
  };

  const berekenTotalen = () => {
    if (!offerte) return { dakkapelTotaalExcl: 0, subtotaal: 0, extraTotaal: 0, totaalExcl: 0, totaalIncl: 0, totaalAlles: 0 };
    const { dakkapelExtraExcl, zichtbarePosten, rolluikExtra } = verwerkKosten();
    const dakkapelBase = prijs(offerte.dakkapel_prijs_excl || 0, "dakkapel");
    // Kozijnen omgezet naar excl BTW worden opgeteld bij dakkapel
    const dakkapelTotaalExcl = dakkapelBase + dakkapelExtraExcl + kozijnenExclBTW;
    const kostenTotaal = zichtbarePosten.reduce((sum, k) => {
      const extra = rolluikExtra[k.origIndex] || 0;
      return sum + prijs(k.totaal_excl || 0, "kost_" + k.origIndex) + extra;
    }, 0);
    const subtotaal = dakkapelTotaalExcl + kostenTotaal;
    const extraTotaal = extraPosten.reduce((sum, k, i) => sum + prijs(k.prijs_excl || 0, "extra_" + i), 0);
    const totaalExcl = subtotaal + extraTotaal;
    const totaalIncl = totaalExcl * 1.21;
    const totaalAlles = totaalIncl + (asbest ? 495 : 0);
    return { dakkapelTotaalExcl, kostenTotaal, subtotaal, extraTotaal, totaalExcl, totaalIncl, totaalAlles };
  };
  const printOfferte = () => {
    const t = berekenTotalen();
    const o = offerte;
    const { zichtbarePosten, rolluikExtra } = verwerkKosten();
    const adviseurNaam = ((o.adviseur_voornaam || "") + " " + (o.adviseur_achternaam || "")).trim();
    const bxh = (o.dakkapel_breedte && o.dakkapel_hoogte) ? o.dakkapel_breedte + " mm x " + o.dakkapel_hoogte + " mm" : "";
    const bxhxd = (o.dakkapel_breedte && o.dakkapel_hoogte && o.dakkapel_diepte) ? o.dakkapel_breedte + " mm x " + o.dakkapel_hoogte + " mm x " + o.dakkapel_diepte + " mm" : bxh;
    const projNrTonen = eigProjNr || o.referentie || o.projectnummer || "";
    const docTitel = documentType === "orderbevestiging" ? "Orderbevestiging" : documentType === "inmeten" ? "Offerte na Inmeten" : "Dakkapel Specificatie";
    const docStempel = documentType === "orderbevestiging"
      ? "<div style='position:fixed;top:80px;right:30px;border:4px solid #E31E24;color:#E31E24;padding:12px 20px;font-size:18px;font-weight:800;transform:rotate(-15deg);opacity:0.6;border-radius:4px;pointer-events:none'>ORDERBEVESTIGING</div>"
      : documentType === "inmeten"
      ? "<div style='position:fixed;top:80px;right:30px;border:4px solid #E31E24;color:#E31E24;padding:12px 20px;font-size:16px;font-weight:800;transform:rotate(-15deg);opacity:0.6;border-radius:4px;pointer-events:none'>NA INMETEN</div>"
      : "";

    const kostenHTML = zichtbarePosten.map(k => {
      const extra = rolluikExtra[k.origIndex] || 0;
      const p = prijs(k.totaal_excl || 0, "kost_" + k.origIndex) + extra;
      const pIncl = p * 1.21;
      return "<tr><td style='padding:6px 10px'>- " + cleanTekst(k.omschrijving) + "</td><td style='text-align:right;padding:6px 10px'>" + k.aantal + "x</td><td style='text-align:right;padding:6px 10px'>" + formatEur(pIncl) + "</td></tr>";
    }).join("");

    const extraHTML = extraPosten.map((k, i) => {
      const p = prijs(k.prijs_excl || 0, "extra_" + i) * 1.21;
      return "<tr><td style='padding:6px 10px'><strong>" + cleanTekst(k.omschrijving) + "</strong></td><td style='text-align:right;padding:6px 10px'>" + k.aantal + "x</td><td style='text-align:right;padding:6px 10px'>" + formatEur(p) + "</td></tr>";
    }).join("");

    const asbestHTML = asbest ? "<tr><td style='padding:6px 10px'><strong>Asbestinventarisatie</strong></td><td style='text-align:right;padding:6px 10px'>1x</td><td style='text-align:right;padding:6px 10px'>€ 495,00</td></tr>" : "";

    const zonweringHTML = (o.zonwering || []).map(z =>
      "<p style='margin-bottom:8px'><strong style='font-size:11px'>" + cleanTekst(z.type) + " - " + z.kozijn + "</strong><br><em style='font-size:10px;color:#666'>Kleur: " + z.kleur + " | Kleur geleiders: " + z.geleiders + " | Aansluiting vanaf buitenzijde: " + z.aansluiting + "</em></p>"
    ).join("");

    const indelingHTML = (o.indeling || []).map(k => {
      const inhoudHTML = (k.inhoud || [])
        .filter(item => !isVentilatierooster(item))
        .map(item => "<div style='font-size:11px;color:#555;padding-left:6px;line-height:1.8'>- " + cleanTekst(item) + "</div>").join("");
      return "<div style='margin-bottom:16px;padding-bottom:50px;border-bottom:1px dashed #eee'><div style='display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px'><strong style='font-size:12px'>" + cleanTekst(k.type) + "</strong><strong style='font-size:12px'>" + k.breedte + "</strong></div>" + inhoudHTML + "</div>";
    }).join("");

    const materialenHTML = (o.materialen || []).map(m =>
      "<tr><td style='padding:4px 8px 4px 0;font-size:11px;width:30%;vertical-align:top'>" + m.onderdeel + "</td><td style='padding:4px 8px;font-size:11px;width:44%;vertical-align:top'>" + m.materiaal + "</td><td style='padding:4px 0;font-size:11px;width:26%;vertical-align:top'>" + m.kleur + "</td></tr>"
    ).join("");

    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>${docTitel} - ${projNrTonen} v${versie}</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;padding:36px 40px;font-size:12px;color:#1a1a2e;line-height:1.5}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.logo{height:48px}
.klantbox{font-size:12px;color:#333;line-height:1.8;margin-top:10px}
.header-right{text-align:right;font-size:12px;color:#555;line-height:1.8}
.projnr{font-size:14px;font-weight:800;color:#1a1a2e;display:block;margin-bottom:2px}
.versie{display:inline-block;background:#E31E24;color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;margin-left:6px}
.adviseur-label{font-size:9px;text-transform:uppercase;letter-spacing:0.08em;color:#E31E24;display:block;margin-top:6px;margin-bottom:2px}
.redline{height:3px;background:#E31E24;margin-bottom:16px}
.montage{background:#fff5f5;border-left:4px solid #E31E24;padding:10px 14px;margin-bottom:16px;border-radius:0 6px 6px 0}
.montage h3{font-size:9px;color:#E31E24;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px}
.dakbox{background:#f8f8f8;border:1px solid #eee;border-radius:6px;padding:12px 16px;margin-bottom:16px;overflow:hidden}
.dakbox h3{font-size:13px;font-weight:700;margin-bottom:3px}
.dakbox p{font-size:11px;color:#666;line-height:1.6}
.dakprijs{float:right;font-weight:700;font-size:13px}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
thead tr{background:#E31E24;color:white}
th{padding:7px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.06em}
tbody tr{border-bottom:1px solid #f0f0f0}
td{padding:6px 10px;font-size:12px}
.subtotaal-row td{font-weight:700;background:#f8f8f8;border-top:2px solid #eee;padding:8px 10px}
.totaal-tabel td{padding:7px 10px}
.totaal-row td{font-weight:800;font-size:15px;color:#E31E24;background:#fff5f5;border-top:2px solid #E31E24}
.info{font-size:10px;color:#888;border-top:1px solid #eee;padding-top:10px;line-height:1.6;margin-top:12px}
.bijlage{page-break-before:always;padding-top:24px}
.bij-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #E31E24;padding-bottom:8px;margin-bottom:16px}
.bij-header h2{font-size:13px;font-weight:800;color:#1a1a2e}
.bij-header img{height:34px}
.bij-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
.bij-label{font-size:9px;font-weight:800;color:#E31E24;text-transform:uppercase;letter-spacing:0.08em;margin:12px 0 4px;display:block}
.bij-specs{font-size:11px;color:#333;line-height:1.8}
.bij-specs strong{font-weight:600}
.mat-table{width:100%;border-collapse:collapse;table-layout:fixed}
.foto-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:8px 0 0;page-break-inside:avoid}
.foto-box{border:2px dashed #ddd;border-radius:6px;height:200px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:11px;background:#fafafa;text-align:center}
.av-intro{font-size:10px;color:#444;line-height:1.8;margin-bottom:10px}
.av-title{font-size:10px;font-weight:700;color:#1a1a2e;margin:8px 0 2px}
.av-text{font-size:10px;color:#555;line-height:1.7;margin-bottom:4px}
@media print{body{padding:20px}.bijlage{page-break-before:always}}
</style></head><body>${docStempel}`);

    win.document.write(`<div class="header">
<div>
  <img src="https://subsidie-adviseur.vercel.app/images.png" class="logo" />
  <div class="klantbox">
    <strong>${docTitel}</strong><br>
    T.a.v. ${o.montage_naam || ""}<br>
    ${o.montage_adres || ""}<br>
    ${o.montage_postcode_stad || ""}
  </div>
</div>
<div class="header-right">
  <span class="projnr">Projectnummer: ${projNrTonen}<span class="versie">v${versie}</span></span>
  Datum: ${o.datum || ""}
  <span class="adviseur-label">Uw adviseur bij Schipper Kozijnen:</span>
  <strong>${adviseurNaam}</strong><br>
  ${o.adviseur_email || ""}<br>
  ${o.adviseur_telefoon || ""}
</div></div>`);

    win.document.write(`<div class="redline"></div>`);
    win.document.write(`<div class="montage"><h3>Montage adres</h3>${o.montage_naam || ""}<br>${o.montage_adres || ""}<br>${o.montage_postcode_stad || ""}</div>`);
    win.document.write(`<div class="dakbox"><span class="dakprijs">${formatEur(t.dakkapelTotaalExcl * 1.21)}&nbsp;&nbsp;1x&nbsp;&nbsp;${formatEur(t.dakkapelTotaalExcl * 1.21)}</span><h3>${cleanTekst((o.dakkapel_type || "SK Dakkapel").replace(/VH/g,"SK").replace(/Van Hattem/g,"Schipper"))}</h3><p>Uitvoering: ${o.dakkapel_uitvoering || ""}<br>Afmetingen (BxH): ${bxh}<br>Hellingshoek: ${o.dakkapel_hellingshoek || ""}<br>Extra woonoppervlakte: ${o.dakkapel_woonoppervlakte || ""}</p></div>`);
    win.document.write(`<table><thead><tr><th>Opties en overige</th><th style="text-align:right">Aantal</th><th style="text-align:right">Prijs incl. BTW</th></tr></thead><tbody>${kostenHTML}<tr class="subtotaal-row"><td colspan="2"><strong>Subtotaal</strong></td><td style="text-align:right;padding:8px 10px"><strong>${formatEur(t.subtotaal * 1.21)}</strong></td></tr></tbody></table>`);
    win.document.write(`<table><tbody>${extraHTML}${asbestHTML}</tbody></table>`);
    win.document.write(`<table class="totaal-tabel"><tbody><tr class="totaal-row"><td><strong>Totaal incl. BTW</strong></td><td style="text-align:right"><strong>${formatEur(t.totaalAlles)}</strong></td></tr></tbody></table>`);
    win.document.write(`<div class="info">Dakkapel wordt zonder binnen afwerking, casco opgeleverd.<br>Eventuele zonnepanelen dienen verwijderd te zijn voor plaatsing dakkapel(len).<br>Alle genoemde prijzen zijn inclusief 21% BTW.</div>`);

    win.document.write(`<div class="bijlage">
<div class="bij-header">
  <h2>Bijlage A: Toelichting Dakkapel achterzijde</h2>
  <img src="https://subsidie-adviseur.vercel.app/images.png" />
</div>
<div class="bij-grid">
<div>
  <span class="bij-label">Schipper Dakkapel</span>
  <div class="bij-specs">
    <p>Een kwaliteitsproduct naar uw wens samengesteld.</p>
    <p style="margin-top:6px">
      <strong>Uitstraling:</strong> ${o.dakkapel_uitvoering || ""}<br>
      <strong>Afmetingen (BxHxD):</strong> ${bxhxd}<br>
      <strong>Inzakmaat (incl. 10mm speling):</strong> ${o.dakkapel_inzakmaat || ""}<br>
      <strong>Hellingshoek:</strong> ${o.dakkapel_hellingshoek || ""}<br>
      <strong>Positie op de woning:</strong> achterzijde<br>
      <strong>Vergunningsplichtig:</strong> Nee<br>
      <strong>Extra woonoppervlakte:</strong> ${o.dakkapel_woonoppervlakte || ""}<br>
      <strong>Overstek boei voorkant:</strong> ${o.dakkapel_overstek_voorkant || "260 mm"}<br>
      <strong>Overstek boei zijkant:</strong> ${o.dakkapel_overstek_zijkant || "150 mm"}
    </p>
  </div>
  <span class="bij-label">Zonwering</span>
  <p style="font-size:10px;color:#444;margin-bottom:4px">De volgende zonwering is gekozen voor de dakkapel.</p>
  ${zonweringHTML}
  <span class="bij-label">Materialen</span>
  <p style="font-size:10px;color:#444;margin-bottom:4px">De volgende materialen gaan wij gebruiken voor de dakkapel</p>
  <table class="mat-table"><tbody>${materialenHTML}</tbody></table>
</div>
<div>
  <span class="bij-label">Indeling</span>
  <p style="font-size:10px;color:#444;margin-bottom:4px">De volgende indeling is gekozen voor de dakkapel, van buitenaf gezien, van links naar rechts</p>
  <p style="font-size:10px;color:#888;font-style:italic;margin-bottom:10px">Zie kozijn omschrijving voor verdere specificaties per kozijn.</p>
  ${indelingHTML}
</div>
</div>
<span class="bij-label">Impressie dakkapel</span>
<p style="font-size:10px;color:#888;margin-bottom:6px">De afbeeldingen zijn een impressie van de dakkapel en kunnen afwijken van de werkelijkheid.</p>
<div class="foto-grid">
  <div class="foto-box">Foto voorzijde<br>hier invoegen</div>
  <div class="foto-box">Foto zijaanzicht<br>hier invoegen</div>
</div></div>`);

    win.document.write(`<div class="bijlage">
<div class="bij-header">
  <h2>Bijlage B: Algemene voorwaarden</h2>
  <img src="https://subsidie-adviseur.vercel.app/images.png" />
</div>
<div class="av-intro">Schipper dakkapellen bouwt zijn kapellen volgens hoge kwaliteitsnormen: Uitsluitend A-merken van Nederlands fabricaat - Balken in het dak geplaatst om de 30 cm, hoogste norm - Isolatiewaarde van Rc 6,3 in het dak en Rc 4,7 in de zijwangen - EPDM dakbedekking - Kozijnen zijn rondom vleugel en kozijn doorboord voor staalbevestiging - Standaard HR++ glas - Kunststof kozijnen en draaikiepramen, naar binnen draaiend, met Politie keurmerk. Naast kwaliteit en uitstraling hechten wij vooral veel waarde aan goede service en snelle levertijden. Onze dakkapellen worden geheel volgens uw wens prefab geproduceerd en daarmee bent u verzekerd van een hoogwaardig kwaliteitsproduct. Voorafgaand aan de productie en plaatsing komt onze specialist alles ter plekke technisch inmeten.</div>
<div class="av-title">Goede voorbereiding:</div>
<div class="av-text">Een goede voorbereiding is heel belangrijk en voorkomt verrassingen achteraf. Graag informeren wij u over belangrijke aandachtspunten en voorwaarden.</div>
<div class="av-title">Vergunning dakkapel:</div>
<div class="av-text">Schipper kan u ondersteunen met het aanvragen van uw vergunning. Wij verzorgen dan de benodigde bouwkundige tekeningen en vragen de vergunning voor u aan. Vanuit uw gemeente ontvangt u legeskosten voor het behandelen van uw omgevingsvergunning. Ook kan uw gemeente om aanvullende constructie berekeningen vragen. De legeskosten en de kosten van de eventuele constructie berekening zijn geen onderdeel van de vergunning aanvraag, omdat deze per situatie verschillen. Helaas hebben wij geen invloed en inzage in de voortgang van uw gemeente.</div>
<div class="av-title">Kraan gerelateerde vergunningen en maatregelen:</div>
<div class="av-text">I.v.m. de veiligheid en bereikbaarheid tijdens het plaatsen van de dakkapellen d.m.v. een hijskraan moeten we in de meeste situaties de gemeente op de hoogte brengen d.m.v. een melding of soms een vergunning. In enkele gevallen moet het kraanbedrijf dit doen. Het kraanbedrijf neemt afhankelijk van de situatie verkeersmaatregelen omdat deze essentieel zijn voor een ongestoorde en veilige uitvoering van de werkzaamheden. Deze externe kosten worden na plaatsing aan u doorberekend.</div>
<div class="av-title">Asbest:</div>
<div class="av-text">Wanneer er sprake is van asbest dan dient u dit voor het plaatsen van de dakkapel(len) te verwijderen. Wij kunnen dit voor u verzorgen als dit gewenst is. Wanneer wij op de plaatsingsdatum niet kunnen plaatsen door asbest worden de kosten van de kraan en de montage ploeg aan u doorberekend. Uw makelaar of koopcontract kan u hierin helderheid verschaffen.</div>
<div class="av-title">Oplevering:</div>
<div class="av-text">Uw dakkapel wordt geleverd en geplaatst onder voorbehoud van de weersomstandigheden op een nader te bepalen datum. Uw dakkapel wordt casco (zonder binnenafwerking) opgeleverd en elektra zult u zelf (of een installateur) moeten aansluiten.</div>
<div class="av-title">Garantie:</div>
<div class="av-text">Niet overdraagbaar aan nieuwe bewoners. Op rolluiken en raamdecoratie 2 jaar. Op de dakkapel, kozijnen, dakbedekking en buiten afwerking 10 jaar. Onze partners: www.kkfh.nl, www.mawipex.com, www.somfy.com, www.milin.nl.</div>
<div class="av-title">Afmeting dakkapel:</div>
<div class="av-text">Schipper Kozijnen is niet verantwoordelijk voor de afmetingen wanneer u dit in eigen beheer uitvoert. Graag overleggen we hoe de inmeting gedaan wordt om fouten te voorkomen.</div>
<div class="av-title">Keurmerk:</div>
<div class="av-text">Zekerheid voor u. Onze werkzaamheden worden uitgevoerd door gecertificeerde vakmensen. Wij voeren het KOMO-Dakkapellen certificaat, het kwaliteitskeurmerk voor dakkapellen. Wij zijn ook aangesloten bij de VLOK (www.vlok-erkend.nl), de brancheorganisatie van en voor het klussenbedrijf.</div>
<div class="av-title">Betalingsvoorwaarden:</div>
<div class="av-text">50% bij het geven van de opdracht en 50% na oplevering. Bij het ondertekenen van de overeenkomst gaat u akkoord met de benoemde aandachtspunten en voorwaarden.</div>
</div>`);

    win.document.write("</body></html>");
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const t = berekenTotalen();
  const { zichtbarePosten, rolluikExtra } = verwerkKosten();
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
          <div style={{ background: "white", borderRadius: 16, padding: "48px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.08)", borderTop: "4px solid " + RED }}>
            <img src="https://subsidie-adviseur.vercel.app/images.png" alt="Schipper Kozijnen" style={{ height: 60, marginBottom: 24 }} />
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8, color: RED }}>Van Hattem Offerte Uploaden</h2>
            <p style={{ color: "#888", fontSize: 14, marginBottom: 32 }}>Upload de PDF van Van Hattem en wij zetten hem automatisch om naar een Schipper Kozijnen offerte</p>
            {error && <div style={{ background: "#fff0f0", border: "1px solid #f5c6c6", borderRadius: 10, padding: "12px 18px", color: "#c0392b", fontSize: 13, marginBottom: 20 }}>{error}</div>}
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <div style={{ width: 48, height: 48, border: "4px solid " + RED, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                <div style={{ color: RED, fontWeight: 600 }}>PDF wordt gelezen door AI...</div>
                <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
              </div>
            ) : (
              <div onClick={() => fileRef.current.click()} style={{ border: "3px dashed " + RED, borderRadius: 12, padding: "40px", cursor: "pointer", background: "#fff5f5" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
                <div style={{ fontWeight: 700, fontSize: 16, color: RED, marginBottom: 6 }}>Klik om PDF te uploaden</div>
                <div style={{ fontSize: 13, color: "#aaa" }}>Van Hattem offerte (PDF)</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={handlePDF} />
          </div>
        )}

        {stap === "preview" && offerte && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                  <input value={eigProjNr} onChange={e => setEigProjNr(e.target.value)} placeholder="bijv. 2026-001" style={{ padding: "8px 12px", border: "2px solid " + RED, borderRadius: 8, fontSize: 14, fontWeight: 600, outline: "none", width: 200 }} />
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

            <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: RED, marginBottom: 8 }}>Prijzen en Marge</div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 16 }}>Alle prijzen incl. BTW voor klant. Marge (x1,2) aan of uit per post.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fff5f5", borderRadius: 10, border: "1px solid #f5c6c6" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{cleanTekst((offerte.dakkapel_type || "SK Dakkapel").replace(/VH/g, "SK"))}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>Dakkapel incl. kozijnen, montage, inmeten en afvoeren</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 700, color: RED }}>{formatEur(t.dakkapelTotaalExcl * 1.21)}</div>
                      <div style={{ fontSize: 10, color: "#aaa" }}>incl. BTW</div>
                    </div>
                    <button onClick={() => setMarges(m => ({ ...m, dakkapel: !m.dakkapel }))} style={{ background: marges["dakkapel"] ? RED : "#eee", color: marges["dakkapel"] ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {marges["dakkapel"] ? "Marge AAN" : "Marge UIT"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f0fff4", borderRadius: 10, border: "1px solid #a8e6c0" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Schipper Kozijnen kozijnen</div>
                    <div style={{ fontSize: 11, color: "#888" }}>Incl. BTW — verwerkt in dakkapel prijs</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, color: "#2D6A4F", fontWeight: 700 }}>€</span>
                      <input type="number" min="0" value={kozijnenPost} onChange={e => setKozijnenPost(e.target.value)} placeholder="0.00" style={{ width: 90, padding: "5px 8px", border: "1.5px solid #2D6A4F", borderRadius: 6, fontSize: 13, textAlign: "right", outline: "none" }} />
                    </div>
                    <button onClick={() => setKozijnenMarge(m => !m)} style={{ background: kozijnenMarge ? RED : "#eee", color: kozijnenMarge ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {kozijnenMarge ? "Marge AAN" : "Marge UIT"}
                    </button>
                  </div>
                </div>

                {zichtbarePosten.map(k => {
                  const extra = rolluikExtra[k.origIndex] || 0;
                  const pExcl = prijs(k.totaal_excl || 0, "kost_" + k.origIndex) + extra;
                  const pIncl = pExcl * 1.21;
                  return (
                    <div key={k.origIndex} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#fafafa", borderRadius: 10, border: "1px solid #eee" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{cleanTekst(k.omschrijving)}</div>
                        <div style={{ fontSize: 11, color: "#aaa" }}>{k.aantal}x{extra > 0 ? " (incl. voorbereiding)" : ""}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, color: marges["kost_" + k.origIndex] ? RED : "#333" }}>{formatEur(pIncl)}</div>
                          <div style={{ fontSize: 10, color: "#aaa" }}>incl. BTW</div>
                        </div>
                        <button onClick={() => setMarges(m => ({ ...m, ["kost_" + k.origIndex]: !m["kost_" + k.origIndex] }))} style={{ background: marges["kost_" + k.origIndex] ? RED : "#eee", color: marges["kost_" + k.origIndex] ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {marges["kost_" + k.origIndex] ? "Marge AAN" : "Marge UIT"}
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div style={{ padding: "10px 16px", background: "#f0f0f0", borderRadius: 10, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                  <span>Subtotaal incl. BTW</span><span>{formatEur(t.subtotaal * 1.21)}</span>
                </div>

                {extraPosten.map((k, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#fafafa", borderRadius: 10, border: "1px solid #eee" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{cleanTekst(k.omschrijving)}</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{k.aantal}x</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700, color: marges["extra_" + i] ? RED : "#333" }}>{formatEur(prijs(k.prijs_excl, "extra_" + i) * 1.21)}</div>
                        <div style={{ fontSize: 10, color: "#aaa" }}>incl. BTW</div>
                      </div>
                      <button onClick={() => setMarges(m => ({ ...m, ["extra_" + i]: !m["extra_" + i] }))} style={{ background: marges["extra_" + i] ? RED : "#eee", color: marges["extra_" + i] ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {marges["extra_" + i] ? "Marge AAN" : "Marge UIT"}
                      </button>
                    </div>
                  </div>
                ))}

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
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", borderTop: "3px solid " + RED }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: RED, marginBottom: 16 }}>Totaaloverzicht</div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "2px solid " + RED, fontWeight: 800, fontSize: 18, color: RED }}>
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
