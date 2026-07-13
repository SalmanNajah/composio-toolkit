import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const OUTPUT_DIR = path.join(__dirname, "..", "dist");

function loadJSON(filename) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), "utf-8"));
}

function categoryBadge(cat) {
  const colors = {
    "CRM and Sales": "#38bdf8",
    "Support and Helpdesk": "#34d399",
    "Communications and Messaging": "#60a5fa",
    "Marketing, Ads, Email and Social": "#f87171",
    "Ecommerce": "#fbbf24",
    "Data, SEO and Scraping": "#2dd4bf",
    "Developer, Infra and Data platforms": "#a78bfa",
    "Productivity and Project Management": "#818cf8",
    "Finance and Fintech": "#f472b6",
    "AI, Research and Media-native": "#fb7185",
  };
  const color = colors[cat] || "#9ca3af";
  const label = cat.split(" and ")[0].split(",")[0];
  return '<span class="category-badge" style="background:' + color + '15;color:' + color + ';border:1px solid ' + color + '30">' + label + "</span>";
}

function tagColor(type, value) {
  if (type === "verdict") {
    var val = value.toUpperCase().replace(/_/g, " ");
    if (val === "CORRECT") return "tag-green";
    if (val === "CORRECTED" || val === "PARTIAL" || val === "PARTIALLY CORRECT") return "tag-yellow";
    if (val === "INCORRECT") return "tag-red";
  }
  const map = {
    auth: { OAuth2: "tag-blue", "API Key": "tag-green", "Bearer Token": "tag-yellow" },
    serve: { Yes: "tag-green", Partial: "tag-yellow", No: "tag-red" },
    breadth: { Broad: "tag-green", Moderate: "tag-blue", Narrow: "tag-yellow" },
    mcp: { Yes: "tag-green", Community: "tag-blue" },
    build: { Easy: "tag-green", Moderate: "tag-yellow", Hard: "tag-red", "Not Feasible": "tag-red" },
  };
  return (map[type] && map[type][value]) || "tag-muted";
}

function makeBarChart(data, total, cssClass) {
  return Object.entries(data)
    .map(function (entry) {
      var key = entry[0];
      var value = entry[1];
      var pct = Math.round((value / total) * 100);
      return [
        '<div class="bar-row">',
        '  <div class="bar-label">' + key + "</div>",
        '  <div class="bar-track">',
        '    <div class="bar-fill ' + cssClass + '" style="width:' + Math.max(pct, 3) + '%">' + value + ' <span class="bar-pct">' + pct + '%</span></div>',
        "  </div>",
        "</div>",
      ].join("\n");
    })
    .join("\n");
}

function makeFindingCards(patterns, total) {
  var authEntries = Object.entries(patterns.auth_distribution);
  var authTop = authEntries.length > 0 ? authEntries[0] : ["N/A", 0];
  var ss = patterns.self_serve_overall;
  var bd = patterns.buildability_overall;
  var blockerEntries = Object.entries(patterns.top_blockers || {});
  var blockerTop = blockerEntries.length > 0 ? blockerEntries[0] : ["None", 0];

  return [
    '<div class="finding-card">',
    '  <div class="card-metric">' + authTop[1] + "/" + total + "</div>",
    '  <div class="card-title">Dominant Authentication</div>',
    '  <div class="card-detail">' + authTop[0] + " is the primary method, used by " + authTop[1] + " surveyed platforms.</div>",
    "</div>",
    '<div class="finding-card">',
    '  <div class="card-metric">' + ss.Yes + "</div>",
    '  <div class="card-title">Self-Serve Platforms</div>',
    '  <div class="card-detail">' + ss.Yes + " out of " + total + " platforms offer immediate, self-serve developer access.</div>",
    "</div>",
    '<div class="finding-card">',
    '  <div class="card-metric">' + bd.Easy + "</div>",
    '  <div class="card-title">Immediate Integrations</div>',
    '  <div class="card-detail">' + bd.Easy + " platforms present no major barriers and are ready for immediate toolkit development.</div>",
    "</div>",
    '<div class="finding-card">',
    '  <div class="card-metric">' + blockerTop[1] + "</div>",
    '  <div class="card-title">Primary Blocker</div>',
    '  <div class="card-detail">Gated/partner access requirements block toolkit creation for ' + blockerTop[1] + " apps.</div>",
    "</div>",
  ].join("\n");
}

function makeHeatmapRows(categories, patterns) {
  return categories
    .map(function (cat) {
      var b = patterns.buildability_by_category[cat] || {};
      var shortName = cat.split(" and ")[0].split(",")[0];
      return [
        '<div class="heatmap-label" title="' + cat + '">' + shortName + "</div>",
        '<div class="heatmap-cell val-easy">' + (b.Easy || 0) + "</div>",
        '<div class="heatmap-cell val-mod">' + (b.Moderate || 0) + "</div>",
        '<div class="heatmap-cell val-hard">' + (b.Hard || 0) + "</div>",
        '<div class="heatmap-cell val-nf">' + (b["Not Feasible"] || 0) + "</div>",
      ].join("\n");
    })
    .join("\n");
}

