/* Dictionario Neolatino — sharing.
 *
 * "Compartire": the word's link (phones: the share sheet; computers: copied).
 * "Compartire como imàgine": a 1080 px PNG of the translations, the conjugation
 * or the intelligibility statistics, with the word, the site and a QR code.
 * Ported from the Interslavic hub (renderShareImage.ts), restyled for Neolatino.
 */
(function () {
  "use strict";

  const NL = window.NL;
  if (!NL) return;
  const { hooks, esc } = NL;
  const t = (key, ...args) => {
    const value = NL.t(key);
    return typeof value === "function" ? value(...args) : value ?? key;
  };

  NL.addStrings({
    nl: {
      share: "Compartire", shareImage: "Compartire como imàgine", download: "Descarrecare",
      copyImage: "Copiare la imàgine", imageCopied: "Imàgine copiata", close: "Clàudere",
      imageFailed: "Non se ha potuto generare la imàgine.", linkCopied: "Legàmine copiato",
      lang: "Lengua", word: "Paraula",
    },
    en: {
      share: "Share", shareImage: "Share as image", download: "Download",
      copyImage: "Copy image", imageCopied: "Image copied", close: "Close",
      imageFailed: "The image couldn't be made.", linkCopied: "Link copied",
      lang: "Language", word: "Word",
    },
  });

  const shareUrl = (entry) => `${location.origin}${location.pathname}#/word/${encodeURIComponent(entry.id)}`;
  const isTouch = () => { try { return matchMedia("(pointer: coarse)").matches; } catch { return false; } };
  const toast = (m) => (NL.community ? NL.community.toast(m) : alert(m));
  const copyText = async (text) => {
    if (NL.community) return NL.community.copyText(text);
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  };

  /* ── link ──────────────────────────────────────────────────── */
  hooks.entryActions.push((entry) =>
    `<button type="button" class="action-button" data-share-link="${esc(entry.id)}" title="${esc(t("share"))}">` +
    `<span class="action-button__icon">${NL.ICONS.share}</span><span class="action-button__label">${esc(t("share"))}</span></button>`);

  async function shareLink(entry) {
    const url = shareUrl(entry);
    if (isTouch() && navigator.share) {
      try {
        await navigator.share({ title: `${entry.v[0]} — Dictionario Neolatino`, url });
        return;
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
    }
    if (await copyText(url)) toast(t("linkCopied"));
  }

  /* ── "share as image" under translations, conjugation, statistics ── */
  for (const kind of ["tr", "cj", "st"]) {
    (hooks.panelFooters[kind] = hooks.panelFooters[kind] || []).push((entry) =>
      `<button type="button" class="share-image-button" data-share-image="${kind}" data-word="${esc(entry.id)}">${NL.ICONS.image}${esc(t("shareImage"))}</button>`);
  }

  document.addEventListener("click", (ev) => {
    const link = ev.target.closest("[data-share-link]");
    if (link) {
      const entry = NL.D.byId.get(link.dataset.shareLink);
      if (entry) shareLink(entry);
      return;
    }
    const image = ev.target.closest("[data-share-image]");
    if (image) {
      const entry = NL.D.byId.get(image.dataset.word);
      if (entry) openImageDialog(image.dataset.shareImage, entry);
    }
  });

  /* ── what goes on the picture ──────────────────────────────── */
  const cell = (text, extra = {}) => ({ text: String(text ?? ""), ...extra });

  function specFor(kind, entry) {
    const theme = NL.themeText(entry);
    const spec = {
      kind,
      title: entry.v[0],
      subtitle: [entry.cat, theme].filter(Boolean).join("   ·   "),
      tabLabel: kind === "tr" ? t("translations") : kind === "cj" ? t("conjugation") : t("intelligibility"),
      url: shareUrl(entry),
      fileName: `${entry.v[0].normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "paraula"}-${kind}.png`,
      blocks: [],
    };
    if (kind === "tr") {
      const rows = NL.LANGS.map((l, i) => (i && entry.v[i] ? [cell(l[NL.ui()], { label: true }), cell(entry.v[i])] : null)).filter(Boolean);
      spec.blocks.push({ kind: "table", rows: [[cell(t("lang"), { head: true }), cell(t("word"), { head: true })], ...rows], wrap: true });
    }
    if (kind === "cj") {
      const c = NLConj.conjugate(entry.v[0]);
      const tb = NLConj.table(c.forms);
      const S = NL.t("nonfinite");
      const moods = NL.t("moods");
      const tenses = NL.t("tenses");
      spec.blocks.push({ kind: "table", wrap: true, rows: [
        [cell(S.inf, { label: true }), cell(tb.infinitive)],
        [cell(S.ger, { label: true }), cell(tb.gerund)],
        [cell(S.pp, { label: true }), cell(tb.presentParticiple)],
        [cell(S.pa, { label: true }), cell(tb.pastParticiple)],
      ] });
      const byMood = {};
      tb.sections.forEach((sec) => (byMood[sec.mood] = byMood[sec.mood] || []).push(sec));
      for (const [mood, secs] of Object.entries(byMood)) {
        const persons = mood === "imperativo" ? NLConj.IMP_PERSONS : NLConj.PERSONS;
        const header = mood === "imperativo" ? null : [cell("", { head: true }), ...secs.map((sec) => cell(tenses[sec.key], { head: true }))];
        const rows = persons.map((p, i) => [cell(p, { label: true }), ...secs.map((sec) => cell(sec.forms[i]))]);
        spec.blocks.push({ kind: "heading", text: moods[mood] });
        spec.blocks.push({ kind: "table", wrap: true, rows: header ? [header, ...rows] : rows });
      }
      spec.legend = c.source === "official" ? [] : [c.source === "derived" ? NL.t("srcDerived")(c.base) : NL.t("srcRegular")];
    }
    return spec;
  }

  const VOTE_HEX = { understand: "#008300", context: "#1baf7a", nonNative: "#2a78d6", unknown: "#8a9099", falseFriend: "#eda100", notUnderstand: "#e34948" };
  const within = (promise, ms) => Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);

  /** Votes and comment count — whatever arrives within a few seconds. */
  async function loadCommunity(spec, entry) {
    const C = NL.community;
    if (!C || !C.state.available) return null;
    const [stats, count] = await Promise.allSettled([
      within(C.api("community/intelligibility", { params: { id: entry.id } }), 6000),
      within(C.api("community/comments", { params: { id: entry.id, count: "1" } }), 6000),
    ]);
    if (stats.status !== "fulfilled") return null;
    const s = stats.value;
    const segments = (counts) => C.VOTES.map((v) => ({ label: C.voteLabel(v), color: VOTE_HEX[v], count: (counts || {})[v] || 0 }));
    return {
      title: t("intelligibility"),
      votesLabel: `${t("statsVotes")}: ${s.total}`,
      total: s.total,
      segments: segments(s.counts),
      emptyLabel: t("statsEmpty"),
      countsLine: [
        count.status === "fulfilled" ? `💬 ${t("comments")}: ${count.value.count}` : "",
        `🔎 ${t("statsLookups")}: ${s.lookups || 0}`,
      ].filter(Boolean).join("     "),
      detailed: spec.kind === "st" ? {
        byLangTitle: t("statsByNative"),
        byLang: Object.entries(s.byLang || {}).sort((a, b) => b[1].total - a[1].total)
          .map(([lang, g]) => ({ label: C.langName(lang), total: g.total, segments: segments(g.counts) })),
      } : null,
    };
  }

  /* ── drawing ───────────────────────────────────────────────── */
  const W = 1080;
  const PAD = 56;
  const CARD_PAD = 44;
  const INNER = W - PAD * 2 - CARD_PAD * 2;
  const MAX_HEIGHT = 15000; // iOS refuses canvases above ~16.7 megapixels
  const COL = {
    bgTop: "#ece8ee", bgBottom: "#f6f4f7", card: "#ffffff", shadow: "rgba(31, 26, 36, 0.13)",
    text: "#1f1a24", muted: "#57505e", dim: "#8a8291", rubric: "#a3142b", head: "#f5dfe3", headText: "#7c1022",
    label: "#f6f3f7", border: "#ddd6e0", rule: "#e6e0e9", track: "#ebe6ee",
  };
  // the site's own font stack (as in the Interslavic dictionary's share pictures)
  const STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif';
  const SERIF = STACK;
  const SANS = STACK;
  const DISPLAY = STACK;
  const font = (size, weight = 400, family = SERIF) => `${weight} ${size}px ${family}`;

  function breakable(text) {
    const parts = [];
    let current = "";
    for (const ch of text) {
      current += ch;
      if (" ,/-".includes(ch)) { parts.push(current); current = ""; }
    }
    if (current) parts.push(current);
    return parts;
  }
  function hardBreak(ctx, text, width) {
    const lines = [];
    let line = "";
    for (const ch of text) {
      if (line && ctx.measureText(line + ch).width > width) { lines.push(line); line = ch; } else line += ch;
    }
    return [...lines, line];
  }
  function wrap(ctx, text, width) {
    const lines = [];
    for (const paragraph of String(text).split("\n")) {
      let line = "";
      for (const piece of breakable(paragraph)) {
        const candidate = line + piece;
        if (line && ctx.measureText(candidate.trimEnd()).width > width) { lines.push(line.trimEnd()); line = piece.trimStart(); } else line = candidate;
      }
      lines.push(line.trimEnd());
    }
    return lines.flatMap((l) => (ctx.measureText(l).width > width ? hardBreak(ctx, l, width) : [l]));
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  const cellFont = (c, size) => (c.head ? font(size * 0.8, 700, SANS) : c.label ? font(size * 0.8, 500, SANS) : font(size, 500, SERIF));
  const metrics = (size) => ({ padX: Math.round(size * 0.55), padY: Math.round(size * 0.34), lineHeight: Math.round(size * 1.28) });

  /** Column widths, row heights and wrapped lines for one table at one font size. */
  function layoutTable(ctx, rows, size, allowWrap) {
    const cols = Math.max(...rows.map((r) => r.length));
    const { padX, padY, lineHeight } = metrics(size);
    const max = new Array(cols).fill(0);
    const min = new Array(cols).fill(0);
    rows.forEach((r) => r.forEach((c, i) => {
      ctx.font = cellFont(c, size);
      const full = Math.max(0, ...c.text.split("\n").map((p) => ctx.measureText(p).width)) + padX * 2;
      const piece = Math.max(0, ...breakable(c.text.replace(/\n/g, " ")).map((p) => ctx.measureText(p.trim()).width)) + padX * 2;
      max[i] = Math.max(max[i], full);
      // row labels (persons, language names) stay on one line; values may wrap
      min[i] = Math.max(min[i], allowWrap && !c.label && !c.head ? piece : full);
    }));
    const totalMax = max.reduce((a, b) => a + b, 0);
    const totalMin = min.reduce((a, b) => a + b, 0);
    let widths;
    if (totalMax <= INNER) widths = max.map((w) => w + ((INNER - totalMax) * w) / (totalMax || 1));
    else if (totalMin <= INNER) {
      const flex = max.map((w, i) => w - min[i]);
      const totalFlex = flex.reduce((a, b) => a + b, 0) || 1;
      widths = min.map((w, i) => w + ((INNER - totalMin) * flex[i]) / totalFlex);
    } else widths = min.map((w) => (w * INNER) / totalMin);
    const lines = rows.map((r) => r.map((c, i) => {
      ctx.font = cellFont(c, size);
      return c.text ? wrap(ctx, c.text, widths[i] - padX * 2) : [];
    }));
    const heights = lines.map((r) => Math.max(1, ...r.map((l) => l.length)) * lineHeight + padY * 2);
    return { rows, widths, heights, lines, size, height: heights.reduce((a, b) => a + b, 0), fits: allowWrap ? totalMin <= INNER : totalMax <= INNER };
  }
  /** One font size for every table of the picture: the largest that fits. */
  function layoutTables(ctx, blocks) {
    const tables = blocks.filter((b) => b.kind === "table");
    for (const size of [34, 32, 30, 28, 26, 24, 22]) {
      const layouts = tables.map((b) => layoutTable(ctx, b.rows, size, b.wrap));
      if (layouts.every((l) => l.fits)) return new Map(tables.map((b, i) => [b, layouts[i]]));
    }
    return new Map(tables.map((b) => [b, layoutTable(ctx, b.rows, 22, true)]));
  }
  function drawTable(ctx, layout, x0, y0) {
    const { widths, heights, rows, lines, size } = layout;
    const { padX, lineHeight } = metrics(size);
    ctx.save();
    roundRect(ctx, x0, y0, INNER, layout.height, 16);
    ctx.clip();
    let y = y0;
    rows.forEach((r, ri) => {
      let x = x0;
      r.forEach((c, ci) => {
        const w = widths[ci], h = heights[ri];
        ctx.fillStyle = c.head ? COL.head : c.label ? COL.label : COL.card;
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = COL.border;
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        const cl = lines[ri][ci];
        ctx.font = cellFont(c, size);
        ctx.fillStyle = c.head ? COL.headText : c.label ? COL.muted : COL.text;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        const top = y + (h - cl.length * lineHeight) / 2;
        cl.forEach((line, i) => ctx.fillText(line, x + padX, top + lineHeight * (i + 0.5)));
        x += w;
      });
      y += heights[ri];
    });
    ctx.restore();
    ctx.strokeStyle = COL.border;
    ctx.lineWidth = 2;
    roundRect(ctx, x0, y0, INNER, layout.height, 16);
    ctx.stroke();
  }

  function fit(ctx, text, width) {
    if (ctx.measureText(text).width <= width) return text;
    let cut = text;
    while (cut.length > 1 && ctx.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1);
    return `${cut.trimEnd()}…`;
  }
  function stackedBar(ctx, x, y, width, height, total, segments) {
    const present = segments.filter((s) => s.count > 0);
    ctx.save();
    roundRect(ctx, x, y, width, height, height / 2);
    ctx.clip();
    ctx.fillStyle = COL.track;
    ctx.fillRect(x, y, width, height);
    let at = x;
    present.forEach((s, i) => {
      const part = i === present.length - 1 ? x + width - at : Math.round((s.count / (total || 1)) * width);
      ctx.fillStyle = s.color;
      ctx.fillRect(at, y, part, height);
      at += part;
    });
    ctx.restore();
  }

  /** Intelligibility: a bar, a legend, and (on the statistics picture) a bar per native language. */
  function layoutCommunity(ctx, cm) {
    const detailed = cm.detailed;
    const BAR = detailed ? 34 : 28;
    const LEGEND_LH = detailed ? 46 : 36;
    const LANG_LH = 46;
    const NAME_W = 260;
    const TOTAL_W = 70;
    const present = cm.segments.filter((s) => s.count > 0);
    const percent = (n) => Math.round((n / (cm.total || 1)) * 100);
    ctx.font = font(24, 500, SANS);
    const items = present.map((s) => ({ ...s, text: `${s.label} ${percent(s.count)}%`, width: 24 + ctx.measureText(`${s.label} ${percent(s.count)}%`).width }));
    const flow = [[]];
    let used = 0;
    for (const item of items) {
      if (used && used + item.width > INNER) { flow.push([]); used = 0; }
      flow[flow.length - 1].push(item);
      used += item.width + 28;
    }
    const legendH = !cm.total ? LEGEND_LH : detailed ? Math.ceil(present.length / 2) * LEGEND_LH : flow.length * LEGEND_LH;
    const langs = (detailed && detailed.byLang) || [];
    const langsH = langs.length ? 30 + 38 + langs.length * LANG_LH : 0;
    const height = 2 + 28 + 42 + BAR + 16 + legendH + langsH + (cm.countsLine ? 18 + 40 : 0);

    function draw(c, x, top) {
      let y = top;
      c.fillStyle = COL.rule;
      c.fillRect(x, y, INNER, 2);
      y += 30;
      c.textBaseline = "middle";
      c.textAlign = "left";
      c.font = font(32, 700, SERIF);
      c.fillStyle = COL.rubric;
      c.fillText(cm.title, x, y + 16);
      c.textAlign = "right";
      c.font = font(26, 600, SANS);
      c.fillStyle = COL.muted;
      c.fillText(cm.votesLabel, x + INNER, y + 16);
      y += 42;
      stackedBar(c, x, y, INNER, BAR, cm.total, present);
      y += BAR + 16;
      c.textAlign = "left";
      if (!cm.total) {
        c.font = font(24, 500, SANS);
        c.fillStyle = COL.muted;
        c.fillText(cm.emptyLabel, x, y + LEGEND_LH / 2);
        y += LEGEND_LH;
      } else if (detailed) {
        const colW = (INNER - 40) / 2;
        present.forEach((s, i) => {
          const lx = x + (i % 2) * (colW + 40);
          const ly = y + Math.floor(i / 2) * LEGEND_LH + LEGEND_LH / 2;
          const p = `${percent(s.count)}%`;
          const n = String(s.count);
          c.fillStyle = s.color;
          c.beginPath(); c.arc(lx + 9, ly, 9, 0, Math.PI * 2); c.fill();
          c.textAlign = "right";
          c.font = font(23, 500, SANS);
          c.fillStyle = COL.muted;
          c.fillText(p, lx + colW, ly);
          const pW = Math.max(c.measureText("100%").width, c.measureText(p).width);
          c.font = font(25, 700, SANS);
          c.fillStyle = COL.text;
          c.fillText(n, lx + colW - pW - 12, ly);
          const nW = c.measureText(n).width;
          c.textAlign = "left";
          c.font = font(24, 500, SANS);
          c.fillText(fit(c, s.label, colW - 30 - pW - nW - 30), lx + 28, ly);
        });
        y += legendH;
      } else {
        c.font = font(24, 500, SANS);
        flow.forEach((row) => {
          let lx = x;
          row.forEach((item) => {
            c.fillStyle = item.color;
            c.beginPath(); c.arc(lx + 8, y + LEGEND_LH / 2, 8, 0, Math.PI * 2); c.fill();
            c.fillStyle = COL.text;
            c.fillText(item.text, lx + 24, y + LEGEND_LH / 2);
            lx += item.width + 28;
          });
          y += LEGEND_LH;
        });
      }
      if (langs.length) {
        y += 30;
        c.textAlign = "left";
        c.font = font(22, 700, SANS);
        c.fillStyle = COL.muted;
        c.fillText(detailed.byLangTitle, x, y + 16);
        y += 38;
        const barX = x + NAME_W + 16;
        const barW = INNER - NAME_W - 16 - TOTAL_W - 16;
        langs.forEach((lang) => {
          const ly = y + LANG_LH / 2;
          c.textAlign = "left";
          c.font = font(25, 600, SERIF);
          c.fillStyle = COL.text;
          c.fillText(fit(c, lang.label, NAME_W), x, ly);
          stackedBar(c, barX, ly - 9, barW, 18, lang.total, lang.segments);
          c.textAlign = "right";
          c.font = font(24, 600, SANS);
          c.fillStyle = COL.muted;
          c.fillText(String(lang.total), x + INNER, ly);
          y += LANG_LH;
        });
      }
      if (cm.countsLine) {
        y += 18;
        c.textAlign = "left";
        c.font = font(27, 600, SANS);
        c.fillStyle = COL.text;
        c.fillText(cm.countsLine, x, y + 20);
      }
    }
    return { height, draw };
  }

  function drawQr(ctx, url, x, y, size) {
    ctx.fillStyle = COL.card;
    roundRect(ctx, x, y, size, size, 18);
    ctx.fill();
    if (!window.qrcode) return;
    const qr = window.qrcode(0, "M");
    qr.addData(url);
    qr.make();
    const count = qr.getModuleCount();
    const quiet = 2;
    const unit = Math.floor(size / (count + quiet * 2));
    const drawn = unit * (count + quiet * 2);
    const ox = x + Math.floor((size - drawn) / 2) + unit * quiet;
    const oy = y + Math.floor((size - drawn) / 2) + unit * quiet;
    ctx.fillStyle = COL.text;
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) ctx.fillRect(ox + c * unit, oy + r * unit, unit, unit);
  }

  function loadScript(src) {
    return new Promise((resolve) => {
      if (window.qrcode) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => resolve(); // no QR code then — the link is still printed
      document.head.appendChild(s);
    });
  }

  async function renderImage(spec) {
    const sample = "Àà Èè Éé Íí Òò Óó Úú Îî Çç ăâțș";
    await Promise.all([
      loadScript("vendor/qrcode.js"),
      document.fonts ? Promise.all([
        document.fonts.load(font(64, 700, SERIF), sample), document.fonts.load(font(30, 500, SERIF), sample),
        document.fonts.load(font(26, 500, SANS), sample), document.fonts.load(font(26, 700, SANS), sample),
        document.fonts.load(font(52, 400, DISPLAY), "Neolatino"),
      ]).catch(() => {}) : null,
    ]);

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = 10;

    /* measure */
    const LOGO = 100;
    let titleSize = 72;
    ctx.font = font(titleSize, 700, SERIF);
    while (titleSize > 44 && ctx.measureText(spec.title).width > INNER) { titleSize -= 2; ctx.font = font(titleSize, 700, SERIF); }
    const titleLines = wrap(ctx, spec.title, INNER);
    const titleLH = Math.round(titleSize * 1.15);
    ctx.font = font(30, 400, SERIF);
    const subtitleLines = spec.subtitle ? wrap(ctx, spec.subtitle, INNER) : [];
    const tables = layoutTables(ctx, spec.blocks);
    ctx.font = font(24, 400, SANS);
    const legendLines = (spec.legend || []).flatMap((l) => wrap(ctx, l, INNER));

    let cardH = CARD_PAD + titleLines.length * titleLH;
    if (subtitleLines.length) cardH += 8 + subtitleLines.length * 40;
    cardH += 30;
    const GAP = 26;
    spec.blocks.forEach((b, i) => {
      if (i) cardH += GAP;
      cardH += b.kind === "heading" ? 44 : tables.get(b).height;
    });
    if (legendLines.length) cardH += 22 + legendLines.length * 32;
    const community = spec.community ? layoutCommunity(ctx, spec.community) : null;
    const communityGap = spec.blocks.length ? 30 : 0;
    if (community) cardH += communityGap + community.height;
    cardH += CARD_PAD;

    const QR = 196;
    const site = (location.host ? location.host + location.pathname.replace(/\/(index\.html)?$/, "") : "Dictionario Neolatino");
    const displayUrl = spec.url.replace(/^https?:\/\//, "");
    ctx.font = font(27, 500, SANS);
    const urlLines = wrap(ctx, displayUrl, W - PAD * 2 - QR - 40);
    const footerH = Math.max(QR, urlLines.length * 38);
    const cardY = PAD + LOGO + 36;
    const footerY = cardY + cardH + 36;
    const height = footerY + footerH + PAD;

    /* draw */
    const scale = height > MAX_HEIGHT ? MAX_HEIGHT / height : 1;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(height * scale);
    ctx.scale(scale, scale);
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, COL.bgTop);
    bg.addColorStop(1, COL.bgBottom);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, height);

    // header: the "N" mark, the wordmark, the tab name
    ctx.fillStyle = COL.rubric;
    roundRect(ctx, PAD, PAD, LOGO, LOGO, 20);
    ctx.fill();
    ctx.fillStyle = "#f3f1f4";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font(64, 700, SERIF);
    ctx.fillText("N", PAD + LOGO / 2, PAD + LOGO / 2 + 4);
    const textX = PAD + LOGO + 24;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.font = font(50, 400, DISPLAY);
    ctx.fillStyle = COL.rubric;
    ctx.fillText("Neolatino", textX, PAD + 56);
    ctx.font = font(20, 600, SANS);
    ctx.fillStyle = COL.muted;
    const caps = "DICTIONARIO";
    let lx = textX + 2;
    for (const ch of caps) { ctx.fillText(ch, lx, PAD + 90); lx += ctx.measureText(ch).width + 9; }
    ctx.font = font(28, 700, SANS);
    const pillW = ctx.measureText(spec.tabLabel).width + 44;
    const pillH = 56;
    if (W - PAD - pillW > textX + 300) {
      ctx.fillStyle = COL.rubric;
      roundRect(ctx, W - PAD - pillW, PAD + (LOGO - pillH) / 2, pillW, pillH, pillH / 2);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(spec.tabLabel, W - PAD - pillW / 2, PAD + LOGO / 2 + 1);
    }

    // card
    ctx.save();
    ctx.shadowColor = COL.shadow;
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = COL.card;
    roundRect(ctx, PAD, cardY, W - PAD * 2, cardH, 30);
    ctx.fill();
    ctx.restore();

    const left = PAD + CARD_PAD;
    let y = cardY + CARD_PAD;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = font(titleSize, 700, SERIF);
    ctx.fillStyle = COL.rubric;
    titleLines.forEach((line) => { ctx.fillText(line, left, y); y += titleLH; });
    if (subtitleLines.length) {
      y += 8;
      ctx.font = `italic ${font(30, 400, SERIF)}`;
      ctx.fillStyle = COL.muted;
      subtitleLines.forEach((line) => { ctx.fillText(line, left, y); y += 40; });
    }
    y += 30;
    spec.blocks.forEach((b, i) => {
      if (i) y += GAP;
      if (b.kind === "heading") {
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.font = font(34, 700, SERIF);
        ctx.fillStyle = COL.rubric;
        ctx.fillText(b.text.charAt(0).toLocaleUpperCase() + b.text.slice(1), left, y);
        y += 44;
      } else {
        const layout = tables.get(b);
        drawTable(ctx, layout, left, y);
        y += layout.height;
      }
    });
    if (legendLines.length) {
      y += 22;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = font(24, 400, SANS);
      ctx.fillStyle = COL.muted;
      legendLines.forEach((line) => { ctx.fillText(line, left, y); y += 32; });
    }
    if (community) { y += communityGap; community.draw(ctx, left, y); }

    // footer: site, link, QR code
    drawQr(ctx, spec.url, W - PAD - QR, footerY, QR);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    const textTop = footerY + (footerH - urlLines.length * 38 - 46) / 2;
    ctx.font = font(32, 700, SERIF);
    ctx.fillStyle = COL.text;
    ctx.fillText(site, PAD, textTop);
    ctx.font = font(27, 500, SANS);
    ctx.fillStyle = COL.muted;
    urlLines.forEach((line, i) => ctx.fillText(line, PAD, textTop + 46 + i * 38));
    return canvas;
  }

  /* ── dialog: preview + share / download / copy ─────────────── */
  async function openImageDialog(kind, entry) {
    let url = null;
    const dialog = NL.openModal(`${NL.dialogHeader(`<img src="favicon.svg" alt="">${esc(t("shareImage"))}`)}
      <div class="dialog__body">
        <div class="share-preview"><p class="loading">…</p></div>
        <div class="dialog__actions"></div>
      </div>`, { className: "dialog--wide share-dialog", label: t("shareImage"), onClose: () => { if (url) URL.revokeObjectURL(url); } });
    const box = dialog.el;

    try {
      const spec = specFor(kind, entry);
      spec.community = await loadCommunity(spec, entry).catch(() => null);
      const canvas = await renderImage(spec);
      const blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("empty"))), "image/png"));
      if (!box.isConnected) return;
      url = URL.createObjectURL(blob);
      box.querySelector(".share-preview").innerHTML = `<img src="${url}" alt="${esc(`${spec.title} — ${spec.tabLabel}`)}">`;
      const file = new File([blob], spec.fileName, { type: "image/png" });
      const canShare = isTouch() && navigator.canShare && navigator.canShare({ files: [file] });
      const canCopy = !isTouch() && navigator.clipboard && navigator.clipboard.write && window.ClipboardItem;
      const actions = box.querySelector(".dialog__actions");
      actions.innerHTML = `${canShare ? `<button type="button" class="pill-btn pill-btn--primary" data-sheet>${esc(t("share"))}</button>` : ""}
        <button type="button" class="pill-btn ${canShare ? "" : "pill-btn--primary"}" data-download>${esc(t("download"))}</button>
        ${canCopy ? `<button type="button" class="pill-btn" data-copy>${esc(t("copyImage"))}</button>` : ""}`;
      const download = () => {
        const a = document.createElement("a");
        a.href = url;
        a.download = spec.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      };
      actions.addEventListener("click", async (e) => {
        if (e.target.closest("[data-download]")) download();
        if (e.target.closest("[data-sheet]")) {
          try { await navigator.share({ files: [file], title: spec.title }); } catch (err) { if (!err || err.name !== "AbortError") download(); }
        }
        const copy = e.target.closest("[data-copy]");
        if (copy) {
          try {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
            copy.textContent = `✓ ${t("imageCopied")}`;
          } catch { download(); }
        }
      });
    } catch (err) {
      console.error(err);
      box.querySelector(".share-preview").innerHTML = `<p class="form-error">${esc(t("imageFailed"))}</p>`;
    }
  }

  NL.share = { shareLink, openImageDialog, renderImage, specFor };
})();
