const STORAGE_KEY = "moon-size-map-v1";
const VERSION = "0.1.1";

const CATEGORY_LABELS = {
  tops: "上衣",
  skirts: "裙装",
  pants: "裤装",
  outerwear: "外套"
};

const FIT_STYLES = ["修身", "常规", "宽松", "落肩", "高腰", "低腰", "A字", "H型", "包臀", "弹力", "无弹"];
const ISSUE_OPTIONS = ["肩窄", "胸紧", "腰紧", "臀紧", "大腿紧", "袖短", "裤短", "裙短", "下摆卡", "活动受限", "版型不喜欢"];

const SIZE_FIELDS = {
  tops: [
    ["label", "尺码"],
    ["shoulder", "肩宽"],
    ["bust", "胸围"],
    ["length", "衣长"],
    ["sleeve", "袖长"],
    ["hem", "下摆"],
    ["stretch", "弹力"]
  ],
  skirts: [
    ["label", "尺码"],
    ["bust", "胸围"],
    ["waist", "腰围"],
    ["hip", "臀围"],
    ["length", "裙长"],
    ["shoulder", "肩宽"],
    ["sleeve", "袖长"],
    ["elasticWaist", "松紧腰"],
    ["silhouette", "轮廓"]
  ],
  pants: [
    ["label", "尺码"],
    ["waist", "腰围"],
    ["hip", "臀围"],
    ["thigh", "大腿围"],
    ["rise", "裆长"],
    ["inseam", "内长/裤长"],
    ["legOpening", "裤口"],
    ["stretch", "弹力"]
  ],
  outerwear: [
    ["label", "尺码"],
    ["shoulder", "肩宽"],
    ["bust", "胸围"],
    ["length", "衣长"],
    ["sleeve", "袖长"],
    ["hem", "下摆"],
    ["layering", "叠穿"]
  ]
};

let state = loadState();

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

document.addEventListener("DOMContentLoaded", () => {
  setupTabs();
  setupDates();
  renderFitStyleChips();
  renderIssueChips();
  renderSizeTable();
  bindForms();
  renderAll();
  registerServiceWorker();
});

function loadState() {
  const fallback = {
    bodyRecords: [],
    productRecords: [],
    analysisRecords: [],
    tryonRecords: []
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setupTabs() {
  $$(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".tab").forEach((tab) => tab.classList.toggle("active", tab === button));
      $$(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === `tab-${button.dataset.tab}`));
    });
  });
}

function setupDates() {
  const today = getToday();
  ["body-date", "tryon-date"].forEach((id) => {
    const input = document.getElementById(id);
    input.value = today;
    updateDateButton(id);
    input.addEventListener("change", () => updateDateButton(id));
  });

  $$("[data-date-button]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.dateButton);
      if (input.showPicker) {
        input.showPicker();
      } else {
        input.click();
      }
    });
  });
}

function updateDateButton(inputId) {
  const input = document.getElementById(inputId);
  const button = $(`[data-date-button="${inputId}"]`);
  if (!button) return;
  button.textContent = input.value === getToday() ? "今天" : input.value || "选择日期";
}

function renderFitStyleChips() {
  $("#fit-style-chips").innerHTML = FIT_STYLES.map((style) => `
    <label class="chip">
      <input type="checkbox" name="fitStyles" value="${style}">
      <span>${style}</span>
    </label>
  `).join("");
}

function renderIssueChips() {
  $("#issue-chips").innerHTML = ISSUE_OPTIONS.map((issue) => `
    <label class="chip">
      <input type="checkbox" name="issues" value="${issue}">
      <span>${issue}</span>
    </label>
  `).join("");
}