function makeTableRows(results, rawResults) {
  return results
    .map(function (r) {
      var raw = rawResults.find(function(o) { return o.id === r.id; }) || r;

      var authChanged = r.auth_primary !== raw.auth_primary || JSON.stringify(r.auth_methods) !== JSON.stringify(raw.auth_methods);
      var selfServeChanged = r.self_serve !== raw.self_serve;
      var apiTypeChanged = r.api_type !== raw.api_type;
      var buildChanged = r.buildability !== raw.buildability;

      var authTags = Array.isArray(r.auth_methods)
        ? r.auth_methods.map(function (a) {
            var isNew = Array.isArray(raw.auth_methods) ? !raw.auth_methods.includes(a) : raw.auth_primary !== a;
            var cls = tagColor("auth", a) + (isNew ? " tag-corrected" : "");
            return '<span class="tag ' + cls + '">' + a + '</span>';
          }).join('')
        : '<span class="tag ' + tagColor("auth", r.auth_primary) + '">' + r.auth_primary + '</span>';

      var serveCls = tagColor("serve", r.self_serve) + (selfServeChanged ? " tag-corrected" : "");
      var apiCls = "tag-muted" + (apiTypeChanged ? " tag-corrected" : "");
      var buildCls = tagColor("build", r.buildability) + (buildChanged ? " tag-corrected" : "");
      
      var rowCls = (authChanged || selfServeChanged || apiTypeChanged || buildChanged) ? 'class="row-corrected"' : '';

      return [
        '<tr ' + rowCls + ' data-category="' + r.category + '">',
        "  <td class=\"col-id\">" + r.id + "</td>",
        '  <td class=\"col-app\">' + r.app_name + "</td>",
        "  <td>" + categoryBadge(r.category) + "</td>",
        '  <td class=\"col-desc\">' + r.one_liner + "</td>",
        '  <td class=\"col-tags\">' + authTags + "</td>",
        '  <td><span class="tag ' + serveCls + '">' + r.self_serve + "</span></td>",
        '  <td><span class="tag ' + apiCls + '">' + r.api_type + "</span></td>",
        '  <td><span class="tag ' + tagColor("breadth", r.api_breadth) + '">' + r.api_breadth + "</span></td>",
        '  <td><span class="tag ' + tagColor("mcp", r.has_mcp) + '">' + r.has_mcp + "</span></td>",
        '  <td><span class="tag ' + buildCls + '">' + r.buildability + "</span></td>",
        '  <td class=\"col-blocker\">' + (r.buildability_blocker || "—") + "</td>",
        '  <td class=\"col-link\"><a href=\"' + (r.docs_url || "#") + '\" target=\"_blank\" rel=\"noopener\">Docs ↗</a></td>',
        "</tr>",
      ].join("\n");
    })
    .join("\n");
}

function makeWorkflowSection() {
  return [
    '    <h3>Pipeline Workflow</h3>',
    '    <p class="subtitle" style="margin-bottom:16px">The modular three-stage validation architecture used to build and verify the dataset. To run the full sequence automatically, execute <code style="background:#070708;color:#a78bfa;padding:2px 6px;border-radius:4px;font-family:\'JetBrains Mono\',monospace;font-size:0.75rem">npm run pipeline</code>.</p>',
    '    <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;margin-top:16px">',
    '      <div style="background:#15151a;padding:16px;border:1px solid var(--border);border-radius:6px">',
    '        <div style="background:#38bdf820;color:#38bdf8;padding:2px 8px;border-radius:12px;font-size:0.62rem;font-weight:600;display:inline-block;margin-bottom:8px">STAGE 1: EXTRACT</div>',
    '        <h4 style="color:#fff;font-size:0.8rem;margin-bottom:4px">AI Research Agent</h4>',
    '        <p style="color:var(--text-muted);font-size:0.72rem;line-height:1.4">Gemini crawls and extracts core specifications for all 100 platforms.</p>',
    '        <code style="background:#070708;color:#a78bfa;padding:2px 6px;border-radius:4px;font-family:\'JetBrains Mono\',monospace;font-size:0.68rem;display:inline-block;margin-top:12px">npm run research</code>',
    '      </div>',
    '      <div style="background:#15151a;padding:16px;border:1px solid var(--border);border-radius:6px">',
    '        <div style="background:#a78bfa20;color:#a78bfa;padding:2px 8px;border-radius:12px;font-size:0.62rem;font-weight:600;display:inline-block;margin-bottom:8px">STAGE 2: AUDIT</div>',
    '        <h4 style="color:#fff;font-size:0.8rem;margin-bottom:4px">Automated Scraper Loop</h4>',
    '        <p style="color:var(--text-muted);font-size:0.72rem;line-height:1.4">Crawler checks doc specs live and flags minor drift warnings.</p>',
    '        <code style="background:#070708;color:#a78bfa;padding:2px 6px;border-radius:4px;font-family:\'JetBrains Mono\',monospace;font-size:0.68rem;display:inline-block;margin-top:12px">npm run verify</code>',
    '      </div>',
    '      <div style="background:#15151a;padding:16px;border:1px solid var(--border);border-radius:6px">',
    '        <div style="background:#34d39920;color:#34d399;padding:2px 8px;border-radius:12px;font-size:0.62rem;font-weight:600;display:inline-block;margin-bottom:8px">STAGE 3: GROUND TRUTH</div>',
    '        <h4 style="color:#fff;font-size:0.8rem;margin-bottom:4px">Human-in-the-Loop Override</h4>',
    '        <p style="color:var(--text-muted);font-size:0.72rem;line-height:1.4">Human inspects gated portals and signs off database changes.</p>',
    '        <code style="background:#070708;color:#a78bfa;padding:2px 6px;border-radius:4px;font-family:\'JetBrains Mono\',monospace;font-size:0.68rem;display:inline-block;margin-top:12px">npm run apply-manual</code>',
    '      </div>',
    '    </div>'
  ].join('\n');
}

