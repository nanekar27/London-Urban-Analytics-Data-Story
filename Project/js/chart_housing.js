// Vertical bar chart: average flat prices per borough sorted descending
// Hover highlights across all charts, click filters the dashboard
function drawHousingChart(housingData, containerId, selectedBorough) {
    const container = d3.select(containerId);
    container.html("");

    const box = container.node().getBoundingClientRect();
    const margin = { top: 10, right: 10, bottom: 90, left: 55 };
    const W = box.width - margin.left - margin.right;
    const H = box.height - margin.top - margin.bottom;

    // avg price per borough (prefer Flat, fallback to overall avg)
    const boroughs = Array.from(d3.rollup(housingData, v => {
        const flat = v.find(r => r.Property_Type === "Flat");
        return flat ? flat.Average_Price : d3.mean(v, r => r.Average_Price);
    }, d => d.Borough), ([b, p]) => ({ Borough: b, Price: p }))
    .sort((a, b) => b.Price - a.Price);

    const svg = container.append("svg")
        .attr("width", W + margin.left + margin.right)
        .attr("height", H + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // scales — X is band (boroughs), Y is linear (price)
    const xScale = d3.scaleBand().domain(boroughs.map(d => d.Borough)).range([0, W]).padding(0.2);
    const yScale = d3.scaleLinear().domain([0, d3.max(boroughs, d => d.Price) * 1.05]).range([H, 0]).nice();

    // x axis (borough names rotated)
    svg.append("g").attr("transform", `translate(0,${H})`)
        .call(d3.axisBottom(xScale).tickSize(0).tickPadding(6))
        .selectAll("text")
        .attr("transform", "rotate(-55)")
        .style("text-anchor", "end")
        .style("font-size", "8px")
        .style("fill", d => (selectedBorough === d) ? "#00e5c0" : "#999")
        .style("font-weight", d => (selectedBorough === d) ? "700" : "400");
    svg.select(".domain").remove();

    // y axis (price)
    svg.append("g").call(d3.axisLeft(yScale).ticks(5).tickFormat(d => "£" + d3.format(".2s")(d)));

    // gridlines
    svg.append("g")
        .call(d3.axisLeft(yScale).ticks(5).tickSize(-W).tickFormat(""))
        .attr("stroke-opacity", 0.06)
        .select(".domain").remove();

    // vertical bars (grow upward from bottom)
    svg.selectAll("rect.bar")
        .data(boroughs).join("rect").attr("class", "bar")
        // TAG for cross-chart hover highlighting
        .attr("data-borough", d => d.Borough)
        .attr("x", d => xScale(d.Borough))
        .attr("width", xScale.bandwidth())
        .attr("rx", 3)
        .attr("fill", d => {
            if (!selectedBorough) return "#e14eca";
            return d.Borough === selectedBorough ? "#00e5c0" : "#e14eca";
        })
        .attr("opacity", d => {
            if (!selectedBorough) return 0.85;
            return d.Borough === selectedBorough ? 1 : 0.2;
        })
        .attr("cursor", "pointer")
        // HOVER  highlight across all charts
        .on("mouseover", function(evt, d) {
            window.highlightBorough(d.Borough);
            d3.select(this).attr("fill", "#00e5c0").attr("opacity", 1);
            showTip(evt, `<strong>${d.Borough}</strong><hr>🏠 Avg Flat Price: <span class="val-cyan">£${d3.format(",")(Math.round(d.Price))}</span>`);
        })
        .on("mousemove", moveTip)
        .on("mouseout", function(evt, d) {
            window.unhighlightBorough();
            const active = (selectedBorough === d.Borough);
            d3.select(this)
                .attr("fill", active ? "#00e5c0" : "#e14eca")
                .attr("opacity", !selectedBorough ? 0.85 : (active ? 1 : 0.2));
            hideTip();
        })
        // CLICK  filter all charts
        .on("click", (evt, d) => window.selectBorough(d.Borough))
        // entrance animation — bars grow upward from x-axis
        .attr("y", H).attr("height", 0)
        .transition().duration(600).delay((d, i) => i * 15).ease(d3.easeCubicOut)
        .attr("y", d => yScale(d.Price))
        .attr("height", d => H - yScale(d.Price));
}