function bindForms() {
  $("#category-select").addEventListener("change", renderSizeTable);
  $("#add-size-row").addEventListener("click", () => addSizeRow($("#category-select").value));

  $("#body-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const record = formToObject(form);
    record.id = createId();
    record.createdAt = new Date().toISOString();
    normalizeNumbers(record);
    state.bodyRecords.unshift(record);
    saveAndRender();
    form.reset();
    $("#body-date").value = getToday();
    updateDateButton("body-date");
  });

  $("#product-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const product = formToObject(form);
    product.id = createId();
    product.createdAt = new Date().toISOString();
    product.fitStyles = checkedValues("fitStyles", form);
    product.rows = readSizeRows(product.category);
    if (!product.rows.length) {
      alert("请至少添加一个尺码行。");
      return;
    }
    state.productRecords.unshift(product);
    saveAndRender();
    form.reset();
    renderFitStyleChips();
    renderSizeTable();
  });

  $("#analysis-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const body = state.bodyRecords.find((item) => item.id === $("#analysis-body").value);
    const product = state.productRecords.find((item) => item.id === $("#analysis-product").value);
    if (!body || !product) {
      $("#analysis-output").innerHTML = `<div class="empty-state">请先保存身形记录和商品尺码表。</div>`;
      return;
    }
    const result = analyzeProduct(body, product);
    state.analysisRecords.unshift({
      id: createId(),
      createdAt: new Date().toISOString(),
      bodyId: body.id,
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      category: product.category,
      result
    });
    saveState();
    renderAnalysisOutput(result, product, body);
    renderAnalysisList();
  });

  $("#tryon-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const record = formToObject(form);
    record.id = createId();
    record.createdAt = new Date().toISOString();
    record.issues = checkedValues("issues", form);
    state.tryonRecords.unshift(record);
    saveAndRender();
    form.reset();
    renderIssueChips();
    $("#tryon-date").value = getToday();
    updateDateButton("tryon-date");
  });

  $("#export-json").addEventListener("click", exportJson);
  $("#import-json").addEventListener("change", importJson);
  $("#export-csv").addEventListener("click", exportCsv);
  $("#clear-data").addEventListener("click", clearData);
}

function renderSizeTable() {
  const category = $("#category-select").value;
  const fields = SIZE_FIELDS[category];
  $("#size-table thead").innerHTML = `<tr>${fields.map(([, label]) => `<th>${label}</th>`).join("")}<th>操作</th></tr>`;
  $("#size-table tbody").innerHTML = "";
  addSizeRow(category);
}

function addSizeRow(category) {
  const tr = document.createElement("tr");
  tr.innerHTML = SIZE_FIELDS[category].map(([key, label]) => {
    if (["stretch", "elasticWaist", "layering"].includes(key)) {
      return `<td data-label="${label}"><select data-field="${key}" aria-label="${label}"><option value="">未知</option><option value="yes">是</option><option value="no">否</option></select></td>`;
    }
    if (key === "silhouette") {
      return `<td data-label="${label}"><select data-field="${key}" aria-label="${label}"><option value="">未填</option><option>A字</option><option>H型</option><option>包臀</option><option>直筒</option><option>伞裙</option></select></td>`;
    }
    const type = key === "label" ? "text" : "number";
    const step = key === "label" ? "" : "step=\"0.1\" min=\"0\" inputmode=\"decimal\"";
    return `<td data-label="${label}"><input data-field="${key}" type="${type}" ${step} aria-label="${label}"></td>`;
  }).join("") + `<td class="size-row-action" data-label="操作"><button class="icon-button" type="button" title="删除尺码行" aria-label="删除尺码行">×</button></td>`;
  $(".icon-button", tr).addEventListener("click", () => tr.remove());
  $("#size-table tbody").appendChild(tr);
}

function readSizeRows(category) {
  return $$("#size-table tbody tr").map((tr) => {
    const row = {};
    $$("[data-field]", tr).forEach((input) => {
      row[input.dataset.field] = input.type === "number" ? toNumber(input.value) : input.value.trim();
    });
    return row;
  }).filter((row) => row.label);
}

