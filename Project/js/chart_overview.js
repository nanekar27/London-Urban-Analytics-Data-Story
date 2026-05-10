
// track which category tab is active (persists across re-renders)
let _activeCategory = "crime";

function drawOverviewChart(crimeByB, crime, housing, schools, containerId, selectedBorough) {
    const container = d3.select(containerId);
    container.html("");

    const box = container.node().getBoundingClientRect();

    // CATEGORY BUTTONS
    const btnRow = container.append("div")
        .style("display", "flex")
        .style("gap", "8px")
        .style("margin-bottom", "10px");

    const categories = [
        { id: "crime",   label: "🚨 Crime",    color: "#e14eca" },
        { id: "housing", label: "🏠 Housing",   color: "#00e5c0" },
        { id: "schools", label: "🎓 Schools",   color: "#f0b429" },
    ];

    categories.forEach(cat => {
        btnRow.append("button")
            .text(cat.label)
            .style("padding", "5px 14px")
            .style("border-radius", "6px")
            .style("border", _activeCategory === cat.id
                ? `2px solid ${cat.color}` : "1px solid #333")
            .style("background", _activeCategory === cat.id
                ? cat.color + "22" : "#1e1e2f")
            .style("color", _activeCategory === cat.id
                ? cat.color : "#888")
            .style("font-size", "12px")
            .style("font-weight", _activeCategory === cat.id ? "700" : "400")
            .style("cursor", "pointer")
            .on("click", function() {
                _activeCategory = cat.id;
                // re-render just this chart (not the whole dashboard)
                drawOverviewChart(crimeByB, crime, housing, schools, containerId, selectedBorough);
            });
    });

    // PREPARE DATA BASED ON ACTIVE CATEGORY 
    let chartData, subKeys, subColours, valueLabel, sortKey;

    if (_activeCategory === "crime") {
        // grouped by top 5 crime types per borough
        const topTypes = Array.from(
            d3.rollup(crime, v => d3.sum(v, r => r.Count), d => d.Crime_Type),
            ([t, c]) => ({ type: t, total: c })
        ).sort((a, b) => b.total - a.total).slice(0, 5).map(d => d.type);

        subKeys = topTypes;
        subColours = ["#e14eca", "#f5365c", "#fb6340", "#ffd600", "#8965e0"];
        valueLabel = "Crime Count";

        const byBorough = d3.rollup(
            crime.filter(d => topTypes.includes(d.Crime_Type)),
            v => {
                const obj = {};
                topTypes.forEach(t => { obj[t] = 0; });
                v.forEach(r => { if (obj[r.Crime_Type] !== undefined) obj[r.Crime_Type] += r.Count; });
                return obj;
            },
            d => d.Borough
        );

        chartData = Array.from(byBorough, ([b, vals]) => {
            const row = { Borough: b, _total: 0 };
            topTypes.forEach(t => { row[t] = vals[t] || 0; row._total += row[t]; });
            return row;
        }).sort((a, b) => b._total - a._total);

    } else if (_activeCategory === "housing") {
        // grouped by property type
        subKeys = ["Flat", "Terraced", "Semi-Detached", "Detached"];
        subColours = ["#00e5c0", "#11cdef", "#2dce89", "#1d8cf8"];
        valueLabel = "Avg Price (£)";

        const byBorough = d3.group(housing, d => d.Borough);
        chartData = Array.from(byBorough, ([b, rows]) => {
            const row = { Borough: b, _total: 0 };
            subKeys.forEach(t => {
                const match = rows.find(r => r.Property_Type === t);
                row[t] = match ? match.Average_Price : 0;
                row._total += row[t];
            });
            return row;
        }).sort((a, b) => b._total - a._total);

    } else {
        // schools: grouped by phase
        subKeys = ["Primary", "Secondary", "16 plus", "Nursery"];
        subColours = ["#2dce89", "#5e72e4", "#f0b429", "#fb6340"];
        valueLabel = "Capacity (Places)";

        const byBorough = d3.group(schools, d => d.Borough);
        chartData = Array.from(byBorough, ([b, rows]) => {
            const row = { Borough: b, _total: 0 };
            subKeys.forEach(p => {
                const match = rows.find(r => r.Phase === p);
                row[p] = match ? match.Total_Capacity : 0;
                row._total += row[p];
            });
            return row;
        }).sort((a, b) => b._total - a._total);
    }

    // LAYOUT
    // chart on the left, borough list on the right
    const wrapper = container.append("div")
        .style("display", "flex")
        .style("gap", "12px")
        .style("height", (box.height - 50) + "px")
        .style("overflow", "hidden");

    const chartDiv = wrapper.append("div")
        .style("flex", "3")
        .style("min-width", "0")
        .style("overflow-y", "auto")
        .style("overflow-x", "hidden");

    const listDiv = wrapper.append("div")
        .style("flex", "1")
        .style("min-width", "140px")
        .style("max-width", "180px")
        .style("overflow-y", "auto")
        .style("padding-right", "4px")
        .style("border-left", "1px solid #2a2d40")
        .style("padding-left", "10px");

    // DRAW GROUPED BAR CHART 
    const margin = { top: 5, right: 10, bottom: 30, left: 125 };
    const barH = 18;
    const groupH = subKeys.length * barH + 8;
    const totalH = chartData.length * groupH;
    const cW = chartDiv.node().getBoundingClientRect().width || 400;
    const W = cW - margin.left - margin.right;

    const svg = chartDiv.append("svg")
        .attr("width", cW)
        .attr("height", totalH + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // scales
    const yGroup = d3.scaleBand()
        .domain(chartData.map(d => d.Borough))
        .range([0, totalH])
        .padding(0.15);

    const ySub = d3.scaleBand()
        .domain(subKeys)
        .range([0, yGroup.bandwidth()])
        .padding(0.08);

    const maxVal = d3.max(chartData, d => d3.max(subKeys, k => d[k]));
    const xScale = d3.scaleLinear().domain([0, maxVal * 1.05]).range([0, W]).nice();
    const colour = d3.scaleOrdinal().domain(subKeys).range(subColours);

    // y axis (borough names)
    svg.append("g")
        .call(d3.axisLeft(yGroup).tickSize(0).tickPadding(6))
        .selectAll("text")
        .style("font-size", "9px")
        .style("fill", d => (selectedBorough === d) ? "#00e5c0" : "#999")
        .style("font-weight", d => (selectedBorough === d) ? "700" : "400");
    svg.select(".domain").remove();

    // x axis
    svg.append("g").attr("transform", `translate(0,${totalH})`)
        .call(d3.axisBottom(xScale).ticks(5).tickFormat(
            _activeCategory === "housing"
                ? d => "£" + d3.format(".2s")(d)
                : d3.format(".2s")
        ));

    // gridlines
    svg.append("g")
        .call(d3.axisBottom(xScale).ticks(5).tickSize(totalH).tickFormat(""))
        .attr("stroke-opacity", 0.05)
        .select(".domain").remove();

    // grouped bars
    const groups = svg.selectAll("g.group")
        .data(chartData).join("g").attr("class", "group")
        .attr("transform", d => `translate(0,${yGroup(d.Borough)})`);

    groups.selectAll("rect")
        .data(d => subKeys.map(k => ({
            key: k, value: d[k], Borough: d.Borough, total: d._total
        })))
        .join("rect")
        // TAG for cross-chart hover
        .attr("data-borough", d => d.Borough)
        .attr("y", d => ySub(d.key))
        .attr("height", ySub.bandwidth())
        .attr("x", 0)
        .attr("rx", 2)
        .attr("fill", d => colour(d.key))
        .attr("opacity", d => {
            if (!selectedBorough) return 0.85;
            return d.Borough === selectedBorough ? 1 : 0.15;
        })
        .attr("cursor", "pointer")
        // HOVER → highlight across all charts
        .on("mouseover", function(evt, d) {
            window.highlightBorough(d.Borough);
            d3.select(this).attr("opacity", 1);
            const fmt = _activeCategory === "housing"
                ? v => "£" + d3.format(",")(Math.round(v))
                : v => d3.format(",")(v);
            showTip(evt, `<strong>${d.Borough}</strong><hr>
                📊 ${d.key}: <span class="val-cyan">${fmt(d.value)}</span><br>
                Total: ${fmt(d.total)}`);
        })
        .on("mousemove", moveTip)
        .on("mouseout", function(evt, d) {
            window.unhighlightBorough();
            const active = (selectedBorough === d.Borough);
            d3.select(this).attr("opacity", !selectedBorough ? 0.85 : (active ? 1 : 0.15));
            hideTip();
        })
        // CLICK → filter all charts
        .on("click", (evt, d) => window.selectBorough(d.Borough))
        // entrance animation
        .attr("width", 0)
        .transition().duration(500).delay((d, i) => i * 3).ease(d3.easeCubicOut)
        .attr("width", d => xScale(d.value));

    //  LEGEND (top of chart) 
    const leg = svg.append("g").attr("transform", `translate(${W - 20}, 0)`);
    subKeys.forEach((k, i) => {
        const label = k.length > 15 ? k.slice(0, 14) + "…" : k;
        const row = leg.append("g").attr("transform", `translate(0,${i * 15})`);
        row.append("rect").attr("width", 9).attr("height", 9).attr("rx", 2)
            .attr("fill", colour(k));
        row.append("text").attr("x", -6).attr("y", 8)
            .attr("text-anchor", "end")
            .text(label).style("font-size", "8px").style("fill", "#999");
    });

    // BOROUGH RANKING LIST (right side) 
    listDiv.append("div")
        .style("font-size", "10px")
        .style("color", "#666")
        .style("margin-bottom", "6px")
        .style("font-weight", "600")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "0.5px")
        .text("Rank by Total");

    const fmt = _activeCategory === "housing"
        ? v => "£" + d3.format(".2s")(v)
        : v => d3.format(",")(v);

    chartData.forEach((d, i) => {
        const row = listDiv.append("div")
            .style("display", "flex")
            .style("align-items", "center")
            .style("gap", "6px")
            .style("padding", "3px 0")
            .style("border-bottom", "1px solid #222")
            .style("cursor", "pointer")
            .style("opacity", (!selectedBorough || selectedBorough === d.Borough) ? 1 : 0.3)
            .attr("data-borough", d.Borough)
            .on("mouseover", function() { window.highlightBorough(d.Borough); })
            .on("mouseout", function() { window.unhighlightBorough(); })
            .on("click", function() { window.selectBorough(d.Borough); });

        // rank number
        row.append("span")
            .style("font-size", "9px")
            .style("color", "#555")
            .style("min-width", "16px")
            .text(i + 1);

        // borough name
        row.append("span")
            .style("font-size", "10px")
            .style("color", (selectedBorough === d.Borough) ? "#00e5c0" : "#ccc")
            .style("font-weight", (selectedBorough === d.Borough) ? "700" : "400")
            .style("flex", "1")
            .style("overflow", "hidden")
            .style("text-overflow", "ellipsis")
            .style("white-space", "nowrap")
            .text(d.Borough);

        // value
        row.append("span")
            .style("font-size", "9px")
            .style("color", "#888")
            .style("white-space", "nowrap")
            .text(fmt(d._total));
    });
}