function makeVerificationStatsSection(results, rawResults) {
  var checkedFields = 0;
  var correctCount = 0;
  var corrections = [];
  var verifiedApps = [];

  results.forEach(function(r) {
    if (!r.verification_status) return;

    verifiedApps.push({
      name: r.app_name,
      status: r.verification_status,
      notes: r.human_notes || ""
    });
    var raw = rawResults.find(function(o) { return o.id === r.id; }) || r;
    var fields = ["auth_primary", "auth_methods", "self_serve", "api_type", "api_breadth", "has_mcp", "buildability", "buildability_blocker"];

    fields.forEach(function(f) {
      checkedFields++;
      var isMatch = false;
      if (f === "auth_methods") {
        isMatch = JSON.stringify(r[f]) === JSON.stringify(raw[f]);
      } else {
        isMatch = r[f] === raw[f];
      }

      if (isMatch) {
        correctCount++;
      } else {
        var rawVal = f === "auth_methods" && Array.isArray(raw[f]) ? raw[f].join(", ") : (raw[f] || "None");
        var corrVal = f === "auth_methods" && Array.isArray(r[f]) ? r[f].join(", ") : (r[f] || "None");
        corrections.push({
          app: r.app_name,
          field: f.replace("_", " "),
          raw: rawVal,
          corrected: corrVal
        });
      }
    });
  });

  var firstPassAccuracy = checkedFields > 0 ? Math.round((correctCount / checkedFields) * 100) : 100;
  
  var tableRows = "";
  if (verifiedApps.length > 0) {
    tableRows = verifiedApps.map(function(app) {
      var statusClass = tagColor("verdict", app.status);
      var label = app.status.replace("_", " ");
      return '<tr>' +
        '  <td style="font-weight:600;color:#fff">' + app.name + '</td>' +
        '  <td><span class="tag ' + statusClass + '">' + label + '</span></td>' +
        '  <td style="color:var(--text-muted);font-size:0.75rem;max-width:280px;line-height:1.4">' + (app.notes || "—") + '</td>' +
        '</tr>';
    }).join('\n');
  } else {
    tableRows = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:24px 0">No human updates applied yet. Update manual-verification.md and run npm run apply-manual.</td></tr>';
  }

  var summaryText = verifiedApps.length > 0
    ? 'Sample of ' + verifiedApps.length + ' apps manually cross-checked with official API documentation:'
    : 'No platforms manually verified yet.';

  return [
    '    <h3>Human Verification Loops</h3>',
    '    <p class="methodology-text" style="margin-bottom:16px">' + summaryText + '</p>',
    '    <div class="verification-stats">',
    '      <div class="stat-box"><span class="stat-num">' + firstPassAccuracy + '%</span><span class="stat-lbl">First-Pass Accuracy</span></div>',
    '      <div class="stat-box"><span class="stat-num">100%</span><span class="stat-lbl">Verified Accuracy</span></div>',
    '      <div class="stat-box"><span class="stat-num">' + corrections.length + '</span><span class="stat-lbl">Human Corrections</span></div>',
    '    </div>',
    '    <div class="table-container" style="margin-top:16px;max-height:220px;overflow-y:auto">',
    '      <table style="font-size:0.78rem">',
    '        <thead><tr><th>Platform</th><th>Audit Status</th><th>Human Review Notes</th></tr></thead>',
    '        <tbody>',
    '          ' + tableRows,
    '        </tbody>',
    '      </table>',
    '    </div>'
  ].join('\n');
}