function formToObject(form) {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function checkedValues(name, root = document) {
  return $$(`input[name="${name}"]:checked`, root).map((input) => input.value);
}

function normalizeNumbers(record) {
  Object.keys(record).forEach((key) => {
    if (!["id", "date", "notes", "createdAt"].includes(key)) {
      record[key] = toNumber(record[key]);
    }
  });
}

function toNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function saveAndRender() {
  saveState();
  renderAll();
}

function renderAll() {
  renderBodyList();
  renderProductList();
  renderAnalysisSelectors();
  renderAnalysisList();
  renderTryonList();
}

function renderBodyList() {
  const list = $("#body-list");
  if (!state.bodyRecords.length) {
    list.innerHTML = `<div class="empty-state">还没有身形记录。</div>`;
    return;
  }
  list.innerHTML = state.bodyRecords.map((record) => `
    <article class="record-card">
      <header>
        <div>
          <p class="record-title">${escapeHtml(record.date || "未记录日期")}</p>
          <p class="record-meta">身高 ${display(record.height)} · 肩宽 ${display(record.shoulder)} · 胸/腰/臀 ${display(record.bust)}/${display(record.waist)}/${display(record.hip)}</p>
        </div>
      </header>
      ${record.notes ? `<p class="small-note">${escapeHtml(record.notes)}</p>` : ""}
      <div class="record-actions">
        <button class="mini-action delete" data-delete="bodyRecords" data-id="${record.id}">删除</button>
      </div>
    </article>
  `).join("");
  bindDeleteButtons(list);
}

function renderProductList() {
  const list = $("#product-list");
  if (!state.productRecords.length) {
    list.innerHTML = `<div class="empty-state">还没有商品尺码表。</div>`;
    return;
  }
  list.innerHTML = state.productRecords.map((product) => `
    <article class="record-card">
      <header>
        <div>
          <p class="record-title">${escapeHtml(product.name)}</p>
          <p class="record-meta">${escapeHtml(product.brand || "未填品牌")} · ${CATEGORY_LABELS[product.category]} · ${product.rows.length} 个尺码</p>
        </div>
      </header>
      <p class="small-note">${(product.fitStyles || []).map(escapeHtml).join(" / ") || "未填版型"}</p>
      <div class="record-actions">
        <button class="mini-action" data-use-product="${product.id}">生成路线</button>
        <button class="mini-action delete" data-delete="productRecords" data-id="${product.id}">删除</button>
      </div>
    </article>
  `).join("");
  bindDeleteButtons(list);
  $$("[data-use-product]", list).forEach((button) => {
    button.addEventListener("click", () => {
      $("#analysis-product").value = button.dataset.useProduct;
      switchTab("route");
    });
  });
}

function renderAnalysisSelectors() {
  $("#analysis-body").innerHTML = state.bodyRecords.map((record) => `
    <option value="${record.id}">${escapeHtml(record.date || "未记录日期")} · 身高 ${display(record.height)}</option>
  `).join("");
  $("#analysis-product").innerHTML = state.productRecords.map((product) => `
    <option value="${product.id}">${escapeHtml(product.name)} · ${CATEGORY_LABELS[product.category]}</option>
  `).join("");
}

function renderAnalysisList() {
  const list = $("#analysis-list");
  if (!state.analysisRecords.length) {
    list.innerHTML = `<div class="empty-state">还没有保存的尺码路线。请先保存一条身形记录和一条商品尺码表，再生成路线。</div>`;
    return;
  }
  list.innerHTML = state.analysisRecords.map((record) => `
    <article class="record-card">
      <header>
        <div>
          <p class="record-title">${escapeHtml(record.productName || "未命名商品")}</p>
          <p class="record-meta">${formatDateTime(record.createdAt)} · ${CATEGORY_LABELS[record.category] || record.category}</p>
        </div>
      </header>
      <p class="small-note">优先可试：${record.result.summary.recommended.join("、") || "暂无"} · 谨慎对照：${record.result.summary.caution.join("、") || "暂无"}</p>
      <div class="record-actions">
        <button class="mini-action delete" data-delete="analysisRecords" data-id="${record.id}">删除</button>
      </div>
    </article>
  `).join("");
  bindDeleteButtons(list);
}

function renderTryonList() {
  const list = $("#tryon-list");
  if (!state.tryonRecords.length) {
    list.innerHTML = `<div class="empty-state">还没有试穿记录。你可以在试穿后记录尺码、问题和是否退货。</div>`;
    return;
  }
  list.innerHTML = state.tryonRecords.map((record) => `
    <article class="record-card">
      <header>
        <div>
          <p class="record-title">${escapeHtml(record.productName)} · ${escapeHtml(record.sizeTried)}</p>
          <p class="record-meta">${escapeHtml(record.date)} · ${escapeHtml(record.brand || "未填品牌")} · ${escapeHtml(record.fitResult)}</p>
        </div>
      </header>
      <p class="small-note">${(record.issues || []).map(escapeHtml).join(" / ") || "未勾选问题"}${record.notes ? ` · ${escapeHtml(record.notes)}` : ""}</p>
      <div class="record-actions">
        <button class="mini-action delete" data-delete="tryonRecords" data-id="${record.id}">删除</button>
      </div>
    </article>
  `).join("");
  bindDeleteButtons(list);
}

function bindDeleteButtons(root) {
  $$("[data-delete]", root).forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.delete;
      state[key] = state[key].filter((item) => item.id !== button.dataset.id);
      saveAndRender();
      $("#analysis-output").innerHTML = "";
    });
  });
}

