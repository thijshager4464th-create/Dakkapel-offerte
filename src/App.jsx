import { useState, useRef } from "react";

const RED = "#E31E24";
const DARKRED = "#B01419";

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
            text: `Lees deze Van Hattem dakkapel offerte zorgvuldig en geef ALLEEN een JSON object terug zonder uitleg of markdown.

BELANGRIJK:
- adviseur_naam is de naam na "T.a.v." bovenaan (Schipper Kozijnen medewerker). NIET Tiemen Bennink.
- adviseur_email en adviseur_telefoon zijn de contactgegevens van diezelfde Schipper persoon bovenaan.
- montage is het montage adres.
- dakkapel_prijs_excl is het grote bedrag bij de dakkapel (rond 8000-15000 euro). NOOIT 0.
- kostenposten zijn ALLEEN de opties zoals penant, rolluik, insectenhor etc. met EXACTE bedragen.
- extra_posten zijn ALLEEN losse posten zoals afvoeren bouwafval, transport, kraan, inmeten.
- bijlage_materialen: geef alle materiaalregels als losse array van objecten met onderdeel/materiaal/kleur.
- bijlage_indeling: geef de indeling per kozijn met maten als tekst.
- bijlage_zonwering: geef alle zonwering details als tekst.
- Alle bedragen EXACT overnemen zoals in de offerte. NOOIT 0 tenzij prijs echt 0 is.

{
  "projectnummer": "",
  "referentie": "",
  "datum": "",
  "adviseur_naam": "",
  "adviseur_email": "",
  "adviseur_telefoon": "",
  "montage_naam": "",
  "montage_adres": "",
  "montage_postcode_stad": "",
  "dakkapel_type": "",
  "dakkapel_uitvoering": "",
  "dakkapel_afmetingen_bxh": "",
  "dakkapel_afmetingen_bxhxd": "",
  "dakkapel_inzakmaat": "",
  "dakkapel_hellingshoek": "",
  "dakkapel_positie": "",
  "dakkapel_vergunning": "",
  "dakkapel_woonoppervlakte": "",
  "dakkapel_overstek_voorkant": "",
  "dakkapel_overstek_zijkant": "",
  "dakkapel_prijs_excl": 0,
  "bijlage_zonwering": "",
  "bijlage_indeling": "",
  "bijlage_materialen": [
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
  const [extraPosten, setExtraPosten] = useState([]);
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
      initMarges["kozijnen"] = false;
      setMarges(initMarges);
      setExtraPosten(data.extra_posten || []);
      setStap("preview");
    } catch (err) {
      setError("Kon PDF niet lezen: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const prijs = (bedrag, margeKey) => marges[margeKey] ? bedrag * 1.2 : bedrag;

  const berekenTotalen = () => {
    if (!offerte) return { subtotaal: 0, extraTotaal: 0, totaalExcl: 0, btw: 0, totaalIncl: 0 };
    const dakkapel = prijs(offerte.dakkapel_prijs_excl || 0, "dakkapel");
    const kozijnen = prijs(parseFloat(kozijnenPost) || 0, "kozijnen");
    const kostenposten = (offerte.kostenposten || []).reduce((sum, k, i) => sum + prijs(k.totaal_excl || 0, "kost_" + i), 0);
    const subtotaal = dakkapel + kozijnen + kostenposten;
    const extraTotaal = extraPosten.reduce((sum, k, i) => sum + prijs(k.prijs_excl || 0, "extra_" + i), 0);
    const totaalExcl = subtotaal + extraTotaal;
    const btw = totaalExcl * 0.21;
    const totaalIncl = totaalExcl * 1.21;
    return { dakkapel, kozijnen, subtotaal, extraTotaal, totaalExcl, btw, totaalIncl };
  };
  const printOfferte = () => {
    const t = berekenTotalen();
    const kostenHTML = (offerte.kostenposten || []).map((k, i) => {
      const p = prijs(k.totaal_excl || 0, "kost_" + i);
      return "<tr><td>- " + k.omschrijving + "</td><td style='text-align:right'>" + k.aantal + "x</td><td style='text-align:right'>" + formatEur(p) + "</td></tr>";
    }).join("");
    const extraHTML = extraPosten.map((k, i) => {
      const p = prijs(k.prijs_excl || 0, "extra_" + i);
      return "<tr><td><strong>" + k.omschrijving + "</strong></td><td style='text-align:right'>" + k.aantal + "x</td><td style='text-align:right'>" + formatEur(p) + "</td></tr>";
    }).join("");
    const kozijnenHTML = kozijnenPost ? "<tr><td>- Schipper Kozijnen kozijnen</td><td style='text-align:right'>1x</td><td style='text-align:right'>" + formatEur(t.kozijnen) + "</td></tr>" : "";
    const materialenHTML = Array.isArray(offerte.bijlage_materialen) ? offerte.bijlage_materialen.map(m => "<tr><td style='padding:4px 0;font-size:11px'>" + (m.onderdeel || "") + "</td><td style='padding:4px 8px;font-size:11px'>" + (m.materiaal || "") + "</td><td style='padding:4px 0;font-size:11px'>" + (m.kleur || "") + "</td></tr>").join("") : "<tr><td>" + (offerte.bijlage_materialen || "") + "</td></tr>";

    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html lang="nl"><head><meta charset="UTF-8"><title>Dakkapel Specificatie - ${offerte.referentie || offerte.projectnummer}</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',sans-serif;padding:40px;font-size:13px;color:#1a1a2e}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
.logo{height:52px}
.klantbox{font-size:12px;color:#333;line-height:1.8;margin-top:10px}
.header-right{text-align:right;font-size:12px;color:#555;line-height:1.8}
.projnr{font-size:15px;font-weight:800;color:#1a1a2e;display:block;margin-bottom:4px}
.adviseur-label{font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:#E31E24;display:block;margin-top:8px;margin-bottom:2px}
.redline{height:4px;background:#E31E24;margin-bottom:20px}
.montage{background:#fff5f5;border-left:4px solid #E31E24;padding:12px 16px;margin-bottom:20px;border-radius:0 8px 8px 0}
.montage h3{font-size:10px;color:#E31E24;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px}
.dakbox{background:#f8f8f8;border:1px solid #eee;border-radius:8px;padding:16px 20px;margin-bottom:20px;overflow:hidden}
.dakbox h3{font-size:14px;font-weight:700;margin-bottom:4px}
.dakbox p{font-size:12px;color:#666;line-height:1.7}
.dakprijs{float:right;font-weight:700;font-size:14px}
table{width:100%;border-collapse:collapse;margin-bottom:16px}
thead tr{background:#E31E24;color:white}
th{padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em}
tbody tr{border-bottom:1px solid #f0f0f0}
td{padding:7px 12px;font-size:13px}
.subtotaal-row td{font-weight:700;background:#f8f8f8;border-top:2px solid #eee;padding:10px 12px}
.totaal-tabel td{padding:8px 12px}
.totaal-row td{font-weight:800;font-size:15px;color:#E31E24;background:#fff5f5;border-top:2px solid #E31E24}
.info{font-size:11px;color:#888;border-top:1px solid #eee;padding-top:12px;line-height:1.7;margin-top:16px}
.bijlage{page-break-before:always;padding-top:20px}
.bij-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #E31E24;padding-bottom:8px;margin-bottom:20px}
.bij-header h2{font-size:15px;font-weight:800;color:#1a1a2e}
.bij-header img{height:40px}
.bijlage-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-bottom:20px}
.bij-label{font-size:10px;font-weight:700;color:#E31E24;text-transform:uppercase;letter-spacing:0.08em;margin:12px 0 4px;display:block}
.bij-tekst{font-size:12px;color:#333;line-height:1.8}
.bij-tekst strong{font-weight:600}
.mat-tabel{width:100%;border-collapse:collapse;margin-top:4px}
.mat-tabel td{padding:3px 0;font-size:11px;color:#333;vertical-align:top}
.foto-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0 24px}
.foto-placeholder{border:2px dashed #ddd;border-radius:6px;height:220px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:12px;background:#fafafa;text-align:center}
.av-tekst{font-size:11px;color:#444;line-height:1.9;margin-bottom:10px}
.av-title{font-size:11px;font-weight:700;color:#1a1a2e;margin:12px 0 2px}
@media print{body{padding:20px}.bijlage{page-break-before:always}}
</style></head><body>`);

    win.document.write(`<div class="header">
<div>
  <img src="https://subsidie-adviseur.vercel.app/images.png" class="logo" alt="Schipper Kozijnen" />
  <div class="klantbox">
    <strong>Dakkapel Specificatie</strong><br>
    T.a.v. ${offerte.montage_naam || ""}<br>
    ${offerte.montage_adres || ""}<br>
    ${offerte.montage_postcode_stad || ""}
  </div>
</div>
<div class="header-right">
  <span class="projnr">Projectnummer: ${offerte.referentie || offerte.projectnummer || ""}</span>
  Datum: ${offerte.datum || ""}
  <span class="adviseur-label">Uw adviseur bij Schipper Kozijnen:</span>
  <strong>${offerte.adviseur_naam || ""}</strong><br>
  ${offerte.adviseur_email || ""}<br>
  ${offerte.adviseur_telefoon || ""}
</div></div>`);

    win.document.write(`<div class="redline"></div>`);
    win.document.write(`<div class="montage"><h3>Montage adres</h3>${offerte.montage_naam || ""}<br>${offerte.montage_adres || ""}<br>${offerte.montage_postcode_stad || ""}</div>`);
    win.document.write(`<div class="dakbox"><span class="dakprijs">${formatEur(t.dakkapel)}&nbsp;&nbsp;1x&nbsp;&nbsp;${formatEur(t.dakkapel)}</span><h3>${(offerte.dakkapel_type || "SK Dakkapel").replace(/VH/g,"SK").replace(/Van Hattem/g,"Schipper")}</h3><p>Uitvoering: ${offerte.dakkapel_uitvoering || ""}<br>Afmetingen (BxH): ${offerte.dakkapel_afmetingen_bxh || ""}<br>Hellingshoek: ${offerte.dakkapel_hellingshoek || ""}<br>Extra woonoppervlakte: ${offerte.dakkapel_woonoppervlakte || ""}</p></div>`);
    win.document.write(`<table><thead><tr><th>Opties en overige</th><th style="text-align:right">Aantal</th><th style="text-align:right">Prijs</th></tr></thead><tbody>${kostenHTML}${kozijnenHTML}<tr class="subtotaal-row"><td colspan="2"><strong>Subtotaal</strong></td><td style="text-align:right"><strong>${formatEur(t.subtotaal)}</strong></td></tr></tbody></table>`);
    win.document.write(`<table><tbody>${extraHTML}</tbody></table>`);
    win.document.write(`<table class="totaal-tabel"><tbody><tr><td>Totaal excl. BTW</td><td style="text-align:right;font-weight:700;color:#E31E24">${formatEur(t.totaalExcl)}</td></tr><tr><td>21% BTW</td><td style="text-align:right">${formatEur(t.btw)}</td></tr><tr class="totaal-row"><td><strong>Totaal incl. BTW</strong></td><td style="text-align:right"><strong>${formatEur(t.totaalIncl)}</strong></td></tr></tbody></table>`);
    win.document.write(`<div class="info">Dakkapel wordt zonder binnen afwerking, casco opgeleverd.<br>Eventuele zonnepanelen dienen verwijderd te zijn voor plaatsing dakkapel(len).</div>`);

    win.document.write(`<div class="bijlage">
<div class="bij-header">
  <h2>Bijlage A: Toelichting Dakkapel achterzijde</h2>
  <img src="https://subsidie-adviseur.vercel.app/images.png" alt="Schipper Kozijnen" />
</div>
<div class="bijlage-grid">
<div>
  <span class="bij-label">Schipper Dakkapel</span>
  <div class="bij-tekst">Een kwaliteitsproduct naar uw wens samengesteld.</div>
  <div class="bij-tekst" style="margin-top:8px">
    <strong>Uitstraling:</strong> ${offerte.dakkapel_uitvoering || ""}<br>
    <strong>Afmetingen (BxHxD):</strong> ${offerte.dakkapel_afmetingen_bxhxd || offerte.dakkapel_afmetingen_bxh || ""}<br>
    <strong>Inzakmaat (inclusief 10mm speling):</strong> ${offerte.dakkapel_inzakmaat || ""}<br>
    <strong>Hellingshoek:</strong> ${offerte.dakkapel_hellingshoek || ""}<br>
    <strong>Positie op de woning:</strong> ${offerte.dakkapel_positie || "achterzijde"}<br>
    <strong>Vergunningsplichtig:</strong> ${offerte.dakkapel_vergunning || "Nee"}<br>
    <strong>Extra woonoppervlakte:</strong> ${offerte.dakkapel_woonoppervlakte || ""}<br>
    <strong>Overstek boei voorkant:</strong> ${offerte.dakkapel_overstek_voorkant || ""}<br>
    <strong>Overstek boei zijkant:</strong> ${offerte.dakkapel_overstek_zijkant || ""}
  </div>
  ${offerte.bijlage_zonwering ? '<span class="bij-label">Zonwering</span><div class="bij-tekst">' + offerte.bijlage_zonwering + "</div>" : ""}
  <span class="bij-label">Materialen</span>
  <div class="bij-tekst">De volgende materialen gaan wij gebruiken voor de dakkapel</div>
  <table class="mat-tabel"><tbody>${materialenHTML}</tbody></table>
</div>
<div>
  <span class="bij-label">Indeling</span>
  <div class="bij-tekst">De volgende indeling is gekozen voor de dakkapel, van buitenaf gezien, van links naar rechts</div>
  <div class="bij-tekst" style="margin-top:8px;white-space:pre-line">${offerte.bijlage_indeling || ""}</div>
</div>
</div>
<span class="bij-label">Impressie dakkapel</span>
<div class="bij-tekst" style="margin-bottom:8px">De afbeeldingen zijn een impressie van de dakkapel en kunnen afwijken van de werkelijkheid.</div>
<div class="foto-grid">
  <div class="foto-placeholder">Foto voorzijde<br>hier invoegen</div>
  <div class="foto-placeholder">Foto zijaanzicht<br>hier invoegen</div>
</div></div>`);

    win.document.write(`<div class="bijlage">
<div class="bij-header">
  <h2>Bijlage B: Algemene voorwaarden</h2>
  <img src="https://subsidie-adviseur.vercel.app/images.png" alt="Schipper Kozijnen" />
</div>
<div class="av-tekst">Schipper dakkapellen bouwt zijn kapellen volgens hoge kwaliteitsnormen: Uitsluitend A-merken van Nederlands fabricaat - Balken in het dak geplaatst om de 30 cm, hoogste norm - Isolatiewaarde van Rc 6,3 in het dak en Rc 4,7 in de zijwangen - EPDM dakbedekking - Kozijnen zijn rondom vleugel en kozijn doorboord voor staalbevestiging - Standaard HR++ glas - Kunststof kozijnen en draaikiepramen, naar binnen draaiend, met Politie keurmerk. Naast kwaliteit en uitstraling hechten wij vooral veel waarde aan goede service en snelle levertijden. Onze dakkapellen worden geheel volgens uw wens prefab geproduceerd en daarmee bent u verzekerd van een hoogwaardig kwaliteitsproduct. Voorafgaand aan de productie en plaatsing komt onze specialist alles ter plekke technisch inmeten.</div>
<div class="av-title">Goede voorbereiding:</div>
<div class="av-tekst">Een goede voorbereiding is heel belangrijk en voorkomt verrassingen achteraf. Graag informeren wij u over belangrijke aandachtspunten en voorwaarden.</div>
<div class="av-title">Vergunning dakkapel:</div>
<div class="av-tekst">Schipper kan u ondersteunen met het aanvragen van uw vergunning. Wij verzorgen dan de benodigde bouwkundige tekeningen en vragen de vergunning voor u aan. Vanuit uw gemeente ontvangt u legeskosten voor het behandelen van uw omgevingsvergunning. Ook kan uw gemeente om aanvullende constructie berekeningen vragen. De legeskosten en de kosten van de eventuele constructie berekening zijn geen onderdeel van de vergunning aanvraag, omdat deze per situatie verschillen. Helaas hebben wij geen invloed en inzage in de voortgang van uw gemeente.</div>
<div class="av-title">Kraan gerelateerde vergunningen en maatregelen:</div>
<div class="av-tekst">I.v.m. de veiligheid en bereikbaarheid tijdens het plaatsen van de dakkapellen d.m.v. een hijskraan moeten we in de meeste situaties de gemeente op de hoogte brengen d.m.v. een melding of soms een vergunning. In enkele gevallen moet het kraanbedrijf dit doen. Het kraanbedrijf neemt afhankelijk van de situatie verkeersmaatregelen omdat deze essentieel zijn voor een ongestoorde en veilige uitvoering van de werkzaamheden. Deze externe kosten worden na plaatsing aan u doorberekend.</div>
<div class="av-title">Asbest:</div>
<div class="av-tekst">Wanneer er sprake is van asbest dan dient u dit voor het plaatsen van de dakkapel(len) te verwijderen. Wij kunnen dit voor u verzorgen als dit gewenst is. Wanneer wij op de plaatsingsdatum niet kunnen plaatsen door asbest worden de kosten van de kraan en de montage ploeg aan u doorberekend. Uw makelaar of koopcontract kan u hierin helderheid verschaffen.</div>
<div class="av-title">Oplevering:</div>
<div class="av-tekst">Uw dakkapel wordt geleverd en geplaatst onder voorbehoud van de weersomstandigheden op een nader te bepalen datum. Uw dakkapel wordt casco (zonder binnenafwerking) opgeleverd en elektra zult u zelf (of een installateur) moeten aansluiten.</div>
<div class="av-title">Garantie:</div>
<div class="av-tekst">Niet overdraagbaar aan nieuwe bewoners. Op rolluiken en raamdecoratie 2 jaar. Op de dakkapel, kozijnen, dakbedekking en buiten afwerking 10 jaar. Onze partners: www.kkfh.nl, www.mawipex.com, www.somfy.com, www.milin.nl.</div>
<div class="av-title">Afmeting dakkapel:</div>
<div class="av-tekst">Schipper Kozijnen is niet verantwoordelijk voor de afmetingen wanneer u dit in eigen beheer uitvoert. Graag overleggen we hoe de inmeting gedaan wordt om fouten te voorkomen.</div>
<div class="av-title">Keurmerk:</div>
<div class="av-tekst">Zekerheid voor u. Onze werkzaamheden worden uitgevoerd door gecertificeerde vakmensen. Wij voeren het KOMO-Dakkapellen certificaat, het kwaliteitskeurmerk voor dakkapellen. Wij zijn ook aangesloten bij de VLOK (www.vlok-erkend.nl), de brancheorganisatie van en voor het klussenbedrijf.</div>
<div class="av-title">Betalingsvoorwaarden:</div>
<div class="av-tekst">50% bij het geven van de opdracht en 50% na oplevering. Bij het ondertekenen van de overeenkomst gaat u akkoord met de benoemde aandachtspunten en voorwaarden.</div>
</div>`);

    win.document.write("</body></html>");
    win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const t = berekenTotalen();
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: 13 }}>
                {[["Klant", offerte.montage_naam], ["Adres", offerte.montage_adres + " " + offerte.montage_postcode_stad], ["Project", offerte.referentie || offerte.projectnummer], ["Datum", offerte.datum], ["Adviseur Schipper", offerte.adviseur_naam], ["Type", (offerte.dakkapel_type || "").replace(/VH/g, "SK")]].map(([label, val]) => (
                  <div key={label}><span style={{ fontSize: 10, color: "#888", textTransform: "uppercase", display: "block", marginBottom: 2 }}>{label}</span><strong>{val}</strong></div>
                ))}
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: RED, marginBottom: 8 }}>Prijzen en Marge</div>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 16 }}>Schakel marge (x1,2) aan of uit per post. BTW (21%) wordt automatisch berekend.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#fff5f5", borderRadius: 10, border: "1px solid #f5c6c6" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{(offerte.dakkapel_type || "SK Dakkapel").replace(/VH/g, "SK")}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>Dakkapel basisprijs</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: "#aaa", textDecoration: marges["dakkapel"] ? "line-through" : "none" }}>{formatEur(offerte.dakkapel_prijs_excl)}</div>
                      <div style={{ fontWeight: 700, color: RED }}>{formatEur(prijs(offerte.dakkapel_prijs_excl, "dakkapel"))}</div>
                    </div>
                    <button onClick={() => setMarges(m => ({ ...m, dakkapel: !m.dakkapel }))} style={{ background: marges["dakkapel"] ? RED : "#eee", color: marges["dakkapel"] ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {marges["dakkapel"] ? "Marge AAN" : "Marge UIT"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#f0fff4", borderRadius: 10, border: "1px solid #a8e6c0" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>Schipper Kozijnen kozijnen</div>
                    <div style={{ fontSize: 11, color: "#888" }}>Eigen kostenpost toevoegen</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, color: "#2D6A4F", fontWeight: 700 }}>€</span>
                      <input type="number" min="0" value={kozijnenPost} onChange={e => setKozijnenPost(e.target.value)} placeholder="0.00" style={{ width: 90, padding: "5px 8px", border: "1.5px solid #2D6A4F", borderRadius: 6, fontSize: 13, textAlign: "right", outline: "none" }} />
                    </div>
                    <button onClick={() => setMarges(m => ({ ...m, kozijnen: !m.kozijnen }))} style={{ background: marges["kozijnen"] ? RED : "#eee", color: marges["kozijnen"] ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                      {marges["kozijnen"] ? "Marge AAN" : "Marge UIT"}
                    </button>
                  </div>
                </div>

                {(offerte.kostenposten || []).map((k, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#fafafa", borderRadius: 10, border: "1px solid #eee" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{k.omschrijving}</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{k.aantal}x</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "#aaa", textDecoration: marges["kost_" + i] ? "line-through" : "none" }}>{formatEur(k.totaal_excl)}</div>
                        <div style={{ fontWeight: 700, color: marges["kost_" + i] ? RED : "#333" }}>{formatEur(prijs(k.totaal_excl, "kost_" + i))}</div>
                      </div>
                      <button onClick={() => setMarges(m => ({ ...m, ["kost_" + i]: !m["kost_" + i] }))} style={{ background: marges["kost_" + i] ? RED : "#eee", color: marges["kost_" + i] ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {marges["kost_" + i] ? "Marge AAN" : "Marge UIT"}
                      </button>
                    </div>
                  </div>
                ))}

                <div style={{ padding: "10px 16px", background: "#f0f0f0", borderRadius: 10, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>
                  <span>Subtotaal</span><span>{formatEur(t.subtotaal)}</span>
                </div>

                {extraPosten.map((k, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#fafafa", borderRadius: 10, border: "1px solid #eee" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{k.omschrijving}</div>
                      <div style={{ fontSize: 11, color: "#aaa" }}>{k.aantal}x</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 11, color: "#aaa", textDecoration: marges["extra_" + i] ? "line-through" : "none" }}>{formatEur(k.prijs_excl)}</div>
                        <div style={{ fontWeight: 700, color: marges["extra_" + i] ? RED : "#333" }}>{formatEur(prijs(k.prijs_excl, "extra_" + i))}</div>
                      </div>
                      <button onClick={() => setMarges(m => ({ ...m, ["extra_" + i]: !m["extra_" + i] }))} style={{ background: marges["extra_" + i] ? RED : "#eee", color: marges["extra_" + i] ? "white" : "#666", border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                        {marges["extra_" + i] ? "Marge AAN" : "Marge UIT"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "white", borderRadius: 12, padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", borderTop: "3px solid " + RED }}>
              <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", color: RED, marginBottom: 16 }}>Totaaloverzicht</div>
              {[["Totaal excl. BTW", formatEur(t.totaalExcl), false], ["21% BTW", formatEur(t.btw), false], ["Totaal incl. BTW", formatEur(t.totaalIncl), true]].map(([label, val, bold]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0", fontWeight: bold ? 800 : 400, fontSize: bold ? 16 : 14, color: bold ? RED : "#333" }}>
                  <span>{label}</span><span>{val}</span>
                </div>
              ))}
            </div>

            <button onClick={printOfferte} style={{ background: RED, color: "white", border: "none", borderRadius: 12, padding: "16px", fontWeight: 800, fontSize: 16, cursor: "pointer", width: "100%", boxShadow: "0 4px 16px rgba(227,30,36,0.3)" }}>
              Genereer Schipper Kozijnen Offerte PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
                                                       }