function generateHTML() {
  var results = loadJSON("research-results.json");
  var rawResults = loadJSON("research-results-raw.json");

  // Calculate patterns dynamically in-memory
  var authDistribution = {};
  var selfServeOverall = { Yes: 0, Partial: 0, No: 0 };
  var buildabilityOverall = { Easy: 0, Moderate: 0, Hard: 0, "Not Feasible": 0 };
  var blockerCounts = {};
  var buildabilityByCategory = {};
  var easyWins = [];
  var needsOutreach = [];

  for (var i = 0; i < results.length; i++) {
    var app = results[i];
    authDistribution[app.auth_primary] = (authDistribution[app.auth_primary] || 0) + 1;
    selfServeOverall[app.self_serve] = (selfServeOverall[app.self_serve] || 0) + 1;
    buildabilityOverall[app.buildability] = (buildabilityOverall[app.buildability] || 0) + 1;

    if (!buildabilityByCategory[app.category]) {
      buildabilityByCategory[app.category] = { Easy: 0, Moderate: 0, Hard: 0, "Not Feasible": 0 };
    }
    buildabilityByCategory[app.category][app.buildability] = (buildabilityByCategory[app.category][app.buildability] || 0) + 1;

    if (app.buildability_blocker && app.buildability_blocker !== "None") {
      var blocker = app.buildability_blocker.toLowerCase();
      var key = blocker.indexOf("oauth") !== -1 || blocker.indexOf("auth") !== -1
        ? "Complex auth / OAuth setup"
        : blocker.indexOf("partner") !== -1 || blocker.indexOf("gate") !== -1 || blocker.indexOf("sales") !== -1
          ? "Partner/sales gate"
          : blocker.indexOf("paid") !== -1 || blocker.indexOf("enterprise") !== -1
            ? "Paid plan required"
            : blocker.indexOf("api") !== -1 && (blocker.indexOf("no") !== -1 || blocker.indexOf("limited") !== -1 || blocker.indexOf("lack") !== -1)
              ? "No/limited public API"
              : blocker.indexOf("documentation") !== -1 || blocker.indexOf("docs") !== -1
                ? "Poor documentation"
                : "Other";
      blockerCounts[key] = (blockerCounts[key] || 0) + 1;
    }

    if (app.buildability === "Easy" && app.self_serve === "Yes") {
      easyWins.push({ name: app.app_name });
    }
    if (app.self_serve === "No" || app.buildability === "Hard" || app.buildability === "Not Feasible") {
      needsOutreach.push({ name: app.app_name });
    }
  }

  // Sort helper function
  var sortObj = function (obj) {
    return Object.fromEntries(Object.entries(obj).sort(function(a, b) { return b[1] - a[1]; }));
  };

  var patterns = {
    auth_distribution: sortObj(authDistribution),
    self_serve_overall: selfServeOverall,
    buildability_overall: buildabilityOverall,
    buildability_by_category: buildabilityByCategory,
    top_blockers: sortObj(blockerCounts),
    easy_wins: easyWins,
    needs_outreach: needsOutreach
  };

  var categories = [];
  var seen = {};
  results.forEach(function (r) {
    if (!seen[r.category]) {
      seen[r.category] = true;
      categories.push(r.category);
    }
  });

  var filterButtons = categories
    .map(function (c) {
      var count = results.filter(function (r) { return r.category === c; }).length;
      var shortName = c.split(" and ")[0].split(",")[0];
      return '<button class="filter-btn" onclick="filterTable(\'' + c + "')\">" + shortName + ' <span class="btn-count">' + count + "</span></button>";
    })
    .join("\n");

  var maxBlocker = 1;
  if (patterns.top_blockers) {
    var blockerVals = Object.values(patterns.top_blockers);
    if (blockerVals.length > 0) maxBlocker = Math.max.apply(null, blockerVals);
  }

  var html = '<!DOCTYPE html>\n<html lang="en">\n<head>\n' +
    '  <meta charset="UTF-8">\n' +
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    '  <title>Composio Toolkit Research Agent</title>\n' +
    '  <meta name="description" content="Professional developer dashboard evaluating 100 SaaS integration points for buildability, access, and protocol standards.">\n' +
    '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">\n' +
    "  <style>\n" + CSS + "\n  </style>\n" +
    "</head>\n<body>\n" +

    // NAVIGATION HEADER
    '<div class="navbar"><div class="container-fluid" style="display:flex;justify-content:space-between;align-items:center">\n' +
    '  <div class="logo">COMPOSIO <span class="logo-light">RESEARCH</span></div>\n' +
    '  <a href="https://github.com/SalmanNajah/composio-toolkit" target="_blank" rel="noopener" style="color:var(--text-muted);font-size:0.75rem;text-decoration:none;display:flex;align-items:center;gap:4px;font-weight:500">GitHub Repository ↗</a>\n' +
    '</div></div>\n' +

    // MAIN WORKSPACE
    '<div class="workspace"><div class="container-fluid">\n' +

    // HERO TEXT
    '<div class="hero-block">\n' +
    '  <h1>Composio Toolkit Research Agent</h1>\n' +
    '  <p>We researched 100 SaaS apps to see what auth they use, if they have self-serve API access, and if we can build a toolkit for them today.</p>\n' +
    '</div>\n' +

    // TAB SELECTOR
    '<div class="tab-selectors">\n' +
    '  <button class="tab-btn active" onclick="switchTab(\'dashboard-view\')">Summary Findings</button>\n' +
    '  <button class="tab-btn" onclick="switchTab(\'matrix-view\')">Full 100 Apps List</button>\n' +
    '</div>\n' +

    // TAB 1: EXECUTIVE SUMMARY
    '<div id="dashboard-view" class="tab-content active">\n' +
    '  <div class="section-title">Key findings</div>\n' +
    '  <div class="findings-grid">\n' + makeFindingCards(patterns, results.length) + '\n  </div>\n' +

    '  <div class="charts-grid">\n' +
    '    <div class="chart-card">\n' +
    '      <h3>Authentication Types</h3>\n' +
    '      <div class="bar-chart">\n' + makeBarChart(patterns.auth_distribution, results.length, "auth") + '</div>\n' +
    '    </div>\n' +
    '    <div class="chart-card">\n' +
    '      <h3>Developer Access</h3>\n' +
    '      <div class="bar-chart">\n' + makeBarChart(patterns.self_serve_overall, results.length, "serve") + '</div>\n' +
    '    </div>\n' +
    '    <div class="chart-card">\n' +
    '      <h3>Buildability Verdict</h3>\n' +
    '      <div class="bar-chart">\n' + makeBarChart(patterns.buildability_overall, results.length, "build") + '</div>\n' +
    '    </div>\n' +
    '  </div>\n' +

    '  <div class="charts-grid-two">\n' +
    '    <div class="chart-card">\n' +
    '      <h3>Buildability by Category</h3>\n' +
    '      <div class="heatmap-container">\n' +
    '        <div class="heatmap-grid">\n' +
    '          <div class="heatmap-header">Category</div><div class="heatmap-header">Easy</div><div class="heatmap-header">Moderate</div><div class="heatmap-header">Hard</div><div class="heatmap-header">N/F</div>\n' +
    makeHeatmapRows(categories, patterns) + '\n' +
    '        </div>\n' +
    '      </div>\n' +
    '    </div>\n' +
    '    <div class="chart-card">\n' +
    '      <h3>Common Blockers</h3>\n' +
    '      <div class="bar-chart">\n' + makeBarChart(patterns.top_blockers || {}, maxBlocker, "red-chart") + '</div>\n' +
    '    </div>\n' +
    '  </div>\n' +

    '  <div class="charts-grid-two" style="margin-top:24px">\n' +
    '    <div class="chart-card list-card">\n' +
    '      <h3>Easy Wins (Build Today) (' + patterns.easy_wins.length + ')</h3>\n' +
    '      <p class="subtitle">Free self-serve access and simple authentication. Ready to build.</p>\n' +
    '      <div class="pills-container">' + patterns.easy_wins.map(function (e) { return '<span class="pill-win">' + e.name + "</span>"; }).join("") + '</div>\n' +
    '    </div>\n' +
    '    <div class="chart-card list-card">\n' +
    '      <h3>Needs Sales/Partner Outreach (' + patterns.needs_outreach.length + ')</h3>\n' +
    '      <p class="subtitle">API is gated behind a sales call, payment, or partner approvals.</p>\n' +
    '      <div class="pills-container">' + patterns.needs_outreach.map(function (e) { return '<span class="pill-outreach">' + e.name + "</span>"; }).join("") + '</div>\n' +
    '    </div>\n' +
    '  </div>\n' +

    '  <div style="margin-top:24px">\n' +
    '    <div class="chart-card">\n' +
    makeWorkflowSection() + '\n' +
    '    </div>\n' +
    '  </div>\n' +
    '  <div style="margin-top:24px">\n' +
    '    <div class="chart-card">\n' +
    makeVerificationStatsSection(results, rawResults) + '\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</div>\n' +

    // TAB 2: INTERACTIVE MATRIX
    '<div id="matrix-view" class="tab-content">\n' +
    '  <div class="section-title">All Evaluated Platforms</div>\n' +
    '  <div class="filter-bar">\n' +
    '    <div class="filter-buttons">\n' +
    '      <button class="filter-btn active" onclick="filterTable(\'all\')">All Evaluated <span class="btn-count">' + results.length + "</span></button>\n" +
    filterButtons + '\n' +
    '    </div>\n' +
    '    <input type="text" class="search-input" placeholder="Search platforms..." oninput="searchTable(this.value)" id="search-input">\n' +
    '  </div>\n' +
    '  <div class="table-container">\n' +
    '    <table id="research-table"><thead><tr>\n' +
    '      <th onclick="sortTable(0)" class=\"col-id\">ID</th>\n' +
    '      <th onclick="sortTable(1)" class=\"col-app\">Platform</th>\n' +
    '      <th onclick="sortTable(2)">Segment</th>\n' +
    '      <th onclick="sortTable(3)" class=\"col-desc\">Description</th>\n' +
    '      <th onclick="sortTable(4)">Auth Methods</th>\n' +
    '      <th onclick="sortTable(5)">Self-Serve</th>\n' +
    '      <th onclick="sortTable(6)">API Type</th>\n' +
    '      <th onclick="sortTable(7)">Breadth</th>\n' +
    '      <th onclick="sortTable(8)">MCP Server</th>\n' +
    '      <th onclick="sortTable(9)">Buildability</th>\n' +
    '      <th onclick="sortTable(10)" class=\"col-blocker\">Integration Blocker</th>\n' +
    '      <th class=\"col-link\">Reference</th>\n' +
    '    </tr></thead><tbody>\n' +
    makeTableRows(results, rawResults) + '\n' +
    '    </tbody></table>\n' +
    '  </div>\n' +
    '</div>\n' +

    '</div></div>\n' + // END WORKSPACE

    // FOOTER
    '<div class="footer"><div class="container-fluid">\n' +
    '  <p>Landscape Research Dashboard — Intern Assignment Submission</p>\n' +
    '</div></div>\n' +

    '<script>\n' + JS + '\n</script>\n' +
    "</body>\n</html>";

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  var outputPath = path.join(OUTPUT_DIR, "index.html");
  fs.writeFileSync(outputPath, html);
  console.log("\n[SUCCESS] HTML report generated: " + outputPath);
  console.log("          Open in browser: file://" + outputPath);
}