function switchTab(name) {
  const button = $(`.tab[data-tab="${name}"]`);
  if (button) button.click();
}

function analyzeProduct(body, product) {
  const rows = product.rows.map((row) => scoreSizeRow(body, product, row));
  return {
    summary: {
      recommended: rows.filter((row) => row.level === "recommended").map((row) => row.label),
      caution: rows.filter((row) => row.level === "caution").map((row) => row.label),
      risky: rows.filter((row) => row.level === "risky").map((row) => row.label),
      notRecommended: rows.filter((row) => row.level === "notRecommended").map((row) => row.label)
    },
    rows,
    advice: buildBuyingAdvice(rows, product)
  };
}

function scoreSizeRow(body, product, row) {
  const checks = [];
  const styles = new Set(product.fitStyles || []);
  const stretch = row.stretch === "yes" || styles.has("弹力") || row.elasticWaist === "yes";
  const loose = styles.has("宽松") || styles.has("落肩");
  const fitted = styles.has("修身") || styles.has("包臀") || styles.has("H型") || row.silhouette === "包臀" || row.silhouette === "H型";
  const nonStretch = row.stretch === "no" || styles.has("无弹");

  const margin = (garment, bodyValue) => {
    if (garment === null || bodyValue === null) return null;
    return Number((garment - bodyValue).toFixed(1));
  };
  const add = (dimension, severity, text) => checks.push({ dimension, severity, text });
  const need = (key, bodyKey, label, cautionMargin, riskMargin, redMargin = -0.1) => {
    const diff = margin(row[key], body[bodyKey]);
    if (diff === null) return;
    if (diff <= redMargin) add(label, 3, `${label}低于身体数据，属于红线尺寸。`);
    else if (diff < riskMargin) add(label, 2, `${label}余量 ${diff} cm，可能是主要风险点。`);
    else if (diff < cautionMargin) add(label, 1, `${label}余量 ${diff} cm，建议谨慎对照。`);
  };

  if (product.category === "tops") {
    const shoulderRisk = loose ? -1 : 0.8;
    const bustCaution = stretch ? 3 : fitted || nonStretch ? 6 : 4;
    need("shoulder", "shoulder", "肩宽", loose ? 1 : 2.5, shoulderRisk);
    need("bust", "bust", "胸围", bustCaution, stretch ? 0.5 : 2);
    checkLength(row.length, body.topLength, body.height, "衣长", add);
    if (row.sleeve && body.height && body.height >= 170 && row.sleeve < 58) add("袖长", 1, "袖长可能偏短，建议看买家图或实测。");
  }

  if (product.category === "skirts") {
    const elastic = row.elasticWaist === "yes";
    need("waist", "waist", "腰围", elastic ? 1 : 3, elastic ? -2 : 0.5, elastic ? -4 : -0.1);
    const aLine = styles.has("A字") || row.silhouette === "A字" || row.silhouette === "伞裙";
    need("hip", "hip", "臀围", aLine ? 1 : 4, aLine ? -3 : 1, aLine ? -6 : -0.1);
    checkLength(row.length, body.skirtLength, body.height, "裙长", add);
  }

  if (product.category === "pants") {
    need("waist", "waist", "腰围", stretch ? 1.5 : 3, stretch ? -1 : 0.5, stretch ? -3 : -0.1);
    need("hip", "hip", "臀围", stretch || loose ? 2 : 4, stretch ? 0 : 1.5);
    need("thigh", "thigh", "大腿围", stretch || loose ? 1.5 : 3, stretch ? 0 : 1);
    if (row.rise !== null && styles.has("高腰") && row.rise < 28) add("裆长", 1, "高腰款裆长偏短时，腰线位置可能不稳定。");
    checkLength(row.inseam, body.inseam, body.height, "裤长", add);
  }

  if (product.category === "outerwear") {
    const layerAllowance = row.layering === "yes" ? 2 : 4;
    need("shoulder", "shoulder", "肩宽", loose ? 1.5 : 3, loose ? -0.5 : 1);
    need("bust", "bust", "胸围", loose ? 6 : 8 + layerAllowance, loose ? 2 : 4);
    checkLength(row.length, body.topLength, body.height, "衣长", add);
    if (row.sleeve && body.height && body.height >= 170 && row.sleeve < 59) add("袖长", 2, "外套袖长可能偏短，属于明显试穿风险。");
  }

  if (!checks.length) {
    checks.push({ dimension: "总体", severity: 0, text: "关键尺寸暂时没有明显红线，仍建议结合面料和退换政策判断。" });
  }

  const maxSeverity = Math.max(...checks.map((check) => check.severity));
  const cautionCount = checks.filter((check) => check.severity === 1).length;
  let level = "recommended";
  if (maxSeverity >= 3) level = "notRecommended";
  else if (maxSeverity === 2) level = "risky";
  else if (maxSeverity === 1 || cautionCount >= 2) level = "caution";

  return {
    label: row.label,
    level,
    checks,
    redLines: checks.filter((check) => check.severity >= 3).map((check) => check.dimension),
    tips: buildFitTips(product, checks, row)
  };
}

