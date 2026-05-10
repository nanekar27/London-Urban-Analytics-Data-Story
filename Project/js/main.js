
let DATA = { crime: [], crimeByB: [], housing: [], schools: [] };

//  Interaction state (null = no filter active) 
let STATE = {
    selected:   null,   // borough name
    crimeType:  null,   // crime type string
    month:      null,   // month string like "2025-06"
};

//  Shared tooltip 
const tip = d3.select("#tooltip");

function showTip(evt, html) {
    tip.html(html).style("opacity", 1)
       .style("left", (evt.clientX + 14) + "px")
       .style("top",  (evt.clientY - 14) + "px");
}
function moveTip(evt) {
    tip.style("left", (evt.clientX + 14) + "px")
       .style("top",  (evt.clientY - 14) + "px");
}
function hideTip() { tip.style("opacity", 0); }


window.highlightBorough = function(borough) {
    d3.selectAll("[data-borough]")
      .classed("chart-dim", true)
      .classed("chart-highlight", false);
    d3.selectAll(`[data-borough="${borough}"]`)
      .classed("chart-dim", false)
      .classed("chart-highlight", true);
};

window.unhighlightBorough = function() {
    d3.selectAll("[data-borough]")
      .classed("chart-dim", false)
      .classed("chart-highlight", false);
};

window.selectBorough = function(borough) {
    STATE.selected = (STATE.selected === borough) ? null : borough;
    renderAll();
};

window.selectCrimeType = function(crimeType) {
    STATE.crimeType = (STATE.crimeType === crimeType) ? null : crimeType;
    renderAll();
};

window.selectMonth = function(month) {
    STATE.month = (STATE.month === month) ? null : month;
    renderAll();
};

window.clearFilter = function() {
    STATE.selected = null;
    STATE.crimeType = null;
    STATE.month = null;
    renderAll();
};


console.log();

Promise.all([
    d3.csv("data/crime_by_borough_month_type.csv"),
    d3.csv("data/crime_by_borough.csv"),
    d3.csv("data/housing_summary.csv"),
    d3.csv("data/schools_summary.csv"),
]).then(([crime, crimeByB, housing, schools]) => {

    // parse all numeric fields
    crime.forEach(d    => { d.Count = +d.Count; });
    crimeByB.forEach(d => { d.Total_Crimes = +d.Total_Crimes; });
    housing.forEach(d  => {
        d.Average_Price = +d.Average_Price;
        d.Median_Price  = +d.Median_Price;
        d.Transaction_Count = +d.Transaction_Count;
    });
    schools.forEach(d  => {
        d.Total_Schools   = +d.Total_Schools;
        d.Total_Capacity  = +d.Total_Capacity;
        d.Total_Pupils    = +d.Total_Pupils;
        d.Avg_FSM_Percent = +d.Avg_FSM_Percent;
    });

    DATA.crime = crime; DATA.crimeByB = crimeByB;
    DATA.housing = housing; DATA.schools = schools;

    console.log(" Data loaded. Rendering dashboard...");
    renderAll();

}).catch(err => console.error(" Data load error:", err));

function renderAll() {
    const b  = STATE.selected;
    const ct = STATE.crimeType;
    const mo = STATE.month;

    updateKPIs(b, ct, mo);
    updateFilterUI();

    // each chart receives the full data + current state so it can
    // handle its own filtering AND mark selected elements
    drawOverviewChart(DATA.crimeByB, DATA.crime, DATA.housing, DATA.schools, "#overview-container", b);
    drawBubbleChart(DATA.housing, DATA.crimeByB, DATA.schools, "#bubble-container", b);
    drawLineChart(DATA.crime, "#line-container", b, ct, mo);
    drawDonutChart(DATA.crime, "#donut-container", b, ct);
    drawHousingChart(DATA.housing, "#housing-container", b);
    drawSchoolChart(DATA.schools, "#schools-container", b);
    drawHeatmap(DATA.crime, "#heatmap-container", b, ct, mo);
}

function updateKPIs(borough, crimeType, month) {
    let cf = DATA.crime;
    if (borough)   cf = cf.filter(d => d.Borough === borough);
    if (crimeType) cf = cf.filter(d => d.Crime_Type === crimeType);
    if (month)     cf = cf.filter(d => d.Month === month);
    animateNum("#kpi-crime-val", d3.sum(cf, d => d.Count), d3.format(","));

    const hSub = borough ? DATA.housing.filter(d => d.Borough === borough) : DATA.housing;
    animateNum("#kpi-price-val", d3.mean(hSub, d => d.Average_Price) || 0, d => "£" + d3.format(".3s")(d));

    const sSub = borough ? DATA.schools.filter(d => d.Borough === borough) : DATA.schools;
    animateNum("#kpi-schools-val", d3.sum(sSub, d => d.Total_Capacity), d3.format(","));

    const fv = sSub.filter(d => d.Avg_FSM_Percent > 0);
    animateNum("#kpi-fsm-val", fv.length ? d3.mean(fv, d => d.Avg_FSM_Percent) : 0, d => d.toFixed(1) + "%");
}

function animateNum(sel, target, fmt) {
    const el = d3.select(sel);
    const cur = parseFloat(el.text().replace(/[^0-9.-]/g, '')) || 0;
    el.transition().duration(700).tween("text", function() {
        const i = d3.interpolateNumber(cur, target);
        return function(t) { this.textContent = fmt(i(t)); };
    });
}

function updateFilterUI() {
    const parts = [];
    if (STATE.selected)  parts.push("" + STATE.selected);
    if (STATE.crimeType) parts.push("" + STATE.crimeType);
    if (STATE.month)     parts.push("" + STATE.month);
    d3.select("#filter-label").text(parts.length ? parts.join("  ·  ") : "Showing: All London");
    d3.select("#btn-reset").style("display", parts.length ? "inline-block" : "none");
}