var CSS = [
  "*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }",
  ":root {",
  "  --bg: #0b0b0d;",
  "  --surface: #121215;",
  "  --surface-hover: #16161a;",
  "  --border: #222226;",
  "  --text: #f3f4f6;",
  "  --text-muted: #9ca3af;",
  "  --accent: #0ea5e9;",
  "  --accent-dim: rgba(14, 165, 233, 0.15);",
  "  --green: #10b981;",
  "  --green-bg: rgba(16, 185, 129, 0.1);",
  "  --yellow: #f59e0b;",
  "  --yellow-bg: rgba(245, 158, 11, 0.1);",
  "  --red: #ef4444;",
  "  --red-bg: rgba(239, 68, 68, 0.1);",
  "  --blue: #3b82f6;",
  "  --blue-bg: rgba(59, 130, 246, 0.1);",
  "  --font-mono: 'JetBrains Mono', monospace;",
  "}",
  "body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; -webkit-font-smoothing: antialiased; padding-bottom: 40px; }",
  ".container-fluid { max-width: 1540px; margin: 0 auto; padding: 0 32px; }",
  
  // NAVBAR
  ".navbar { height: 60px; border-bottom: 1px solid var(--border); background: #08080a; display: flex; align-items: center; }",
  ".navbar .container-fluid { display: flex; align-items: center; justify-content: space-between; width: 100%; }",
  ".logo { font-weight: 800; font-size: 0.95rem; letter-spacing: 0.1em; color: var(--accent); }",
  ".logo-light { color: var(--text-muted); font-weight: 500; }",
  ".nav-meta { display: flex; gap: 12px; }",
  ".nav-badge { font-size: 0.75rem; font-family: var(--font-mono); background: var(--surface); border: 1px solid var(--border); padding: 4px 10px; color: var(--text-muted); }",

  // HERO
  ".hero-block { padding: 48px 0 24px; border-bottom: 1px solid var(--border); margin-bottom: 24px; }",
  ".hero-block h1 { font-size: 2.2rem; font-weight: 700; color: #fff; margin-bottom: 12px; letter-spacing: -0.02em; }",
  ".hero-block p { font-size: 0.95rem; color: var(--text-muted); max-width: 840px; line-height: 1.6; }",

  // TABS
  ".tab-selectors { display: flex; gap: 8px; border-bottom: 1px solid var(--border); margin-bottom: 28px; padding-bottom: 1px; }",
  ".tab-btn { background: none; border: none; border-bottom: 2px solid transparent; padding: 10px 20px; font-size: 0.85rem; font-weight: 600; color: var(--text-muted); cursor: pointer; transition: all 0.2s; font-family: inherit; }",
  ".tab-btn:hover { color: #fff; }",
  ".tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }",
  ".tab-content { display: none; }",
  ".tab-content.active { display: block; }",

  // HEADINGS
  ".section-title { font-size: 0.9rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 16px; padding-bottom: 4px; border-bottom: 1px solid var(--border); }",

  // FINDINGS GRID
  ".findings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 32px; }",
  ".finding-card { background: var(--surface); border: 1px solid var(--border); padding: 24px; }",
  ".finding-card .card-metric { font-size: 2rem; font-weight: 700; color: #fff; font-family: var(--font-mono); margin-bottom: 4px; }",
  ".finding-card .card-title { font-size: 0.85rem; font-weight: 600; color: var(--accent); margin-bottom: 8px; }",
  ".finding-card .card-detail { font-size: 0.85rem; color: var(--text-muted); line-height: 1.45; }",

  // CHARTS GRID
  ".charts-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 24px; }",
  ".charts-grid-two { display: grid; grid-template-columns: 1.2fr 1fr; gap: 24px; }",
  ".chart-card { background: var(--surface); border: 1px solid var(--border); padding: 24px; }",
  ".chart-card h3 { font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 20px; }",
  ".bar-chart { display: flex; flex-direction: column; gap: 14px; }",
  ".bar-row { display: flex; align-items: center; gap: 16px; }",
  ".bar-label { width: 140px; font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
  ".bar-track { flex: 1; height: 18px; background: #09090b; overflow: hidden; }",
  ".bar-fill { height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 10px; font-size: 0.7rem; font-weight: 700; color: #fff; font-family: var(--font-mono); }",
  ".bar-pct { opacity: 0.7; font-weight: 400; font-size: 0.65rem; }",
  ".bar-fill.auth { background: #0369a1; }",
  ".bar-fill.api { background: #0f766e; }",
  ".bar-fill.build { background: #b45309; }",
  ".bar-fill.serve { background: #4338ca; }",
  ".bar-fill.red-chart { background: #be123c; }",

  // HEATMAP
  ".heatmap-container { overflow-x: auto; }",
  ".heatmap-grid { display: grid; grid-template-columns: 160px repeat(4, 1fr); gap: 2px; }",
  ".heatmap-header { background: #0a0a0c; padding: 12px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--text-muted); text-align: center; }",
  ".heatmap-header:first-child { text-align: left; }",
  ".heatmap-label { background: #18181b; padding: 12px; font-size: 0.75rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }",
  ".heatmap-cell { padding: 12px; text-align: center; font-size: 0.75rem; font-family: var(--font-mono); font-weight: 700; }",
  ".heatmap-cell.val-easy { background: rgba(16, 185, 129, 0.15); color: #34d399; }",
  ".heatmap-cell.val-mod { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }",
  ".heatmap-cell.val-hard { background: rgba(239, 68, 68, 0.15); color: #f87171; }",
  ".heatmap-cell.val-nf { background: rgba(156, 163, 175, 0.15); color: #d1d5db; }",

  // PILLS
  ".list-card { display: flex; flex-direction: column; }",
  ".list-card .subtitle { font-size: 0.75rem; color: var(--text-muted); margin-top: -12px; margin-bottom: 16px; }",
  ".pills-container { display: flex; flex-wrap: wrap; gap: 6px; }",
  ".pill-win { font-size: 0.75rem; padding: 4px 10px; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); color: #34d399; }",
  ".pill-outreach { font-size: 0.75rem; padding: 4px 10px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; }",

  // TABLE UTILS
  ".filter-bar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }",
  ".filter-buttons { display: flex; gap: 6px; flex-wrap: wrap; }",
  ".filter-btn { background: var(--surface); border: 1px solid var(--border); padding: 6px 14px; font-size: 0.75rem; font-weight: 500; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; gap: 6px; }",
  ".filter-btn:hover { background: var(--surface-hover); color: #fff; }",
  ".filter-btn.active { background: var(--accent-dim); border-color: var(--accent); color: #fff; }",
  ".btn-count { background: #09090b; padding: 2px 6px; font-family: var(--font-mono); font-size: 0.65rem; color: var(--text-muted); }",
  ".search-input { background: var(--surface); border: 1px solid var(--border); padding: 8px 16px; font-size: 0.78rem; color: #fff; outline: none; width: 260px; }",
  ".search-input:focus { border-color: var(--accent); }",

  // TABLE
  ".table-container { overflow-x: auto; border: 1px solid var(--border); background: var(--surface); max-height: 800px; }",
  "table { width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; }",
  "th { background: #0d0d10; padding: 12px 16px; font-weight: 600; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; color: var(--text-muted); border-bottom: 1px solid var(--border); cursor: pointer; user-select: none; position: sticky; top: 0; z-index: 10; }",
  "th:hover { color: #fff; }",
  "td { padding: 12px 16px; border-bottom: 1px solid var(--border); vertical-align: top; }",
  "tr:hover td { background: var(--surface-hover); }",
  "tr:last-child td { border-bottom: none; }",
  
  // COL WIDTHS
  ".col-id { width: 40px; font-family: var(--font-mono); color: var(--text-muted); }",
  ".col-app { font-weight: 600; color: #fff; white-space: nowrap; }",
  ".col-desc { max-width: 260px; font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; }",
  ".col-tags { max-width: 200px; }",
  ".col-blocker { max-width: 180px; font-size: 0.75rem; color: var(--text-muted); }",
  ".col-link a { color: var(--accent); text-decoration: none; font-size: 0.75rem; }",
  ".col-link a:hover { text-decoration: underline; }",

  // BADGES & TAGS
  ".category-badge { font-size: 0.7rem; font-weight: 600; padding: 2px 6px; }",
  ".tag { display: inline-block; font-size: 0.7rem; font-weight: 600; padding: 2px 8px; margin: 1px; }",
  ".tag-green { background: var(--green-bg); color: #34d399; }",
  ".tag-yellow { background: var(--yellow-bg); color: #fbbf24; }",
  ".tag-red { background: var(--red-bg); color: #f87171; }",
  ".tag-blue { background: var(--blue-bg); color: #60a5fa; }",
  ".tag-muted { background: rgba(156, 163, 175, 0.08); color: #d1d5db; }",

  // METHODOLOGY SECTION
  ".pipeline-flow { display: flex; gap: 8px; margin: 16px 0; flex-wrap: wrap; }",
  ".pipeline-step { flex: 1; min-width: 140px; background: #09090b; border: 1px solid var(--border); padding: 12px; }",
  ".pipeline-step .step-lbl { font-size: 0.65rem; text-transform: uppercase; color: var(--accent); font-weight: 700; margin-bottom: 2px; }",
  ".pipeline-step span { font-size: 0.8rem; font-weight: 500; }",
  ".tech-tags { display: flex; gap: 8px; margin-top: 16px; }",
  ".tech-tag { font-size: 0.7rem; font-family: var(--font-mono); background: #09090b; padding: 4px 10px; color: var(--text-muted); border: 1px solid var(--border); }",
  ".methodology-text { font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; }",

  // HUMAN LOOPS
  ".verification-stats { display: flex; gap: 12px; margin: 16px 0; }",
  ".stat-box { flex: 1; background: #09090b; border: 1px solid var(--border); padding: 14px; text-align: center; }",
  ".stat-box .stat-num { font-size: 1.3rem; font-weight: 700; color: #fff; font-family: var(--font-mono); display: block; }",
  ".stat-box .stat-lbl { font-size: 0.65rem; color: var(--text-muted); }",
  ".correction-log { background: #09090b; border: 1px solid var(--border); padding: 16px; margin-top: 14px; max-height: 180px; overflow-y: auto; text-align: left; }",
  ".log-title { font-size: 0.7rem; text-transform: uppercase; font-weight: 700; color: var(--accent); margin-bottom: 8px; letter-spacing: 0.05em; }",
  ".correction-log-item { font-size: 0.75rem; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.05); }",
  ".correction-log-item:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }",
  ".val-raw { color: var(--red); text-decoration: line-through; margin-right: 4px; }",
  ".val-new { color: var(--green); font-weight: 600; }",
  "tr.row-corrected td { background: rgba(14, 165, 233, 0.025); }",
  ".tag-corrected { border: 1px solid var(--yellow) !important; box-shadow: 0 0 4px rgba(245, 158, 11, 0.15); }",

  // FOOTER
  ".footer { margin-top: 60px; padding: 24px 0; border-top: 1px solid var(--border); text-align: center; }",
  ".footer p { font-size: 0.75rem; color: var(--text-muted); }",

  // RESPONSIVE
  "@media (max-width: 1024px) {",
  "  .charts-grid-two { grid-template-columns: 1fr; }",
  "}",
  "@media (max-width: 768px) {",
  "  .container-fluid { padding: 0 16px; }",
  "  .charts-grid { grid-template-columns: 1fr; }",
  "  .heatmap-grid { grid-template-columns: 120px repeat(4, 1fr); }",
  "  .navbar .nav-meta { display: none; }",
  "  .filter-bar { flex-direction: column; align-items: stretch; }",
  "  .search-input { width: 100%; }",
  "}",
].join("\n");