function checkLength(garmentLength, preferredLength, height, label, add) {
  if (garmentLength === null) return;
  if (preferredLength !== null) {
    const diff = garmentLength - preferredLength;
    if (diff < -5) add(label, 2, `${label}比常穿长度短 ${Math.abs(diff).toFixed(1)} cm，可能是可见版型风险。`);
    else if (diff < -2) add(label, 1, `${label}略短，适合能接受偏短效果时再考虑。`);
    return;
  }
  if (height && height >= 170 && garmentLength < 58 && label !== "裤长") {
    add(label, 1, `${label}对高个或长躯干用户可能偏短。`);
  }
  if (height && height >= 170 && label === "裤长" && garmentLength < 98) {
    add(label, 2, "裤长可能偏短，适合接受九分效果时再考虑。");
  }
}

function buildFitTips(product, checks, row) {
  const riskyText = checks.filter((check) => check.severity >= 2).map((check) => check.dimension);
  const styles = product.fitStyles || [];
  const tips = [];
  if (riskyText.length) tips.push(`可能翻车的位置：${[...new Set(riskyText)].join("、")}。`);
  if (product.category === "tops" && (styles.includes("宽松") || styles.includes("落肩"))) {
    tips.push("宽松或落肩版型会增加上身活动余量，但肩宽、胸围、衣长和袖长仍需要单独看。");
  }
  if (product.category === "pants" && styles.includes("宽松")) {
    tips.push("宽松版型会增加活动余量，但腰围、臀围、大腿围、裆长和裤长仍需要一起对照。");
  }
  if (product.category === "skirts" && (styles.includes("A字") || styles.includes("宽松") || row.silhouette === "A字" || row.silhouette === "伞裙")) {
    tips.push("A 字或宽松裙型会提高臀围容忍度，但腰围、裙长和胸围仍需要单独看。");
  }
  if (product.category === "outerwear") {
    tips.push("外套需要考虑内搭空间。肩宽、胸围、袖长和衣长都可能成为关键尺寸。");
  }
  if (styles.includes("无弹") || row.stretch === "no") tips.push("无弹面料建议保留更充足余量。");
  if (styles.includes("弹力") || row.stretch === "yes") tips.push("弹力可以提高容错，但不等于红线尺寸消失。");
  if (product.category === "pants") tips.push("裤装不要只看腰围，臀围、大腿围、裆长和裤长都应一起对照。");
  return tips;
}

