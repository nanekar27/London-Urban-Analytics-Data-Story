// Heatmap grid: Borough rows x Month columns, colour = crime intensity
// Responds to all 3 filters (borough, crime type, month), uses colourblind-safe Turbo scale
function drawHeatmap(crimeData, containerId, selectedBorough, selectedType, selectedMonth) {
    const container = d3.select(containerId);
    container.html("");

    const box = container.node().getBoundingClientRect();
    const margin = { top: 10, right: 20, bottom: 50, left: 140 };
    const W = box.width - margin.left - margin.right;
    const H = box.height - margin.top - margin.bottom;

    // apply crime type filter if active
    let filtered = crimeData;
    if (selectedType) filtered = filtered.filter(d => d.Crime_Type === selectedType);

    // aggregate: borough × month → total count
    const nested = d3.rollup(filtered, v => d3.sum(v, r => r.Count), d => d.Borough, d => d.Month);

    // rank boroughs by total crime
    const boroughTotals = Array.from(nested, ([b, months]) => ({
        Borough: b, Total: d3.sum(Array.from(months.values()))
    })).sort((a, b) => b.Total - a.Total);

    // pick which boroughs to display (top 15, always include selected)
    let showBoroughs;
    if (selectedBorough) {
        const top14 = boroughTotals.slice(0, 14).map(d => d.Borough);
        showBoroughs = [...new Set([selectedBorough, ...top14])].slice(0, 15);
    } else {
        showBoroughs = boroughTotals.slice(0, 15).map(d => d.Borough);
    }

    // flatten to grid rows
    const months = [...new Set(crimeData.map(d => d.Month))].sort();
    const heatData = [];
    for (const b of showBoroughs) {
        const bData = nested.get(b);
        if (!bData) continue;
        for (const m of months) {
            heatData.push({ Borough: b, Month: m, Count: bData.get(m) || 0 });
        }
    }

    const svg = container.append("svg")
        .attr("width", W + margin.left + margin.right)
        .attr("height", H + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(months).range([0, W]).padding(0.04);
    const y = d3.scaleBand().domain(showBoroughs).range([0, H]).padding(0.04);
    const maxVal = d3.max(heatData, d => d.Count);
    const colour = d3.scaleSequential(d3.interpolateInferno).domain([0, maxVal]);

    // axes
    svg.append("g").attr("transform",`translate(0,${H})`)
        .call(d3.axisBottom(x).tickFormat(d => d.slice(5)))
        .selectAll("text").attr("transform","rotate(-35)").style("text-anchor","end")
        // highlight active month on the axis
        .style("fill", d => (selectedMonth === d) ? "#00e5c0" : "#999")
        .style("font-weight", d => (selectedMonth === d) ? "700" : "400");

    svg.append("g").call(d3.axisLeft(y).tickSize(0).tickPadding(6))
        .selectAll("text").style("font-size","9px")
        .style("fill", d => (selectedBorough === d) ? "#00e5c0" : "#999")
        .style("font-weight", d => (selectedBorough === d) ? "700" : "400");
    svg.select(".domain").remove();

    // highlight column for active month
    if (selectedMonth && months.includes(selectedMonth)) {
        svg.append("rect")
            .attr("x", x(selectedMonth) - 2)
            .attr("y", 0)
            .attr("width", x.bandwidth() + 4)
            .attr("height", H)
            .attr("fill", "none")
            .attr("stroke", "#00e5c0")
            .attr("stroke-width", 1.5)
            .attr("stroke-dasharray", "4,3")
            .attr("rx", 3);
    }

    // heatmap cells
    svg.selectAll("rect.cell")
        .data(heatData).join("rect").attr("class","cell")
        // TAG for cross-chart hover
        .attr("data-borough", d => d.Borough)
        .attr("x", d => x(d.Month))
        .attr("y", d => y(d.Borough))
        .attr("width", x.bandwidth())
        .attr("height", y.bandwidth())
        .attr("rx", 2)
        .attr("fill", d => colour(d.Count))
        .attr("cursor","pointer")
        // HOVER  highlight across all charts
        .on("mouseover", function(evt, d) {
            window.highlightBorough(d.Borough);
            d3.select(this).attr("stroke","#fff").attr("stroke-width",1.5);
            showTip(evt, `<strong>${d.Borough}</strong><hr>
                📅 ${d.Month}<br>
                🚨 Crimes: <span class="val-mag">${d3.format(",")(d.Count)}</span>`);
        })
        .on("mousemove", moveTip)
        .on("mouseout", function() {
            window.unhighlightBorough();
            d3.select(this).attr("stroke","none");
            hideTip();
        })
        // CLICK  filter by borough
        .on("click", (evt, d) => window.selectBorough(d.Borough))
        // entrance animation — cells fade in with staggered delay
        .style("opacity", 0)
        .transition().duration(400).delay((d, i) => i * 1.5).ease(d3.easeCubicOut)
        .style("opacity", d => {
            let op = 1;
            if (selectedBorough && d.Borough !== selectedBorough) op *= 0.3;
            if (selectedMonth && d.Month !== selectedMonth) op *= 0.4;
            return Math.max(op, 0.08);
        });

    // colour legend
    const lW = 120, lH = 10;
    const legend = svg.append("g").attr("transform",`translate(${W-lW-5},${H+30})`);
    const defs = svg.append("defs");
    const lg = defs.append("linearGradient").attr("id","heat-lg");
    lg.append("stop").attr("offset","0%").attr("stop-color", colour(0));
    lg.append("stop").attr("offset","100%").attr("stop-color", colour(maxVal));
    legend.append("rect").attr("width",lW).attr("height",lH).attr("rx",3).style("fill","url(#heat-lg)");
    legend.append("g").attr("transform",`translate(0,${lH})`)
        .call(d3.axisBottom(d3.scaleLinear().domain([0,maxVal]).range([0,lW])).ticks(3).tickFormat(d3.format(".2s")))
        .selectAll("text").style("font-size","9px");
}