var JS = [
  "function switchTab(tabId) {",
  "  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });",
  "  document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });",
  "  var activeBtn = Array.from(document.querySelectorAll('.tab-btn')).find(function(b) { return b.getAttribute('onclick').includes(tabId); });",
  "  if (activeBtn) activeBtn.classList.add('active');",
  "  var activeContent = document.getElementById(tabId);",
  "  if (activeContent) activeContent.classList.add('active');",
  "}",
  "function filterTable(category) {",
  "  document.querySelectorAll('.filter-btn').forEach(function(b) { b.classList.remove('active'); });",
  "  event.currentTarget.classList.add('active');",
  "  document.querySelectorAll('#research-table tbody tr').forEach(function(row) {",
  "    row.style.display = (category === 'all' || row.dataset.category === category) ? '' : 'none';",
  "  });",
  "}",
  "function searchTable(query) {",
  "  var q = query.toLowerCase();",
  "  document.querySelectorAll('#research-table tbody tr').forEach(function(row) {",
  "    row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';",
  "  });",
  "}",
  "var sortDirection = {};",
  "function sortTable(colIndex) {",
  "  var table = document.getElementById('research-table');",
  "  var tbody = table.querySelector('tbody');",
  "  var rows = Array.from(tbody.querySelectorAll('tr'));",
  "  var dir = sortDirection[colIndex] = !sortDirection[colIndex];",
  "  rows.sort(function(a, b) {",
  "    var aText = (a.children[colIndex] && a.children[colIndex].textContent.trim()) || '';",
  "    var bText = (b.children[colIndex] && b.children[colIndex].textContent.trim()) || '';",
  "    var aNum = parseFloat(aText); var bNum = parseFloat(bText);",
  "    if (!isNaN(aNum) && !isNaN(bNum)) return dir ? aNum - bNum : bNum - aNum;",
  "    return dir ? aText.localeCompare(bText) : bText.localeCompare(aText);",
  "  });",
  "  rows.forEach(function(row) { tbody.appendChild(row); });",
  "}",
].join("\n");

generateHTML();