function buildBuyingAdvice(rows, product) {
  const recommended = rows.filter((row) => row.level === "recommended");
  const caution = rows.filter((row) => row.level === "caution");
  if (recommended.length) return `如果只能先试一批，优先看 ${recommended.map((row) => row.label).join("、")}。如果只能买一件，优先选择可退换店铺。`;
  if (caution.length) return `没有非常稳妥的尺码，可以把 ${caution.map((row) => row.label).join("、")} 作为谨慎对照尺码，并重点核对红线尺寸。`;
  return `${CATEGORY_LABELS[product.category]}的关键尺寸风险较多，不建议作为第一批尝试，除非可退换且你能接受对应版型效果。`;
}

function renderAnalysisOutput(result, product, body) {
  const levelLabels = {
    recommended: "优先可试",
    caution: "谨慎对照",
    risky: "可能翻车",
    notRecommended: "不建议第一批尝试"
  };

  $("#analysis-output").innerHTML = `
    <section class="card route-summary">
      <h3>${escapeHtml(product.name)} 的尺码路线</h3>
      <p class="small-note">使用 ${escapeHtml(body.date || "未记录日期")} 的身形记录。尺码不是身份，这只是第一批试穿路线。</p>
      <p><strong>优先可试尺码：</strong>${result.summary.recommended.join("、") || "暂无"}</p>
      <p><strong>谨慎对照尺码：</strong>${result.summary.caution.join("、") || "暂无"}</p>
      <p><strong>购买建议：</strong>${escapeHtml(result.advice)}</p>
    </section>
    <div class="route-grid">
      ${result.rows.map((row) => `
        <article class="route-card ${row.level}">
          <p><span class="badge">${levelLabels[row.level]}</span></p>
          <h3>${escapeHtml(row.label)}</h3>
          <p><strong>红线尺寸：</strong>${row.redLines.join("、") || "暂无明显红线"}</p>
          <ul>
            ${row.checks.map((check) => `<li>${escapeHtml(check.text)}</li>`).join("")}
            ${row.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}
          </ul>
        </article>
      `).join("")}
    </div>
  `;
}

function exportJson() {
  const payload = {
    appName: "Moon Size Map",
    version: VERSION,
    exportedAt: new Date().toISOString(),
    ...state
  };
  downloadFile(`moon-size-map-backup-${getToday()}.json`, JSON.stringify(payload, null, 2), "application/json");
  setStatus("已导出 JSON 备份。");
}

function importJson(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      state = {
        bodyRecords: data.bodyRecords || [],
        productRecords: data.productRecords || [],
        analysisRecords: data.analysisRecords || [],
        tryonRecords: data.tryonRecords || []
      };
      saveAndRender();
      setStatus("已导入 JSON 备份。");
    } catch {
      setStatus("导入未完成：JSON 文件无法读取。");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function exportCsv() {
  const sections = [
    ["body_records", state.bodyRecords],
    ["product_records", state.productRecords.map((item) => ({ ...item, rows: JSON.stringify(item.rows), fitStyles: (item.fitStyles || []).join("|") }))],
    ["analysis_records", state.analysisRecords.map((item) => ({ ...item, result: JSON.stringify(item.result) }))],
    ["tryon_records", state.tryonRecords.map((item) => ({ ...item, issues: (item.issues || []).join("|") }))]
  ];
  const csv = sections.map(([name, rows]) => tableToCsv(name, rows)).join("\n\n");
  downloadFile(`moon-size-map-tables-${getToday()}.csv`, csv, "text/csv;charset=utf-8");
  setStatus("已导出 CSV。");
}

function tableToCsv(name, rows) {
  if (!rows.length) return `# ${name}\n`;
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => csvCell(row[header])).join(","));
  });
  return `# ${name}\n${lines.join("\n")}`;
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function clearData() {
  const ok = confirm("确定要清空这个浏览器中的 Moon Size Map 本地数据吗？");
  if (!ok) return;
  state = {
    bodyRecords: [],
    productRecords: [],
    analysisRecords: [],
    tryonRecords: []
  };
  saveAndRender();
  $("#analysis-output").innerHTML = "";
  setStatus("本地数据已清空。");
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function setStatus(text) {
  $("#data-status").textContent = text;
}

function display(value) {
  return value === null || value === undefined || value === "" ? "未填" : `${value} cm`;
}

function getToday() {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatDateTime(value) {
  if (!value) return "未记录时间";
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}
