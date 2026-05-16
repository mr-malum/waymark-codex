/* =========================================================
   DECORATIVE LEFT PAGE MANUSCRIPT
   ========================================================= */

const CODEX_MANUSCRIPT_SEED = "kadesh-left-page-v1";

const CODEX_MANUSCRIPT_FRAGMENTS = [
  "KAD — VOR — EN",
  "THUR · ASH · REN",
  "VEL-KA / OM-NAR",
  "MIR · DOR · KESH",
  "ASHEN KADU VOR",
  "NAR ETH KESH VAR",
  "OMEN TAL · RUTH",
  "SAH VELIR · KAD",
  "DROM VEK · ARA",
  "TAL OTHEN MIR",
  "VORU KESH · NAI",
  "REN ASH · TAL VOR",
  "KETH AMAR · SOL",
  "UTH KAD · DORUM",
  "MIRAKH · VEL · THUR",
  "OSHEN VAR · KAD",
  "TALOS · DREN · MIR",
  "KA VEL · TOR · NAR",
  "SHEN UTH · ORO",
  "DOR KESH · VARUN",
  "KADESH · VEL · ASH",
  "NARU DROM · ETH",
  "MIREN · ARA · VOTH",
  "KOR TAL · VESH",
  "OM NAR · KADU",
  "VOR EN · MIR TAL",
  "DORUM · ASH REN",
  "THAL KESH · ORU",
  "VEL AN · DROM",
  "KAD VETH · SOR",
  "ARU NAI · KESH",
  "MIR VOR · ETH KAD"
];

const CODEX_MANUSCRIPT_MARKS = [
  "— — —     • • •     — —",
  "•  •  •      —      •  •",
  "- - -   ·   - - -   ·   -",
  "·  ·  ·     / / /     ·  ·",
  "—   ·   —   ·   —   ·   —",
  "/ / /     •     / / /",
  "• — • — • — • — •",
  "—     —     —     —",
  "· · ·     KAD     · · ·",
  "— —     VEL     — —",
  "• •     OM     • •"
];

function hashCodexManuscriptSeed(seed) {
  let hash = 2166136261;

  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createCodexManuscriptRng(seed) {
  let state = hashCodexManuscriptSeed(seed) || 1;

  return function nextRandom() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}

function pickCodexManuscriptItem(items, rng) {
  return items[Math.floor(rng() * items.length)] || items[0];
}

function getCodexManuscriptLineClass(rng) {
  const roll = rng();

  if (roll < 0.22) return "codex-manuscript-line codex-manuscript-line-short";
  if (roll < 0.48) return "codex-manuscript-line codex-manuscript-line-mid";
  if (roll < 0.68) return "codex-manuscript-line codex-manuscript-line-indent";
  return "codex-manuscript-line";
}

function renderCodexManuscriptBlock(rng, index) {
  const lineCount = 5 + Math.floor(rng() * 5);
  const lines = [];

  for (let i = 0; i < lineCount; i++) {
    const useMark = rng() < 0.28;
    const text = useMark
      ? pickCodexManuscriptItem(CODEX_MANUSCRIPT_MARKS, rng)
      : pickCodexManuscriptItem(CODEX_MANUSCRIPT_FRAGMENTS, rng);

    lines.push(`<span class="${getCodexManuscriptLineClass(rng)}">${escapeHtml(text)}</span>`);
  }

  if (index !== 0 && rng() < 0.75) {
    lines.unshift(`<span class="codex-manuscript-rule"></span>`);
  }

  return `<div class="codex-manuscript-block">${lines.join("")}</div>`;
}

function renderCodexLeftManuscript() {
  const root = document.getElementById("codex-left-manuscript");
  if (!root) return;

  const rng = createCodexManuscriptRng(CODEX_MANUSCRIPT_SEED);
  const blockCount = 7;
  const blocks = [];

  for (let i = 0; i < blockCount; i++) {
    blocks.push(renderCodexManuscriptBlock(rng, i));
  }

  root.innerHTML = blocks.join("");
}

window.renderCodexLeftManuscript = renderCodexLeftManuscript;

document.addEventListener("DOMContentLoaded", renderCodexLeftManuscript);
